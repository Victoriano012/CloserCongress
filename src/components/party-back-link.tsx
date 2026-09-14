"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

/**
 * Party pages are statically cached, so the origin lives in a `?from=` param
 * read on the client rather than in `searchParams`, which would make the
 * whole page dynamic.
 */
export function PartyBackLink() {
  const fromDelegate = useSearchParams().get("from") === "delegate";
  return (
    <Link href={fromDelegate ? "/delegate" : "/parties"} className="bd-link text-sm">
      ← {fromDelegate ? "My list" : "All parties"}
    </Link>
  );
}
