import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { TestProject } from "vitest/node";
import { buildImage, resolveImage } from "../lib/image/index.js";
import { type Spawn, spawnProcess } from "../lib/process/index.js";
import { UNMEASURED_S } from "../lib/register/index.js";
import { type Engine, probeEngine } from "../lib/run/index.js";
import { BASE_IMAGE_NAME, BASE_TAG_PREFIX, SMALL_IMAGE } from "./constants.js";

declare module "vitest" {
  export interface ProvidedContext {
    readonly engine: Engine;
    /** The base image as built for this suite, by its ID rather than its tag. */
    readonly baseImage: string;
  }
}

/**
 * The integration project's global setup: probes the engine, builds the
 * base image from this repository's own definition under a tag of this
 * process's own, pulls the small image by digest, and hands the engine and
 * the built image to every integration file. Answers the teardown that
 * removes what the setup itself put in the store — the tag it minted, and
 * the small image only when the setup pulled it — so the suite leaves the
 * image store as it found it, at the price of a rebuild on the next run.
 *
 * The image is handed on by its ID, not its tag: a tag is a name in a store
 * every process on the machine shares, which a second suite would repoint
 * and remove from under this one, and the ID names this build alone. Runs
 * in the runner's main process, where coverage collects nothing, which is
 * why it has a unit test of its own with a fake project and a fake spawn.
 *
 * @note Impure — spawns the engine to probe, build, pull and remove.
 */
export default async function prepareEngine(
  project: TestProject,
  spawn: Spawn = spawnProcess,
): Promise<() => Promise<void>> {
  const engine = await probeEngine(spawn);
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const tag = `${BASE_TAG_PREFIX}-${process.pid}`;
  const built = await buildImage(engine, root, BASE_IMAGE_NAME, tag, spawn);
  const small = await resolveImage(engine, SMALL_IMAGE, spawn);
  project.provide("engine", engine);
  project.provide("baseImage", built.id);
  return async () => {
    const pulled = small.reference === SMALL_IMAGE ? [SMALL_IMAGE] : [];
    await spawn(engine.binary, ["rmi", "--ignore", tag, ...pulled], {
      deadlineMs: UNMEASURED_S * 1000,
    });
  };
}
