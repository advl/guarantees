import { isAbsolute } from "node:path";
import { describe, expect, it } from "vitest";

import { PIPELINE } from "../../_testing/fixtures.js";
import { COLLECTS, REPORT_FILE, RUNNER_BIN } from "./index.js";

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
});
