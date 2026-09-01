# Critique — product & UX

_Reviewed `src/app/{page,layout,globals.css}`, `src/app/bills/{page,[id]/page}`, `src/app/parties/{page,[slug]/page}`, `src/app/{how-it-works,methodology,delegate,me}/page.tsx`, `src/components/{site-header,site-footer,vote-bar,party-chip,delegation-editor,auth-buttons}.tsx`, plus `src/lib/{bills,tally,results,delegation,parties}.ts` and the live database, against a production build (`next build` + `next start`), 2026-08-31._

Method note: `npx next build` succeeds and `npx next start` serves, but most routes return HTTP 500 (P1). To review anything behind those 500s I copied the tree to a scratch directory, applied a one-line date coercion in `src/lib/db.ts` **in the copy only**, and served that on :3988. Nothing in the project was modified. All rendered output quoted below is from that copy against the real database.

## Findings

### P1 — Every bill page, the bills index, and 19 of 32 party pages return HTTP 500 in production (severity: high)

**What's wrong:** `date` columns come back from `@neondatabase/serverless` as JavaScript `Date` objects, and three pages render them straight into JSX. React throws `Objects are not valid as a React child`, which in a Server Component is an uncaught render error — the whole route 500s. The TypeScript types say `latest_action_date: string | null` (`src/lib/bills.ts:27`), so the compiler never sees it and `next build` passes clean. `/me` is the only page that guards, via its own local `shortDate()` (`src/app/me/page.tsx:37`) — which is evidence somebody hit this once and patched one page instead of the driver.

**Evidence:** against the unmodified build on :3987 —

```
200 /                     404 /bills/nope
500 /bills                200 /bills?q=zzzzzznomatch     <- 200 only because zero rows render
500 /bills?outcome=passed 200 /parties
500 /bills/119-hr-10180   500 /parties/climate-action
500 /bills/119-hr-10181   200 /parties/blank-vote        <- 200 only because it has no bills to list
```

Server log: `⨯ Error: Objects are not valid as a React child (found: [object Date]).`

Offending renders: `src/app/bills/page.tsx:133` (`{bill.latest_action_date}`), `src/app/bills/[id]/page.tsx:145` (`introduced {bill.introduced_date}`) and `:224` (`Latest action ({bill.latest_action_date})`), `src/app/parties/[slug]/page.tsx:180` (`Latest action {row.latest_action_date}`). Columns declared `date` at `db/schema.sql:26-27,38`.

The home page survives purely by luck: its stat query casts (`max(latest_action_date)::text`, `src/app/page.tsx:30`) and its bill cards happen not to print a date.

**Suggested fix:** fix it once, in `src/lib/db.ts`, not at four call sites. Either register a type parser (`import { types } from "@neondatabase/serverless"` and map OID 1082 → identity string) or coerce in the `query<T>` wrapper before returning rows. Then delete the bespoke `shortDate()` in `me/page.tsx`. Add one smoke test that curls `/bills` and one `/bills/[id]` and asserts 200 — this class of bug is invisible to `tsc` and to the build.

---

### P2 — The comparison the entire site exists to make is empty on 100% of the bills that have something to compare (severity: high)

**What's wrong:** every bill page promises "What Congress did, and what ten thousand people with delegated votes would have done" (`src/app/bills/[id]/page.tsx:234`). There is not one bill in the database where both halves are populated. The classifier is ordered `order by b.latest_action_date desc` (`scripts/classify.ts:92`), so it always works on the newest-action bills — which are bills introduced last week and referred to committee. Bills that actually reached a recorded floor vote have older action dates and sit permanently at the back of a 356-deep queue. The queue ordering structurally guarantees the flagship feature never fires.

**Evidence:**

```sql
select count(*) from bills b join bill_ai a on a.bill_id=b.id where b.real_yea is not null;  -- 0
select count(*) from bills where real_outcome <> 'pending';                                  -- 19
```

`/bills/119-hr-6500` — Continuing Appropriations and Extensions Act, 2027, passed the Senate 90–6, full party breakdown rendered on the left — and on the right: _"The delegates have not looked at this bill yet. Come back once it has been put to them."_ That is the single best bill on the site for making the point, and it is blank.

**Suggested fix:** classify by interest, not recency. `order by (real_yea is not null) desc, latest_action_date desc` would populate all 19 comparable bills in one run. Longer term, seed with a backfill of every bill that has a roll call, and only then work forward. Until that lands, the home page and `/bills` should surface the comparable bills rather than the newest ones — a "Congress voted on these" filter is worth more than the `In progress / Passed / Failed` tabs currently there.

---

### P3 — The first line of the hero sells a feature that does not exist (severity: high)

