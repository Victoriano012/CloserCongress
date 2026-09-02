import Link from "next/link";
import type { Metadata } from "next";

import { SignInButton } from "@/components/auth-buttons";
import { VoteBar } from "@/components/vote-bar";
import { YourVote } from "@/components/your-vote";
import { billLabel, listBills } from "@/lib/bills";
import { shortDate } from "@/lib/dates";
import { loadDelegation } from "@/lib/delegation";
import { BLANK_PARTY_SLUG } from "@/lib/parties";
import { loadVotesForBills } from "@/lib/record";

export const metadata: Metadata = {
  title: "Bills",
  description:
    "Real bills before Congress, put to a simulated vote of ten thousand delegated citizens.",
};

export const dynamic = "force-dynamic";

const OUTCOMES = [
  { value: "all", label: "All" },
  { value: "pending", label: "In progress" },
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Failed" },
];

const PER_PAGE = 25;

function OutcomeTag({ outcome }: { outcome: string }) {
  const tone =
    outcome === "passed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : outcome === "failed"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-[var(--bd-line)] bg-slate-50 text-[var(--bd-muted)]";
  const label = outcome === "pending" ? "In progress" : outcome;
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${tone}`}>
      {label}
    </span>
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

  const delegation = await loadDelegation();
  const hasDelegates = (delegation ?? []).some((slug) => slug !== BLANK_PARTY_SLUG);

  const { items, total } = await listBills({
    query: query || undefined,
    outcome,
    votedOnly: mine,
    limit: PER_PAGE,
    offset: (page - 1) * PER_PAGE,
  });
  const pages = Math.max(Math.ceil(total / PER_PAGE), 1);

  const myVotes =
    delegation && hasDelegates
      ? await loadVotesForBills(delegation, items.map((b) => b.id))
      : null;

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
      <header className="max-w-2xl">
        <div className="bd-rule mb-5" />
        <h1 className="font-serif text-4xl font-semibold">Bills before Congress</h1>
        <p className="mt-3 text-[var(--bd-muted)]">
          Real legislation, updated daily, put to ten thousand simulated citizens.
        </p>
      </header>

      <form method="get" className="mt-8 flex flex-wrap items-center gap-3">
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

      {mine && !myVotes ? (
        <div className="bd-card mt-6 flex flex-wrap items-center gap-4 p-5 text-sm">
          <p className="text-[var(--bd-ink)]">
            {delegation ? (
              <>
                No delegates yet, so every bill is a blank vote.{" "}
                <Link href="/delegate" className="bd-link">
                  Build your list
                </Link>{" "}
                to see how you voted.
              </>
            ) : (
              <>Sign in to see how your delegates voted on each bill.</>
            )}
          </p>
          {!delegation && <SignInButton />}
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
                <span className="ml-auto flex items-center gap-2">
                  {shortDate(bill.latest_action_date)}
                  <OutcomeTag outcome={bill.real_outcome} />
                </span>
              </div>

              <h2 className="mt-2 font-serif text-lg font-semibold leading-snug">
                {bill.title}
              </h2>

              {bill.plain_summary && (
                <p className="mt-1.5 text-sm text-[var(--bd-muted)]">{bill.plain_summary}</p>
              )}

              {bill.yes_weight !== null && bill.no_weight !== null ? (
                <div className="mt-4 flex items-center gap-3">
                  <div className="max-w-xs flex-1">
                    <VoteBar
                      yes={bill.yes_weight}
                      no={bill.no_weight}
                      blank={bill.blank_weight ?? 0}
                      height={8}
                    />
                  </div>
                  <span className="text-xs text-[var(--bd-muted)]">
                    {bill.yes_weight + bill.no_weight === 0 ? (
                      // Nobody voted: no percentage, and no rejection either.
                      <>All blank</>
                    ) : (
                      <>
                        {bill.passed ? "Would pass" : "Would fail"} ·{" "}
                        {Math.round(
                          (bill.yes_weight / (bill.yes_weight + bill.no_weight)) * 100,
                        )}
                        % in favour
                      </>
                    )}
                  </span>
                </div>
              ) : (
                <p className="mt-4 text-xs text-[var(--bd-muted)]">
                  Awaiting the delegates.
                </p>
              )}

              {myVotes?.get(bill.id)?.classified ? (
                <div className="mt-4 border-t border-[var(--bd-line)] pt-3">
                  <YourVote entry={myVotes.get(bill.id)!} clampReason />
                </div>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>

      {items.length === 0 && (
        <p className="bd-card mt-4 p-8 text-center text-[var(--bd-muted)]">
          {total === 0 ? (
            <>No bills match {query ? <>“{query}”</> : "that filter"}.</>
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
