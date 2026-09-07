/**
 * @module
 *
 * The register: text to rows, or a refusal naming the table, the column and
 * the line of every fault. Pure: the caller reads the file and the workflow,
 * and says which tiers the pipeline triggers and proves and which files the
 * runner collects.
 */
export {
  CEILINGS,
  ISOLATIONS,
  KINDS,
  POOLED_KINDS,
  RESERVED_IDS,
  TIERS,
  UNMEASURED_S,
} from "./constants.js";
export { default as parseRegister } from "./parseRegister.js";
export { default as RegisterRefusal } from "./RegisterRefusal.js";
export type {
  Expect,
  Isolation,
  Kind,
  Pipeline,
  Register,
  RegisterFault,
  Row,
  RunBudget,
  Tier,
} from "./types.js";
