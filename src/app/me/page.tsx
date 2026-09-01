import Link from "next/link";
import type { Metadata } from "next";

import { auth } from "@/auth";
import { SignInButton } from "@/components/auth-buttons";
import { PartyChip } from "@/components/party-chip";
import { billLabel } from "@/lib/bills";
import { shortDate } from "@/lib/dates";
import { query } from "@/lib/db";
import { loadDelegation } from "@/lib/delegation";
import { BLANK_PARTY_SLUG, PARTY_BY_SLUG } from "@/lib/parties";
import { resolveForDelegation, type Vote } from "@/lib/tally";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your record",
  description:
    "Bill by bill, which of your delegates spoke for you and how it voted.",
};

const RECENT_LIMIT = 25;

/** Shown to a signed-out reader: the same trio the rest of the site uses. */
const SAMPLE_LIST = ["animal-welfare", "catholic-values", "equal-rights"];

type BillRow = {
  id: string;
  title: string;
  bill_type: string;
  number: number;
  latest_action_date: string | Date | null;
};

type VoteRow = { bill_id: string; party_slug: string; vote: string; reason: string | null };

function isVote(value: string): value is Vote {
  return value === "yes" || value === "no" || value === "abstain";
}

/** Recent classified bills and the party votes on them. Best-effort: never a 500. */
async function loadRecent(): Promise<{ bills: BillRow[]; votes: VoteRow[] }> {
  let bills: BillRow[] = [];
  try {
    bills = await query<BillRow>(
      `select b.id, b.title, b.bill_type, b.number, b.latest_action_date::text
         from bills b
         join bill_ai a on a.bill_id = b.id
        order by b.latest_action_date desc nulls last, b.id desc
        limit $1`,
      [RECENT_LIMIT],
    );
  } catch {
    return { bills: [], votes: [] };
  }

  if (!bills.length) return { bills: [], votes: [] };

  try {
    const votes = await query<VoteRow>(
      `select pv.bill_id, pv.party_slug, pv.vote, pv.reason
         from party_votes pv
        where pv.bill_id = any($1)`,
      [bills.map((b) => b.id)],
    );
    return { bills, votes };
  } catch {
    return { bills, votes: [] };
  }
}

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

/** A list of delegates in rank order, numbered the way the editor numbers them. */
function OrderedChips({ slugs }: { slugs: string[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {slugs.map((slug, i) => (
        <li key={slug} className="flex items-center gap-1.5">
          <span className="text-xs font-semibold tabular-nums text-[var(--bd-muted)]">
            {i + 1}.
          </span>
          <PartyChip slug={slug} />
        </li>
      ))}
    </ol>
  );
}

function VoteBadge({ vote }: { vote: Vote }) {
  const style =
    vote === "yes"
      ? "border-[var(--bd-yes)] text-[var(--bd-yes)]"
      : vote === "no"
        ? "border-[var(--bd-no)] text-[var(--bd-no)]"
        : "border-[var(--bd-blank)] text-[var(--bd-blank)]";
  const label = vote === "yes" ? "Yes" : vote === "no" ? "No" : "Blank";
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${style}`}
    >
      {label}
    </span>
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

  const { bills, votes } = await loadRecent();

  const byBill = new Map<string, VoteRow[]>();
  for (const row of votes) {
    const bucket = byBill.get(row.bill_id);
    if (bucket) bucket.push(row);
    else byBill.set(row.bill_id, [row]);
  }

  const resolved = bills.map((bill) => {
    const rows = byBill.get(bill.id) ?? [];
    const map: Record<string, Vote> = {};
    for (const row of rows) if (isVote(row.vote)) map[row.party_slug] = row.vote;

    const outcome = resolveForDelegation(delegation, map);
    const rank = delegation.indexOf(outcome.party);
    const reason =
      rows.find((row) => row.party_slug === outcome.party)?.reason ?? null;

    return {
      bill,
      classified: rows.length > 0,
      party: outcome.party,
      vote: outcome.vote,
      /** Delegates ahead of the one that spoke — all of them abstained. */
      silentAbove: rank >= 0 ? rank : realDelegates.length,
      reason,
    };
  });

  const counted = resolved.filter((entry) => entry.classified);

  const tally = new Map<string, number>();
  for (const entry of counted) {
    if (entry.vote === "abstain") continue;
    tally.set(entry.party, (tally.get(entry.party) ?? 0) + 1);
  }
  const blanks = counted.filter((entry) => entry.vote === "abstain").length;

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

      {counted.length === 0 ? (
        <p className="bd-card max-w-2xl p-6 text-sm leading-relaxed text-[var(--bd-muted)]">
          No bills classified yet. Check back shortly.
        </p>
      ) : (
        <>
          <section>
            <h2 className="font-serif text-xl font-semibold">
              Who spoke, last {counted.length} {counted.length === 1 ? "bill" : "bills"}
            </h2>
            <div className="bd-rule mt-2" />
            <ul className="mt-4 flex flex-wrap gap-2">
              {realDelegates.map((slug, i) => {
                const n = tally.get(slug) ?? 0;
                return (
                  <li
                    key={slug}
                    className={`bd-card flex items-center gap-2 px-3 py-2 text-sm ${
                      n === 0 ? "opacity-60" : ""
                    }`}
                  >
                    <span className="text-xs font-semibold tabular-nums text-[var(--bd-muted)]">
                      {i + 1}.
                    </span>
                    <span aria-hidden>{PARTY_BY_SLUG[slug]?.emoji}</span>
                    <span className="font-medium">{PARTY_BY_SLUG[slug]?.name ?? slug}</span>
                    <span className="tabular-nums text-[var(--bd-muted)]">
                      {n} {n === 1 ? "vote" : "votes"}
                    </span>
                  </li>
                );
              })}
              <li className="bd-card flex items-center gap-2 border-dashed px-3 py-2 text-sm">
                <span aria-hidden>⬜</span>
                <span className="font-medium text-[var(--bd-muted)]">Nobody</span>
                <span className="tabular-nums text-[var(--bd-muted)]">
                  {blanks} blank{blanks === 1 ? "" : "s"}
                </span>
              </li>
            </ul>
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
                          <VoteBadge vote={entry.vote} />
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
