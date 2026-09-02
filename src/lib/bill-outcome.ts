/**
 * Which bills the index shows. Pure and free of `server-only` so it can be unit
 * tested; `@/lib/bills` re-exports it for the data layer.
 */
import type { Outcome } from "@/lib/congress";

/** Outcomes Congress has settled: the bill is law, or it is dead. */
export const RESOLVED_OUTCOMES: readonly Outcome[] = ["passed", "failed"];

/**
 * True once Congress has finished with the bill. Anything still moving —
 * introduced, in committee, passed one chamber, awaiting signature — is not.
 */
export function isResolved(bill: { real_outcome: Outcome }): boolean {
  return RESOLVED_OUTCOMES.includes(bill.real_outcome);
}
