/**
 * Fetch + parse layer for real US federal legislation.
 *
 * Sources (all keyless):
 *   - discovery:  GovTrack API v2
 *   - hydration:  govinfo BILLSTATUS bulk XML
 *   - votes:      clerk.house.gov roll XML / senate.gov LIS roll call XML
 *
 * Pure: nothing here touches the database.
 */
import { XMLParser } from "fast-xml-parser";

const USER_AGENT =
  "CloserDemocracy/1.0 (civic education project; +https://github.com/Victoriano012/CloserDemocracy)";

/* ------------------------------------------------------------------ types */

export type Chamber = "house" | "senate";
export type Outcome = "passed" | "failed" | "pending";

export type PartyTally = {
  party: string;
  yea: number;
  nay: number;
  present: number;
  notVoting: number;
};

export type VoteResult = {
  chamber: Chamber;
  /** YYYY-MM-DD */
  date: string | null;
  result: string | null;
  yea: number | null;
  nay: number | null;
  present: number | null;
  notVoting: number | null;
  url: string;
  partyBreakdown: PartyTally[];
};

export type DiscoveredBill = {
  id: string;
  congress: number;
  billType: string;
  number: number;
  title: string;
  chamber: Chamber;
  sponsorName: string | null;
  sponsorParty: string | null;
  sponsorState: string | null;
  introducedDate: string | null;
  latestActionDate: string | null;
  currentStatus: string;
  currentStatusLabel: string | null;
  congressUrl: string | null;
};

/** One row of the `bills` table. */
export type IngestedBill = {
  id: string;
  congress: number;
  billType: string;
  number: number;
  title: string;
  chamber: Chamber;
  sponsorName: string | null;
  sponsorParty: string | null;
  sponsorState: string | null;
  introducedDate: string | null;
  latestActionDate: string | null;
  latestActionText: string | null;
  officialSummary: string | null;
  policyArea: string | null;
  congressUrl: string | null;
  textUrl: string | null;
  pdfUrl: string | null;
  realOutcome: Outcome;
  realStage: string | null;
  realVoteChamber: string | null;
  realVoteDate: string | null;
  realYea: number | null;
  realNay: number | null;
  realPresent: number | null;
  realNotVoting: number | null;
  realVoteUrl: string | null;
  realPartyBreakdown: PartyTally[] | null;
};

/* -------------------------------------------------------------- http utils */

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
    this.name = "HttpError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 3 attempts with exponential backoff. 4xx (other than 429) fail fast — they
 * are not going to get better, and govinfo 404s are an expected outcome for
 * bills whose BILLSTATUS file has not been published yet.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  attempts = 3,
): Promise<Response> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "user-agent": USER_AGENT, accept: "*/*", ...init.headers },
      });
      if (res.ok) return res;
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw new HttpError(res.status, url);
      }
      last = new HttpError(res.status, url);
    } catch (e) {
      if (e instanceof HttpError && e.status !== 429) throw e;
      last = e;
    }
    if (i < attempts - 1) await sleep(500 * 2 ** i);
  }
  throw last;
}

/** Runs `tasks` with at most `max` in flight, preserving result order. */
export async function mapLimit<T, R>(
  items: T[],
  max: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(max, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/* --------------------------------------------------------------- xml utils */

const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });

/**
 * fast-xml-parser emits untyped nodes whose shape varies per document
 * (a lone child is a value, two children are an array), so the XML walking
 * below is deliberately unityped and guarded by `arr`/`str`/`num`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XmlNode = any;

/** fast-xml-parser collapses single children; normalise to an array. */
function arr<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null || v === "") return [];
  return Array.isArray(v) ? v : [v];
}

function str(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function num(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** "2025-07-03T18:31:38Z" | "3-Jul-2025" | "2025-07-03" -> "2025-07-03" */
function toDate(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (iso) return iso[1];
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[body.toLowerCase()] ?? m;
  });
}

/** CRS summaries arrive as HTML in CDATA. Flatten to readable plain text. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<\s*(br|\/p|\/li|\/h[1-6]|\/div)\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\r/g, "")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n\s*\n\s*/g, "\n\n")
    .replace(/ *\n */g, "\n")
    .trim();
}

