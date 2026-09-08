import { Refusal } from "../contract/index.js";
import { type Spawn, spawnProcess } from "../process/index.js";
import _listLabelled from "./_listLabelled.js";
import _removeContainer from "./_removeContainer.js";
import { CORPUS_LABEL } from "./constants.js";
import hashCheckout from "./hashCheckout.js";
import type { Engine } from "./types.js";

/**
 * Removes every container an earlier run of this checkout left behind,
 * before this run starts anything, and answers their names so the caller
 * prints what was reaped and a reap is never silent.
 *
 * Teardown covers every path a run controls; an interrupt is not one of
 * them, and what it leaves is a container still executing an entry —
 * holding its mounts, writing for as long as it lives — that nothing later
 * notices, since a live container writes fresh files and the report's
 * freshness check cannot see it. The filter is the checkout label of the
 * repository root, hashed here from the same root a run hashes it from, so
 * a caller cannot hand in a label that matches nothing its runs wrote, and
 * a second checkout of the same repository is never touched. This run's own
 * containers carry the same label, which is why the reap is the caller's
 * first engine call and never runs mid-tier. An engine that will not say
 * what is running is not a clean machine, and nothing of this run has
 * started, so refusing here skips no teardown and abandons no container.
 *
 * @note Impure — spawns the engine to list and remove containers.
 * @throws Refusal when the root is not absolute, the engine does not answer
 * a listing, or a container survives its removal.
 */
export default async function reapStale(
  engine: Engine,
  repositoryRoot: string,
  spawn: Spawn = spawnProcess,
): Promise<readonly string[]> {
  const filter = { [CORPUS_LABEL]: hashCheckout(repositoryRoot) };
  const stale = await _listLabelled(engine, spawn, filter);
  if (!stale.answered) {
    throw new Refusal(
      `the engine did not say whether an earlier run of this checkout left a container running — one that is still running holds the repository mounted and goes on writing, and nothing measured while the engine cannot be asked means anything`,
    );
  }
  if (stale.names.length === 0) return [];
  for (const name of stale.names) await _removeContainer(engine, spawn, name);
  const left = await _listLabelled(engine, spawn, filter);
  if (!left.answered) {
    throw new Refusal(
      `the engine did not answer after removing ${stale.names.join(", ")}, so whether the removal worked is unknown — a removal nobody could verify is not one to measure on top of`,
    );
  }
  if (left.names.length > 0) {
    throw new Refusal(
      `${left.names.join(", ")} could not be removed — still holding the repository mounted, so nothing measured while they run is trustworthy; remove them and try again`,
    );
  }
  return stale.names;
}
