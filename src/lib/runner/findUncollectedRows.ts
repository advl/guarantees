import type { Register } from "../register/index.js";

/**
 * The rows whose file the runner would not collect, each as `id -> file`,
 * in register order.
 *
 * A row whose file the runner never collects is a promise the register goes
 * on making and the runner never keeps — a selector that will match
 * nothing, in a tier that reports green for the rows around it. That the
 * file exists is the parser's refusal; that the runner would reach it is
 * this, and the two are different questions: a file excluded by the
 * runner's own configuration exists and is collected by nobody.
 *
 * @package
 */
export default function findUncollectedRows(
  collected: readonly string[],
  register: Register,
): readonly string[] {
  const reachable = new Set(collected);
  return [...register.values()]
    .filter((row) => !reachable.has(row.file))
    .map((row) => `${row.id} -> ${row.file}`);
}
