/**
 * @module
 *
 * A tier's plan: which rows run in the pool, which one at a time, how wide
 * the pool runs, the wall judged once over the whole schedule, and a fresh
 * measurement judged against what the tier admits per entry. Nothing here
 * starts a container; `runPool` starts only what its caller hands it.
 *
 * The partition, the wall and the images a tier names are what a tier means,
 * and all three are admitted to the package root: a program embedding the
 * scheduler plans tiers, and a corpus registers one assertion per image the
 * tier it belongs to runs in. The pool is not: how many rows a program runs
 * at once is a property of that program's own process model, and one
 * embedding this scheduler inside a job runner it already has would be
 * handed a width it did not choose. The executable this package ships
 * reaches it through this barrel, which is why it is not minted one level
 * up.
 */
export { default as judgeBudget } from "./judgeBudget.js";
export { default as judgeWall } from "./judgeWall.js";
export { default as listTierImages } from "./listTierImages.js";
export { default as planTier, type Plan } from "./planTier.js";
export { default as runPool } from "./runPool.js";
