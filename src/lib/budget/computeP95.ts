import { Refusal, registerSchema } from "../contract/index.js";

/**
 * How many measured windows a budget is set from, read from the one place
 * the register schema states it. Fewer is not the rule's p95: the estimator
 * is defined over the count the contract names, so a budget set from three
 * windows would answer to a different rule than the one a reader checks.
 */
const { runs } = registerSchema.$defs.limits.const.budget;

/**
 * The p95 of an entry's measured windows, in seconds, by nearest rank: the
 * samples sorted ascending, the one at position ceil(0.95 × n), which for the
 * contract's five windows is the slowest. Nearest rank and not interpolation,
 * because two implementations of the contract must set the same budget from
 * the same windows, and an interpolated p95 of five samples is a number no
 * run produced.
 *
 * @throws Refusal when fewer windows than the contract's count are given, or
 * when a window is not a finite, non-negative number of seconds.
 */
export default function computeP95(seconds: readonly number[]): number {
  if (seconds.length < runs) {
    throw new Refusal(
      `${seconds.length} measured window${seconds.length === 1 ? "" : "s"} is fewer than the ${runs} a budget is set from — a p95 of fewer runs is not the rule's p95`,
    );
  }
  const unmeasured = seconds.find(
    (window) => !Number.isFinite(window) || window < 0,
  );
  if (unmeasured !== undefined) {
    throw new Refusal(
      `a measured window of ${unmeasured} is not a measurement — a budget is derived from a finite number of seconds`,
    );
  }
  const sorted = [...seconds].sort((left, right) => left - right);
  // The sample at nearest rank is the largest of the first ceil(0.95 × n)
  // sorted, which spares an index the compiler cannot see is in range.
  return Math.max(...sorted.slice(0, Math.ceil(0.95 * sorted.length)));
}
