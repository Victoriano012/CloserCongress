/**
 * Shared ingest run used by both `scripts/ingest.ts` and the Vercel cron route.
 * Pure orchestration: persistence goes through an `IngestStore` (Postgres in
 * production, in-memory in tests).
 */
import {
  discoverRecentBills,
  fetchBillPositions,
  fetchBillStatus,
  hydrateBill,
  mapLimit,
  mapStatus,
  unknownStatuses,
  type BillRef,
  type IngestedBill,
  type VoteResult,
} from "@/lib/congress";

export type PendingRow = {
  id: string;
  congress: number;
  bill_type: string;
  number: number;
  real_outcome: string;
  real_stage: string | null;
};

export type IngestStore = {
  /** Resolves true when the row was newly inserted rather than updated. */
  upsert(bill: IngestedBill): Promise<boolean>;
  /** Stored in-progress bills, least recently touched first. */
  listPending(congress: number): Promise<PendingRow[]>;
  /** Bump `updated_at` so a re-checked bill moves to the back of the queue. */
  touch(id: string): Promise<void>;
  /** Resolved bills with no party breakdown that are not known to lack a roll call. */
  listMissingPositions(congress: number): Promise<BillRef[]>;
  savePositions(id: string, vote: VoteResult): Promise<void>;
  markPositionsUnavailable(id: string): Promise<void>;
};

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
  /** Resolved bills that lacked party positions and got them this run. */
  positionsFilled: number;
  /** Resolved bills found to have no roll call at all (voice vote etc). */
  positionsUnavailable: number;
  /** Resolved bills still without party positions at the end of the run. */
  positionsMissing: string[];
  unknownStatuses: string[];
  errorSamples: string[];
};

export async function runIngest(opts: {
  store: IngestStore;
  days?: number;
  congress?: number;
  limit?: number;
  /** Epoch ms after which no new bill is hydrated. Partial runs are safe: upserts are idempotent. */
  deadline?: number;
  onProgress?: (done: number, total: number) => void;
}): Promise<IngestSummary> {
  const { store } = opts;
  const congress = opts.congress ?? 119;
  const days = opts.days ?? 7;
  const since = new Date(Date.now() - days * 86_400_000);

  let skipped = 0;
  const discovered = await discoverRecentBills({
    since,
    congress,
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
      if (await store.upsert(bill)) inserted++;
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
  const pending = (await store.listPending(congress)).filter((r) => !handled.has(r.id));

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
        await store.touch(row.id);
        return;
      }
      const bill = await hydrateBill(d);
      await store.upsert(bill);
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

  // Third pass: every resolved bill must end up with party positions or an
  // explicit "no roll call" mark. Hydration above swallows roll-call fetch
  // failures so one bad file cannot sink a bill; this is where those bills, and
  // any left over from earlier runs, get their positions. Fetches go through
  // `fetchWithRetry`'s backoff, and anything still failing is reported so it is
  // visible in the logs rather than silently absent from the site.
  const missing = await store.listMissingPositions(congress);
  let positionsFilled = 0;
  let positionsUnavailable = 0;
  const positionsMissing: string[] = [];

  await mapLimit(missing, 4, async (ref) => {
    if (pastDeadline()) {
      abandoned++;
      positionsMissing.push(ref.id);
      return;
    }
    try {
      const vote = await fetchBillPositions(ref);
      if (vote) {
        await store.savePositions(ref.id, vote);
        if (vote.partyBreakdown.length) positionsFilled++;
        else positionsMissing.push(ref.id);
      } else {
        await store.markPositionsUnavailable(ref.id);
        positionsUnavailable++;
      }
    } catch (e) {
      recordError(ref.id, e);
      positionsMissing.push(ref.id);
    }
  });

  console.log(
    `ingest: ${missing.length} resolved bills lacked party positions, ` +
      `${positionsFilled} filled, ${positionsUnavailable} have no roll call`,
  );
  if (positionsMissing.length) {
    console.warn(
      `ingest: ${positionsMissing.length} resolved bills still missing party positions: ` +
        positionsMissing.join(", "),
    );
  }

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
    positionsFilled,
    positionsUnavailable,
    positionsMissing,
    unknownStatuses: [...unknownStatuses],
    errorSamples,
  };
}
