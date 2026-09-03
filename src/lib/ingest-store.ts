/**
 * Postgres persistence for `runIngest`. Kept apart from the orchestration so
 * the latter can be unit tested against an in-memory store without a database.
 */
import { sql } from "@/lib/db";
import type { IngestedBill, VoteResult } from "@/lib/congress";
import type { IngestStore } from "@/lib/ingest";

const UPSERT = `
insert into bills (
  id, congress, bill_type, number, title, chamber,
  sponsor_name, sponsor_party, sponsor_state,
  introduced_date, latest_action_date, latest_action_text,
  official_summary, policy_area, congress_url, text_url, pdf_url,
  real_outcome, real_stage, real_vote_chamber, real_vote_date,
  real_yea, real_nay, real_present, real_not_voting, real_vote_url,
  real_party_breakdown, positions_unavailable
) values (
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
  $18,$19,$20,$21,$22,$23,$24,$25,$26,$27::jsonb,$28
)
on conflict (id) do update set
  congress = excluded.congress,
  bill_type = excluded.bill_type,
  number = excluded.number,
  title = excluded.title,
  chamber = excluded.chamber,
  sponsor_name = excluded.sponsor_name,
  sponsor_party = excluded.sponsor_party,
  sponsor_state = excluded.sponsor_state,
  introduced_date = excluded.introduced_date,
  latest_action_date = excluded.latest_action_date,
  latest_action_text = excluded.latest_action_text,
  official_summary = excluded.official_summary,
  policy_area = excluded.policy_area,
  congress_url = excluded.congress_url,
  text_url = excluded.text_url,
  pdf_url = excluded.pdf_url,
  real_outcome = excluded.real_outcome,
  real_stage = excluded.real_stage,
  real_vote_chamber = excluded.real_vote_chamber,
  real_vote_date = excluded.real_vote_date,
  real_yea = excluded.real_yea,
  real_nay = excluded.real_nay,
  real_present = excluded.real_present,
  real_not_voting = excluded.real_not_voting,
  real_vote_url = excluded.real_vote_url,
  real_party_breakdown = excluded.real_party_breakdown,
  positions_unavailable = excluded.positions_unavailable,
  updated_at = now()
returning (xmax = 0) as inserted`;

export const sqlIngestStore: IngestStore = {
  async upsert(b: IngestedBill) {
    const rows = (await sql.query(UPSERT, [
      b.id, b.congress, b.billType, b.number, b.title, b.chamber,
      b.sponsorName, b.sponsorParty, b.sponsorState,
      b.introducedDate, b.latestActionDate, b.latestActionText,
      b.officialSummary, b.policyArea, b.congressUrl, b.textUrl, b.pdfUrl,
      b.realOutcome, b.realStage, b.realVoteChamber, b.realVoteDate,
      b.realYea, b.realNay, b.realPresent, b.realNotVoting, b.realVoteUrl,
      b.realPartyBreakdown ? JSON.stringify(b.realPartyBreakdown) : null,
      b.positionsUnavailable,
    ])) as unknown as { inserted: boolean }[];
    return rows[0]?.inserted === true;
  },

  async listPending(congress) {
    return (await sql.query(
      `select id, congress, bill_type, number, real_outcome, real_stage
         from bills
        where real_outcome = 'pending' and congress = $1
        order by updated_at asc`,
      [congress],
    )) as unknown as Awaited<ReturnType<IngestStore["listPending"]>>;
  },

  async touch(id) {
    await sql.query(`update bills set updated_at = now() where id = $1`, [id]);
  },

  async listMissingPositions(congress) {
    const rows = (await sql.query(
      `select id, congress, bill_type, number, latest_action_date::text as latest_action_date
         from bills
        where congress = $1
          and real_outcome <> 'pending'
          and real_party_breakdown is null
          and not positions_unavailable
        order by updated_at asc`,
      [congress],
    )) as unknown as {
      id: string; congress: number; bill_type: string; number: number; latest_action_date: string | null;
    }[];
    return rows.map((r) => ({
      id: r.id,
      congress: r.congress,
      billType: r.bill_type,
      number: r.number,
      latestActionDate: r.latest_action_date,
    }));
  },

  async savePositions(id: string, v: VoteResult) {
    await sql.query(
      `update bills set
         real_vote_chamber = $2, real_vote_date = $3, real_yea = $4, real_nay = $5,
         real_present = $6, real_not_voting = $7, real_vote_url = $8,
         real_party_breakdown = $9::jsonb, positions_unavailable = false, updated_at = now()
       where id = $1`,
      [id, v.chamber, v.date, v.yea, v.nay, v.present, v.notVoting, v.url,
        v.partyBreakdown.length ? JSON.stringify(v.partyBreakdown) : null],
    );
  },

  async markPositionsUnavailable(id: string) {
    await sql.query(
      `update bills set positions_unavailable = true, updated_at = now() where id = $1`,
      [id],
    );
  },
};
