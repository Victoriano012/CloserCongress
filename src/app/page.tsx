import Link from "next/link";
import type { Metadata } from "next";

import { billLabel, listBills } from "@/lib/bills";
import { query } from "@/lib/db";
import { SAMPLE_LIST, VOTING_PARTIES } from "@/lib/parties";
// From the 4KB stats file, not @/lib/tally: that module imports the whole
// 200KB electorate to read one integer.
import electorateStats from "../../data/electorate-stats.json";
import { shortDate } from "@/lib/dates";
import { DelegationDiagram } from "@/components/delegation-diagram";
import { VoteBar } from "@/components/vote-bar";

export const metadata: Metadata = {
  title: "Closer Democracy — lend your vote to a list, in order",
  description:
    "Real US bills, voted by an electorate that delegates to an ordered list of single-issue parties. The first one with an opinion speaks for you.",
};

/** Nothing here reads the session or the request, so the page can be cached. */
export const revalidate = 300;

async function stats() {
  try {
    // `bill_ai` is the honest count of bills the delegates have been shown;
    // `bill_results` only fills in when someone opens the page.
    const rows = await query<{ bills: number; judged: number; latest: string | null }>(
      `select (select count(*)::int from bills) as bills,
              (select count(*)::int from bill_ai) as judged,
              (select max(latest_action_date)::text from bills) as latest`,
    );
    return rows[0] ?? { bills: 0, judged: 0, latest: null };
  } catch {
    return { bills: 0, judged: 0, latest: null };
  }
}

export default async function Home() {
  const [{ bills, judged, latest }, recent] = await Promise.all([
    stats(),
    listBills({ limit: 4 }).catch(() => ({ items: [], total: 0 })),
  ]);

  return (
    <>
      <section className="border-b border-[var(--bd-line)] bg-white">
        <div className="bd-container grid gap-12 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div>
            <div className="bd-rule mb-6" />
            <h1 className="font-serif text-4xl font-semibold leading-[1.1] sm:text-5xl">
              Don&rsquo;t pick a party.
              <br />
              Pick an order.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--bd-muted)]">
              Rank single-issue delegates. Each is silent outside its subject, so the first
              with an opinion on a bill casts your vote.
            </p>
            <p className="mt-8 max-w-xl border-l-4 border-[var(--bd-blue)] bg-blue-50 px-4 py-3 leading-relaxed text-[var(--bd-blue-deep)]">
              <strong className="block font-serif text-lg">Your vote is never locked in.</strong>
              <span className="text-sm">
                Change your list whenever you like. Your latest saved list replaces the
                previous one.
              </span>
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/delegate"
                className="rounded-md bg-blue-700 px-5 py-3 font-medium text-white hover:bg-blue-800"
              >
                Build your list
              </Link>
              <Link
                href="/bills"
                className="rounded-md border border-[var(--bd-line)] bg-white px-5 py-3 font-medium hover:bg-blue-50"
              >
                See the bills
              </Link>
            </div>
          </div>

          <div className="self-start">
            <DelegationDiagram
              caption="Your list, walked from the top"
              bill="A bill recognising a religious holiday"
              steps={[
                { slug: SAMPLE_LIST[0], state: "silent", note: "Not its subject. Your vote falls past it." },
                { slug: SAMPLE_LIST[1], state: "votes", note: "Its subject. It votes yes and the walk stops." },
                { slug: SAMPLE_LIST[2], state: "unreached", note: "Never asked. Someone above it spoke." },
              ]}
              outcome={
                <>
                  yes, cast by your second delegate.{" "}
                  <Link href="/how-it-works" className="bd-link">
                    How it works
                  </Link>
                </>
              }
            />
          </div>
        </div>
      </section>

      <section className="bd-container py-14">
        <dl className="grid gap-6 sm:grid-cols-4">
          {[
            { n: bills.toLocaleString(), l: "real bills" },
            { n: judged.toLocaleString(), l: "put to the delegates" },
            { n: VOTING_PARTIES.length.toString(), l: "single-issue delegates" },
            { n: electorateStats.size.toLocaleString(), l: "simulated citizens" },
          ].map((s) => (
            <div key={s.l}>
              <dt className="font-serif text-3xl font-semibold text-[var(--bd-navy)]">{s.n}</dt>
              <dd className="text-sm text-[var(--bd-muted)]">{s.l}</dd>
            </div>
          ))}
        </dl>
        {latest && (
          <p className="mt-4 text-xs text-[var(--bd-muted)]">
            Latest action {shortDate(latest)}. New bills arrive daily.
          </p>
        )}
      </section>

      {recent.items.length > 0 && (
        <section className="bd-container pb-20">
          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-2xl font-semibold">Latest bills</h2>
            <Link href="/bills" className="bd-link text-sm">
              All bills →
            </Link>
          </div>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {recent.items.map((bill) => (
              <li key={bill.id}>
                <Link
                  href={`/bills/${bill.id}`}
                  className="bd-card block h-full p-5 transition-shadow hover:shadow-md hover:shadow-blue-900/5"
                >
                  <span className="font-mono text-xs font-semibold text-[var(--bd-blue-deep)]">
                    {billLabel(bill)}
                  </span>
                  <h3 className="mt-1.5 font-serif text-base font-semibold leading-snug">
                    {bill.title}
                  </h3>
                  {bill.plain_summary && (
                    <p className="mt-1.5 text-sm text-[var(--bd-muted)]">{bill.plain_summary}</p>
                  )}
                  {bill.yes_weight !== null && bill.no_weight !== null ? (
                    <div className="mt-4">
                      <VoteBar
                        yes={bill.yes_weight}
                        no={bill.no_weight}
                        blank={bill.blank_weight ?? 0}
                        height={6}
                      />
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-[var(--bd-muted)]">
                      Awaiting the delegates.
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
