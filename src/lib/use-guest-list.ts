"use client";

import { useMemo, useSyncExternalStore } from "react";

import { GUEST_LIST_KEY, parseGuestList, type Delegation } from "@/lib/my-list";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function snapshot(): string | null {
  try {
    return window.localStorage.getItem(GUEST_LIST_KEY);
  } catch {
    return null;
  }
}

/**
 * The signed-out visitor's list from this browser's localStorage.
 *
 * `undefined` while the server render and hydration have no way to know it;
 * `null` once we have looked and there is none.
 */
export function useGuestList(): Delegation | null | undefined {
  const raw = useSyncExternalStore(subscribe, snapshot, () => undefined);
  return useMemo(() => (raw === undefined ? undefined : parseGuestList(raw)), [raw]);
}
