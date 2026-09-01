"use client";

import Link from "next/link";

/**
 * Without this, a Neon cold-start timeout or a connection-limit blip turns a
 * page into Next's raw production error screen.
 */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="bd-container py-24">
      <div className="bd-rule mb-6" />
      <h1 className="font-serif text-3xl font-semibold">This page did not load</h1>
      <p className="mt-4 max-w-lg text-[var(--bd-muted)]">
        Something went wrong on our side — most likely the database was slow to wake up.
        Nothing you did caused it, and nothing was saved or lost.
      </p>
      <div className="mt-8 flex gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-blue-700 px-5 py-3 font-medium text-white hover:bg-blue-800"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-[var(--bd-line)] bg-white px-5 py-3 font-medium hover:bg-blue-50"
        >
          Back to the start
        </Link>
      </div>
    </div>
  );
}
