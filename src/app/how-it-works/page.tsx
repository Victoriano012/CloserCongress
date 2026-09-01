import Link from "next/link";
import type { Metadata } from "next";
import { PARTIES } from "@/lib/parties";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Hand each real bill to the first delegate on your list who has an opinion about it. A plain-language walkthrough of ordered delegation, abstention and the blank vote.",
};

const SECTIONS = [
  { id: "problem", label: "The problem" },
  { id: "three-ways", label: "Two ways to lend a vote" },
  { id: "fall-through", label: "The list, worked through" },
  { id: "sharp-edge", label: "The sharp edge" },
  { id: "blank-vote", label: "The blank vote" },
  { id: "counting", label: "How votes are counted" },
  { id: "real", label: "What is real and what is not" },
  { id: "start", label: "Where to start" },
];

/* --------------------------------------------------------------- primitives */

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--bd-muted)]">
        {eyebrow}
      </p>
      <h2 className="mt-2 font-serif text-2xl font-semibold sm:text-[1.75rem]">{title}</h2>
      <div className="bd-rule mt-4" />
      <div className="mt-6 space-y-5 text-[1.0625rem] leading-8 text-[var(--bd-ink)]">
        {children}
      </div>
    </section>
  );
}

/* ------------------------------------------------------- fall-through diagram */

type StepState = "votes" | "silent" | "unreached";

type Step = {
  rank: number;
  emoji: string;
  name: string;
  state: StepState;
  note: string;
};

/*
  Three states, not two. "Silent" and "not reached" look alike on a page and
  mean opposite things: a silent delegate was asked and had nothing to say,
  which is exactly what lets the vote fall through; an unreached one never got
  the question, because someone above it had already spoken.
*/
const STEP_STYLE: Record<
  StepState,
  { label: string; row: string; num: string; badge: string; name: string; arrow: string }
> = {
  votes: {
    label: "votes",
    row: "bg-blue-50/70",
    num: "bg-[var(--bd-blue)] text-white",
    badge: "bg-[var(--bd-blue)] text-white",
    name: "text-[var(--bd-navy)]",
    arrow: "←",
  },
  silent: {
    label: "silent",
    row: "",
    num: "bg-[var(--bd-line)] text-[var(--bd-muted)]",
    badge: "border border-[var(--bd-line)] text-[var(--bd-muted)]",
    name: "text-[var(--bd-ink)]",
    arrow: "↓",
  },
  unreached: {
    label: "not reached",
    row: "opacity-45",
    num: "bg-[var(--bd-line)] text-[var(--bd-muted)]",
    badge: "border border-[var(--bd-line)] text-[var(--bd-muted)]",
    name: "text-[var(--bd-muted)] line-through decoration-[var(--bd-muted)]/50",
    arrow: "",
  },
};

function DelegationDiagram({
  caption,
  bill,
  steps,
  outcome,
}: {
  caption: string;
  bill: string;
  steps: Step[];
  outcome: string;
}) {
  return (
    <figure className="bd-card overflow-hidden">
      <div className="border-b border-[var(--bd-line)] bg-[var(--bd-paper)] px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--bd-muted)]">
          {caption}
        </p>
        <p className="mt-1 font-serif text-base font-semibold text-[var(--bd-navy)]">{bill}</p>
      </div>

      <ol className="divide-y divide-[var(--bd-line)]">
        {steps.map((step) => {
          const style = STEP_STYLE[step.state];
          return (
            <li key={step.rank} className={`flex items-start gap-3 px-5 py-3.5 ${style.row}`}>
              <span
                aria-hidden
                className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11px] font-bold ${style.num}`}
              >
                {step.rank}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className={`text-[0.95rem] font-medium ${style.name}`}>
                    <span aria-hidden className="mr-1.5">
                      {step.emoji}
                    </span>
                    {step.name}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${style.badge}`}
                  >
                    {style.label}
                  </span>
                </span>
                <span className="mt-1 block text-sm leading-6 text-[var(--bd-muted)]">
                  {step.note}
                </span>
              </span>

              <span
                aria-hidden
                className={`mt-0.5 shrink-0 text-lg leading-6 ${
                  step.state === "votes" ? "text-[var(--bd-blue)]" : "text-[var(--bd-muted)]"
                }`}
              >
                {style.arrow}
              </span>
            </li>
          );
        })}
      </ol>

      <figcaption className="border-t border-[var(--bd-line)] bg-white px-5 py-3 text-sm text-[var(--bd-ink)]">
        <span className="font-semibold text-[var(--bd-navy)]">Result: </span>
        {outcome}
      </figcaption>
    </figure>
  );
}

