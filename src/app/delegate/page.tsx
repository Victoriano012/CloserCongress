import Link from "next/link";
import type { Metadata } from "next";

import { auth } from "@/auth";
import { SignInButton, SignOutButton } from "@/components/auth-buttons";
import { DelegationEditor } from "@/components/delegation-editor";
import { loadDelegation } from "@/lib/delegation";
import { BLANK_PARTY_SLUG } from "@/lib/parties";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your list",
  description:
    "Build an ordered list of single-issue delegates. The first one with an opinion on a bill casts your vote.",
};

const EXAMPLE = [
  { n: 1, emoji: "🐾", name: "Pets and Animal Welfare Party" },
  { n: 2, emoji: "✝️", name: "Catholic Values Party" },
  { n: 3, emoji: "🤝", name: "Equal Rights Party" },
];

function SignedOut() {
  return (
    <div className="bd-container flex flex-col gap-8 py-12">
      <div className="max-w-2xl">
        <h1 className="font-serif text-3xl font-semibold">Your list</h1>
        <div className="bd-rule mt-3" />
        <p className="mt-5 text-base leading-relaxed text-[var(--bd-ink)]">
          An ordered list of single-issue parties. A bill walks down it until it reaches
          one with an opinion, and that party casts your vote. The order is the point:
          swapping two parties changes your vote on everything they disagree about.
        </p>
      </div>

      <section className="bd-card max-w-2xl p-6">
        <h2 className="font-serif text-lg font-semibold">A worked example</h2>
        <ol className="mt-4 flex flex-col gap-2">
          {EXAMPLE.map((row) => (
            <li key={row.n} className="flex items-center gap-3 text-sm">
              <span
                aria-hidden
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[var(--bd-navy)] text-xs font-bold text-white"
              >
                {row.n}
              </span>
              <span aria-hidden>{row.emoji}</span>
              <span className="font-medium">{row.name}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm leading-relaxed text-[var(--bd-muted)]">
          On an animal bill, the first party votes for you. On most of Congress it is
          silent, so the second speaks; then the third. If none has an opinion, your ballot
          is blank: present, counted, silent.
        </p>
      </section>

      <div className="flex flex-col gap-4">
        <SignInButton>Sign in with Google to build your list</SignInButton>
        <p className="max-w-2xl text-sm leading-relaxed text-[var(--bd-muted)]">
          Your list is encrypted under a key derived from your Google account id, which is
          never stored. A database dump reveals neither whose row it is nor what it says.
          Not end-to-end: this server reads your list to show it to you.
        </p>
      </div>
    </div>
  );
}

export default async function DelegatePage() {
  const session = await auth();
  if (!session?.user) return <SignedOut />;

  const delegation = (await loadDelegation()) ?? [BLANK_PARTY_SLUG];

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

      <p className="max-w-2xl text-xs leading-relaxed text-[var(--bd-muted)]">
        Encrypted under a key derived from your Google account id, which is never stored.
        Not end-to-end: this server reads your list to render this page.
      </p>
    </div>
  );
}
