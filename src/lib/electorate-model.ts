/**
 * The synthetic electorate.
 *
 * 10,000 citizens, each holding an ordered list of parties to delegate to. The
 * shape of that population is not invented: it is built from published survey
 * data, and the file documents where every number comes from.
 *
 * The construction has three layers.
 *
 *  1. **Who people are.** Everyone is drawn from one of the nine groups in the
 *     Pew Research Center's 2026 political typology, in Pew's published
 *     proportions. The typology is used because it is the only public dataset
 *     that describes how American political views actually cluster — most
 *     people are not consistently liberal or conservative, and roughly 15% of
 *     each party's identifiers hold values that place them on the other side.
 *
 *  2. **Which side they take.** For each issue, a citizen's side is drawn from
 *     a logistic model: a group-specific tilt plus a per-issue intercept. The
 *     intercept is not guessed — it is solved numerically so that the split
 *     *among the citizens who actually delegate this issue* reproduces the
 *     published national split. That is the number the site displays, so that
 *     is the number that is fitted.
 *
 *     The consequence, stated plainly because it is easy to miss: the split
 *     across the whole simulated population is **not** the published national
 *     number. Delegating citizens are weighted by turnout, and turnout is
 *     higher on the right, so the intercept has to lean left to hit the target
 *     among delegators — which leaves the all-adult split about three points
 *     left of the poll. Both figures are reported in
 *     `data/electorate-stats.json` and on the methodology page.
 *
 *  3. **Whether they care enough to delegate.** Each issue has a salience,
 *     mostly from Gallup's "extremely important to my vote" battery, scaled by
 *     how engaged the citizen's group is (Pew's validated 2024 turnout). A
 *     citizen only puts a party on their list if the issue clears that bar, and
 *     the list is ordered by salience, so the issue someone cares most about
 *     tends to sit first.
 *
 * Numbers marked `estimated: true` had no published source and are flagged as
 * such on the site's methodology page rather than quietly presented as data.
 */

export type TypologyGroup = {
  key: string;
  name: string;
  /** Share of US adults, Pew 2026 typology. */
  share: number;
  /** Pew's validated 2024 turnout for the group. Used as an engagement proxy. */
  turnout: number;
  blurb: string;
};

/**
 * Pew Research Center, "Beyond Red vs. Blue: The Political Typology",
 * 10 June 2026 (survey of 10,357 US adults, 17–30 Nov 2025).
 */
export const TYPOLOGY: TypologyGroup[] = [
  { key: "no-apologies-right", name: "No Apologies Right", share: 0.09, turnout: 0.83,
    blurb: "Hard-line and highly engaged. Almost entirely Republican." },
  { key: "faith-first", name: "Faith First Conservatives", share: 0.12, turnout: 0.75,
    blurb: "Religious traditionalists. The only group where religion drives the vote." },
  { key: "unconventional-right", name: "Unconventional Right", share: 0.12, turnout: 0.55,
    blurb: "Young, disengaged, conservative on immigration but liberal on abortion." },
  { key: "pragmatic-right", name: "Pragmatic and Polite Right", share: 0.11, turnout: 0.68,
    blurb: "Oldest group. Economically conservative, moderate on immigration, allergic to conflict." },
  { key: "tuned-out-middle", name: "Tuned-Out Middle", share: 0.09, turnout: 0.32,
    blurb: "Barely follows politics. Economically liberal, socially conservative, evenly split by party." },
  { key: "order-opportunity-left", name: "Order and Opportunity Left", share: 0.18, turnout: 0.46,
    blurb: "The largest group. Economically liberal, socially moderate, pro-police." },
  { key: "left-out-left", name: "Left-Out Left", share: 0.12, turnout: 0.42,
    blurb: "Democratic-leaning but disaffected. The only group where most doubt voting gives them a say." },
  { key: "loyal-liberals", name: "Loyal Liberals", share: 0.11, turnout: 0.79,
    blurb: "Highly educated institutionalists. Liberal and consistently so." },
  { key: "leftward-progressives", name: "Leftward Progressives", share: 0.07, turnout: 0.70,
    blurb: "Youngest and most progressive. Most critical of the economic system." },
];

