import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import type { IngestedBill, VoteResult } from "@/lib/congress";
import { runIngest, type IngestStore, type PendingRow } from "@/lib/ingest";

/* ------------------------------------------------------------- fixtures */

const HR1 = { id: "119-hr-1", congress: 119, bill_type: "hr", number: 1 };
const GOVTRACK_HR1 = (status: string) => ({
  objects: [
    {
      congress: 119,
      bill_type: "house_bill",
      number: 1,
      title: "One Big Bill",
      current_status: status,
      current_status_date: "2025-07-04",
      current_status_label: status === "enacted_signed" ? "Enacted" : "Introduced",
    },
  ],
});

const ROLL_URL = "https://clerk.house.gov/evs/2025/roll190.xml";

const BILLSTATUS = (votes: boolean) => `<?xml version="1.0" encoding="UTF-8"?>
<billStatus><bill>
  <title>One Big Bill</title>
  <latestAction><actionDate>2025-07-04</actionDate><text>Became Public Law.</text></latestAction>
  <actions>${
    votes
      ? `<item><recordedVotes><recordedVote>
          <rollNumber>190</rollNumber><url>${ROLL_URL}</url><chamber>House</chamber>
          <congress>119</congress><date>2025-07-03T18:31:38Z</date><sessionNumber>1</sessionNumber>
        </recordedVote></recordedVotes></item>`
      : `<item><text>Passed by voice vote.</text></item>`
  }</actions>
</bill></billStatus>`;

const HOUSE_ROLL = `<?xml version="1.0" encoding="UTF-8"?>
<rollcall-vote><vote-metadata>
  <action-date>3-Jul-2025</action-date><vote-result>Passed</vote-result>
  <vote-totals>
    <totals-by-party><party>Republican</party><yea-total>218</yea-total><nay-total>2</nay-total>
      <present-total>0</present-total><not-voting-total>0</not-voting-total></totals-by-party>
    <totals-by-party><party>Democratic</party><yea-total>0</yea-total><nay-total>212</nay-total>
      <present-total>0</present-total><not-voting-total>2</not-voting-total></totals-by-party>
    <totals-by-vote><yea-total>218</yea-total><nay-total>214</nay-total>
      <present-total>0</present-total><not-voting-total>2</not-voting-total></totals-by-vote>
  </vote-totals>
</vote-metadata></rollcall-vote>`;

/* ------------------------------------------------------------- test doubles */

type Route = (url: string, hit: number) => Response | undefined;

