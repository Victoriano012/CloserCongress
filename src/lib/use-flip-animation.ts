"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** How long a reordered row takes to slide into its new slot. */
export const FLIP_DURATION_MS = 500;

/**
 * FLIP animation for a list whose children carry `data-flip-key`.
 *
 * Call `snapshot()` right before the state update that reorders the list. After
 * React commits, every keyed child that moved is translated back to where it
 * was and then transitioned to its new position. Without a snapshot (or with
 * `prefers-reduced-motion`) the update renders instantly, as before.
 */
export function useFlipAnimation<T extends HTMLElement>(deps: unknown) {
  const ref = useRef<T>(null);
  const before = useRef<Map<string, number> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [animating, setAnimating] = useState(false);

  function children(): HTMLElement[] {
    return Array.from(ref.current?.querySelectorAll<HTMLElement>("[data-flip-key]") ?? []);
  }

  function snapshot() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    before.current = new Map(
      children().map((el) => [el.dataset.flipKey!, el.getBoundingClientRect().top]),
    );
    setAnimating(true);
  }

  useLayoutEffect(() => {
    const prev = before.current;
    before.current = null;
    if (!prev) return;

    const moving: HTMLElement[] = [];
    for (const el of children()) {
      const old = prev.get(el.dataset.flipKey!);
      if (old === undefined) continue;
      const delta = old - el.getBoundingClientRect().top;
      if (!delta) continue;
      el.style.transition = "none";
      el.style.transform = `translateY(${delta}px)`;
      moving.push(el);
    }

    // Flush the starting transforms before switching the transition on.
    void ref.current?.offsetHeight;
    for (const el of moving) {
      el.style.transition = `transform ${FLIP_DURATION_MS}ms ease-in-out`;
      el.style.transform = "";
    }

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(
      () => {
        for (const el of moving) el.style.transition = "";
        timer.current = null;
        setAnimating(false);
      },
      moving.length ? FLIP_DURATION_MS : 0,
    );
  }, [deps]);

  useLayoutEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { ref, snapshot, animating };
}
