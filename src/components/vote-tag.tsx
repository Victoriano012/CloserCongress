import type { Vote } from "@/lib/tally";

const TONE: Record<Vote, string> = {
  yes: "var(--bd-yes)",
  no: "var(--bd-no)",
  abstain: "var(--bd-blank)",
};

/** A yes / no / blank pill in the outcome colour. */
export function VoteTag({ vote }: { vote: Vote }) {
  const tone = TONE[vote];
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide"
      style={{ borderColor: tone, color: tone, background: `${tone}12` }}
    >
      {vote === "abstain" ? "blank" : vote}
    </span>
  );
}
