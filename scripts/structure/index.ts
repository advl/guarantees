/**
 * @module
 *
 * The clauses of the structure law, one per module, each reporting the
 * violations it finds in one parsed file. The sweep in `check-structure.ts`
 * decides which clauses a file is held to.
 */
export { default as checkBarrel } from "./checkBarrel.js";
export { default as checkCallTimeReads } from "./checkCallTimeReads.js";
export { default as checkCollection } from "./checkCollection.js";
export { default as checkDocumentation } from "./checkDocumentation.js";
export { default as checkExecutable } from "./checkExecutable.js";
export { default as checkImplementation } from "./checkImplementation.js";
export { default as checkMembers } from "./checkMembers.js";
export { default as checkRuntime } from "./checkRuntime.js";
export { default as checkSpecifiers } from "./checkSpecifiers.js";
export { default as checkVisibility } from "./checkVisibility.js";
export {
  COLLECTIONS,
  EXECUTABLES,
  FILE_SIZE_THRESHOLD,
} from "./constants.js";
export type { Checked, Package, Violation } from "./types.js";
