import type { Spawn, Spawned } from "../process/index.js";
import { UNMEASURED_S } from "../register/index.js";
import _removeContainer from "./_removeContainer.js";
import type { Engine } from "./types.js";

/**
 * Spawns the engine with a deadline on every call, not only the ones a
 * caller thought to ask for: an engine that stops answering hangs `ps` and
 * `rm` exactly as it hangs `run`, and two of those are called from inside a
 * teardown that has to finish. When a container is named, the deadline is
 * met by removing it — `rm --force` is what stops a run — and never by a
 * signal to the client, which would detach it and leave it running.
 *
 * @note Impure — spawns the engine.
 */
export default function _callEngine(
  engine: Engine,
  spawn: Spawn,
  args: readonly string[],
  options: {
    readonly deadlineS?: number;
    readonly capture?: boolean;
    readonly container?: string;
    readonly cwd?: string;
  } = {},
): Promise<Spawned> {
  const { container } = options;
  return spawn(engine.binary, args, {
    cwd: options.cwd,
    capture: options.capture,
    deadlineMs: (options.deadlineS ?? UNMEASURED_S) * 1000,
    onDeadline:
      container === undefined
        ? undefined
        : async () => {
            await _removeContainer(engine, spawn, container);
          },
  });
}
