import { PartyChip } from "@/components/party-chip";

/** A list of delegates in rank order, numbered the way the editor numbers them. */
export function OrderedChips({ slugs }: { slugs: string[] }) {
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
