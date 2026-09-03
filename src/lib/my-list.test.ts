import assert from "node:assert/strict";
import { test } from "node:test";

import {
  clearGuestList,
  GUEST_LIST_KEY,
  mergeGuestList,
  readGuestList,
  resolveVote,
  writeGuestList,
  type GuestStorage,
} from "@/lib/my-list";
import { BLANK_PARTY_SLUG } from "@/lib/parties";

function memoryStorage(seed: Record<string, string> = {}): GuestStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

// ---- storage fallback ------------------------------------------------------

test("no guest list until something is written", () => {
  assert.equal(readGuestList(memoryStorage()), null);
});

test("write then read round-trips, sanitized and blank-terminated", () => {
  const storage = memoryStorage();
  const written = writeGuestList(storage, ["animal-welfare", "not-a-party", "equal-rights", "animal-welfare"]);
  assert.deepEqual(written, ["animal-welfare", "equal-rights", BLANK_PARTY_SLUG]);
  assert.deepEqual(readGuestList(storage), written);
  assert.equal(storage.data.size, 1);
  assert.ok(storage.data.has(GUEST_LIST_KEY));
});

test("an empty guest list is still a list (only the blank vote)", () => {
  const storage = memoryStorage();
  writeGuestList(storage, []);
  assert.deepEqual(readGuestList(storage), [BLANK_PARTY_SLUG]);
});

test("garbage in storage reads as no list", () => {
  assert.equal(readGuestList(memoryStorage({ [GUEST_LIST_KEY]: "{not json" })), null);
  assert.deepEqual(
    readGuestList(memoryStorage({ [GUEST_LIST_KEY]: '{"a":1}' })),
    [BLANK_PARTY_SLUG],
  );
});

test("storage that throws is treated as empty, and writes do not crash", () => {
  const broken: GuestStorage = {
    getItem: () => { throw new Error("disabled"); },
    setItem: () => { throw new Error("quota"); },
    removeItem: () => { throw new Error("disabled"); },
  };
  assert.equal(readGuestList(broken), null);
  assert.deepEqual(writeGuestList(broken, ["equal-rights"]), ["equal-rights", BLANK_PARTY_SLUG]);
  assert.doesNotThrow(() => clearGuestList(broken));
});

test("clear removes the key", () => {
  const storage = memoryStorage();
  writeGuestList(storage, ["equal-rights"]);
  clearGuestList(storage);
  assert.equal(readGuestList(storage), null);
  assert.equal(storage.data.size, 0);
});

// ---- merge rule --------------------------------------------------------------

const GUEST = ["animal-welfare", BLANK_PARTY_SLUG];
const ACCOUNT = ["equal-rights", "catholic-values", BLANK_PARTY_SLUG];

test("guest list is uploaded when the account has none", () => {
  assert.deepEqual(mergeGuestList(null, GUEST), GUEST);
});

test("account list wins when both exist", () => {
  assert.equal(mergeGuestList(ACCOUNT, GUEST), null);
});

test("nothing to upload without a guest list", () => {
  assert.equal(mergeGuestList(null, null), null);
  assert.equal(mergeGuestList(ACCOUNT, null), null);
});

test("an empty account list still counts as saved", () => {
  assert.equal(mergeGuestList([BLANK_PARTY_SLUG], GUEST), null);
});

test("uploaded guest list is sanitized", () => {
  assert.deepEqual(
    mergeGuestList(null, ["animal-welfare", "bogus", BLANK_PARTY_SLUG, "equal-rights"]),
    ["animal-welfare", BLANK_PARTY_SLUG],
  );
});

// ---- vote resolution --------------------------------------------------------

test("the first delegate with an opinion speaks", () => {
  const rows = [
    { party_slug: "animal-welfare", vote: "abstain", reason: null },
    { party_slug: "equal-rights", vote: "no", reason: "Because." },
  ];
  assert.deepEqual(resolveVote(["animal-welfare", "equal-rights", BLANK_PARTY_SLUG], rows), {
    classified: true,
    party: "equal-rights",
    vote: "no",
    reason: "Because.",
  });
});

test("everyone silent is a classified blank; no rows is unclassified", () => {
  const rows = [{ party_slug: "catholic-values", vote: "yes", reason: null }];
  assert.deepEqual(resolveVote(GUEST, rows), {
    classified: true,
    party: BLANK_PARTY_SLUG,
    vote: "abstain",
    reason: null,
  });
  assert.equal(resolveVote(GUEST, []).classified, false);
});
