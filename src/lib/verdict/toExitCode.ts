import { EXIT_CODES, Refusal } from "../contract/index.js";
import type { Verdict } from "./types.js";

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

/**
 * The exit code a run's outcome maps to: a verdict to `green` or `red`, a
 * refusal to `refused`. All three live here so the codes are part of the
 * contract and not of whichever program embeds it; a caller hands over what
 * it holds, a verdict or the refusal it caught, and never unpacks either.
 */
export default function toExitCode(outcome: Verdict | Refusal): ExitCode {
  if (outcome instanceof Refusal) return EXIT_CODES.refused;
  return outcome.ok ? EXIT_CODES.green : EXIT_CODES.red;
}
