import "server-only";

import { sql } from "@/lib/db";
import { decryptVault, encryptVault, userKeyFromSub } from "@/lib/crypto";
import { mergeGuestList, sanitizeDelegation, type Delegation } from "@/lib/my-list";
import { getGoogleSub } from "@/lib/session";

export { sanitizeDelegation, type Delegation };

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

/**
 * Folds a guest (localStorage) list into the account on sign-in: uploaded when
 * the account has nothing saved, discarded otherwise. Returns the account's
 * list afterwards, or null when signed out.
 */
export async function mergeGuestDelegation(guest: unknown): Promise<Delegation | null> {
  const account = await loadDelegation();
  const upload = mergeGuestList(account, Array.isArray(guest) ? guest : null);
  if (upload === null) return account;
  const result = await saveDelegation(upload);
  return result.ok ? result.delegation : account;
}
