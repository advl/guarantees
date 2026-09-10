import { describe, expect, it } from "vitest";

import catchRefusal from "../../_testing/catchRefusal.js";
import expectOneFault from "../../_testing/expectOneFault.js";
import {
  IMAGE_A,
  MACHINE_CLASS,
  PIPELINE,
  REQUIRED_ROWS,
  renderRegister,
  renderRow,
} from "../../_testing/fixtures.js";
import { registerSchema } from "../contract/index.js";
import { parseRegister, RegisterRefusal } from "./index.js";

const ROW = "corpus-image";
/** A pr register whose one extra row carries one mutation. */
const mutated = (columns: Readonly<Record<string, string | null>>) =>
  renderRegister([renderRow(ROW, columns), ...REQUIRED_ROWS]);

const runS = (fields: string) => `{ ${fields} }`;
const CLASS = `class = "${MACHINE_CLASS}"`;

describe("parseRegister", () => {
  describe("a row", () => {
    it.each([
      "kind",
      "tier",
      "file",
      "select",
      "build",
      "image",
      "isolation",
      "holds",
      "teardown",
      "expect",
      "run_s",
    ])("refuses a row without %s", (column) => {
      expectOneFault(mutated({ [column]: null }), {
        table: ROW,
        column,
        reason: /is missing/,
      });
    });

    it("refuses an empty string column", () => {
      expectOneFault(mutated({ select: `""` }), {
        table: ROW,
        column: "select",
        reason: "is empty",
      });
    });

    it("refuses a string column that is not a string", () => {
      expectOneFault(mutated({ kind: "3" }), {
        table: ROW,
        column: "kind",
        reason: "is not a string",
      });
    });

    it.each([
      ["build", `"g:build"`],
      ["holds", "[1]"],
      ["teardown", `[""]`],
    ])("refuses %s that is not a list of non-empty strings", (column, value) => {
      expectOneFault(mutated({ [column]: value }), {
        table: ROW,
        column,
        reason: "is not a list of non-empty strings",
      });
    });

    it("refuses a twelfth column", () => {
      expectOneFault(mutated({ packge: `"x"` }), {
        table: ROW,
        column: "packge",
        reason: /is not a column the register admits/,
      });
    });

    it("refuses a kind outside the vocabulary", () => {
      expectOneFault(mutated({ kind: `"smoke"` }), {
        table: ROW,
        column: "kind",
        reason:
          "`smoke` is not one of oracle | determinism | conformance | golden | budget | compat | perf",
      });
    });

    it("refuses a tier outside the vocabulary", () => {
      expectOneFault(mutated({ tier: `"weekly"` }), {
        table: ROW,
        column: "tier",
        reason: "`weekly` is not one of pr | merge | nightly | release",
      });
    });

    it("refuses an isolation outside the vocabulary", () => {
      expectOneFault(mutated({ isolation: `"host"` }), {
        table: ROW,
        column: "isolation",
        reason: "`host` is not one of image | image-net",
      });
    });

    it("refuses an expectation outside pass and fail", () => {
      expectOneFault(mutated({ expect: `"maybe"` }), {
        table: ROW,
        column: "expect",
        reason: "`maybe` is not one of pass | fail",
      });
    });

    it.each([
      ["an absolute file", `"/tmp/x.test.ts"`, /is absolute/],
      [
        "a file that leaves the tree",
        `"../packages/x.test.ts"`,
        /leaves the tree/,
      ],
      [
        "a file on more than one line",
        `"a\\n.test.ts"`,
        /^"a\\n\.test\.ts" is not on one line/,
      ],
    ])("refuses %s", (_, file, reason) => {
      expectOneFault(mutated({ file }), { table: ROW, column: "file", reason });
    });

    it("refuses a file without the suffix the caller says the runner collects", () => {
      expectOneFault(mutated({ file: `"x.spec.ts"` }), {
        table: ROW,
        column: "file",
        reason:
          /does not end in \.test\.ts — that suffix is what the runner collects/,
      });
      // Carries the suffix and does not end in it, so a rule that looked for
      // the suffix anywhere in the name would admit what the runner skips.
      expectOneFault(mutated({ file: `"corpus-image.test.tsx"` }), {
        table: ROW,
        column: "file",
        reason: /`corpus-image\.test\.tsx` does not end in \.test\.ts/,
      });
      const specs = renderRegister([
        renderRow(ROW, { file: `"x.spec.ts"` }),
        renderRow("corpus-bijection", { file: `"z.spec.ts"` }),
        renderRow("corpus-can-fail", { file: `"y.spec.ts"`, expect: `"fail"` }),
      ]);
      expect(
        parseRegister(specs, { ...PIPELINE, collects: ".spec.ts" }).get(ROW)
          ?.file,
      ).toBe("x.spec.ts");
    });

    it("admits and refuses a file exactly as the schema's pattern does", () => {
      // The schema is what a validator in another language applies, and the
      // parser's three reasons explain a miss of it; this is the pin that
      // keeps the two from admitting different files.
      const pattern = new RegExp(registerSchema.$defs.file.pattern);
      const admits = (path: string) => {
        try {
          parseRegister(mutated({ file: JSON.stringify(path) }), PIPELINE);
          return true;
        } catch (error) {
          if (
            error instanceof RegisterRefusal &&
            error.faults.every(({ column }) => column === "file")
          ) {
            return false;
          }
          throw error;
        }
      };
      for (const path of [
        "a.test.ts",
        "dir/a.test.ts",
        "..a/b.test.ts",
        "a../b.test.ts",
        "a/..b.test.ts",
        "/abs.test.ts",
        "../up.test.ts",
        "a/../b.test.ts",
        "a/..",
        "a\n.test.ts",
        "a\r.test.ts",
        "a\u2028.test.ts",
      ]) {
        expect(admits(path), path).toBe(pattern.test(path));
      }
    });

    it.each([
      "ghcr.io/example/guarantees-ts:latest",
      "ghcr.io/example/guarantees-ts@sha256:abc",
      IMAGE_A.toUpperCase(),
    ])("refuses an image of %s as not digest-pinned", (image) => {
      expectOneFault(mutated({ image: `"${image}"` }), {
        table: ROW,
        column: "image",
        reason: /is not pinned as name@sha256:<64 hex digits>/,
      });
    });

    it("refuses holds without a teardown", () => {
      expectOneFault(mutated({ holds: `["dev-server"]` }), {
        table: ROW,
        column: "teardown",
        reason: /is empty while holds names `dev-server`/,
      });
    });

    it("refuses run_s that is not a table", () => {
      expectOneFault(mutated({ run_s: "10" }), {
        table: ROW,
        column: "run_s",
        reason: "is not a table of { class, p95, budget }",
      });
    });

    it("refuses a key run_s does not carry", () => {
      expectOneFault(
        mutated({ run_s: runS(`${CLASS}, p95 = 1, budget = 10, host = "x"`) }),
        {
          table: ROW,
          column: "run_s",
          reason: "`host` is not a key run_s carries (class, p95, budget)",
        },
      );
    });

    it.each([
      ["without a class", "p95 = 1, budget = 10"],
      ["with an empty class", `class = "", p95 = 1, budget = 10`],
    ])("refuses run_s %s", (_, fields) => {
      expectOneFault(mutated({ run_s: runS(fields) }), {
        table: ROW,
        column: "run_s",
        reason: /class is missing or empty/,
      });
    });

    it.each([
      ["without a p95", `${CLASS}, budget = 10`],
      ["with a p95 of zero", `${CLASS}, p95 = 0, budget = 10`],
      ["with a p95 that is not a number", `${CLASS}, p95 = "1", budget = 10`],
      ["with a p95 that is not finite", `${CLASS}, p95 = inf, budget = 10`],
    ])("refuses run_s %s", (_, fields) => {
      expectOneFault(mutated({ run_s: runS(fields) }), {
        table: ROW,
        column: "run_s",
        reason: /p95 is missing or not a number above zero/,
      });
    });

    it.each([
      ["without a budget", `${CLASS}, p95 = 1`],
      ["with a fractional budget", `${CLASS}, p95 = 1, budget = 10.5`],
      ["with a budget of zero", `${CLASS}, p95 = 1, budget = 0`],
    ])("refuses run_s %s", (_, fields) => {
      expectOneFault(mutated({ run_s: runS(fields) }), {
        table: ROW,
        column: "run_s",
        reason: /budget is missing or not a whole number of seconds above zero/,
      });
    });

    it("refuses a budget below the floor", () => {
      expectOneFault(
        mutated({ run_s: runS(`${CLASS}, p95 = 1, budget = 5`) }),
        {
          table: ROW,
          column: "run_s",
          reason: /budget 5 is below the floor of 10 s/,
        },
      );
    });

    it("refuses a budget below what its p95 sets", () => {
      expectOneFault(
        mutated({ run_s: runS(`${CLASS}, p95 = 20, budget = 20`) }),
        {
          table: ROW,
          column: "run_s",
          reason: /budget 20 is below 30, the p95 of 20 times 1.5 rounded up/,
        },
      );
    });

    it("admits a budget above what its p95 sets", () => {
      const rows = parseRegister(
        mutated({ run_s: runS(`${CLASS}, p95 = 20, budget = 40`) }),
        PIPELINE,
      );
      expect(rows.get(ROW)?.run.budget).toBe(40);
    });

    it("admits a budget of 11 for a p95 of 7.34, rounding the p95 to a tenth before multiplying", () => {
      const rows = parseRegister(
        mutated({ run_s: runS(`${CLASS}, p95 = 7.34, budget = 11`) }),
        PIPELINE,
      );
      expect(rows.get(ROW)?.run.budget).toBe(11);
    });

    it("refuses a budget past the tier's ceiling per entry", () => {
      expectOneFault(
        mutated({ run_s: runS(`${CLASS}, p95 = 50, budget = 75`) }),
        {
          table: ROW,
          column: "run_s",
          reason: /budget 75 is past the pr tier's 60 s ceiling per entry/,
        },
      );
    });

    it("reports every fault of one row, not the first", () => {
      const refusal = catchRefusal(RegisterRefusal, () =>
        parseRegister(mutated({ run_s: runS("p95 = 0") }), PIPELINE),
      );
      expect(
        refusal.faults.map(({ reason }) => reason.split(" ").at(0)),
      ).toEqual(["class", "p95", "budget"]);
    });
  });
});
