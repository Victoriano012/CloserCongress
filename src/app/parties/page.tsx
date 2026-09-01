import Link from "next/link";
import type { Metadata } from "next";
import { query } from "@/lib/db";
import {
  PARTIES,
  PARTY_BY_SLUG,
  VOTING_PARTIES,
  AXIS_LABELS,
  BLANK_PARTY_SLUG,
  type Party,
  type PartyAxis,
} from "@/lib/parties";

// A static roster plus one daily-changing aggregate; no session, no search params.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "The parties",
  // Counted from the roster rather than spelled out, so it cannot drift out of
  // date the next time a party is added.
  description: `${VOTING_PARTIES.length} single-issue delegates, plus the blank vote. Each votes only on its own subject and abstains on everything else.`,
};

type Counts = { yes: number; no: number; abstain: number };

/**
 * Per-party vote counts, if the classifier has produced any. Deliberately
 * best-effort: the table fills in the background and an empty or unreachable
 * one must never take the roster down.
 */
async function loadCounts(): Promise<Record<string, Counts> | null> {
  try {
    const rows = await query<{ party_slug: string; vote: string; n: number }>(
      "select party_slug, vote, count(*)::int as n from party_votes group by party_slug, vote",
    );
    if (!rows.length) return null;

    const counts: Record<string, Counts> = {};
    for (const row of rows) {
      const entry = (counts[row.party_slug] ??= { yes: 0, no: 0, abstain: 0 });
      if (row.vote === "yes" || row.vote === "no" || row.vote === "abstain") {
        entry[row.vote] = row.n;
      }
    }
    return counts;
  } catch {
    return null;
  }
}

/** The axes in the order they first appear in the roster. */
function axesInRosterOrder(parties: Party[]): PartyAxis[] {
  const seen: PartyAxis[] = [];
  for (const party of parties) {
    if (!seen.includes(party.axis)) seen.push(party.axis);
  }
  return seen;
}

function PartyCard({ party, counts }: { party: Party; counts: Counts | undefined }) {
  /** Every bill this party was shown — the denominator the counters lacked. */
  const seen = counts ? counts.yes + counts.no + counts.abstain : 0;

  return (
    <Link
      href={`/parties/${party.slug}`}
      className="bd-card group flex flex-col gap-3 border-l-4 p-5 transition-shadow hover:shadow-[0_1px_12px_rgba(11,37,69,0.10)]"
      style={{ borderLeftColor: party.color }}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-2xl leading-none">
          {party.emoji}
        </span>
        <h3 className="font-serif text-lg font-semibold leading-snug group-hover:text-[var(--bd-blue)]">
          {party.name}
        </h3>
      </div>

      <p className="text-sm text-[var(--bd-ink)]">{party.tagline}</p>

      <p className="text-sm leading-relaxed text-[var(--bd-muted)]">
        <span className="font-medium text-[var(--bd-ink)]">Votes on:</span> {party.scope}
      </p>

      {counts ? (
        <p className="mt-auto border-t border-[var(--bd-line)] pt-3 text-xs leading-relaxed text-[var(--bd-muted)]">
          {counts.yes + counts.no === 0
            ? `Silent on all ${seen} bills so far.`
            : `Spoke on ${counts.yes + counts.no} of ${seen} bills; silent on the rest.`}
        </p>
      ) : null}
    </Link>
  );
}

export default async function PartiesPage() {
  const counts = await loadCounts();
  const blank = PARTY_BY_SLUG[BLANK_PARTY_SLUG];
  const voting = PARTIES.filter((p) => p.slug !== BLANK_PARTY_SLUG);
  const axes = axesInRosterOrder(voting);

  return (
    <div className="bd-container py-12">
      <header className="max-w-3xl">
        <h1 className="font-serif text-4xl font-semibold">The parties</h1>
        <div className="bd-rule mt-4" />
        <p className="mt-6 text-[15px] leading-relaxed text-[var(--bd-muted)]">
          Each party votes only on bills inside its subject and abstains on the rest, handing
          your vote to the next name on your list.
        </p>
      </header>

      <div className="mt-14 space-y-14">
        {axes.map((axis) => {
          const members = voting.filter((p) => p.axis === axis);
          return (
            <section key={axis}>
              <h2 className="font-serif text-2xl font-semibold">{AXIS_LABELS[axis]}</h2>
              <div className="bd-rule mt-3" />
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {members.map((party) => (
                  <PartyCard key={party.slug} party={party} counts={counts?.[party.slug]} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {blank ? (
        <section className="mt-16">
          <h2 className="font-serif text-2xl font-semibold">{AXIS_LABELS[blank.axis]}</h2>
          <div className="bd-rule mt-3" />
          <Link
            href={`/parties/${blank.slug}`}
            className="bd-card mt-6 flex flex-col gap-4 border-dashed p-6 transition-shadow hover:shadow-[0_1px_12px_rgba(11,37,69,0.10)] sm:flex-row sm:items-start sm:gap-6"
            style={{ borderColor: blank.color }}
          >
            <span aria-hidden className="text-3xl leading-none">
              {blank.emoji}
            </span>
            <div className="max-w-3xl space-y-3">
              <h3 className="font-serif text-xl font-semibold">{blank.name}</h3>
              <p className="text-sm text-[var(--bd-ink)]">{blank.tagline}</p>
              <p className="text-sm leading-relaxed text-[var(--bd-muted)]">
                Ends every list. Casts a blank when no delegate above it has an opinion, or
                stands alone for someone who does not want to vote.
              </p>
            </div>
          </Link>
        </section>
      ) : null}
    </div>
  );
}
