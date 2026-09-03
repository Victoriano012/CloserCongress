import "./_env";
import { neon } from "@neondatabase/serverless";
import { runClaude } from "../src/lib/claude-cli";
import { ensureResult } from "../src/lib/results";
import { PARTIES } from "../src/lib/parties";
import {
  buildPrompt,
  parseClassification,
  type BillForClassification,
  type Classification,
} from "../src/lib/classify";

const sql = neon(process.env.DATABASE_URL!);
const KNOWN_SLUGS = new Set(PARTIES.map((p) => p.slug));
const CLASSIFIABLE_COUNT = PARTIES.filter((p) => !p.isBlank).length;

const args = process.argv.slice(2);
const flag = (name: string, fallback: number) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(args[i + 1]);
};
const force = args.includes("--force");
const limit = flag("limit", 1000);
const concurrency = flag("concurrency", 3);
const model = args.includes("--model") ? args[args.indexOf("--model") + 1] : "haiku";

type Row = {
  id: string; congress: number; bill_type: string; number: number; title: string;
  chamber: string; sponsor_name: string | null; sponsor_party: string | null;
  sponsor_state: string | null; policy_area: string | null;
  official_summary: string | null; latest_action_text: string | null;
};

const toBill = (r: Row): BillForClassification => ({
  id: r.id, congress: r.congress, billType: r.bill_type, number: r.number,
  title: r.title, chamber: r.chamber, sponsorName: r.sponsor_name,
  sponsorParty: r.sponsor_party, sponsorState: r.sponsor_state,
  policyArea: r.policy_area, officialSummary: r.official_summary,
  latestActionText: r.latest_action_text,
});

async function persist(billId: string, c: Classification) {
  // party_votes first, bill_ai last. bill_ai is what the "already classified"
  // filter checks, so if the run dies between the two, the bill is retried
  // rather than being marked done with no votes attached to it.
  const entries = Object.entries(c.votes).filter(([slug]) => KNOWN_SLUGS.has(slug));
  const values: unknown[] = [];
  const tuples = entries.map(([slug, v], i) => {
    values.push(billId, slug, v.vote, v.reason);
    return `($${i * 4 + 1},$${i * 4 + 2},$${i * 4 + 3},$${i * 4 + 4})`;
  });
  await sql.query(
    `insert into party_votes (bill_id, party_slug, vote, reason)
     values ${tuples.join(",")}
     on conflict (bill_id, party_slug) do update set
       vote = excluded.vote, reason = excluded.reason`,
    values,
  );

  await sql.query(
    `insert into bill_ai (bill_id, plain_summary, key_points, topics, model)
     values ($1,$2,$3,$4,$5)
     on conflict (bill_id) do update set
       plain_summary = excluded.plain_summary, key_points = excluded.key_points,
       topics = excluded.topics, model = excluded.model, created_at = now()`,
    [billId, c.summary, JSON.stringify(c.keyPoints), JSON.stringify(c.topics), model],
  );

  // Tally immediately. The list page reads bill_results with a plain left join
  // and shows "Awaiting the delegates" when the row is missing, so a bill that
  // is classified but not yet tallied looks identical to one never classified.
  // ensureResult hashes the votes, so a stale row from a previous run is
  // recomputed rather than served.
  await ensureResult(
    billId,
    entries.map(([slug, v]) => ({ party_slug: slug, vote: v.vote, reason: v.reason })),
  );
}

async function classifyOne(row: Row, attempt = 1): Promise<"ok" | "failed"> {
  const bill = toBill(row);
  try {
    const raw = await runClaude(buildPrompt(bill), { model });
    const parsed = parseClassification(raw);
    await persist(row.id, parsed);
    const cast = Object.values(parsed.votes).filter((v) => v.vote !== "abstain").length;
    console.log(`  ✓ ${row.id.padEnd(16)} ${cast} of ${CLASSIFIABLE_COUNT} parties voted — ${parsed.summary.slice(0, 70)}…`);
    return "ok";
  } catch (e) {
    if (attempt < 3) {
      console.warn(`  … ${row.id} retry ${attempt}: ${(e as Error).message.slice(0, 120)}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      return classifyOne(row, attempt + 1);
    }
    console.error(`  ✗ ${row.id}: ${(e as Error).message.slice(0, 300)}`);
    return "failed";
  }
}

async function main() {
  const where = force ? "" : "where not exists (select 1 from bill_ai a where a.bill_id = b.id)";
  const rows = (await sql.query(
    `select b.id, b.congress, b.bill_type, b.number, b.title, b.chamber,
            b.sponsor_name, b.sponsor_party, b.sponsor_state, b.policy_area,
            b.official_summary, b.latest_action_text
       from bills b ${where}
      order by (b.real_yea is not null) desc,
               (b.real_outcome <> 'pending') desc,
               (b.official_summary is not null) desc,
               b.latest_action_date desc nulls last
      limit $1`,
    [limit],
  )) as Row[];

  if (rows.length === 0) {
    console.log("nothing to classify");
    return;
  }
  console.log(`classifying ${rows.length} bills with ${model}, ${concurrency} at a time\n`);

  let ok = 0;
  let failed = 0;
  const queue = [...rows];
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      for (;;) {
        const row = queue.shift();
        if (!row) return;
        const result = await classifyOne(row);
        if (result === "ok") ok++;
        else failed++;
      }
    }),
  );

  console.log(`\ndone — ${ok} classified, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main().then(() => process.exit(process.exitCode ?? 0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
