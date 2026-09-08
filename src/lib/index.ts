/**
 * @module
 *
 * The lib barrel: every name a domain barrel mints, in one place, so that the
 * entry modules at the top of `src/` reach one level down and no deeper.
 * A name minted here and admitted by no entry module carries `@package` on
 * its definition, and `check:structure` holds the two lists to each other.
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
  type Spawn,
  type Spawned,
  type SpawnOptions,
  spawnProcess,
} from "./process/index.js";
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
  CORPUS_LABEL,
  type DescribeContext,
  describeRun,
  ENGINE,
  ENGINE_FAULT_CODE,
  ENTRY_LABEL,
  type Engine,
  hashCheckout,
  KILL_MULTIPLIER,
  MARKER_FILE,
  type Mount,
  NAME_PREFIX,
  probeEngine,
  type RunContext,
  type RunPhase,
  type RunSpec,
  reapStale,
  TASK_FACE,
} from "./run/index.js";
export {
  COLLECTS,
  defineCorpusConfig,
  listCollected,
  REPORT_FILE,
  REPORTS_DIR,
  RUNNER_BIN,
  renderEntryCommand,
  WORK_DIR,
  WORKSPACE,
} from "./runner/index.js";
export {
  judgeWall,
  type Plan,
  planTier,
} from "./schedule/index.js";
export {
  type ExitCode,
  judgeRun,
  readReport,
  type Summary,
  toExitCode,
  type Verdict,
} from "./verdict/index.js";
