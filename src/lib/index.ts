/**
 * @module
 *
 * The lib barrel: the names the entry modules at the top of `src/` choose
 * among, in one place, so that each of them reaches one level down and no
 * deeper. A name minted here and admitted by no entry module carries
 * `@package` on its definition, and `check:structure` holds the two lists
 * to each other.
 *
 * It is curated and not a gathering of everything below it: a name whose
 * only readers are inside its own domain, or in one other domain that
 * reaches it through that domain's own barrel, is minted there and stops
 * there. Listing it here would put it one import away from the published
 * surface and would say nothing true about what the package publishes.
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
  type Accepted,
  acceptGolden,
} from "./golden/index.js";
export {
  type Built,
  buildImage,
  CONTAINERFILE,
  hashImageInputs,
  IMAGES_DIR,
  type ImageRef,
  INPUTS_PATTERN,
  PINNED_FILE,
  type Pinned,
  REFERENCE_PATTERN,
  readPinned,
  resolveImage,
} from "./image/index.js";
export {
  type Spawn,
  type Spawned,
  type SpawnOptions,
  spawnProcess,
} from "./process/index.js";
export {
  type ProveContext,
  proveTier,
} from "./prove/index.js";
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
  readPipeline,
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
  type Ran,
  type RunContext,
  type RunPhase,
  type RunSpec,
  reapStale,
  runEntry,
  TASK_FACE,
  tearDown,
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
  listTierImages,
  type Plan,
  planTier,
} from "./schedule/index.js";
export {
  describeBijection,
  describeCanFail,
  describeImageTie,
  describeLayering,
  describeToolchainStamp,
} from "./selftest/index.js";
export {
  type ExitCode,
  judgeRun,
  readReport,
  type Summary,
  toExitCode,
  type Verdict,
} from "./verdict/index.js";
