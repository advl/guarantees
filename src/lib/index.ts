/**
 * @module
 *
 * The lib barrel: every name a domain barrel mints, in one place, so that the
 * entry modules at the top of `src/` reach one level down and no deeper.
 */
export {
  computeBudget,
  computeP95,
  type Measurement,
  type Phase,
  type Probe,
  type Reading,
  readProbe,
  rewriteRunBudget,
  type Stamp,
} from "./budget/index.js";
export {
  CONTRACT_VERSION,
  EXIT_CODES,
  labelSchema,
  markerSchema,
  probeSchema,
  Refusal,
  registerSchema,
  reportSchema,
} from "./contract/index.js";
export {
  CEILINGS,
  type Expect,
  ISOLATIONS,
  type Isolation,
  KINDS,
  type Kind,
  type Pipeline,
  POOLED_KINDS,
  parseRegister,
  RESERVED_IDS,
  type Register,
  type RegisterFault,
  RegisterRefusal,
  type Row,
  type RunBudget,
  TIERS,
  type Tier,
  UNMEASURED_S,
} from "./register/index.js";
export {
  type ExitCode,
  judgeRun,
  readReport,
  type Summary,
  toExitCode,
  type Verdict,
} from "./verdict/index.js";
