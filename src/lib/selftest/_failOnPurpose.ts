import { expect } from "vitest";

/** What the sentinel reports about a corpus that has not been seen to fail. */
const REPORTED = "the corpus does not report failure";

/**
 * The sentinel's whole content: one comparison that cannot hold.
 *
 * It fails as a counted assertion rather than by throwing at import,
 * because what the scheduler needs is a failure in the runner's report. A
 * missing binary, a file that will not load and a selector matching nothing
 * all end a run without an assertion having executed, and none of them may
 * stand in for the fact this exists to demonstrate.
 *
 * It is a function of its own so that it can be watched throwing without a
 * suite going red around it: called directly it throws, and registered as a
 * test body it is the failure the corpus is required to report.
 *
 * @throws AssertionError, always.
 */
export default function _failOnPurpose(): void {
  expect(REPORTED).toBe("the corpus reports failure");
}