/** senate.gov declares iso-8859-1; honour whatever the XML prolog says. */
async function fetchXml(url: string): Promise<Record<string, unknown>> {
  const res = await fetchWithRetry(url);
  const buf = await res.arrayBuffer();
  let text = new TextDecoder("utf-8").decode(buf);
  const enc = /<\?xml[^>]*encoding=["']([^"']+)["']/i.exec(text.slice(0, 200))?.[1];
  if (enc && !/^utf-?8$/i.test(enc)) {
    try {
      text = new TextDecoder(enc.toLowerCase()).decode(buf);
    } catch {
      text = new TextDecoder("iso-8859-1").decode(buf);
    }
  }
  return parser.parse(text) as Record<string, unknown>;
}

/* ------------------------------------------------------------- bill typing */

const BILL_TYPES: Record<string, string> = {
  house_bill: "hr",
  senate_bill: "s",
  house_joint_resolution: "hjres",
  senate_joint_resolution: "sjres",
  house_concurrent_resolution: "hconres",
  senate_concurrent_resolution: "sconres",
  house_resolution: "hres",
  senate_resolution: "sres",
};

/** Substantive legislation only — simple/concurrent resolutions are noise. */
export const INGESTED_TYPES = new Set(["hr", "s", "hjres", "sjres"]);

export function originChamber(billType: string): Chamber {
  return billType.startsWith("h") ? "house" : "senate";
}

/* --------------------------------------------------------------- sponsors */

const PARTY_NAMES: Record<string, string> = {
  R: "Republican",
  D: "Democrat",
  I: "Independent",
  ID: "Independent",
  REPUBLICAN: "Republican",
  DEMOCRAT: "Democrat",
  DEMOCRATIC: "Democrat",
  INDEPENDENT: "Independent",
};

/** GovTrack says "Democrat"; BILLSTATUS says "D". Settle on one vocabulary. */
export function normalizeParty(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  return PARTY_NAMES[s.toUpperCase()] ?? s;
}

/** "Rep. Arrington, Jodey C. [R-TX-19]" -> "Jodey C. Arrington" */
export function normalizeSponsorName(v: unknown): string | null {
  let s = str(v);
  if (!s) return null;
  s = s.replace(/\s*\[[^\]]*\]\s*$/, "").replace(/^(Rep\.|Sen\.|Representative|Senator)\s+/i, "");
  const comma = s.indexOf(",");
  if (comma > 0) s = `${s.slice(comma + 1).trim()} ${s.slice(0, comma).trim()}`.trim();
  return s.replace(/\s+/g, " ").trim() || null;
}

/* ----------------------------------------------------------- status mapping */

/** GovTrack `current_status` values we met but did not anticipate. */
export const unknownStatuses = new Set<string>();

/**
 * Statuses where Congress is not done with the bill. Includes passage by one
 * chamber only: the bill is still moving, so it is neither passed nor failed.
 */
const KNOWN_PENDING = new Set([
  "introduced",
  "referred",
  "reported",
  "prov_kill_suspensionfailed",
  "prov_kill_cloturefailed",
  "prov_kill_pingpongfail",
  "pass_over_house",
  "pass_over_senate",
  "pass_back_house",
  "pass_back_senate",
  "conference_passed_house",
  "conference_passed_senate",
  "override_pass_over_house",
  "override_pass_over_senate",
]);

export function mapStatus(status: string): Outcome {
  const s = status.toLowerCase();
  if (KNOWN_PENDING.has(s)) return "pending";
  // "vetoed_override_fail_*" is a failed override, so test "fail" first; a bare
  // "override" (enacted_veto_override) is a successful one, so test it before "veto".
  if (s.includes("fail") || s.includes("kill")) return "failed";
  if (s.includes("override")) return "passed";
  if (s.includes("veto")) return "failed";
  if (s.includes("pass") || s.includes("enacted") || s.includes("signed")) return "passed";
  unknownStatuses.add(status);
  return "pending";
}

/* ---------------------------------------------------------------- discovery */

type GovTrackBill = {
  congress: number;
  bill_type: string;
  number: number;
  title_without_number?: string;
  title?: string;
  current_status: string;
  current_status_date?: string;
  current_status_label?: string;
  introduced_date?: string;
  link?: string;
  sponsor?: { firstname?: string; lastname?: string; name?: string } | null;
  sponsor_role?: { party?: string; state?: string } | null;
};