/* ---------------------------------------------------------------------- page */

export default function HowItWorksPage() {
  return (
    <div className="bd-container py-14 sm:py-20">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-14">
        <article className="max-w-[68ch]">
          <header>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--bd-blue)]">
              How it works
            </p>
            <h1 className="mt-3 font-serif text-4xl font-semibold leading-[1.15] sm:text-5xl">
              You should not have to buy a whole ideology to get one thing you care about.
            </h1>
            <p className="mt-6 text-lg leading-8 text-[var(--bd-muted)]">
              This site takes real bills from the United States Congress and runs them past a
              population that votes a different way: everyone keeps an ordered list of
              single-issue delegates, and each bill is decided by the first delegate on that
              list who actually has an opinion about it.
            </p>
            <div className="bd-rule mt-8" />
          </header>

          {/* Table of contents — inline on small screens */}
          <nav
            aria-label="On this page"
            className="bd-card mt-10 px-5 py-4 lg:hidden"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--bd-muted)]">
              On this page
            </p>
            <ol className="mt-3 space-y-1.5 text-sm">
              {SECTIONS.map((s, i) => (
                <li key={s.id} className="flex gap-2">
                  <span className="tabular-nums text-[var(--bd-muted)]">{i + 1}.</span>
                  <a className="bd-link" href={`#${s.id}`}>
                    {s.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-14 space-y-16">
            <Section id="problem" eyebrow="1" title="Two bad options">
              <p>
                Direct democracy sounds fair until you look at the workload. Congress moves
                thousands of bills. Reading even the summaries is a part-time job, and almost
                all of them are about something you know nothing about. Nobody has the time,
                so in practice direct democracy means a small, unrepresentative handful of
                people deciding everything.
              </p>
              <p>
                Representative democracy solves the time problem by selling you a bundle. You
                pick one party, once, and that party then speaks for you on abortion,
                submarines, farm subsidies, data privacy and the postal service alike. If you
                agree with it on four things out of forty, that is still the deal.
              </p>
              <p className="font-medium text-[var(--bd-navy)]">
                The idea here is that the bundle is the problem, not the delegation. Handing
                your vote to someone who has read the bill is sensible. Handing all of it to
                one organisation forever is not.
              </p>
            </Section>

            <Section id="three-ways" eyebrow="2" title="Two ways to lend your vote">
              <p>
                There are two, and the second one is the reason this site exists:
              </p>
              <ol className="space-y-4 border-l-2 border-[var(--bd-line)] pl-5">
                <li>
                  <span className="font-semibold text-[var(--bd-navy)]">Name a delegate.</span>{" "}
                  Pick one of the parties on this site and it votes for you. Each one is
                  single-issue by design: it has a narrow subject, a published stance inside
                  that subject, and nothing to say outside it.
                </li>
                <li>
                  <span className="font-semibold text-[var(--bd-navy)]">
                    Name several, in order.
                  </span>{" "}
                  This is the actual point of the site. Your list is walked from the top. The
                  first delegate with an opinion on this particular bill casts your vote and
                  the walk stops there. Everyone below them is never consulted.
                </li>
              </ol>
              <p>
                Because each delegate only claims one subject, a list of five is not five
                overlapping ideologies fighting for control. It is a set of narrow experts,
                and which one gets to speak depends entirely on what the bill is about.
              </p>
            </Section>

            <Section id="fall-through" eyebrow="3" title="What a list actually does">
              <p>
                Say your list is <strong>Animal Welfare</strong>, then{" "}
                <strong>Catholic Values</strong>, then <strong>Equal Rights</strong>. Here are
                two bills and what happens to each of them.
              </p>

              <DelegationDiagram
                caption="Bill one"
                bill="A bill restricting cosmetic testing on animals"
                steps={[
                  {
                    rank: 1,
                    emoji: "🐾",
                    name: "Pets and Animal Welfare Party",
                    state: "votes",
                    note: "Animal testing is squarely its subject. It votes yes, and the walk stops here.",
                  },
                  {
                    rank: 2,
                    emoji: "✝️",
                    name: "Catholic Values Party",
                    state: "unreached",
                    note: "Never consulted — your first delegate already spoke.",
                  },
                  {
                    rank: 3,
                    emoji: "🤝",
                    name: "Equal Rights Party",
                    state: "unreached",
                    note: "Never consulted — someone above it already spoke.",
                  },
                ]}
                outcome="Your ballot is a yes, cast by the animal welfare party."
              />

              <DelegationDiagram
                caption="Bill two"
                bill="A bill recognising a religious holiday"
                steps={[
                  {
                    rank: 1,
                    emoji: "🐾",
                    name: "Pets and Animal Welfare Party",
                    state: "silent",
                    note: "No animals in this bill. It was asked, it has nothing to say, and your vote falls past it.",
                  },
                  {
                    rank: 2,
                    emoji: "✝️",
                    name: "Catholic Values Party",
                    state: "votes",
                    note: "Religious observance is its subject. It votes, and the walk stops here.",
                  },
                  {
                    rank: 3,
                    emoji: "🤝",
                    name: "Equal Rights Party",
                    state: "unreached",
                    note: "Never consulted — someone above it already spoke.",
                  },
                ]}
                outcome="Your ballot is cast by your second delegate — because your first one stayed silent."
              />

              <p>
                That fall-through is the whole mechanism. You are not ranking parties by how
                much you like them in general. You are saying: on the things I care most
                about, this one speaks for me; on everything else, keep going down the list
                until you find someone whose business it actually is.
              </p>
            </Section>

            <Section id="sharp-edge" eyebrow="4" title="The sharp edge, stated honestly">
              <p>
                A delegate abstains on everything outside its subject{" "}
                <em>even when the people who run it would obviously have had a view</em>. The
                animal welfare party has no position on income tax brackets. The people in it
                certainly do. The party does not, because the party is not those people — it
                is a mandate about animals, and nothing else.
              </p>
              <p>
                That costs something real. On a bill where your first delegate stays silent,
                your vote is cast by someone you ranked lower, and sometimes by nobody at all.
                It can feel like your voice went missing.
              </p>
              <p className="rounded-lg border-l-4 border-[var(--bd-blue)] bg-white px-5 py-4">
                It is deliberate. Abstention outside scope is exactly what stops a party you
                chose for one reason from quietly speaking for you on forty other things. A
                delegate that had an opinion about everything would just be a political party
                again, and we already know what that costs.
              </p>
            </Section>

            <Section id="blank-vote" eyebrow="5" title="The blank vote">
              <p>
                Every list ends with the same entry, whether you put it there or not: the{" "}
                <strong>Blank Vote Party</strong>. It has no subject and no stance. It abstains
                on everything, forever, by design.
              </p>
              <p>
                It is what happens when the walk reaches the bottom of your list without
                finding anyone with an opinion. Rather than recording you as absent, the
                system records you as present and blank — you turned up, and you declined to
                take a side. It can also be someone&rsquo;s only entry: a list of just the
                blank vote is a perfectly coherent position, and about a fifth of the
                simulated population holds exactly that.
              </p>
            </Section>

            <Section id="counting" eyebrow="6" title="How a bill passes">
              <p>
                Once every citizen&rsquo;s list has been walked, the count is simple, and the
                detail matters:
              </p>
              <div className="bd-card px-5 py-5">
                <p className="font-serif text-lg font-semibold text-[var(--bd-navy)]">
                  A bill passes if more than half of the votes{" "}
                  <em>actually cast</em> are yes.
                </p>
                <p className="mt-3 text-[0.95rem] leading-7 text-[var(--bd-muted)]">
                  Votes actually cast means yes votes plus no votes. Blanks are counted,
                  reported and visible — but they are not in that denominator.
                </p>
              </div>
              <p>
                So a blank is not a quiet no. If 3,000 people vote yes, 2,000 vote no and 5,000
                come out blank, the bill passes on 60% of the votes cast, with a participation
                rate of 50%. Abstaining lowers participation; it does not raise the bar.
              </p>
              <p>
                An exact tie fails: yes has to be strictly more than half. And if literally
                nobody casts a vote — every delegate in the country stayed silent — the bill
                does not pass either.
              </p>
              <p>
                This is what makes the blank vote a real option rather than a trick. Choosing
                not to take a side genuinely means not taking a side, instead of being
                converted into opposition on your behalf.
              </p>
            </Section>

            <Section id="real" eyebrow="7" title="What is real here, and what is not">
              <p>Plainly, so there is no confusion:</p>
              <ul className="space-y-4">
                <li className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--bd-yes)]"
                  />
                  <span>
                    <span className="font-semibold text-[var(--bd-navy)]">Real: </span>
                    the bills. They are pulled from public congressional data, with their real
                    sponsors, their real official summaries, and — where a recorded vote
                    exists — what Congress actually did with them.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--bd-no)]"
                  />
                  <span>
                    <span className="font-semibold text-[var(--bd-navy)]">Not real: </span>
                    the parties. All {PARTIES.filter((p) => !p.isBlank).length} delegates, and the blank
                    vote that ends every list,
                    are invented for this demonstration. No such organisation exists, and none
                    of them is standing in for a real one.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--bd-no)]"
                  />
                  <span>
                    <span className="font-semibold text-[var(--bd-navy)]">Not real: </span>
                    the electorate. The 10,000 citizens are simulated. Their delegation lists
                    were generated from published survey data about American opinion, but no
                    one of them is a person.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--bd-no)]"
                  />
                  <span>
                    <span className="font-semibold text-[var(--bd-navy)]">Not real: </span>
                    the party votes. An AI model reads each bill and decides, for every party
                    at once, whether the bill is that party&rsquo;s business and how it would
                    vote. There are no humans in that loop.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--bd-blue)]"
                  />
                  <span>
                    <span className="font-semibold text-[var(--bd-navy)]">Yours: </span>
                    if you sign in and build a list, it is saved and every bill page will show
                    you which of your delegates ended up speaking for you. It does{" "}
                    <em>not</em> move the simulated result. There are nowhere near enough real
                    users for that to mean anything, and pretending otherwise would make the
                    number worse, not better.
                  </span>
                </li>
              </ul>
              <p className="text-[var(--bd-muted)]">
                Every one of those choices, and every number behind them, is written up in the{" "}
                <Link className="bd-link" href="/methodology">
                  methodology
                </Link>
                , including the parts that do not flatter the design.
              </p>
            </Section>

            <Section id="start" eyebrow="8" title="Build a list">
              <p>
                The fastest way to understand any of this is to pick three delegates, put them
                in an order, and then go and look at what happened to a bill you have opinions
                about.
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

        {/* Sticky table of contents — large screens */}
        <nav
          aria-label="On this page"
          className="hidden lg:block"
        >
          <div className="sticky top-24">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--bd-muted)]">
              On this page
            </p>
            <div className="bd-rule mt-3" />
            <ol className="mt-4 space-y-2.5 text-sm">
              {SECTIONS.map((s, i) => (
                <li key={s.id} className="flex gap-2.5">
                  <span className="tabular-nums text-[var(--bd-muted)]">{i + 1}</span>
                  <a
                    href={`#${s.id}`}
                    className="text-[var(--bd-muted)] transition-colors hover:text-[var(--bd-blue-deep)]"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>
      </div>
    </div>
  );
}
