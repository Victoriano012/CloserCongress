import "./_env";
import { sql } from "../src/lib/db";
import { ensureResult } from "../src/lib/results";
import type { PartyVote } from "../src/lib/bills";
import { contestedShare, ELECTORATE_HASH, type Vote } from "../src/lib/tally";

/**
 * Precomputes the cached tally for every classified bill, so the list page has
 * bars to draw on first load instead of computing them request by request.
 * Safe to re-run: ensureResult skips bills already cached for this electorate.
 */
async function main() {
  // No cache filter here: ensureResult decides what to recompute, and it also
  // checks the votes themselves, which this query cannot see.
  const rows = (await sql.query(
    `select pv.bill_id, pv.party_slug, pv.vote, pv.reason from party_votes pv`,
  )) as (PartyVote & { bill_id: string })[];

  const byBill = new Map<string, PartyVote[]>();
  for (const row of rows) {
    const list = byBill.get(row.bill_id) ?? [];
    list.push(row);
    byBill.set(row.bill_id, list);
  }

  // Bucketed by how many parties had an opinion at all, because the flat
  // average is dominated by post-office namings that nobody claims and would
  // read as "the ordered list does nothing" when the opposite is true.
  const BUCKETS = ["0", "1-2", "3-5", "6-9", "10+"] as const;
  const bucketOf = (cast: number) =>
    cast === 0 ? "0" : cast <= 2 ? "1-2" : cast <= 5 ? "3-5" : cast <= 9 ? "6-9" : "10+";
  const contested = new Map<string, number[]>(BUCKETS.map((b) => [b, []]));

  let passed = 0;
  for (const [billId, votes] of byBill) {
    const result = await ensureResult(billId, votes);
    if (result.passed) passed++;

    const map: Record<string, Vote> = {};
    for (const v of votes) map[v.party_slug] = v.vote;
    const cast = votes.filter((v) => v.vote !== "abstain").length;
    contested.get(bucketOf(cast))!.push(contestedShare(map));
  }

  console.log(
    `tallied ${byBill.size} bills against electorate ${ELECTORATE_HASH} — ${passed} would pass`,
  );
  console.log("\nfall-through — citizens whose delegates disagreed, by how many parties spoke:");
  for (const b of BUCKETS) {
    const v = contested.get(b)!;
    if (v.length === 0) continue;
    const mean = v.reduce((a, x) => a + x, 0) / v.length;
    console.log(
      `  ${b.padEnd(4)} parties  ${String(v.length).padStart(4)} ${v.length === 1 ? "bill " : "bills"}   ${(mean * 100).toFixed(1)}%`,
    );
  }
}

main();
