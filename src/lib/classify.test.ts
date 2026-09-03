import assert from "node:assert/strict";
import { test } from "node:test";

import { billSource, buildPrompt, type BillForClassification } from "@/lib/classify";
import { billTextFromHtml } from "@/lib/congress";

const BILL: BillForClassification = {
  id: "119-hr-10189",
  congress: 119,
  billType: "hr",
  number: 10189,
  title: "Defense AI Reliability and Reporting Act",
  chamber: "house",
  officialSummary: null,
};

const GOVINFO_HTML = `<html><body><pre>
[Congressional Bills 119th Congress]
[From the U.S. Government Publishing Office]
[H.R. 10189 Introduced in House (IH)]

&lt;DOC&gt;

119th CONGRESS
  2d Session
                               H. R. 10189

Ms. Jacobs introduced the following bill; which was referred to the
Committee on Armed Services

_______________________________________________________________________

                                 A BILL

    Be it enacted by the Senate and House of Representatives,

SECTION 1. SHORT TITLE.

    This Act may be cited as the \`\`Defense AI Reliability and Reporting
Act''.
</pre></body></html>`;

/**
 * The bug: CRS summaries lag introduction by weeks or months, so most bills
 * reached the classifier with no summary and were judged from the title alone,
 * with the prompt telling the model to abstain when unsure. The bill text is
 * available from govinfo within a day or two and must be used instead.
 */
test("a bill without a summary is judged from its text, not its title", () => {
  const text = billTextFromHtml(GOVINFO_HTML)!;
  const prompt = buildPrompt({ ...BILL, billText: text });

  assert.equal(billSource({ ...BILL, billText: text }), "text");
  assert.match(prompt, /text of the bill as introduced/);
  assert.match(prompt, /SECTION 1\. SHORT TITLE\./);
  assert.doesNotMatch(prompt, /Judge the bill from its title alone/);
});

test("the title-only fallback is used only when there is neither summary nor text", () => {
  assert.equal(billSource(BILL), "title");
  assert.match(buildPrompt(BILL), /Judge the bill from its title alone/);

  const withSummary = { ...BILL, officialSummary: "This bill does a thing.", billText: "text" };
  assert.equal(billSource(withSummary), "summary");
  assert.match(buildPrompt(withSummary), /Official summary \(Congressional Research Service\)/);
  assert.doesNotMatch(buildPrompt(withSummary), /text of the bill as introduced/);
});

test("govinfo bill html is cut down to the enacting text", () => {
  const text = billTextFromHtml(GOVINFO_HTML)!;
  assert.ok(text.startsWith("A BILL"));
  assert.doesNotMatch(text, /Government Publishing Office|<DOC>|<pre>/);
  assert.match(text, /``Defense AI Reliability and Reporting\nAct''/);
  assert.equal(billTextFromHtml("<html><body></body></html>"), null);
});

test("very long bill text is truncated and the prompt says so", () => {
  const prompt = buildPrompt({ ...BILL, billText: "x".repeat(20_000) });
  assert.match(prompt, /first 12000 characters/);
  assert.doesNotMatch(prompt, /x{12001}/);
});
