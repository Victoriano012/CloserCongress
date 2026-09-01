# Critique — data & simulation

_Reviewed `src/lib/parties.ts`, `src/lib/electorate-model.ts`, `scripts/generate-electorate.ts`, `data/electorate-stats.json`, `data/electorate.json`, `src/lib/tally.ts`, `src/lib/results.ts`, `src/lib/classify.ts`, `src/lib/claude-cli.ts`, `scripts/classify.ts`, `scripts/tally.ts`, plus the pages that render their output, 2026-08-31._

All queries below were run against the live database on 2026-08-31 while the background classification job was mid-run. Where the *count* of classified bills matters I say so; every headline figure is a **rate**, which is unaffected by how far the job has got.

## Findings

### D1 — The ordering of a delegation, the entire premise of the site, changes 0.7% of votes (severity: high)

**What's wrong:** The site is a demonstration of *ordered* delegation: "the first party in the list with a non-abstain opinion casts that citizen's vote". For that ordering to mean anything, a citizen must sometimes hold two delegates who disagree, so that which one comes first decides the ballot. In the data as it stands that almost never happens. The delegation list is functioning as an unordered **set** — "is any party of mine voting?" — not as a ranking.

The 82% fall-through rate is a decoy. It is high only because 30 of 32 parties abstain on every bill, so of course your first pick is usually silent. Fall-through depth measures nothing about whether *order* matters.

**Evidence:** `/private/tmp/.../scratchpad/q2.ts` and `q3.ts`, walking `data/electorate.json` against every row of `party_votes`:

```
total citizen-casts across all classified bills: 57949
cast by FIRST choice: 10368 = 17.89%
fall-through (not first choice): 82.11%
depth histogram (0 = first choice):
  depth 0: 10368 (17.89%)   depth 1: 9442 (16.29%)   depth 2: 9159 (15.81%)
  depth 3: 8199 (14.15%)    depth 4: 6825 (11.78%)   depth 5: 5654 (9.76%)
  depth 6: 4017 (6.93%)     depth 7: 2708 (4.67%)    depth 8: 1577 (2.72%)
```

But the number that actually matters:

```
bills where at least one party voted yes AND another voted no: 6 of 40
bills where >=1 citizen holds two conflicting delegates: 5
citizen-bill pairs where ordering actually changes the vote: 2915
  = 5.030% of all casts | 0.7288% of all citizen-bill pairs
```

On **34 of 40** classified bills, every party that voted voted the same way, so a citizen's list order is provably irrelevant: shuffle every list in `electorate.json` and the tally is bit-identical. The mechanism the whole site exists to show is exercised for 0.73% of citizen-bill pairs.

Corroborating: `tally.ts` is bypassed entirely on single-voter bills. `119-hr-10155` has one voting party (`veterans-first`) and `cast = 2201`, exactly `veterans-first`'s `inList` count of `0.2201` from `data/electorate-stats.json`. Position in the list contributed nothing.

**Suggested fix:** This is a classifier problem, not a tally problem, and D2/D4 are its causes — fix those first. Then add a permanent regression metric to `scripts/tally.ts`: the share of citizen-bill pairs on which at least two non-abstaining delegates disagree. If that number is not in the 10–30% range the site is not demonstrating what it claims, and it should be visible on the methodology page rather than buried. Separately, stop reporting "fall-through depth" as evidence the mechanism works; it is not.

### D2 — 42.5% of classified bills have zero votes and are rendered as "Would fail — 0% in favour" (severity: high)

**What's wrong:** When no party casts a vote, `tally()` returns `yes: 0, no: 0, cast: 0, blank: 10000, passed: false` (`src/lib/tally.ts:120`, `passed: cast > 0 && yes / cast > 0.5`). `ensureResult` writes that row. The bills list then checks only `bill.yes_weight !== null && bill.no_weight !== null` (`src/app/bills/page.tsx:146`), which is true, and renders:

```
{bill.passed ? "Would pass" : "Would fail"} here — {Math.round((0 / Math.max(0 + 0, 1)) * 100)}% in favour of those who voted
```

i.e. **"Would fail here — 0% in favour of those who voted"** for a bill on which nobody voted. The detail page does the same at `src/app/bills/[id]/page.tsx:246-250`, where `pct(0, 0)` returns `0` by the guard at line 25.

`how-it-works` (line 373-376) is aware of the case — "if literally nobody casts a vote … the bill does not pass either" — but no page distinguishes it visually from a genuine defeat, and it is not rare.

