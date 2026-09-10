/**
 * @module
 *
 * Where a corpus is: the directory a command was pointed at or found under
 * the working directory, the register that makes it one, the repository it
 * sits in, and the workflow it is checked against.
 */
export {
  CORPUS_DIR,
  REGISTER_FILE,
  WORKFLOW_FILE,
} from "./constants.js";
export { default as locateCorpus } from "./locateCorpus.js";
export type { Located } from "./types.js";
