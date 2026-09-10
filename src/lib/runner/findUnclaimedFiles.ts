import type { Register } from "../register/index.js";

/**
 * The files the runner would collect that no row claims, sorted.
 *
 * A test file with no row runs in no tier and is nobody's gate, and it
 * fails silently: every suite is green either way. The comparison is
 * against what the runner says it would collect rather than against a
 * second walk of the tree, because a walk with its own idea of what is
 * excluded is a claim about a corpus the runner is not running.
 *
 * @package
 */
export default function findUnclaimedFiles(
  collected: readonly string[],
  register: Register,
): readonly string[] {
  const claimed = new Set([...register.values()].map((row) => row.file));
  return [...collected].filter((file) => !claimed.has(file)).sort();
}
