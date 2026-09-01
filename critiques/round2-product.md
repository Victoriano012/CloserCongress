# Critique — product & UX, round two

_Reviewed the current source tree against `critiques/product.md` and `critiques/resolutions.md`, and against the running production build at `http://localhost:3117` via `curl`, 2026-09-01. Scope: everywhere four agents just edited in parallel — `src/app/{page,how-it-works,methodology,delegate,me}/page.tsx`, `src/app/{bills,parties}/**`, `src/components/{delegation-editor,vote-bar,party-chip,site-header,site-footer}.tsx`, `src/lib/{parties,delegation,tally,bills,results}.ts`. No server started or stopped, no build run, no file touched other than this one._

Method note: round one's findings are not repeated here unless `resolutions.md` claims a fix that the current source does not actually contain. Two of the three findings below are exactly that — a resolution log entry that is false against the code as it stands today.

## Findings

### R1 — The delegation editor's save toast still makes the exact overclaim P9 was resolved to remove (severity: high)

**What's wrong:** `resolutions.md` states P9 was "Resolved" and that the save-toast copy was changed to "Saved. Every bill page will now show you which of your delegates spoke — this does not change the simulated result." The live source still shows the original round-one text, unchanged, and it now contradicts two other pages that *were* corrected: `/how-it-works` explicitly says a saved list does **not** move the simulated result, and `/methodology`'s "obvious one" limitation card says the same. The one surface a user actually sees right after clicking Save is the one place still telling them the opposite.

**Evidence:**

`src/components/delegation-editor.tsx:170`:
```js
setStatus({ kind: "ok", text: "Saved. Your list is live from the next tally." });
```

Contradicted by `src/app/how-it-works/page.tsx:462-466`:
> "Yours: if you sign in and build a list, it is saved and every bill page will show you which of your delegates ended up speaking for you. It does **not** move the simulated result. There are nowhere near enough real users for that to mean anything, and pretending otherwise would make the number worse, not better."

And by `src/app/methodology/page.tsx:723-726`:
> "And the obvious one. ... real users' delegations are recorded and shown back to them but are **excluded from the tally** — there are nowhere near enough of them for inclusion to mean anything."

So the site now has two pages telling a signed-in user their list has no effect on the number, and one component telling them, at the moment they act, that it does ("live from the next tally"). This is worse than round one's version of the bug: round one had one overclaiming sentence, this pass added two correct, honest sentences elsewhere and left the incorrect one standing, so the contradiction is now visible to anyone who saves a list and then reads how-it-works.

**Suggested fix:** apply the exact replacement text `resolutions.md` already describes: `"Saved. Every bill page will now show you which of your delegates spoke — this does not change the simulated result."` One string, one file.

---

### R2 — `/parties/blank-vote` still asserts the AI is given an instruction "for every bill it is shown," one screen below saying the opposite (severity: high)

**What's wrong:** `resolutions.md` states P9 item 3 was "Resolved" by suppressing the "literal instruction" sentence when `party.isBlank`. The sentence is not suppressed — it renders unconditionally for every party, including the blank vote, directly under the two paragraphs of `party.stance` copy. On the same page, the `Record` component correctly says the blank party is "never put to the model at all." The two claims sit on the same rendered page for `/parties/blank-vote`, one above the other, and disagree.

**Evidence:**

`src/app/parties/[slug]/page.tsx:165-169`, rendered for every party with no `isBlank` guard:
```jsx
<p className="mt-4 text-sm text-[var(--bd-muted)]">
  Those two paragraphs are not a summary. They are the literal instruction the AI
  delegate is handed for every bill it is shown — nothing else about this party is
  given to it.
</p>
```

`src/app/parties/[slug]/page.tsx:96-99`, the same page, further down:
```jsx
<p className="mt-6 text-[15px] leading-relaxed">
  Blank on all {seen} bills it has been shown, by construction — it is never put to
  the model at all.
</p>
```

Confirmed live: `curl -s http://localhost:3117/parties/blank-vote` returns both sentences in the same document — "the literal instruction the AI delegate is handed for every bill it is shown" followed later by "it is never put to the model at all."

**Suggested fix:** the fix `resolutions.md` already specifies — gate the paragraph at line 165 on `!party.isBlank`, the same flag `Record` already receives and branches on two components away.

---

### R3 — Methodology page: "31 human delegates" next to a dynamic "32" four lines later, in the same limitation card (severity: medium)

**What's wrong:** the roster grew to 32 voting parties when the Public Investment Party was added (`resolutions.md` D6). `CLASSIFIABLE` (`src/app/methodology/page.tsx:38`, `const CLASSIFIABLE = PARTIES.filter((p) => !p.isBlank).length;`) is the derived constant this page uses everywhere else specifically so prose doesn't go stale when the roster changes — it is used correctly four times, including once inside the very same limitation card, four lines after a sentence that was left as a typed-in literal and never updated.

**Evidence:**

`src/app/methodology/page.tsx:635`:
```jsx
<p className="font-semibold text-[var(--bd-navy)]">
  One AI model stands in for 31 human delegates.
</p>
```

`src/app/methodology/page.tsx:639`, same card, four lines down:
```jsx
so its blind spots are correlated across all {CLASSIFIABLE} parties rather
than cancelling out the way disagreement between real organisations would.
```

Live render confirms the mismatch: `curl -s http://localhost:3117/methodology` shows "One AI model stands in for 31 human delegates" and, in the same paragraph block, "blind spots are correlated across all 32 parties." This is the same class of bug as round one's P14 (roster-count literal vs. derived count), reintroduced at a new site after the P14 fix was applied everywhere else on this page — a parallel-edit miss, not a repeat of the original finding (the three other prose sentences in this exact section already correctly use `{CLASSIFIABLE}`).

**Suggested fix:** `One AI model stands in for {CLASSIFIABLE} human delegates.`

---

## What holds up

The three-state model (voted / silent / unreached) is now consistently implemented and styled across the home page, `/how-it-works`, and the bill detail page, with no leftover two-state "abstains" framing anywhere I checked. The zero-cast tally state (`cast === 0`) is handled as a genuine third outcome, not a fake "0.0%," on both `/bills` and `/bills/[id]`, including a distinct hatched fill in `VoteBar`. `sortContributions()` is now shared between the vote bar and its legend, so they agree. The encryption/privacy story is honest and identically worded across `/delegate` (signed-in and signed-out) and `/methodology` — this is the one overclaim-prone area that a second pass actually landed everywhere except the save toast (R1). The party-hue-as-label-text contrast issue is gone (`party-chip.tsx`), and there is now one global `:focus-visible` rule instead of a single component doing it right in isolation.
