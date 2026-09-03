# Closer Congress — Build Plan

A demonstration of **liquid, issue-scoped democracy**: citizens vote on real US federal
legislation directly, or delegate to an *ordered list* of single-issue parties. A party
that doesn't care about a bill **abstains**, and the vote falls through to the next party
in the citizen's list. Real bills, real outcomes, simulated electorate.

Production URL: `https://closercongress.vercel.app`

---

## Architecture

```
 Congress data source ──(Vercel cron, daily)──► bills table  ──┐
                                                               │
 scripts/classify.ts ──(local, `claude -p --model haiku`)───────┤
   one prompt per bill, all parties at once                     │
   → plain-language summary + per-party vote/abstain + reason   │
                                                               ▼
 synthetic electorate (10k citizens, ordered party lists) ► tally engine ► bill_results
                                                               │
                                          Next.js App Router ◄─┘
                                          Auth.js + Google OAuth
                                          client-encrypted delegations
```

**Why classification runs locally:** the Claude subscription on this laptop is used
instead of an API key, so the model can only be invoked from this machine. Vercel's cron
ingests new bills automatically; `npm run classify` fills in the AI columns. See T-14.

---

## Ticket graph

Legend: `→` depends on. Tickets marked **[CRITIQUE]** are self-review passes: an agent
reads the work done so far, writes findings to `CRITIQUES.md`, and a follow-up ticket
acts on them. All critique + fix rounds land **before** any ticket that needs Victor.

### Phase 0 — Foundations
- ✅ **T-01** Scaffold Next.js 16 (App Router, TS, Tailwind 4), blue government theme,
  Vercel Analytics + Speed Insights.
- ✅ **T-02** Provision Postgres (Vercel Marketplace / Neon), write schema + migrations.
  → T-01
- ✅ **T-03** Research: US legislation data sources (Congress.gov API, clerk.house.gov &
  senate.gov roll-call XML). Pick one, document the recipe. *(parallel)*
- ✅ **T-04** Research: real US public-opinion survey data per issue axis + salience +
  Pew political-typology clustering. *(parallel)*

### Phase 1 — Domain content
- ✅ **T-05** Define the party roster: ~28 single-issue parties spanning ~15 axes, 2–3
  sides each, plus the **Blank Vote** party (always abstains; terminal in every list).
  → T-04
- ✅ **T-06** Build the synthetic electorate: 10,000 citizens with ordered delegation
  lists, generated from the T-04 survey numbers + typology correlations. Deterministic
  seed, committed as data. → T-05
- ✅ **T-07** Bill ingestion: fetch the last 7 days of introduced/acted-on bills plus their
  real roll-call outcomes; upsert into `bills`. Runs as a script and as a Vercel cron.
  → T-02, T-03

### Phase 2 — The AI layer
- ✅ **T-08** Classification script: for each bill, ONE `claude -p --model haiku` call
  returning JSON — plain summary, key points, and a vote (`yes`/`no`/`abstain`) with a
  one-line rationale for every party. Idempotent, resumable, cheap. → T-05, T-07
- ✅ **T-09** Tally engine: walk each citizen's delegation list until a party casts a
  non-abstain vote; aggregate to yes/no/blank + per-party contribution breakdown;
  cache in `bill_results`. → T-06, T-08

### Phase 3 — Product surface
- ✅ **T-10** Auth: Auth.js v5 + Google OAuth (JWT sessions, no identity rows in the DB).
- ✅ **T-11** Delegation UI: pick and order your parties; payload encrypted so the database
  alone cannot reveal it (key derived from the Google subject, which is never stored;
  only a salted hash is). → T-10, T-05
- ✅ **T-12** Pages: `/` landing, `/bills`, `/bills/[id]` (summary → PDF → real vs simulated
  → per-party distribution → *your* vote and which party cast it), `/parties`,
  `/how-it-works`, `/me`. → T-09, T-11
- ✅ **T-13** Charts: population distribution, real-vs-simulated comparison, delegation
  fall-through visualisation.

### Phase 4 — Self-critique rounds (before anything needs Victor)
- **T-C1** ✅ **[CRITIQUE]** Data & simulation review — an agent audits the party roster,
  the electorate generator and the tally engine for realism, bias and correctness bugs.
  Findings → `critiques/data.md`. → T-09
- **T-C2** ✅ **[CRITIQUE]** Product & UX review — an agent audits the pages, copy, a11y,
  mobile layout and whether the core idea is actually legible to a first-time visitor.
  Findings → `critiques/product.md`. → T-13
- **T-C3** ✅ **[CRITIQUE]** Security & correctness review — auth flow, encryption threat
  model, cron auth, SQL, secret handling, error paths. Findings → `critiques/security.md`. → T-12
- **T-F1** ✅ Act on every finding in `critiques/`; each one is marked resolved or
  consciously deferred with a reason in `critiques/resolutions.md`.
  → T-C1, T-C2, T-C3
- **T-C4** **[CRITIQUE]** Second-pass review of the fixes → `critiques/round2-code.md`
  and `critiques/round2-product.md`. → T-F1
- **T-F2** Act on round-two findings. → T-C4

### Phase 5 — Ship
- **T-14** Deploy to Vercel as `closercongress`, wire env vars, verify the
  production Google OAuth callback, enable the daily ingestion cron.
- **T-15** Hand-off notes: how to re-run classification, how to add parties, the honest
  limits of the simulation.

### Needs Victor (human interaction — deliberately last)
- **H-1** Add the production redirect URI to the Google OAuth client.
- **H-2** Congress.gov API key (free, instant) if the chosen source requires one.
- **H-3** Final review of the party roster's fairness across the spectrum.
