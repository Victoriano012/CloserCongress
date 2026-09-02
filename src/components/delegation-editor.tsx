"use client";

/**
 * The delegation editor.
 *
 * A delegation is an *ordered* list. The first party in it with an opinion on a
 * bill casts the citizen's vote, and every party abstains on everything outside
 * its own subject — so position, not membership, is what the citizen is really
 * choosing here. The UI is built around that: numbered rows, drag to reorder,
 * and ▲/▼ buttons that do the same job for keyboard and touch.
 */

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  deleteDelegationAction,
  saveDelegationAction,
} from "@/app/actions/delegation";
import {
  AXIS_LABELS,
  BLANK_PARTY_SLUG,
  OPPOSITE_OF,
  PARTY_BY_SLUG,
  VOTING_PARTIES,
  type Party,
  type PartyAxis,
} from "@/lib/parties";

/** Entries stored include the terminal blank vote, so 10 - 1 real delegates. */
const MAX_DELEGATES = 9;

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bd-blue)]";

/** The axes in roster order, so the picker reads like the parties page. */
const AXES: PartyAxis[] = (() => {
  const seen: PartyAxis[] = [];
  for (const party of VOTING_PARTIES) {
    if (!seen.includes(party.axis)) seen.push(party.axis);
  }
  return seen;
})();

function withoutBlank(list: readonly string[]): string[] {
  return list.filter((slug) => slug !== BLANK_PARTY_SLUG && slug in PARTY_BY_SLUG);
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((slug, i) => slug === b[i]);
}

/** Moves the entry at `from` so it lands at insertion point `insertAt`. */
function moved(list: readonly string[], from: number, insertAt: number): string[] {
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(insertAt > from ? insertAt - 1 : insertAt, 0, item);
  return next;
}

function matches(party: Party, needle: string): boolean {
  if (!needle) return true;
  const haystack = `${party.name} ${party.tagline} ${party.scope}`.toLowerCase();
  return needle
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/** The blue bar showing where a dragged row would land. */
function Indicator({ active }: { active: boolean }) {
  return (
    <div
      aria-hidden
      className={`-my-px h-0.5 rounded-full transition-colors ${
        active ? "bg-[var(--bd-blue)]" : "bg-transparent"
      }`}
    />
  );
}

/** True when a click landed on one of the row's buttons rather than the row itself. */
function onControl(event: React.MouseEvent): boolean {
  return event.target instanceof Element && event.target.closest("button") !== null;
}

/**
 * Logo and name. Focusable so Enter opens the party page, mirroring the
 * double-click on the surrounding card.
 */
function PartyLabel({
  party,
  onOpen,
  children,
}: {
  party: Party;
  onOpen: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      role="link"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget) {
          event.preventDefault();
          onOpen();
        }
      }}
      className={`min-w-0 flex-1 rounded-md ${FOCUS}`}
    >
      <p className="text-sm font-medium leading-snug">
        <span aria-hidden>{party.emoji}</span> {party.name}
        <span className="sr-only">. Press Enter to open this party&apos;s page.</span>
      </p>
      {children}
    </div>
  );
}

