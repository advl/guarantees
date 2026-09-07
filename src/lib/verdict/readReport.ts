import { Refusal, reportSchema } from "../contract/index.js";
import type { Summary } from "./types.js";

const STATUSES: readonly string[] =
  reportSchema.properties.testResults.items.properties.assertionResults.items
    .properties.status.enum;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readCount = (report: Record<string, unknown>, key: string): number => {
  const value = report[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Refusal(`\`${key}\` is missing or not a whole number of tests`);
  }
  return value;
};

const requireString = (
  assertion: Record<string, unknown>,
  key: string,
  at: string,
): string => {
  const value = assertion[key];
  if (typeof value !== "string") {
    throw new Refusal(`${at}: \`${key}\` is missing or not a string`);
  }
  return value;
};

/**
 * Reads the runner's JSON report into the numbers a verdict is judged by,
 * or refuses it.
 *
 * The report is the runner's own: three counts and, per file, a list of
 * assertions with a title, a full name and a status. The runner writes more
 * and none of it is refused; what it must write is checked without
 * tolerance, and a report whose passed or failed count disagrees with the
 * assertions of that status it lists is refused too, because a report that
 * disagrees with itself is not a verdict, whichever half of it one would
 * prefer to believe — and a passed count left unchecked against the
 * statuses would let a run in which everything was skipped read as green.
 *
 * @throws Refusal naming the first fault found.
 */
export default function readReport(text: string): Summary {
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch (error) {
    throw new Refusal(`the report does not parse: ${String(error)}`);
  }
  if (!isRecord(document)) {
    throw new Refusal("the report is not an object");
  }

  const total = readCount(document, "numTotalTests");
  const passed = readCount(document, "numPassedTests");
  const failed = readCount(document, "numFailedTests");

  const results = document.testResults;
  if (!Array.isArray(results)) {
    throw new Refusal("`testResults` is missing or not a list");
  }

  const failedTitles: string[] = [];
  let passedListed = 0;
  for (const [fileIndex, result] of results.entries()) {
    const file = `testResults[${fileIndex}]`;
    if (!isRecord(result)) {
      throw new Refusal(`${file} is not an object`);
    }
    const assertions = result.assertionResults;
    if (!Array.isArray(assertions)) {
      throw new Refusal(
        `${file}: \`assertionResults\` is missing or not a list`,
      );
    }
    for (const [index, assertion] of assertions.entries()) {
      const at = `${file}.assertionResults[${index}]`;
      if (!isRecord(assertion)) {
        throw new Refusal(`${at} is not an object`);
      }
      requireString(assertion, "title", at);
      const fullName = requireString(assertion, "fullName", at);
      const status = assertion.status;
      if (typeof status !== "string" || !STATUSES.includes(status)) {
        throw new Refusal(
          `${at}: \`status\` ${JSON.stringify(status)} is not one of ${STATUSES.join(" | ")}`,
        );
      }
      if (status === "failed") failedTitles.push(fullName);
      if (status === "passed") passedListed += 1;
    }
  }

  if (passedListed !== passed) {
    throw new Refusal(
      `the report counts ${passed} passed and lists ${passedListed} passed assertions — a report that disagrees with itself is not a verdict`,
    );
  }
  if (failedTitles.length !== failed) {
    throw new Refusal(
      `the report counts ${failed} failed and lists ${failedTitles.length} failed assertions — a report that disagrees with itself is not a verdict`,
    );
  }

  return { total, passed, failed, failedTitles };
}