/** Routes fetch by URL substring; `hit` counts prior requests to the same URL. */
function mockFetch(routes: Record<string, Route>) {
  const hits = new Map<string, number>();
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    const n = hits.get(url) ?? 0;
    hits.set(url, n + 1);
    for (const [needle, route] of Object.entries(routes)) {
      if (url.includes(needle)) {
        const res = route(url, n);
        if (res) return res;
      }
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  return hits;
}

const ok = (body: string) => new Response(body, { status: 200 });
const json = (body: unknown) => ok(JSON.stringify(body));

type Row = IngestedBill;

function memoryStore(seed: Row[] = []) {
  const rows = new Map(seed.map((r) => [r.id, r]));
  const store: IngestStore = {
    async upsert(b) {
      const fresh = !rows.has(b.id);
      rows.set(b.id, b);
      return fresh;
    },
    async listPending(congress): Promise<PendingRow[]> {
      return [...rows.values()]
        .filter((r) => r.congress === congress && r.realOutcome === "pending")
        .map((r) => ({
          id: r.id, congress: r.congress, bill_type: r.billType, number: r.number,
          real_outcome: r.realOutcome, real_stage: r.realStage,
        }));
    },
    async touch() {},
    async listMissingPositions(congress) {
      return [...rows.values()]
        .filter(
          (r) =>
            r.congress === congress &&
            r.realOutcome !== "pending" &&
            r.realPartyBreakdown === null &&
            !r.positionsUnavailable,
        )
        .map((r) => ({
          id: r.id, congress: r.congress, billType: r.billType, number: r.number,
          latestActionDate: r.latestActionDate,
        }));
    },
    async savePositions(id, v: VoteResult) {
      const r = rows.get(id)!;
      r.realYea = v.yea;
      r.realNay = v.nay;
      r.realPartyBreakdown = v.partyBreakdown.length ? v.partyBreakdown : null;
      r.positionsUnavailable = false;
    },
    async markPositionsUnavailable(id) {
      rows.get(id)!.positionsUnavailable = true;
    },
  };
  return { store, rows };
}

/** A resolved bill as a previous run left it: outcome known, positions never fetched. */
function resolvedWithoutPositions(): Row {
  return {
    id: HR1.id, congress: 119, billType: "hr", number: 1, title: "One Big Bill", chamber: "house",
    sponsorName: null, sponsorParty: null, sponsorState: null,
    introducedDate: null, latestActionDate: "2025-07-04", latestActionText: null,
    officialSummary: null, policyArea: null, congressUrl: null, textUrl: null, pdfUrl: null,
    realOutcome: "passed", realStage: "Enacted",
    realVoteChamber: null, realVoteDate: null, realYea: null, realNay: null,
    realPresent: null, realNotVoting: null, realVoteUrl: null,
    realPartyBreakdown: null, positionsUnavailable: false,
  };
}

const realFetch = globalThis.fetch;
const realLog = console.log;
const realWarn = console.warn;
afterEach(() => {
  globalThis.fetch = realFetch;
  console.log = realLog;
  console.warn = realWarn;
});

const run = (store: IngestStore) => {
  console.log = () => {};
  return runIngest({ store, congress: 119, days: 7 });
};

/* -------------------------------------------------------------------- tests */

test("a bill that flips to resolved gets party positions in the same run", async () => {
  const { store, rows } = memoryStore([{ ...resolvedWithoutPositions(), realOutcome: "pending", realStage: "Introduced" }]);
  mockFetch({
    "order_by=": () => json({ objects: [] }),
    "bill_type=house_bill&number=1": () => json(GOVTRACK_HR1("enacted_signed")),
    "BILLSTATUS-119hr1.xml": () => ok(BILLSTATUS(true)),
    [ROLL_URL]: () => ok(HOUSE_ROLL),
  });

  const s = await run(store);

  const bill = rows.get(HR1.id)!;
  assert.equal(s.statusChanged, 1);
  assert.equal(bill.realOutcome, "passed");
  assert.deepEqual(
    bill.realPartyBreakdown?.map((p) => [p.party, p.yea, p.nay]),
    [["Republican", 218, 2], ["Democratic", 0, 212]],
  );
  assert.deepEqual(s.positionsMissing, []);
});

test("a transient roll-call failure is retried and the positions land", async () => {
  const { store, rows } = memoryStore([resolvedWithoutPositions()]);
  const hits = mockFetch({
    "order_by=": () => json({ objects: [] }),
    "BILLSTATUS-119hr1.xml": () => ok(BILLSTATUS(true)),
    [ROLL_URL]: (_url, hit) => (hit === 0 ? new Response("upstream", { status: 503 }) : ok(HOUSE_ROLL)),
  });

  const s = await run(store);

  assert.equal(hits.get(ROLL_URL), 2);
  assert.equal(s.positionsFilled, 1);
  assert.equal(s.errors, 0);
  assert.equal(rows.get(HR1.id)!.realPartyBreakdown?.length, 2);
  assert.equal(rows.get(HR1.id)!.realYea, 218);
});

test("a bill passed without a roll call is marked positionsUnavailable", async () => {
  const { store, rows } = memoryStore([resolvedWithoutPositions()]);
  mockFetch({
    "order_by=": () => json({ objects: [] }),
    "BILLSTATUS-119hr1.xml": () => ok(BILLSTATUS(false)),
  });

  const s = await run(store);

  assert.equal(s.positionsUnavailable, 1);
  assert.equal(rows.get(HR1.id)!.positionsUnavailable, true);
  assert.equal(rows.get(HR1.id)!.realPartyBreakdown, null);
  assert.deepEqual(s.positionsMissing, []);
});

test("bills still without positions are listed on the summary and warned about", async () => {
  const { store, rows } = memoryStore([resolvedWithoutPositions()]);
  mockFetch({
    "order_by=": () => json({ objects: [] }),
    // govinfo has not published the file yet: 404s fail fast and are not a voice vote.
    "BILLSTATUS-119hr1.xml": () => new Response("", { status: 404 }),
  });
  const warnings: string[] = [];
  console.warn = (m: string) => warnings.push(m);

  const s = await run(store);

  assert.deepEqual(s.positionsMissing, [HR1.id]);
  assert.equal(s.errors, 1);
  assert.equal(rows.get(HR1.id)!.positionsUnavailable, false);
  assert.match(warnings.join("\n"), /still missing party positions: 119-hr-1/);
});
