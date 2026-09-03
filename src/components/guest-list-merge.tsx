"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { mergeGuestDelegationAction } from "@/app/actions/delegation";
import { clearGuestList, readGuestList, type Delegation } from "@/lib/my-list";

/**
 * For signed-in users only. If this browser still holds a guest list, hand it
 * to the account (uploaded when the account is empty, dropped when the account
 * already has one), forget the guest copy, and report the account's list.
 * Pass null while signed out to do nothing.
 */
export function useGuestListMerge(onMerged: ((account: Delegation) => void) | null) {
  useEffect(() => {
    if (!onMerged) return;
    const guest = readGuestList(window.localStorage);
    if (guest === null) return;
    let cancelled = false;
    mergeGuestDelegationAction(guest).then((merged) => {
      // Null means the session is gone: keep the guest copy for next time.
      if (cancelled || merged === null) return;
      clearGuestList(window.localStorage);
      onMerged(merged);
    });
    return () => {
      cancelled = true;
    };
    // Runs once on mount: the guest list only changes while signed out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Merges, then re-renders the page so it shows the account's list. */
export function GuestListMerge() {
  const router = useRouter();
  useGuestListMerge(() => router.refresh());
  return null;
}
