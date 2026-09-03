import type { ReactNode } from "react";

/**
 * Every page's header, in one order: title, short blue accent line, then the
 * muted subtitle. `aside` sits right of the title (under it, right-aligned, on
 * small screens).
 */
export function PageHeader({
  title, subtitle, aside,
}: { title: ReactNode; subtitle?: ReactNode; aside?: ReactNode }) {
  return (
    <header className="mb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <h1 className="font-serif text-4xl font-semibold leading-snug sm:text-5xl">{title}</h1>
        {aside && <div className="shrink-0 self-end sm:self-start">{aside}</div>}
      </div>
      <div className="bd-rule mt-3 rounded-full" />
      {subtitle && (
        <p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--bd-muted)]">{subtitle}</p>
      )}
    </header>
  );
}
