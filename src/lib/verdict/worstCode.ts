import { EXIT_CODES } from "../contract/index.js";
import type { ExitCode } from "./toExitCode.js";

/**
 * The one code that stands for a set of them: refused over red, red over
 * green.
 *
 * A tier ends in as many codes as it has rows, and which of them the process
 * leaves with is a statement about the contract rather than about whichever
 * program ran the tier. The order is written out by name and never taken
 * from the numbers: the codes happen to ascend with severity today, and a
 * caller reducing them with a maximum has encoded that coincidence in a
 * place no reader of the contract would look for it, in a language that has
 * no idea the values mean anything.
 *
 * A refusal wins because it says a verdict was never reached — a run nobody
 * judged is not a run that passed — and red wins over green for the same
 * reason one failing row fails a tier.
 *
 * An empty set is green: nothing was run and nothing declined, which is
 * what a tier holding no rows leaves behind.
 *
 * @package
 */
export default function worstCode(codes: readonly ExitCode[]): ExitCode {
  if (codes.includes(EXIT_CODES.refused)) return EXIT_CODES.refused;
  if (codes.includes(EXIT_CODES.red)) return EXIT_CODES.red;
  return EXIT_CODES.green;
}
