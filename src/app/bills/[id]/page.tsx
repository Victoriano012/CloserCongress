import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { billLabel, getBill, type BillRow, type PartyVote } from "@/lib/bills";
import { shortDate } from "@/lib/dates";
import { loadDelegation } from "@/lib/delegation";
import { PARTY_BY_SLUG, SAMPLE_LIST, VOTING_PARTIES } from "@/lib/parties";
import { PartyChip } from "@/components/party-chip";
import { GuestListMerge } from "@/components/guest-list-merge";
import { GuestYourVoteSection } from "@/components/bills/guest-your-vote-section";
import { Section, YourVoteSection } from "@/components/bills/your-vote-section";
import { VoteDistributionBar } from "@/components/bills/vote-distribution-bar";
import { PartyBreakdownBar, sortContributions, VoteBar } from "@/components/vote-bar";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await getBill(id);
  if (!data) return {};
  return { description: data.ai?.plain_summary ?? data.bill.official_summary?.slice(0, 200) };
}

const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);

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
              Official roll call
            </a>
          )}
        </div>
      ) : bill.real_outcome !== "pending" && !bill.positions_unavailable ? (
        <p className="mt-5 text-sm text-[var(--bd-muted)]">
          Roll-call details are still being fetched. Check back after the nightly sync.
        </p>
      ) : (
        <p className="mt-5 text-sm text-[var(--bd-muted)]">
          No roll-call vote. Most bills pass by voice or never reach the floor.
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

  // "yes" before "no", so this list, the bar and the legend all read the same way.
  const spoke = votes
    .filter((v) => v.vote !== "abstain")
    .sort((a, b) => b.vote.localeCompare(a.vote));

  // The reader's own list, walked the same way the simulation walks every
  // citizen's — so they can see which delegate ended up speaking for them. A
  // signed-out visitor's list lives in their browser, so that walk happens
  // client-side, over the sample list when they have none: this is the only
  // place on the site where the fall-through happens on a real bill.
  const signedIn = (await auth())?.user != null;
  const delegation = signedIn ? await loadDelegation() : null;

  return (
    <div className="bd-container py-12">
      {signedIn && <GuestListMerge />}
      <Link href="/bills" className="text-sm text-[var(--bd-muted)] hover:text-[var(--bd-blue)]">
        ← All bills
      </Link>

      <header className="mt-4">
        <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--bd-muted)]">
          <span className="font-mono font-semibold text-[var(--bd-blue-deep)]">{label}</span>
          <span>·</span>
          <span className="capitalize">{bill.chamber}</span>
          {bill.introduced_date && <>· introduced {shortDate(bill.introduced_date)}</>}
        </p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 max-w-3xl">
            <h1 className="font-serif text-3xl font-semibold leading-tight sm:text-4xl">
              {bill.title}
            </h1>
            {bill.sponsor_name && (
              <p className="mt-2 text-sm text-[var(--bd-muted)]">
                Sponsored by {bill.sponsor_name}
                {bill.sponsor_party && ` (${bill.sponsor_party}${bill.sponsor_state ? `-${bill.sponsor_state}` : ""})`}
              </p>
            )}
          </div>
          {(bill.pdf_url || bill.congress_url) && (
            <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0 lg:justify-end">
              {bill.pdf_url && (
                <a
                  href={bill.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-md bg-[var(--bd-navy)] px-4 py-3 text-sm font-medium text-white hover:bg-[var(--bd-blue-deep)]"
                >
                  <span aria-hidden>📄</span> Bill text (PDF)
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
            </div>
          )}
        </div>
      </header>

      {/* 1. What it says, in plain words. */}
      <div className="mt-8">
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
                Summarised by Claude <span className="capitalize">{ai.model}</span>; the
                official text is the authority.
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
        {bill.latest_action_text && (
          <p className="mt-3 text-xs text-[var(--bd-muted)]">
            Latest action{bill.latest_action_date && ` (${shortDate(bill.latest_action_date)})`}:{" "}
            {bill.latest_action_text}
          </p>
        )}
      </div>

      {/* 2. Them versus us. */}
      <Section
        title="The result"
        note="Congress versus ten thousand delegated citizens."
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
                    ? `All ${result.total.toLocaleString()} lists ran off the end.`
                    : `${pct(result.yes, result.cast).toFixed(1)}% of the votes cast were in favour`}
                </p>

                <div className="mt-5">
                  <VoteDistributionBar yes={result.yes} no={result.no} abstain={result.blank} legend />
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

      {/* 3. The reader's own vote — or, without a list, the sample list's. */}
      {!signedIn ? (
        <GuestYourVoteSection votes={votes} />
      ) : delegation ? (
        <YourVoteSection list={delegation} votes={votes} own />
      ) : votes.length > 0 ? (
        <YourVoteSection list={SAMPLE_LIST} votes={votes} own={false} />
      ) : null}

      {/* Why each party voted the way it did — including when none did. */}
      {votes.length > 0 && (
        <Section
          title="What the delegates said"
          note={
            spoke.length > 0
              ? `${spoke.length} of ${VOTING_PARTIES.length} delegates had an opinion.`
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
              electorate voted blank. Silence is not a no.
            </p>
          )}
        </Section>
      )}
    </div>
  );
}
