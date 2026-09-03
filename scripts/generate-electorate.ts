import "./_env";
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PARTIES, BLANK_PARTY_SLUG } from "../src/lib/parties";
import {
  AXES, TYPOLOGY, ELECTORATE_SIZE, ELECTORATE_SEED, MEAN_TURNOUT, NONVOTER_BLANK_SHARE,
} from "../src/lib/electorate-model";
import type { TypologyGroup } from "../src/lib/electorate-model";

/** Deterministic PRNG so the electorate is reproducible from the seed alone. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const logit = (p: number) => Math.log(p / (1 - p));

/**
 * Probability that a citizen of this group ends up delegating this issue at all:
 * they must not be a full abstainer, and they must care enough about the issue.
 */
function participation(group: TypologyGroup, salience: number): number {
  const engaged = 1 - (1 - group.turnout) * NONVOTER_BLANK_SHARE;
  return engaged * Math.min((salience * group.turnout) / MEAN_TURNOUT, 0.95);
}

/**
 * Solve for the per-issue intercept that makes the share on side A equal the
 * published national number. Weighted by participation, not by raw population:
 * groups that mostly sit the issue out cannot move the split we display.
 * Bisection converges because the weighted sigmoid is monotone in the intercept.
 */
function calibrate(tilts: Record<string, number>, salience: number, target: number): number {
  const weights = TYPOLOGY.map((g) => g.share * participation(g, salience));
  const total = weights.reduce((a, b) => a + b, 0);

  const weighted = (c: number) =>
    TYPOLOGY.reduce((s, g, i) => s + (weights[i] / total) * sigmoid(tilts[g.key] + c), 0);

  let lo = -12;
  let hi = 12;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (weighted(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Maximum delegates before the terminal blank vote. */
const DELEGATE_CAP = 12;

const partyIndex = new Map(PARTIES.map((p, i) => [p.slug, i]));
const BLANK_INDEX = partyIndex.get(BLANK_PARTY_SLUG)!;

function main() {
  const rand = mulberry32(ELECTORATE_SEED);

  const intercepts = new Map<string, number>();
  for (const axis of AXES) {
    if (axis.partyB && axis.nationalA !== undefined) {
      intercepts.set(axis.key, calibrate(axis.tilt, axis.salience, axis.nationalA));
    }
  }

  // Cumulative group shares for sampling.
  const shareTotal = TYPOLOGY.reduce((s, g) => s + g.share, 0);
  const cumulative: number[] = [];
  let acc = 0;
  for (const g of TYPOLOGY) {
    acc += g.share / shareTotal;
    cumulative.push(acc);
  }

  const citizens: { g: number; d: number[] }[] = [];
  const sideTally = new Map<string, number>();
  const partyTally = new Array(PARTIES.length).fill(0);
  const firstChoiceTally = new Array(PARTIES.length).fill(0);
  let lengthTotal = 0;
  let blankOnly = 0;
  let blankFromAbstainers = 0;

  for (let n = 0; n < ELECTORATE_SIZE; n++) {
    const u = rand();
    const gi = cumulative.findIndex((c) => u <= c);
    const group = TYPOLOGY[gi === -1 ? TYPOLOGY.length - 1 : gi];

    // Engagement: relative to the national mean, so the average citizen is 1.0.
    const engagement = group.turnout / MEAN_TURNOUT;

    // Some people would simply not take part. See NONVOTER_BLANK_SHARE.
    if (rand() < (1 - group.turnout) * NONVOTER_BLANK_SHARE) {
      citizens.push({ g: TYPOLOGY.indexOf(group), d: [BLANK_INDEX] });
      blankOnly++;
      blankFromAbstainers++;
      lengthTotal += 1;
      partyTally[BLANK_INDEX]++;
      firstChoiceTally[BLANK_INDEX]++;
      continue;
    }

    // Pick a side per issue, and race the ones they care about by salience.
    const picks: { slug: string; index: number; key: number }[] = [];
    for (const axis of AXES) {
      const t = axis.tilt[group.key] ?? 0;

      let slug: string;
      if (axis.partyB && axis.nationalA !== undefined) {
        const p = sigmoid(t + intercepts.get(axis.key)!);
        slug = rand() < p ? axis.partyA : axis.partyB;
      } else {
        slug = axis.partyA;
      }

      // How likely this person is to hand this issue to a delegate at all.
      // A one-sided axis has no side to choose, so its tilt shifts the odds of
      // caring instead — through the same logistic link, so that a tilt of +1
      // means one log-odds on both kinds of axis.
      const base = Math.min(axis.salience * engagement, 0.95);
      const cares = axis.partyB ? base : sigmoid(logit(base) + t);
      if (rand() >= Math.min(cares, 0.95)) continue;

      // Exponential race: higher salience tends to sort earlier, but not always.
      picks.push({ slug, index: partyIndex.get(slug)!, key: -Math.log(rand()) / axis.salience });
    }

    picks.sort((a, b) => a.key - b.key);
    const kept = picks.slice(0, DELEGATE_CAP);
    // Tally sides after the cap, not before: the calibration figure has to
    // describe the lists that actually exist, not the ones before truncation.
    for (const k of kept) sideTally.set(k.slug, (sideTally.get(k.slug) ?? 0) + 1);
    const delegation = kept.map((p) => p.index);
    delegation.push(BLANK_INDEX); // the blank vote always terminates the list

    citizens.push({ g: TYPOLOGY.indexOf(group), d: delegation });
    lengthTotal += delegation.length;
    if (delegation.length === 1) blankOnly++;
    delegation.forEach((i) => partyTally[i]++);
    firstChoiceTally[delegation[0]]++;
  }

  const payload = {
    seed: ELECTORATE_SEED,
    size: ELECTORATE_SIZE,
    generatedAt: new Date().toISOString().slice(0, 10),
    groups: TYPOLOGY.map((g) => g.key),
    parties: PARTIES.map((p) => p.slug),
    citizens: citizens.map((c) => [c.g, ...c.d]),
  };
  // The hash identifies which electorate produced a cached tally, so results
  // computed against an older population can be spotted and recomputed.
  const hash = createHash("sha256")
    .update(JSON.stringify(payload.citizens))
    .digest("hex")
    .slice(0, 16);

  writeFileSync("data/electorate.json", JSON.stringify({ hash, ...payload }));

  const stats = {
    hash,
    size: ELECTORATE_SIZE,
    averageDelegates: +(lengthTotal / ELECTORATE_SIZE).toFixed(2),
    blankOnlyShare: +(blankOnly / ELECTORATE_SIZE).toFixed(4),
    // Two different people end up blank-only: those who opted out entirely, and
    // those who took part but cared about nothing on the list.
    blankFromAbstainers: +(blankFromAbstainers / ELECTORATE_SIZE).toFixed(4),
    blankFromIndifference: +((blankOnly - blankFromAbstainers) / ELECTORATE_SIZE).toFixed(4),
    calibration: AXES.filter((a) => a.partyB).map((a) => {
      // What the intercept is fitted to, and what it therefore is not. The
      // fitted figure is the split among people who delegate the issue; the
      // population figure is the split across all simulated adults, computed
      // exactly from the model rather than sampled.
      const c = intercepts.get(a.key) ?? 0;
      const population =
        TYPOLOGY.reduce((s2, g) => s2 + (g.share / shareTotal) * sigmoid((a.tilt[g.key] ?? 0) + c), 0);
      return {
        axis: a.key,
        target: a.nationalA,
        achieved: +((sideTally.get(a.partyA) ?? 0) /
          ((sideTally.get(a.partyA) ?? 0) + (sideTally.get(a.partyB!) ?? 0))).toFixed(4),
        population: +population.toFixed(4),
      };
    }),
    partyShare: PARTIES.map((p, i) => ({
      slug: p.slug,
      inList: +(partyTally[i] / ELECTORATE_SIZE).toFixed(4),
      firstChoice: +(firstChoiceTally[i] / ELECTORATE_SIZE).toFixed(4),
    })).sort((a, b) => b.inList - a.inList),
  };
  writeFileSync("data/electorate-stats.json", JSON.stringify(stats, null, 2));

  console.log(`electorate ${hash} — ${ELECTORATE_SIZE} citizens`);
  console.log(`average delegates per citizen: ${stats.averageDelegates}`);
  console.log(`blank vote only: ${(stats.blankOnlyShare * 100).toFixed(1)}%\n`);
  console.log("calibration — side A share: target | among delegators (fitted) | whole population:");
  for (const c of stats.calibration) {
    const drift = Math.abs((c.achieved ?? 0) - (c.target ?? 0));
    console.log(
      `  ${c.axis.padEnd(20)} ${c.target?.toFixed(3)} → ${c.achieved.toFixed(3)} | ${c.population.toFixed(3)}  ${drift > 0.02 ? "⚠" : "✓"}`,
    );
  }
  console.log("\nmost delegated-to parties:");
  for (const p of stats.partyShare.slice(0, 8)) {
    console.log(`  ${p.slug.padEnd(24)} in ${(p.inList * 100).toFixed(1)}% of lists, first for ${(p.firstChoice * 100).toFixed(1)}%`);
  }
}

main();
