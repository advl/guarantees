import { availableParallelism } from "node:os";

/**
 * Runs a tier's pool at a width, in slices, and answers what every row
 * answered in the order the rows were given.
 *
 * The width is a scheduling decision and lives here beside the partition it
 * completes, rather than in the executable that prints the results: what a
 * pool costs in wall-clock is decided by how wide it runs, and the wall is
 * judged over the schedule that width produced. A caller may name one, which
 * is what lets the batching be asserted without the assertion depending on
 * the machine it runs on.
 *
 * Every row of a slice is settled before the slice is left. A slice that
 * raced to the first rejection would drop the answers beside it — and every
 * one of those rows has torn its own entry down and has something to report
 * — so a rejection is held until the slice has drained and then raised.
 *
 * @note Impure only through `run`: this starts nothing itself.
 * @throws whatever `run` rejected with, after the slice holding it has
 * drained.
 *
 * @package
 */
export default async function runPool<Row, Answer>(
  rows: readonly Row[],
  run: (row: Row) => Promise<Answer>,
  width: number = availableParallelism(),
): Promise<Answer[]> {
  const answers: Answer[] = [];
  for (let at = 0; at < rows.length; at += width) {
    const settled = await Promise.allSettled(
      rows.slice(at, at + width).map(run),
    );
    const rejected = settled.find((one) => one.status === "rejected");
    if (rejected !== undefined) {
      const { reason } = rejected;
      throw reason instanceof Error ? reason : new Error(String(reason));
    }
    answers.push(
      ...(settled as PromiseFulfilledResult<Answer>[]).map((one) => one.value),
    );
  }
  return answers;
}
