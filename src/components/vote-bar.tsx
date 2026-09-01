import { PARTY_BY_SLUG } from "@/lib/parties";
import type { PartyContribution } from "@/lib/tally";

const TONE = {
  yes: "var(--bd-yes)",
  no: "var(--bd-no)",
  abstain: "var(--bd-blank-fill)",
} as const;

/**
 * A solid grey bar reads as a measured outcome. When nothing was cast at all
 * there is no outcome to measure, so that bar is hatched instead — the third
 * state alongside pass and fail.
 */
const NOTHING_CAST =
  "repeating-linear-gradient(135deg, var(--bd-blank-fill) 0 3px, transparent 3px 7px)";

/** The plain three-part bar: in favour, against, blank. */
export function VoteBar({
  yes, no, blank, height = 10,
}: { yes: number; no: number; blank: number; height?: number }) {
  const total = Math.max(yes + no + blank, 1);
  const parts = [
    { key: "yes", value: yes },
    { key: "no", value: no },
    { key: "blank", value: blank },
  ] as const;
  const nothingCast = yes + no === 0;

  return (
    <div
      role="img"
      aria-label={
        nothingCast
          ? "Nothing cast: every vote blank"
          : `${yes.toLocaleString()} in favour, ${no.toLocaleString()} against, ${blank.toLocaleString()} blank`
      }
      className="flex w-full overflow-hidden rounded-full bg-[var(--bd-line)]"
      style={{ height }}
    >
      {parts.map((p) => (
        <div
          key={p.key}
          style={{
            width: `${(p.value / total) * 100}%`,
            background:
              p.key !== "blank" ? TONE[p.key] : nothingCast ? NOTHING_CAST : TONE.abstain,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Bar order: in favour, against, blank, then largest first. Exported so the
 * legend beneath the bar can be read against it row by row.
 */
export function sortContributions(breakdown: PartyContribution[]): PartyContribution[] {
  const order = { yes: 0, no: 1, abstain: 2 } as const;
  return [...breakdown].sort(
    (a, b) => order[a.vote] - order[b.vote] || b.count - a.count,
  );
}

/**
 * The same bar broken down by delegate, which is the part that shows how the
 * ordered lists actually behaved: each segment is one party voting for the
 * people who put it first among the parties with an opinion.
 */
export function PartyBreakdownBar({
  breakdown, total,
}: { breakdown: PartyContribution[]; total: number }) {
  const sorted = sortContributions(breakdown);
  const say = (seg: PartyContribution) =>
    `${PARTY_BY_SLUG[seg.slug]?.name ?? seg.slug} ${
      seg.vote === "abstain" ? "blank" : seg.vote === "yes" ? "in favour" : "against"
    } ${((seg.count / Math.max(total, 1)) * 100).toFixed(1)}%`;

  return (
    <div
      role="img"
      aria-label={sorted.map(say).join(", ")}
      className="flex h-6 w-full overflow-hidden rounded-md bg-[var(--bd-line)]"
    >
      {sorted.map((seg) => {
        const party = PARTY_BY_SLUG[seg.slug];
        const pct = (seg.count / Math.max(total, 1)) * 100;
        return (
          <div
            key={`${seg.slug}-${seg.vote}`}
            title={`${party?.name ?? seg.slug} — ${seg.vote === "abstain" ? "blank" : seg.vote} · ${pct.toFixed(1)}%`}
            style={{
              width: `${pct}%`,
              background: party?.color ?? "var(--bd-blank-fill)",
              opacity: seg.vote === "no" ? 0.55 : seg.vote === "abstain" ? 0.3 : 1,
            }}
            className="border-r border-white/50 last:border-r-0"
          />
        );
      })}
    </div>
  );
}
