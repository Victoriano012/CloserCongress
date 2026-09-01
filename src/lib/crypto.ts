import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

/**
 * Vault crypto.
 *
 * The threat model is "someone dumps the database, without the environment".
 * The row key is a slow one-way hash of the Google subject, and the payload is
 * encrypted under a key derived from that subject plus a per-row random salt.
 * The subject is never stored anywhere on the server — its only persistent copy
 * lives in the user's signed session cookie.
 *
 * What this does NOT buy: protection from us. This server receives the subject
 * on every sign-in and decrypts it out of the cookie on every page view, and it
 * holds VAULT_PEPPER. It is not end-to-end encryption, and /delegate and
 * /methodology both say so.
 *
 * Google subjects are ~21 digits and are not pairwise-pseudonymous — the same
 * value goes to every OAuth client — so an unstretched hash over that space is
 * brute-forceable at millions of candidates per second. Hence scrypt, and hence
 * the per-row salt on the payload key: guessing must be redone per user.
 */

const PEPPER = process.env.VAULT_PEPPER;
if (!PEPPER) {
  throw new Error(
    "VAULT_PEPPER is not set. It is required to derive vault keys; refusing to start without it.",
  );
}
if (PEPPER.length < 32) {
  throw new Error(
    `VAULT_PEPPER is ${PEPPER.length} chars; it is the only secret standing between a database dump and a 21-digit search space. Use at least 32.`,
  );
}

const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
/** ~18 ms per derivation. Enough to make a 10^21 sweep hopeless, cheap enough to run per request. */
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

/**
 * Stable, one-way database row key for a Google subject.
 *
 * No per-row salt is possible here — the value is the lookup key — so the work
 * factor is the whole defence.
 */
export function userKeyFromSub(sub: string): string {
  return scryptSync(`rowkey\0${sub}`, PEPPER!, 32, SCRYPT).toString("hex");
}

function vaultKey(sub: string, salt: Buffer): Buffer {
  return scryptSync(`vault\0${sub}`, Buffer.concat([salt, Buffer.from(PEPPER!)]), 32, SCRYPT);
}

/** base64 of salt(16) || iv(12) || authTag(16) || ciphertext */
export function encryptVault(sub: string, data: unknown): string {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", vaultKey(sub, salt), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([salt, iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

/** Returns null on any failure: wrong subject, tampered payload, malformed input. */
export function decryptVault(sub: string, payload: string): unknown | null {
  try {
    const raw = Buffer.from(payload, "base64");
    if (raw.length <= SALT_BYTES + IV_BYTES + TAG_BYTES) return null;
    const salt = raw.subarray(0, SALT_BYTES);
    const iv = raw.subarray(SALT_BYTES, SALT_BYTES + IV_BYTES);
    const tag = raw.subarray(SALT_BYTES + IV_BYTES, SALT_BYTES + IV_BYTES + TAG_BYTES);
    const ciphertext = raw.subarray(SALT_BYTES + IV_BYTES + TAG_BYTES);
    const decipher = createDecipheriv("aes-256-gcm", vaultKey(sub, salt), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString("utf8"));
  } catch {
    return null;
  }
}

/** Constant-time string compare for shared secrets. */
export function secretEquals(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
