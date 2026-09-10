import { beforeAll, describe } from "vitest";

import { UNCLAIMED_TITLE } from "../contract/index.js";
import type { Register } from "../register/index.js";
import {
  findUnclaimedFiles,
  findUncollectedRows,
  listCollected,
} from "../runner/index.js";
import _requireNothingFound from "./_requireNothingFound.js";
import { _UNCOLLECTED_TITLE } from "./constants.js";

/**
 * The corpus's account of itself, in both directions: every file the runner
 * would collect has exactly one row, and every row resolves to a file the
 * runner would collect.
 *
 * It is the one assertion in a corpus with nothing above it. A test file
 * with no row runs in no tier and is nobody's gate; a row whose file the
 * runner never reaches is a promise the register goes on making. Both fail
 * silently — every suite is green either way — so the correspondence is
 * asserted rather than assumed.
 *
 * The runner is asked rather than the tree walked. A second walk carries
 * its own idea of what is excluded, and the day the two ideas differ the
 * disagreement runs in the direction that hides an entry: a directory the
 * walk skips and the runner collects from holds a file that runs in the
 * tier, belongs to no row, and is nobody's gate. Asking costs a second
 * runner start inside the measured window, which is what the row's budget
 * has to cover.
 *
 * Both directions can be vacuous — two empty lists compare equal — so each
 * asserts what it was given to look at, under a title of its own, and a tier
 * holding this row proves the first direction besides, by installing a file
 * no row claims and requiring that direction's own title, and not its
 * vacuity guard's, among the failed.
 *
 * @note Impure — asks the corpus's own runner what it would collect, which
 * is a runner started inside the entry's measured window.
 */
export default function describeBijection(options: {
  /** The row's id, which its selector matches, so the suite this opens is the one the runner is asked for. */
  readonly id: string;
  /** The corpus, whose own runner is asked what it would collect. */
  readonly corpusRoot: string;
  /** The register as the corpus parsed it, rows keyed by id. */
  readonly register: Register;
}): void {
  describe(options.id, () => {
    let collected: readonly string[] = [];
    beforeAll(async () => {
      collected = await listCollected(options.corpusRoot);
    });

    _requireNothingFound({
      title: UNCLAIMED_TITLE,
      looked: () => collected.length,
      lookedAt: "files this corpus's own runner says it would collect",
      found: () => findUnclaimedFiles(collected, options.register),
      meaning:
        "files the runner would collect and the register has never heard of — each runs in the tier, belongs to no row and is nobody's gate",
    });

    _requireNothingFound({
      title: _UNCOLLECTED_TITLE,
      looked: () => options.register.size,
      lookedAt: "rows this looked for a collected file under",
      found: () => findUncollectedRows(collected, options.register),
      meaning:
        "rows naming a file this corpus's runner would not collect — a selector that will match nothing, in a tier reporting green for the rows around it",
    });
  });
}
