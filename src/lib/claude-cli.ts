/**
 * Runs a prompt through the Claude Code CLI installed on this machine.
 *
 * This is deliberately not an API-key integration. The classification pass is a
 * local, offline step that borrows the operator's own Claude subscription, so
 * nothing on Vercel ever needs a model credential. The cost is that new bills
 * are ingested automatically but only become classified when someone runs
 * `npm run classify` on a machine that is logged in.
 */

import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRATCH = mkdtempSync(join(tmpdir(), "bd3-classify-"));

export type ClaudeRunOptions = {
  model?: string;
  timeoutMs?: number;
};

export async function runClaude(
  prompt: string,
  // 180 s was too tight: haiku spends 6-8k thinking tokens on a 33-party roster,
  // which is ~80 s alone, and a handful of bills reproducibly ran past the limit
  // under concurrency. The ceiling exists to stop a hung CLI, not to pace a slow one.
  { model = "haiku", timeoutMs = 420_000 }: ClaudeRunOptions = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "claude",
      [
        "--print",
        "--model", model,
        "--output-format", "json",
        "--no-session-persistence",
        "--disable-slash-commands",
        "--allowedTools", "",
      ],
      {
        // Run outside the repo so the project's CLAUDE.md, skills and settings
        // are not pulled into every classification prompt. It has to be an *empty*
        // directory, not tmpdir() itself: with a few hundred stray entries in it
        // the CLI never returns, which is what made a handful of bills look like
        // they were timing out on their content.
        cwd: SCRATCH,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`claude timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new Error(`could not run the claude CLI: ${e.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`claude exited ${code}: ${stderr.trim().slice(0, 500)}`));
        return;
      }
      try {
        const envelope = JSON.parse(stdout) as {
          is_error?: boolean;
          result?: string;
          subtype?: string;
        };
        if (envelope.is_error || typeof envelope.result !== "string") {
          reject(new Error(`claude returned an error envelope: ${envelope.subtype ?? "unknown"}`));
          return;
        }
        resolve(envelope.result);
      } catch {
        // --output-format json should always give an envelope, but fall back to
        // the raw text rather than losing a usable response.
        resolve(stdout);
      }
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}
