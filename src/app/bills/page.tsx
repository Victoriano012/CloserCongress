import Link from "next/link";
import type { Metadata } from "next";

import { auth } from "@/auth";
import { SignInButton } from "@/components/auth-buttons";
import { GuestVotesBanner, GuestYourVote } from "@/components/bills/guest-your-vote";
import { GuestListMerge } from "@/components/guest-list-merge";
import { PageHeader } from "@/components/page-header";
import { VoteDistributionBar } from "@/components/bills/vote-distribution-bar";
import { YourVote } from "@/components/your-vote";
import { billLabel, listBills } from "@/lib/bills";
import { shortDate } from "@/lib/dates";
import { loadDelegation } from "@/lib/delegation";
import { hasDelegates } from "@/lib/my-list";
import { loadVotes, loadVotesForBills } from "@/lib/record";

export const metadata: Metadata = {
  description:
    "Real bills before Congress, put to a simulated vote of ten thousand delegated citizens.",
};

export const dynamic = "force-dynamic";

// The index only lists resolved bills, so there is no "In progress" filter.
const OUTCOMES = [
  { value: "all", label: "All" },
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Failed" },
];

const PER_PAGE = 25;

/** One of the three comparable columns: heading, verdict, then (optionally) a bar. */
function VoteColumn({
  heading, verdict, children,
}: { heading: string; verdict?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--bd-muted)]">
        {heading}
      </h3>
      {verdict && <p className="truncate text-sm font-semibold leading-5">{verdict}</p>}
      {children}
    </div>
  );
}

