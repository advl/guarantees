import { describe, expect, it } from "vitest";

import findRow from "../../_testing/findRow.js";
import { PIPELINE, REGISTER_ONE_IMAGE } from "../../_testing/fixtures.js";
import { parseRegister } from "../register/index.js";
import { RUNNER_BIN, renderEntryCommand } from "./index.js";

const rows = parseRegister(REGISTER_ONE_IMAGE, PIPELINE);
const row = findRow(rows, "corpus-bijection");

/** The pattern the runner is handed for a row whose selector is `select`. */
const patternFor = (select: string) => {
  const argv = renderEntryCommand({ ...row, select }, "/tmp/report.json");
  return new RegExp(argv[argv.indexOf("-t") + 1] ?? "");
};

describe("renderEntryCommand", () => {
  it("runs the image's own binary, never one the workspace carries", () => {
    expect(renderEntryCommand(row, "/tmp/report.json").at(0)).toBe(RUNNER_BIN);
  });

  it("passes the row's file and selects by the row's selector", () => {
    const argv = renderEntryCommand(row, "/tmp/report.json");
    expect(argv.slice(1, 4)).toEqual(["run", "corpus-bijection.test.ts", "-t"]);
    expect(patternFor("corpus-bijection").test("corpus-bijection holds")).toBe(
      true,
    );
  });

  it("selects every test whose full title begins with the selector as whole words, and none whose title merely begins with its letters", () => {
    const suite = patternFor("corpus-bijection");
    expect(suite.test("corpus-bijection every row")).toBe(true);
    expect(suite.test("corpus-bijection-extended every row")).toBe(false);
    const exact = patternFor("corpus-bijection every row");
    expect(exact.test("corpus-bijection every row")).toBe(true);
    expect(exact.test("other corpus-bijection every row")).toBe(false);
  });

  it("selects by the selector's characters, regex characters included, and never by what they would mean", () => {
    const bracketed = patternFor("corpus-bijection (every row)");
    expect(bracketed.test("corpus-bijection (every row)")).toBe(true);
    expect(bracketed.test("corpus-bijection every row")).toBe(false);
    const dotted = patternFor("a.b");
    expect(dotted.test("a.b")).toBe(true);
    expect(dotted.test("axb")).toBe(false);
  });

  it("writes the JSON report where it is told and keeps the default reporter beside it", () => {
    const argv = renderEntryCommand(
      row,
      "/workspace/guarantees/.work/x/r.json",
    );
    expect(argv).toContain("--reporter=default");
    expect(argv).toContain("--reporter=json");
    expect(argv.at(-1)).toBe(
      "--outputFile.json=/workspace/guarantees/.work/x/r.json",
    );
  });
});
