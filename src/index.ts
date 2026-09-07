/**
 * @module
 *
 * The package index: the curated public surface of `@aztlan/guarantees`.
 *
 * Every value a consumer imports from the package root is admitted here by
 * name. Importing this module has no side effects.
 */
export {
  CEILINGS,
  CONTRACT_VERSION,
  computeBudget,
  computeP95,
  EXIT_CODES,
  type Expect,
  ISOLATIONS,
  type Isolation,
  KINDS,
  type Kind,
  labelSchema,
  type Measurement,
  markerSchema,
  type Phase,
  type Pipeline,
  POOLED_KINDS,
  type Probe,
  parseRegister,
  probeSchema,
  RESERVED_IDS,
  type Reading,
  Refusal,
  type Register,
  type RegisterFault,
  RegisterRefusal,
  type Row,
  type RunBudget,
  readProbe,
  registerSchema,
  reportSchema,
  rewriteRunBudget,
  type Stamp,
  TIERS,
  type Tier,
  UNMEASURED_S,
} from "./lib/index.js";