export type SourceNote = { label: string; estimated?: boolean };

export type AxisSpec = {
  key: string;
  /** The party taking the progressive/left side, or the only party on a one-sided issue. */
  partyA: string;
  /** The opposing party, if the issue has two sides on this site. */
  partyB?: string;
  /**
   * Share of Americans on side A. Population-weighted output is calibrated to
   * hit this exactly. Ignored for one-sided issues.
   */
  nationalA?: number;
  /** Probability an average citizen cares enough to delegate this issue at all. */
  salience: number;
  /**
   * Per-group log-odds tilt. On a two-sided axis it shifts which side the
   * citizen takes; on a one-sided axis it shifts how likely they are to care at
   * all. Both branches now go through the same logistic link, so the units are
   * the same in both cases — a tilt of +1 is one log-odds either way.
   */
  tilt: Record<string, number>;
  source: SourceNote;
  salienceSource: SourceNote;
};

const G = [
  "no-apologies-right", "faith-first", "unconventional-right", "pragmatic-right",
  "tuned-out-middle", "order-opportunity-left", "left-out-left", "loyal-liberals",
  "leftward-progressives",
] as const;

/** Compact helper: nine numbers in typology order. */
function tilt(...values: number[]): Record<string, number> {
  return Object.fromEntries(G.map((g, i) => [g, values[i]]));
}

