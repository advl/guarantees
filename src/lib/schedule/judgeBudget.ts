import { computeBudget, type Measurement } from "../budget/index.js";
import { CEILINGS, type Tier } from "../register/index.js";
import type { Verdict } from "../verdict/index.js";

/**
 * Judges the budget a fresh measurement sets against the per-entry ceiling
 * of the tier the row sits at.
 *
 * A re-measurement is a number about the machine that took it, and writing
 * one back is the moment a row can stop being admissible: the parser refuses
 * a budget past its tier's ceiling, so a measurement the writer never judged
 * leaves a register that every later command declines, produced by a command
 * that reported success. The comparison is made here rather than in the
 * sentence a caller prints, because a message stating a bound is a message
 * whose bound was checked.
 *
 * The remedy is the parser's own, said the same way, because the reader is
 * looking at one fact from two places: an entry costing more than its tier
 * admits either belongs at a later tier or has to become cheaper.
 *
 * @throws Refusal from `computeBudget` when the p95 is not a measurement.
 */
export default function judgeBudget(
  measurement: Measurement,
  tier: Tier,
): Verdict {
  const budget = computeBudget(measurement.p95);
  const ceiling = CEILINGS[tier].entry;
  const ok = budget <= ceiling;
  return {
    ok,
    reason: ok
      ? `p95 ${measurement.p95.toFixed(1)} s on ${measurement.class}, budget ${budget} s, inside the ${tier} tier's ${ceiling} s ceiling per entry`
      : `p95 ${measurement.p95.toFixed(1)} s on ${measurement.class}, budget ${budget} s, past the ${tier} tier's ${ceiling} s ceiling per entry — a register carrying it is one every command refuses, so promote the row to a later tier or make the entry cheaper`,
  };
}
