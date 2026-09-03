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
  { id: "intro", label: "A Congress closer to the people" },
  { id: "problems", label: "Two problems with Congress today" },
  { id: "solution", label: "How Closer Congress solves both" },
  { id: "building-my-list", label: "Building My List" },
  { id: "your-vote", label: "How your vote is decided" },
  { id: "bill-outcome", label: "How a bill is decided" },
  { id: "bills", label: "Where the bills come from" },
  { id: "comparing", label: "Comparing outcomes" },
  { id: "changing", label: "Changing your mind" },
  { id: "start", label: "Build My List" },
];

/** One of a side-by-side pair: a heading, a few short paragraphs, and a one-line takeaway. */
function Card({ title, takeaway, children }: { title: string; takeaway: string; children: ReactNode }) {
  return (
    <div className="bd-card flex flex-col gap-3 px-5 py-5">
      <h3 className="font-serif text-xl font-semibold text-[var(--bd-navy)]">{title}</h3>
      <div className="space-y-3 text-[0.95rem] leading-7">{children}</div>
      <p className="mt-auto border-t border-[var(--bd-line)] pt-3 text-sm font-medium text-[var(--bd-blue-deep)]">
        {takeaway}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------------- page */

export default function HowItWorksPage() {
  return (
    <div className="bd-container py-14 sm:py-20">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-14">
        <article className="max-w-[68ch]">
          <div id="intro" className="scroll-mt-24">
            <ArticleHeader
              kicker="How it works"
              title="A new Congress, closer to the people."
            >
              What is wrong with a single ballot every four years, and how Closer Congress lets
              you vote on every real bill instead, whenever you want.
            </ArticleHeader>
          </div>

          <Toc sections={SECTIONS} />

          <div className="mt-14 space-y-16">
            <Section id="problems" title="Two problems with Congress today">
              <div className="grid gap-4 sm:grid-cols-2">
                <Card
                  title="You vote once every four years"
                  takeaway="You should be able to change your mind whenever you want."
                >
                  <p>
                    One ballot has to stand in for your opinion on hundreds of bills you
                    haven&rsquo;t seen yet, on subjects nobody had raised when you voted.
                  </p>
                  <p>
                    When your representative votes against you, there is nothing you can do
                    about it until the next election.
                  </p>
                </Card>
                <Card
                  title="You have to pick one party"
                  takeaway="You should be able to pick your preferences, not a package."
                >
                  <p>
                    No party matches you on everything. To get the issues you care about, you
                    have to bundle them with the ones you disagree with.
                  </p>
                  <p>
                    Any view that isn&rsquo;t a party&rsquo;s headline position is lost in the
                    bundle, however many people hold it.
                  </p>
                </Card>
              </div>
            </Section>

            <Section id="solution" title="How Closer Congress solves both">
              <div className="grid gap-4 sm:grid-cols-2">
                <Card
                  title="You vote on every bill, whenever you want"
                  takeaway="Your representation updates continuously, not every four years."
                >
                  <p>
                    Every real bill that reaches Congress is put to your list, so you have a
                    vote on each one, not a single ballot that has to cover them all.
                  </p>
                  <p>
                    The list is yours. Reorder it or change it whenever you want, and your vote
                    on every bill changes with it.
                  </p>
                </Card>
                <Card
                  title="You keep an ordered list of parties"
                  takeaway="Your preferences, issue by issue, instead of one party for everything."
                >
                  <p>
                    Instead of one party, you keep{" "}
                    <Link className="bd-link" href="/delegate">
                      My List
                    </Link>
                    : an ordered list of parties. Each one covers a single subject and says
                    nothing outside it.
                  </p>
                  <p>
                    A bill walks down your list until it hits a party with a position, and that
                    party casts your vote.
                  </p>
                </Card>
              </div>
            </Section>

            <Section id="building-my-list" title="Building My List">
              <p>
                Add a party, remove it, or drag it to a new position. There is no limit on how
                many parties you can add; a party only ever appears once.
              </p>
              <p>
                My List works without signing in. It is saved in your browser, and every bill
                page shows how it voted. Sign in only if you want the same list on another
                device.
              </p>
            </Section>

            <Section id="your-vote" title="How your vote is decided">
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
                Some parties are exact opposites, answering the same questions the other way
                round. Put both on your list and the higher one always speaks first, so the
                lower one never votes. My List points these pairs out so you can decide which
                one you meant.
              </p>
            </Section>

            <Section id="bill-outcome" title="How a bill is decided">
              <p>
                Every list is walked the same way yours is, and the votes are added up. A bill
                passes in Closer Congress if more than half of the votes actually cast are yes.
              </p>
              <p>
                Cast means yes plus no. Blank votes are counted and shown, but they don&rsquo;t
                push a bill either way. A tie fails, and so does a bill nobody votes on.
              </p>
            </Section>

            <Section id="bills" title="Where the bills come from">
              <p>
                The bills are real: sponsors, official summaries and recorded votes come from
                Congress. New bills are pulled in every night at 4 AM Eastern, and the status
                of bills still in progress is refreshed at the same time.
              </p>
              <p>
                Only bills Congress has already passed or failed are shown, so every bill can
                be compared with what Congress actually did.
              </p>
            </Section>

            <Section id="comparing" title="Comparing outcomes">
              <p>
                Every bill shows three columns. <strong>In Congress</strong> is the real result
                and the recorded yea, nay and not-voting counts.{" "}
                <strong>In Closer Congress</strong> is what happens when the same bill is put
                to a population of lists instead of representatives.{" "}
                <strong>Your vote</strong> is how My List voted, and through which party.
              </p>
              <p>
                The bars under the first two columns show the split between yes, no and blank,
                so you can see at a glance how close each result was.
              </p>
            </Section>

            <Section id="changing" title="Changing your mind">
              <p>
                Edit My List and the change applies immediately to every bill that arrives
                from then on. Nothing is locked in, and there is no election to wait for.
              </p>
            </Section>

            <Section id="start" title="Build My List">
              <p>
                Pick a few parties, put them in order, then look at what happened to a bill you
                care about.
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