export const AXES: AxisSpec[] = [
  {
    key: "reproductive-rights",
    partyA: "reproductive-freedom", partyB: "right-to-life",
    nationalA: 0.60,
    salience: 0.37,
    // Pew 2026 typology gives % saying illegal in all/most cases directly for
    // four groups: Faith First 83, No Apologies 73, Pragmatic Right 46,
    // Unconventional Right 43 (so a 56% majority say legal).
    tilt: tilt(-1.9, -2.6, 0.3, -0.2, 0.1, 0.9, 1.2, 2.2, 2.6),
    source: { label: "Pew, Jan 2026: 60% say abortion should be legal in all/most cases" },
    salienceSource: { label: "Gallup, Sep 2024: 37% call abortion extremely important to their vote" },
  },
  {
    key: "guns",
    partyA: "gun-safety", partyB: "second-amendment",
    nationalA: 0.56,
    salience: 0.37,
    // Unconventional Right is the clearest cross-cutter: only 24% are
    // comfortable with open carry, well left of the rest of their coalition.
    tilt: tilt(-2.6, -2.0, 0.2, -0.6, 0.2, 1.0, 1.1, 2.3, 2.6),
    source: { label: "Gallup, Oct 2024: 56% want stricter firearm sales laws" },
    salienceSource: { label: "Gallup, Sep 2024: 37% call gun policy extremely important" },
  },
  {
    key: "climate",
    partyA: "climate-action", partyB: "energy-independence",
    nationalA: 0.57,
    salience: 0.21,
    tilt: tilt(-2.8, -1.8, -0.7, -0.5, 0.0, 0.8, 1.0, 2.4, 2.8),
    source: { label: "Gallup, Mar 2026: 57% prioritise the environment over energy development" },
    salienceSource: { label: "Gallup, Sep 2024: 21% call climate change extremely important — last of 22 issues" },
  },
  {
    key: "immigration",
    partyA: "immigrant-rights", partyB: "border-security",
    nationalA: 0.58,
    salience: 0.41,
    // Pragmatic Right crosses over: 67% back a path to legal status. Order and
    // Opportunity Left crosses the other way: pro-enforcement, anti-deportation.
    tilt: tilt(-2.5, -1.8, -1.0, 0.3, 0.0, 0.4, 1.0, 1.9, 2.5),
    source: { label: "Gallup, Jun 2026: 58% oppose deporting all undocumented immigrants" },
    salienceSource: { label: "Gallup, Sep 2024: 41% call immigration extremely important" },
  },
  {
    key: "healthcare",
    partyA: "universal-healthcare", partyB: "free-market-health",
    nationalA: 0.64,
    salience: 0.37,
    // Unconventional Right splits almost exactly 48/51 on government
    // responsibility; the Tuned-Out Middle tilts economically liberal.
    tilt: tilt(-2.2, -1.6, 0.0, -0.7, 0.5, 1.1, 1.4, 2.4, 2.6),
    source: { label: "Gallup, Nov 2025: 64% say government must ensure health coverage" },
    salienceSource: { label: "Gallup, Sep 2024: 37% call healthcare extremely important" },
  },
  {
    key: "taxes",
    partyA: "tax-the-rich", partyB: "low-tax",
    nationalA: 0.58,
    salience: 0.40,
    tilt: tilt(-2.0, -1.3, 0.2, -0.9, 0.5, 1.0, 1.4, 2.0, 2.6),
    source: { label: "Pew, Feb 2025: 58% would raise taxes on households above $400,000" },
    salienceSource: {
      label:
        "Composite of Gallup, Sep 2024: 36% taxes and 34% income distribution. The value used is above both; combining them is a judgement, not an arithmetic result",
      estimated: true,
    },
  },
  {
    key: "equality",
    partyA: "equal-rights", partyB: "traditional-family",
    nationalA: 0.65,
    salience: 0.28,
    // Order and Opportunity Left back same-sex marriage but 71% say gender is
    // determined at birth, so their tilt is much flatter than their overall lean.
    tilt: tilt(-2.4, -2.2, -0.4, -0.4, -0.2, 0.3, 1.0, 2.2, 2.8),
    source: { label: "Gallup, May 2026: 65% say same-sex marriages should be valid" },
    salienceSource: {
      label:
        "Composite of Gallup, Sep 2024: 27% race relations and 18% transgender rights. Combining them is a judgement, not an arithmetic result",
      estimated: true,
    },
  },
  {
    key: "religion",
    partyA: "secular-state", partyB: "catholic-values",
    nationalA: 0.71,
    salience: 0.20,
    tilt: tilt(-1.4, -3.0, 0.2, -0.5, 0.1, 0.6, 0.9, 1.6, 2.2),
    source: { label: "Pew, Nov 2025: 71% say religion should be kept separate from government" },
    salienceSource: { label: "No pollster ranks this as a voting priority", estimated: true },
  },
  {
    key: "labor",
    partyA: "union-labor", partyB: "small-business",
    nationalA: 0.68,
    salience: 0.25,
    tilt: tilt(-1.6, -0.9, 0.3, -1.0, 0.6, 1.0, 1.2, 1.6, 2.0),
    source: {
      label:
        "Mapped, not measured: Gallup, Aug 2025 has 68% approving of labour unions. Approving of unions is not the same as preferring union law to small-business deregulation",
      estimated: true,
    },
    salienceSource: { label: "Labour does not appear on any published priority list", estimated: true },
  },
  {
    key: "criminal-justice",
    partyA: "justice-reform", partyB: "law-and-order",
    nationalA: 0.67,
    salience: 0.35,
    // Order and Opportunity Left trust the police more than groups to their left.
    tilt: tilt(-2.2, -1.4, -0.2, -0.5, 0.1, -0.2, 0.9, 1.6, 2.4),
    source: {
      label:
        "Mapped, not measured: Gallup, Oct 2025 has 67% preferring to address root causes over strengthening law enforcement. The axis it is applied to also covers sentencing, the death penalty and drug policy",
      estimated: true,
    },
    salienceSource: { label: "Gallup, Sep 2024: 35% call crime extremely important" },
  },
  {
    key: "foreign-policy",
    partyA: "peace-party", partyB: "strong-defense",
    nationalA: 0.36,
    salience: 0.45,
    // Only Leftward Progressives are majority-opposed to military dominance (14% support).
    tilt: tilt(-1.4, -1.2, 0.4, -1.2, 0.3, 0.2, 0.8, -0.2, 2.6),
    source: {
      label:
        "Mapped, not measured: Gallup, Feb 2026 has 64% wanting the US to take a leading or major world role, and this uses the complement. \u201cMajor role\u201d includes diplomacy-first internationalists who are not anti-intervention, so 36% is an upper bound on the peace side",
      estimated: true,
    },
    salienceSource: {
      label:
        "Gallup, Sep 2024: 45% call terrorism and national security extremely important. That is a security-threat reading standing in for a peace-versus-defence axis, and it is almost certainly too high for this one",
      estimated: true,
    },
  },
  {
    key: "education",
    partyA: "public-schools", partyB: "school-choice",
    nationalA: 0.52,
    salience: 0.38,
    // Genuinely not a clean two-sided issue: large majorities support both more
    // public funding and more school choice. The near-even split reflects that.
    tilt: tilt(-1.8, -1.6, -0.3, -0.8, 0.2, 0.7, 0.9, 1.8, 2.0),
    source: { label: "Composite: AP-NORC Jan 2025 (64% say too little is spent on education) against EdChoice 2026 (69% support vouchers)", estimated: true },
    salienceSource: { label: "Gallup, Sep 2024: 38% call education extremely important" },
  },
  {
    key: "trade",
    partyA: "free-trade", partyB: "fair-trade",
    nationalA: 0.59,
    salience: 0.28,
    // Cross-cutting: the right has swung protectionist since 2016 while the
    // college-educated left, once the sceptics, now lean free trade.
    tilt: tilt(-2.2, -1.4, -0.6, -0.4, -0.3, 0.6, 0.4, 1.9, 1.0),
    source: {
      label:
        "Mapped, not measured: Pew, Apr 2025 has 59% disapproving of the 2025 tariff increases. Disapproving of one round of tariffs is not the same as preferring free trade to industrial protection",
      estimated: true,
    },
    salienceSource: { label: "Gallup, Sep 2024: 28% call trade with other nations extremely important", estimated: true },
  },
  {
    key: "finance",
    partyA: "consumer-protection", partyB: "free-finance",
    nationalA: 0.62,
    salience: 0.18,
    tilt: tilt(-1.8, -1.0, 0.3, -1.4, 0.7, 1.0, 1.3, 1.4, 2.4),
    source: {
      label:
        "Mapped, not measured: Pew, Jan 2024 has 62% saying banks and financial institutions have a negative effect on the country. Distrust of banks is a proxy for wanting them regulated, not a poll of it",
      estimated: true,
    },
    salienceSource: { label: "Financial regulation appears on no published priority list", estimated: true },
  },
  {
    key: "government",
    partyA: "public-service", partyB: "lean-government",
    nationalA: 0.55,
    salience: 0.24,
    tilt: tilt(-2.6, -1.4, -0.6, -1.2, 0.2, 0.9, 0.8, 2.4, 2.2),
    source: {
      label:
        "Mapped, not measured: Pew, Apr 2025 has 55% saying the 2025 cuts to federal agencies went too far. A reaction to one year's cuts stands in for a standing view of how large the workforce should be",
      estimated: true,
    },
    salienceSource: { label: "Gallup, Sep 2024: 'the way the government works' is not broken out; 24% is a judgement", estimated: true },
  },
  {
    key: "technology",
    partyA: "tech-accountability", partyB: "tech-innovation",
    nationalA: 0.58,
    salience: 0.16,
    // Unusually flat: concern about AI runs across the spectrum, and the
    // deregulatory wing is a small libertarian-leaning slice of each side.
    tilt: tilt(-0.5, 0.2, -0.6, -0.1, 0.3, 0.3, 0.2, 0.6, 0.4),
    source: {
      label:
        "Pew, Apr 2025: 58% are more worried that government will not go far enough regulating AI than that it will go too far. AI stands in for the whole technology axis, which also covers platforms and children's online safety",
      estimated: true,
    },
    salienceSource: { label: "Technology regulation appears on no published priority list", estimated: true },
  },
  {
    key: "public-lands",
    partyA: "public-lands", partyB: "multiple-use",
    nationalA: 0.70,
    salience: 0.12,
    tilt: tilt(-2.4, -1.4, -0.4, -0.8, 0.2, 0.6, 0.6, 1.8, 2.2),
    source: {
      label:
        "Mapped, not measured: Colorado College State of the Rockies, Feb 2025 has 72% of voters in eight Western states opposing the sale of public lands; 70% extends a Western poll to the whole country",
      estimated: true,
    },
    salienceSource: { label: "Public lands appear on no national priority list; salient mainly in the West", estimated: true },
  },
  {
    key: "welfare",
    partyA: "safety-net", partyB: "self-reliance",
    nationalA: 0.46,
    salience: 0.27,
    // The Tuned-Out Middle and Order and Opportunity Left are economically
    // liberal on aid but back work requirements, so they sit near the centre.
    tilt: tilt(-2.6, -1.8, -0.8, -1.4, 0.2, 0.3, 1.0, 1.6, 2.6),
    source: {
      label:
        "Composite: KFF, Jun 2025 has 62% supporting Medicaid work requirements, against Pew, Jan 2025 with 55% saying government should do more for the needy. A near-even split is the honest reading of two questions pointing different ways",
      estimated: true,
    },
    salienceSource: { label: "Gallup, Sep 2024: 27% call poverty and homelessness extremely important", estimated: true },
  },
  {
    key: "elections",
    partyA: "voting-access", partyB: "election-integrity",
    nationalA: 0.50,
    salience: 0.30,
    tilt: tilt(-3.0, -2.2, -1.0, -1.4, 0.0, 0.8, 1.0, 2.6, 2.8),
    source: {
      label:
        "Composite: Pew, Feb 2024 has 81% backing photo ID and 58% backing automatic registration. Both sides of this axis command majorities on their signature question, so the split is set at even",
      estimated: true,
    },
    salienceSource: { label: "Gallup, Sep 2024: 49% call democracy extremely important, but that figure already drives the democracy axis; 30% is a judgement for election rules alone", estimated: true },
  },

  // One-sided issues: no organised opposing party exists on this site, so the
  // tilt governs how likely someone is to care rather than which side they take.
  {
    key: "democracy",
    partyA: "anti-corruption",
    salience: 0.49,
    tilt: tilt(0.0, -0.2, 0.2, 0.1, -0.3, 0.2, 0.6, 0.2, 0.5),
    source: { label: "Not a national split — this axis has one party only, so the figure shapes who cares, not who wins. Pew, Jul 2023: 87% support congressional term limits; 72% support campaign spending limits" },
    salienceSource: { label: "Gallup, Sep 2024: 49% call democracy extremely important — 2nd of 22. Pew, Apr 2026: money in politics is the top-rated problem at 74%" },
  },
  {
    key: "fiscal",
    partyA: "balanced-budget", partyB: "public-investment",
    // Was one-sided until a review pointed out that six of the seven one-sided
    // parties are always-YES on spending and only balanced-budget is ever
    // against, which made every appropriations bill a rigged fiscal referendum.
    nationalA: 0.54,
    salience: 0.32,
    tilt: tilt(0.9, 0.6, 0.2, 1.0, -0.4, -0.2, -0.3, -0.2, -0.6),
    source: {
      label:
        "Derived, not measured: Gallup's long-running governance item runs roughly 54% \u201cgovernment is doing too many things\u201d against 43% \u201cgovernment should do more\u201d. That is a proxy for deficit-hawk versus public-investment, not a poll of it",
      estimated: true,
    },
    salienceSource: { label: "Gallup, Sep 2024: 32% call the federal budget deficit extremely important" },
  },
  {
    key: "veterans",
    partyA: "veterans-first",
    salience: 0.25,
    tilt: tilt(0.7, 0.6, 0.2, 0.5, -0.2, 0.0, -0.1, -0.2, -0.4),
    source: { label: "Not a national split — this axis has one party only, so the figure shapes who cares, not who wins. No head-to-head polling; veterans' benefits enjoy broad bipartisan support", estimated: true },
    salienceSource: { label: "Not on any published priority list", estimated: true },
  },
  {
    key: "rural",
    partyA: "rural-farmers",
    salience: 0.12,
    tilt: tilt(0.8, 0.9, 0.3, 0.4, 0.1, -0.2, -0.2, -0.5, -0.6),
    source: { label: "Not a national split — this axis has one party only, so the figure shapes who cares, not who wins. No head-to-head polling; concentrated among rural residents, who skew right", estimated: true },
    salienceSource: { label: "Not on any published priority list", estimated: true },
  },
  {
    key: "housing",
    partyA: "housing-for-all",
    salience: 0.28,
    tilt: tilt(-0.7, -0.5, 0.1, -0.5, 0.6, 0.5, 0.8, 0.4, 0.8),
    source: { label: "Not a national split — this axis has one party only, so the figure shapes who cares, not who wins. Pew, Apr 2026: cost of living ranks among the top-rated national problems", estimated: true },
    salienceSource: { label: "Housing is not broken out separately on national priority lists", estimated: true },
  },
  {
    key: "civil-liberties",
    partyA: "digital-rights",
    salience: 0.22,
    // Cross-cutting: strongest among the young left and the libertarian right.
    tilt: tilt(0.2, -0.3, 0.5, -0.3, -0.3, 0.0, 0.3, 0.2, 0.7),
    source: { label: "Not a national split — this axis has one party only, so the figure shapes who cares, not who wins. Pew, May 2023: 71% are concerned about how government uses their data; 81% about companies" },
    salienceSource: { label: "Privacy is not on any published priority list", estimated: true },
  },
  {
    key: "animals",
    partyA: "animal-welfare",
    salience: 0.15,
    tilt: tilt(-0.4, -0.2, 0.0, -0.1, 0.0, 0.1, 0.2, 0.3, 0.6),
    source: { label: "Not a national split — this axis has one party only, so the figure shapes who cares, not who wins. Gallup, May 2015: 32% say animals deserve the same rights as people, 62% some protection. The only reading available, and eleven years old", estimated: true },
    salienceSource: { label: "Animal welfare appears on no priority list", estimated: true },
  },
  {
    key: "disaster",
    partyA: "disaster-readiness",
    salience: 0.14,
    tilt: tilt(-0.2, 0.0, 0.1, 0.0, 0.2, 0.3, 0.2, 0.2, 0.3),
    source: { label: "Not a national split — this axis has one party only, so the figure shapes who cares, not who wins. Disaster relief enjoys broad bipartisan support; no head-to-head polling", estimated: true },
    salienceSource: { label: "Not on any published priority list; concentrated in coastal and wildfire states", estimated: true },
  },
  {
    key: "seniors",
    partyA: "seniors",
    salience: 0.30,
    // The oldest groups (Pragmatic Right, Faith First) care most; the youngest
    // (Leftward Progressives, Unconventional Right) least.
    tilt: tilt(0.3, 0.6, -0.6, 0.9, 0.2, 0.2, 0.1, 0.0, -0.8),
    source: { label: "Not a national split — this axis has one party only, so the figure shapes who cares, not who wins. Pew, Jan 2025: 79% oppose reducing Social Security benefits" },
    salienceSource: { label: "Gallup, Sep 2024: 30% is a judgement; Social Security is not on the 22-issue list but tops AARP's own polling of voters over 50", estimated: true },
  },
];

/**
 * The share of a group's non-voters who are modelled as delegating to the blank
 * vote and nothing else.
 *
 * There is no survey behind this number. It exists because "did not vote in
 * 2024" and "would not take part in anything" are not the same population, and
 * half is the least opinionated way to split them. It matters more than its
 * obscurity suggests: it hard-wires about a fifth of the electorate to blank
 * before a single bill is read, and it caps simulated turnout at roughly 79%.
 * Halving or doubling it moves every participation figure on the site by
 * something like ten points.
 */
export const NONVOTER_BLANK_SHARE = 0.5;

export const ELECTORATE_SIZE = 10_000;
export const ELECTORATE_SEED = 20260610; // the publication date of the Pew typology

/**
 * Share-weighted mean group turnout, used to normalise engagement to 1.0
 * nationally. Pew's published group shares are each rounded to a whole
 * percentage point and sum to 1.01, so this divides by the sum rather than
 * assuming it is 1 — otherwise the "average" citizen normalises to 0.99.
 */
export const SHARE_TOTAL = TYPOLOGY.reduce((s, g) => s + g.share, 0);
export const MEAN_TURNOUT =
  TYPOLOGY.reduce((s, g) => s + g.share * g.turnout, 0) / SHARE_TOTAL;
