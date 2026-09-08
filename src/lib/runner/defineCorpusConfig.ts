import type { ViteUserConfig } from "vitest/config";
import { COLLECTS, WORK_DIR } from "./constants.js";

/**
 * The runner's configuration for a corpus, as the entry module `./vitest`
 * hands it to a corpus's own `vitest.config.ts`.
 *
 * The runner collects every file carrying the suffix the register holds a
 * row's file to, and skips `node_modules`, the work directory and
 * `fixtures` at any depth. Each exclusion is shaped `**\/<dir>/**` because
 * the bijection's scan skips a directory by its name wherever its walk
 * meets one; anchored at the corpus root, the runner would keep collecting
 * a nested `fixtures/` the scan steps over, and the two lists would
 * disagree in the direction that hides an entry. Files run one at a time:
 * entries are scheduled by the package, one container per row, and a second
 * scheduler inside the runner would put two measured windows in one
 * container. Coverage is off: a number over a corpus describes the corpus's
 * own control flow and nothing about what its entries pin. An override's
 * `test` key replaces the base's key of the same name whole, and a top-level
 * key beside `test` is carried as given; a list merged by concatenation
 * could widen `include` and never narrow it.
 */
export default function defineCorpusConfig(
  overrides: ViteUserConfig = {},
): ViteUserConfig {
  return {
    ...overrides,
    test: {
      include: [`**/*${COLLECTS}`],
      exclude: ["**/node_modules/**", `**/${WORK_DIR}/**`, "**/fixtures/**"],
      fileParallelism: false,
      coverage: { enabled: false },
      ...overrides.test,
    },
  };
}
