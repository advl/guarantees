/**
 * @module
 *
 * The host test runner: how an entry is invoked inside the image, the
 * configuration a corpus runs under, the corpus layout the runner and a run
 * agree on, and what the runner says it would collect. The first three are
 * pure; the last asks the corpus's own runner.
 */
export {
  COLLECTS,
  REPORT_FILE,
  REPORTS_DIR,
  RUNNER_BIN,
  WORK_DIR,
  WORKSPACE,
} from "./constants.js";
export { default as defineCorpusConfig } from "./defineCorpusConfig.js";
export { default as listCollected } from "./listCollected.js";
export { default as renderEntryCommand } from "./renderEntryCommand.js";
