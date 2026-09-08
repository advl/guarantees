import type { Spawn, Spawned, SpawnOptions } from "../lib/process/index.js";

/** One call a fake spawn received. */
export type SpawnCall = {
  readonly binary: string;
  readonly args: readonly string[];
  readonly options: SpawnOptions;
};

/** What a fake spawn answers to one call. */
export type SpawnAnswer = (call: SpawnCall) => Spawned | Promise<Spawned>;

/**
 * A spawn that records every call and answers as scripted, so a test of an
 * engine-calling module asserts the argv it produced and drives it down a
 * path a healthy engine cannot be made to take. The engine is the one
 * boundary a unit test replaces; the filesystem is real, under a temp
 * directory.
 */
export default function fakeSpawn(
  answer: SpawnAnswer = () => ({ code: 0, out: "", killed: false }),
): {
  readonly spawn: Spawn;
  readonly calls: SpawnCall[];
} {
  const calls: SpawnCall[] = [];
  const spawn: Spawn = async (binary, args, options) => {
    const call = { binary, args, options };
    calls.push(call);
    return answer(call);
  };
  return { spawn, calls };
}
