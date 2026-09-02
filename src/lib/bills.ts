import "server-only";

import { cache } from "react";

import { RESOLVED_OUTCOMES } from "@/lib/bill-outcome";
import { query } from "@/lib/db";
import { ensureResult } from "@/lib/results";
import type { TallyResult, Vote } from "@/lib/tally";

/** Yeas and nays of one real congressional party on one roll-call vote. */
export interface RealPartyTally {
  party: string;
  yea: number;
  nay: number;
  present: number;
  notVoting: number;
}

export interface BillRow {
  id: string;
  congress: number;
  bill_type: string;
  number: number;
  title: string;
  chamber: string;
  sponsor_name: string | null;
  sponsor_party: string | null;
  sponsor_state: string | null;
  introduced_date: string | null;
  latest_action_date: string | null;
  latest_action_text: string | null;
  official_summary: string | null;
  policy_area: string | null;
  congress_url: string | null;
  text_url: string | null;
  pdf_url: string | null;
  real_outcome: "passed" | "failed" | "pending";
  real_stage: string | null;
  real_vote_chamber: string | null;
  real_vote_date: string | null;
  real_yea: number | null;
  real_nay: number | null;
  real_present: number | null;
  real_not_voting: number | null;
  real_vote_url: string | null;
  real_party_breakdown: RealPartyTally[] | null;
}

export interface BillAi {
  plain_summary: string;
  key_points: string[];
  topics: string[];
  model: string;
}

export interface PartyVote {
  party_slug: string;
  vote: Vote;
  reason: string | null;
}

/** A bill as the list page needs it: enough to rank, filter and preview. */
export interface BillListItem {
  id: string;
  title: string;
  chamber: string;
  bill_type: string;
  number: number;
  latest_action_date: string | null;
  policy_area: string | null;
  real_outcome: BillRow["real_outcome"];
  real_yea: number | null;
  real_nay: number | null;
  real_not_voting: number | null;
  plain_summary: string | null;
  passed: boolean | null;
  yes_weight: number | null;
  no_weight: number | null;
  blank_weight: number | null;
}

export function billLabel(bill: { bill_type: string; number: number }): string {
  const prefix: Record<string, string> = {
    hr: "H.R.", s: "S.", hjres: "H.J.Res.", sjres: "S.J.Res.",
    hconres: "H.Con.Res.", sconres: "S.Con.Res.", hres: "H.Res.", sres: "S.Res.",
  };
  return `${prefix[bill.bill_type] ?? bill.bill_type.toUpperCase()} ${bill.number}`;
}

/**
 * Lists only resolved bills (see `isResolved`). In-progress bills stay in the
 * table and surface here on their own once the nightly sync settles them; the
 * detail route still serves them by direct link.
 */
export async function listBills(opts: {
  limit?: number;
  offset?: number;
  query?: string;
  outcome?: string;
  /** Only bills the delegates have voted on, i.e. ones with a classified vote. */
  votedOnly?: boolean;
} = {}): Promise<{ items: BillListItem[]; total: number }> {
  const limit = Math.min(opts.limit ?? 25, 100);
  const offset = Math.max(opts.offset ?? 0, 0);

  const params: unknown[] = [RESOLVED_OUTCOMES];
  const where: string[] = ["b.real_outcome = any($1::text[])"];
  if (opts.query) {
    // Escape LIKE metacharacters: without this, searching "50_000" matches
    // "50X000" and searching "%" matches every bill in the table.
    params.push(`%${opts.query.replace(/[\\%_]/g, "\\$&")}%`);
    where.push(`(b.title ilike $${params.length} or b.id ilike $${params.length})`);
  }
  if (opts.outcome && opts.outcome !== "all") {
    params.push(opts.outcome);
    where.push(`b.real_outcome = $${params.length}`);
  }
  if (opts.votedOnly) {
    where.push("exists (select 1 from party_votes pv where pv.bill_id = b.id)");
  }
  const clause = `where ${where.join(" and ")}`;

  const items = await query<BillListItem>(
    `select b.id, b.title, b.chamber, b.bill_type, b.number, b.latest_action_date::text,
            b.policy_area, b.real_outcome, b.real_yea, b.real_nay, b.real_not_voting,
            a.plain_summary,
            r.passed, r.yes_weight, r.no_weight, r.blank_weight
       from bills b
       left join bill_ai a on a.bill_id = b.id
       left join bill_results r on r.bill_id = b.id
       ${clause}
      order by b.latest_action_date desc nulls last, b.id desc
      limit $${params.length + 1} offset $${params.length + 2}`,
    [...params, limit, offset],
  );

  const countRows = await query<{ n: number }>(
    `select count(*)::int as n from bills b ${clause}`,
    params,
  );

  return { items, total: countRows[0]?.n ?? 0 };
}

/**
 * Wrapped in `cache` because the bill page calls it from both `generateMetadata`
 * and the component itself. Without this every bill view costs a duplicate set
 * of queries and a duplicate tally.
 */
export const getBill = cache(async function getBill(id: string): Promise<{
  bill: BillRow;
  ai: BillAi | null;
  votes: PartyVote[];
  result: TallyResult | null;
} | null> {
  const [bills, ai, votes] = await Promise.all([
    query<BillRow>(
      `select b.*, b.introduced_date::text as introduced_date,
              b.latest_action_date::text as latest_action_date,
              b.real_vote_date::text as real_vote_date
         from bills b where b.id = $1`,
      [id],
    ),
    query<BillAi>(
      "select plain_summary, key_points, topics, model from bill_ai where bill_id = $1",
      [id],
    ),
    query<PartyVote>(
      "select party_slug, vote, reason from party_votes where bill_id = $1",
      [id],
    ),
  ]);

  const bill = bills[0];
  if (!bill) return null;

  return {
    bill,
    ai: ai[0] ?? null,
    votes,
    // Gated on `ai` as well: party_votes is written before bill_ai, so a run
    // killed between the two would otherwise show a full simulated result under
    // a heading that says the bill has not been classified yet.
    result: ai[0] && votes.length ? await ensureResult(id, votes) : null,
  };
});

export { ensureResult };
export { isResolved } from "@/lib/bill-outcome";
