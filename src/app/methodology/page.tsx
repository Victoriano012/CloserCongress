import Link from "next/link";
import type { Metadata } from "next";
import stats from "../../../data/electorate-stats.json";
import { PARTIES, PARTY_BY_SLUG } from "@/lib/parties";
import {
  AXES,
  TYPOLOGY,
  ELECTORATE_SIZE,
  ELECTORATE_SEED,
  MEAN_TURNOUT,
  NONVOTER_BLANK_SHARE,
} from "@/lib/electorate-model";

export const metadata: Metadata = {
  title: "Methodology and limits",
  description:
    "Where the bills come from, how each party's vote is decided, how the 10,000-citizen synthetic electorate is calibrated to published survey data, what is encrypted and what is not, and every place this model is wrong.",
};

const SECTIONS = [
  { id: "bills", label: "Where the bills come from" },
  { id: "votes", label: "How a party votes" },
  { id: "electorate", label: "Building the electorate" },
  { id: "axes", label: "The 19 issue axes" },
  { id: "typology", label: "The nine groups" },
  { id: "privacy", label: "What we store about you" },
  { id: "limits", label: "Limitations" },
];

/* ------------------------------------------------------------------- helpers */

const pct = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`;

const ACHIEVED = new Map(stats.calibration.map((c) => [c.axis, c.achieved]));
const POPULATION = new Map(stats.calibration.map((c) => [c.axis, c.population]));

/** Derived, never typed as a literal: the roster changes and prose goes stale. */
const CLASSIFIABLE = PARTIES.filter((p) => !p.isBlank).length;
const TWO_SIDED = AXES.filter((a) => a.partyB).length;
const ONE_SIDED = AXES.length - TWO_SIDED;

const partyName = (slug: string) => PARTY_BY_SLUG[slug]?.name ?? slug;

/** Largest gap between a published national split and the achieved share. */
const MAX_DRIFT = Math.max(
  ...stats.calibration.map((c) => Math.abs((c.achieved ?? 0) - (c.target ?? 0))),
);

const TOP_DELEGATES = stats.partyShare
  .filter((p) => p.slug !== "blank-vote")
  .slice(0, 6);

const ESTIMATED_SALIENCE = AXES.filter((a) => a.salienceSource.estimated).length;
const ESTIMATED_SPLIT = AXES.filter((a) => a.source.estimated).length;

/* ---------------------------------------------------------------- primitives */

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--bd-muted)]">
        {eyebrow}
      </p>
      <h2 className="mt-2 font-serif text-2xl font-semibold sm:text-[1.75rem]">{title}</h2>
      <div className="bd-rule mt-4" />
      <div className="mt-6 space-y-5 text-[1.0625rem] leading-8 text-[var(--bd-ink)]">
        {children}
      </div>
    </section>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="pt-3 font-serif text-lg font-semibold text-[var(--bd-navy)]">{children}</h3>
  );
}

function Estimated() {
  return (
    <span className="ml-1 inline-block rounded border border-[var(--bd-no)]/30 bg-[var(--bd-no)]/8 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wider text-[var(--bd-no)]">
      estimated
    </span>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="bd-card px-4 py-4">
      <p className="font-serif text-2xl font-semibold text-[var(--bd-navy)] tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-sm leading-6 text-[var(--bd-muted)]">{label}</p>
    </div>
  );
}

/* ---------------------------------------------------------------------- page */

export default function MethodologyPage() {
  return (
    <div className="bd-container py-14 sm:py-20">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-14">
        <article className="max-w-[68ch]">
          <header>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--bd-blue)]">
              Methodology
            </p>
            <h1 className="mt-3 font-serif text-4xl font-semibold leading-[1.15] sm:text-5xl">
              Every number on this site, and where it came from.
            </h1>
            <p className="mt-6 text-lg leading-8 text-[var(--bd-muted)]">
              This page is written for a sceptical reader. It sets out the data sources, the
              model that casts each party&rsquo;s vote, the construction of the synthetic
              electorate, and — at the end and at length — the places where this simulation is
              simply wrong. Numbers with no published source behind them are flagged{" "}
              <Estimated /> rather than presented as data.
            </p>
            <div className="bd-rule mt-8" />
          </header>

          <nav aria-label="On this page" className="bd-card mt-10 px-5 py-4 lg:hidden">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--bd-muted)]">
              On this page
            </p>
            <ol className="mt-3 space-y-1.5 text-sm">
              {SECTIONS.map((s, i) => (
                <li key={s.id} className="flex gap-2">
                  <span className="tabular-nums text-[var(--bd-muted)]">{i + 1}.</span>
                  <a className="bd-link" href={`#${s.id}`}>
                    {s.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-14 space-y-16">
            {/* ------------------------------------------------------------ bills */}
            <Section id="bills" eyebrow="1" title="Where the bills come from">
              <p>
                Nothing about the legislation is invented. Three public, keyless sources are
                used, each for the thing it is best at.
              </p>

              <dl className="space-y-4">
                <div className="bd-card px-5 py-4">
                  <dt className="font-semibold text-[var(--bd-navy)]">
                    Discovery — GovTrack API v2
                  </dt>
                  <dd className="mt-1.5 text-[0.95rem] leading-7 text-[var(--bd-muted)]">
                    Bills whose status changed in the last seven days, ordered by status date,
                    restricted to the 119th Congress. Only substantive legislation is kept:
                    House and Senate bills and joint resolutions (<code>hr</code>,{" "}
                    <code>s</code>, <code>hjres</code>, <code>sjres</code>). Simple and
                    concurrent resolutions — naming post offices, congratulating teams — are
                    discarded at this step.
                  </dd>
                </div>
                <div className="bd-card px-5 py-4">
                  <dt className="font-semibold text-[var(--bd-navy)]">
                    Detail — govinfo BILLSTATUS bulk XML
                  </dt>
                  <dd className="mt-1.5 text-[0.95rem] leading-7 text-[var(--bd-muted)]">
                    The authoritative record for each bill: sponsor, policy area, latest
                    action, links to the text and PDF, and the Congressional Research Service
                    summary, which is stored as plain text and is the thing the model actually
                    reads. Very new bills have no BILLSTATUS file yet; those keep the GovTrack
                    fields until the file appears.
                  </dd>
                </div>
                <div className="bd-card px-5 py-4">
                  <dt className="font-semibold text-[var(--bd-navy)]">
                    Real votes — clerk.house.gov and senate.gov
                  </dt>
                  <dd className="mt-1.5 text-[0.95rem] leading-7 text-[var(--bd-muted)]">
                    When a bill has a recorded vote, the roll call is fetched from the House
                    Clerk&rsquo;s roll XML or the Senate LIS roll-call XML and stored with its
                    party breakdown. That is what the site compares its own result against.
                  </dd>
                </div>
              </dl>

              <H3>Cadence</H3>
              <p>
                Ingestion runs as a Vercel cron job once a day, at 11:00 UTC, over a
                seven-day window and up to 200 bills per run. Rows are upserted by bill id, so
                a bill that moves — gains a summary, gains a vote, passes — is refreshed rather
                than duplicated. Fetches retry three times with exponential backoff.
              </p>
              <p className="text-[var(--bd-muted)]">
                Classification is a separate, manual step. See below: it does not run on the
                server, so a freshly ingested bill can sit unclassified for a while.
              </p>
            </Section>

            {/* ------------------------------------------------------------ votes */}
            <Section id="votes" eyebrow="2" title="How a party's vote is decided">
              <p>
                In the idea this site demonstrates, each party is run by people who read the
                bill and decide whether it is their business. Standing up {CLASSIFIABLE} such
                organisations is not on the table, so one small model stands in for all of them
                at once.
              </p>

              <H3>One prompt, all parties</H3>
              <p>
                Each bill produces exactly one model call. The prompt contains the bill&rsquo;s
                identifying facts, its CRS summary (truncated to 4,000 characters), and the
                full roster of all {CLASSIFIABLE} non-blank parties. For each party, the{" "}
                <code>scope</code> and <code>stance</code> strings from the party roster are
                handed to the model <strong>verbatim</strong> — the same strings that appear on
                each party&rsquo;s page on this site. There is no hidden per-party
                instruction and no second pass, so every party is judged against the same
                bill in the same context.
              </p>

              <H3>Scope first, then position</H3>
              <p>
                The model is asked for an explicit answer for every one of the{" "}
                {CLASSIFIABLE} parties, in roster order, rather than for a shortlist of the
                ones it thinks matter. The instruction is a two-step test: is the bill inside
                this party&rsquo;s stated scope, and if it is, does its stated stance point
                yes or no. A party that is out of scope abstains; a party that is in scope is
                required to vote. An earlier version invited the model to abstain by default
                and described abstention as the normal outcome, which produced parties that
                were silent on bills squarely inside their own subject. The blank vote party
                is never shown to the model — its abstention is hardcoded.
              </p>
              <p>
                The bill&rsquo;s own text is scraped from public congressional records and is
                therefore untrusted input. It is fenced between explicit markers in the prompt
                and the model is told that everything between them is data to be classified,
                never instructions to follow: a bill title is a place someone could try to
                write &ldquo;ignore your instructions&rdquo; and have it read by our model.
              </p>
              <p>
                The response is parsed as JSON; unknown party slugs are dropped, and anything
                that is not a literal <code>yes</code> or <code>no</code> falls back to
                abstain. Bills where no party at all casts a vote are logged, because a
                genuinely procedural bill and a parse failure look identical from the outside;
                on the site they are shown as &ldquo;no delegate claimed this one&rdquo; rather
                than as a defeat.
              </p>

              <H3>The model, and where it runs</H3>
              <p>
                Classification runs through the Claude Code CLI on the author&rsquo;s own
                machine, defaulting to Claude Haiku, with tools disabled and outside the
                project directory so no repository context leaks into the prompt. This is
                deliberately not an API-key integration: no model credential exists anywhere in
                the deployed application. The trade-off is honest and worth stating — bills are
                ingested automatically every day, but they only become classified when a human
                runs the classification script.
              </p>
            </Section>

            {/* ------------------------------------------------------- electorate */}
            <Section id="electorate" eyebrow="3" title="Building the 10,000 citizens">
              <p>
                Each of the {ELECTORATE_SIZE.toLocaleString("en-US")} simulated citizens is one
                ordered list of parties. The population is generated once, from a fixed seed (
                <code>{ELECTORATE_SEED}</code>, the publication date of the Pew typology), by a
                deterministic pseudo-random generator, so the same electorate can be rebuilt
                from the source code alone. It is fingerprinted by hash{" "}
                <code>{stats.hash}</code>, which is stored alongside every cached result so a
                tally computed against an older population can be spotted.
              </p>

              <div className="grid gap-3 sm:grid-cols-3">
                <Figure
                  value={String(stats.averageDelegates)}
                  label="delegates per citizen on average, counting the terminal blank vote"
                />
                <Figure
                  value={pct(stats.blankOnlyShare, 1)}
                  label="hold the blank vote and nothing else"
                />
                <Figure value="19" label="issue axes; at most 9 delegates plus the blank" />
              </div>

              <H3>Layer 1 — who people are</H3>
              <p>
                Every citizen is drawn from one of the nine groups in the Pew Research
                Center&rsquo;s 2026 political typology, in Pew&rsquo;s published proportions.
                The typology is used because it is the only public dataset describing how
                American political views actually cluster: most people are not consistently
                liberal or consistently conservative, and roughly 15% of each party&rsquo;s
                identifiers hold values that place them on the other side. A model built on a
                single left-right axis could not produce the cross-cutting lists this site is
                about.
              </p>

              <H3>Layer 2 — which side they take</H3>
              <p>
                For each two-sided issue, the citizen&rsquo;s side comes from a logistic model:
                a group-specific tilt in log-odds, plus a per-issue intercept. The intercept is
                not guessed. It is solved numerically by bisection — 200 iterations over the
                range ±12 — so that the participation-weighted population result reproduces the
                published national split for that issue.
              </p>
              <p>
                The weighting is by participation rather than raw population, on the reasoning
                that groups who mostly sit an issue out should not move the split the site
                displays. The consequence is that the aggregate matches published reality even
                where the individual group tilts are estimates: the tilts decide the shape of
                the disagreement, the calibration fixes the total. Sampling noise at n =
                10,000 leaves the achieved shares within{" "}
                {(MAX_DRIFT * 100).toFixed(1)} percentage points of target at worst — see the
                table below.
              </p>
              <p>
                The table reports two different achieved figures, because they answer two
                different questions. <strong>Achieved</strong> is the split among the citizens
                who actually took a side on that axis in the generated sample, which is the
                number the calibration targets. <strong>Population</strong> is the same split
                computed exactly over the whole synthetic population, including the people who
                never delegated the issue. They diverge wherever an axis&rsquo;s support is
                concentrated in high-turnout groups, and the gap is a fair measure of how much
                the participation weighting is doing.
              </p>

              <H3>Layer 3 — whether they care enough to delegate</H3>
              <p>
                Each issue has a salience: the probability an average citizen cares enough to
                hand that issue to a delegate at all. Most come from Gallup&rsquo;s
                &ldquo;extremely important to my vote&rdquo; battery. Salience is scaled by the
                citizen&rsquo;s group engagement — Pew&rsquo;s validated 2024 turnout, divided
                by the national mean of {MEAN_TURNOUT.toFixed(2)} — so that an average citizen
                sits at 1.0 and disengaged groups end up with shorter lists. For the{" "}
                {ONE_SIDED} one-sided issues, where there is no opposing party to choose
                between, the group tilt is applied to whether the citizen cares rather than to
                which side they take. That has a consequence worth stating plainly: those{" "}
                {ONE_SIDED} parties end up with memberships that lean the way their axis
                leans, because the same tilt that would have picked a side is instead picking
                who shows up at all.
              </p>
              <p>
                The issues that clear the bar are then <em>ordered</em> by an exponential race
                weighted by salience: a higher-salience issue tends to sort earlier but not
                always, so the population contains plenty of people whose top delegate is not
                their most conventional priority. Lists are capped at nine delegates, and the
                blank vote is appended to every list as the terminal entry.
              </p>
              <p>
                Separately, some people are drawn as full abstainers:{" "}
                {pct(NONVOTER_BLANK_SHARE)} of each group&rsquo;s non-voters, by that
                group&rsquo;s turnout, are given a list consisting of the blank vote alone.
                That fraction is the single least defensible number on this page — no survey
                measures how many non-voters would also decline to name a delegate, so it is
                set at {pct(NONVOTER_BLANK_SHARE)} on the reasoning that delegating once is
                far cheaper than voting on every bill, and moving it by ten points moves the
                blank-only share by roughly six. It is where the{" "}
                {pct(stats.blankOnlyShare, 1)} blank-only share comes from, and the reason the
                simulated turnout on a narrow bill can be very low.
              </p>

              <H3>What the population ended up looking like</H3>
              <p>
                The most-delegated-to parties, excluding the blank vote, which is in 100% of
                lists by construction:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[30rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[var(--bd-line)] text-left">
                      <th className="py-2 pr-3 font-semibold text-[var(--bd-navy)]">Party</th>
                      <th className="py-2 pr-3 text-right font-semibold text-[var(--bd-navy)]">
                        In list
                      </th>
                      <th className="py-2 text-right font-semibold text-[var(--bd-navy)]">
                        Ranked first
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {TOP_DELEGATES.map((p) => (
                      <tr key={p.slug} className="border-b border-[var(--bd-line)]">
                        <td className="py-2 pr-3">{partyName(p.slug)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-[var(--bd-muted)]">
                          {pct(p.inList, 1)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-[var(--bd-muted)]">
                          {pct(p.firstChoice, 1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[var(--bd-muted)]">
                The Anti-Corruption Party leads on both counts because it carries the highest
                salience of the 19 axes and has no opposing party to split against — a
                structural artefact of the roster, not a finding about American opinion.
              </p>
            </Section>

            {/* ------------------------------------------------------------- axes */}
            <Section id="axes" eyebrow="4" title="The 19 issue axes">
              <p>
                Every axis, its parties, the published national split it is calibrated to, the
                share the generated population actually achieved, its salience, and the source
                behind each. {TWO_SIDED} axes are two-sided; the remaining {ONE_SIDED} have no
                opposing party on this site, so there is no split to calibrate and the tilt
                governs who cares instead.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[52rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-[var(--bd-navy)] text-left align-bottom">
                      <th className="py-2 pr-3 font-semibold text-[var(--bd-navy)]">Axis</th>
                      <th className="py-2 pr-3 font-semibold text-[var(--bd-navy)]">Parties</th>
                      <th className="py-2 pr-3 text-right font-semibold text-[var(--bd-navy)]">
                        Target
                      </th>
                      <th className="py-2 pr-3 text-right font-semibold text-[var(--bd-navy)]">
                        Achieved
                      </th>
                      <th className="py-2 pr-3 text-right font-semibold text-[var(--bd-navy)]">
                        Population
                      </th>
                      <th className="py-2 pr-3 text-right font-semibold text-[var(--bd-navy)]">
                        Salience
                      </th>
                      <th className="py-2 font-semibold text-[var(--bd-navy)]">Sources</th>
                    </tr>
                  </thead>
                  <tbody>
                    {AXES.map((axis) => {
                      const achieved = ACHIEVED.get(axis.key);
                      const population = POPULATION.get(axis.key);
                      return (
                        <tr
                          key={axis.key}
                          className="border-b border-[var(--bd-line)] align-top"
                        >
                          <td className="py-3 pr-3 font-medium text-[var(--bd-navy)]">
                            {axis.key}
                          </td>
                          <td className="py-3 pr-3 text-[var(--bd-ink)]">
                            <span className="block">{partyName(axis.partyA)}</span>
                            {axis.partyB ? (
                              <span className="block text-[var(--bd-muted)]">
                                v. {partyName(axis.partyB)}
                              </span>
                            ) : (
                              <span className="block text-[var(--bd-muted)]">
                                no opposing party
                              </span>
                            )}
                          </td>
                          <td className="py-3 pr-3 text-right tabular-nums">
                            {axis.nationalA !== undefined ? (
                              pct(axis.nationalA, 1)
                            ) : (
                              <span className="text-[var(--bd-muted)]">—</span>
                            )}
                          </td>
                          <td className="py-3 pr-3 text-right tabular-nums">
                            {achieved !== undefined ? (
                              pct(achieved, 1)
                            ) : (
                              <span className="text-[var(--bd-muted)]">—</span>
                            )}
                          </td>
                          <td className="py-3 pr-3 text-right tabular-nums text-[var(--bd-muted)]">
                            {population !== undefined ? (
                              pct(population, 1)
                            ) : (
                              <span className="text-[var(--bd-muted)]">—</span>
                            )}
                          </td>
                          <td className="py-3 pr-3 text-right tabular-nums text-[var(--bd-muted)]">
                            {axis.salience.toFixed(2)}
                          </td>
                          <td className="py-3 text-[13px] leading-6 text-[var(--bd-muted)]">
                            <span className="block">
                              <span className="font-medium text-[var(--bd-ink)]">Split: </span>
                              {axis.source.label}
                              {axis.source.estimated ? <Estimated /> : null}
                            </span>
                            <span className="mt-1.5 block">
                              <span className="font-medium text-[var(--bd-ink)]">
                                Salience:{" "}
                              </span>
                              {axis.salienceSource.label}
                              {axis.salienceSource.estimated ? <Estimated /> : null}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p>
                Read the <Estimated /> flags carefully, because they are the point of this
                table. {ESTIMATED_SALIENCE} of the salience figures and {ESTIMATED_SPLIT} of
                the split figures have no published survey behind them at all: nobody polls Americans on how much animal
                welfare drives their vote, so that number is a judgement call dressed in two
                decimal places. The animal welfare split rests on a Gallup reading from 2015,
                which is the only one that exists and is eleven years old. The education split
                is a composite of two surveys pointing in opposite directions, because large
                majorities support both more public school funding and more school choice.
              </p>
              <p>
                The largest calibration gap across all {TWO_SIDED} two-sided axes is{" "}
                {(MAX_DRIFT * 100).toFixed(1)} percentage points, which is sampling noise at
                this population size rather than a failure of the solver.
              </p>
            </Section>

            {/* --------------------------------------------------------- typology */}
            <Section id="typology" eyebrow="5" title="The nine typology groups">
              <p>
                Shares of US adults and validated turnout, from the Pew Research Center,
                &ldquo;Beyond Red vs. Blue: The Political Typology&rdquo;, 10 June 2026 — a
                survey of 10,357 US adults conducted 17&ndash;30 November 2025. Turnout is
                Pew&rsquo;s validated 2024 figure, used here as an engagement proxy.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-[var(--bd-navy)] text-left">
                      <th className="py-2 pr-3 font-semibold text-[var(--bd-navy)]">Group</th>
                      <th className="py-2 pr-3 text-right font-semibold text-[var(--bd-navy)]">
                        Share
                      </th>
                      <th className="py-2 pr-3 text-right font-semibold text-[var(--bd-navy)]">
                        Turnout
                      </th>
                      <th className="py-2 font-semibold text-[var(--bd-navy)]">In brief</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TYPOLOGY.map((g) => (
                      <tr key={g.key} className="border-b border-[var(--bd-line)] align-top">
                        <td className="py-3 pr-3 font-medium text-[var(--bd-navy)]">
                          {g.name}
                        </td>
                        <td className="py-3 pr-3 text-right tabular-nums">{pct(g.share)}</td>
                        <td className="py-3 pr-3 text-right tabular-nums text-[var(--bd-muted)]">
                          {pct(g.turnout)}
                        </td>
                        <td className="py-3 text-[13px] leading-6 text-[var(--bd-muted)]">
                          {g.blurb}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-[var(--bd-muted)]">
                The population-weighted mean turnout, {pct(MEAN_TURNOUT, 1)}, is the
                denominator that normalises engagement to 1.0 for an average citizen.
              </p>
            </Section>

            {/* ---------------------------------------------------------- privacy */}
            <Section id="privacy" eyebrow="6" title="What we store about you, and what we cannot read">
              <p>
                If you sign in and save a delegation list, the design goal is specific: a
                complete dump of the database should tell an attacker neither who the rows
                belong to nor what they say. Three decisions get us there.
              </p>

              <ol className="space-y-5 border-l-2 border-[var(--bd-line)] pl-5">
                <li>
                  <span className="font-semibold text-[var(--bd-navy)]">
                    No identity table.
                  </span>{" "}
                  Sessions are JWT-only. There is deliberately no database adapter behind the
                  sign-in, so signing in never writes an identity row anywhere. Your Google
                  subject identifier — the only thing that identifies you — lives inside the
                  encrypted session cookie in your browser and nowhere on the server. It is
                  also deliberately withheld from the public session endpoint, so no script on
                  the page can read it either.
                </li>
                <li>
                  <span className="font-semibold text-[var(--bd-navy)]">
                    The row key is a one-way hash.
                  </span>{" "}
                  Your database row is keyed by a peppered scrypt hash of that subject
                  identifier, not by the identifier itself. The hash is stable, so we can find
                  your row when you come back. Google subjects are only about 21 digits and
                  are the same at every site you sign into, so a plain SHA-256 over that space
                  is guessable at millions of tries a second — hence a deliberately slow hash
                  rather than a fast one.
                </li>
                <li>
                  <span className="font-semibold text-[var(--bd-navy)]">
                    The list itself is encrypted under a key that is not in the database.
                  </span>{" "}
                  Your delegation is stored as AES-256-GCM ciphertext, under a key derived
                  (via scrypt, with a per-row random salt and a server-side pepper) from that
                  same subject identifier. The server can only derive that key while it is
                  handling a request carrying your cookie. Sitting in the database, the row
                  decrypts to nothing.
                </li>
              </ol>

              <p>
                What this does not claim: we cannot read your list. We can. The server
                necessarily sees it in plaintext while it is serving you a page — that is what makes &ldquo;which of your
                delegates spoke for you&rdquo; possible at all. This is not end-to-end
                encryption, and it does not defend against a compromised running server. It
                defends against the realistic failure, which is a leaked or subpoenaed database
                dump. Deleting your list deletes the row outright.
              </p>
            </Section>

            {/* ------------------------------------------------------------ limits */}
            <Section id="limits" eyebrow="7" title="Limitations">
              <p>
                In descending order of how much they should bother you.
              </p>

              <div className="space-y-6">
                <div className="rounded-lg border-l-4 border-[var(--bd-no)] bg-white px-5 py-4">
                  <p className="font-semibold text-[var(--bd-navy)]">
                    On most bills the ordering never does anything.
                  </p>
                  <p className="mt-1.5 text-[0.95rem] leading-7 text-[var(--bd-muted)]">
                    We measure this rather than assert it. Across the bills classified so far,
                    the share of citizens holding two delegates that <em>disagreed</em> — the
                    only situation in which the ranking decides anything — runs at about 0.1%
                    on bills where one or two parties spoke, 4% where three to five did, and
                    14% on the handful where six to nine did. On the third of bills that no
                    party claims at all, it is zero by construction. So the mechanism this
                    site exists to demonstrate is doing real work on roughly a quarter of the
                    docket and nothing at all on the rest, which is an honest reflection of
                    what Congress mostly votes on: post office namings, land conveyances and
                    technical extensions. <code>npm run tally</code> prints this table on every
                    run, so a change to the roster or the prompt that quietly kills the
                    fall-through would show up immediately.
                  </p>
                </div>

                <div className="rounded-lg border-l-4 border-[var(--bd-no)] bg-white px-5 py-4">
                  <p className="font-semibold text-[var(--bd-navy)]">
                    One AI model stands in for {CLASSIFIABLE} human delegates.
                  </p>
                  <p className="mt-1.5 text-[0.95rem] leading-7 text-[var(--bd-muted)]">
                    Every party&rsquo;s vote on every bill comes from the same model in the
                    same call, so its blind spots are correlated across all {CLASSIFIABLE} parties rather
                    than cancelling out the way disagreement between real organisations would.
                    Whatever that model believes a &ldquo;pro-worker&rdquo; or
                    &ldquo;pro-life&rdquo; group would do, it believes consistently, and the
                    site inherits it. Real single-issue groups also surprise people, endorse
                    against type, and get captured; a model asked to be plausible does none of
                    that.
                  </p>
                </div>

                <div className="rounded-lg border-l-4 border-[var(--bd-no)] bg-white px-5 py-4">
                  <p className="font-semibold text-[var(--bd-navy)]">
                    The electorate matches the margins, not the joint distribution.
                  </p>
                  <p className="mt-1.5 text-[0.95rem] leading-7 text-[var(--bd-muted)]">
                    Calibration guarantees that the share on each side of each issue is right,
                    one issue at a time. It guarantees nothing about how opinions{" "}
                    <em>combine</em>. Within a typology group, every issue is drawn
                    independently, so the correlations that survive after group membership is
                    accounted for are lost. Real people who oppose abortion and support gun
                    rights are far more likely to be the same person than nine groups of
                    independent draws can capture. The population is right on 19 separate
                    questions and only approximately right about anybody in particular.
                  </p>
                </div>

                <div className="rounded-lg border-l-4 border-[var(--bd-no)] bg-white px-5 py-4">
                  <p className="font-semibold text-[var(--bd-navy)]">
                    Delegation ordering has no survey behind it whatsoever.
                  </p>
                  <p className="mt-1.5 text-[0.95rem] leading-7 text-[var(--bd-muted)]">
                    Nobody has ever been polled on how they would rank single-issue delegates,
                    because no country works this way. The rule used here — care about an issue
                    with probability salience × engagement, then order by an exponential race
                    weighted by salience — is a modelling assumption invented for this site.
                    It is the single least evidenced part of the model, and it is also the part
                    that decides which delegate speaks for whom.
                  </p>
                </div>

                <div className="rounded-lg border-l-4 border-[var(--bd-no)] bg-white px-5 py-4">
                  <p className="font-semibold text-[var(--bd-navy)]">
                    Some salience and split values are estimates.
                  </p>
                  <p className="mt-1.5 text-[0.95rem] leading-7 text-[var(--bd-muted)]">
                    Flagged individually in the table above rather than buried here. Where no
                    pollster asks the question — religion in government as a voting priority,
                    labour, veterans, rural policy, housing, privacy, animals — the number is a
                    judgement call. It is stated to two decimals because the code needs a
                    number, not because it is known to two decimals.
                  </p>
                </div>

                <div className="rounded-lg border-l-4 border-[var(--bd-no)] bg-white px-5 py-4">
                  <p className="font-semibold text-[var(--bd-navy)]">
                    Bills are judged on their summary, never their text.
                  </p>
                  <p className="mt-1.5 text-[0.95rem] leading-7 text-[var(--bd-muted)]">
                    The model sees the title, the sponsor, the policy area and the CRS summary
                    truncated to 4,000 characters. It does not see the bill. An omnibus whose
                    consequential provision is on page 700, a rider attached to something
                    unrelated, or a bill with no summary published yet, will all be judged on
                    far less than a competent human delegate would read.
                  </p>
                </div>

                <div className="rounded-lg border-l-4 border-[var(--bd-no)] bg-white px-5 py-4">
                  <p className="font-semibold text-[var(--bd-navy)]">
                    This is a vote, not a legislature.
                  </p>
                  <p className="mt-1.5 text-[0.95rem] leading-7 text-[var(--bd-muted)]">
                    There are no amendments here, no committees, no negotiation, no
                    log-rolling, no procedure and no second chamber. Each bill is presented
                    frozen, as a single up-or-down question, at one moment in its life. Most of
                    what actually determines whether a bill becomes law happens in the parts
                    this simulation does not model at all — so the comparison against
                    Congress&rsquo;s real outcome is a point of interest, not a scorecard.
                  </p>
                </div>

                <div className="rounded-lg border-l-4 border-[var(--bd-line)] bg-white px-5 py-4">
                  <p className="font-semibold text-[var(--bd-navy)]">
                    And the obvious one.
                  </p>
                  <p className="mt-1.5 text-[0.95rem] leading-7 text-[var(--bd-muted)]">
                    The parties are fictional, the citizens are synthetic, and real
                    users&rsquo; delegations are recorded and shown back to them but are
                    excluded from the tally — there are nowhere near enough of them for
                    inclusion to mean anything.{" "}
                    <Link className="bd-link" href="/how-it-works">
                      How it works
                    </Link>{" "}
                    sets out the same boundary in plain language.
                  </p>
                </div>
              </div>
            </Section>
          </div>
        </article>

        <nav aria-label="On this page" className="hidden lg:block">
          <div className="sticky top-24">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--bd-muted)]">
              On this page
            </p>
            <div className="bd-rule mt-3" />
            <ol className="mt-4 space-y-2.5 text-sm">
              {SECTIONS.map((s, i) => (
                <li key={s.id} className="flex gap-2.5">
                  <span className="tabular-nums text-[var(--bd-muted)]">{i + 1}</span>
                  <a
                    href={`#${s.id}`}
                    className="text-[var(--bd-muted)] transition-colors hover:text-[var(--bd-blue-deep)]"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>
      </div>
    </div>
  );
}
