import Link from "next/link";
import type { Metadata } from "next";
import { ArticleHeader, Section, Toc } from "@/components/article";
import { DelegationDiagram } from "@/components/delegation-diagram";
import { SAMPLE_LIST, VOTING_PARTIES } from "@/lib/parties";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "A plain-language walkthrough of ordered delegation, abstention and the blank vote.",
};

const SECTIONS = [
  { id: "problem", label: "Two bad options" },
  { id: "two-ways", label: "Two ways to lend your vote" },
  { id: "fall-through", label: "What a list actually does" },
  { id: "sharp-edge", label: "The sharp edge" },
  { id: "blank-vote", label: "The blank vote" },
  { id: "counting", label: "How a bill passes" },
  { id: "real", label: "What is real here, and what is not" },
  { id: "start", label: "Build a list" },
];

/* ---------------------------------------------------------------------- page */

export default function HowItWorksPage() {
  return (
    <div className="bd-container py-14 sm:py-20">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-14">
        <article className="max-w-[68ch]">
          <ArticleHeader
            kicker="How it works"
            title="You should not have to buy a whole ideology to get one thing you care about."
          >
            Real bills from Congress, run past a population where everyone keeps an ordered
            list of single-issue delegates. Each bill is decided by the first delegate on the
            list with an opinion about it.
          </ArticleHeader>

          <Toc sections={SECTIONS} />

          <div className="mt-14 space-y-16">
            <Section id="problem" eyebrow="1" title="Two bad options">
              <p>
                Direct democracy: Congress moves thousands of bills, nobody has time to read
                them, so in practice a small unrepresentative handful decides everything.
              </p>
              <p>
                Representative democracy: you pick one party, once, and it speaks for you on
                abortion, submarines, farm subsidies and the postal service alike — even if you
                agree with it on four things out of forty.
              </p>
              <p className="font-medium text-[var(--bd-navy)]">
                The bundle is the problem, not the delegation.
              </p>
            </Section>

            <Section id="two-ways" eyebrow="2" title="Two ways to lend your vote">
              <ol className="space-y-4 border-l-2 border-[var(--bd-line)] pl-5">
                <li>
                  <span className="font-semibold text-[var(--bd-navy)]">Name a delegate.</span>{" "}
                  Each party here is single-issue: a narrow subject, a published stance inside
                  it, and nothing to say outside it.
                </li>
                <li>
                  <span className="font-semibold text-[var(--bd-navy)]">
                    Name several, in order.
                  </span>{" "}
                  Your list is walked from the top. The first delegate with an opinion on the
                  bill casts your vote; everyone below is never consulted.
                </li>
              </ol>
              <p>
                A list of five is not five ideologies fighting for control. It is a set of
                narrow experts, and which one speaks depends on what the bill is about.
              </p>
              <p className="rounded-lg border-l-4 border-[var(--bd-blue)] bg-white px-5 py-4">
                <strong className="text-[var(--bd-navy)]">Change your vote anytime.</strong>{" "}
                Reorder or replace delegates whenever you like. Once saved, the new list
                replaces the old one, so only your latest list is used on each bill.
              </p>
            </Section>

            <Section id="fall-through" eyebrow="3" title="What a list actually does">
              <p>
                Say your list is <strong>Animal Welfare</strong>, then{" "}
                <strong>Catholic Values</strong>, then <strong>Equal Rights</strong>.
              </p>

              <DelegationDiagram
                caption="Bill one"
                bill="A bill restricting cosmetic testing on animals"
                steps={[
                  { slug: SAMPLE_LIST[0], state: "votes", note: "Its subject. It votes yes and the walk stops." },
                  { slug: SAMPLE_LIST[1], state: "unreached", note: "Never consulted." },
                  { slug: SAMPLE_LIST[2], state: "unreached", note: "Never consulted." },
                ]}
                outcome="Yes, cast by the animal welfare party."
              />

              <DelegationDiagram
                caption="Bill two"
                bill="A bill recognising a religious holiday"
                steps={[
                  { slug: SAMPLE_LIST[0], state: "silent", note: "Not its subject. Your vote falls past it." },
                  { slug: SAMPLE_LIST[1], state: "votes", note: "Its subject. It votes and the walk stops." },
                  { slug: SAMPLE_LIST[2], state: "unreached", note: "Never consulted." },
                ]}
                outcome="Cast by your second delegate, because your first stayed silent."
              />

              <p>
                You are not ranking parties by how much you like them. You are saying: on
                this, speak for me; on everything else, keep going down the list.
              </p>
            </Section>

            <Section id="sharp-edge" eyebrow="4" title="The sharp edge">
              <p>
                A delegate abstains outside its subject{" "}
                <em>even when the people who run it would obviously have a view</em>. The
                animal welfare party has no position on income tax. Its members do. The party
                is a mandate about animals, not those people.
              </p>
              <p>
                That costs something: where your first delegate is silent, your vote is cast
                by someone you ranked lower, or by nobody.
              </p>
              <p className="rounded-lg border-l-4 border-[var(--bd-blue)] bg-white px-5 py-4">
                It is deliberate. Abstention is what stops a party you chose for one reason
                from speaking for you on forty others. A delegate with an opinion on everything
                would just be a political party again.
              </p>
            </Section>

            <Section id="blank-vote" eyebrow="5" title="The blank vote">
              <p>
                Every list ends with the <strong>Blank Vote Party</strong>. It has no subject
                and no stance, and abstains on everything.
              </p>
              <p>
                When the walk reaches the bottom of your list without finding an opinion, you
                are recorded as present and blank, not absent. A list of only the blank vote is
                a coherent position too; about a fifth of the simulated population holds it.
              </p>
            </Section>

            <Section id="counting" eyebrow="6" title="How a bill passes">
              <div className="bd-card px-5 py-5">
                <p className="font-serif text-lg font-semibold text-[var(--bd-navy)]">
                  A bill passes if more than half of the votes{" "}
                  <em>actually cast</em> are yes.
                </p>
                <p className="mt-3 text-[0.95rem] leading-7 text-[var(--bd-muted)]">
                  Cast means yes plus no. Blanks are counted and shown, but not in that
                  denominator.
                </p>
              </div>
              <p>
                So a blank is not a quiet no. 3,000 yes, 2,000 no and 5,000 blank passes on 60%
                of votes cast, at 50% participation. A tie fails; so does a bill nobody votes
                on.
              </p>
            </Section>

            <Section id="real" eyebrow="7" title="What is real here, and what is not">
              <ul className="space-y-4">
                <li className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--bd-yes)]"
                  />
                  <span>
                    <span className="font-semibold text-[var(--bd-navy)]">Real: </span>
                    the bills — sponsors, official summaries, and where a recorded vote
                    exists, what Congress did.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--bd-no)]"
                  />
                  <span>
                    <span className="font-semibold text-[var(--bd-navy)]">Not real: </span>
                    the parties. All {VOTING_PARTIES.length} delegates and
                    the blank vote are invented, and none stands in for a real organisation.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--bd-no)]"
                  />
                  <span>
                    <span className="font-semibold text-[var(--bd-navy)]">Not real: </span>
                    the electorate. 10,000 simulated citizens, with lists generated from
                    published survey data.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--bd-no)]"
                  />
                  <span>
                    <span className="font-semibold text-[var(--bd-navy)]">Not real: </span>
                    the party votes. An AI model reads each bill and decides, for every party,
                    whether it is that party&rsquo;s business and how it would vote.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--bd-blue)]"
                  />
                  <span>
                    <span className="font-semibold text-[var(--bd-navy)]">Yours: </span>
                    sign in and build a list, and every bill page shows which of your delegates
                    spoke for you. It does <em>not</em> move the simulated result — there are
                    nowhere near enough real users for that to mean anything.
                  </span>
                </li>
              </ul>
              <p className="text-[var(--bd-muted)]">
                Every number behind these choices is in the{" "}
                <Link className="bd-link" href="/methodology">
                  methodology
                </Link>
                .
              </p>
            </Section>

            <Section id="start" eyebrow="8" title="Build a list">
              <p>
                Pick three delegates, order them, then look at what happened to a bill you
                care about.
              </p>
              <div className="flex flex-col gap-3 pt-1 sm:flex-row">
                <Link
                  href="/delegate"
                  className="rounded-md bg-blue-700 px-5 py-3 text-center font-medium text-white transition-colors hover:bg-blue-800"
                >
                  Choose your delegates
                </Link>
                <Link
                  href="/bills"
                  className="rounded-md border border-[var(--bd-line)] bg-white px-5 py-3 text-center font-medium text-[var(--bd-blue-deep)] transition-colors hover:bg-blue-50"
                >
                  Browse the bills
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