**Evidence:**
```sql
select cast_n, count(*) as bills from (
  select bill_id, count(*) filter (where vote <> 'abstain') as cast_n
  from party_votes group by 1) t group by 1 order by 1;
-- [{"cast_n":"0","bills":"15"},{"cast_n":"1","bills":"13"},
--  {"cast_n":"2","bills":"7"},{"cast_n":"3","bills":"2"}]
```
(Re-run 20 minutes later against 40 bills: 17 with zero. The rate is stable at ~42%.)

```
119-hr-10151  yes_weight=0 no_weight=0 blank_weight=10000 passed=false
119-hr-10152  yes_weight=0 no_weight=0 blank_weight=10000 passed=false
119-hr-10158  yes_weight=0 no_weight=0 blank_weight=10000 passed=false   (and 14 more)
```

**Root cause, which is fixable:** 307 of 356 ingested bills have no CRS summary, and 57 of the 58 classified so far have none:

```sql
select (official_summary is not null) as has_summary, count(*) from bills group by 1;
-- [{"has_summary":false,"count":"307"},{"has_summary":true,"count":"49"}]

select (b.official_summary is not null), count(*) from bills b
 where exists (select 1 from party_votes v where v.bill_id=b.id) group by 1;
-- [{"has_summary":false,"count":"57"},{"has_summary":true,"count":"1"}]
```

And `src/lib/classify.ts:82` instructs the model, in exactly that case: *"Judge the bill from its title alone, and be correspondingly cautious: if the title does not make the content clear, most parties should abstain."* Every zero-vote bill has an opaque title — `BEDROCK Act`, `GRANITE Act`, `SRBIJA Act`, `SOUND Pesticide Research Act`, `For the relief of Maria Cordova.` — so the prompt is doing precisely what it was told, on 98% of its input.

**Suggested fix:** Three things. (a) Do not classify a bill with no `official_summary`; leave it in the "Not yet put to the delegates" state the list page already has, and re-run when the summary lands. (b) Give `tally()` a distinct state for `cast === 0` and render it as "No delegate had an opinion", never as "Would fail — 0%". (c) `scripts/classify.ts:96` orders by `latest_action_date desc` — the newest bills are exactly the ones CRS has not summarised yet. Order by summary availability first.

### D3 — Not one classified bill has a real congressional outcome, so the site's headline comparison is empty everywhere (severity: high)

**What's wrong:** The stated purpose is "the site shows the real congressional outcome next to the simulated one". There is currently no bill where both halves exist.

**Evidence:**
```sql
select b.real_outcome, count(*) from bills b
 where b.real_outcome <> 'pending'
   and exists (select 1 from party_votes v where v.bill_id = b.id) group by 1;
-- []   (empty)

select real_outcome, count(*) from bills group by 1;
-- [{"failed":1},{"pending":337},{"passed":18}]

select min(latest_action_date), max(latest_action_date) from bills where real_outcome <> 'pending';
-- lo 2026-08-08, hi 2026-08-10
select min(b.latest_action_date), max(b.latest_action_date) from bills b
 where exists (select 1 from party_votes v where v.bill_id=b.id);
-- lo 2026-08-20, hi 2026-08-27
```

The 19 decided bills are the *oldest* rows; `scripts/classify.ts:96` sorts `order by b.latest_action_date desc nulls last`, so they are last in the queue. The classifier is systematically working from the least-informative and least-comparable end of the corpus.

**Suggested fix:** In `scripts/classify.ts`, order by `(real_outcome <> 'pending') desc, (official_summary is not null) desc, latest_action_date desc`. Nineteen bills is a small enough set to classify by hand today and get the comparison working.

### D4 — Systematic, extreme classifier abstention; 17 of 32 parties have never voted, and two parties decide 43% of all ballots (severity: high)

**What's wrong:** Across 58 classified bills the model casts an average of **0.92 votes per bill out of 31 eligible parties** — below the floor the prompt itself sets ("on a typical bill only one to four parties have any stake"). More than half the roster has never had an opinion about anything, so a citizen's list is decorative for those parties.

**Evidence:**
```sql
select vote, count(*) from party_votes group by 1;
-- [{"no":12},{"abstain":1119},{"yes":21}]   -- 33 votes over 36 bills at the time
```
```sql
select party_slug, vote, count(*) from party_votes where vote <> 'abstain' group by 1,2 order by 3 desc;
balanced-budget       no   6      universal-healthcare yes 2   reproductive-freedom no  1
veterans-first        yes  5      housing-for-all      yes 2   climate-action       yes 1
low-tax               yes  3      traditional-family   yes 1   small-business       yes 1
rural-farmers         yes  2      digital-rights       yes 1   anti-corruption      yes 1
universal-healthcare  no   2      climate-action       no  1   strong-defense       yes 1
                                  small-business       no  1   tax-the-rich         no  1
                                                               free-market-health   yes 1
```
```sql
-- parties that have never cast a single vote (17 of 32, incl. blank-vote by design):
animal-welfare, border-security, catholic-values, energy-independence, equal-rights,
gun-safety, immigrant-rights, justice-reform, law-and-order, peace-party,
public-schools, right-to-life, school-choice, second-amendment, secular-state, union-labor
```

