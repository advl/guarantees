import { expect } from "vitest";
import {
  type Pipeline,
  parseRegister,
  type RegisterFault,
  RegisterRefusal,
} from "../lib/register/index.js";
import catchRefusal from "./catchRefusal.js";
import { PIPELINE } from "./fixtures.js";

/** A fault as a test states it: the reason as text or a pattern. */
export type ExpectedFault = Omit<RegisterFault, "reason"> & {
  readonly reason: string | RegExp;
};

/**
 * Asserts that a register text is refused for exactly one fault, and that
 * the fault names the table, the column and the reason the test expects.
 * One fault, not at least one: a fixture built to trip one refusal that
 * trips two is a fixture that no longer proves which guard fired. The
 * one-element list is what pins the count.
 */
export default function expectOneFault(
  text: string,
  expected: ExpectedFault,
  pipeline: Pipeline = PIPELINE,
): void {
  const refusal = catchRefusal(RegisterRefusal, () =>
    parseRegister(text, pipeline),
  );
  expect(refusal.faults).toEqual([
    expect.objectContaining({
      ...expected,
      reason:
        typeof expected.reason === "string"
          ? expect.stringContaining(expected.reason)
          : expect.stringMatching(expected.reason),
    }),
  ]);
}
