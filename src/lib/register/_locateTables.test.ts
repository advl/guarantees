import { describe, expect, it } from "vitest";

import catchRefusal from "../../_testing/catchRefusal.js";
import expectOneFault from "../../_testing/expectOneFault.js";
import {
  PIPELINE,
  REGISTER_COMMENTED,
  REGISTER_ONE_IMAGE,
  renderRegister,
  renderRow,
} from "../../_testing/fixtures.js";
import { rewriteRunBudget } from "../budget/index.js";
import { Refusal } from "../contract/index.js";
import { parseRegister, RegisterRefusal } from "./index.js";

const findLine = (text: string, needle: string) =>
  text.split("\n").findIndex((line) => line.includes(needle)) + 1;

describe("parseRegister", () => {
  describe("positions and order", () => {
    it("keeps the written order for ids that look like integers", () => {
      const text = renderRegister([
        renderRow("10"),
        renderRow("2"),
        renderRow("corpus-bijection"),
        renderRow("corpus-can-fail", { expect: `"fail"` }),
      ]);
      expect([...parseRegister(text, PIPELINE).keys()]).toEqual([
        "10",
        "2",
        "corpus-bijection",
        "corpus-can-fail",
      ]);
    });

    it("points a column's fault at the column's line", () => {
      const text = REGISTER_ONE_IMAGE.replace(
        `[corpus-image]\nkind = "conformance"`,
        `[corpus-image]\nkind = 3`,
      );
      expectOneFault(text, {
        table: "corpus-image",
        column: "kind",
        reason: "is not a string",
        line: findLine(text, "kind = 3"),
      });
    });

    it("points a missing column's fault at the table's header", () => {
      const text = renderRegister([
        renderRow("corpus-image", { select: null }),
        renderRow("corpus-bijection"),
        renderRow("corpus-can-fail", { expect: `"fail"` }),
      ]);
      expectOneFault(text, {
        table: "corpus-image",
        column: "select",
        reason: /is missing/,
        line: findLine(text, "[corpus-image]"),
      });
    });

    it("reads padded keys, commented headers and carriage returns, keeping every line number", () => {
      const lines = REGISTER_COMMENTED.split("\n");
      const header = lines.findIndex((line) =>
        line.startsWith("[corpus-image]"),
      );
      const tier = lines.findIndex(
        (line, index) => index > header && line.startsWith("tier"),
      );
      const text = lines
        .with(tier, (lines.at(tier) ?? "").replace(`"pr"`, "3"))
        .join("\r\n");
      expectOneFault(text, {
        table: "corpus-image",
        column: "tier",
        reason: "is not a string",
        line: tier + 1,
      });
    });

    it("takes a header-shaped line inside a string for a table, and refuses that table", () => {
      const text = renderRegister([
        renderRow("a", { select: `"""\n[ghost]\n"""` }),
        renderRow("corpus-bijection"),
        renderRow("corpus-can-fail", { expect: `"fail"` }),
      ]);
      const refusal = catchRefusal(RegisterRefusal, () =>
        parseRegister(text, PIPELINE),
      );
      expect(refusal.faults.length).toBeGreaterThan(0);
      expect(new Set(refusal.faults.map(({ table }) => table))).toEqual(
        new Set(["ghost"]),
      );
    });

    it("agrees with the budget's rebudget on which lines are headers", () => {
      // Two copies of one line grammar, one in each domain; this is the pin
      // that keeps them equal. Each text holds one header the scan must find
      // and the rebudget must stop at, ahead of a run_s line that belongs to
      // the next table. A table the scan located is refused column by column;
      // one it did not is refused whole, as a value at the top, or not at all.
      const shapes = [
        "[b]",
        "  [ b ]  ",
        "[b] # a note",
        "[b]\r",
        "[[b]]",
        `key = "[b]"`,
        "# [b]",
      ];
      for (const shape of shapes) {
        const text = `[a]\n${shape}\nrun_s = { class = "c", p95 = 1, budget = 10 }\n`;
        const refusal = catchRefusal(RegisterRefusal, () =>
          parseRegister(text, PIPELINE),
        );
        const located = refusal.faults
          .filter(({ column }) => column !== undefined)
          .map(({ table }) => table);
        const rebudget = () =>
          rewriteRunBudget(text, "a", { class: "c", p95: 1 });
        if (located.includes("b")) {
          expect(rebudget).toThrow(Refusal);
          expect(rebudget).toThrow("table [a] has no run_s line to replace");
        } else {
          expect(new Set(located)).toEqual(new Set(["a"]));
          expect(rebudget()).toContain(`${shape}\nrun_s = { class = "c"`);
        }
      }
    });
  });
});