export async function discoverRecentBills(opts: {
  since: Date;
  congress?: number;
  limit?: number;
  /** Called with the number of results dropped for being the wrong bill type. */
  onFiltered?: (count: number) => void;
}): Promise<DiscoveredBill[]> {
  const congress = opts.congress ?? 119;
  const limit = Math.min(opts.limit ?? 400, 400); // GovTrack 502s above 400
  const since = opts.since.toISOString().slice(0, 10);
  const url =
    `https://www.govtrack.us/api/v2/bill?order_by=-current_status_date` +
    `&limit=${limit}&congress=${congress}&current_status_date__gte=${since}`;

  const res = await fetchWithRetry(url);
  const body = (await res.json()) as { objects?: GovTrackBill[] };

  const out: DiscoveredBill[] = [];
  let filtered = 0;
  for (const o of body.objects ?? []) {
    const d = toDiscovered(o);
    if (d) out.push(d);
    else filtered++;
  }
  opts.onFiltered?.(filtered);
  return out;
}

/** Null when the bill is not a type we ingest. */
function toDiscovered(o: GovTrackBill): DiscoveredBill | null {
  const billType = BILL_TYPES[o.bill_type];
  if (!billType || !INGESTED_TYPES.has(billType)) return null;

  const sponsor = o.sponsor;
  const sponsorName =
    sponsor && (sponsor.firstname || sponsor.lastname)
      ? `${sponsor.firstname ?? ""} ${sponsor.lastname ?? ""}`.trim()
      : (sponsor?.name ?? null);

  return {
    id: `${o.congress}-${billType}-${o.number}`,
    congress: o.congress,
    billType,
    number: o.number,
    title: o.title_without_number || o.title || `${billType.toUpperCase()} ${o.number}`,
    chamber: originChamber(billType),
    sponsorName: normalizeSponsorName(sponsorName),
    sponsorParty: normalizeParty(o.sponsor_role?.party),
    sponsorState: o.sponsor_role?.state ?? null,
    introducedDate: toDate(o.introduced_date),
    latestActionDate: toDate(o.current_status_date),
    currentStatus: o.current_status,
    currentStatusLabel: o.current_status_label ?? null,
    congressUrl: o.link ?? null,
  };
}

/**
 * Current GovTrack record for one bill we already hold, so its status can be
 * re-checked without a full hydration. Null when GovTrack does not know it.
 */
export async function fetchBillStatus(
  congress: number,
  billType: string,
  number: number,
): Promise<DiscoveredBill | null> {
  const govtrackType = Object.keys(BILL_TYPES).find((k) => BILL_TYPES[k] === billType);
  if (!govtrackType) return null;
  const url =
    `https://www.govtrack.us/api/v2/bill?congress=${congress}` +
    `&bill_type=${govtrackType}&number=${number}`;
  const res = await fetchWithRetry(url);
  const body = (await res.json()) as { objects?: GovTrackBill[] };
  const o = body.objects?.[0];
  return o ? toDiscovered(o) : null;
}

/* ---------------------------------------------------------------- hydration */

type RecordedVote = {
  rollNumber: number;
  url: string;
  chamber: string;
  congress: number;
  date: string;
  sessionNumber: number;
};

/**
 * Pull the recorded votes out of the *top-level* bill's actions.
 *
 * BILLSTATUS files carry up to ~500 <relatedBills>, each with its own nested
 * <textVersions>/<actions> stubs, so everything here must be read off
 * billStatus.bill directly — never by scanning the document.
 */