**What's wrong:** the `<h1>` opens with **"Vote on the laws yourself."** You cannot. There is no ballot, no vote button, no vote action anywhere in the codebase — `src/app/actions/` contains exactly two functions, `saveDelegationAction` and `deleteDelegationAction`. The claim is repeated in the page `<title>` ("vote on the laws, or lend your vote to someone who will"), the root `metadata.description` ("Vote on real bills before Congress yourself"), and `/how-it-works`, which lists it as option one of "Three ways to cast a vote": _"**Vote it yourself.** A bill you care about, you read and decide. No delegate involved."_ (`how-it-works/page.tsx:218`).

This is the worst possible use of the ten-second budget. The site has one idea, and the headline spends its first and largest line on a capability that isn't built, so the actual idea — the ordered list — arrives on line two as a subordinate clause after an em-dash, and the reason ordering matters arrives four sentences later.

**Evidence:** `src/app/page.tsx:11,13,51`; `src/app/layout.tsx:19`; `src/app/how-it-works/page.tsx:7,214-221`. `grep -rn "vote" src/app/actions/` returns nothing that casts a vote.

**Suggested fix:** either build direct voting or stop claiming it. Assuming the latter, replace the hero with the mechanism:

> # Don't pick a party. Pick a queue.
> Name several delegates, in order. Each one cares about exactly one subject and stays silent on everything else — so on a bill about animal testing your first choice speaks, and on the other nine-tenths of Congress your vote falls through to whoever's business it actually is.

