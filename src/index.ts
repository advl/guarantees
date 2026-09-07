/**
 * @module
 *
 * The package index: the curated public surface of `@aztlan/guarantees`.
 *
 * Every value a consumer imports from the package root is admitted here by
 * name. Importing this module has no side effects.
 */
export {
  CONTRACT_VERSION,
  computeBudget,
  computeP95,
  EXIT_CODES,
  labelSchema,
  type Measurement,
  markerSchema,
  type Phase,
  type Probe,
  probeSchema,
  type Reading,
  Refusal,
  readProbe,
  registerSchema,
  reportSchema,
  rewriteRunBudget,
  type Stamp,
} from "./lib/index.js";
