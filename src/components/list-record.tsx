import Link from "next/link";

import { DelegateTally } from "@/components/delegate-tally";
import { OrderedChips } from "@/components/ordered-chips";
import type { Delegation } from "@/lib/delegation";
import { BLANK_PARTY_SLUG } from "@/lib/parties";
import { loadDelegationRecord } from "@/lib/record";

/** The saved list as stored, and how it has been voting on the recent bills. */
export async function ListRecord({ delegation }: { delegation: Delegation }) {
  const realDelegates = delegation.filter((slug) => slug !== BLANK_PARTY_SLUG);

  if (realDelegates.length === 0) {
    return (
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--bd-muted)]">
          Your saved list
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--bd-muted)]">
          Nothing saved yet, so every bill is a blank vote.
        </p>
      </section>
    );
  }

  const { counted, tally, blanks } = await loadDelegationRecord(delegation);

  return (
    <>
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--bd-muted)]">
          Your saved list
        </h2>
        <div className="mt-3">
          <OrderedChips slugs={[...realDelegates, BLANK_PARTY_SLUG]} />
        </div>
      </section>

      <section>
        <h2 className="font-serif text-xl font-semibold">
          {counted === 0
            ? "Who spoke"
            : `Who spoke, last ${counted} ${counted === 1 ? "bill" : "bills"}`}
        </h2>
        <div className="bd-rule mt-2" />
        {counted === 0 ? (
          <p className="bd-card mt-4 max-w-2xl p-6 text-sm leading-relaxed text-[var(--bd-muted)]">
            No bills classified yet. Check back shortly.
          </p>
        ) : (
          <>
            <div className="mt-4">
              <DelegateTally delegates={realDelegates} tally={tally} blanks={blanks} />
            </div>
            <p className="mt-3 text-sm text-[var(--bd-muted)]">
              <Link href="/me" className="bd-link">
                See it bill by bill
              </Link>
              .
            </p>
          </>
        )}
      </section>
    </>
  );
}
