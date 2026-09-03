import type { Metadata } from "next";
import stats from "../../../data/electorate-stats.json";
import { Section, Toc } from "@/components/article";
import { PageHeader } from "@/components/page-header";
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
  description:
    "Where the bills come from, how each party's vote is decided, how the synthetic electorate is calibrated, what is stored about you, and where the model is wrong.",
};

const SECTIONS = [
  { id: "bills", label: "Where the bills come from" },
  { id: "votes", label: "How a party votes" },
  { id: "electorate", label: "Building the electorate" },
  { id: "axes", label: `The ${AXES.length} issue axes` },
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
    <div className="bd-container py-12">
      <PageHeader
        title="Every number on this site, and where it came from."
        subtitle={
          <>
            Data sources, the model that casts each party&rsquo;s vote, the synthetic
            electorate, and where the simulation is wrong. Numbers with no published source
            are flagged <Estimated />.
          </>
        }
      />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-14">
        <article className="max-w-[68ch]">
          <Toc sections={SECTIONS} numbered />

          <div className="space-y-16">
            {/* ------------------------------------------------------------ bills */}
            <Section id="bills" eyebrow="1" title="Where the bills come from">
              <p>Nothing about the legislation is invented. Three public, keyless sources:</p>

              <dl className="space-y-4">
                <div className="bd-card px-5 py-4">
                  <dt className="font-semibold text-[var(--bd-navy)]">
                    Discovery — GovTrack API v2
                  </dt>
                  <dd className="mt-1.5 text-[0.95rem] leading-7 text-[var(--bd-muted)]">
                    Bills of the 119th Congress whose status changed in the last seven days.
                    Only <code>hr</code>, <code>s</code>, <code>hjres</code> and{" "}
                    <code>sjres</code> are kept; simple and concurrent resolutions are
                    discarded.
                  </dd>
                </div>
                <div className="bd-card px-5 py-4">
                  <dt className="font-semibold text-[var(--bd-navy)]">
                    Detail — govinfo BILLSTATUS bulk XML
                  </dt>
                  <dd className="mt-1.5 text-[0.95rem] leading-7 text-[var(--bd-muted)]">
                    Sponsor, policy area, latest action, text and PDF links, and the CRS
                    summary the model reads. Very new bills have no file yet and keep the
                    GovTrack fields until one appears.
                  </dd>
                </div>
                <div className="bd-card px-5 py-4">
                  <dt className="font-semibold text-[var(--bd-navy)]">
                    Real votes — clerk.house.gov and senate.gov
                  </dt>
                  <dd className="mt-1.5 text-[0.95rem] leading-7 text-[var(--bd-muted)]">
                    Roll calls, with party breakdown, from the House Clerk and Senate LIS XML.
                    This is what the site compares its result against.
                  </dd>
                </div>
              </dl>

              <H3>Cadence</H3>
              <p>
                Ingestion runs daily at 4:00 AM Eastern (08:00 UTC) over a seven-day window, up
                to 200 bills per run, upserted by bill id. The same run re-checks every stored
                bill that is still in progress, so one that passed or failed overnight shows its
                new outcome the next morning. Classification is a separate manual step (below),
                so a new bill can sit unclassified for a while.
              </p>
            </Section>

            {/* ------------------------------------------------------------ votes */}
            <Section id="votes" eyebrow="2" title="How a party's vote is decided">
              <p>
                In the idea, each party is run by people who read the bill. Here one small
                model stands in for all {CLASSIFIABLE} of them at once.
              </p>

              <H3>One prompt, all parties</H3>
              <p>
                One model call per bill. The prompt holds the bill&rsquo;s facts, its CRS
                summary (truncated to 4,000 characters), and every party&rsquo;s{" "}
                <code>scope</code> and <code>stance</code> <strong>verbatim</strong> — the same
                strings shown on each party&rsquo;s page. No hidden instruction, no second
                pass.
              </p>

              <H3>Scope first, then position</H3>
              <p>
                The model answers for every party in roster order, with a two-step test: is
                the bill inside the stated scope, and if so does the stance point yes or no.
                Out of scope abstains; in scope must vote. (An earlier prompt that invited
                abstention by default produced parties silent on their own subject.) The blank
                vote is never shown to the model.
              </p>
              <p>
                Bill text is scraped and therefore untrusted. It is fenced between markers and
                the model is told everything inside is data, never instructions.
              </p>
              <p>
                The response is parsed as JSON; unknown slugs are dropped and anything not a
                literal <code>yes</code> or <code>no</code> becomes abstain. Bills where no
                party votes are logged, since a procedural bill and a parse failure look
                identical, and shown as &ldquo;no delegate claimed it&rdquo; rather than a
                defeat.
              </p>

              <H3>The model, and where it runs</H3>
              <p>
                Classification runs through the Claude Code CLI on the author&rsquo;s machine,
                defaulting to Claude Haiku, tools disabled, outside the project directory. No
                model credential exists in the deployed application. The trade-off: bills are
                ingested daily but classified only when a human runs the script.
              </p>
            </Section>

            {/* ------------------------------------------------------- electorate */}
            <Section id="electorate" eyebrow="3" title="Building the 10,000 citizens">
              <p>
                Each of the {ELECTORATE_SIZE.toLocaleString("en-US")} citizens is one ordered
                list. The population is generated deterministically from seed{" "}
                <code>{ELECTORATE_SEED}</code> (the Pew typology&rsquo;s publication date) and
                fingerprinted by hash <code>{stats.hash}</code>, stored with every cached
                result so a stale tally can be spotted.
              </p>

              <div className="grid gap-3 sm:grid-cols-3">
                <Figure
                  value={String(stats.averageDelegates)}
                  label="delegates per citizen, including the blank vote"
                />
                <Figure
                  value={pct(stats.blankOnlyShare, 1)}
                  label="hold the blank vote alone"
                />
                <Figure value={String(AXES.length)} label="issue axes" />
              </div>

              <H3>Layer 1 — who people are</H3>
              <p>
                Every citizen is drawn from one of the nine groups in the Pew Research
                Center&rsquo;s 2026 political typology, in Pew&rsquo;s proportions. It is the
                only public dataset describing how American views actually cluster; a single
                left-right axis could not produce cross-cutting lists.
              </p>

              <H3>Layer 2 — which side they take</H3>
              <p>
                For each two-sided issue, the side comes from a logistic model: a group tilt in
                log-odds plus a per-issue intercept, solved by bisection so the
                participation-weighted split reproduces the published national one. The tilts
                shape the disagreement; calibration fixes the total. Sampling noise leaves
                achieved shares within {(MAX_DRIFT * 100).toFixed(1)} points of target at
                worst.
              </p>
              <p>
                In the table, <strong>Achieved</strong> is the split among citizens who took a
                side — the calibration target. <strong>Population</strong> is the split over
                everyone, including those who never delegated the issue. The gap measures how
                much the participation weighting is doing.
              </p>

              <H3>Layer 3 — whether they care enough to delegate</H3>
              <p>
                Each issue has a salience — the probability an average citizen delegates it at
                all — mostly from Gallup&rsquo;s &ldquo;extremely important to my vote&rdquo;
                battery, scaled by group engagement (Pew&rsquo;s validated 2024 turnout over
                the national mean of {MEAN_TURNOUT.toFixed(2)}). For the {ONE_SIDED} one-sided
                issues the group tilt decides who cares rather than which side, so those
                parties&rsquo; memberships lean the way their axis leans.
              </p>
              <p>
                Issues that clear the bar are ordered by an exponential race weighted by
                salience, capped at twelve, with the blank vote appended.
              </p>
              <p>
                Separately, {pct(NONVOTER_BLANK_SHARE)} of each group&rsquo;s non-voters get a
                list of the blank vote alone. No survey measures this; it is the least
                defensible number on the page, and moving it ten points moves the blank-only
                share ({pct(stats.blankOnlyShare, 1)}) by roughly six.
              </p>

              <H3>What the population ended up looking like</H3>
              <p>The most-delegated-to parties, excluding the blank vote:</p>
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
                Anti-Corruption leads because it has the highest salience and no opposing
                party — an artefact of the roster, not a finding about American opinion.
              </p>
            </Section>

            {/* ------------------------------------------------------------- axes */}
            <Section id="axes" eyebrow="4" title={`The ${AXES.length} issue axes`}>
              <p>
                {TWO_SIDED} axes are two-sided; the other {ONE_SIDED} have no opposing party,
                so there is no split to calibrate.
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
                {ESTIMATED_SALIENCE} salience and {ESTIMATED_SPLIT} split figures have no
                published survey behind them — judgement calls dressed in two decimal places.
                The animal welfare split rests on a 2015 Gallup reading, the only one that
                exists. The education split composites two surveys pointing opposite ways.
              </p>
            </Section>

            {/* --------------------------------------------------------- typology */}
            <Section id="typology" eyebrow="5" title="The nine typology groups">
              <p>
                From Pew Research Center, &ldquo;Beyond Red vs. Blue: The Political
                Typology&rdquo;, 10 June 2026 (10,357 US adults, 17&ndash;30 November 2025).
                Turnout is Pew&rsquo;s validated 2024 figure, used as an engagement proxy.
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
                Mean turnout {pct(MEAN_TURNOUT, 1)} normalises engagement to 1.0.
              </p>
            </Section>

            {/* ---------------------------------------------------------- privacy */}
            <Section id="privacy" eyebrow="6" title="What we store about you">
              <p>
                A dump of the database should tell an attacker neither whose the rows are nor
                what they say. Three decisions:
              </p>

              <ol className="space-y-5 border-l-2 border-[var(--bd-line)] pl-5">
                <li>
                  <span className="font-semibold text-[var(--bd-navy)]">
                    No identity table.
                  </span>{" "}
                  Sessions are JWT-only; signing in writes no row. Your Google subject id lives
                  only in the encrypted session cookie, and is withheld from the session
                  endpoint.
                </li>
                <li>
                  <span className="font-semibold text-[var(--bd-navy)]">
                    The row key is a one-way hash.
                  </span>{" "}
                  Your row is keyed by a peppered scrypt hash of that id. Google subjects are
                  ~21 digits and shared across sites, so a fast hash would be guessable; hence
                  a slow one.
                </li>
                <li>
                  <span className="font-semibold text-[var(--bd-navy)]">
                    The list itself is encrypted under a key that is not in the database.
                  </span>{" "}
                  AES-256-GCM, under a key derived via scrypt (per-row salt, server pepper)
                  from that same id. The server can derive it only while handling a request
                  with your cookie.
                </li>
              </ol>

              <p>
                We can still read My List: the server sees it in plaintext while serving you
                a page. This is not end-to-end encryption; it defends against a leaked or
                subpoenaed dump, not a compromised server. Deleting My List deletes the row.
              </p>
            </Section>

            {/* ------------------------------------------------------------ limits */}
            <Section id="limits" eyebrow="7" title="Limitations">
              <p>In descending order of how much they should bother you.</p>

              <div className="space-y-6">
                <div className="rounded-lg border-l-4 border-[var(--bd-no)] bg-white px-5 py-4">
                  <p className="font-semibold text-[var(--bd-navy)]">
                    On most bills the ordering never does anything.
                  </p>
                  <p className="mt-1.5 text-[0.95rem] leading-7 text-[var(--bd-muted)]">
                    Measured, not asserted: the share of citizens holding two delegates that{" "}
                    <em>disagreed</em> — the only case where ranking decides anything — is
                    about 0.1% on bills where one or two parties spoke, 4% where three to five
                    did, 14% where six to nine did, and zero on the third of bills no party
                    claims. The mechanism does real work on roughly a quarter of the docket.
                    That reflects what Congress mostly votes on.
                  </p>
                </div>

                <div className="rounded-lg border-l-4 border-[var(--bd-no)] bg-white px-5 py-4">
                  <p className="font-semibold text-[var(--bd-navy)]">
                    One AI model stands in for {CLASSIFIABLE} human delegates.
                  </p>
                  <p className="mt-1.5 text-[0.95rem] leading-7 text-[var(--bd-muted)]">
                    Every vote comes from the same model in the same call, so its blind spots
                    are correlated across all {CLASSIFIABLE} parties rather than cancelling
                    out. Real single-issue groups surprise people, endorse against type, and
                    get captured; a model asked to be plausible does none of that.
                  </p>
                </div>

                <div className="rounded-lg border-l-4 border-[var(--bd-no)] bg-white px-5 py-4">
                  <p className="font-semibold text-[var(--bd-navy)]">
                    The electorate matches the margins, not the joint distribution.
                  </p>
                  <p className="mt-1.5 text-[0.95rem] leading-7 text-[var(--bd-muted)]">
                    Calibration fixes each issue&rsquo;s split, not how opinions{" "}
                    <em>combine</em>. Within a group every issue is drawn independently, so
                    correlations beyond group membership are lost. The population is right on
                    {AXES.length} separate questions and only approximately right about anyone in
                    particular.
                  </p>
                </div>

                <div className="rounded-lg border-l-4 border-[var(--bd-no)] bg-white px-5 py-4">
                  <p className="font-semibold text-[var(--bd-navy)]">
                    Delegation ordering has no survey behind it whatsoever.
                  </p>
                  <p className="mt-1.5 text-[0.95rem] leading-7 text-[var(--bd-muted)]">
                    Nobody has been polled on ranking single-issue delegates. The rule here —
                    care with probability salience × engagement, order by a salience-weighted
                    race — is invented for this site, and it decides which delegate speaks for
                    whom.
                  </p>
                </div>

                <div className="rounded-lg border-l-4 border-[var(--bd-no)] bg-white px-5 py-4">
                  <p className="font-semibold text-[var(--bd-navy)]">
                    Some salience and split values are estimates.
                  </p>
                  <p className="mt-1.5 text-[0.95rem] leading-7 text-[var(--bd-muted)]">
                    Flagged in the table above. Where no pollster asks — religion in
                    government, labour, veterans, rural policy, housing, privacy, animals — the
                    number is a judgement call stated to two decimals because the code needs
                    one.
                  </p>
                </div>

                <div className="rounded-lg border-l-4 border-[var(--bd-no)] bg-white px-5 py-4">
                  <p className="font-semibold text-[var(--bd-navy)]">
                    Bills are judged on a summary or an excerpt, never the whole text.
                  </p>
                  <p className="mt-1.5 text-[0.95rem] leading-7 text-[var(--bd-muted)]">
                    The model sees title, sponsor, policy area and either the 4,000-character
                    official summary or, when none has been written yet, the first 12,000
                    characters of the bill as introduced. An omnibus or a late rider is judged
                    on far less than a human delegate would read.
                  </p>
                </div>

                <div className="rounded-lg border-l-4 border-[var(--bd-no)] bg-white px-5 py-4">
                  <p className="font-semibold text-[var(--bd-navy)]">
                    This is a vote, not a legislature.
                  </p>
                  <p className="mt-1.5 text-[0.95rem] leading-7 text-[var(--bd-muted)]">
                    No amendments, committees, negotiation, procedure or second chamber. Each
                    bill is a single frozen up-or-down question, so the comparison with
                    Congress is a point of interest, not a scorecard.
                  </p>
                </div>

                <div className="rounded-lg border-l-4 border-[var(--bd-line)] bg-white px-5 py-4">
                  <p className="font-semibold text-[var(--bd-navy)]">
                    And the obvious one.
                  </p>
                  <p className="mt-1.5 text-[0.95rem] leading-7 text-[var(--bd-muted)]">
                    The parties are fictional, the citizens synthetic, and real users&rsquo;
                    lists are shown back to them but excluded from the tally — there are
                    nowhere near enough for inclusion to mean anything.
                  </p>
                </div>
              </div>
            </Section>
          </div>
        </article>

        <Toc sections={SECTIONS} sticky numbered />
      </div>
    </div>
  );
}
