# Closer Congress

A working demonstration of what the legislative branch could look like if you
could vote on the laws yourself — or hand your vote to **several** delegates, in
order, instead of buying one whole ideology as a bundle.

Live at **https://closerdemocracy.vercel.app**

## The idea

Every citizen holds an *ordered list* of single-issue parties. When a bill comes
up, the first party in the list that has an opinion casts that citizen's vote.
Parties abstain on everything outside their own subject — the Animal Welfare
party has nothing to say about a religious holiday, so the vote falls through to
whatever the citizen put second.

That fall-through is the whole point. It is what lets someone put an animal-rights
party first without letting it speak for them on tax policy. The cost is real and
deliberate: a party stays silent on a subject even when its members, as people,
would have had a strong view.

The **Blank Vote** party terminates every list. If nobody above it has an
opinion, the vote is recorded as blank — present, but not counted in the
majority. It can also be someone's only entry, which is how "I don't want to vote
at all" is expressed without disappearing from the count.

A bill passes on a majority of the votes actually **cast**: `yes / (yes + no) > 0.5`.
Blanks lower participation, not the bar.

## What is real and what is not

| Real | Simulated |
| --- | --- |
| The bills, their text, sponsors and PDFs | The 32 parties, plus the blank vote |
| The real congressional outcomes and roll calls | The 10,000 citizens |
| Your own delegation list, if you sign in | Every party's vote (cast by an AI model) |

Real users' delegations are stored and shown back to them, but they do **not**
affect the simulated result. There are nowhere near enough users for that to mean
anything, and pretending otherwise would be dishonest.

## Architecture

```
GovTrack ──┐
govinfo ───┼─► scripts/ingest.ts ──► Neon Postgres ──► Next.js on Vercel
clerk/LIS ─┘   (also a daily cron)        ▲
                                          │
              npm run classify ───────────┘   (runs on a laptop, not on Vercel)
              └─ Claude Code CLI, haiku, one prompt per bill
```

**Why classification runs locally.** The AI delegate uses the Claude subscription
already logged in on this machine through the Claude Code CLI — there is no API
key anywhere in this project, by design. That subscription cannot travel to a
Vercel function, so ingestion runs on the server and classification runs here.
See `src/lib/claude-cli.ts`.

## Running it

```bash
npm install
vercel env pull            # DATABASE_URL, AUTH_*, VAULT_PEPPER, CRON_SECRET
npm run migrate            # apply db/schema.sql and seed the party roster
npm run ingest -- --days 7 # pull recent bills + refresh in-progress ones (the cron does this daily at 4:00 AM ET)
npm run classify           # ask the AI how each party votes — slow, resumable
npm run tally              # precompute the simulated result for every bill
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run migrate` | Applies `db/schema.sql`, upserts `src/lib/parties.ts` into `parties`. |
| `npm run ingest` | `--days N --congress N --limit N`. Pulls recently active bills, then re-checks every stored in-progress bill and persists any new passed/failed outcome. Idempotent; safe to re-run. Vercel runs it daily at `0 8 * * *` UTC = 4:00 AM Eastern (EDT). |
| `npm run classify` | `--limit N --concurrency N --force --model haiku`. Skips bills already classified. Deletes the cached tally when it reclassifies. |
| `npm run electorate` | Regenerates `data/electorate.json` from the seed. Changes the electorate hash, which invalidates every cached tally. |
| `npm run tally` | Fills `bill_results` for anything classified but not yet tallied. |

Classification takes roughly a minute per bill and is the slow step. It is
resumable: kill it and re-run, and it picks up the bills with no `bill_ai` row —
`party_votes` is written before `bill_ai` precisely so that a bill interrupted
mid-write is retried rather than marked done and empty. Bills with a real roll
call are classified first, so the real-vs-simulated comparison fills in before
the long tail of newly introduced bills.

It also shares the laptop's Claude subscription, so it is subject to that
subscription's session limits. If a run reports a wall of `claude exited 1`
failures, that is the limit, not a bug: wait for the reset and re-run.

## Changing the party roster

`src/lib/parties.ts` is the single source of truth. It seeds the database, colours
the UI, and — importantly — its `scope` and `stance` strings are handed to the AI
**verbatim** as the delegate's instructions. Editing that prose changes how the
party votes.

After editing: `npm run migrate`, then `npm run classify -- --force` to re-vote
every bill under the new roster.

Adding a party is additive and safe. Removing one will orphan existing
`party_votes` rows (the foreign key cascades) and will silently drop that party
out of users' saved delegations, since `sanitizeDelegation` discards unknown
slugs.

## Privacy

Sessions are JWT-only — there is deliberately no database adapter, so signing in
writes no identity row anywhere. The Google subject identifier lives only inside
the encrypted session cookie. The vault row is keyed by a salted one-way hash of
that subject, and the delegation list is encrypted with a key derived from the
subject itself. A dump of the database, on its own, decrypts to nothing.

See `src/lib/crypto.ts` and the threat model in `critiques/security.md`.

## The honest limits

- One AI model stands in for 32 human delegates and brings its own biases to all
  of them at once.
- The electorate is calibrated to published **marginal** splits per issue. Real
  opinion is correlated within a person in ways this does not capture.
- Several salience figures are estimated rather than published; the methodology
  page flags exactly which.
- Delegation *orderings* are a modelling assumption with no survey behind them.
- Bills are judged from their title and official summary, not their full text.
  Congress often publishes neither for weeks after introduction, so recently
  introduced bills are frequently judged on a title alone — and the parties
  correctly abstain when a title says nothing.
- This simulates a legislature with no amendments, no negotiation and no
  procedure. Real legislating is mostly those three things.

## Layout

```
src/lib/parties.ts           the roster: 32 delegates + the blank vote (source of truth)
src/lib/electorate-model.ts  Pew typology groups, issue axes, salience, sources
src/lib/tally.ts             the simulation: walk the list, first opinion wins
src/lib/classify.ts          the one-shot prompt that produces every party's vote
src/lib/congress.ts          fetching and parsing the public bill sources
src/lib/crypto.ts            the delegation vault
data/electorate.json         10,000 generated citizens, deterministic from a seed
critiques/                   self-review findings (round one, round two) and
                             resolutions.md: every finding, resolved or deferred
PLAN.md                      the ticket graph this was built from
```
