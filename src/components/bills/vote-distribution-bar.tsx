/**
 * How a set of votes split three ways, as one stacked bar.
 *
 * Yes always sits on the left and no on the right, with blank between them and
 * a hairline at the halfway mark, so a majority is readable at a glance: yes has
 * it when the green crosses the line. Colour alone is not relied on — the red
 * and green of the design system are close for deutan readers — so segments
 * are also separated by a gap, ordered fixedly, labelled inside when they have
 * the room, and spelled out in the legend.
 */

export type VoteDistributionBarProps = {
  yes: number;
  no: number;
  abstain?: number;
  label?: string;
  /** Override the legend wording, e.g. "not voting" for a roll call. */
  words?: Partial<Record<"yes" | "no" | "abstain", string>>;
};

type Key = "yes" | "no" | "abstain";

export type Segment = {
  key: Key;
  count: number;
  /** True share of the total, in percent. */
  pct: number;
  /** Rendered width in percent — never below MIN_WIDTH_PCT for a non-zero count. */
  width: number;
  /** Whether the percentage fits inside the segment. */
  labelInside: boolean;
};

/** A sliver you can still see, so one dissenting vote in ten thousand is not lost. */
export const MIN_WIDTH_PCT = 1.5;
/** Enough room for "100%" at the label's font size on a typical card width. */
export const LABEL_MIN_WIDTH_PCT = 12;

const WORD: Record<Key, string> = { yes: "in favour", no: "against", abstain: "blank" };
const FILL: Record<Key, string> = {
  yes: "var(--bd-yes)",
  no: "var(--bd-no)",
  abstain: "var(--bd-blank-fill)",
};

export const formatPct = (pct: number) =>
  pct > 0 && pct < 0.1 ? "<0.1%" : `${pct.toFixed(pct >= 99.95 || pct === 0 ? 0 : 1)}%`;

/**
 * Widths are proportional except that a non-zero segment is never narrower than
 * MIN_WIDTH_PCT; whatever those slivers borrow is taken from the wide segments
 * pro rata, so the three still sum to 100.
 */
export function voteSegments({ yes, no, abstain = 0 }: VoteDistributionBarProps): Segment[] {
  const total = yes + no + abstain;
  const raw: { key: Key; count: number }[] = [
    { key: "yes", count: yes },
    { key: "abstain", count: abstain },
    { key: "no", count: no },
  ];
  if (total <= 0) {
    return raw.map((s) => ({ ...s, pct: 0, width: 0, labelInside: false }));
  }

  const pcts = raw.map((s) => (s.count / total) * 100);
  const small = pcts.map((p) => p > 0 && p < MIN_WIDTH_PCT);
  const borrowed = small.reduce((acc, isSmall, i) => acc + (isSmall ? MIN_WIDTH_PCT - pcts[i] : 0), 0);
  const large = pcts.reduce((acc, p, i) => acc + (small[i] ? 0 : p), 0);

  return raw.map((s, i) => {
    const width = small[i]
      ? MIN_WIDTH_PCT
      : large > 0 ? pcts[i] - borrowed * (pcts[i] / large) : 0;
    return { ...s, pct: pcts[i], width, labelInside: width >= LABEL_MIN_WIDTH_PCT };
  });
}

export function describeVotes({ yes, no, abstain = 0, label, words }: VoteDistributionBarProps): string {
  const total = yes + no + abstain;
  const lead = label ? `${label}: ` : "";
  if (total === 0) return `${lead}No votes yet`;
  const word = { ...WORD, ...words };
  const parts = voteSegments({ yes, no, abstain })
    .filter((s) => s.count > 0)
    .map((s) => `${s.count.toLocaleString()} ${word[s.key]} (${formatPct(s.pct)})`);
  return `${lead}${total.toLocaleString()} votes: ${parts.join(", ")}`;
}

export function VoteDistributionBar(props: VoteDistributionBarProps) {
  const { yes, no, abstain = 0, label, words } = props;
  const word = { ...WORD, ...words };
  const total = yes + no + abstain;
  const segments = voteSegments(props);
  const shown = segments.filter((s) => s.count > 0);

  return (
    <figure className="w-full">
      {label && (
        <figcaption className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--bd-muted)]">
          {label}
        </figcaption>
      )}

      <div
        role="img"
        aria-label={describeVotes(props)}
        className="relative flex h-6 w-full overflow-hidden rounded-full bg-[var(--bd-line)]"
      >
        {/* Positioned, so it paints above the segments despite coming first. */}
        {total > 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--bd-ink)]/35"
          />
        )}
        {shown.map((s) => (
          <div
            key={s.key}
            className="bd-grow flex h-full items-center justify-center overflow-hidden whitespace-nowrap border-r-2 border-[var(--bd-paper)] text-[11px] font-semibold tabular-nums last:border-r-0"
            style={{
              width: `${s.width}%`,
              flex: "none",
              background: FILL[s.key],
              color: s.key === "abstain" ? "var(--bd-ink)" : "#fff",
            }}
          >
            {s.labelInside && (
              <span aria-hidden className="bd-fade-in">
                {formatPct(s.pct)}
              </span>
            )}
          </div>
        ))}
      </div>

      {total === 0 ? (
        <p className="mt-2 text-sm text-[var(--bd-muted)]">No votes yet</p>
      ) : (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
          {segments.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: FILL[s.key] }}
              />
              <span className="tabular-nums">{s.count.toLocaleString()}</span> {word[s.key]}
              {!s.labelInside && s.count > 0 && (
                <span className="text-[var(--bd-muted)] tabular-nums">· {formatPct(s.pct)}</span>
              )}
            </span>
          ))}
          <span className="ml-auto text-[var(--bd-muted)] tabular-nums">
            {total.toLocaleString()} votes
          </span>
        </div>
      )}
    </figure>
  );
}
