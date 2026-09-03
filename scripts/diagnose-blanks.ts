import "./_env";
import { neon } from "@neondatabase/serverless";
import { runClaude } from "../src/lib/claude-cli";
import { fetchBillText, mapLimit } from "../src/lib/congress";
import { PARTIES } from "../src/lib/parties";
import { tally, type Vote } from "../src/lib/tally";
import {
  billSource,
  buildPrompt,
  parseClassification,
  type BillForClassification,
} from "../src/lib/classify";

/**
 * Why is so much of every bill blank? For a sample of classified bills, print
 * how many parties held a position and what share of the electorate that
 * reached, then re-judge the same bills with the current prompt (reading the
 * bill text when there is no summary) and print the same figures. Nothing is
 * written back: `npm run classify -- --force` is the tool for that.
 *
 *   npx tsx scripts/diagnose-blanks.ts [--limit 20] [--rejudge] [--model haiku]
 */
const sql = neon(process.env.DATABASE_URL!);
const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const limit = Number(flag("limit", "20"));
const model = flag("model", "haiku");
const rejudge = args.includes("--rejudge");
const N = PARTIES.filter((p) => !p.isBlank).length;

type Row = {
  id: string; congress: number; bill_type: string; number: number; title: string;
  chamber: string; sponsor_name: string | null; sponsor_party: string | null;
  sponsor_state: string | null; policy_area: string | null;
  official_summary: string | null; latest_action_text: string | null; text_url: string | null;
};

function describe(votes: Record<string, Vote>) {
  const cast = Object.values(votes).filter((v) => v !== "abstain").length;
  const t = tally(votes);
  return { cast, blank: t.blank / t.total };
}

async function main() {
  const rows = (await sql.query(
    `select b.id, b.congress, b.bill_type, b.number, b.title, b.chamber, b.sponsor_name,
            b.sponsor_party, b.sponsor_state, b.policy_area, b.official_summary,
            b.latest_action_text, b.text_url
       from bills b join bill_ai a on a.bill_id = b.id
      order by b.latest_action_date desc nulls last limit $1`,
    [limit],
  )) as Row[];
  const votes = (await sql.query(
    `select bill_id, party_slug, vote from party_votes where bill_id = any($1)`,
    [rows.map((r) => r.id)],
  )) as { bill_id: string; party_slug: string; vote: Vote }[];
  const before = new Map<string, Record<string, Vote>>();
  for (const v of votes) {
    const m = before.get(v.bill_id) ?? {};
    m[v.party_slug] = v.vote;
    before.set(v.bill_id, m);
  }

  const totals = { before: { cast: 0, blank: 0 }, after: { cast: 0, blank: 0 } };
  const lines = await mapLimit(rows, rejudge ? 4 : 1, async (r) => {
    const b = describe(before.get(r.id) ?? {});
    totals.before.cast += b.cast;
    totals.before.blank += b.blank;
    let after = "";
    let source: string = r.official_summary ? "summary" : "title";
    if (rejudge) {
      const bill: BillForClassification = {
        id: r.id, congress: r.congress, billType: r.bill_type, number: r.number,
        title: r.title, chamber: r.chamber, sponsorName: r.sponsor_name,
        sponsorParty: r.sponsor_party, sponsorState: r.sponsor_state,
        policyArea: r.policy_area, officialSummary: r.official_summary,
        billText: !r.official_summary && r.text_url ? await fetchBillText(r.text_url) : null,
        latestActionText: r.latest_action_text,
      };
      source = billSource(bill);
      const parsed = parseClassification(await runClaude(buildPrompt(bill), { model }));
      const map: Record<string, Vote> = {};
      for (const [slug, v] of Object.entries(parsed.votes)) map[slug] = v.vote;
      const a = describe(map);
      totals.after.cast += a.cast;
      totals.after.blank += a.blank;
      after = `${String(a.cast).padStart(2)}/${N} voted, ${(a.blank * 100).toFixed(1).padStart(5)}% blank`;
    }
    return `${r.id.padEnd(14)} ${source.padEnd(7)} ${String(b.cast).padStart(2)}/${N} voted, ${(b.blank * 100).toFixed(1).padStart(5)}% blank   ${after}  ${r.title.slice(0, 40)}`;
  });
  console.log(`${"bill".padEnd(14)} ${"source".padEnd(7)} ${"before".padEnd(30)} ${rejudge ? "after" : ""}`);
  for (const l of lines) console.log(l);
  const n = rows.length;
  console.log(
    `\nbefore: ${(totals.before.cast / n).toFixed(1)} parties voted per bill, ${(100 * totals.before.blank / n).toFixed(1)}% blank on average`,
  );
  if (rejudge) {
    console.log(
      `after:  ${(totals.after.cast / n).toFixed(1)} parties voted per bill, ${(100 * totals.after.blank / n).toFixed(1)}% blank on average`,
    );
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
