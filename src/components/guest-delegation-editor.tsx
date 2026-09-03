"use client";

import { DelegationEditor } from "@/components/delegation-editor";
import { useGuestList } from "@/lib/use-guest-list";

/** The editor for a signed-out visitor, seeded from this browser's localStorage. */
export function GuestDelegationEditor() {
  const guest = useGuestList();
  // localStorage is unknowable until hydration; mounting the editor empty and
  // then refilling it would flash, so wait for the real initial value.
  if (guest === undefined) return <div aria-busy className="min-h-96" />;
  return <DelegationEditor initial={guest ?? []} guest />;
}
