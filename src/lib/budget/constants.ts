import { registerSchema } from "../contract/index.js";

/**
 * How many measured windows a budget is set from, read from the one place
 * the register schema states it. Fewer is not the rule's p95: the estimator
 * is defined over the count the contract names, so a budget set from three
 * windows answers to a different rule than the one a reader checks by hand.
 *
 * It is minted here rather than read from the schema at each of its two
 * readers, because the count a caller loops and the count `computeP95`
 * refuses below are one fact, and two reads of it can be made to disagree.
 *
 * @package
 */
export const BUDGET_RUNS: number =
  registerSchema.$defs.limits.const.budget.runs;
