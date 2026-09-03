"use client";

import { YourVoteSection } from "@/components/bills/your-vote-section";
import type { PartyVoteRow } from "@/lib/my-list";
import { SAMPLE_LIST } from "@/lib/parties";
import { useGuestList } from "@/lib/use-guest-list";

/**
 * For a signed-out visitor: their own list from this browser when they have
 * built one, otherwise the sample list. Nothing until hydration tells us which.
 */
export function GuestYourVoteSection({ votes }: { votes: PartyVoteRow[] }) {
  const guest = useGuestList();
  if (guest === undefined) return null;
  if (guest) return <YourVoteSection list={guest} votes={votes} own />;
  if (votes.length === 0) return null;
  return <YourVoteSection list={SAMPLE_LIST} votes={votes} own={false} />;
}
