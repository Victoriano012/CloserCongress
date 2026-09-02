import Link from "next/link";
import type { Metadata } from "next";

import { auth } from "@/auth";
import { SignInButton, SignOutButton } from "@/components/auth-buttons";
import { DelegationEditor } from "@/components/delegation-editor";
import { ListRecord } from "@/components/list-record";
import { loadDelegation } from "@/lib/delegation";
import { BLANK_PARTY_SLUG } from "@/lib/parties";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your list",
  description:
    "Build an ordered list of single-issue delegates. The first one with an opinion on a bill casts your vote.",
};

function SignedOut() {
  return (
    <div className="bd-container flex flex-col gap-8 py-12">
      <div className="max-w-2xl">
        <h1 className="font-serif text-3xl font-semibold">Your list</h1>
        <div className="bd-rule mt-3" />
        <p className="mt-5 text-base leading-relaxed text-[var(--bd-ink)]">
          An ordered list of single-issue parties. A bill walks down it until it reaches
          one with an opinion, and that party casts your vote. Swapping two parties changes
          your vote on everything they disagree about.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <SignInButton />
        <p className="max-w-2xl text-sm leading-relaxed text-[var(--bd-muted)]">
          Your list is encrypted under a key derived from your Google account id, which is
          never stored. Not end-to-end: this server reads your list to show it to you.
        </p>
      </div>
    </div>
  );
}

export default async function DelegatePage() {
  const session = await auth();
  if (!session?.user) return <SignedOut />;

  const stored = await loadDelegation();
  const delegation = stored ?? [BLANK_PARTY_SLUG];

  return (
    <div className="bd-container flex flex-col gap-8 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="font-serif text-3xl font-semibold">Your list</h1>
          <div className="bd-rule mt-3" />
          <p className="mt-5 text-base leading-relaxed text-[var(--bd-ink)]">
            A bill walks down this list until it reaches a party with an opinion, and that
            party casts your vote.{" "}
            <Link href="/me" className="bd-link">
              See how it has been voting
            </Link>
            .
          </p>
        </div>
        <SignOutButton />
      </div>

      <DelegationEditor initial={delegation} />

      {stored ? <ListRecord delegation={stored} /> : null}

      <p className="max-w-2xl text-xs leading-relaxed text-[var(--bd-muted)]">
        Encrypted under a key derived from your Google account id, which is never stored.
        Not end-to-end: this server reads your list to render this page.
      </p>
    </div>
  );
}
