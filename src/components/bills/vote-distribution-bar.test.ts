import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

import {
  describeVotes,
  formatPct,
  MIN_WIDTH_PCT,
  VoteDistributionBar,
  voteSegments,
} from "./vote-distribution-bar";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

test("segments are proportional and ordered yes, blank, no", () => {
  const segs = voteSegments({ yes: 50, no: 30, abstain: 20 });
  assert.deepEqual(segs.map((s) => s.key), ["yes", "abstain", "no"]);
  assert.deepEqual(segs.map((s) => s.width), [50, 20, 30]);
  assert.deepEqual(segs.map((s) => s.labelInside), [true, true, true]);
});

test("a tiny non-zero segment is widened to the minimum, taken from the rest", () => {
  const segs = voteSegments({ yes: 9_999, no: 1, abstain: 0 });
  const no = segs.find((s) => s.key === "no")!;
  assert.equal(no.width, MIN_WIDTH_PCT);
  assert.equal(no.labelInside, false);
  assert.ok(Math.abs(sum(segs.map((s) => s.width)) - 100) < 1e-9);
});

test("zero votes yields empty segments", () => {
  const segs = voteSegments({ yes: 0, no: 0 });
  assert.ok(segs.every((s) => s.width === 0 && s.pct === 0));
});

test("percentages format compactly", () => {
  assert.equal(formatPct(0.01), "<0.1%");
  assert.equal(formatPct(33.333), "33.3%");
  assert.equal(formatPct(100), "100%");
});

test("the aria description spells out every non-zero group and the total", () => {
  assert.equal(
    describeVotes({ yes: 6_000, no: 3_000, abstain: 1_000 }),
    "10,000 votes: 6,000 in favour (60.0%), 1,000 blank (10.0%), 3,000 against (30.0%)",
  );
  assert.equal(describeVotes({ yes: 0, no: 0, label: "Delegates" }), "Delegates: No votes yet");
});

test("renders an img role with the summary, and the empty state", () => {
  const html = renderToStaticMarkup(createElement(VoteDistributionBar, { yes: 7, no: 3 }));
  assert.match(html, /role="img"/);
  assert.match(html, /aria-label="10 votes: 7 in favour \(70\.0%\), 3 against \(30\.0%\)"/);
  assert.match(html, /10 votes/);

  const empty = renderToStaticMarkup(createElement(VoteDistributionBar, { yes: 0, no: 0 }));
  assert.match(empty, /No votes yet/);
  assert.doesNotMatch(empty, /width:/);
});
