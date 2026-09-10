/**
 * @module
 *
 * The host test runner: how an entry is invoked inside the image, the
 * configuration a corpus runs under, the corpus layout the runner and a run
 * agree on, what the runner says it would collect, and the register judged
 * against that answer in both directions. Only `listCollected` is impure;
 * it is what asks the corpus's own runner.
 *
 * The two finders and the judgement over them live here, beside the answer
 * they consume, rather than beside the body that asserts them: the question
 * is what the runner would collect against what the register promises, and
 * the pre-flight a command runs and the entry a tier runs both have to
 * answer it the same way. Here, neither reaches a module that imports the
 * test runner to ask it.
 */
export {
  COLLECTS,
  INSTALL_DIR,
  LIFT_DIR,
  REPORT_FILE,
  REPORTS_DIR,
  RUNNER_BIN,
  RUNNER_SCRATCH,
  WORK_DIR,
  WORKSPACE,
} from "./constants.js";
export { default as defineCorpusConfig } from "./defineCorpusConfig.js";
export { default as findUnclaimedFiles } from "./findUnclaimedFiles.js";
export { default as findUncollectedRows } from "./findUncollectedRows.js";
export { type Corpus, default as judgeCorpus } from "./judgeCorpus.js";
export { default as listCollected } from "./listCollected.js";
export { default as renderEntryCommand } from "./renderEntryCommand.js";
