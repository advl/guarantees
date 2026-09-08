import type { Spawn, Spawned } from "../process/index.js";
import { UNMEASURED_S } from "../register/index.js";
import type { Engine } from "./types.js";

/**
 * Removes a container by name, immediately and idempotently: no grace
 * period, and one that is already gone is a success. This is the hard kill
 * — a running container is stopped by its removal, never by a signal to the
 * client that started it.
 *
 * @note Impure — spawns the engine.
 */
export default function _removeContainer(
  engine: Engine,
  spawn: Spawn,
  name: string,
): Promise<Spawned> {
  return spawn(
    engine.binary,
    ["rm", "--force", "--time", "0", "--ignore", name],
    { deadlineMs: UNMEASURED_S * 1000 },
  );
}
