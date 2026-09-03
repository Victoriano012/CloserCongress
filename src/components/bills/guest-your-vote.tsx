"use client";

import Link from "next/link";

import { YourVote } from "@/components/your-vote";
import { hasDelegates, resolveVote, type PartyVoteRow } from "@/lib/my-list";
import { useGuestList } from "@/lib/use-guest-list";

const MUTED = "text-sm text-[var(--bd-muted)]";

/** The "Your vote" cell for a signed-out visitor, resolved from the guest list. */
export function GuestYourVote({ votes, clampReason }: { votes: PartyVoteRow[]; clampReason?: boolean }) {
  const guest = useGuestList();
  if (guest === undefined) return <p className={MUTED}>…</p>;
  if (!guest || !hasDelegates(guest)) {
    return <p className={MUTED}>No delegates yet — build My List to vote.</p>;
  }
  return <YourVote entry={resolveVote(guest, votes)} clampReason={clampReason} />;
}

/**
 * Shown above the "Your votes" filter for a signed-out visitor without a list.
 * `children` is the sign-in button, which only a server component can render.
 */
export function GuestVotesBanner({ children }: { children: React.ReactNode }) {
  const guest = useGuestList();
  if (guest === undefined || hasDelegates(guest)) return null;
  return (
    <div className="bd-card mt-6 flex flex-wrap items-center gap-4 p-5 text-sm">
      <p className="text-[var(--bd-ink)]">
        No delegates yet, so every bill is a blank vote.{" "}
        <Link href="/delegate" className="bd-link">
          Build My List
        </Link>{" "}
        to see how you voted, or sign in to use a list you saved before.
      </p>
      {children}
    </div>
  );
}
