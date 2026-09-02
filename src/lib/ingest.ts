/**
 * Shared ingest run used by both `scripts/ingest.ts` and the Vercel cron route.
 */
import { sql } from "@/lib/db";
import {
  discoverRecentBills,
  fetchBillStatus,
  hydrateBill,
  mapLimit,
  mapStatus,
  unknownStatuses,
  type IngestedBill,
} from "@/lib/congress";

export type IngestSummary = {
  discovered: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  /** Bills never fetched (discovered or in-progress) because the run hit its deadline. */
  abandoned: number;
  /** Stored in-progress bills whose GovTrack status was re-checked. */
  checked: number;
  /** Of those, how many had moved and were re-hydrated. */
  refreshed: number;
  /** Of those, how many changed outcome (pending → passed/failed). */
  statusChanged: number;
  statusChanges: string[];
  unknownStatuses: string[];
  errorSamples: string[];
};

const UPSERT = `
insert into bills (
  id, congress, bill_type, number, title, chamber,
  sponsor_name, sponsor_party, sponsor_state,
  introduced_date, latest_action_date, latest_action_text,
  official_summary, policy_area, congress_url, text_url, pdf_url,
  real_outcome, real_stage, real_vote_chamber, real_vote_date,
  real_yea, real_nay, real_present, real_not_voting, real_vote_url,
  real_party_breakdown
) values (
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
  $18,$19,$20,$21,$22,$23,$24,$25,$26,$27::jsonb
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
  updated_at = now()
returning (xmax = 0) as inserted`;

async function upsert(b: IngestedBill): Promise<boolean> {
  const rows = (await sql.query(UPSERT, [
    b.id, b.congress, b.billType, b.number, b.title, b.chamber,
    b.sponsorName, b.sponsorParty, b.sponsorState,
    b.introducedDate, b.latestActionDate, b.latestActionText,
    b.officialSummary, b.policyArea, b.congressUrl, b.textUrl, b.pdfUrl,
    b.realOutcome, b.realStage, b.realVoteChamber, b.realVoteDate,
    b.realYea, b.realNay, b.realPresent, b.realNotVoting, b.realVoteUrl,
    b.realPartyBreakdown ? JSON.stringify(b.realPartyBreakdown) : null,
  ])) as unknown as { inserted: boolean }[];
  return rows[0]?.inserted === true;
}

export async function runIngest(opts: {
  days?: number;
  congress?: number;
  limit?: number;
  /** Epoch ms after which no new bill is hydrated. Partial runs are safe: upserts are idempotent. */
  deadline?: number;
  onProgress?: (done: number, total: number) => void;
}): Promise<IngestSummary> {
  const days = opts.days ?? 7;
  const since = new Date(Date.now() - days * 86_400_000);

  let skipped = 0;
  const discovered = await discoverRecentBills({
    since,
    congress: opts.congress,
    limit: opts.limit,
    onFiltered: (n) => {
      skipped = n;
    },
  });

  let inserted = 0;
  let updated = 0;
  let errors = 0;
  let done = 0;
  const errorSamples: string[] = [];

  let abandoned = 0;
  const pastDeadline = () => opts.deadline !== undefined && Date.now() > opts.deadline;
  const recordError = (id: string, e: unknown) => {
    errors++;
    if (errorSamples.length < 5) {
      errorSamples.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  await mapLimit(discovered, 4, async (d) => {
    if (pastDeadline()) {
      abandoned++;
      return;
    }
    try {
      const bill = await hydrateBill(d);
      if (await upsert(bill)) inserted++;
      else updated++;
    } catch (e) {
      recordError(d.id, e);
    } finally {
      opts.onProgress?.(++done, discovered.length);
    }
  });

  // Second pass: re-check every stored bill that is still in progress, so one
  // that passed or failed since the last run gets its new outcome persisted
  // even if it fell outside the discovery window or limit above. Only a cheap
  // GovTrack status lookup per bill; full hydration happens only when the
  // status actually moved. Least recently touched bills go first, so a run that
  // hits its deadline resumes where the previous one left off.
  const handled = new Set(discovered.map((d) => d.id));
  const pending = (
    (await sql.query(
      `select id, congress, bill_type, number, real_outcome, real_stage
         from bills
        where real_outcome = 'pending' and congress = $1
        order by updated_at asc`,
      [opts.congress ?? 119],
    )) as unknown as PendingRow[]
  ).filter((r) => !handled.has(r.id));

  let checked = 0;
  let refreshed = 0;
  let statusChanged = 0;
  const statusChanges: string[] = [];

  await mapLimit(pending, 4, async (row) => {
    if (pastDeadline()) {
      abandoned++;
      return;
    }
    try {
      const d = await fetchBillStatus(row.congress, row.bill_type, row.number);
      checked++;
      if (!d) return;
      const outcome = mapStatus(d.currentStatus);
      if (outcome === row.real_outcome && d.currentStatusLabel === row.real_stage) {
        await sql.query(`update bills set updated_at = now() where id = $1`, [row.id]);
        return;
      }
      const bill = await hydrateBill(d);
      await upsert(bill);
      refreshed++;
      if (bill.realOutcome !== row.real_outcome) {
        statusChanged++;
        if (statusChanges.length < 20) {
          statusChanges.push(`${row.id}: ${row.real_outcome} → ${bill.realOutcome}`);
        }
      }
    } catch (e) {
      recordError(row.id, e);
    }
  });

  console.log(
    `ingest: checked ${checked}/${pending.length} in-progress bills, ` +
      `${refreshed} refreshed, ${statusChanged} changed outcome`,
  );
  for (const s of statusChanges) console.log(`  ${s}`);

  return {
    discovered: discovered.length,
    inserted,
    updated,
    skipped,
    errors,
    abandoned,
    checked,
    refreshed,
    statusChanged,
    statusChanges,
    unknownStatuses: [...unknownStatuses],
    errorSamples,
  };
}

type PendingRow = {
  id: string;
  congress: number;
  bill_type: string;
  number: number;
  real_outcome: string;
  real_stage: string | null;
};