Share of all 57,949 citizen-casts by deciding party (`q2.ts`):
```
balanced-budget       15402 (26.6%)      strong-defense         2345 (4.0%)
veterans-first         9665 (16.7%)      rural-farmers          1910 (3.3%)
universal-healthcare   7511 (13.0%)      climate-action         1840 (3.2%)
anti-corruption        4292 (7.4%)       digital-rights         1791 (3.1%)
housing-for-all        4096 (7.1%)       reproductive-freedom   1677 (2.9%)
low-tax                3028 (5.2%)       tax-the-rich           1540 (2.7%)
                                         free-market-health     1122 (1.9%)
                                         small-business          983 (1.7%)
                                         traditional-family      747 (1.3%)
```
`balanced-budget` + `veterans-first` alone decide 43.3% of every ballot cast on the site. The simulation is presently a referendum between "the deficit party says no" and "the veterans party says yes".

**The prompt causes this, not the bills.** In `src/lib/classify.ts`:
- Line 111: *"**Abstaining is the normal outcome.** On a typical bill only one to four parties have any stake at all."* — an explicit low prior, stated in bold.
- Lines 132-135: abstention is the **free** output. Voting costs a JSON key plus a `"r"` justification; abstaining costs nothing and is the default for anything omitted. For a small model under length pressure that is a one-directional thumb on the scale.
- Line 113: the two worked examples of "not my business" name **`animal-welfare`** and **`catholic-values`** by slug — and those are two of the 17 parties that have never voted once. The only two parties named in the prompt as exemplars of abstention are among the most-abstaining in the data.
- Line 116: *"If a bill genuinely cuts across a party's scope in both directions, abstain rather than guess"* — a further one-way escape hatch, with no matching instruction to vote when the bill is clearly in scope.

**Is the abstention *partisan*-asymmetric?** Not in the left/right sense — of the 17 silent parties, roughly 8 read left (`gun-safety`, `immigrant-rights`, `justice-reform`, `public-schools`, `equal-rights`, `secular-state`, `union-labor`, `peace-party`) and 7 read right (`border-security`, `catholic-values`, `energy-independence`, `law-and-order`, `right-to-life`, `school-choice`, `second-amendment`). The asymmetry is **structural, not ideological**: the parties that survive are the ones whose scope attaches to a *procedural* feature present in almost every bill — cost (`balanced-budget`), a beneficiary group (`veterans-first`), a spending line (`housing-for-all`) — while every party defined by a *substantive* controversy is silent, because the corpus of newly-introduced, unsummarised bills contains almost no substantive controversy. See D6 for the roster-side half of this.

**Suggested fix:** Fix D2's summary problem first — this is largely downstream of it. Then rebalance the prompt: drop the "one to four" prior and the named-party examples, require the model to emit an explicit `"abstain"` with a reason for every party so both branches cost the same, and add the symmetric instruction ("if the bill is clearly inside a party's scope, it must vote"). Add a `scripts/classify.ts` assertion that flags any bill where fewer than one party votes, and a periodic report of parties with zero lifetime votes.

### D5 — The calibration diagnostic is circular; the population is ~3pp left of every poll it cites (severity: high)

**What's wrong:** Three distinct problems in one place.

**(a) The "achieved" column proves nothing.** `calibrate()` (`scripts/generate-electorate.ts:37-55`) solves the intercept so that the *participation-weighted* share equals `nationalA`. The diagnostic then measures the share among citizens who *participated* (`generate-electorate.ts:118`, `sideTally` incremented only after the `cares` test). Same weights, both times. `data/electorate-stats.json`'s `calibration` block can therefore only ever detect Monte Carlo noise and a broken bisection — it cannot detect a wrong tilt vector, a wrong salience, or a wrong participation model, which are the three things a reader would want it to validate. The methodology page presents it as validation anyway (`src/app/methodology/page.tsx:296-300`, "Sampling noise at n = 10,000 leaves the achieved shares within X percentage points of target at worst — see the table below").

**(b) The whole-population split misses every published number, always in the same direction.** Replicating the generator at N = 500,000 (`q6.ts`) to remove sampling noise:

```
axis                 target  achieved among DELEGATORS  achieved in WHOLE POPULATION  gap
reproductive-rights  0.600   0.5985                     0.6330                        +3.30pp
guns                 0.560   0.5606                     0.5943                        +3.43pp
climate              0.570   0.5694                     0.5985                        +2.85pp
immigration          0.580   0.5796                     0.6032                        +2.32pp
healthcare           0.640   0.6397                     0.6766                        +3.66pp
taxes                0.580   0.5810                     0.6149                        +3.49pp
equality             0.650   0.6511                     0.6787                        +2.87pp
religion             0.710   0.7105                     0.7404                        +3.04pp
labor                0.680   0.6783                     0.7095                        +2.95pp
criminal-justice     0.670   0.6694                     0.6921                        +2.21pp
foreign-policy       0.360   0.3630                     0.3887                        +2.87pp
education            0.520   0.5221                     0.5448                        +2.48pp
```

**12 of 12 axes, mean +2.96pp toward side A.** The mechanism: participation weight is `((1+turnout)/2) · min(salience·turnout/MEAN_TURNOUT, 0.95)`, which up-weights high-turnout groups; the three highest-turnout groups after Loyal Liberals are all on the right (No Apologies Right 0.83, Faith First 0.75, Pragmatic Right 0.68) while the three largest left groups are the three lowest-turnout (Order and Opportunity Left 0.46, Left-Out Left 0.42, Tuned-Out Middle 0.32). So the participating sample is right of the population, and the intercept must be pushed left to hit the target — which then over-shoots when applied to everyone.

**(c) The category error.** Every source cited in `AXES` is an **all-adult** poll: "60% say abortion should be legal", "56% want stricter firearm sales laws", "71% say religion should be kept separate". Those are being fitted to a **likely-voter** weighting. Given these turnout figures, the likely-voter split *should* differ from the all-adult split; the code forces them to be identical and then discards the all-adult number.

**(d) The docstring is false.** `src/lib/electorate-model.ts:26-28`: *"it is solved numerically so that the **population-weighted** result reproduces the published national split for that issue **exactly**. So the aggregate always matches reality."* It is participation-weighted, and the population-weighted aggregate is 2.2–3.7pp off on every axis. The methodology page (line 291) is honest about the weighting; the source file is not.

**Suggested fix:** Either calibrate against raw population weights and let the delegate split fall where it may (then the cited all-adult polls are being used correctly), or keep participation weighting and (i) fix the docstring, (ii) report **both** the delegator split and the whole-population split in `electorate-stats.json` and on the methodology page, and (iii) state that the displayed splits are a likely-voter electorate, not the national public. Whichever way, replace the tautological `achieved` column with something falsifiable — e.g. hold out one axis' national number, predict it from the tilts alone, and report the error.

### D6 — The roster's one-sided axes are a spending ratchet, and two stances are framed asymmetrically (severity: medium)

**What's wrong (twelve two-sided axes):** These are genuinely balanced in *count* — 12 left parties against 12 right parties, one pair per axis, no orphans. Two real framing asymmetries, in opposite directions, which partly but not fully cancel:

1. **`traditional-family` is the only party in 32 whose stance is written in the subjunctive.** `parties.ts:188`:
   > *"NO on measures **it sees as** displacing parents or redefining family."*

   Its opposite number, `equal-rights` (`parties.ts:178`):
   > *"YES on **anything that extends the same rights and protections to every group**; NO on anything that singles out a group for worse treatment."*

   One is given an objective, universalist test that almost any bill can be scored against; the other is given an explicitly subjective one ("it sees as"). No other stance in the file hedges. Both strings go verbatim into the prompt (`classify.ts:59`). The effect is visible: `equal-rights` sits in 13.81% of lists against `traditional-family`'s 8.07%, and its scope claims seven domains including the catch-alls "voting access" and "equal treatment under law" against `traditional-family`'s six narrow culture-war domains.

2. **Running the other way**, the absolutist framing lands on the right twice. `second-amendment` (`parties.ts:78`): *"NO on **any** new restriction on firearms"*; `low-tax` (`parties.ts:168`): *"NO on **any** tax increase, new tax or expanded IRS authority"* — where their counterparts are enumerated and bounded ("YES on background checks, waiting periods, red-flag laws"; "YES on higher taxes on top earners and corporations"). And two taglines flatter the right: `climate-action`'s "Cut emissions now, argue later" reads as dismissive of debate against `energy-independence`'s "Cheap, abundant, American-made energy".

**What's wrong (seven one-sided axes) — this is the bigger problem.** Only one of the seven ever votes against spending:

| party | stance direction | list share |
|---|---|---|
| `veterans-first` | always YES on benefits/funding | 22.0% |
| `rural-farmers` | always YES on farm support | 9.6% |
| `housing-for-all` | always YES on housing money | 23.3% |
| `anti-corruption` | always YES on new ethics rules | 42.9% |
| `animal-welfare` | always YES on new protections | 11.7% |
| `digital-rights` | always YES on new privacy limits | 17.9% |
| **`balanced-budget`** | **always NO on anything that adds to the deficit** | **28.7%** |

Six ratchets in one direction, one in the other. On any appropriations bill the outcome is decided by whether `balanced-budget` outnumbers the others in people's lists. That is not a neutral scaffold; it is a fiscal axis with the entire pro-spending side split across five parties and the anti-spending side concentrated in one. It is also exactly what the data shows (D4): `balanced-budget` decides 26.6% of ballots, `veterans-first` 16.7%, and the two disagree on almost everything.

The *composition* of the one-sided parties also leans right, via the `Math.exp(t * 0.5)` care term (D9). Mean left-right index of holders (`q7.ts`, national mean −0.015 on a −1…+1 scale):
```
balanced-budget -0.232   veterans-first -0.215   rural-farmers -0.230
housing-for-all +0.100   animal-welfare +0.037
anti-corruption -0.018   digital-rights -0.027   (both effectively neutral)
```
So the one-sided axes are *not* the non-partisan ballast the file's comment ("no organised opposing party exists on this site", `electorate-model.ts:214`) implies. Three of them are as partisan in composition as `strong-defense` (−0.252).

