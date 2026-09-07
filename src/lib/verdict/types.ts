/**
 * What the runner reported it did. The exit code says only that the process
 * ended a certain way; these numbers say whether any assertion ran, which is
 * the difference between a verdict and a coincidence.
 */
export type Summary = {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  /** The full name of every failed assertion, in report order. */
  readonly failedTitles: readonly string[];
};

/** A judgement and the sentence that explains it. */
export type Verdict = {
  readonly ok: boolean;
  readonly reason: string;
};
