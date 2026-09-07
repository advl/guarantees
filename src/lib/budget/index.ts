/**
 * @module
 *
 * What a budget is: probe readings read into values, an entry's measured
 * windows taken to a p95, the p95 turned into a budget by the one rule, and
 * the budget written back into the register text as a single replaced line.
 * Pure: the caller runs the entry, reads the probe and writes the register.
 */
export { default as computeBudget } from "./computeBudget.js";
export { default as computeP95 } from "./computeP95.js";
export {
  default as readProbe,
  type Phase,
  type Probe,
  type Reading,
  type Stamp,
} from "./readProbe.js";
export {
  default as rewriteRunBudget,
  type Measurement,
} from "./rewriteRunBudget.js";
