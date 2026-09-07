/**
 * A measurement rounded to a tenth of a second. It is written once and read
 * by both the budget arithmetic and the rebudget, so the p95 written
 * into a row is the number its budget was derived from: two copies of the
 * rounding that drifted apart would be the one way to write a pair the
 * register then declines.
 */
export default function _roundToTenth(seconds: number): number {
  return Math.round(seconds * 10) / 10;
}
