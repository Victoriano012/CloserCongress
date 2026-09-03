import Link from "next/link";

import { PartyChip } from "@/components/party-chip";
import { resolveVote, type PartyVoteRow } from "@/lib/my-list";
import { BLANK_PARTY_SLUG, PARTY_BY_SLUG } from "@/lib/parties";

export function Section({
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

/**
 * One list, walked the way the simulation walks every citizen's, so the reader
 * can see which delegate ended up speaking. `own` when it is the reader's own
 * list; otherwise it is the sample list shown to visitors without one.
 */
export function YourVoteSection({
  list, votes, own,
}: { list: readonly string[]; votes: PartyVoteRow[]; own: boolean }) {
  const mine = votes.length ? resolveVote(list, votes) : null;
  const skipped = mine ? list.slice(0, Math.max(list.indexOf(mine.party), 0)) : [];

  return (
    <Section
      title={own ? "Your vote" : "A sample list"}
      note={
        own
          ? "My List, walked the way the simulation walks everyone's."
          : "Three names, walked the way the simulation walks every list."
      }
    >
      <div className="bd-card p-6">
        {!own && (
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
              {own ? "You voted" : "It voted"}{" "}
              <strong style={{ color: mine.vote === "yes" ? "var(--bd-yes)" : "var(--bd-no)" }}>
                {mine.vote === "yes" ? "in favour" : "against"}
              </strong>
              , through <PartyChip slug={mine.party} size="md" />
            </p>
            {mine.reason && (
              <p className="mt-3 border-l-2 border-[var(--bd-line)] pl-4 text-sm text-[var(--bd-muted)]">
                “{mine.reason}”
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
            {own ? "Your vote was" : "Its vote was"} <strong>blank</strong>. None of
            the {list.filter((d) => d !== BLANK_PARTY_SLUG).length} delegates had an
            opinion.
          </p>
        )}
        <Link href="/delegate" className="bd-link mt-4 inline-block text-sm">
          {own ? "Edit My List" : "Build My List"}
        </Link>
      </div>
    </Section>
  );
}
