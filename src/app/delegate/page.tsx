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

/** Sign-in button plus a note that it is optional. Stacked under the heading on mobile, right-aligned beside it on desktop. */
function SignInAside() {
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-right">
      <p className="text-xs leading-snug text-[var(--bd-muted)]">
        To save your list across devices
      </p>
      <SignInButton />
    </div>
  );
}

export default async function DelegatePage() {
  const session = await auth();
  const signedIn = Boolean(session?.user);
  const stored = signedIn ? await loadDelegation() : null;

  return (
    <div className="bd-container flex flex-col gap-8 py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold">My list</h1>
          <div className="bd-rule mt-3" />
          <p className="mt-5 text-base leading-relaxed text-[var(--bd-ink)] lg:whitespace-nowrap">
            A bill walks down this list until it reaches a party with an opinion, and that
            party casts your vote.
          </p>
        </div>
        {signedIn ? <SignOutButton /> : <SignInAside />}
      </div>

      {signedIn ? (
        <DelegationEditor initial={stored ?? [BLANK_PARTY_SLUG]} />
      ) : (
        <GuestDelegationEditor />
      )}

      {stored ? <ListRecord delegation={stored} /> : null}

      <p className="max-w-2xl text-xs leading-relaxed text-[var(--bd-muted)]">
        {signedIn ? (
          <>
            Encrypted under a key derived from your Google account id, which is never stored.
            Not end-to-end: this server reads My List to render this page.
          </>
        ) : (
          <>
            Saved in this browser only. If you sign in, My List is encrypted under a key
            derived from your Google account id, which is never stored. Not end-to-end: this
            server reads My List to render this page.
          </>
        )}
      </p>
    </div>
  );
}
