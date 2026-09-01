# Round two code review

Scope: defects introduced or missed by the round-one fixes (see `security.md`,
`data.md`, `resolutions.md`). Every finding below is backed by a file:line
citation or the output of a command run against this checkout / the live DB.
Nothing here repeats a round-one finding that still reproduces as originally
described — where a round-one bug's *mechanism* recurs in a new shape, it's
called out as a new, distinct defect.

No files were modified and no writes were made to the database while producing
this review. `npx tsc --noEmit` was run and returned no output (no type
errors).

---

## 1. (Medium) `classify.ts`'s parser silently turns any non-`{v,r}`-shaped vote into an abstention — the exact D4 failure mode, now unmonitored

**What's wrong.** The rewritten prompt tells the model to reply with
`"votes": { "<slug>": { "v": "yes"|"no"|"abstain", "r": "..." } }`. The parser
only accepts that exact shape:

```ts
// src/lib/classify.ts
const v = (value as Record<string, unknown>)?.v;
const r = (value as Record<string, unknown>)?.r;
if (v !== "yes" && v !== "no") continue;
```

If a model response ever uses a shorthand the prompt doesn't explicitly forbid
— e.g. `"animal-welfare": "yes"` instead of `"animal-welfare": {"v":"yes"}` —
`value` is the string `"yes"`, `(value)?.v` reads property `v` off a boxed
string and evaluates to `undefined`, so the branch falls through and that
party is recorded as `abstain`. No error, no warning: the per-bill `cast===0`
check (`src/lib/classify.ts`, "no party cast a vote on this bill") only fires
if *every* party in the response uses the shorthand, so a partial drift is
invisible.

This matters specifically because of what round one's D4 was about:
17/32 parties never voting and a 0.92-votes/bill average, caused by an earlier
prompt/parser that made silent abstention the path of least resistance. The
rewritten prompt fixes the *prompt-side* incentive to abstain, but the
parser's tolerance for schema drift re-opens the same door one layer down —
any format wobble from the model (plausible with a small, cheap model called
once per bill, thirty-some times per call) is recorded as content-driven
abstention, indistinguishable in the data from a party genuinely having no
opinion, and nothing downstream (least of all D4's own remediation) would
detect it.

**Evidence.** `src/lib/classify.ts`, `parseClassification()`:
```ts
const rawVotes = (data.votes ?? {}) as Record<string, unknown>;
let cast = 0;
for (const [slug, value] of Object.entries(rawVotes)) {
  if (!Object.hasOwn(PARTY_BY_SLUG, slug)) continue;
  const party = PARTY_BY_SLUG[slug];
  if (party.isBlank) continue;
  const v = (value as Record<string, unknown>)?.v;
  const r = (value as Record<string, unknown>)?.r;
  if (v !== "yes" && v !== "no") continue;
  ...
}
if (cast === 0) {
  console.warn("  ! no party cast a vote on this bill");
}
```
`(value)?.v` never throws and never distinguishes "party genuinely
abstained" from "model used a different shape for this one entry" — both take
the same silent `continue`.

**Suggested fix.** Treat an unrecognized shape for a *present* key as a parse
error worth retrying (`scripts/classify.ts` already retries up to 3 times on a
thrown error), rather than silently downgrading it to abstain — e.g. throw if
`value` is present but is neither `undefined` nor an object with a `v` key.
At minimum, log a per-party warning (not just a whole-bill `cast===0` warning)
whenever a key exists in `data.votes` but fails the shape check, so drift is
visible in the classify run's own output.

---

## 2. (Medium) The D8 write-ordering fix trades a permanently-wrong result for a self-healing but real "simulated result with no summary" render window

**What's wrong.** Round one's D8 fix reordered `scripts/classify.ts`'s
`persist()` to write `party_votes` before `bill_ai`, specifically so that a
crash between the two writes leaves the bill *retryable* (the `bill_ai`-based
"already classified" filter will pick it up again) instead of *permanently*
marked done with zero votes. That half of the trade is real and verified:

```ts
// scripts/classify.ts persist()
// party_votes first, bill_ai last. bill_ai is what the "already classified"
// filter checks, so if the run dies between the two, the bill is retried
// rather than being marked done with no votes attached to it.
await sql.query(`insert into party_votes ...`, values);
await sql.query(`insert into bill_ai ...`, [...]);
await sql.query(`delete from bill_results where bill_id = $1`, [billId]);
```

But the Neon HTTP driver used here (`sql.query`, no `BEGIN`/`COMMIT` anywhere
in `scripts/classify.ts`) still makes these three statements non-atomic, and
the new ordering opens a new, different inconsistency window rather than
closing the gap entirely: if the process dies (OOM, network drop, deploy,
`--force` rerun killed mid-flight — plausible under `concurrency: 3` across
hundreds of bills) after `party_votes` commits but before `bill_ai` does, the
bill page renders a *live, non-empty simulated result* (vote breakdown,
"who spoke for you", contested-share-relevant data) for a bill it
simultaneously presents as not yet AI-classified:

```ts
// src/lib/bills.ts getBill()
return {
  bill, ai: ai[0] ?? null, votes,
  result: votes.length ? await ensureResult(id, votes) : null,
};
```
```tsx
// src/app/bills/[id]/page.tsx
{ai ? "In plain words" : "The official summary"}
```

`votes.length` is already nonzero (the crash happened *after* that insert),
so `result` is computed and shown, while `ai` is still `null`, so the page
falls back to the "official summary" heading with no plain-English summary,
no key points, and no indication that a classification exists but is
incomplete. This is a materially different bug from D8 (self-healing on the
next classify run, rather than permanent), but it's the same category of
problem the task asked about — "a stale or empty result served, or a bill
marked done with no votes" — realized in its complementary form: a bill
*not* marked done, yet already serving a real result derived from an
in-progress classification.

**Evidence.** No transaction wrapper exists around the two inserts and the
delete in `scripts/classify.ts` (`grep -n "BEGIN\|COMMIT\|transaction" scripts/classify.ts db/schema.sql` returns nothing); `src/lib/bills.ts`'s `getBill()` gates `result` on `votes.length` alone, not on `ai` being present.

**Suggested fix.** Either wrap the two inserts in a single `sql.transaction([...])` call (the `@neondatabase/serverless` driver supports this), or — cheaper — gate `result` in `getBill()` on `ai !== null` as well as `votes.length`, so a bill never shows a computed result before it has a summary to go with it.

---

## 3. (Low) `methodology/page.tsx` has two stale hardcoded counts left behind by the `public-investment` party addition

**What's wrong.** Adding the `public-investment` party (the D6 fix, making
`fiscal` two-sided) changed `TWO_SIDED` from 12 to 13 and `CLASSIFIABLE` from
31 to 32, both computed dynamically elsewhere on the same page, but two prose
sentences were not updated:

- `src/app/methodology/page.tsx:519`: `"The largest calibration gap across all twelve two-sided axes is{" "}"` — should be **thirteen**. `TWO_SIDED = AXES.filter((a) => a.partyB).length` is used correctly two lines above it at line 413 (`{TWO_SIDED}`), and `data/electorate-stats.json`'s `calibration` array has exactly 13 entries (confirmed: `['reproductive-rights','guns','climate','immigration','healthcare','taxes','equality','religion','labor','criminal-justice','foreign-policy','education','fiscal']`).
- `src/app/methodology/page.tsx:635`: `"One AI model stands in for 31 human delegates."` — should be **32**. `CLASSIFIABLE = PARTIES.filter((p) => !p.isBlank).length` is used correctly four lines later at line 639 (`{CLASSIFIABLE}`).

**Evidence.** `grep -rn "31\b\|32\b\|33\b" src/app --include=*.tsx` finds these
as the only two remaining stale numeric literals of this kind anywhere under
`src/app`; `src/app/how-it-works/page.tsx` already uses the dynamic form
(`{PARTIES.filter((p) => !p.isBlank).length}`) and is unaffected.

**Suggested fix.** Replace both literals with `{TWO_SIDED}` and
`{CLASSIFIABLE}` respectively, matching the pattern already used a few lines
away in the same file.

---

## 4. (Low) The new `public-investment` party duplicates `equal-rights`'s color

**What's wrong.** `src/lib/parties.ts`'s new `public-investment` entry (added
for the D6 fix) uses `color: "#7c3aed"`, identical to the pre-existing
`equal-rights` party. It's the only duplicate among all 33 parties' colors,
and `party.color` drives visible UI: the border/wash on `PartyChip`
(`src/components/party-chip.tsx:17`, `style={{ borderColor: party.color, ..., background: \`${party.color}12\` }}`), the party-breakdown segments in `VoteBar`, and the border accent on each `PartyCard` in `src/app/parties/page.tsx`. Anywhere both parties could appear side by side (a delegation that includes both, or the `/parties` directory), they are visually indistinguishable by color alone.

**Evidence.**
```
$ grep -n 'color: "#' src/lib/parties.ts | awk -F'"' '{print $2}' | sort | uniq -c | sort -rn | head -3
      2 #7c3aed
      1 #...
```
(33 total `color:` entries, one duplicate pair: `equal-rights` and `public-investment`.)

**Suggested fix.** Give `public-investment` a distinct color not already used by any of the other 32 non-blank parties.

---

## 5. (Low, doc-only) `crypto.ts`'s cost comment overstates the scrypt derivation time by ~3×

