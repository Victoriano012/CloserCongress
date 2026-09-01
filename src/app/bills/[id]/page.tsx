import Link from "next/link";
import { notFound } from "next/navigation";

import { billLabel, getBill, type BillRow, type PartyVote } from "@/lib/bills";
import { shortDate } from "@/lib/dates";
import { loadDelegation } from "@/lib/delegation";
import { PARTY_BY_SLUG, BLANK_PARTY_SLUG, VOTING_PARTIES } from "@/lib/parties";
import { resolveForDelegation, type Vote } from "@/lib/tally";
import { PartyChip } from "@/components/party-chip";
import { PartyBreakdownBar, sortContributions, VoteBar } from "@/components/vote-bar";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const data = await getBill(id);
  if (!data) return { title: "Bill not found" };
  return {
    title: `${billLabel(data.bill)} — ${data.bill.title}`.slice(0, 110),
    description: data.ai?.plain_summary ?? data.bill.official_summary?.slice(0, 200),
  };
}

const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);

/** The list used in every worked example on the site, for readers without one. */
const SAMPLE_DELEGATION = ["animal-welfare", "catholic-values", "equal-rights"];

function Section({
  title, note, children,
}: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <div className="bd-rule mb-4" />
      <h2 className="font-serif text-2xl font-semibold">{title}</h2>
      {note && <p className="mt-1 text-sm text-[var(--bd-muted)]">{note}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** What actually happened in Congress, as far as the public record shows. */
function RealResult({ bill }: { bill: BillRow }) {
  const hasVote = bill.real_yea !== null && bill.real_nay !== null;
  const verdict =
    bill.real_outcome === "passed" ? "Passed"
      : bill.real_outcome === "failed" ? "Failed"
        : "Still in progress";

  return (
    <div className="bd-card h-full p-6">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--bd-muted)]">
        In the real Congress
      </h3>
      <p className="mt-2 font-serif text-3xl font-semibold">{verdict}</p>
      {bill.real_stage && (
        <p className="mt-1 text-sm text-[var(--bd-muted)]">{bill.real_stage}</p>
      )}

      {hasVote ? (
        <div className="mt-5">
          <VoteBar yes={bill.real_yea!} no={bill.real_nay!} blank={bill.real_not_voting ?? 0} />
          <p className="mt-2 text-sm">
            <strong>{bill.real_yea}</strong> yea · <strong>{bill.real_nay}</strong> nay
            {bill.real_not_voting ? <> · {bill.real_not_voting} not voting</> : null}
            {bill.real_vote_chamber && (
              <span className="capitalize text-[var(--bd-muted)]"> — {bill.real_vote_chamber}</span>
            )}
          </p>

          {bill.real_party_breakdown && (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[var(--bd-muted)]">
                  <th className="pb-1 font-medium">Party</th>
                  <th className="pb-1 text-right font-medium">Yea</th>
                  <th className="pb-1 text-right font-medium">Nay</th>
                </tr>
              </thead>
              <tbody>
                {bill.real_party_breakdown.map((row) => (
                  <tr key={row.party} className="border-t border-[var(--bd-line)]">
                    <td className="py-1">{row.party}</td>
                    <td className="py-1 text-right tabular-nums">{row.yea}</td>
                    <td className="py-1 text-right tabular-nums">{row.nay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {bill.real_vote_url && (
            <a href={bill.real_vote_url} className="bd-link mt-3 inline-block text-sm">
              The official roll call
            </a>
          )}
        </div>
      ) : (
        <p className="mt-5 text-sm text-[var(--bd-muted)]">
          No roll-call vote. Most bills pass by voice, by unanimous consent, or never reach
          the floor.
        </p>
      )}
    </div>
  );
}

export default async function BillPage({ params }: Props) {
  const { id } = await params;
  const data = await getBill(id);
  if (!data) notFound();

  const { bill, ai, votes, result } = data;
  const label = billLabel(bill);

  const voteMap: Record<string, Vote> = {};
  for (const v of votes) voteMap[v.party_slug] = v.vote;
  const reasons = new Map(votes.map((v) => [v.party_slug, v.reason]));

  // "yes" before "no", so this list, the bar and the legend all read the same way.
  const spoke = votes
    .filter((v) => v.vote !== "abstain")
    .sort((a, b) => b.vote.localeCompare(a.vote));

  // The reader's own list, walked the same way the simulation walks every
  // citizen's — so they can see which delegate ended up speaking for them. A
  // signed-out visitor gets the same walk over the sample list instead: this is
  // the only place on the site where the fall-through happens on a real bill.
  const delegation = await loadDelegation();
  const list = delegation ?? SAMPLE_DELEGATION;
  const mine = votes.length ? resolveForDelegation(list, voteMap) : null;
  const skipped = mine ? list.slice(0, Math.max(list.indexOf(mine.party), 0)) : [];

  return (
    <div className="bd-container py-12">
      <Link href="/bills" className="text-sm text-[var(--bd-muted)] hover:text-[var(--bd-blue)]">
        ← All bills
      </Link>

      <header className="mt-4 max-w-3xl">
        <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--bd-muted)]">
          <span className="font-mono font-semibold text-[var(--bd-blue-deep)]">{label}</span>
          <span>·</span>
          <span className="capitalize">{bill.chamber}</span>
          {bill.introduced_date && <>· introduced {shortDate(bill.introduced_date)}</>}
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight sm:text-4xl">
          {bill.title}
        </h1>
        {bill.sponsor_name && (
          <p className="mt-2 text-sm text-[var(--bd-muted)]">
            Sponsored by {bill.sponsor_name}
            {bill.sponsor_party && ` (${bill.sponsor_party}${bill.sponsor_state ? `-${bill.sponsor_state}` : ""})`}
          </p>
        )}
      </header>

      {/* 1. What it says, in plain words — next to the text itself. */}
      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_16rem]">
        <div className="bd-card border-l-4 border-l-[var(--bd-blue)] p-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--bd-muted)]">
            {ai ? "In plain words" : "The official summary"}
          </h3>
          {ai ? (
            <>
              <p className="mt-2 font-serif text-xl leading-relaxed">{ai.plain_summary}</p>
              {ai.key_points?.length > 0 && (
                <ul className="mt-4 space-y-1.5 text-sm text-[var(--bd-ink)]">
                  {ai.key_points.map((point) => (
                    <li key={point} className="flex gap-2">
                      <span aria-hidden className="text-[var(--bd-blue)]">—</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-xs text-[var(--bd-muted)]">
                Summarised by Claude <span className="capitalize">{ai.model}</span>. It can be
                wrong; the official text is the authority.
              </p>
            </>
          ) : bill.official_summary ? (
            <>
              <p className="mt-2 max-h-64 overflow-y-auto whitespace-pre-line text-[var(--bd-muted)]">
                {bill.official_summary}
              </p>
              <p className="mt-4 text-xs text-[var(--bd-muted)]">
                Congress&rsquo;s own summary. A plain-words version follows classification.
              </p>
            </>
          ) : (
            <p className="mt-2 text-[var(--bd-muted)]">
              No summary yet. Congress publishes one some weeks after introduction.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {bill.pdf_url && (
            <a
              href={bill.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-md bg-[var(--bd-navy)] px-4 py-3 text-sm font-medium text-white hover:bg-[var(--bd-blue-deep)]"
            >
              <span aria-hidden>📄</span> Read the bill (PDF)
            </a>
          )}
          {bill.text_url && (
            <a
              href={bill.text_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-[var(--bd-line)] bg-white px-4 py-3 text-center text-sm font-medium hover:bg-blue-50"
            >
              Full text
            </a>
          )}
          {bill.congress_url && (
            <a
              href={bill.congress_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-[var(--bd-line)] bg-white px-4 py-3 text-center text-sm font-medium hover:bg-blue-50"
            >
              On congress.gov
            </a>
          )}
          {bill.latest_action_text && (
            <p className="mt-1 text-xs text-[var(--bd-muted)]">
              Latest action{bill.latest_action_date && ` (${shortDate(bill.latest_action_date)})`}:{" "}
              {bill.latest_action_text}
            </p>
          )}
        </div>
      </div>

      {/* 2. Them versus us. */}
      <Section
        title="The result"
        note="What Congress did, and what ten thousand delegated citizens would have done."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <RealResult bill={bill} />

          <div className="bd-card h-full p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--bd-muted)]">
              If the delegates decided it
            </h3>
            {result ? (
              <>
                {/* Nobody voting is a third outcome, not a rejection. */}
                <p className="mt-2 font-serif text-3xl font-semibold">
                  {result.cast === 0 ? "No result" : result.passed ? "Would pass" : "Would fail"}
                </p>
                <p className="mt-1 text-sm text-[var(--bd-muted)]">
                  {result.cast === 0
                    ? `No delegate claimed it: all ${result.total.toLocaleString()} lists ran off the end. Not a rejection — nobody's business.`
                    : `${pct(result.yes, result.cast).toFixed(1)}% of the votes cast were in favour`}
                </p>

                <div className="mt-5">
                  <VoteBar yes={result.yes} no={result.no} blank={result.blank} />
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <span>
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--bd-yes)]" />
                      {result.yes.toLocaleString()} in favour
                    </span>
                    <span>
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--bd-no)]" />
                      {result.no.toLocaleString()} against
                    </span>
                    <span>
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--bd-blank-fill)]" />
                      {result.blank.toLocaleString()} blank
                    </span>
                  </div>
                </div>

                <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-[var(--bd-muted)]">
                  Who cast those votes
                </h3>
                <div className="mt-2">
                  <PartyBreakdownBar breakdown={result.breakdown} total={result.total} />
                </div>
                {/* Same comparator as the bar above, so the two can be read together. */}
                <ul className="mt-3 space-y-1 text-sm">
                  {sortContributions(result.breakdown).map((seg) => (
                    <li
                      key={`${seg.slug}-${seg.vote}`}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{
                            background: PARTY_BY_SLUG[seg.slug]?.color ?? "var(--bd-blank-fill)",
                            opacity: seg.vote === "yes" ? 1 : seg.vote === "no" ? 0.55 : 0.3,
                          }}
                        />
                        {PARTY_BY_SLUG[seg.slug]?.name ?? seg.slug}
                      </span>
                      <span className="text-[var(--bd-muted)] tabular-nums">
                        {seg.count.toLocaleString()} ·{" "}
                        {seg.share < 0.001 ? "<0.1" : (seg.share * 100).toFixed(1)}%{" "}
                        {seg.vote === "abstain" ? "blank" : seg.vote === "yes" ? "in favour" : "against"}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-4 text-sm text-[var(--bd-muted)]">
                Awaiting the delegates.
              </p>
            )}
          </div>
        </div>
      </Section>

      {/* 3. The reader's own vote — or, signed out, the sample list's. */}
      {(delegation || votes.length > 0) && (
        <Section
          title={delegation ? "Your vote" : "A sample list"}
          note={
            delegation
              ? "Your list, walked the way the simulation walks everyone's."
              : "Three names, walked the way the simulation walks every list."
          }
        >
          <div className="bd-card p-6">
            {!delegation && (
              <p className="mb-4 flex flex-wrap items-center gap-2 text-sm text-[var(--bd-muted)]">
                The list:
                {list.map((slug) => (
                  <PartyChip key={slug} slug={slug} />
                ))}
              </p>
            )}
            {mine && mine.vote !== "abstain" ? (
              <>
                <p className="text-lg">
                  {delegation ? "You voted" : "It voted"}{" "}
                  <strong style={{ color: mine.vote === "yes" ? "var(--bd-yes)" : "var(--bd-no)" }}>
                    {mine.vote === "yes" ? "in favour" : "against"}
                  </strong>
                  , through <PartyChip slug={mine.party} size="md" />
                </p>
                {reasons.get(mine.party) && (
                  <p className="mt-3 border-l-2 border-[var(--bd-line)] pl-4 text-sm text-[var(--bd-muted)]">
                    “{reasons.get(mine.party)}”
                  </p>
                )}
                {skipped.length > 0 && (
                  <p className="mt-4 text-sm text-[var(--bd-muted)]">
                    {skipped.map((s) => PARTY_BY_SLUG[s]?.name ?? s).join(", ")}
                    {skipped.length === 1 ? " was" : " were"} ranked above it and stayed
                    silent.
                  </p>
                )}
              </>
            ) : votes.length === 0 ? (
              <p className="text-[var(--bd-muted)]">Awaiting the delegates.</p>
            ) : (
              <p className="text-lg">
                {delegation ? "Your vote was" : "Its vote was"} <strong>blank</strong>. None of
                the {list.filter((d) => d !== BLANK_PARTY_SLUG).length} delegates had an
                opinion.
              </p>
            )}
            <Link href="/delegate" className="bd-link mt-4 inline-block text-sm">
              {delegation ? "Edit your list" : "Build your own list"}
            </Link>
          </div>
        </Section>
      )}

      {/* Why each party voted the way it did — including when none did. */}
      {votes.length > 0 && (
        <Section
          title="What the delegates said"
          note={
            spoke.length > 0
              ? `${spoke.length} of ${VOTING_PARTIES.length} delegates had an opinion. The rest abstained, as usual.`
              : `None of the ${VOTING_PARTIES.length} delegates had an opinion.`
          }
        >
          {spoke.length > 0 ? (
            <ul className="space-y-2">
              {spoke.map((v: PartyVote) => (
                <li key={v.party_slug} className="bd-card flex flex-wrap items-start gap-3 p-4">
                  <span
                    className="mt-0.5 rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white"
                    style={{ background: v.vote === "yes" ? "var(--bd-yes)" : "var(--bd-no)" }}
                  >
                    {v.vote === "yes" ? "For" : "Against"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/parties/${v.party_slug}`}>
                      <PartyChip slug={v.party_slug} size="md" />
                    </Link>
                    {v.reason && (
                      <p className="mt-1.5 text-sm text-[var(--bd-muted)]">{v.reason}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="bd-card p-6 text-[var(--bd-muted)]">
              Every delegate stayed silent, so every list ran off its end and the whole
              electorate voted blank. Silence is not a no — it passes the vote down the list,
              and here there was no next name.
            </p>
          )}
        </Section>
      )}
    </div>
  );
}
