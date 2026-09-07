import { describe, expect, it } from "vitest";

import {
  MACHINE_CLASS,
  REGISTER_ONE_IMAGE,
  renderRegister,
  renderRow,
} from "../../_testing/fixtures.js";
import { Refusal } from "../contract/index.js";
import { rewriteRunBudget } from "./index.js";

/** The line indices at which two texts differ. */
const findChangedLines = (before: string, after: string) => {
  const left = before.split("\n");
  const right = after.split("\n");
  expect(right.length).toBe(left.length);
  return left.flatMap((line, index) =>
    line === right.at(index) ? [] : [index],
  );
};

const measured = { class: MACHINE_CLASS, p95: 20 };

describe("rewriteRunBudget", () => {
  it("replaces exactly the run_s line of the named row and keeps every other byte", () => {
    const after = rewriteRunBudget(
      REGISTER_ONE_IMAGE,
      "corpus-image",
      measured,
    );
    const changed = findChangedLines(REGISTER_ONE_IMAGE, after);
    expect(changed).toHaveLength(1);
    const index = changed.at(0) ?? -1;
    const lines = after.split("\n");
    expect(lines.at(index)).toBe(
      `run_s = { class = "${MACHINE_CLASS}", p95 = 20, budget = 30 }`,
    );
    expect(lines.slice(0, index).join("\n")).toContain("[corpus-image]");
    expect(lines.slice(0, index).join("\n")).not.toContain(
      "[corpus-toolchain]",
    );
  });

  it("keeps the key's spacing, rounds the p95 to a tenth and keeps a carriage return", () => {
    const text = renderRegister([
      renderRow("a"),
      renderRow("b", { run_s: null }),
    ])
      .replace("run_s =", "run_s    =")
      .replaceAll("\n", "\r\n");
    const after = rewriteRunBudget(text, "a", { class: "ci", p95: 7.96 });
    expect(after).toContain(
      `run_s    = { class = "ci", p95 = 8, budget = 12 }\r\n`,
    );
    expect(findChangedLines(text, after)).toHaveLength(1);
  });

  it("keeps a comment that follows the table on the run_s line", () => {
    const text = renderRegister([
      renderRow("a", {
        run_s: `{ class = "ci", p95 = 1, budget = 10 } # measured on a quiet machine`,
      }),
    ]);
    const after = rewriteRunBudget(text, "a", measured);
    expect(after).toContain(
      `run_s = { class = "${MACHINE_CLASS}", p95 = 20, budget = 30 } # measured on a quiet machine\n`,
    );
    expect(findChangedLines(text, after)).toHaveLength(1);
  });

  it("replaces a table whose class carries a brace, and again on its own output", () => {
    // A brace inside the quoted class is inside the table, not its end; a
    // rebudget that stopped there would leave half a table behind it and
    // the next one would corrupt the line.
    const once = rewriteRunBudget(REGISTER_ONE_IMAGE, "corpus-image", {
      class: "a}b",
      p95: 2,
    });
    const twice = rewriteRunBudget(once, "corpus-image", {
      class: "a}b",
      p95: 3,
    });
    expect(findChangedLines(REGISTER_ONE_IMAGE, once)).toHaveLength(1);
    expect(findChangedLines(once, twice)).toHaveLength(1);
    expect(twice).toContain(
      `run_s = { class = "a}b", p95 = 3, budget = 10 }\n`,
    );
  });

  it("refuses an id no table carries, without matching a table by pattern", () => {
    const text = renderRegister([renderRow("axb")]);
    expect(() => rewriteRunBudget(text, "a.b", measured)).toThrow(Refusal);
    expect(() => rewriteRunBudget(text, "a.b", measured)).toThrow(
      "no table [a.b] in the register",
    );
  });

  it("refuses a row without a run_s line, and does not borrow the next table's", () => {
    const text = renderRegister([
      renderRow("a", { run_s: null }),
      renderRow("b"),
    ]);
    expect(() => rewriteRunBudget(text, "a", measured)).toThrow(Refusal);
    expect(() => rewriteRunBudget(text, "a", measured)).toThrow(
      "table [a] has no run_s line",
    );
  });

  it("refuses a run_s that is not an inline table rather than replacing it blind", () => {
    const text = renderRegister([renderRow("a", { run_s: "10" })]);
    expect(() => rewriteRunBudget(text, "a", measured)).toThrow(Refusal);
    expect(() => rewriteRunBudget(text, "a", measured)).toThrow(
      "table [a] writes run_s as something other than an inline table",
    );
  });

  it("refuses a p95 that is not a measurement before touching the text", () => {
    expect(() =>
      rewriteRunBudget(REGISTER_ONE_IMAGE, "corpus-image", {
        class: MACHINE_CLASS,
        p95: Number.NaN,
      }),
    ).toThrow(Refusal);
  });

  it.each([
    0, 0.04,
  ])("refuses a p95 of %s, which rounds to a measurement the register declines", (p95) => {
    expect(() =>
      rewriteRunBudget(REGISTER_ONE_IMAGE, "corpus-image", {
        class: MACHINE_CLASS,
        p95,
      }),
    ).toThrow(`a p95 of ${p95} rounds to nothing`);
  });

  it.each([
    "",
    `dev "quiet"`,
    "dev\\linux",
    "dev\nlinux",
  ])("refuses a class of %j that a TOML string cannot carry", (klass) => {
    expect(() =>
      rewriteRunBudget(REGISTER_ONE_IMAGE, "corpus-image", {
        class: klass,
        p95: 1,
      }),
    ).toThrow("cannot be written into the register");
  });
});
