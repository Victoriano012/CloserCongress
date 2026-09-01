import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { billLabel } from "@/lib/bills";
import { shortDate } from "@/lib/dates";
import { query } from "@/lib/db";
import { PARTY_BY_SLUG } from "@/lib/parties";

// A static roster plus one daily-changing aggregate; no session, no search params.
export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

type Counts = { yes: number; no: number; abstain: number };

type RecordRow = {
  vote: string;
  reason: string | null;
  id: string;
  title: string;
  bill_type: string;
  number: number;
  latest_action_date: string | null;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const party = PARTY_BY_SLUG[slug];
  if (!party) return { title: "Unknown party" };
  return { title: party.name, description: party.tagline };
}

/**
 * The party's record. Best-effort on purpose: the classifier fills these tables
 * in the background, so an empty or unreachable table degrades to "no votes yet"
 * rather than a 500.
 */
async function loadRecord(
  slug: string,
): Promise<{ counts: Counts | null; rows: RecordRow[] }> {
  try {
    const [countRows, rows] = await Promise.all([
      query<{ vote: string; n: number }>(
        `select vote, count(*)::int as n from party_votes
          where party_slug = $1 group by vote`,
        [slug],
      ),
      query<RecordRow>(
        `select pv.vote, pv.reason, b.id, b.title, b.bill_type, b.number, b.latest_action_date::text
           from party_votes pv
           join bills b on b.id = pv.bill_id
          where pv.party_slug = $1 and pv.vote <> 'abstain'
          order by b.latest_action_date desc nulls last
          limit 15`,
        [slug],
      ),
    ]);

    if (!countRows.length) return { counts: null, rows };

    const counts: Counts = { yes: 0, no: 0, abstain: 0 };
    for (const row of countRows) {
      if (row.vote === "yes" || row.vote === "no" || row.vote === "abstain") {
        counts[row.vote] = row.n;
      }
    }
    return { counts, rows };
  } catch {
    return { counts: null, rows: [] };
  }
}

function VoteTag({ vote }: { vote: string }) {
  const tone =
    vote === "yes" ? "var(--bd-yes)" : vote === "no" ? "var(--bd-no)" : "var(--bd-blank)";
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide"
      style={{ borderColor: tone, color: tone, background: `${tone}12` }}
    >
      {vote}
    </span>
  );
}

/** The record as a sentence: abstentions need their denominator beside them. */
function Record({ counts, isBlank }: { counts: Counts; isBlank: boolean }) {
  const spoke = counts.yes + counts.no;
  const seen = spoke + counts.abstain;

  if (isBlank) {
    return (
      <p className="mt-6 text-[15px] leading-relaxed">
        Blank on all {seen} bills, by construction: it is never put to the model.
      </p>
    );
  }

  if (spoke === 0) {
    return (
      <p className="mt-6 max-w-2xl text-[15px] leading-relaxed">
        Silent on all {seen} bills so far.
      </p>
    );
  }

  return (
    <p className="mt-6 max-w-2xl text-[15px] leading-relaxed">
      Spoke on {spoke} of {seen} bills:{" "}
      <strong className="font-semibold text-[var(--bd-yes)]">{counts.yes} yes</strong>,{" "}
      <strong className="font-semibold text-[var(--bd-no)]">{counts.no} no</strong>. Silent
      on the other {counts.abstain}.
    </p>
  );
}

export default async function PartyPage({ params }: Props) {
  const { slug } = await params;
  const party = PARTY_BY_SLUG[slug];
  if (!party) notFound();

  const { counts, rows } = await loadRecord(slug);

  return (
    <div className="bd-container py-12">
      <Link href="/parties" className="bd-link text-sm">
        ← All parties
      </Link>

      <header
        className="bd-card mt-5 border-l-4 p-7"
        style={{ borderLeftColor: party.color }}
      >
        <div className="flex items-start gap-4">
          <span aria-hidden className="text-4xl leading-none">
            {party.emoji}
          </span>
          <div>
            <h1 className="font-serif text-3xl font-semibold">{party.name}</h1>
            <p className="mt-2 text-[15px] text-[var(--bd-muted)]">{party.tagline}</p>
          </div>
        </div>
      </header>

      <section className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="bd-card p-6">
          <h2 className="font-serif text-xl font-semibold">What it votes on</h2>
          <div className="bd-rule mt-3" />
          <p className="mt-4 text-[15px] leading-relaxed">{party.scope}</p>
        </div>
        <div className="bd-card p-6">
          <h2 className="font-serif text-xl font-semibold">How it votes</h2>
          <div className="bd-rule mt-3" />
          <p className="mt-4 text-[15px] leading-relaxed">{party.stance}</p>
        </div>
      </section>

      <p className="mt-4 text-sm text-[var(--bd-muted)]">
        {party.isBlank
          ? "This party is never shown a bill; its abstention is hardcoded."
          : "Those two paragraphs are the literal instruction the AI delegate is handed for every bill — nothing else."}
      </p>

      <section className="mt-12">
        <h2 className="font-serif text-2xl font-semibold">Its record</h2>
        <div className="bd-rule mt-3" />

        {counts ? (
          <Record counts={counts} isBlank={Boolean(party.isBlank)} />
        ) : (
          <p className="mt-6 text-[15px] text-[var(--bd-muted)]">No votes recorded yet.</p>
        )}

        {rows.length ? (
          <>
            <h3 className="mt-10 font-serif text-lg font-semibold">
              Recent votes
            </h3>
            <ul className="mt-4 space-y-4">
              {rows.map((row) => (
                <li key={row.id} className="bd-card p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <Link href={`/bills/${row.id}`} className="bd-link font-medium">
                      <span className="text-[var(--bd-muted)]">{billLabel(row)}</span>{" "}
                      {row.title}
                    </Link>
                    <VoteTag vote={row.vote} />
                  </div>
                  {row.reason ? (
                    <p className="mt-3 text-sm leading-relaxed text-[var(--bd-muted)]">
                      {row.reason}
                    </p>
                  ) : null}
                  {row.latest_action_date ? (
                    <p className="mt-2 text-xs tabular-nums text-[var(--bd-muted)]">
                      Latest action {shortDate(row.latest_action_date)}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
    </div>
  );
}