export function DelegationEditor({ initial }: { initial: string[] }) {
  const router = useRouter();
  const [list, setList] = useState<string[]>(() => withoutBlank(initial));
  const [saved, setSaved] = useState<string[]>(() => withoutBlank(initial));
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = !sameList(list, saved);
  const full = list.length >= MAX_DELEGATES;

  const chosen = useMemo(
    () => list.map((slug) => PARTY_BY_SLUG[slug]).filter(Boolean),
    [list],
  );

  /** Every voting party matching the search, selected or not. */
  const catalog = useMemo(() => {
    const groups: { axis: PartyAxis; parties: Party[] }[] = [];
    for (const axis of AXES) {
      const parties = VOTING_PARTIES.filter((p) => p.axis === axis && matches(p, search));
      if (parties.length) groups.push({ axis, parties });
    }
    return groups;
  }, [search]);

  const catalogCount = catalog.reduce((n, g) => n + g.parties.length, 0);

  /** Slug → 1-based position in the list. */
  const position = new Map(list.map((slug, i) => [slug, i + 1]));

  function open(slug: string) {
    router.push(`/parties/${slug}`);
  }

  function apply(next: string[], message: string) {
    setList(next);
    setStatus(null);
    setAnnouncement(message);
  }

  /** Keeps the keyboard on the row it just moved. */
  function refocus(slug: string, dir: "up" | "down") {
    requestAnimationFrame(() => {
      const first = document.getElementById(`move-${dir}-${slug}`);
      if (first instanceof HTMLButtonElement && !first.disabled) {
        first.focus();
        return;
      }
      const other = document.getElementById(
        `move-${dir === "up" ? "down" : "up"}-${slug}`,
      );
      if (other instanceof HTMLButtonElement) other.focus();
    });
  }

  function move(index: number, dir: "up" | "down") {
    const target = dir === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= list.length) return;
    const slug = list[index];
    apply(
      moved(list, index, dir === "up" ? target : target + 1),
      `${PARTY_BY_SLUG[slug]?.name ?? slug} moved to position ${target + 1} of ${list.length}.`,
    );
    refocus(slug, dir);
  }

  function add(slug: string) {
    if (full || list.includes(slug)) return;
    apply(
      [...list, slug],
      `${PARTY_BY_SLUG[slug]?.name ?? slug} added at position ${list.length + 1}.`,
    );
  }

  function remove(slug: string) {
    if (!list.includes(slug)) return;
    apply(
      list.filter((s) => s !== slug),
      `${PARTY_BY_SLUG[slug]?.name ?? slug} removed from your list.`,
    );
  }

  function onSave() {
    setStatus(null);
    startTransition(async () => {
      const result = await saveDelegationAction([...list, BLANK_PARTY_SLUG]);
      if (result.ok) {
        const stored = withoutBlank(result.delegation);
        setList(stored);
        setSaved(stored);
        setStatus({ kind: "ok", text: "Saved. It does not move the simulated result." });
      } else {
        setStatus({ kind: "error", text: result.error });
      }
    });
  }

  function onClear() {
    setStatus(null);
    startTransition(async () => {
      const deleted = await deleteDelegationAction();
      setConfirmClear(false);
      if (deleted) {
        setList([]);
        setSaved([]);
        setStatus({ kind: "ok", text: "List deleted." });
      } else {
        setStatus({ kind: "error", text: "Could not delete. Are you still signed in?" });
      }
    });
  }

  // ---- drag and drop -------------------------------------------------------

  function onDragOverRow(event: React.DragEvent, index: number) {
    if (dragIndex === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const box = event.currentTarget.getBoundingClientRect();
    setDropAt(event.clientY < box.top + box.height / 2 ? index : index + 1);
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    if (dragIndex === null || dropAt === null) return;
    const slug = list[dragIndex];
    const next = moved(list, dragIndex, dropAt);
    setDragIndex(null);
    setDropAt(null);
    apply(
      next,
      `${PARTY_BY_SLUG[slug]?.name ?? slug} moved to position ${next.indexOf(slug) + 1} of ${next.length}.`,
    );
  }

  // ---- render --------------------------------------------------------------

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-8 lg:grid-cols-2">
        {/* ---------------------------------------------------------- LEFT */}
        <section aria-labelledby="your-list-heading" className="flex flex-col gap-4">
          <div>
            <h2 id="your-list-heading" className="font-serif text-xl font-semibold">
              Your list
            </h2>
            <div className="bd-rule mt-2" />
            <p className="mt-3 text-sm text-[var(--bd-muted)]">
              {list.length === 0
                ? "Empty: every bill is a blank vote until you add someone."
                : `${list.length} of ${MAX_DELEGATES}. Drag rows or use ▲ ▼ to reorder. Double-click a party to open its page.`}
            </p>
          </div>

          <ol
            className="flex flex-col"
            onDragOver={(event) => {
              if (dragIndex !== null) event.preventDefault();
            }}
            onDrop={onDrop}
          >
            {chosen.map((party, index) => {
              const oppositeAt = position.get(OPPOSITE_OF[party.slug]);
              const opposite = oppositeAt ? PARTY_BY_SLUG[OPPOSITE_OF[party.slug]] : null;
              return (
              <li key={party.slug}>
                <Indicator active={dragIndex !== null && dropAt === index} />
                <div
                  draggable
                  onDragStart={(event) => {
                    setDragIndex(index);
                    setDropAt(index);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", party.slug);
                  }}
                  onDragOver={(event) => onDragOverRow(event, index)}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setDropAt(null);
                  }}
                  onDoubleClick={(event) => {
                    if (!onControl(event)) open(party.slug);
                  }}
                  className={`bd-card flex select-none items-start gap-3 border-l-4 p-3 ${
                    dragIndex === index ? "opacity-50" : ""
                  }`}
                  style={{ borderLeftColor: party.color }}
                >
                  <span
                    aria-hidden
                    className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[var(--bd-navy)] text-xs font-bold tabular-nums text-white"
                  >
                    {index + 1}
                  </span>

                  <span aria-hidden className="mt-px cursor-grab select-none text-lg leading-none">
                    ⠿
                  </span>

                  <PartyLabel party={party} onOpen={() => open(party.slug)}>
                    {opposite ? (
                      <p className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-[var(--bd-line)] bg-[var(--bd-paper)] px-1.5 py-0.5 text-xs text-[var(--bd-muted)]">
                        <span aria-hidden>↔</span>
                        <span>
                          Opposite values to {opposite.name}
                          <span aria-hidden> (#{oppositeAt})</span>
                          <span className="sr-only"> at position {oppositeAt}</span>
                        </span>
                      </p>
                    ) : null}
                  </PartyLabel>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      id={`move-up-${party.slug}`}
                      onClick={() => move(index, "up")}
                      disabled={index === 0}
                      aria-label={`Move ${party.name} up`}
                      className={`grid h-8 w-8 place-items-center rounded-md border border-[var(--bd-line)] text-[var(--bd-blue-deep)] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent ${FOCUS}`}
                    >
                      <span aria-hidden>▲</span>
                    </button>
                    <button
                      type="button"
                      id={`move-down-${party.slug}`}
                      onClick={() => move(index, "down")}
                      disabled={index === list.length - 1}
                      aria-label={`Move ${party.name} down`}
                      className={`grid h-8 w-8 place-items-center rounded-md border border-[var(--bd-line)] text-[var(--bd-blue-deep)] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent ${FOCUS}`}
                    >
                      <span aria-hidden>▼</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(party.slug)}
                      aria-label={`Remove ${party.name} from your list`}
                      className={`grid h-8 w-8 place-items-center rounded-md border border-[var(--bd-line)] text-[var(--bd-no)] hover:bg-red-50 ${FOCUS}`}
                    >
                      <span aria-hidden>✕</span>
                    </button>
                  </div>
                </div>
              </li>
              );
            })}
          </ol>

          <div>
            <Indicator active={dragIndex !== null && dropAt === list.length} />
            <div
              onDragOver={(event) => {
                if (dragIndex !== null) {
                  event.preventDefault();
                  setDropAt(list.length);
                }
              }}
              onDrop={onDrop}
              className="flex items-start gap-3 rounded-xl border border-dashed border-[var(--bd-line)] bg-[var(--bd-paper)] p-3"
            >
              <span
                aria-hidden
                className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-[var(--bd-line)] bg-white text-xs font-bold tabular-nums text-[var(--bd-muted)]"
              >
                {list.length + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug text-[var(--bd-muted)]">
                  <span aria-hidden>⬜</span> Blank Vote Party
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--bd-muted)]">
                  Always last. Blank when nobody above has an opinion.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onSave}
              disabled={pending || !dirty}
              className={`rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-[var(--bd-muted)] ${FOCUS}`}
            >
              {pending ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </button>

            {confirmClear ? (
              <span className="flex items-center gap-2 text-sm">
                <span className="text-[var(--bd-muted)]">Delete your saved list?</span>
                <button
                  type="button"
                  onClick={onClear}
                  disabled={pending}
                  className={`rounded-md border border-[var(--bd-no)] px-3 py-1.5 text-sm font-medium text-[var(--bd-no)] hover:bg-red-50 disabled:opacity-50 ${FOCUS}`}
                >
                  Yes, delete it
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className={`rounded-md px-3 py-1.5 text-sm text-[var(--bd-muted)] hover:bg-blue-50 ${FOCUS}`}
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className={`rounded-md border border-[var(--bd-line)] px-3 py-2 text-sm text-[var(--bd-muted)] hover:bg-blue-50 ${FOCUS}`}
              >
                Clear my list
              </button>
            )}

            {dirty && !pending ? (
              <span className="text-sm text-[var(--bd-muted)]">Unsaved changes.</span>
            ) : null}
          </div>

          <p
            aria-live="polite"
            className={`min-h-5 text-sm ${
              status?.kind === "error" ? "text-[var(--bd-no)]" : "text-[var(--bd-yes)]"
            }`}
          >
            {status?.text ?? ""}
          </p>
          <p aria-live="polite" className="sr-only">
            {announcement}
          </p>
        </section>

        {/* --------------------------------------------------------- RIGHT */}
        <section aria-labelledby="parties-heading" className="flex flex-col gap-4">
          <div>
            <h2 id="parties-heading" className="font-serif text-xl font-semibold">
              Parties
            </h2>
            <div className="bd-rule mt-2" />
            <p className="mt-3 text-sm text-[var(--bd-muted)]">
              Added parties go to the bottom of your list. Parties already on it show their
              position. Double-click a party to open its page.
            </p>
          </div>

          <div>
            <label htmlFor="delegate-search" className="sr-only">
              Search parties
            </label>
            <input
              id="delegate-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search…"
              className={`w-full rounded-md border border-[var(--bd-line)] bg-white px-3 py-2 text-sm placeholder:text-[var(--bd-muted)] ${FOCUS}`}
            />
          </div>

          {full ? (
            <p className="rounded-md border border-[var(--bd-line)] bg-blue-50 px-3 py-2 text-sm text-[var(--bd-blue-deep)]">
              List full at {MAX_DELEGATES}. Remove one to add another.
            </p>
          ) : null}

          {catalogCount === 0 ? (
            <p className="text-sm text-[var(--bd-muted)]">No matches.</p>
          ) : (
            <div className="flex flex-col gap-6">
              {catalog.map((group) => (
                <div key={group.axis}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--bd-muted)]">
                    {AXIS_LABELS[group.axis]}
                  </h3>
                  <ul className="mt-2 flex flex-col gap-2">
                    {group.parties.map((party) => {
                      const at = position.get(party.slug);
                      return (
                        <li
                          key={party.slug}
                          onDoubleClick={(event) => {
                            if (!onControl(event)) open(party.slug);
                          }}
                          className={`bd-card flex select-none items-center gap-3 border-l-4 p-3 ${
                            at ? "bg-blue-50/60" : ""
                          }`}
                          style={{ borderLeftColor: party.color }}
                        >
                          <PartyLabel party={party} onOpen={() => open(party.slug)} />
                          {at ? (
                            <div className="flex shrink-0 items-center justify-end gap-2">
                              <span className="inline-flex h-8 min-w-9 items-center justify-center whitespace-nowrap rounded-md border border-blue-200 bg-blue-100/70 px-2 text-sm font-semibold tabular-nums text-blue-800">
                                <span className="sr-only">Position {at} in your list</span>
                                <span aria-hidden>#{at}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => remove(party.slug)}
                                aria-label={`Remove ${party.name} from your list`}
                                className={`rounded-md border border-[var(--bd-line)] px-3 py-1.5 text-sm font-medium text-[var(--bd-no)] hover:bg-red-50 ${FOCUS}`}
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => add(party.slug)}
                              disabled={full}
                              aria-label={`Add ${party.name} to your list`}
                              className={`shrink-0 rounded-md border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-800 hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-[var(--bd-line)] disabled:text-[var(--bd-muted)] disabled:hover:bg-transparent ${FOCUS}`}
                            >
                              Add
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default DelegationEditor;
