import { PARTY_BY_SLUG } from "@/lib/parties";

/* Three states: a silent delegate was asked and had nothing to say; an
   unreached one never got the question. */
export type StepState = "votes" | "silent" | "unreached";

export type Step = { slug: string; state: StepState; note: string };

const STYLE: Record<
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

/** One list, walked from the top on one bill. */
export function DelegationDiagram({
  caption, bill, steps, outcome,
}: { caption: string; bill: string; steps: Step[]; outcome: React.ReactNode }) {
  return (
    <figure className="bd-card overflow-hidden">
      <div className="border-b border-[var(--bd-line)] bg-[var(--bd-paper)] px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--bd-muted)]">
          {caption}
        </p>
        <p className="mt-1 font-serif text-base font-semibold text-[var(--bd-navy)]">{bill}</p>
      </div>

      <ol className="divide-y divide-[var(--bd-line)]">
        {steps.map((step, i) => {
          const style = STYLE[step.state];
          const party = PARTY_BY_SLUG[step.slug];
          return (
            <li key={step.slug} className={`flex items-start gap-3 px-5 py-3.5 ${style.row}`}>
              <span
                aria-hidden
                className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11px] font-bold ${style.num}`}
              >
                {i + 1}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className={`text-[0.95rem] font-medium ${style.name}`}>
                    <span aria-hidden className="mr-1.5">
                      {party?.emoji}
                    </span>
                    {party?.name ?? step.slug}
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
