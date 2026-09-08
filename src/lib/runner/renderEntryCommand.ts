import type { Row } from "../register/index.js";
import { RUNNER_BIN } from "./constants.js";

/**
 * The command that runs one entry inside the image: the runner's binary from
 * the image's toolchain, the row's file, the row's selector, and the JSON
 * report written to `reportPath`. The default reporter stays beside the JSON
 * one so that a failing entry reads like a failing test in the log; the
 * verdict is read from the report, never from the log.
 *
 * The runner's filter takes only a pattern, so the selector reaches it as
 * one built from the row's `select` rather than being it: every
 * regular-expression character escaped, anchored to the start of the full
 * test title — suite titles and test title joined by single spaces — and to
 * a word boundary after it. Passed through as written, `corpus-bijection
 * (every row)` would run a test named `corpus-bijection every row` and judge
 * an assertion the register never named, and unanchored `corpus-bijection`
 * would also run `corpus-bijection-extended`. What the row writes is what
 * the runner selects: every test whose full title begins with it as whole
 * words, which for a suite's title is every test beneath it.
 *
 * @package
 */
export default function renderEntryCommand(
  row: Row,
  reportPath: string,
): readonly string[] {
  const escaped = row.select.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [
    RUNNER_BIN,
    "run",
    row.file,
    "-t",
    `^${escaped}(?: |$)`,
    "--reporter=default",
    "--reporter=json",
    `--outputFile.json=${reportPath}`,
  ];
}