export default async function BillsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const outcome = typeof params.outcome === "string" ? params.outcome : "all";
  const mine = params.mine === "1";
  // Number("1e400") is Infinity, which is truthy — it would survive `|| 1` and
  // reach Postgres as an offset, which is a 500.
  const asked = Number(params.page);
  const page = Number.isFinite(asked) ? Math.min(Math.max(Math.trunc(asked), 1), 10_000) : 1;

  // Signed in: the account list resolves each vote here. Signed out: the guest
  // list lives in the browser, so ship the party votes and resolve there.
  const delegation = await loadDelegation();
  const signedIn = (await auth())?.user != null;

  const { items, total } = await listBills({
    query: query || undefined,
    outcome,
    votedOnly: mine,
    limit: PER_PAGE,
    offset: (page - 1) * PER_PAGE,
  });
  const pages = Math.max(Math.ceil(total / PER_PAGE), 1);

  const ids = items.map((b) => b.id);
  const myVotes =
    delegation && hasDelegates(delegation) ? await loadVotesForBills(delegation, ids) : null;
  const guestVotes = signedIn ? null : await loadVotes(ids);

  const link = (next: Record<string, string | number>) => {
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    if (outcome !== "all") sp.set("outcome", outcome);
    if (mine) sp.set("mine", "1");
    for (const [k, v] of Object.entries(next)) {
      if (v === "all" || v === "" || v === 1 || v === 0) sp.delete(k);
      else sp.set(k, String(v));
    }
    const s = sp.toString();
    return s ? `/bills?${s}` : "/bills";
  };

  return (
    <div className="bd-container py-12">
      {signedIn && <GuestListMerge />}
      <PageHeader
        title="Bills before Congress"
        subtitle="Real legislation Congress has passed or defeated, updated daily, put to ten thousand simulated citizens."
      />

      <form method="get" className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="q"
          defaultValue={query}
          aria-label="Search bills"
          placeholder="Search titles and bill numbers…"
          className="w-full max-w-sm rounded-md border border-[var(--bd-line)] bg-white px-3.5 py-2 text-sm focus:border-[var(--bd-blue)]"
        />
        {outcome !== "all" && <input type="hidden" name="outcome" value={outcome} />}
        {mine && <input type="hidden" name="mine" value="1" />}
        <button
          type="submit"
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          Search
        </button>
        <div className="ml-auto flex flex-wrap gap-1 text-sm">
          {OUTCOMES.map((o) => (
            <Link
              key={o.value}
              href={link({ outcome: o.value, page: 1 })}
              className={`rounded-md px-3 py-1.5 ${
                outcome === o.value
                  ? "bg-[var(--bd-navy)] text-white"
                  : "text-[var(--bd-muted)] hover:bg-blue-50"
              }`}
            >
              {o.label}
            </Link>
          ))}
          <Link
            href={link({ mine: mine ? 0 : 1, page: 1 })}
            aria-pressed={mine}
            className={`ml-1 rounded-md border px-3 py-1.5 ${
              mine
                ? "border-[var(--bd-navy)] bg-[var(--bd-navy)] text-white"
                : "border-[var(--bd-line)] text-[var(--bd-muted)] hover:bg-blue-50"
            }`}
          >
            Your votes
          </Link>
        </div>
      </form>

      {mine && !signedIn ? (
        <GuestVotesBanner>
          <SignInButton />
        </GuestVotesBanner>
      ) : mine && !myVotes ? (
        <div className="bd-card mt-6 flex flex-wrap items-center gap-4 p-5 text-sm">
          <p className="text-[var(--bd-ink)]">
            No delegates yet, so every bill is a blank vote.{" "}
            <Link href="/delegate" className="bd-link">
              Build My List
            </Link>{" "}
            to see how you voted.
          </p>
        </div>
      ) : null}

      <p className="mt-6 text-sm text-[var(--bd-muted)]">
        {total.toLocaleString()} {total === 1 ? "bill" : "bills"}
        {mine && <> {myVotes ? "you voted on" : "put to the delegates"}</>}
        {query && <> matching “{query}”</>}
      </p>

      <ul className="mt-4 space-y-3">
        {items.map((bill) => (
          <li key={bill.id}>
            <Link
              href={`/bills/${bill.id}`}
              className="bd-card block p-5 transition-shadow hover:shadow-md hover:shadow-blue-900/5"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--bd-muted)]">
                <span className="font-mono font-semibold text-[var(--bd-blue-deep)]">
                  {billLabel(bill)}
                </span>
                <span>·</span>
                <span className="capitalize">{bill.chamber}</span>
                {bill.policy_area && (
                  <>
                    <span>·</span>
                    <span>{bill.policy_area}</span>
                  </>
                )}
                <span className="ml-auto">{shortDate(bill.latest_action_date)}</span>
              </div>

              <h2 className="mt-2 font-serif text-lg font-semibold leading-snug">
                {bill.title}
              </h2>

              {bill.plain_summary && (
                <p className="mt-1.5 text-sm text-[var(--bd-muted)]">{bill.plain_summary}</p>
              )}

              <div className="mt-4 grid gap-5 border-t border-[var(--bd-line)] pt-4 sm:[grid-template-columns:3fr_3fr_4fr]">
                <VoteColumn
                  heading="In Congress"
                  verdict={
                    <span
                      style={{ color: bill.real_outcome === "passed" ? "var(--bd-yes)" : "var(--bd-no)" }}
                    >
                      {bill.real_outcome === "passed" ? "Passed" : "Failed"}
                    </span>
                  }
                >
                  {bill.real_yea !== null && bill.real_nay !== null && (
                    <VoteDistributionBar
                      yes={bill.real_yea}
                      no={bill.real_nay}
                      abstain={bill.real_not_voting ?? 0}
                      words={{ yes: "yea", no: "nay", abstain: "not voting" }}
                    />
                  )}
                </VoteColumn>

                <VoteColumn
                  heading="In Closer Congress"
                  verdict={
                    bill.yes_weight === null || bill.no_weight === null ? (
                      <span className="font-normal text-[var(--bd-muted)]">Awaiting the delegates</span>
                    ) : bill.yes_weight + bill.no_weight === 0 ? (
                      // Nobody voted: no percentage, and no rejection either.
                      <span className="font-normal text-[var(--bd-muted)]">All blank</span>
                    ) : (
                      <span style={{ color: bill.passed ? "var(--bd-yes)" : "var(--bd-no)" }}>
                        {bill.passed ? "Would pass" : "Would fail"}
                      </span>
                    )
                  }
                >
                  {bill.yes_weight !== null && bill.no_weight !== null && (
                    <VoteDistributionBar
                      yes={bill.yes_weight}
                      no={bill.no_weight}
                      abstain={bill.blank_weight ?? 0}
                    />
                  )}
                </VoteColumn>

                <VoteColumn heading="Your vote">
                  {guestVotes ? (
                    <GuestYourVote votes={guestVotes.get(bill.id) ?? []} clampReason />
                  ) : myVotes?.get(bill.id) ? (
                    <YourVote entry={myVotes.get(bill.id)!} clampReason />
                  ) : (
                    <p className="text-sm text-[var(--bd-muted)]">
                      No delegates yet — build My List to vote.
                    </p>
                  )}
                </VoteColumn>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {items.length === 0 && (
        <p className="bd-card mt-4 p-8 text-center text-[var(--bd-muted)]">
          {total === 0 ? (
            query || mine || outcome !== "all" ? (
              <>No bills match {query ? <>“{query}”</> : "that filter"}.</>
            ) : (
              <>No bills have reached a final vote yet. They appear here once Congress passes or defeats them.</>
            )
          ) : (
            <>
              That page is past the end.{" "}
              <Link href={link({ page: pages })} className="bd-link">
                Go to page {pages}
              </Link>
              .
            </>
          )}
        </p>
      )}

      {pages > 1 && page <= pages && (
        <nav className="mt-8 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={link({ page: page - 1 })} className="bd-link">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-[var(--bd-muted)]">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={link({ page: page + 1 })} className="bd-link">
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
