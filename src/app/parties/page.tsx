import Link from "next/link";
import type { Metadata } from "next";
import {
  PARTIES,
  PARTY_BY_SLUG,
  VOTING_PARTIES,
  AXIS_LABELS,
  BLANK_PARTY_SLUG,
  OPPOSITE_OF,
  type Party,
  type PartyAxis,
} from "@/lib/parties";

export const metadata: Metadata = {
  title: "The parties",
  // Counted from the roster rather than spelled out, so it cannot drift out of
  // date the next time a party is added.
  description: `${VOTING_PARTIES.length} single-issue delegates, plus the blank vote. Each votes only on its own subject and abstains on everything else.`,
};

/** The axes in the order they first appear in the roster. */
function axesInRosterOrder(parties: Party[]): PartyAxis[] {
  const seen: PartyAxis[] = [];
  for (const party of parties) {
    if (!seen.includes(party.axis)) seen.push(party.axis);
  }
  return seen;
}

/** Logo and name only; the whole card is the link to the party's page. */
function PartyCard({ party }: { party: Party }) {
  return (
    <Link
      href={`/parties/${party.slug}`}
      className="bd-card group flex items-center gap-3 border-l-4 px-5 py-4 transition-shadow hover:shadow-[0_1px_12px_rgba(11,37,69,0.10)]"
      style={{ borderLeftColor: party.color }}
    >
      <span aria-hidden className="text-2xl leading-none">
        {party.emoji}
      </span>
      <h3 className="font-serif text-lg font-semibold leading-snug group-hover:text-[var(--bd-blue)]">
        {party.name}
      </h3>
    </Link>
  );
}

/** Two exact inverses, a red cross between them; the label is for screen readers only. */
function OppositePair({ a, b }: { a: Party; b: Party }) {
  return (
    <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr] sm:gap-4">
      <PartyCard party={a} />
      <p className="flex justify-center">
        <span
          aria-hidden
          className="grid size-8 place-items-center rounded-full border-2 border-red-600 text-base font-bold leading-none text-red-600"
        >
          ✕
        </span>
        <span className="sr-only">Opposite values</span>
      </p>
      <PartyCard party={b} />
    </div>
  );
}

/** A section's members: exact-opposite pairs first, then everyone else. */
function AxisMembers({ members }: { members: Party[] }) {
  const pairs: [Party, Party][] = [];
  const rest: Party[] = [];
  const placed = new Set<string>();
  for (const party of members) {
    if (placed.has(party.slug)) continue;
    const other = members.find((m) => m.slug === OPPOSITE_OF[party.slug]);
    if (other) {
      pairs.push([party, other]);
      placed.add(other.slug);
    } else {
      rest.push(party);
    }
  }

  return (
    <div className="mt-6 space-y-5">
      {pairs.map(([a, b]) => (
        <OppositePair key={a.slug} a={a} b={b} />
      ))}
      {rest.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((party) => (
            <PartyCard key={party.slug} party={party} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function PartiesPage() {
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
          your vote to the next name on your list. Open a party to see what it stands for and
          how it has voted.
        </p>
      </header>

      <div className="mt-14 space-y-14">
        {axes.map((axis) => (
          <section key={axis}>
            <h2 className="font-serif text-2xl font-semibold">{AXIS_LABELS[axis]}</h2>
            <div className="bd-rule mt-3" />
            <AxisMembers members={voting.filter((p) => p.axis === axis)} />
          </section>
        ))}
      </div>

      {blank ? (
        <section className="mt-16">
          <h2 className="font-serif text-2xl font-semibold">{AXIS_LABELS[blank.axis]}</h2>
          <div className="bd-rule mt-3" />
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <PartyCard party={blank} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