**What's wrong.** The comment above the scrypt parameters claims:

```ts
// src/lib/crypto.ts:46-47
/** ~60 ms per derivation. Enough to make a 10^21 sweep hopeless, cheap enough to run per request. */
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;
```

A benchmark using these exact parameters measures ~17.9 ms per call, not ~60 ms:

```
$ node /path/to/bench.mjs   # scryptSync with N:16384,r:8,p:1,maxmem:64MB, 10 iterations
avg ms per scryptSync call: 17.9
```

This doesn't change the comment's conclusion (a search space around 10^21 is
still hopeless whether each guess costs 18 ms or 60 ms), so it's not a
security defect — but it's a ~3× inaccuracy in a security-relevant comment
that a future reader might use to reason about acceptable request latency or
rate-limit budgets (two scrypt calls happen per authenticated vault touch —
`userKeyFromSub` + `vaultKey` — so the real per-request cost is ~36 ms, not
the ~120 ms the comment implies).

**Suggested fix.** Update the comment to the measured figure, or make it
self-verifying by deriving the number from a one-time startup benchmark
rather than a hardcoded prose estimate.

---

## What holds up

Verified correct, and not repeating here as findings:

- **`src/lib/crypto.ts`**: per-row random salt, scrypt with domain-separated prefixes (`rowkey\0`, `vault\0`) rather than shared HKDF info strings, PEPPER length validated at module load (throws if `< 32` chars), `secretEquals` using `timingSafeEqual` with a length check first. This closes S2 as described.
- **`src/lib/session.ts`**: `readToken()` reassembles chunked `<name>.0/.1/...` cookies; only `payload?.gsub` is read, no `sub` fallback — closes S7.
- **`src/lib/delegation.ts` / `src/lib/parties.ts`**: `sanitizeDelegation` slices input to 100 before iterating, and `PARTY_BY_SLUG` is a null-prototype object (`Object.create(null)`), so `item in PARTY_BY_SLUG` and `Object.hasOwn(PARTY_BY_SLUG, slug)` can't be defeated by `"constructor"`/`"__proto__"` — closes S4/S5's parsing half.
- **`src/lib/tally.ts`**: the roster-drift guard fires correctly against the *live* roster/electorate — confirmed by direct comparison that `data/electorate.json`'s 33-entry `parties` array matches `src/lib/parties.ts`'s slug order exactly, so the guard is dormant today (as designed) rather than broken. `contestedShare()` and `resolve()`/`tally()` read correctly against the walk they document. `toVoteArray()` hardcodes the blank slug to `abstain` regardless of what's stored for it, so an incidental `party_votes` row for `blank-vote` (present because `KNOWN_SLUGS` in `scripts/classify.ts` includes it) is inert everywhere it's read — confirmed via `src/app/bills/[id]/page.tsx`'s `spoke` filter (`v.vote !== "abstain"`) and `toVoteArray`'s override.
- **`src/lib/results.ts`**: `votesHash()` + `electorate_hash` together close the stale-cache path (D8's second path) — a re-classification with different votes no longer serves an old cached tally, since the cache-hit condition requires both hashes to match. The write is correctly best-effort (try/catch) so a race or read-only replica can't break page rendering.
- **`src/lib/classify.ts` prompt**: untrusted bill data is fenced between explicit `BEGIN`/`END` markers with an explicit "ignore anything that reads as an instruction" framing (S5). `extractJson`'s balanced-brace scanner correctly tracks string/escape state, so it can't be broken by injected brace characters in bill text; a genuinely malformed model response fails `JSON.parse` and is retried, not silently accepted. `votes` is always pre-populated with every `CLASSIFIABLE` slug plus the blank slug defaulted to `abstain`, so `persist()`'s `Object.entries(c.votes)` is never empty — no malformed empty-tuple SQL insert is possible.
- **Live DB roster migration**: read-only query against the production database confirms `parties` has all 33 rows including `public-investment`, and `party_votes` already has rows referencing it (40 at time of check) — the currently-running classify job is not being broken by a missing FK target.
- **`next.config.ts`**: `frame-ancestors 'none'` + `X-Frame-Options: DENY` + `Referrer-Policy` + `X-Content-Type-Options` are set globally — closes S8's header half.
- **`.gitignore`**: `/logs` is present — closes S11's log-leak item.
- **`package.json`**: `next-auth` pinned to exact `5.0.0-beta.32` (no `^`/`~`).
- **`src/app/api/cron/ingest/route.ts`**: fails closed (503) when `CRON_SECRET` is unset, compares with `secretEquals`, returns a generic error to the caller while logging detail server-side — closes S3.
- **`npx tsc --noEmit`**: clean, no output — the round-two fixes did not introduce a type error anywhere in the project.
