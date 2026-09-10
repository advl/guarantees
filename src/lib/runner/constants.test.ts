import { isAbsolute } from "node:path";
import { describe, expect, it } from "vitest";

import { PIPELINE } from "../../_testing/fixtures.js";
import {
  COLLECTS,
  LIFT_DIR,
  REPORT_FILE,
  RUNNER_BIN,
  RUNNER_SCRATCH,
} from "./index.js";

describe("runner constants", () => {
  it("name the runner's binary by an absolute path, where a mount cannot cover it", () => {
    expect(isAbsolute(RUNNER_BIN)).toBe(true);
    expect(RUNNER_BIN.startsWith("/node_modules/")).toBe(true);
  });

  it("collect the suffix the fixture registers are read against, so the register and the runner agree on one", () => {
    expect(COLLECTS).toBe(PIPELINE.collects);
  });

  it("name the report as one file under the entry's work directory", () => {
    expect(REPORT_FILE).toBe("report.json");
  });

  it("name the lift as one directory under the entry's work directory, so what it holds is not taken for the report", () => {
    expect(LIFT_DIR).toBe("lift");
    expect(LIFT_DIR).not.toBe(REPORT_FILE);
  });

  it("name the runner's own scratch as a path under the corpus and never an absolute one, since a run mounts it inside the container", () => {
    expect(RUNNER_SCRATCH.startsWith("/")).toBe(false);
    expect(RUNNER_SCRATCH.split("/").length).toBeGreaterThan(1);
  });
});
