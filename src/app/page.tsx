import Link from "next/link";
import type { Metadata } from "next";

import { billLabel, listBills } from "@/lib/bills";
import { query } from "@/lib/db";
import { PARTY_BY_SLUG, VOTING_PARTIES } from "@/lib/parties";
// From the 4KB stats file, not @/lib/tally: that module imports the whole
// 200KB electorate to read one integer.
import electorateStats from "../../data/electorate-stats.json";
import { VoteBar } from "@/components/vote-bar";

export const metadata: Metadata = {
  title: "BetterDemocracy — lend your vote to a list, in order",
  description:
    "A demonstration of a legislature where your vote goes to an ordered list of single-issue delegates. Each one is silent outside its own subject, so on any given bill the first one with an opinion speaks for you.",
};

/** Nothing here reads the session or the request, so the page can be cached. */
export const revalidate = 300;

/**
 * The worked example that explains the whole idea in six seconds.
 *
 * Three states, and the difference between the last two is the point: a
 * delegate that was asked and had nothing to say lets the vote fall through;
 * one that was never reached got no say because someone above it spoke.
 */
const EXAMPLE = [
  {
    slug: "animal-welfare",
    state: "silent",
    badge: "no opinion here",
    note: "A religious holiday is not its subject, so it stays silent and your vote falls past it.",
  },
  {
    slug: "catholic-values",
    state: "voted",
    badge: "casts your vote",
    note: "Religious observance is its subject. It votes yes, and the walk stops here.",
  },
  {
    slug: "equal-rights",
    state: "unreached",
    badge: "not reached",
    note: "Never asked — someone above it already spoke.",
  },
] as const;

/** "2026-08-27" → "27 Aug 2026", without going near a timezone. */
function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
}

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
              Name several delegates, ranked. Each one cares about exactly one subject and
              stays silent on everything else — so a bill about animal testing is decided by
              your first choice, and on the other nine-tenths of Congress your vote falls
              through to whoever&rsquo;s business it actually is. They can never disagree:
              only one of them is ever asked.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
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

          {/* The mechanism, walked through. Visible to everyone, signed in or not. */}
          <div className="bd-card self-start overflow-hidden">
            <div className="border-b border-[var(--bd-line)] bg-[var(--bd-paper)] px-5 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--bd-muted)]">
                Your list, walked from the top
              </p>
              <p className="mt-1 font-serif text-base font-semibold text-[var(--bd-navy)]">
                A bill recognising a religious holiday
              </p>
            </div>
            <ol className="divide-y divide-[var(--bd-line)]">
              {EXAMPLE.map((row, i) => {
                const party = PARTY_BY_SLUG[row.slug];
                const voted = row.state === "voted";
                const unreached = row.state === "unreached";
                return (
                  <li
                    key={row.slug}
                    className={`flex items-start gap-3 px-5 py-3.5 ${
                      voted ? "bg-blue-50/70" : ""
                    } ${unreached ? "opacity-45" : ""}`}
                  >
                    <span
                      aria-hidden
                      className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11px] font-bold ${
                        voted
                          ? "bg-[var(--bd-blue)] text-white"
                          : "bg-[var(--bd-line)] text-[var(--bd-muted)]"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span
                          className={`text-[0.95rem] font-medium ${
                            voted ? "text-[var(--bd-navy)]" : "text-[var(--bd-ink)]"
                          } ${unreached ? "line-through decoration-[var(--bd-muted)]/50" : ""}`}
                        >
                          <span aria-hidden className="mr-1.5">
                            {party?.emoji}
                          </span>
                          {party?.name}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                            voted
                              ? "bg-[var(--bd-blue)] text-white"
                              : "border border-[var(--bd-line)] text-[var(--bd-muted)]"
                          }`}
                        >
                          {row.badge}
                        </span>
                      </span>
                      <span className="mt-1 block text-sm leading-6 text-[var(--bd-muted)]">
                        {row.note}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="border-t border-[var(--bd-line)] px-5 py-3 text-sm">
              <span className="font-semibold text-[var(--bd-navy)]">Result: </span>
              your ballot is a yes, cast by your second delegate — because your first one had
              nothing to say.{" "}
              <Link href="/how-it-works" className="bd-link">
                How it works
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bd-container py-14">
        <dl className="grid gap-6 sm:grid-cols-4">
          {[
            { n: bills.toLocaleString(), l: "real bills tracked" },
            { n: judged.toLocaleString(), l: "put to the delegates so far" },
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
            Last action in the record: {shortDate(latest)}. New bills arrive daily, and each
            one is put to the delegates as it is classified.
          </p>
        )}
      </section>

      {recent.items.length > 0 && (
        <section className="bd-container pb-20">
          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-2xl font-semibold">Latest before Congress</h2>
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
                  {/* These are the newest bills, so most of them are still in the
                      queue. Say so, rather than ending the card mid-air. */}
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
                      Not yet put to the delegates.
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
