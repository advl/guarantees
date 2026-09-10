/**
 * @module
 *
 * The `./selftest` entry point: the five bodies a corpus imports rather
 * than re-authors, each opening one suite named by the row that runs it.
 */
export {
  COLLECTS,
  describeBijection,
  describeCanFail,
  describeImageTie,
  describeLayering,
  describeToolchainStamp,
  listTierImages,
  readPipeline,
} from "./lib/index.js";
