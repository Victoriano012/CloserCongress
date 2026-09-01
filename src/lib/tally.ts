/**
 * The simulation itself: turn per-party votes into a population result.
 *
 * Every citizen holds an ordered list of parties. We walk that list and the
 * first party with an opinion on this bill casts their vote; the rest of the
 * list never gets consulted. Parties abstain on anything outside their subject,
 * so a citizen's second and third choices are what actually decide most bills.
 *
 * The blank vote terminates every list, so a citizen whose delegates all
 * abstained is recorded as present-and-blank rather than as a silent absence.
 *
 * Passing is a majority of votes actually cast: blanks lower participation, not
 * the bar. This is what makes the blank vote a real choice instead of a "no".
 */
import electorate from "../../data/electorate.json";
import { BLANK_PARTY_SLUG, PARTIES } from "@/lib/parties";

export type Vote = "yes" | "no" | "abstain";

/** How many citizens one party voted for, and which way. */
export interface PartyContribution {
  slug: string;
  vote: Vote;
  count: number;
  share: number;
}

export interface TallyResult {
  yes: number;
  no: number;
  blank: number;
  total: number;
  /** Votes actually cast — the denominator for the majority test. */
  cast: number;
  passed: boolean;
  breakdown: PartyContribution[];
  electorateHash: string;
}

export const ELECTORATE_HASH = electorate.hash as string;
export const ELECTORATE_TOTAL = electorate.citizens.length;

const PARTY_SLUGS = electorate.parties as string[];

/**
 * The roster and the baked-in electorate must agree. If a party is added to
 * parties.ts without regenerating the electorate, `sanitizeDelegation` accepts
 * it into someone's saved list and `resolveForDelegation` then silently drops
 * it — so the site would tell a real person which delegate spoke for them from
 * a list that is not the one they saved. Fail the build instead.
 */
{
  const roster = PARTIES.map((p) => p.slug);
  if (roster.length !== PARTY_SLUGS.length || roster.some((s, i) => s !== PARTY_SLUGS[i])) {
    throw new Error(
      `data/electorate.json was generated from a different party roster (${PARTY_SLUGS.length} parties) than src/lib/parties.ts (${roster.length}). Run \`npm run electorate\`.`,
    );
  }
}
const CITIZENS = electorate.citizens as number[][];
const BLANK_INDEX = PARTY_SLUGS.indexOf(BLANK_PARTY_SLUG);

/** Party votes as an array parallel to PARTY_SLUGS; anything missing abstains. */
function toVoteArray(votes: Record<string, Vote>): Vote[] {
  return PARTY_SLUGS.map((slug) =>
    slug === BLANK_PARTY_SLUG ? "abstain" : (votes[slug] ?? "abstain"),
  );
}

/**
 * The first party in the list with an opinion. Returns the blank vote when
 * every delegate abstained, which is the list's guaranteed last entry.
 */
function resolve(
  delegation: readonly number[],
  byIndex: Vote[],
): { party: number; vote: Vote } {
  for (const party of delegation) {
    if (party === BLANK_INDEX) break;
    const vote = byIndex[party];
    if (vote !== "abstain") return { party, vote };
  }
  return { party: BLANK_INDEX, vote: "abstain" };
}

export function tally(votes: Record<string, Vote>): TallyResult {
  const byIndex = toVoteArray(votes);
  const yesBy = new Array<number>(PARTY_SLUGS.length).fill(0);
  const noBy = new Array<number>(PARTY_SLUGS.length).fill(0);

  let yes = 0;
  let no = 0;
  let blank = 0;

  for (const citizen of CITIZENS) {
    // citizen[0] is the typology group; the delegation starts at index 1.
    const { party, vote } = resolve(citizen.slice(1), byIndex);
    if (vote === "yes") {
      yes++;
      yesBy[party]++;
    } else if (vote === "no") {
      no++;
      noBy[party]++;
    } else {
      blank++;
    }
  }

  const total = CITIZENS.length;
  const cast = yes + no;

  const breakdown: PartyContribution[] = [];
  for (let i = 0; i < PARTY_SLUGS.length; i++) {
    if (yesBy[i] > 0) {
      breakdown.push({ slug: PARTY_SLUGS[i], vote: "yes", count: yesBy[i], share: yesBy[i] / total });
    }
    if (noBy[i] > 0) {
      breakdown.push({ slug: PARTY_SLUGS[i], vote: "no", count: noBy[i], share: noBy[i] / total });
    }
  }
  if (blank > 0) {
    breakdown.push({ slug: BLANK_PARTY_SLUG, vote: "abstain", count: blank, share: blank / total });
  }
  breakdown.sort((a, b) => b.count - a.count);

  return {
    yes,
    no,
    blank,
    total,
    cast,
    passed: cast > 0 && yes / cast > 0.5,
    breakdown,
    electorateHash: ELECTORATE_HASH,
  };
}

/**
 * Share of citizens for whom at least two delegates in the list held opposite
 * opinions on this bill.
 *
 * This is the number that says whether the ordered list is doing any work. If
 * it is near zero the ordering is decorative — every delegate who had an
 * opinion agreed, so the ranking never broke a tie. Tracked as a regression
 * metric rather than shown on the site.
 */
export function contestedShare(votes: Record<string, Vote>): number {
  const byIndex = toVoteArray(votes);
  let contested = 0;

  for (const citizen of CITIZENS) {
    let first: Vote | null = null;
    for (let i = 1; i < citizen.length; i++) {
      const party = citizen[i];
      if (party === BLANK_INDEX) break;
      const vote = byIndex[party];
      if (vote === "abstain") continue;
      if (first === null) first = vote;
      else if (vote !== first) { contested++; break; }
    }
  }

  return contested / CITIZENS.length;
}

/**
 * The same walk for one person's own list, so the bill page can say which of
 * their delegates ended up speaking for them.
 */
export function resolveForDelegation(
  delegation: readonly string[],
  votes: Record<string, Vote>,
): { party: string; vote: Vote } {
  const byIndex = toVoteArray(votes);
  const indices = delegation
    .map((slug) => PARTY_SLUGS.indexOf(slug))
    .filter((i) => i >= 0);
  const { party, vote } = resolve(indices, byIndex);
  return { party: PARTY_SLUGS[party], vote };
}
