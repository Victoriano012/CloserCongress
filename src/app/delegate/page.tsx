import type { Metadata } from "next";

import { auth } from "@/auth";
import { SignInButton, SignOutButton } from "@/components/auth-buttons";
import { DelegationEditor } from "@/components/delegation-editor";
import { GuestDelegationEditor } from "@/components/guest-delegation-editor";
import { ListRecord } from "@/components/list-record";
import { loadDelegation } from "@/lib/delegation";
import { BLANK_PARTY_SLUG } from "@/lib/parties";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description:
    "Build an ordered list of single-issue delegates. The first one with an opinion on a bill casts your vote.",
};

function SignedOut() {
  return (
    <div className="bd-container flex flex-col gap-8 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold">My list</h1>
          <div className="bd-rule mt-3" />
          <p className="mt-5 text-base leading-relaxed text-[var(--bd-ink)] lg:whitespace-nowrap">
            A bill walks down this list until it reaches a party with an opinion, and that
            party casts your vote.
          </p>
        </div>
        <SignInButton />
      </div>

      <GuestDelegationEditor />

      <p className="max-w-2xl text-xs leading-relaxed text-[var(--bd-muted)]">
        Saved in this browser only. Sign in to keep My List across devices: it is then
        encrypted under a key derived from your Google account id, which is never stored.
        Not end-to-end: this server reads My List to render this page.
      </p>
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
        <div>
          <h1 className="font-serif text-3xl font-semibold">My list</h1>
          <div className="bd-rule mt-3" />
          <p className="mt-5 text-base leading-relaxed text-[var(--bd-ink)] lg:whitespace-nowrap">
            A bill walks down this list until it reaches a party with an opinion, and that
            party casts your vote.
          </p>
        </div>
        <SignOutButton />
      </div>

      <DelegationEditor initial={delegation} />

      {stored ? <ListRecord delegation={stored} /> : null}

      <p className="max-w-2xl text-xs leading-relaxed text-[var(--bd-muted)]">
        Encrypted under a key derived from your Google account id, which is never stored.
        Not end-to-end: this server reads My List to render this page.
      </p>
    </div>
  );
}