**Suggested fix:** (a) Rewrite `traditional-family`'s stance to the same declarative register as `equal-rights` and narrow `equal-rights`' scope so it stops claiming "voting access" (which duplicates `anti-corruption`) and "equal treatment under law" (which claims everything). (b) Rewrite `second-amendment` and `low-tax` off the word "any" for the same reason. (c) Add a genuine counterweight party on the spending axis — or, better, give the one-sided parties symmetric stances (e.g. `veterans-first` should vote NO on a bill that funds veterans by raiding another veterans' programme). (d) Stop describing the one-sided axes as non-partisan on the methodology page; report the composition lean above instead.

### D7 — Numbers presented as sourced that are actually reinterpretations or estimates (severity: medium)

**What's wrong:** `electorate-model.ts` sets `estimated: true` on 9 entries and the methodology page counts them (`page.tsx:46-47`) as a credibility claim. Several unflagged entries are as much of a leap as the flagged ones.

**Evidence, worst first:**
- **`foreign-policy`, `nationalA: 0.36`** (`electorate-model.ts:193`), sourced as *"Gallup, Feb 2026: 64% want the US to take a leading or major world role"*, i.e. `1 − 0.64`. "Major role in world affairs" is not the same construct as `peace-party`'s stance ("NO on military intervention, arms transfers and defence-budget growth; YES on war-powers limits") — a large fraction of "major role" respondents are diplomacy-first internationalists. Not flagged. This is the single largest source-to-model leap in the file and it drives `strong-defense` to being the third-largest party (23.5% of lists).
- **`foreign-policy`, `salience: 0.45`**, sourced as *"45% call terrorism and national security extremely important"*. Terrorism salience is being used for a peace-vs-defence axis. At 0.45 it is the second-highest salience of all 19 axes — above abortion (0.37), healthcare (0.37) and immigration (0.41) — which is not how US voters rank foreign policy in any published battery. Not flagged.
- **`taxes`, `salience: 0.40`**, sourced as *"36% taxes, 34% income distribution"*. The value is above both cited numbers with no stated arithmetic. Not flagged.
- **`equality`, `salience: 0.28`**, sourced as *"27% race relations, 18% transgender rights"*. Same issue, smaller.
- **`criminal-justice`, `nationalA: 0.67`** from *"67% prefer addressing root causes over strengthening law enforcement"* — mapped onto a party whose stance also covers the death penalty, mandatory minimums and drug decriminalisation. Not flagged.
- **`labor`, `nationalA: 0.68`** from *"68% approve of labour unions"* — union approval is not a preference for `union-labor` over `small-business` deregulation. Not flagged.
- **Five of the seven one-sided axes carry a `source` describing a national split the model never computes**, because `nationalA` is undefined for them and `calibrate()` is never called (`generate-electorate.ts:63`). E.g. `democracy`'s *"87% support congressional term limits"* is displayed in the methodology source column (`page.tsx:442`) next to a `—` in the national-split column, implying a citation for a number that does not exist.

Verified-plausible entries, for contrast: `climate` salience 0.21 ("last of 22 issues") and `democracy` salience 0.49 ("2nd of 22") both match Gallup's September 2024 battery; `guns` 0.56, `labor` 0.68, `healthcare` 0.64 are all within a point or two of the readings I know.

**Suggested fix:** Set `estimated: true` on `foreign-policy` (both), `taxes` salience, `equality` salience, `criminal-justice` and `labor` splits. Give `SourceNote` a third state — `derived`, for a real poll being mapped onto a different construct — and render it distinctly. Drop or relabel the `source` on one-sided axes so the methodology table does not cite a number the model never uses.

### D8 — Non-transactional persist and no vote-content hash: two ways a bill is permanently wrong (severity: medium)

**What's wrong:** `scripts/classify.ts:39-62` issues three independent statements against a Neon HTTP connection with no transaction:

```ts
await sql.query(`insert into bill_ai ... on conflict do update ...`);      // 1
await sql.query(`insert into party_votes ... on conflict do update ...`);  // 2
await sql.query(`delete from bill_results where bill_id = $1`, [billId]);  // 3
```

**Path A — a bill permanently marked classified with no votes.** If (1) succeeds and (2) fails, `classifyOne` catches and retries the whole thing, but after three attempts it gives up (`classify.ts:73-77`) leaving `bill_ai` populated. The next run's default filter is `where not exists (select 1 from bill_ai a where a.bill_id = b.id)` (`classify.ts:95`), so the bill is skipped forever. It now has a plain-language summary on the site and no party votes at all — indistinguishable, on the page, from a bill everyone abstained on. Only `--force` recovers it, and nothing surfaces that it needs recovering.

**Path B — a permanently stale cached tally.** `ensureResult` (`src/lib/results.ts:38`) invalidates on exactly one condition: `hit.electorate_hash === ELECTORATE_HASH`. It never compares the cached result against the party votes it was handed. So the only thing that can invalidate a result after a *re-classification* is statement (3). If (2) succeeds and (3) fails, `bill_results` keeps the old tally, its `electorate_hash` still matches, and both `ensureResult` and `scripts/tally.ts` (`where r.bill_id is null or r.electorate_hash <> $1`, line 20) will skip it for ever. The page then shows a tally that does not correspond to the votes displayed underneath it on the same page.

The same gap opens for any out-of-band change to `party_votes` — a manual SQL fix, a partial re-run, a roster edit.

**Suggested fix:** Add a `votes_hash` column to `bill_results`, computed from the sorted `(party_slug, vote)` pairs, and make `ensureResult` recompute when either hash differs. That removes the need for statement (3) entirely and closes both paths. Separately, write `bill_ai` **after** `party_votes`, or make the classify filter `not exists (select 1 from party_votes …)` so a partial write self-heals.

### D9 — Two sources of truth for the party list; adding a party silently corrupts saved delegations (severity: medium)

**What's wrong:** `sanitizeDelegation` validates user input against `PARTY_BY_SLUG`, built from `src/lib/parties.ts` (`src/lib/delegation.ts:26`). `tally()` and `resolveForDelegation` index against `PARTY_SLUGS`, read from the *frozen snapshot* baked into `data/electorate.json` at generation time (`src/lib/tally.ts:37`). These are the same today (verified: both 32 entries, identical order), but nothing enforces it.

If a party is added to `parties.ts` without regenerating the electorate:
- `sanitizeDelegation` accepts it and stores it in the user's vault;
- `toVoteArray` never produces a vote for it, so it can never vote;
- `resolveForDelegation`'s `.filter((i) => i >= 0)` (`tally.ts:133`) **silently drops it** from the user's list, so the "which of your delegates spoke for you" answer on the bill page and `/me` is computed against a different list than the one the user saved and sees in the editor.

No error, no warning, no visible symptom. Ordering itself is safe — `.map().filter()` preserves order and duplicates are stripped upstream — so this is purely the drift hazard, but it is a silent-wrong-answer hazard for the one part of the site that involves real people.

**Suggested fix:** At module load in `tally.ts`, assert that `electorate.parties` deep-equals `PARTIES.map(p => p.slug)` and throw at build time if not. Cheap, and it converts a silent corruption into a failed build.

### D10 — `Math.exp(t * 0.5)` gives `tilt` two incompatible meanings, and it is the sole source of the one-sided parties' partisan lean (severity: low)

**What's wrong:** `generate-electorate.ts:112-115`:
```ts
const cares = axis.partyB
  ? axis.salience * engagement
  : axis.salience * engagement * Math.exp(t * 0.5);
```
For a two-sided axis `tilt` is a **log-odds shift on which side you take**, consumed through `sigmoid()`. For a one-sided axis the identical field is a **multiplicative factor on a probability**, consumed through `exp(t/2)` — a different link function, an unstated half-scale, and unbounded above (only `Math.min(cares, 0.95)` catches an overflow, silently). Nothing in the type, the field's doc comment (`electorate-model.ts:98`, "Per-group log-odds tilt toward side A (or, one-sided, toward caring)") or the methodology page says the units differ; the doc comment actively says they are the same ("log-odds"). The author clearly knew they were not — the one-sided tilts are authored on a −0.7…+1.0 scale against the two-sided −3.0…+2.8 — but that is convention, not enforcement.

Concrete effect: `+1.0` multiplies care probability by 1.65, `−0.6` by 0.74 — a 2.2× spread. That term is the entire cause of the composition lean documented in D6 (`balanced-budget` −0.232, `veterans-first` −0.215, `rural-farmers` −0.230 vs a national mean of −0.015). Remove it and all seven one-sided parties would be composition-neutral. The `0.5` is unexplained anywhere in the repo.

**Suggested fix:** Use the same link on both branches: `cares = sigmoid(logit(salience · engagement) + t)`, and split `tilt` into two named fields (`sideTilt` / `careTilt`) so the type makes the distinction impossible to get wrong. Document the scale on the methodology page since it materially changes who holds these parties.

### D11 — Unsourced structural constants: `(1 - turnout) * 0.5` and the 9-party cap (severity: low)

**What's wrong:**

**(a) The 0.5.** `generate-electorate.ts:26` and `:92` both use `(1 - group.turnout) * 0.5` — "half of each group's non-voters are modelled as delegating to the blank vote and nothing else". There is no source, no sensitivity analysis, and no discussion of what it implies. It implies that **simulated turnout can never exceed 79.3%** on any bill, and it is the second-largest driver of every result after classifier abstention: 20.7% of the electorate is hard-wired blank before a single bill is read (`data/electorate-stats.json`, `blankOnlyShare: 0.207`; large-N replication gives 20.17% from full abstainers plus ~0.5% from engaged citizens who happened to care about nothing). The methodology page (line 322-327) attributes the full 20.7% to full abstainers, which is off by that half-point. Halving or doubling the 0.5 moves every participation figure on the site by roughly ±10pp and nothing tests that.

**(b) The 9-cap binds more than it looks.** `generate-electorate.ts:123`, `picks.slice(0, 9)`. From the 500,000-citizen replication (`q6.ts`):
```
citizens over the 9 cap: 40066 (8.01%)
issues silently discarded: 68298 (2.78% of all issues someone cared about)
cared-count histogram: 8:9.40%  9:6.88%  10:4.36%  11:2.25%  12:0.96%  13:0.33%  14:0.10%
```
So 8% of citizens have at least one issue they cared about deleted without trace, and because list length scales with group turnout, the deletions are concentrated in the most engaged groups. Discarded issues are the low-salience tail (the race sorts them last), so this is not catastrophic — but "Lists are capped at nine delegates" (methodology, line 320) reads as a display convention rather than as data loss.

**(c) A related small bug:** `sideTally` is incremented *before* `slice(0, 9)` (`generate-electorate.ts:117` vs `:123`), so the `calibration.achieved` figures in `electorate-stats.json` describe an uncapped population that is never simulated. Measured discrepancy against the actual lists in `electorate.json` (`q10.ts`): +0.10pp to +0.89pp, worst on `climate` (reported 0.5636, actual 0.5725) and `religion` (0.7230 vs 0.7283). Small, but the number on the page is not the number in the file.

**Suggested fix:** Move `sideTally` after the slice. Promote the `0.5` to a named, documented constant in `electorate-model.ts` with the sensitivity stated, and report on the methodology page how much of `blankOnlyShare` comes from full abstainers versus engaged-but-uninterested citizens. Raise the cap to 19 (there is no performance reason for 9 — see "What holds up") or state the loss rate.

### D12 — Typology shares sum to 1.01 and `MEAN_TURNOUT` is not renormalised (severity: low)

**What's wrong:** `TYPOLOGY` shares are `0.09 + 0.12 + 0.12 + 0.11 + 0.09 + 0.18 + 0.12 + 0.11 + 0.07 = 1.01`. The generator renormalises for *sampling* (`generate-electorate.ts:71`, `acc += g.share / shareTotal`) but `MEAN_TURNOUT` (`electorate-model.ts:292`) does not:

```
share sum: 1.01
MEAN_TURNOUT (as coded):            0.6034
MEAN_TURNOUT (share-normalised):    0.5974
```

`engagement = group.turnout / MEAN_TURNOUT` therefore normalises the average citizen to 0.990, not the 1.0 its comment claims ("used to normalise engagement to 1.0 nationally"), and every `cares` probability is ~1% low. The methodology page prints `0.60` as "the national mean" (line 312). The effect on results is negligible; the effect on the claim "the file documents where every number comes from" is not — Pew does not publish shares summing to 101%, so at least one of the nine has been adjusted without a note.

**Suggested fix:** `MEAN_TURNOUT = Σ(share·turnout) / Σ(share)`, and either correct the shares to sum to 1.00 or add a comment saying which figure was rounded and why.

## What holds up

Things I specifically went looking for a bug in and did not find one:

- **`resolve()` is correct on every delegation shape I could construct** (`src/lib/tally.ts:60-70`). Blank in the middle terminates the walk, as designed and as `sanitizeDelegation` guarantees; blank absent entirely falls out of the loop and still returns `{ party: BLANK_INDEX, vote: "abstain" }`. There is no shape that returns a wrong party or crashes.
- **`resolveForDelegation` does not reorder or duplicate.** `.map().filter()` preserves order, and `sanitizeDelegation` strips duplicates and caps at 10 before anything is stored. The only hazard is roster drift (D9), not the mapping itself.
- **`citizen.slice(1)` is not a performance problem.** Measured: 50 full tallies of 10,000 citizens in 14ms, **0.28ms per bill**. A full recompute of all 356 bills is ~100ms. The allocation is irrelevant at these sizes; leave it alone.
- **The pass rule is right and consistent with the prose.** `cast > 0 && yes / cast > 0.5` (`tally.ts:120`) makes an exact tie fail and zero-cast fail, which is exactly what `how-it-works` (lines 372-376) says. Blanks are outside the denominator, which matches "Abstaining lowers participation; it does not raise the bar". The only problem is the *presentation* of the zero-cast case (D2), not the rule.
- **The exponential race works and does not collapse to a sort.** `-Math.log(rand()) / salience` is a correct Plackett-Luce sampler with weights equal to salience. Measured on the real `electorate.json`: of 7,762 lists with ≥2 entries, only **541 (6.97%)** are exactly sorted by salience descending, and **40.55%** of within-list pairs are discordant against 50% for a uniform random shuffle. `P(party is first | party in list)` ranges from 7.7% (`rural-farmers`, salience 0.12) to 23.7% (`peace-party`, 0.45) — a real but gentle 3× gradient. The claim "a higher-salience issue tends to sort earlier but not always" is accurate, if anything understated: the ordering is nearly random.
- **Independence-given-group is not as damaging as I expected.** Every issue is drawn independently conditional on typology group, but the group tilts alone generate realistic within-person constraint. Measured φ coefficients among citizens holding both axes (`q5.ts`): abortion~guns **0.447**, guns~climate **0.492**, abortion~taxes **0.394**, healthcare~equality **0.394**, immigration~crime **0.320**, taxes~labor **0.264**. Those sit inside the range real issue-constraint studies report (~0.3–0.5), which is more than the model had any right to get from a 9-group mixture. Impossible combinations are genuinely impossible (0 citizens hold both `tax-the-rich` and `low-tax`, or both `gun-safety` and `second-amendment`), and cross-cutting ones occur at plausible rates (182 citizens hold both `union-labor` and `low-tax`, 1.8%).
- **Reproducibility is real.** `mulberry32` seeded from `ELECTORATE_SEED` plus the SHA-256 fingerprint over `payload.citizens` means the electorate genuinely rebuilds from source, and I reproduced the published `blankOnlyShare` (20.17% vs 20.70%) and `averageDelegates` (5.77 vs 5.77) exactly from an independent replication of the generator.
- **The bisection is sound.** `weighted(c)` is strictly monotone increasing in `c`, and 200 iterations over ±12 converges to ~1e-58, far past double precision. It solves what it says it solves — the complaint in D5 is about *what* it is being asked to solve, not the solver.
- **`extractJson` is a genuinely careful parser.** It handles fences, string escapes and nesting correctly, and `parseClassification` defaults every party to abstain before overlaying the model's output, drops unknown slugs, and hardcodes the blank party. The failure mode it cannot detect — a valid-looking response with an empty `votes` object — is a prompt problem (D4), not a parsing one.
- **The roster is balanced by count.** Twelve two-sided axes, each with exactly one left and one right party, no orphans, no axis with two parties on the same side. That is more discipline than most attempts at this manage, and the framing problems in D6 are edits to two or three strings, not a structural rebuild.
