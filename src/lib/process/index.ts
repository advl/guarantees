/**
 * @module
 *
 * The host process: one boundary, spawned under a deadline, that every
 * impure module in the package takes as a `Spawn` and defaults to the real
 * one, so a unit test hands in a fake and an integration test hands in
 * nothing.
 */
export { default as spawnProcess } from "./spawnProcess.js";
export type { Spawn, Spawned, SpawnOptions } from "./types.js";
