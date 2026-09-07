import { describe, expect, it, vi } from "vitest";

import catchRefusal from "../../_testing/catchRefusal.js";
import expectOneFault from "../../_testing/expectOneFault.js";
import {
  IMAGE_A,
  IMAGE_B,
  MACHINE_CLASS,
  PIPELINE,
  REGISTER_COMMENTED,
  REGISTER_ONE_IMAGE,
  REGISTER_TWO_IMAGES,
  renderRegister,
  renderRow,
} from "../../_testing/fixtures.js";
import { rewriteRunBudget } from "../budget/index.js";
import { parseRegister, RegisterRefusal } from "./index.js";

const SENTINEL = renderRow("corpus-can-fail", { expect: `"fail"` });

describe("parseRegister", () => {
  it("reads a five-row corpus in one image, in written order, every column read", () => {
    const rows = parseRegister(REGISTER_ONE_IMAGE, PIPELINE);
    expect([...rows.keys()]).toEqual([
      "corpus-bijection",
      "corpus-layering",
      "corpus-image",
      "corpus-toolchain",
      "corpus-can-fail",
    ]);
    expect(rows.get("corpus-toolchain")).toEqual({
      id: "corpus-toolchain",
      kind: "conformance",
      tier: "pr",
      file: "corpus-toolchain.test.ts",
      select: "corpus-toolchain",
      build: ["g:build:toolchain-stamp"],
      image: IMAGE_A,
      isolation: "image",
      holds: [],
      teardown: [],
      expect: "pass",
      run: { class: MACHINE_CLASS, p95: 1, budget: 10 },
    });
    expect(rows.get("corpus-can-fail")).toMatchObject({
      file: "selftest/corpus-can-fail.test.ts",
      expect: "fail",
    });
  });

  it("reads a seven-row corpus across two tiers and two images, holds included", () => {
    const rows = parseRegister(REGISTER_TWO_IMAGES, PIPELINE);
    expect(rows.size).toBe(7);
    expect(rows.get("examples-run")).toEqual({
      id: "examples-run",
      kind: "conformance",
      tier: "merge",
      file: "examples-run.test.ts",
      select: "examples-run",
      build: ["g:build:examples"],
      image: IMAGE_B,
      isolation: "image-net",
      holds: ["dev-server", "browser"],
      teardown: ["g:teardown:examples-run"],
      expect: "pass",
      run: { class: MACHINE_CLASS, p95: 40, budget: 60 },
    });
    expect(rows.get("bundle-size")?.kind).toBe("budget");
  });

  it("reads a register written in the padded, commented layout a hand-edited register settles into, as the same rows", () => {
    expect(parseRegister(REGISTER_COMMENTED, PIPELINE)).toEqual(
      parseRegister(REGISTER_ONE_IMAGE, PIPELINE),
    );
  });

  it("reads a register whose tiers the caller has seen triggered and proven", () => {
    const rows = parseRegister(REGISTER_TWO_IMAGES, {
      ...PIPELINE,
      triggeredTiers: ["pr", "merge"],
      provenTiers: ["pr", "merge"],
    });
    expect(rows.size).toBe(7);
  });

  it("admits the pair a rebudget writes back into the register", () => {
    const rebudgeted = rewriteRunBudget(REGISTER_ONE_IMAGE, "corpus-image", {
      class: "ci",
      p95: 7.96,
    });
    expect(
      parseRegister(rebudgeted, PIPELINE).get("corpus-image")?.run,
    ).toEqual({
      class: "ci",
      p95: 8,
      budget: 12,
    });
  });

  it("refuses text that does not parse, naming the line", () => {
    expectOneFault(`[a]\nkind = "conformance`, {
      table: "",
      reason: /does not parse: .*string/,
      line: 2,
    });
  });

  it("refuses a value at the top of the register that is not a table", () => {
    expectOneFault(`title = "x"\n\n${REGISTER_ONE_IMAGE}`, {
      table: "title",
      reason: /is a value at the top of the register/,
    });
  });

  it("refuses an array of tables", () => {
    const text = renderRegister([
      renderRow("rows").replace("[rows]", "[[rows]]"),
      SENTINEL,
    ]);
    expectOneFault(text, {
      table: "rows",
      reason: /is a value at the top of the register/,
    });
  });

  it.each([
    "Corpus-Bijection",
    "-leading",
    "a.b",
  ])("refuses [%s] as an id", (id) => {
    expectOneFault(renderRegister([renderRow(id), SENTINEL]), {
      table: id,
      reason: /is not an id/,
      line: 1,
    });
  });

  it("refuses the reserved id where run reports are kept", () => {
    expectOneFault(renderRegister([renderRow("reports"), SENTINEL]), {
      table: "reports",
      reason: /is reserved/,
      line: 1,
    });
  });

  it("refuses an id defined twice, naming the second definition", () => {
    const text = `${REGISTER_ONE_IMAGE}\n${renderRow("corpus-image")}\n`;
    const second = text.split("\n").lastIndexOf("[corpus-image]") + 1;
    expectOneFault(text, {
      table: "corpus-image",
      reason: /is defined twice/,
      line: second,
    });
  });

  it("collects every fault before refusing", () => {
    const text = renderRegister([
      renderRow("a", { kind: `"smoke"`, tier: `"weekly"` }),
      renderRow("b", { isolation: `"host"` }),
      SENTINEL,
    ]);
    const refusal = catchRefusal(RegisterRefusal, () =>
      parseRegister(text, PIPELINE),
    );
    expect(
      refusal.faults.map(({ table, column }) => `${table}.${column}`),
    ).toEqual(["a.kind", "a.tier", "b.isolation"]);
  });

  it("judges no tier while a row is unreadable", () => {
    // The readable row's tier has no sentinel and, by the option, nothing
    // triggering it: two tier faults that would fire if the row fault did
    // not hold them back.
    const text = renderRegister([
      renderRow("readable"),
      renderRow("a", { kind: `"smoke"` }),
    ]);
    const refusal = catchRefusal(RegisterRefusal, () =>
      parseRegister(text, { ...PIPELINE, triggeredTiers: [] }),
    );
    expect(refusal.faults.map(({ table }) => table)).toEqual(["a"]);
  });

  it("surfaces an error that is not the parser's own as itself, never as a refusal", async () => {
    // A refusal points the register's author at a line; an error the parser
    // did not throw has no line and is a defect here, so it is rethrown
    // unchanged. The parser is replaced for one fresh instance of the
    // module, since nothing the register can say makes it throw anything
    // but its own error.
    vi.resetModules();
    vi.doMock("smol-toml", async (importOriginal) => ({
      ...(await importOriginal<typeof import("smol-toml")>()),
      parse: () => {
        throw new TypeError("not the parser's own");
      },
    }));
    try {
      const { default: fresh } = await import("./parseRegister.js");
      const read = () => fresh(REGISTER_ONE_IMAGE, PIPELINE);
      expect(read).toThrow(TypeError);
      expect(read).toThrow("not the parser's own");
    } finally {
      vi.doUnmock("smol-toml");
      vi.resetModules();
    }
  });
});
