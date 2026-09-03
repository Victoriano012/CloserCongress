"use client";

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