function topLevelRecordedVotes(bill: XmlNode): RecordedVote[] {
  const seen = new Map<string, RecordedVote>();
  for (const action of arr<XmlNode>(bill.actions?.item)) {
    for (const rv of arr<XmlNode>(action?.recordedVotes?.recordedVote)) {
      const url = str(rv?.url);
      if (!url) continue;
      seen.set(`${rv.chamber}-${rv.rollNumber}`, {
        rollNumber: Number(rv.rollNumber),
        url,
        chamber: String(rv.chamber ?? ""),
        congress: Number(rv.congress),
        date: String(rv.date ?? ""),
        sessionNumber: Number(rv.sessionNumber ?? 1),
      });
    }
  }
  return [...seen.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Most recent CRS summary, as plain text. */
function pickSummary(bill: XmlNode): string | null {
  const items = arr<XmlNode>(bill.summaries?.summary);
  if (!items.length) return null;
  const best = items
    .slice()
    .sort((a: XmlNode, b: XmlNode) => String(b.updateDate ?? "").localeCompare(String(a.updateDate ?? "")))[0];
  const text = str(best?.text);
  if (!text) return null;
  const plain = htmlToText(text);
  return plain.length ? plain : null;
}

/**
 * Text/PDF links. Never construct a version suffix (`119hr1ih` 404s) — always
 * read the URL out of textVersions[].formats[].url. govinfo lists the most
 * advanced version first, so take the first entry that offers an /xml/ URL and
 * swap the path segment for the pdf/html siblings.
 */
function pickTextUrls(bill: XmlNode): { textUrl: string | null; pdfUrl: string | null } {
  for (const item of arr<XmlNode>(bill.textVersions?.item)) {
    for (const fmt of arr<XmlNode>(item?.formats?.item)) {
      const url = str(fmt?.url);
      if (url && url.includes("/xml/") && url.endsWith(".xml")) {
        return {
          textUrl: url.replace("/xml/", "/html/").replace(/\.xml$/, ".htm"),
          pdfUrl: url.replace("/xml/", "/pdf/").replace(/\.xml$/, ".pdf"),
        };
      }
    }
  }
  return { textUrl: null, pdfUrl: null };
}

export function billStatusUrl(congress: number, billType: string, number: number): string {
  return `https://www.govinfo.gov/bulkdata/BILLSTATUS/${congress}/${billType}/BILLSTATUS-${congress}${billType}${number}.xml`;
}

export async function hydrateBill(d: DiscoveredBill): Promise<IngestedBill> {
  const base: IngestedBill = {
    id: d.id,
    congress: d.congress,
    billType: d.billType,
    number: d.number,
    title: d.title,
    chamber: d.chamber,
    sponsorName: d.sponsorName,
    sponsorParty: d.sponsorParty,
    sponsorState: d.sponsorState,
    introducedDate: d.introducedDate,
    latestActionDate: d.latestActionDate,
    latestActionText: null,
    officialSummary: null,
    policyArea: null,
    congressUrl: d.congressUrl,
    textUrl: null,
    pdfUrl: null,
    realOutcome: mapStatus(d.currentStatus),
    realStage: d.currentStatusLabel,
    realVoteChamber: null,
    realVoteDate: null,
    realYea: null,
    realNay: null,
    realPresent: null,
    realNotVoting: null,
    realVoteUrl: null,
    realPartyBreakdown: null,
  };

  let bill: XmlNode;
  try {
    const doc = await fetchXml(billStatusUrl(d.congress, d.billType, d.number));
    bill = (doc as XmlNode)?.billStatus?.bill;
    if (!bill) return base;
  } catch (e) {
    // Very new bills have no BILLSTATUS file yet — degrade to GovTrack data.
    if (e instanceof HttpError && e.status === 404) return base;
    throw e;
  }

  const sponsor = arr<XmlNode>(bill.sponsors?.item)[0];
  const out: IngestedBill = {
    ...base,
    title: str(bill.title) ?? base.title,
    sponsorName: normalizeSponsorName(sponsor?.fullName) ?? base.sponsorName,
    sponsorParty: normalizeParty(sponsor?.party) ?? base.sponsorParty,
    sponsorState: str(sponsor?.state) ?? base.sponsorState,
    introducedDate: toDate(bill.introducedDate) ?? base.introducedDate,
    latestActionDate: toDate(bill.latestAction?.actionDate) ?? base.latestActionDate,
    latestActionText: str(bill.latestAction?.text),
    officialSummary: pickSummary(bill),
    policyArea: str(bill.policyArea?.name),
    congressUrl: str(bill.legislationUrl) ?? base.congressUrl,
    ...pickTextUrls(bill),
  };

  const votes = topLevelRecordedVotes(bill);
  if (votes.length) {
    const rv = votes[0];
    const isSenate = /senate/i.test(rv.chamber);
    try {
      const v = isSenate
        ? await fetchSenateVote(rv.congress, rv.sessionNumber, rv.rollNumber)
        : await fetchHouseVote(rv.url);
      out.realVoteChamber = v.chamber;
      out.realVoteDate = v.date ?? toDate(rv.date);
      out.realYea = v.yea;
      out.realNay = v.nay;
      out.realPresent = v.present;
      out.realNotVoting = v.notVoting;
      out.realVoteUrl = v.url;
      out.realPartyBreakdown = v.partyBreakdown.length ? v.partyBreakdown : null;
    } catch {
      // A missing roll-call file must not sink the whole bill.
      out.realVoteChamber = isSenate ? "senate" : "house";
      out.realVoteDate = toDate(rv.date);
      out.realVoteUrl = rv.url;
    }
  } else if (out.realOutcome === "passed") {
    out.realStage = `${out.realStage ?? "Passed"} (no recorded vote)`;
  }

  return out;
}

/* -------------------------------------------------------------------- votes */

/** clerk.house.gov roll XML. Party subtotals are precomputed in the file. */
export async function fetchHouseVote(url: string): Promise<VoteResult> {
  const doc = await fetchXml(url);
  const meta = (doc as XmlNode)?.["rollcall-vote"]?.["vote-metadata"];
  if (!meta) throw new Error(`unexpected house roll XML at ${url}`);

  const totals = meta["vote-totals"];
  const overall = totals?.["totals-by-vote"];
  const partyBreakdown: PartyTally[] = arr<XmlNode>(totals?.["totals-by-party"])
    .map((p: XmlNode) => ({
      party: String(p.party ?? "").trim(),
      yea: num(p["yea-total"]) ?? 0,
      nay: num(p["nay-total"]) ?? 0,
      present: num(p["present-total"]) ?? 0,
      notVoting: num(p["not-voting-total"]) ?? 0,
    }))
    .filter((p) => p.party.length > 0);

  return {
    chamber: "house",
    date: toDate(meta["action-date"]),
    result: str(meta["vote-result"]),
    yea: num(overall?.["yea-total"]),
    nay: num(overall?.["nay-total"]),
    present: num(overall?.["present-total"]),
    notVoting: num(overall?.["not-voting-total"]),
    url,
    partyBreakdown,
  };
}

const SENATE_PARTY_NAMES: Record<string, string> = {
  R: "Republican",
  D: "Democratic",
  I: "Independent",
  ID: "Independent",
};

export function senateVoteUrl(congress: number, session: number, number: number): string {
  return (
    `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${congress}${session}/` +
    `vote_${congress}_${session}_${String(number).padStart(5, "0")}.xml`
  );
}

/**
 * senate.gov LIS roll call XML. Unlike the House file this has no party
 * subtotals, so they are aggregated from <members>, and the document is
 * declared iso-8859-1 (handled in fetchXml) so accented names survive.
 */
export async function fetchSenateVote(
  congress: number,
  session: number,
  number: number,
): Promise<VoteResult> {
  const url = senateVoteUrl(congress, session, number);
  const doc = await fetchXml(url);
  const vote = (doc as XmlNode)?.roll_call_vote;
  if (!vote) throw new Error(`unexpected senate roll XML at ${url}`);

  const tallies = new Map<string, PartyTally>();
  for (const m of arr<XmlNode>(vote.members?.member)) {
    const code = String(m.party ?? "").trim().toUpperCase();
    const party = SENATE_PARTY_NAMES[code] ?? code ?? "Unknown";
    if (!party) continue;
    let t = tallies.get(party);
    if (!t) tallies.set(party, (t = { party, yea: 0, nay: 0, present: 0, notVoting: 0 }));
    const cast = String(m.vote_cast ?? "").toLowerCase();
    if (cast.startsWith("yea") || cast.startsWith("aye")) t.yea++;
    else if (cast.startsWith("nay") || cast === "no") t.nay++;
    else if (cast.startsWith("present")) t.present++;
    else t.notVoting++;
  }

  const count = vote.count;
  return {
    chamber: "senate",
    date: toDate(vote.vote_date),
    result: str(vote.vote_result) ?? str(vote.vote_result_text),
    yea: num(count?.yeas),
    nay: num(count?.nays),
    present: num(count?.present),
    notVoting: num(count?.absent),
    url,
    partyBreakdown: [...tallies.values()],
  };
}
