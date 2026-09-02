import { PartyChip } from "@/components/party-chip";
import { VoteTag } from "@/components/vote-tag";
import type { ResolvedVote } from "@/lib/record";

/** "Voted: yes / no / blank", through which delegate, and why. */
export function YourVote({ entry, clampReason = false }: { entry: ResolvedVote; clampReason?: boolean }) {
  if (!entry.classified) {
    return <p className="text-sm text-[var(--bd-muted)]">Not classified yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--bd-muted)]">
          Voted
        </span>
        <VoteTag vote={entry.vote} />
        <span className="text-xs text-[var(--bd-muted)]">through</span>
        <PartyChip slug={entry.party} />
        <span className="text-xs text-[var(--bd-muted)]">
          {entry.vote === "abstain"
            ? `all ${entry.silentAbove} delegates silent`
            : entry.silentAbove === 0
              ? "first choice"
              : `${entry.silentAbove} silent above`}
        </span>
      </div>
      {entry.reason ? (
        <p
          className={`text-sm leading-relaxed text-[var(--bd-muted)] ${clampReason ? "line-clamp-2" : ""}`}
        >
          {entry.reason}
        </p>
      ) : null}
    </div>
  );
}
