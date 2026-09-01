const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

/** "2026-08-27" (or a Date) → "27 Aug 2026", without going near a timezone. */
export function shortDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const iso = value instanceof Date ? value.toISOString() : value;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}
