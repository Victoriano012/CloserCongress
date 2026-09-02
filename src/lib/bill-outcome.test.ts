import assert from "node:assert/strict";
import { test } from "node:test";

import { isResolved, RESOLVED_OUTCOMES } from "@/lib/bill-outcome";
import { mapStatus } from "@/lib/congress";

test("passed and failed bills are resolved", () => {
  assert.equal(isResolved({ real_outcome: "passed" }), true);
  assert.equal(isResolved({ real_outcome: "failed" }), true);
});

test("pending bills are not resolved", () => {
  assert.equal(isResolved({ real_outcome: "pending" }), false);
});

test("RESOLVED_OUTCOMES is exactly passed and failed", () => {
  assert.deepEqual([...RESOLVED_OUTCOMES].sort(), ["failed", "passed"]);
});

test("in-progress GovTrack statuses are unresolved", () => {
  for (const s of [
    "introduced",
    "referred",
    "reported",
    "pass_over_house",
    "pass_back_senate",
    "conference_passed_house",
    "override_pass_over_house",
    "prov_kill_cloturefailed",
  ]) {
    assert.equal(isResolved({ real_outcome: mapStatus(s) }), false, s);
  }
});

test("final GovTrack statuses are resolved", () => {
  for (const s of [
    "passed_bill",
    "passed_simpleres",
    "enacted_signed",
    "enacted_veto_override",
    "fail_originating_house",
    "fail_second_senate",
    "vetoed_pocket",
    "vetoed_override_fail_originating_house",
  ]) {
    assert.equal(isResolved({ real_outcome: mapStatus(s) }), true, s);
  }
  assert.equal(mapStatus("enacted_veto_override"), "passed");
  assert.equal(mapStatus("vetoed_override_fail_originating_house"), "failed");
});
