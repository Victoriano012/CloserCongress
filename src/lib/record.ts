import "server-only";

import { query } from "@/lib/db";
import type { Delegation } from "@/lib/delegation";
import { BLANK_PARTY_SLUG } from "@/lib/parties";
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

export type RecordEntry = {
  bill: RecordBill;
  classified: boolean;
  party: string;
  vote: Vote;
  /** Delegates ahead of the one that spoke — all of them abstained. */
  silentAbove: number;
  reason: string | null;
};

export type DelegationRecord = {
  /** Every recent bill, classified or not, newest first. */
  resolved: RecordEntry[];
  /** How many of them are classified. */
  counted: number;
  /** Non-blank votes cast per delegate slug. */
  tally: Map<string, number>;
  /** Classified bills where every delegate was silent. */
  blanks: number;
};

function isVote(value: string): value is Vote {
  return value === "yes" || value === "no" || value === "abstain";
}

/** Recent classified bills and the party votes on them. Best-effort: never a 500. */
async function loadRecent(): Promise<{ bills: RecordBill[]; votes: VoteRow[] }> {
  let bills: RecordBill[] = [];
  try {
    bills = await query<RecordBill>(
      `select b.id, b.title, b.bill_type, b.number, b.latest_action_date::text
         from bills b
         join bill_ai a on a.bill_id = b.id
        order by b.latest_action_date desc nulls last, b.id desc
        limit $1`,
      [RECENT_LIMIT],
    );
  } catch {
    return { bills: [], votes: [] };
  }

  if (!bills.length) return { bills: [], votes: [] };

  try {
    const votes = await query<VoteRow>(
      `select pv.bill_id, pv.party_slug, pv.vote, pv.reason
         from party_votes pv
        where pv.bill_id = any($1)`,
      [bills.map((b) => b.id)],
    );
    return { bills, votes };
  } catch {
    return { bills, votes: [] };
  }
}

/** How a delegation has voted on the recent bills: bill by bill, plus per-delegate totals. */
export async function loadDelegationRecord(delegation: Delegation): Promise<DelegationRecord> {
  const realDelegates = delegation.filter((slug) => slug !== BLANK_PARTY_SLUG);
  const { bills, votes } = await loadRecent();

  const byBill = new Map<string, VoteRow[]>();
  for (const row of votes) {
    const bucket = byBill.get(row.bill_id);
    if (bucket) bucket.push(row);
    else byBill.set(row.bill_id, [row]);
  }

  const resolved: RecordEntry[] = bills.map((bill) => {
    const rows = byBill.get(bill.id) ?? [];
    const map: Record<string, Vote> = {};
    for (const row of rows) if (isVote(row.vote)) map[row.party_slug] = row.vote;

    const outcome = resolveForDelegation(delegation, map);
    const rank = delegation.indexOf(outcome.party);

    return {
      bill,
      classified: rows.length > 0,
      party: outcome.party,
      vote: outcome.vote,
      silentAbove: rank >= 0 ? rank : realDelegates.length,
      reason: rows.find((row) => row.party_slug === outcome.party)?.reason ?? null,
    };
  });

  const counted = resolved.filter((entry) => entry.classified);
  const tally = new Map<string, number>();
  let blanks = 0;
  for (const entry of counted) {
    if (entry.vote === "abstain") blanks += 1;
    else tally.set(entry.party, (tally.get(entry.party) ?? 0) + 1);
  }

  return { resolved, counted: counted.length, tally, blanks };
}
