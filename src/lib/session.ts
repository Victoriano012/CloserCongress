import "server-only";

import { cookies } from "next/headers";
import { decode } from "next-auth/jwt";

/**
 * Reads the Google subject out of the session cookie.
 *
 * `auth()` cannot give us this by design — the `session` callback in src/auth.ts
 * deliberately withholds `gsub` so it never reaches the public
 * /api/auth/session endpoint. So we decrypt the cookie ourselves.
 *
 * Auth.js v5 uses the cookie *name* as the HKDF salt when deriving the cookie
 * encryption key, so the salt must be exactly the name we read it under.
 */
const COOKIE_NAMES = ["__Secure-authjs.session-token", "authjs.session-token"] as const;

/**
 * Auth.js splits the cookie into `<name>.0`, `<name>.1`, … once the encoded JWT
 * passes ~3.9 KB, which a long display name plus a long picture URL can do.
 * `auth()` reassembles them; reading only the unchunked name would report the
 * user as signed out on a page that just greeted them by name.
 */
function readToken(
  store: Awaited<ReturnType<typeof cookies>>,
  name: string,
): string | undefined {
  const whole = store.get(name)?.value;
  if (whole) return whole;

  const parts: string[] = [];
  for (let i = 0; ; i++) {
    const chunk = store.get(`${name}.${i}`)?.value;
    if (chunk === undefined) break;
    parts.push(chunk);
  }
  return parts.length > 0 ? parts.join("") : undefined;
}

export async function getGoogleSub(): Promise<string | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;

  const store = await cookies();

  for (const name of COOKIE_NAMES) {
    const token = readToken(store, name);
    if (!token) continue;
    try {
      const payload = await decode({ token, secret, salt: name });
      // Only `gsub`, never `sub`: they happen to be equal today, but they are
      // set by different code paths. Deriving a vault key from the wrong one
      // would silently show the user an empty list and orphan their row.
      const gsub = payload?.gsub;
      if (typeof gsub === "string" && gsub.length > 0) return gsub;
    } catch {
      // Wrong salt / rotated secret / tampered cookie: try the next name.
    }
  }

  return null;
}
