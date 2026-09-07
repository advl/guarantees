import { describe, expect, it } from "vitest";

import {
  ASSERTION_PASSED,
  FILE_GREEN,
  REPORT_EMPTY,
  REPORT_GREEN,
  REPORT_RED,
  REPORT_SKIPPED,
  REPORT_SKIPPED_COUNTED,
  renderReport,
} from "../../_testing/fixtures.js";
import { Refusal } from "../contract/index.js";
import { readReport } from "./index.js";

/** The green report with its first file replaced. */
const withFile = (replacement: unknown) =>
  renderReport({ ...REPORT_GREEN, testResults: [replacement] });

/** The green report with its first assertion replaced. */
const withAssertion = (replacement: unknown) =>
  withFile({
    ...FILE_GREEN,
    assertionResults: [replacement, ...FILE_GREEN.assertionResults.slice(1)],
  });

describe("readReport", () => {
  it("summarises a green report", () => {
    expect(readReport(renderReport(REPORT_GREEN))).toEqual({
      total: 2,
      passed: 2,
      failed: 0,
      failedTitles: [],
    });
  });

  it("summarises a red report with the full name of every failed assertion", () => {
    expect(readReport(renderReport(REPORT_RED))).toEqual({
      total: 2,
      passed: 1,
      failed: 1,
      failedTitles: ["corpus-can-fail asserts a falsehood"],
    });
  });

  it("summarises a report in which nothing was collected", () => {
    expect(readReport(renderReport(REPORT_EMPTY))).toEqual({
      total: 0,
      passed: 0,
      failed: 0,
      failedTitles: [],
    });
  });

  it("summarises a report in which everything collected was skipped", () => {
    expect(readReport(renderReport(REPORT_SKIPPED))).toEqual({
      total: 2,
      passed: 0,
      failed: 0,
      failedTitles: [],
    });
  });

  it("reads a report with skipped assertions across several files", () => {
    const text = renderReport({
      ...REPORT_GREEN,
      numTotalTests: 3,
      testResults: [
        FILE_GREEN,
        {
          ...FILE_GREEN,
          assertionResults: [{ ...ASSERTION_PASSED, status: "skipped" }],
        },
      ],
    });
    expect(readReport(text).total).toBe(3);
  });

  it.each([
    ["text that is not JSON", "{", "does not parse"],
    ["a JSON value that is not an object", "[]", "is not an object"],
    [
      "a report without a total",
      renderReport({ ...REPORT_GREEN, numTotalTests: undefined }),
      "`numTotalTests` is missing or not a whole number",
    ],
    [
      "a negative passed count",
      renderReport({ ...REPORT_GREEN, numPassedTests: -1 }),
      "`numPassedTests` is missing or not a whole number",
    ],
    [
      "a fractional failed count",
      renderReport({ ...REPORT_GREEN, numFailedTests: 0.5 }),
      "`numFailedTests` is missing or not a whole number",
    ],
    [
      "a report without results",
      renderReport({ ...REPORT_GREEN, testResults: undefined }),
      "`testResults` is missing or not a list",
    ],
    [
      "a file result that is not an object",
      withFile(1),
      "testResults[0] is not an object",
    ],
    [
      "a file result without assertions",
      withFile({ name: "x" }),
      "testResults[0]: `assertionResults` is missing or not a list",
    ],
    [
      "an assertion that is not an object",
      withAssertion("passed"),
      "testResults[0].assertionResults[0] is not an object",
    ],
    [
      "an assertion without a title",
      withAssertion({ ...ASSERTION_PASSED, title: undefined }),
      "`title` is missing or not a string",
    ],
    [
      "an assertion without a full name",
      withAssertion({ ...ASSERTION_PASSED, fullName: undefined }),
      "`fullName` is missing or not a string",
    ],
    [
      "an assertion without a status",
      withAssertion({ ...ASSERTION_PASSED, status: undefined }),
      "`status` undefined is not one of",
    ],
    [
      "an assertion with a status outside the runner's set",
      withAssertion({ ...ASSERTION_PASSED, status: "flaky" }),
      `\`status\` "flaky" is not one of passed | failed | skipped | pending | disabled`,
    ],
    [
      "a failed count that disagrees with the failed list",
      renderReport({ ...REPORT_GREEN, numFailedTests: 1 }),
      "counts 1 failed and lists 0 failed assertions",
    ],
    [
      "a passed count that disagrees with the passed list, over assertions that were all skipped",
      renderReport(REPORT_SKIPPED_COUNTED),
      "counts 2 passed and lists 0 passed assertions",
    ],
  ])("refuses %s", (_, text, reason) => {
    expect(() => readReport(text)).toThrow(Refusal);
    expect(() => readReport(text)).toThrow(reason);
  });
});
