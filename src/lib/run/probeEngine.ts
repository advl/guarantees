import { Refusal } from "../contract/index.js";
import { type Spawn, type Spawned, spawnProcess } from "../process/index.js";
import { UNMEASURED_S } from "../register/index.js";
import { ENGINE } from "./constants.js";
import type { Engine } from "./types.js";

const VERSION = /\bversion\s+(\d\S*)/;

/**
 * Probes the engine once, before anything is started, and answers with the
 * binary every later call spawns and the version it reported.
 *
 * A machine without the engine is refused by name, never worked around: a
 * missing engine is the likeliest first-run failure a new contributor has,
 * and it should meet an instruction rather than a stack trace three calls
 * later or a run that quietly measured nothing. Probed once per process by
 * the caller, whose reader is `runEntry` through its context's `engine`.
 *
 * @note Impure — spawns the engine's version query.
 * @throws Refusal when the engine is not on the path, does not answer within
 * the unmeasured deadline, exits non-zero, or prints no version.
 */
export default async function probeEngine(
  spawn: Spawn = spawnProcess,
): Promise<Engine> {
  let ran: Spawned;
  try {
    ran = await spawn(ENGINE, ["--version"], {
      deadlineMs: UNMEASURED_S * 1000,
      capture: true,
    });
  } catch (error) {
    throw new Refusal(
      `no \`${ENGINE}\` on PATH (${String(error)}) — every admissible run is inside a container this engine starts, and nothing stands in for it; install it, or run the corpus where it is present`,
    );
  }
  if (ran.killed) {
    throw new Refusal(
      `\`${ENGINE} --version\` did not return within ${UNMEASURED_S}s — an engine that cannot say its version is not one a run can be measured on`,
    );
  }
  if (ran.code !== 0) {
    throw new Refusal(
      `\`${ENGINE} --version\` exited ${ran.code === null ? "on a signal" : ran.code} — the engine is present and not working, and nothing measured on it means anything`,
    );
  }
  const version = VERSION.exec(ran.out)?.[1];
  if (version === undefined) {
    throw new Refusal(
      `\`${ENGINE} --version\` printed ${JSON.stringify(ran.out)} and no version could be read from it`,
    );
  }
  return { binary: ENGINE, version };
}
