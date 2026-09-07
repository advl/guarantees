import { describe, expect, it } from "vitest";

import findRow from "../../_testing/findRow.js";
import {
  PIPELINE,
  REGISTER_ONE_IMAGE,
  REPORT_EMPTY,
  REPORT_GREEN,
  REPORT_RED,
  REPORT_SKIPPED,
  renderReport,
} from "../../_testing/fixtures.js";
import { Refusal } from "../contract/index.js";
import { parseRegister } from "../register/index.js";
import { judgeRun, readReport, type Summary } from "./index.js";

const rows = parseRegister(REGISTER_ONE_IMAGE, PIPELINE);
const passing = findRow(rows, "corpus-bijection");
const sentinel = findRow(rows, "corpus-can-fail");

const green = readReport(renderReport(REPORT_GREEN));
const red = readReport(renderReport(REPORT_RED));
const empty = readReport(renderReport(REPORT_EMPTY));
const skipped = readReport(renderReport(REPORT_SKIPPED));

const STARTED_AT = 1_000;

/** A summary beside the time its report was written, after the run started unless said otherwise. */
const dated = (summary: Summary, writtenAt = STARTED_AT + 1_000) => ({
  summary,
  writtenAt,
});

/** Each row beside the summary that would pass it, so only the report's date can refuse it. */
const satisfied = [
  [passing, green],
  [sentinel, red],
] as const;

describe("judgeRun", () => {
  it("passes a row expecting to pass when nothing failed", () => {
    expect(judgeRun(passing, dated(green), STARTED_AT)).toEqual({
      ok: true,
      reason: "corpus-bijection: 2 passed, 0 failed, expected to pass",
    });
  });

  it("fails a row expecting to pass when an assertion failed, naming it", () => {
    const verdict = judgeRun(passing, dated(red), STARTED_AT);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe(
      "corpus-bijection: 1 passed, 1 failed, expected to pass — corpus-can-fail asserts a falsehood",
    );
  });

  it("passes the row designed to fail when an assertion failed", () => {
    expect(judgeRun(sentinel, dated(red), STARTED_AT)).toEqual({
      ok: true,
      reason: "corpus-can-fail: 1 passed, 1 failed, expected to fail",
    });
  });

  it("fails the row designed to fail when nothing failed, naming the lost proof", () => {
    const verdict = judgeRun(sentinel, dated(green), STARTED_AT);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain(
      "the corpus can no longer show that it is able to report a failure",
    );
  });

  it("refuses to judge a run that left no report, whatever the row expects", () => {
    for (const [row] of satisfied) {
      const judge = () => judgeRun(row, null, STARTED_AT);
      expect(judge).toThrow(Refusal);
      expect(judge).toThrow(`${row.id} left no report of its own`);
    }
  });

  it("refuses to judge a run whose report is older than the run, whatever the row expects", () => {
    for (const [row, summary] of satisfied) {
      const judge = () =>
        judgeRun(row, dated(summary, STARTED_AT - 1), STARTED_AT);
      expect(judge).toThrow(Refusal);
      expect(judge).toThrow(`${row.id} left a report older than this run`);
    }
  });

  it("accepts a report written at the instant the run started", () => {
    expect(judgeRun(passing, dated(green, STARTED_AT), STARTED_AT).ok).toBe(
      true,
    );
  });

  it("refuses to judge a run in which nothing was collected, whatever the row expects", () => {
    for (const row of [passing, sentinel]) {
      const judge = () => judgeRun(row, dated(empty), STARTED_AT);
      expect(judge).toThrow(Refusal);
      expect(judge).toThrow(
        `\`select = "${row.select}"\` matched nothing that ran in ${row.file} (0 collected, none executed)`,
      );
    }
  });

  it("refuses to judge a run in which every assertion was skipped, whatever the row expects", () => {
    // The skipped report's counts agree with its statuses — readReport
    // refuses one whose passed count disagrees with the passed assertions
    // it lists — so what is refused here is a report in which nothing
    // passed and nothing failed, and not a count somebody could edit.
    for (const row of [passing, sentinel]) {
      const judge = () => judgeRun(row, dated(skipped), STARTED_AT);
      expect(judge).toThrow(Refusal);
      expect(judge).toThrow("(2 collected, none executed)");
    }
  });
});
