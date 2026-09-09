import { describe, expect, it } from "vitest";

import {
  PIPELINE,
  renderRegister,
  renderRow,
} from "../../_testing/fixtures.js";
import { parseRegister } from "../register/index.js";
import { judgeCorpus } from "./index.js";

const register = parseRegister(
  renderRegister([
    renderRow("corpus-bijection"),
    renderRow("corpus-can-fail", {
      file: `"selftest/corpus-can-fail.test.ts"`,
      expect: `"fail"`,
    }),
  ]),
  PIPELINE,
);
const claimed = [...register.values()].map((row) => row.file);

describe("judgeCorpus", () => {
  it("holds where every collected file has a row and every row resolves to one", () => {
    const judged = judgeCorpus(claimed, register);
    expect(judged.verdict).toEqual({
      ok: true,
      reason: "2 rows, 2 files collected",
    });
    expect(judged.uncollected).toEqual([]);
    expect(judged.unclaimed).toEqual([]);
  });

  it("goes red on a file no row claims, and names it, since it runs in the tier and is nobody's gate", () => {
    const judged = judgeCorpus([...claimed, "stray.test.ts"], register);
    expect(judged.verdict.ok).toBe(false);
    expect(judged.unclaimed).toEqual(["stray.test.ts"]);
    expect(judged.uncollected).toEqual([]);
  });

  it("goes red on a row the runner would not collect, and names it against its file", () => {
    const judged = judgeCorpus(["selftest/corpus-can-fail.test.ts"], register);
    expect(judged.verdict.ok).toBe(false);
    expect(judged.uncollected).toEqual([
      "corpus-bijection -> corpus-bijection.test.ts",
    ]);
    expect(judged.unclaimed).toEqual([]);
  });

  it("counts a file no row claims into the number it prints as well as into the verdict", () => {
    expect(
      judgeCorpus([...claimed, "stray.test.ts"], register).verdict,
    ).toEqual({ ok: false, reason: "2 rows, 3 files collected" });
  });
});
