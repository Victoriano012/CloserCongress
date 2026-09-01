/**
 * Caching layer between the party votes in the database and the simulation.
 *
 * Deliberately free of `server-only` so the batch script can use the very same
 * code path the pages use — a second implementation would be a second thing to
 * get wrong.
 */
import { createHash } from "node:crypto";

import { query } from "@/lib/db";
import { tally, ELECTORATE_HASH, type TallyResult, type Vote, type PartyContribution } from "@/lib/tally";
import type { PartyVote } from "@/lib/bills";

/**
 * Fingerprint of the party votes a cached row was computed from.
 *
 * The classifier writes `party_votes` and then deletes the cached result. If it
 * dies between the two, the stale row would otherwise be served forever, since
 * the electorate hash alone cannot see that the votes changed underneath it.
 */
function votesHash(votes: PartyVote[]): string {
  const h = createHash("sha256");
  for (const v of [...votes].sort((a, b) => a.party_slug.localeCompare(b.party_slug))) {
    h.update(`${v.party_slug}:${v.vote}\n`);
  }
  return h.digest("hex").slice(0, 16);
}

/**
 * The cached tally, recomputing when it is missing, was produced against a
 * different electorate, or was produced from different votes. Writing the cache is best-effort: a read-only replica
 * or a race with another request must not break the page.
 */
export async function ensureResult(
  billId: string,
  votes: PartyVote[],
): Promise<TallyResult> {
  const cached = await query<{
    yes_weight: number; no_weight: number; blank_weight: number;
    total_weight: number; passed: boolean;
    party_breakdown: PartyContribution[]; electorate_hash: string;
    votes_hash: string;
  }>(
    `select yes_weight, no_weight, blank_weight, total_weight, passed,
            party_breakdown, electorate_hash, votes_hash
       from bill_results where bill_id = $1`,
    [billId],
  );

  const fingerprint = votesHash(votes);
  const hit = cached[0];
  if (hit && hit.electorate_hash === ELECTORATE_HASH && hit.votes_hash === fingerprint) {
    return {
      yes: hit.yes_weight,
      no: hit.no_weight,
      blank: hit.blank_weight,
      total: hit.total_weight,
      cast: hit.yes_weight + hit.no_weight,
      passed: hit.passed,
      breakdown: hit.party_breakdown,
      electorateHash: hit.electorate_hash,
    };
  }

  const map: Record<string, Vote> = {};
  for (const v of votes) map[v.party_slug] = v.vote;
  const result = tally(map);

  try {
    await query(
      `insert into bill_results
         (bill_id, yes_weight, no_weight, blank_weight, total_weight, passed,
          party_breakdown, electorate_hash, votes_hash, computed_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
       on conflict (bill_id) do update set
         yes_weight = excluded.yes_weight, no_weight = excluded.no_weight,
         blank_weight = excluded.blank_weight, total_weight = excluded.total_weight,
         passed = excluded.passed, party_breakdown = excluded.party_breakdown,
         electorate_hash = excluded.electorate_hash, votes_hash = excluded.votes_hash,
         computed_at = now()`,
      [billId, result.yes, result.no, result.blank, result.total, result.passed,
       JSON.stringify(result.breakdown), result.electorateHash, fingerprint],
    );
  } catch {
    // Cache miss is survivable; the tally above is already correct.
  }

  return result;
}
