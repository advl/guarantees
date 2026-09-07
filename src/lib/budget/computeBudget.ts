import { Refusal, registerSchema } from "../contract/index.js";
import _roundToTenth from "./_roundToTenth.js";

/**
 * The floor and the headroom are the contract's numbers, read from the one
 * place the register schema states them. Below the floor the number
 * measures process startup rather than the guarantee: the hard kill is
 * meant to catch the one-line change that turns ten minutes of CI into
 * sixty, with a margin machine variance cannot reach, and an entry that
 * runs in about a second sits inside the spread between a quiet developer
 * machine and a shared runner starting a container cold, so the formula
 * alone would produce a kill that reports that spread as a regression.
 */
const { floorS, headroom } = registerSchema.$defs.limits.const.budget;

/**
 * The budget, in whole seconds, that a measured p95 sets: the p95 rounded to
 * a tenth, times the headroom, rounded up, and never below the floor.
 *
 * Rounded first and multiplied second, so the pair written into a register
 * answers to itself by the rule a reader can check by hand; deriving from
 * the unrounded reading and recording the rounded one would put two numbers
 * in a row that do not agree. The multiplication and the floor are written
 * here and nowhere else.
 *
 * @throws Refusal when `p95` is not a finite, non-negative number.
 */
export default function computeBudget(p95: number): number {
  if (!Number.isFinite(p95) || p95 < 0) {
    throw new Refusal(
      `a p95 of ${p95} is not a measurement — a budget is derived from a finite number of seconds`,
    );
  }
  return Math.max(floorS, Math.ceil(_roundToTenth(p95) * headroom));
}
