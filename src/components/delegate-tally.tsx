import { PARTY_BY_SLUG } from "@/lib/parties";

/** Per-delegate count of the votes each one cast on the recent bills, plus the blanks. */
export function DelegateTally({
  delegates, tally, blanks,
}: { delegates: string[]; tally: Map<string, number>; blanks: number }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {delegates.map((slug, i) => {
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
  );
}
