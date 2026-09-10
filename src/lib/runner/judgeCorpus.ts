import type { Register } from "../register/index.js";
import type { Verdict } from "../verdict/index.js";
import findUnclaimedFiles from "./findUnclaimedFiles.js";
import findUncollectedRows from "./findUncollectedRows.js";

/** What the register and the runner say about each other, and what it means. */
export type Corpus = {
  /** The verdict over both directions, printed and reduced to a code by the caller. */
  readonly verdict: Verdict;
  /** Rows the runner would not collect, each as `id -> file`, in register order. */
  readonly uncollected: readonly string[];
  /** Files the runner would collect that no row claims, sorted. */
  readonly unclaimed: readonly string[];
};

/**
 * Judges a register against what the corpus's runner says it would collect,
 * in both directions, and answers the two lists beside the verdict.
 *
 * The verdict is made here rather than by whoever prints it, because it is a
 * judgement: a file no row claims runs in the tier, belongs to no row and is
 * nobody's gate, so counting it into the number a caller prints while
 * judging only the other direction is a green over a discrepancy the caller
 * had already computed. The lists come back with it so that the two finders
 * are asked once and the reader is given the names, not only the count.
 *
 * It is the same question the bijection body asserts from inside a tier, and
 * both read these two finders, so a pre-flight and an entry answer one
 * question the same way rather than drifting into two answers about one
 * corpus.
 *
 * Pure: the caller asks the runner what it would collect.
 *
 * @package
 */
export default function judgeCorpus(
  collected: readonly string[],
  register: Register,
): Corpus {
  const uncollected = findUncollectedRows(collected, register);
  const unclaimed = findUnclaimedFiles(collected, register);
  return {
    verdict: {
      ok: uncollected.length + unclaimed.length === 0,
      reason: `${register.size} rows, ${collected.length} files collected`,
    },
    uncollected,
    unclaimed,
  };
}
