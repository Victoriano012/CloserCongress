<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Ticket completion and Git hygiene

Every coding agent must validate its work, commit only the changes that belong to its current ticket, and push the current branch to the configured GitHub remote. Inspect the staged diff before committing so unrelated workspace changes are never included.

A ticket is not complete until that push succeeds. If authentication, branch protection, or remote configuration prevents the push, report the exact blocker. Never force-push or rebase shared work.
