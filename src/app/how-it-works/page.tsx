import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ArticleHeader, Section, Toc } from "@/components/article";
import { DelegationDiagram } from "@/components/delegation-diagram";
import { SAMPLE_LIST } from "@/lib/parties";

export const metadata: Metadata = {
  description:
    "Don't pick a party every four years. Pick your preferences, whenever you want. How My List turns an ordered list of parties into your vote on every real bill.",
};

const SECTIONS = [
  { id: "intro", label: "Pick your preferences" },
  { id: "problems", label: "Two problems with Congress today" },
  { id: "solution", label: "How Closer Congress solves both" },
  { id: "details", label: "The details" },
  { id: "start", label: "Build My List" },
];

function ProblemCard({ title, tag, children }: { title: string; tag: string; children: ReactNode }) {
  return (
    <div className="bd-card flex flex-col gap-3 px-5 py-5">
      <h3 className="font-serif text-xl font-semibold text-[var(--bd-navy)]">{title}</h3>
      <div className="space-y-3 text-[0.95rem] leading-7">{children}</div>
      <p className="mt-auto border-t border-[var(--bd-line)] pt-3 text-sm font-medium text-[var(--bd-blue-deep)]">
        {tag}
      </p>
    </div>
  );
}

function Detail({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <div id={id} className="scroll-mt-24 space-y-4">
      <h3 className="font-serif text-xl font-semibold text-[var(--bd-navy)]">{title}</h3>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------------- page */

export default function HowItWorksPage() {
  return (
    <div className="bd-container py-14 sm:py-20">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-14">
        <article className="max-w-[68ch]">
          <div id="intro" className="scroll-mt-24">
            <ArticleHeader
              kicker="How it works"
              title="Don’t pick a party every four years. Pick your preferences, whenever you want."
            >
              This page explains what is wrong with a single ballot every four years, and how
              Closer Congress lets you vote on every real bill instead.
            </ArticleHeader>
          </div>

          <Toc sections={SECTIONS} />

          <div className="mt-14 space-y-16">
            <Section id="problems" title="Two problems with Congress today">
              <div className="grid gap-4 sm:grid-cols-2">
                <ProblemCard
                  title="You vote once every four years"
                  tag="This is the “every four years” half."
                >
                  <p>
                    One ballot has to stand in for your opinion on hundreds of bills you
                    haven&rsquo;t seen yet, on subjects nobody had raised when you voted.
                  </p>
                  <p>
                    When your representative votes against you, there is nothing you can do
                    about it until the next election.
                  </p>
                </ProblemCard>
                <ProblemCard
                  title="You have to pick one party"
                  tag="This is the “pick a party” half."
                >
                  <p>
                    No party matches you on everything. To get the issues you care about, you
                    have to bundle them with the ones you disagree with.
                  </p>
                  <p>
                    Any view that isn&rsquo;t a party&rsquo;s headline position is lost in the
                    bundle, however many people hold it.
                  </p>
                </ProblemCard>
              </div>
            </Section>

            <Section id="solution" title="How Closer Congress solves both">
              <p>
                Instead of one party, you keep an ordered list of parties:{" "}
                <Link className="bd-link" href="/delegate">
                  My List
                </Link>
                . Each party covers one subject and says nothing outside it, so the order of
                your list is your preferences, issue by issue.
              </p>
              <p>
                Every real bill that reaches Congress is put to your list. The bill walks down
                it until it hits a party with a position on that bill, and that party casts
                your vote.
              </p>
              <p className="rounded-lg border-l-4 border-[var(--bd-blue)] bg-white px-5 py-4">
                <strong className="text-[var(--bd-navy)]">
                  The list is yours, so you can reorder or change it whenever you want.
                </strong>{" "}
                Your representation updates continuously, not every four years.
              </p>
            </Section>

            <Section id="details" title="The details">
              <Detail id="building-my-list" title="Building My List">
                <p>
                  Add a party, remove it, or drag it to a new position. There is no limit on
                  how many parties you can add; a party only ever appears once.
                </p>
                <p>
                  My List works without signing in. It is saved in your browser, and every
                  bill page shows how it voted. Sign in only if you want the same list on
                  another device.
                </p>
              </Detail>

              <Detail id="how-a-bill-is-decided" title="How a bill is decided">
                <p>
                  Say My List reads <strong>Animal Welfare</strong>, then{" "}
                  <strong>Catholic Values</strong>, then <strong>Equal Rights</strong>.
                </p>
                <DelegationDiagram
                  caption="A bill, walked down My List"
                  bill="A bill recognising a religious holiday"
                  steps={[
                    { slug: SAMPLE_LIST[0], state: "silent", note: "Not its subject. The bill walks past it." },
                    { slug: SAMPLE_LIST[1], state: "votes", note: "Its subject. It votes and the walk stops." },
                    { slug: SAMPLE_LIST[2], state: "unreached", note: "Never consulted." },
                  ]}
                  outcome="Cast by your second party, because your first had no position."
                />
                <p>
                  The first party on your list with a position on the bill casts your vote.
                  Everything below it is never consulted.
                </p>
                <p>
                  If the walk reaches the bottom without finding a position, your vote on that
                  bill is blank: you are counted as present, but neither yes nor no.
                </p>
                <p>
                  Some parties are exact opposites, answering the same questions the other
                  way round. Put both on your list and the higher one always speaks first, so
                  the lower one never votes. My List points these pairs out so you can decide
                  which one you meant.
                </p>
              </Detail>

              <Detail id="where-the-bills-come-from" title="Where the bills come from">
                <p>
                  The bills are real: sponsors, official summaries and recorded votes come from
                  Congress. New bills are pulled in every night at 4 AM Eastern, and the
                  status of bills still in progress is refreshed at the same time.
                </p>
                <p>
                  Only bills Congress has already passed or failed are shown, so every bill
                  can be compared with what Congress actually did.
                </p>
              </Detail>

              <Detail id="comparing-outcomes" title="Comparing outcomes">
                <p>
                  Every bill shows three columns. <strong>In Congress</strong> is the real
                  result and the recorded yea, nay and not-voting counts.{" "}
                  <strong>In Closer Congress</strong> is what happens when the same bill is
                  put to a population of lists instead of representatives.{" "}
                  <strong>Your vote</strong> is how My List voted, and through which party.
                </p>
                <p>
                  The bars under the first two columns show the split between yes, no and
                  blank, so you can see at a glance how close each result was.
                </p>
              </Detail>

              <Detail id="changing-your-mind" title="Changing your mind">
                <p>
                  Edit My List and the change applies immediately, to every bill already shown
                  and to every bill that arrives afterwards. Nothing is locked in, and there is
                  no election to wait for.
                </p>
              </Detail>
            </Section>

            <Section id="start" title="Build My List">
              <p>
                Pick a few parties, put them in order, then look at what happened to a bill
                you care about.
              </p>
              <div className="flex flex-col gap-3 pt-1 sm:flex-row">
                <Link
                  href="/delegate"
                  className="rounded-md bg-blue-700 px-5 py-3 text-center font-medium text-white transition-colors hover:bg-blue-800"
                >
                  Build My List
                </Link>
              </div>
            </Section>
          </div>
        </article>

        <Toc sections={SECTIONS} sticky />
      </div>
    </div>
  );
}