That says "several", "in order", and answers the first question anyone asks ("what happens when they disagree?" — they can't, only one of them is ever consulted) inside the first two lines. Then cut option 1 from `/how-it-works` and renumber to "Two ways", or reword it to "Ignore the list on a bill you care about" only once that exists.

---

### P4 — "Would fail — 0.0% of the votes cast were in favour" when nobody voted (severity: high)

**What's wrong:** on a bill where every delegate abstained, `yes = no = 0`. The bill page then prints a `Would fail` verdict and `pct(0, 0).toFixed(1)` → **"0.0% of the votes cast were in favour"** — a 0/0 dressed up as a measured number, next to a claim of rejection when the electorate expressed nothing at all. The bills list does the same in its own words: **"Would fail here — 0% in favour of those who voted"** when nobody voted.

This is not an edge case. It is **26 of the 53 tallied bills — 49%.**

**Evidence:** `/bills/119-hr-10151` (Safe Drinking Water Act amendment):

```
Here
Would fail
0.0% of the votes cast were in favour
0 in favour   0 against   10,000 blank
Who cast those votes
  Blank Vote Party   100.0% blank
```

`/bills` list rows for H.R. 10179 and H.R. 10181: `Would fail here — 0% in favour of those who voted`. Code: `src/app/bills/[id]/page.tsx:245-250` (`pct` at `:25` returns 0 when `d === 0`), `src/app/bills/page.tsx:157-162`. Tally: `passed: cast > 0 && yes/cast > 0.5` (`src/lib/tally.ts:116`) — correct, but the *presentation* collapses "rejected" and "nobody claimed it" into one word.

Compounding it: when zero parties speak, the whole "What the delegates said" section is suppressed (`spoke.length > 0`, `:359`), so the page silently drops the one explanation a reader needs. This is precisely the case where the fall-through story is most vivid — *every citizen's list ran off the end* — and the page says nothing.

**Suggested fix:** branch on `result.cast === 0` before the pass/fail verdict:

> **No result.** Not one of the 31 delegates claimed this bill as its subject, so all 10,000 lists fell through to the blank vote. In this system that is not a rejection — it is nobody's business.

And on the list row, replace the percentage with `No delegate claimed this one — 100% blank`. Never print a percentage of a zero denominator.

---

### P5 — The site header overflows the viewport on every phone (severity: high)

**What's wrong:** `site-header.tsx` has zero responsive classes. One `flex` row, `gap-6`, no `flex-wrap`, no hamburger, no `overflow` handling, and a `shrink-0` logo. Measuring the rendered markup: logo block ≈ 187px (32px mark + 10px gap + "BetterDemocracy" at 18px serif semibold), nav ≈ 391px (Bills 55 + Parties 76 + How it works 109 + 12px of `gap-1` + 8px `ml-2` + "Your delegates" pill 131), plus `gap-6` (24) and `bd-container` padding (40) = **~642px minimum**. Below that the row overflows its container and the document gets a horizontal scrollbar, on a `sticky` element, on every page.

That breaks at 390px (iPhone 15), 393px (Pixel), 414px, 430px and 640px. It is fine only at `sm`-and-up desktop widths, which is presumably the only place it was looked at.

**Evidence:** rendered header markup, unchanged at every viewport:

```html
<div class="bd-container flex h-16 items-center gap-6">
  <a class="flex items-center gap-2.5 shrink-0" href="/">…BetterDemocracy</a>
  <nav class="ml-auto flex items-center gap-1 text-sm">…Bills…Parties…How it works…Your delegates</nav>
```

`src/components/site-header.tsx:12,25`. No `hidden`, `md:`, `sm:` or `flex-wrap` anywhere in the file.

**Suggested fix:** hide the text nav below `md` and add a disclosure menu, or at minimum: `<nav class="ml-auto hidden items-center gap-1 text-sm md:flex">` plus a `md:hidden` menu button, and shorten the wordmark to the `BD` mark alone under `sm`. Also add `overflow-x-hidden` to `body` as a backstop so no future header change can produce a sideways-scrolling page.

---

### P6 — The fall-through is asserted everywhere and demonstrated nowhere a signed-out visitor can see it (severity: high)

**What's wrong:** the site is a demonstration of ordered delegation. Trace the idea:

- **Home** — the hero card shows it, but as an invented hypothetical about a hypothetical holiday bill.
- **/how-it-works** — shows it twice, well, but again on two fictional bills that do not exist in the database.
- **/delegate** — describes it in prose, shows the same fictional worked example.
- **/bills/[id]** — the "Your vote" section is the only place the mechanism is applied to a *real* bill with *real* AI votes, and it is wrapped in `{delegation && …}` (`:312`). A signed-out visitor sees nothing. There is no sign-in prompt in its place, no "here's what a list like this would have done", nothing.

So the one live, concrete, non-hypothetical proof that the mechanism works is behind Google OAuth, and every page a first-time visitor sees demonstrates the idea with a made-up example. The "Who cast those votes" breakdown on the bill page is close but reports *outcomes* by party, never *fall-through*: it never says "6,185 of these people had a delegate ranked above the one that spoke."

**Evidence:** `/bills/119-hr-10157` signed out ends at "What the delegates said". No sign-in affordance appears anywhere on any bill page.

**Suggested fix:** render the "Your vote" section for signed-out visitors too, populated with a *sample* list (the same 🐾 / ✝️ / 🤝 trio used elsewhere) walked against this bill's real votes, with a caption "This is what a list like this would have done here — [build your own]". That converts the site's best asset (real votes on a real bill) into the site's best explainer, and gives the sign-in CTA a reason to exist at the exact moment the reader understands the idea. Second: in "Who cast those votes", add the rank — `Low Tax Party · 9.8% in favour · spoke for people who had 1.4 silent delegates above it on average`.

---

### P7 — The page that teaches the mechanism labels "never consulted" as "ABSTAINS" (severity: medium)

**What's wrong:** the whole idea rests on a distinction between two states: a delegate that *was asked and had nothing to say* (so your vote falls through) and a delegate that *was never reached* (because someone above already spoke). `/how-it-works` renders both with the same badge. In the "Bill one" diagram, delegates 2 and 3 carry the note "Never consulted — your first delegate already spoke" **and a badge reading `ABSTAINS`**. They did not abstain. Nobody asked them.

The home page collapses the same distinction visually: `const dim = row.state !== "voted"` (`src/app/page.tsx:84`) renders the silent-and-therefore-skipped animal party and the never-reached equal rights party at identical `opacity-45`, despite the data carrying `state: "silent"` vs `state: "unreached"` and clearly intending to distinguish them.

**Evidence:** `src/app/how-it-works/page.tsx:260-274` — `{ rank: 2, state: "abstains", note: "Never consulted — your first delegate already spoke." }`, rendered by `:120` as `{voted ? "votes" : "abstains"}`. `src/app/page.tsx:84,103`.

**Suggested fix:** three states, not two. Add `state: "unreached"` to the `Step` type and render a third badge — `votes` (blue), `silent` (grey outline, with the "no opinion here" note), `not reached` (very faint, struck through, arrow suppressed). On the home card, give the silent row a visible "no opinion" tag at full opacity and reserve the 45% dim for the unreached row only. The distinction *is* the product; do not let the styling erase it.

---

### P8 — "In plain words" is where 1,800 characters of unformatted CRS legalese go (severity: medium)

**What's wrong:** when a bill has no AI summary, the card keeps its "IN PLAIN WORDS" eyebrow and its blue left rule and dumps `official_summary` verbatim into a single `<p>` with no `whitespace-pre-line`, so the newlines the CRS text contains collapse and the reader gets one unbroken grey slab. It is also unattributed — nothing tells the reader this is Congress's own summary rather than the site's rewrite, which is the exact opposite of what the label promises.

**Evidence:** `/bills/119-hr-6500` renders 1,812 characters as one paragraph, beginning by repeating the bill title and running through nested unlabelled list fragments ("the Special Supplemental Nutrition Program for Women, Infants, and Children (WIC); Small Business Administration loans; the Disaster Relief Fund; …"). `src/app/bills/[id]/page.tsx:182-188`.

Related: bills the model *did* summarise but could not understand produce apologies in the same slot, styled as the hero summary in 20px serif — "The title does not clearly specify the bill's provisions or legal effects, preventing confident scope determination." (H.R. 10183 SRBIJA Act, visible on the home page and on `/bills`).

**Suggested fix:** relabel the fallback branch — eyebrow "THE OFFICIAL SUMMARY", body `whitespace-pre-line`, `max-h-64 overflow-y-auto`, and a line reading "Congress's own summary. A plain-words version will appear once this bill is classified." For the model's apologies, detect them at classification time and store `plain_summary: null` rather than surfacing "I couldn't tell" as though it were a summary.

---

### P9 — Three places where the copy claims more than the system does (severity: medium)

**What's wrong:** the site is admirably scrupulous in `/methodology` and `/how-it-works` and then contradicts itself in the UI chrome.

1. **`"Saved. Your list is live from the next tally."`** (`src/components/delegation-editor.tsx:170`) — it is not. `/how-it-works` says of a user's list: _"It does **not** move the simulated result."_ `/methodology` says real delegations are "excluded from the tally". The one message a user sees at the exact moment they commit tells them the opposite.
2. **`"Nobody operating this site can read your list."`** (`src/app/delegate/page.tsx:73-74`, repeated `:110-111`) — `/methodology` states plainly, and correctly, "the server necessarily sees your list in plaintext while it is serving you a page… This is not end-to-end encryption." The flat claim on `/delegate` is the overclaim `/methodology` was written to avoid.
3. **`/parties/blank-vote`** renders the shared line "Those two paragraphs are not a summary. They are the literal instruction the AI delegate is handed for every bill it is shown" — while `/methodology` says "The blank vote party is never shown to the model — its abstention is hardcoded."

**Evidence:** rendered `/parties/blank-vote`, `/delegate` (signed out), and the save handler. Contradicted by `how-it-works/page.tsx:441-447` and `methodology/page.tsx:~562,~230`.

**Suggested fix:** (1) "Saved. Every bill page will now show you which of your delegates spoke — this does not change the simulated result." (2) "Encrypted at rest under a key derived from your Google account id, which is never stored. A stolen database dump reveals neither whose list it is nor what it says." then link to `/methodology#privacy`. (3) Suppress that sentence when `party.isBlank`.

Conversely, one place is *needlessly* hedged: the bill page's "Written by haiku. It can be wrong; the official text is the only authority." renders the bare model slug in lower case as if it were a person's name. Say "Summarised by Claude Haiku from the official summary."

---

### P10 — The party breakdown bar and its own legend are in different orders (severity: medium)

**What's wrong:** `PartyBreakdownBar` sorts yes → no → abstain, then by size (`src/components/vote-bar.tsx:48-50`). The legend list directly beneath it renders `result.breakdown` in the order the tally produced, which is size-descending (`src/lib/tally.ts:108`). So the bar reads left-to-right and the legend reads top-to-bottom in unrelated sequences, and there is no way to map one to the other except by matching colour swatches.

**Evidence:** `/bills/119-hr-10157` — bar order: Low Tax (9.8%) │ Small Business (3.8%) │ Balanced Budget (24.6%) │ Blank (61.9%). Legend order: Blank 61.9, Balanced Budget 24.6, Low Tax 9.8, Small Business 3.8. Exactly reversed at the top and interleaved at the bottom.

Also in this component: vote direction is encoded as `opacity` (yes 1.0, no 0.55, abstain 0.3) on top of party hue, so "Balanced Budget against" and "Balanced Budget in favour" are the same swatch at different alpha — unreadable for anyone who cannot compare two lightness values side by side, and there is no pattern or label fallback. The `title=` attributes on the `<div>` segments are not focusable and are not announced by screen readers.

**Suggested fix:** sort the legend with the same comparator as the bar (export one `sortContributions()` from `vote-bar.tsx` and use it in both). Then give the bar `role="img"` with an `aria-label` composed from the same data ("Blank Vote Party 61.9% blank, Balanced Budget Party 24.6% against, …"). To answer P4's point at the same time, the legend rows should carry the raw counts, not only percentages.

To the specific question asked: **no, the per-party distribution is not a wall of near-identical percentages** — real bills produce three or four segments, one of which is usually blank at 50–70%. The readability problem is ordering and colour encoding, not density.

---

### P11 — Colour contrast: two tokens are used as text at 2.6:1 and 1.3:1 (severity: medium)

**What's wrong:** measured against white and against `--bd-paper` (#f7f9fc):

| token | hex | vs white | vs paper | verdict |
|---|---|---|---|---|
| `--bd-muted` | #5a6b83 | 5.43 | 5.15 | passes AA — fine |
| `--bd-yes` | #1a7f5a | 4.97 | 4.71 | passes AA |
| `--bd-no` | #b4344a | 5.95 | 5.64 | passes AA |
| `--bd-blue` | #1d4ed8 | 6.70 | 6.35 | passes AA |
| **`--bd-blank`** | **#94a3b8** | **2.56** | **2.43** | **fails AA and fails 3:1 large-text** |
| **`--bd-line`** | **#dbe4f0** | **1.28** | **1.22** | **effectively invisible** |

`--bd-muted` is the one you asked about and it is fine as a ratio. The problems are the other two, both of which are *used as text colour*:

- `--bd-blank` as the "Blank" vote badge on `/me` (`me/page.tsx:96`, 12px text), and as the value colour of the "Abstained" statistic on every party page (`parties/[slug]/page.tsx:152`) — 24px, still below the 3:1 large-text floor.
- `--bd-line` as the text colour of the numerals in the sticky table of contents on `/how-it-works:496` and `/methodology:696`, and as the em-dash placeholder in the methodology axis table. At 1.28:1 those characters are functionally not rendered.

Party colours as text: **8 of 32 fall below 4.5:1** on white, used as `PartyChip` label text (`party-chip.tsx:15`) and `VoteTag` (`parties/[slug]/page.tsx:77`). Worst: #ca8a04 Small Business (2.94), #65a30d (3.09), #16a34a Climate Action (3.30), #ea580c (3.56), #0891b2 Open Doors (3.68), #0d9488 (3.74), #0284c7 (4.10), #94a3b8 Blank (2.56).

**Suggested fix:** keep the party hue for the chip's *border and background tint*, but set the label text to `var(--bd-ink)` — the identity is carried by the swatch, not by tinted text. Darken `--bd-blank` to about #64748b (4.8:1) for text use and keep #94a3b8 for fills. Never use `--bd-line` as a foreground; the TOC numerals should be `--bd-muted`.

---

### P12 — There is no focus style anywhere on the site, and the one place focus is touched, it is removed (severity: medium)

**What's wrong:** `grep -rn focus src/app src/components` outside `delegation-editor.tsx` returns exactly one hit, and it is `outline-none` on the bills search input (`src/app/bills/page.tsx:82`). That kills the browser's default ring and replaces it with a 1px border colour change from #dbe4f0 to #1d4ed8 — a change a keyboard user will not see. Everything else (header nav, both hero CTAs, the outcome filter tabs, pagination, every bill card link, both auth buttons) relies on the UA default, and `globals.css` defines no `:focus-visible` rule at all.

The delegation editor is the exception and it is done properly — a shared `FOCUS` constant applied to all eleven interactive elements.

**Evidence:** `src/app/globals.css` (no focus rule in `@layer base`); `src/components/delegation-editor.tsx:31-32` for the pattern that should be global.

**Suggested fix:** promote the editor's constant into `globals.css` as a base rule — `:where(a, button, input, select, [tabindex]):focus-visible { outline: 2px solid var(--bd-blue); outline-offset: 2px; border-radius: 0.25rem; }` — and delete `outline-none` from the search input.

---

### P13 — Keyboard reordering works; the drag affordance lies about it (severity: low)

**What's wrong:** to the question asked directly — **yes, the reordering is genuinely keyboard-operable**, and better than most implementations: `▲`/`▼` buttons with real `aria-label`s (`Move Climate Action Party up`), correct `disabled` at the ends, focus follow-through after a move via `refocus()`, and an `aria-live` `sr-only` region announcing "X moved to position 2 of 4". That is a real positive.

The gap is the drag path's semantics. The `⠿` handle is `aria-hidden` with `cursor-grab`, but it is not a control — the `draggable` attribute is on the whole row `<div>`, which has no `tabIndex`, no `role`, and no `aria-` state. So a sighted mouse user sees a grip that implies a keyboard drag that doesn't exist on that element, and a screen reader user is told nothing about the two mechanisms coexisting.

**Evidence:** `src/components/delegation-editor.tsx:249-276`, `:288-315`.

**Suggested fix:** add one visually-hidden instruction inside the list heading — "Reorder by dragging, or with the up and down buttons on each row" — and drop `cursor-grab` from a non-interactive span or make the handle a real `<button>` that mirrors the ▲/▼ behaviour.

---

### P14 — "delegate", "party" and "delegation" are used interchangeably, and the roster is 31 or 32 depending on the page (severity: medium)

**What's wrong:** there is no chosen word. The header says **Parties** and **Your delegates** two elements apart. `/parties` is titled "The parties" and its first sentence is "Every party here is a single-issue **delegate**". `/delegate` is titled "Your delegates" and its first sentence is "A **delegation** is an ordered list of single-issue **parties**". The editor's two column headings are "Your list, in order" and "Available **delegates**", listing objects the cards call parties. The bill page says "What the **delegates** said" above a list of party chips. A first-time reader has to work out these are the same thing.

The count is also inconsistent: `VOTING_PARTIES.length` is 31 (32 roster entries minus the blank vote). The home page stat correctly reads "31 single-issue delegates". `/parties`'s meta description says "**Thirty-two** single-issue delegates". `/how-it-works` says "All **32** of them are invented". The bill page says "3 of **32** parties had an opinion" — counting the Blank Vote Party among the parties that *could* have had one, which by construction it cannot.

**Evidence:** `src/components/site-header.tsx:4-5,35-40`; `src/app/parties/page.tsx:18,112`; `src/app/delegate/page.tsx:28,31`; `src/components/delegation-editor.tsx:228,412`; `src/app/bills/[id]/page.tsx:362`; `src/app/how-it-works/page.tsx:407`; `src/lib/parties.ts:381`.

**Suggested fix:** pick **delegate** for the role and **party** for the named organisation, then hold the line: nav becomes "Delegates" / "Your list"; `/parties` becomes "The delegates"; the bill page note becomes "3 of the 31 delegates had an opinion" (`spoke.length` of `VOTING_PARTIES.length`, never `votes.length`); fix the `/parties` description to "Thirty-one single-issue delegates, plus the blank vote."

---

### P15 — The home page's own bill cards have no empty state at all (severity: medium)

**What's wrong:** `/bills` prints "Not yet put to the delegates." on an unclassified bill. The home page's "Latest before Congress" cards print *nothing* — the `VoteBar` is wrapped in `bill.yes_weight !== null && bill.no_weight !== null` with no `else` (`src/app/page.tsx:170-179`), so the card just stops after the summary. Because the home page shows the four newest bills and the classifier lags, **all four cards are currently in this state**, and they read as truncated rather than pending.

**Evidence:** rendered `/`, all four cards (H.R. 10183, 10182, 10181, 10180) end at the summary line with no result row and no explanation.

Adjacent: the stats strip says "356 real bills tracked / 53 put to the delegates" with no acknowledgement of the 85% gap, while `/bills` opens with "Each one **is** put to the ten thousand simulated citizens" — present tense, universal, and false for 85% of the list. Note also that "put to the delegates" counts rows in `bill_results`, which `ensureResult()` writes lazily on page view (`src/lib/results.ts:50-63`); the number is partly "bills someone has looked at", not "bills classified" (`bill_ai` = 64 vs `bill_results` = 53 at time of writing).

**Suggested fix:** give the home card the same fallback line the list has. Change the `/bills` intro to "Each one is put to the ten thousand simulated citizens as it is classified — 53 of 356 so far." Count `bill_ai`, not `bill_results`, for the stat.

---

### P16 — `/parties` is a grid of 31 cards mostly showing "Yes 0 · No 0 · Abstained 58" (severity: medium)

**What's wrong:** each party card ends in a three-counter footer of raw absolute numbers with no denominator and no context. **13 of the 32 parties have never cast a single non-abstain vote**, so a third of the grid is a row of zeros; the rest show one small number and one large one. "Abstained 58" is meaningless unless you already know 58 is every classified bill — which the page never says.

**Evidence:** rendered `/parties`: "Reproductive Freedom Party — Yes 0 / No 0 (sic: No 1) / Abstained 57"; "Right to Life Party — Yes 0 / No 0 / Abstained 58". `src/app/parties/page.tsx:79-94`. `select count(*) from (select party_slug from party_votes group by party_slug having count(*) filter (where vote<>'abstain') = 0) x` → 13.

Same page, same problem on the detail view: `/parties/[slug]`'s three `Stat` tiles give "5 / 0 / 53" with the abstained figure in a 2.56:1 grey.

**Suggested fix:** replace the three counters with one sentence that carries the denominator and, better, makes the abstention *the point*: "Spoke on 5 of 58 bills. Silent on the other 53 — which is how your vote reaches the next name on your list." For parties with zero: "Hasn't found a bill in its subject yet." Every card then says something instead of showing two zeros.

---

### P17 — `/me` is not linked from anywhere except `/delegate`, and its signed-out state is a stub (severity: medium)

**What's wrong:** `/me` — "How your list has been voting" — is the payoff page: it is the only screen that shows the fall-through happening repeatedly, over real bills, with "3 delegates above abstained first" counts. It appears in no navigation. The header's four items are Bills, Parties, How it works, Your delegates. The footer's three are How it works, The parties, Methodology. The only route in is one inline link on `/delegate`.

Signed out, the page is four elements: an h1 that presumes a list ("How your list has been voting"), one sentence, a sign-in button, and nothing else — no example, no link to `/how-it-works`, no explanation of what a "list" is to someone who arrived cold.

**Evidence:** `src/components/site-header.tsx:3-7`; `src/components/site-footer.tsx:17-27`; `src/app/me/page.tsx:110-123`.

**Suggested fix:** add "Your record" to the header for signed-in users (or make "Your delegates" a two-item group). For the signed-out state, reuse the sample-list device from P6: render the page against the 🐾/✝️/🤝 example over the last 25 real bills, greyed, with the sign-in button captioned "…and see this for your own list."

---

### P18 — Every bill page runs its whole query set twice (severity: medium)

**What's wrong:** `generateMetadata` calls `getBill(id)` (`src/app/bills/[id]/page.tsx:17`) and then `BillPage` calls `getBill(id)` again (`:108`). `getBill` is a plain async function with no `React.cache()` wrapper, so each request issues **8 queries instead of 4**, and calls `ensureResult()` twice — which on a cold bill means tallying 10,000 citizens twice and firing two upserts into `bill_results` that race each other.

**Evidence:** `src/lib/bills.ts:127-154` (no `cache()`); `src/lib/results.ts:17-68`.

**Suggested fix:** `export const getBill = cache(async (id: string) => { … })` from `react`. One-line change, halves the database work on the site's most-visited page type.

---

### P19 — `force-dynamic` everywhere, and a 200KB JSON pulled in for one integer (severity: low)

**What's wrong:** `export const dynamic = "force-dynamic"` is on `/`, `/bills`, `/bills/[id]`, `/parties`, `/parties/[slug]`, `/delegate` and `/me`. It is correct for the four that read a session or per-request search params. It is not needed on `/parties` (a static roster plus one `group by` aggregate that changes once a day), `/parties/[slug]` (same), or `/` (three aggregate queries over a table the cron touches once a day). Those three want `export const revalidate = 300`, which would also mean the home page survives a database outage instead of falling back to zeros. `/how-it-works` and `/methodology` correctly carry no directive and prerender static — good.

Separately: `src/lib/tally.ts:15` imports `data/electorate.json` — exactly 200,001 bytes — at module scope, and `src/app/page.tsx:7` imports `ELECTORATE_TOTAL` from it purely to render the number 10,000. The home page therefore parses a 200KB array of 10,000 delegation lists on every cold start to read `.length`. It stays server-side (no client component imports it), so it is not shipped to the browser, but it is avoidable cold-start cost on a page that needs a constant.

**Suggested fix:** `revalidate = 300` on the three read-only pages. Export `ELECTORATE_TOTAL` and `ELECTORATE_HASH` from a tiny `data/electorate-meta.json` (or from `electorate-stats.json`, already imported by `/methodology` at 4KB) so pages that need the count don't pull the population.

---

### P20 — Pagination: a nonsense page number claims the search failed; a large one 500s (severity: low)

**What's wrong:** `page` is parsed as `Math.max(Number(params.page) || 1, 1)` with no upper clamp (`src/app/bills/page.tsx:43`). Two consequences:

- `/bills?page=999` returns 200 with "356 bills", an empty list, the message **"No bills match that search."** — no search was performed — and the footer "Page 999 of 15" with a live "← Previous" link.
- `/bills?page=1e30` returns **HTTP 500**: the offset becomes `2.5e31`, is stringified as `"2.5e+31"`, and Postgres rejects it (`22P02 invalid input syntax for type integer`, `where: "unnamed portal parameter $2"`).

**Evidence:** curl of both URLs against the build; server log for the second.

**Suggested fix:** clamp after computing `pages` — `const page = Math.min(Math.max(Math.trunc(Number(params.page)) || 1, 1), 10_000)`, then `redirect(link({ page: pages }))` if `page > pages`. And distinguish the two empty states: "No bills match “x”." vs "That page is past the end — [go to the last page]."

---

### P21 — Visual coherence: the letterhead rule sits above the h1 on two pages and below it on six (severity: low)

**What's wrong:** `bd-rule` is the site's signature motif and it has no rule about where it goes.

- **Above** the `h1`: `/` (`mb-6`), `/bills` (`mb-5`), and every `Section` on `/bills/[id]` (`mb-4`).
- **Below** the `h1`: `/delegate` (`mt-3`), `/me` (`mt-3`), `/parties` (`mt-4`), `/how-it-works` (`mt-8`, after the intro paragraph), `/methodology` (`mt-8`).
- **Absent** under the `h1`: `/parties/[slug]`, which uses a coloured card header instead.

Seven distinct offsets for one 40px line (`mb-4/5/6`, `mt-2/3/4/8`). The `h1` scale drifts the same way — `text-4xl sm:text-5xl` (home, how-it-works, methodology), `text-4xl` fixed (bills, parties), `text-3xl sm:text-4xl` (bill detail), `text-3xl` fixed (delegate, me, party detail): four scales for one level. Page padding: `py-12` (six pages), `py-14 sm:py-20` (two), `py-20 lg:py-28` (home hero).

Card treatment is the one thing that *is* consistent — `.bd-card` used everywhere, with `border-l-4` in the party colour as a coherent secondary motif on party cards, editor rows and the bill summary. Credit where due.

**Suggested fix:** one decision, applied everywhere: rule above the `h1` with `mb-5`, `h1` at `text-4xl sm:text-5xl` for section landing pages and `text-3xl sm:text-4xl` for record pages (bill, party, me), page shell at `py-12 sm:py-16`. Encode it as two component wrappers (`<PageHeader>`, `<PageShell>`) rather than as a convention nobody can enforce.

---

### P22 — Assorted copy and semantics (severity: low)

- **`"Here"`** as the heading of the simulated-result card (`bills/[id]/page.tsx:241`) against "In the real Congress" opposite it. It is cryptic and it is the weaker half of the site's central comparison. Use "If the delegates decided it".
- **The card labels are `<p>`, not headings.** "In plain words", "In the real Congress", "Here", "Who cast those votes" are all `<p class="text-xs uppercase">`. A screen-reader user navigating by heading gets `h1` → "The result" → "Your vote" and nothing inside them. Make them `<h3>`.
- **Dead branch:** `seg.share === 0 ? "<0.1" : (seg.share * 100).toFixed(1)` (`:294`). `share` is only ever pushed when `count > 0`, so it is never exactly 0 and the guard never fires — a party with 4 voters renders "0.0% in favour". Test `seg.share < 0.001` instead.
- **`real_vote_chamber` renders raw:** "90 yea · 6 nay · 3 not voting — **senate**" (`:64`), lower-case, while `bill.chamber` two lines above gets `capitalize`.
- **Skipped-delegate grammar:** `skipped.length === 1` yields "Above it, Pets and Animal Welfare Party had nothing to say about this one." (`:334-336`). Reads as a dangling modifier. "Pets and Animal Welfare Party, ranked above it, had nothing to say about this one."
- **`spoke` is sorted `a.vote.localeCompare(b.vote)`** (`:120`), so "no" sorts before "yes" and every bill lists its opponents first. Sort yes-first to match the bar and the legend.
- **Dates are raw ISO throughout** — "Most recent action in the record: 2026-08-27." on the home page, bare `2026-08-27` in the corner of every list row with no label saying what date it is. Format as "27 Aug 2026" and label it ("last action").
- **Spelling** is consistently British in prose (favour, organisation, colour, sceptical, recognising, programmes) on a site about the US Congress, sitting next to US spellings inherited from the data ("Democratic", "Defense Production"). Internally consistent, so this is a choice rather than an error — but it is a choice worth making deliberately.

---

## What holds up

- **The idea is genuinely well thought through, and the writing knows it.** `/how-it-works` §4 "The sharp edge, stated honestly" — "On a bill where your first delegate stays silent, your vote is cast by someone you ranked lower, and sometimes by nobody at all. It can feel like your voice went missing." — is the paragraph most products would have cut. It is the reason to trust the rest.
- **`/methodology` is the best page on the site and probably the best thing in the repo.** Per-figure `estimated` flags, a limitations section ordered "by how much they should bother you", and the admission that "delegation ordering has no survey behind it whatsoever… it is the single least evidenced part of the model, and it is also the part that decides which delegate speaks for whom". That is real intellectual honesty, and the reason P9's three overclaims are worth fixing rather than shrugging at — they are beneath the standard the rest of the site sets.
- **The counting rule is correct and correctly explained.** Blanks counted and reported but excluded from the denominator, exact ties fail, zero-cast fails, with the "3,000 yes / 2,000 no / 5,000 blank → passes on 60%, participation 50%" worked example. `src/lib/tally.ts:116` implements exactly what `/how-it-works` §6 promises.
- **The delegation editor is the best-built component here.** A shared focus token applied to all eleven controls, `aria-label` on every icon-only button, an `sr-only` `aria-live` region announcing every move, focus follow-through after reordering, a dirty/saved state that actually disables correctly, and a two-step delete confirmation. It is also the only place the answer to "is this keyboard-operable?" is unambiguously yes.
- **The failure handling in the data layer is deliberate and consistent.** `loadCounts`, `loadRecord` and `loadRecent` all catch and degrade to an honest empty state with a comment explaining why; `ensureResult` treats its own cache write as best-effort and returns the correct tally regardless. That the site 500s anyway (P1) is a rendering bug, not a lapse in this thinking.
- **The colour system is disciplined.** One institutional blue, one paper ground, three vote tones, a serif/sans pairing used consistently for display vs body, and `.bd-card` applied everywhere. Four of the six semantic tokens pass AA on both backgrounds without adjustment. The failures in P11 are two tokens misused as foregrounds, not a broken palette.
- **`/bills/[id]` follows the specified order exactly** — plain-words summary beside the document buttons, then real result against simulated result with the population distribution, then the reader's own vote and the delegate that cast it. The structure is right; the content of the second and third blocks is what needs work.
