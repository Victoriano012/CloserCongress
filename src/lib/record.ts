import "server-only";

import { query } from "@/lib/db";
import type { Delegation } from "@/lib/delegation";
import { resolveForDelegation, type Vote } from "@/lib/tally";

const RECENT_LIMIT = 25;

export type RecordBill = {
  id: string;
  title: string;
  bill_type: string;
  number: number;
  latest_action_date: string | Date | null;
};

type VoteRow = { bill_id: string; party_slug: string; vote: string; reason: string | null };

/** How one delegation voted on one bill, and through whom. */
export type ResolvedVote = {
  classified: boolean;
  party: string;
  vote: Vote;
  /** Delegates ahead of the one that spoke — all of them abstained. */
  silentAbove: number;
  reason: string | null;
};

type RecordEntry = ResolvedVote & { bill: RecordBill };

export type DelegationRecord = {
  /** How many of the recent bills are classified. */
  counted: number;
  /** Non-blank votes cast per delegate slug. */
  tally: Map<string, number>;
  /** Classified bills where every delegate was silent. */
  blanks: number;
};

function isVote(value: string): value is Vote {
  return value === "yes" || value === "no" || value === "abstain";
}

/** Party votes on the given bills, grouped by bill. Best-effort: never a 500. */
async function loadVotes(billIds: string[]): Promise<Map<string, VoteRow[]>> {
  const byBill = new Map<string, VoteRow[]>();
  if (!billIds.length) return byBill;
  try {
    const votes = await query<VoteRow>(
      `select pv.bill_id, pv.party_slug, pv.vote, pv.reason
         from party_votes pv
        where pv.bill_id = any($1)`,
      [billIds],
    );
    for (const row of votes) {
      const bucket = byBill.get(row.bill_id);
      if (bucket) bucket.push(row);
      else byBill.set(row.bill_id, [row]);
    }
  } catch {
    // fall through with whatever was grouped
  }
  return byBill;
}

function resolveVote(delegation: Delegation, rows: VoteRow[]): ResolvedVote {
  const map: Record<string, Vote> = {};
  for (const row of rows) if (isVote(row.vote)) map[row.party_slug] = row.vote;

  const outcome = resolveForDelegation(delegation, map);
  const rank = delegation.indexOf(outcome.party);

  return {
    classified: rows.length > 0,
    party: outcome.party,
    vote: outcome.vote,
    silentAbove: rank >= 0 ? rank : delegation.length - 1,
    reason: rows.find((row) => row.party_slug === outcome.party)?.reason ?? null,
  };
}

/** How a delegation voted on each of the given bills, keyed by bill id. */
export async function loadVotesForBills(
  delegation: Delegation,
  billIds: string[],
): Promise<Map<string, ResolvedVote>> {
  const byBill = await loadVotes(billIds);
  return new Map(billIds.map((id) => [id, resolveVote(delegation, byBill.get(id) ?? [])]));
}

/** Recent classified bills. Best-effort: never a 500. */
async function loadRecent(): Promise<RecordBill[]> {
  try {
    return await query<RecordBill>(
      `select b.id, b.title, b.bill_type, b.number, b.latest_action_date::text
         from bills b
         join bill_ai a on a.bill_id = b.id
        order by b.latest_action_date desc nulls last, b.id desc
        limit $1`,
      [RECENT_LIMIT],
    );
  } catch {
    return [];
  }
}

/** How a delegation has voted on the recent bills: per-delegate totals. */
export async function loadDelegationRecord(delegation: Delegation): Promise<DelegationRecord> {
  const bills = await loadRecent();
  const byBill = await loadVotes(bills.map((b) => b.id));

  const resolved: RecordEntry[] = bills.map((bill) => ({
    bill,
    ...resolveVote(delegation, byBill.get(bill.id) ?? []),
  }));

  const counted = resolved.filter((entry) => entry.classified);
  const tally = new Map<string, number>();
  let blanks = 0;
  for (const entry of counted) {
    if (entry.vote === "abstain") blanks += 1;
    else tally.set(entry.party, (tally.get(entry.party) ?? 0) + 1);
  }

  return { counted: counted.length, tally, blanks };
}
