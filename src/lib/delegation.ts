import "server-only";

import { sql } from "@/lib/db";
import { decryptVault, encryptVault, userKeyFromSub } from "@/lib/crypto";
import { BLANK_PARTY_SLUG, PARTY_BY_SLUG } from "@/lib/parties";
import { getGoogleSub } from "@/lib/session";

/** An ordered list of party slugs. Always ends with the blank-vote party. */
export type Delegation = string[];

/** Maximum entries in a stored delegation, including the terminal blank vote. */
const MAX_ENTRIES = 10;

/**
 * Coerces untrusted input into a valid delegation:
 * unknown slugs dropped, duplicates removed, capped, and always terminated by
 * the blank vote — a blank vote is terminal, so anything after it is dropped.
 */
export function sanitizeDelegation(input: unknown): Delegation {
  // Cap the input, not just the output: a server action body can carry a
  // 250k-element array, and the loop below would walk all of it.
  const raw = Array.isArray(input) ? input.slice(0, 100) : [];
  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of raw) {
    if (typeof item !== "string") continue;
    if (!(item in PARTY_BY_SLUG)) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    if (item === BLANK_PARTY_SLUG) break; // terminal: ignore everything after
    out.push(item);
    if (out.length >= MAX_ENTRIES - 1) break;
  }

  out.push(BLANK_PARTY_SLUG);
  return out;
}

/** The signed-in user's delegation, or null when signed out or never saved. */
export async function loadDelegation(): Promise<Delegation | null> {
  const sub = await getGoogleSub();
  if (!sub) return null;

  const rows = (await sql.query(
    "select ciphertext from user_vaults where user_key = $1",
    [userKeyFromSub(sub)],
  )) as { ciphertext: string }[];

  const ciphertext = rows[0]?.ciphertext;
  if (!ciphertext) return null;

  const data = decryptVault(sub, ciphertext);
  if (data === null) return null;

  return sanitizeDelegation(data);
}

export async function saveDelegation(
  input: unknown,
): Promise<{ ok: true; delegation: Delegation } | { ok: false; error: string }> {
  const sub = await getGoogleSub();
  if (!sub) return { ok: false, error: "Not signed in." };

  const delegation = sanitizeDelegation(input);

  await sql.query(
    `insert into user_vaults (user_key, ciphertext, updated_at)
     values ($1, $2, now())
     on conflict (user_key) do update
       set ciphertext = excluded.ciphertext, updated_at = now()`,
    [userKeyFromSub(sub), encryptVault(sub, delegation)],
  );

  return { ok: true, delegation };
}

/** Deletes the user's vault row. False when signed out. */
export async function deleteDelegation(): Promise<boolean> {
  const sub = await getGoogleSub();
  if (!sub) return false;

  await sql.query("delete from user_vaults where user_key = $1", [userKeyFromSub(sub)]);
  return true;
}
