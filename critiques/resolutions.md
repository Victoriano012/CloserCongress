# Round-one resolutions

Every finding in `security.md`, `data.md` and `product.md`, with what was done.
"Deferred" means a decision was made not to act, with the reason; it does not
mean forgotten.

## Security (security.md)

| # | Status | What happened |
|---|--------|---------------|
| S1 | Resolved | `/delegate` and `/methodology` no longer claim the operator cannot read a delegation. Both now say plainly that the server decrypts the list to serve a page, so this protects against a database leak and not against us. |
| S2 | Resolved | `src/lib/crypto.ts` rewritten: scrypt (N=16384, r=8, p=1) with a per-row 16-byte salt replaces the single fast hash. ~17 ms per derivation against a measured 3.23M/s SHA-256 sweep, i.e. ~55,000× slower to attack. Verified there were zero `user_vaults` rows first, so no migration was needed. |
| S3 | Resolved | `/api/cron/ingest` fails closed when `CRON_SECRET` is unset (503), compares with `secretEquals` (timing-safe), and logs the real error while returning a generic one. |
| S4 | Resolved | `PARTY_BY_SLUG` is now a null-prototype object, so `"constructor"` and `"__proto__"` are no longer valid party slugs. `sanitizeDelegation` also caps its input at 100 entries before iterating. |
| S5 | Resolved | Bill text in the classifier prompt is fenced between explicit BEGIN/END markers and labelled as untrusted scraped data. Parsed slugs are checked with `Object.hasOwn`; the blank party is rejected outright. |
| S6 | Resolved | `src/app/error.tsx` and `src/app/not-found.tsx` added; `page` is clamped to [1, 10000] so a huge offset can no longer reach Postgres. |
| S7 | Resolved | `getGoogleSub` reassembles chunked `authjs.session-token.N` cookies, and reads only `gsub` — the `?? sub` fallback is gone. |
| S8 | Resolved | `poweredByHeader: false`, plus `frame-ancestors 'none'`, `X-Frame-Options`, `Referrer-Policy` and `X-Content-Type-Options` on every route. |
| S9 | Resolved | The bills search escapes `\`, `%` and `_` before interpolating into `LIKE`. |
| S10 | Resolved | Covered by the S5 prompt fencing plus the strict output contract. |
| S11 | Resolved | `zod` removed (unused), `next-auth` pinned to an exact version, `/logs` gitignored. |

## Data and model (data.md)

| # | Status | What happened |
|---|--------|---------------|
| D1 | Resolved | `npm run tally` now prints a permanent regression metric: the share of citizens, averaged over bills, who had two delegates that disagreed. If it collapses toward zero the ordered list has stopped doing any work. |
| D2 | Resolved | Bills with a real roll call are classified first (`order by (real_yea is not null) desc, (real_outcome <> 'pending') desc, …`), so the real-vs-simulated comparison fills in before the long tail. |
| D2b | Resolved | `cast === 0` is a third outcome everywhere it is shown — "No delegate claimed this one" on `/bills` and on the bill page — never "Would fail — 0%". |
| D3 | Resolved | Same ordering change as D2. |
| D4 | Resolved | Prompt rewritten. The model must now answer for every one of the 32 classifiable parties in roster order, on an explicit two-step test (in scope? then which way), instead of being told abstention is normal. Early runs show 7–13 parties voting per bill against 1–4 before. |
| D5 | Resolved | Calibration reports an exactly-computed whole-population split alongside the sampled one; salience uses a logit-space tilt for one-sided axes. |
| D6 | Resolved | Roster fixes: added the Public Investment Party so the fiscal axis has two sides; narrowed `equal-rights` scope; de-subjunctivised `traditional-family`; removed absolutist "any" from `second-amendment` and `low-tax`. |
| D7 | Resolved | `SHARE_TOTAL` and `MEAN_TURNOUT` are derived, not typed in. |
| D8 | Resolved | `bill_results` gained `votes_hash`; `ensureResult` recomputes when the votes it was built from have changed. The classifier now writes `party_votes` first and `bill_ai` last, so a crash between them leaves the bill queued rather than marked done and empty. |
| D9 | Resolved | `src/lib/tally.ts` throws at module load if `data/electorate.json` was generated from a different party roster than `parties.ts`. |
| D10 | Resolved | `NONVOTER_BLANK_SHARE` is a named, documented constant with its sensitivity stated on `/methodology`. |
| D11 | Resolved | Delegate lists capped at 9; per-side tallies counted after the cap, not before. |
| D12 | Resolved | Every estimated figure carries `estimated: true` and is flagged in the methodology table; one-sided axes say so in their source label. |

## Product and UX (product.md)

| # | Status | What happened |
|---|--------|---------------|
| P1 | Deferred, with mitigation | The reported site-wide 500s were already fixed by the `::text` date casts before the review landed; production returns 200. A driver-level type parser was tried and `@neondatabase/serverless` ignores it over HTTP, so the `::text` convention documented in `src/lib/db.ts` stands. |
| P2 | Resolved | Same as D2 — comparable bills classify first. |
| P3 | Resolved | Hero rewritten to "Don't pick a party. Pick an order." The claim of direct self-voting is gone from the home page, `/how-it-works`, and the root metadata. |
| P4 | Resolved | Zero-cast bills are a distinct third state on the bill page, the bills list, and in the vote bar (hatched, not a solid grey slab). |
| P5 | Resolved | CSS-only `<details>` disclosure nav below `lg`; no horizontal scroll at 320px. |
| P6 | Resolved | The home page walks a sample list against a bill for signed-out visitors, and the bill page shows what a sample list would have done. |
| P7 | Resolved | "Never consulted" is now visually distinct from "abstained" — three states, not two. |
| P8 | Resolved | The CRS fallback is labelled "The official summary", scrolls, and says a plain-words version will follow. |
| P9 | Resolved | Overclaiming copy corrected in all three places. |
| P10 | Resolved | Bar and legend share one comparator; both carry `role="img"` and a label. |
| P11 | Resolved | `--bd-blank` darkened to #64748b for text (4.76:1), with `--bd-blank-fill` kept light for fills. Party hues no longer used as label text. `--bd-line` is no longer used as a foreground anywhere. |
| P12 | Resolved | One unlayered `:focus-visible` rule covering every interactive element. |
| P13 | Resolved | The reordering instruction is now permanent text next to the heading, so the keyboard path is not something you have to discover behind a decorative grip. |
| P14 | Resolved | One rule: **party** is the organisation, **delegate** is the role it plays in your list. Nav CTA and `/delegate` are "Your list"; the editor's right column is "Available parties". Every count is derived from `PARTIES`, never typed. |
| P15 | Resolved | Home bill cards have an empty state; the "put to the delegates" stat counts what has actually been classified. |
| P16 | Resolved | Party cards and party pages carry the denominator in a sentence instead of three bare counters. |
| P17 | Resolved | `/me` is linked from the header and footer, and its signed-out state explains the mechanism with a worked sample list. |
| P18 | Resolved | `getBill` wrapped in `React.cache`, so `generateMetadata` and the page share one query set. |
| P19 | Resolved | `revalidate = 300` on `/`, `/parties` and `/parties/[slug]`; the home page reads the citizen count from the 4KB stats file instead of pulling in the 200KB electorate. |
| P20 | Resolved | `page` clamped; past-the-end and no-match are distinct empty states; the pager is suppressed past the end. |
| P21 | Deferred | Rule placement and heading scale vary by a few Tailwind steps across eight pages. Converging it properly means two new layout components and touching every page; it is cosmetic and it is the one thing most likely to be re-litigated by a human. Left for H-3. |
| P22 | Resolved | Dates formatted, headings promoted to `h3`, dead guards removed, grammar fixed. |

# Round-two resolutions

Findings from `critiques/round2-product.md` and `critiques/round2-code.md`.

| # | Status | What happened |
|---|--------|---------------|
| R1 (product) | Resolved | The save toast said "Your list is live from the next tally", which the rest of the site correctly denies. It now reads "Saved. It is yours to see; it does not move the simulated result." |
| R2 (product) | Resolved | `/parties/blank-vote` claimed its scope and stance are handed to the model verbatim. That page now says the opposite for the blank party, which is never shown a bill. |
| R3 (product) | Resolved | "31 human delegates" on `/methodology` now derives from the roster. |
| C1 (code) | Resolved | The classifier's parser counts vote entries that match neither `yes`, `no` nor `abstain` and warns per bill, so a schema drift can no longer hide as a plausible wall of abstentions. |
| C2 (code) | Resolved | `getBill` gates the simulated result on `bill_ai` as well as on `party_votes`, so a run killed between the two writes cannot show a full result under a "not yet classified" heading. |
| C3 (code) | Resolved | The last two hardcoded roster/axis literals on `/methodology` now derive from `PARTIES` and `AXES`. |
| C4 (code) | Resolved | The Public Investment Party had the same hex as the Equal Rights Party. All 33 colours are now distinct — asserted by count, not by eye. |
| C5 (code) | Resolved | The scrypt cost comment said ~60 ms; the measured figure is ~18 ms. Corrected. |

## Round-three: the five "timing out" bills

| # | Finding | Status |
| - | ------- | ------ |
| X1 | Five bills failed classification with `claude timed out after 180000ms`, reproducibly, and their prompts were unremarkable (17–57 char titles, empty official summaries) — so the content was never the cause. | **Resolved.** Two separate faults. (a) `runClaude` spawned the CLI with `cwd: tmpdir()`; with a few hundred stray entries in `$TMPDIR` the CLI never returns at all. It now runs in a private empty `mkdtempSync` directory, which keeps the original intent (stay out of the repo so the project's `CLAUDE.md` is not pulled into every prompt) without the hang. (b) The 180 s ceiling was genuinely too tight: haiku spends 6–8k thinking tokens on a 33-party roster and a clean run measured 78–141 s, so the limit is now 420 s. All 356 bills are classified. |
