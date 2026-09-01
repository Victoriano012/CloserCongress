import { PARTY_BY_SLUG } from "@/lib/parties";

/** A party's name with its colour, used anywhere a slug needs to be readable. */
export function PartyChip({
  slug, size = "sm",
}: { slug: string; size?: "sm" | "md" }) {
  const party = PARTY_BY_SLUG[slug];
  if (!party) return <span className="text-[var(--bd-muted)]">{slug}</span>;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium ${
        size === "md" ? "text-sm" : "text-xs"
      }`}
      // The party hue stays on the border and the wash; the label itself is ink.
      // A third of the roster's hues fall below 4.5:1 as text on white.
      style={{ borderColor: party.color, color: "var(--bd-ink)", background: `${party.color}12` }}
    >
      <span aria-hidden>{party.emoji}</span>
      {party.name}
    </span>
  );
}
