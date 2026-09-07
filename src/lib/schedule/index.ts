/**
 * @module
 *
 * A tier's plan: which rows run in the pool and which one at a time, and
 * the wall judged once over the whole schedule. Pure: nothing here starts a
 * container.
 */
export { default as judgeWall } from "./judgeWall.js";
export { default as planTier, type Plan } from "./planTier.js";
