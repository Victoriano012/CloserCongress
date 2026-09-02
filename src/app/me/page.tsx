import Link from "next/link";
import type { Metadata } from "next";

import { auth } from "@/auth";
import { SignInButton } from "@/components/auth-buttons";
import { DelegateTally } from "@/components/delegate-tally";
import { OrderedChips } from "@/components/ordered-chips";
import { PartyChip } from "@/components/party-chip";
import { VoteTag } from "@/components/vote-tag";
import { billLabel } from "@/lib/bills";
import { shortDate } from "@/lib/dates";
import { loadDelegation } from "@/lib/delegation";
import { BLANK_PARTY_SLUG, SAMPLE_LIST } from "@/lib/parties";
import { loadDelegationRecord } from "@/lib/record";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your record",
  description:
    "Bill by bill, which of your delegates spoke for you and how it voted.",
};

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="bd-container flex flex-col gap-8 py-12">{children}</div>;
}

function Heading({ title = "Your record" }: { title?: string }) {
  return (
    <header className="max-w-2xl">
      <h1 className="font-serif text-3xl font-semibold">{title}</h1>
      <div className="bd-rule mt-3" />
    </header>
  );
}

export default async function MePage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <Shell>
        <Heading title="Where your vote goes" />
        <div className="max-w-2xl space-y-4 text-base leading-relaxed text-[var(--bd-ink)]">
          <p>
            On each bill, the first delegate on your list with an opinion casts your vote.
            A list of three:
          </p>
          <OrderedChips slugs={[...SAMPLE_LIST, BLANK_PARTY_SLUG]} />
          <p>
            Sign in and this page shows, bill by real bill, which of your delegates spoke
            and how it voted.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <SignInButton />
          <Link href="/how-it-works" className="bd-link text-sm">
            How it works
          </Link>
        </div>
      </Shell>
    );
  }

  const delegation = await loadDelegation();
  const realDelegates = (delegation ?? []).filter((slug) => slug !== BLANK_PARTY_SLUG);

  if (!delegation || realDelegates.length === 0) {
    return (
      <Shell>
        <Heading />
        <p className="max-w-2xl text-base leading-relaxed text-[var(--bd-ink)]">
          No delegates yet, so every bill is a blank vote.{" "}
          <Link href="/delegate" className="bd-link">
            Build your list
          </Link>
          .
        </p>
      </Shell>
    );
  }

  const { resolved, counted, tally, blanks } = await loadDelegationRecord(delegation);

  return (
    <Shell>
      <Heading />

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--bd-muted)]">
          Your list
        </h2>
        <div className="mt-3">
          <OrderedChips slugs={[...realDelegates, BLANK_PARTY_SLUG]} />
        </div>
        <p className="mt-3 text-sm text-[var(--bd-muted)]">
          <Link href="/delegate" className="bd-link">
            Edit your list
          </Link>
          .
        </p>
      </section>

      {counted === 0 ? (
        <p className="bd-card max-w-2xl p-6 text-sm leading-relaxed text-[var(--bd-muted)]">
          No bills classified yet. Check back shortly.
        </p>
      ) : (
        <>
          <section>
            <h2 className="font-serif text-xl font-semibold">
              Who spoke, last {counted} {counted === 1 ? "bill" : "bills"}
            </h2>
            <div className="bd-rule mt-2" />
            <div className="mt-4">
              <DelegateTally delegates={realDelegates} tally={tally} blanks={blanks} />
            </div>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold">Bill by bill</h2>
            <div className="bd-rule mt-2" />
            <ul className="mt-4 flex flex-col gap-3">
              {resolved.map((entry) => {
                const date = shortDate(entry.bill.latest_action_date);
                return (
                  <li key={entry.bill.id} className="bd-card p-5">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <Link
                        href={`/bills/${entry.bill.id}`}
                        className="font-serif text-base font-semibold text-[var(--bd-navy)] hover:text-[var(--bd-blue)]"
                      >
                        {billLabel(entry.bill)}
                      </Link>
                      <span className="min-w-0 flex-1 text-sm leading-snug text-[var(--bd-ink)]">
                        {entry.bill.title}
                      </span>
                      {date ? (
                        <span className="text-xs tabular-nums text-[var(--bd-muted)]">
                          {date}
                        </span>
                      ) : null}
                    </div>

                    {!entry.classified ? (
                      <p className="mt-3 text-sm text-[var(--bd-muted)]">Not classified yet.</p>
                    ) : (
                      <div className="mt-3 flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <PartyChip slug={entry.party} />
                          <VoteTag vote={entry.vote} />
                          <span className="text-xs text-[var(--bd-muted)]">
                            {entry.vote === "abstain"
                              ? `all ${entry.silentAbove} delegates silent`
                              : entry.silentAbove === 0
                                ? "first choice"
                                : `${entry.silentAbove} silent above`}
                          </span>
                        </div>
                        {entry.reason ? (
                          <p className="text-sm leading-relaxed text-[var(--bd-muted)]">
                            {entry.reason}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </Shell>
  );
}
