import type { Metadata } from "next";

import { auth } from "@/auth";
import { SignInButton, SignOutButton } from "@/components/auth-buttons";
import { DelegationEditor } from "@/components/delegation-editor";
import { GuestDelegationEditor } from "@/components/guest-delegation-editor";
import { ListRecord } from "@/components/list-record";
import { PageHeader } from "@/components/page-header";
import { loadDelegation } from "@/lib/delegation";
import { BLANK_PARTY_SLUG } from "@/lib/parties";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description:
    "Build an ordered list of single-issue delegates. The first one with an opinion on a bill casts your vote.",
};

/** Sign-in button with a note underneath that it is optional. Right-aligned both under the heading on mobile and beside it on desktop. */
function SignInAside() {
  return (
    <div className="flex flex-col items-end gap-1">
      <SignInButton />
      <p className="text-right text-xs leading-snug text-[var(--bd-muted)]">
        To save your list across devices
      </p>
    </div>
  );
}

export default async function DelegatePage() {
  const session = await auth();
  const signedIn = Boolean(session?.user);
  const stored = signedIn ? await loadDelegation() : null;

  return (
    <div className="bd-container py-12">
      <PageHeader
        title="My list"
        subtitle="A bill walks down this list until it reaches a party with an opinion, and that party casts your vote."
        aside={signedIn ? <SignOutButton /> : <SignInAside />}
      />

      <div className="flex flex-col gap-8">
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
    </div>
  );
}
