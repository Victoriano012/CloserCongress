/**
 * My List, independent of where it lives.
 *
 * A signed-in user's list is in the encrypted vault (lib/delegation.ts). A
 * signed-out visitor's list is in this browser's localStorage. Both are the
 * same shape, sanitized the same way, and resolved against a bill the same
 * way — this module holds everything shared, and nothing that needs a server.
 */

import { BLANK_PARTY_SLUG, PARTY_BY_SLUG } from "@/lib/parties";
import type { Vote } from "@/lib/tally";

/** An ordered list of party slugs. Always ends with the blank-vote party. */
export type Delegation = string[];

/**
 * Coerces untrusted input into a valid delegation:
 * unknown slugs dropped, duplicates removed, and always terminated by the
 * blank vote — a blank vote is terminal, so anything after it is dropped.
 * Any number of parties is allowed; duplicates are the only ceiling.
 */
export function sanitizeDelegation(input: unknown): Delegation {
  // Bound the scan, not the list: a server action body can carry a
  // 250k-element array, and the loop below would walk all of it. Every
  // party fits well within this, so it never truncates a legitimate list.
  const raw = Array.isArray(input) ? input.slice(0, 1000) : [];
  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of raw) {
    if (typeof item !== "string") continue;
    if (!(item in PARTY_BY_SLUG)) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    if (item === BLANK_PARTY_SLUG) break; // terminal: ignore everything after
    out.push(item);
  }

  out.push(BLANK_PARTY_SLUG);
  return out;
}

/** True when the list has at least one real delegate above the blank vote. */
export function hasDelegates(delegation: readonly string[] | null): boolean {
  return (delegation ?? []).some((slug) => slug !== BLANK_PARTY_SLUG);
}

/** One party's vote on one bill, as stored. */
export type PartyVoteRow = { party_slug: string; vote: string; reason: string | null };

/** How one delegation voted on one bill, and through whom. */
export type ResolvedVote = {
  classified: boolean;
  party: string;
  vote: Vote;
  reason: string | null;
};

/**
 * Walks the list the way the simulation walks every citizen's: the first
 * party with an opinion speaks, and the blank vote speaks when none does.
 * `classified` is false when no party has voted on the bill yet.
 */
export function resolveVote(delegation: readonly string[], rows: PartyVoteRow[]): ResolvedVote {
  const byParty = new Map(rows.map((row) => [row.party_slug, row]));
  for (const slug of delegation) {
    if (slug === BLANK_PARTY_SLUG) break;
    const row = byParty.get(slug);
    if (row && (row.vote === "yes" || row.vote === "no")) {
      return { classified: true, party: slug, vote: row.vote, reason: row.reason };
    }
  }
  return { classified: rows.length > 0, party: BLANK_PARTY_SLUG, vote: "abstain", reason: null };
}

// ---- guest storage ---------------------------------------------------------

export const GUEST_LIST_KEY = "closer.myList.guest";

/** The part of `Storage` we use, so tests can pass a plain Map-backed stub. */
export type GuestStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** The stored string as a list, or null when absent or unreadable. */
export function parseGuestList(raw: string | null): Delegation | null {
  if (raw === null) return null;
  try {
    return sanitizeDelegation(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** The guest list, or null when there is none (or it is unreadable). */
export function readGuestList(storage: GuestStorage): Delegation | null {
  try {
    return parseGuestList(storage.getItem(GUEST_LIST_KEY));
  } catch {
    return null;
  }
}

export function writeGuestList(storage: GuestStorage, list: unknown): Delegation {
  const delegation = sanitizeDelegation(list);
  try {
    storage.setItem(GUEST_LIST_KEY, JSON.stringify(delegation));
  } catch {
    // Quota exceeded or storage disabled: the in-memory list still works.
  }
  return delegation;
}

export function clearGuestList(storage: GuestStorage): void {
  try {
    storage.removeItem(GUEST_LIST_KEY);
  } catch {
    // Nothing to clear.
  }
}

// ---- sign-in merge ----------------------------------------------------------

/**
 * What to upload to the account after signing in with a guest list on this
 * device. Simple and predictable: an existing account list always wins, and
 * the guest list only fills an empty account. Null means leave the account
 * alone. Either way the caller discards the guest copy afterwards.
 */
export function mergeGuestList(
  account: Delegation | null,
  guest: Delegation | null,
): Delegation | null {
  if (account !== null || guest === null) return null;
  return sanitizeDelegation(guest);
}
