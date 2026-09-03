import type { ReactNode } from "react";

/** The long-form pages: anchored sections and an "On this page" list. */

export type TocEntry = { id: string; label: string };

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--bd-muted)]">
      {children}
    </p>
  );
}

export function Section({
  id, eyebrow, title, children,
}: { id: string; eyebrow?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2
        className={`${eyebrow ? "mt-2 " : ""}font-serif text-2xl font-semibold leading-snug sm:text-[1.75rem]`}
      >
        {title}
      </h2>
      <div className="bd-rule mt-4" />
      <div className="mt-6 space-y-5 text-[1.0625rem] leading-8 text-[var(--bd-ink)]">
        {children}
      </div>
    </section>
  );
}

/** Inline card on small screens, sticky rail on large ones. */
export function Toc({
  sections, sticky, numbered,
}: { sections: TocEntry[]; sticky?: boolean; numbered?: boolean }) {
  if (sticky) {
    return (
      <nav aria-label="On this page" className="hidden lg:block">
        <div className="sticky top-24">
          <Eyebrow>On this page</Eyebrow>
          <div className="bd-rule mt-3" />
          <ol className="mt-4 space-y-2.5 text-sm">
            {sections.map((s, i) => (
              <li key={s.id} className="flex gap-2.5">
                {numbered && (
                  <span className="tabular-nums text-[var(--bd-muted)]">{i + 1}</span>
                )}
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
    );
  }
  return (
    <nav aria-label="On this page" className="bd-card mb-12 px-5 py-4 lg:hidden">
      <Eyebrow>On this page</Eyebrow>
      <ol className="mt-3 space-y-1.5 text-sm">
        {sections.map((s, i) => (
          <li key={s.id} className="flex gap-2">
            {numbered && (
              <span className="tabular-nums text-[var(--bd-muted)]">{i + 1}.</span>
            )}
            <a className="bd-link" href={`#${s.id}`}>
              {s.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
