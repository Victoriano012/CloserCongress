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
    "Build an ordered list of single-issue delegates. The first one with an opinion on a bill casts your vote; everyone else stays silent.",
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
          A delegation is an ordered list of single-issue parties. Every party claims a
          narrow subject and abstains on everything else, so a bill walks down your list
          until it reaches someone who actually has an opinion — and that party casts your
          vote.
        </p>
        <p className="mt-4 text-base leading-relaxed text-[var(--bd-ink)]">
          The order is the whole point. It is not a multi-select: moving a party from
          second to first changes how you vote on everything the two of them disagree
          about.
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
          On a bill about shelters, testing on animals or endangered species, the animal
          party votes for you. On everything it has nothing to say about — which is most
          of Congress — the Catholic party speaks instead. When neither of them claims the
          subject, the Equal Rights Party does. If none of the three has an opinion, your
          ballot is recorded as blank: present, counted, and deliberately silent.
        </p>
      </section>

      <div className="flex flex-col gap-4">
        <SignInButton>Sign in with Google to build your list</SignInButton>
        <p className="max-w-2xl text-sm leading-relaxed text-[var(--bd-muted)]">
          Your list is stored encrypted under a key derived from your Google account id,
          and that id is itself never stored — it lives only in your own session cookie.
          A database dump would show neither whose row it is nor what it says. It is not
          end-to-end encrypted, though: this server can read your list while it is serving
          you a page, so it protects you against a database leak, not against us.
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
            An ordered list of single-issue parties. A bill walks down it until it reaches
            someone with an opinion on that subject, and that party casts your vote.
          </p>
          <p className="mt-3 text-sm text-[var(--bd-muted)]">
            <Link href="/me" className="bd-link">
              See how your list has been voting
            </Link>
            .
          </p>
        </div>
        <SignOutButton />
      </div>

      <DelegationEditor initial={delegation} />

      <p className="max-w-2xl text-xs leading-relaxed text-[var(--bd-muted)]">
        Stored encrypted under a key derived from your Google account id, which is never
        itself stored — so a database leak reveals neither whose row this is nor what it
        says. Not end-to-end encrypted: this server reads your list to render this page.
      </p>
    </div>
  );
}
