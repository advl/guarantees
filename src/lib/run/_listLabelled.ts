import type { Spawn } from "../process/index.js";
import _callEngine from "./_callEngine.js";
import type { Engine } from "./types.js";

/**
 * Every container carrying all of the given labels, whichever process
 * started it — and separately, whether the engine answered at all. A
 * listing that fails or is killed at its deadline prints nothing, and
 * nothing is exactly what a clean machine prints, so the list alone cannot
 * tell "no containers" from "no answer"; both callers act on emptiness, and
 * an engine that has stopped answering is the one case where reading its
 * silence as evidence would let a container go on holding the repository
 * mounted while the tier keeps measuring. Names are answered only when the
 * engine did.
 *
 * @note Impure — spawns the engine.
 */
export default async function _listLabelled(
  engine: Engine,
  spawn: Spawn,
  labels: Readonly<Record<string, string>>,
): Promise<{ readonly answered: boolean; readonly names: readonly string[] }> {
  const listed = await _callEngine(
    engine,
    spawn,
    [
      "ps",
      "--all",
      ...Object.entries(labels).flatMap(([key, value]) => [
        "--filter",
        `label=${key}=${value}`,
      ]),
      "--format",
      "{{.Names}}",
    ],
    { capture: true },
  );
  const answered = listed.code === 0 && !listed.killed;
  return {
    answered,
    names: answered && listed.out !== "" ? listed.out.split("\n") : [],
  };
}
