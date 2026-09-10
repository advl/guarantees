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

/** Whether a process id names nothing on this machine any more. */
const _gone = (pid: number) => {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ESRCH";
  }
};

/**
 * Removes the tags earlier runs of this suite minted and never gave back.
 *
 * The teardown below runs on a suite that ends; a run killed at the
 * keyboard, or a setup that throws after the build has tagged, leaves the
 * tag standing, and a stale tag pins the image it names for good — so the
 * next teardown untags rather than removing, the layer cache is never
 * evicted, and the store keeps a copy of every definition since. This is the
 * image counterpart of the container reap every integration file opens with.
 *
 * Only a tag whose process is gone is removed. The suffix is a process id
 * exactly so that two suites on one engine never build and remove one name,
 * and reaching for a sibling's live tag — which may be the only name its
 * image has — would remove the image from under it mid-run.
 */
const _reapTags = async (engine: Engine, spawn: Spawn) => {
  const listed = await spawn(
    engine.binary,
    ["images", "--format", "{{.Repository}}:{{.Tag}}"],
    { deadlineMs: UNMEASURED_S * 1000, capture: true },
  );
  if (listed.code !== 0 || listed.killed) return;
  const stale = listed.out
    .split("\n")
    .map((line) => line.trim())
    .filter((tag) => tag.startsWith(`${BASE_TAG_PREFIX}-`))
    .filter((tag) =>
      _gone(Number(tag.slice(BASE_TAG_PREFIX.length + 1).split("-")[0])),
    );
  if (stale.length === 0) return;
  await spawn(engine.binary, ["rmi", "--ignore", ...stale], {
    deadlineMs: UNMEASURED_S * 1000,
  });
};

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
 * why it has a unit test of its own with a fake project and a fake spawn. It
 * reaps the tags of runs that ended without giving theirs back before it
 * builds, so the leak closes itself rather than waiting on a teardown an
 * interrupted run never reached.
 *
 * @note Impure — spawns the engine to probe, build, pull and remove.
 */
export default async function prepareEngine(
  project: TestProject,
  spawn: Spawn = spawnProcess,
): Promise<() => Promise<void>> {
  const engine = await probeEngine(spawn);
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  await _reapTags(engine, spawn);
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
