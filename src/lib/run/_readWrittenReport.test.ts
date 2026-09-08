import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { REPORT_GREEN, renderReport } from "../../_testing/fixtures.js";
import { Refusal } from "../contract/index.js";
import { REPORT_FILE } from "../runner/index.js";
import { readReport } from "../verdict/index.js";
import _readWrittenReport from "./_readWrittenReport.js";

const scratch: string[] = [];
const fresh = () => {
  const directory = mkdtempSync(join(tmpdir(), "written-report-"));
  scratch.push(directory);
  return directory;
};

afterEach(() => {
  for (const directory of scratch.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("_readWrittenReport", () => {
  it("answers null when the run left no report", () => {
    expect(_readWrittenReport(fresh())).toBeNull();
  });

  it("reads a report beside the time it was written", () => {
    const workDir = fresh();
    const path = join(workDir, REPORT_FILE);
    writeFileSync(path, renderReport(REPORT_GREEN));
    expect(_readWrittenReport(workDir)).toEqual({
      summary: readReport(renderReport(REPORT_GREEN)),
      writtenAt: statSync(path).mtimeMs,
    });
  });

  it("refuses a report that is there and cannot be read, rather than calling it absent", () => {
    const workDir = fresh();
    writeFileSync(join(workDir, REPORT_FILE), "{ not a report");
    expect(() => _readWrittenReport(workDir)).toThrow(Refusal);
    expect(() => _readWrittenReport(workDir)).toThrow("does not parse");
  });
});
