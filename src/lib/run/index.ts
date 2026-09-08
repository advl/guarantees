/**
 * @module
 *
 * The admissible run: the engine probed once, the checkout label, the shape
 * of a run as data — the name, the labels, the mounts, the network wall, the
 * deadline — and the calls that start, list, remove and reap containers.
 * Everything that spawns takes a `Spawn` and defaults to `spawnProcess`, so
 * a test hands in a fake and an integration test the real one.
 */
export {
  CORPUS_LABEL,
  ENGINE,
  ENGINE_FAULT_CODE,
  ENTRY_LABEL,
  KILL_MULTIPLIER,
  MARKER_FILE,
  NAME_PREFIX,
  TASK_FACE,
} from "./constants.js";
export { default as describeRun } from "./describeRun.js";
export { default as hashCheckout } from "./hashCheckout.js";
export { default as probeEngine } from "./probeEngine.js";
export { default as reapStale } from "./reapStale.js";
export { default as runEntry } from "./runEntry.js";
export { default as tearDown } from "./tearDown.js";
export type {
  DescribeContext,
  Engine,
  Mount,
  Ran,
  RunContext,
  RunPhase,
  RunSpec,
} from "./types.js";
