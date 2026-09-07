import { describe, expect, it } from "vitest";

import catchRefusal from "../../_testing/catchRefusal.js";
import expectOneFault from "../../_testing/expectOneFault.js";
import {
  MACHINE_CLASS,
  PIPELINE,
  REGISTER_ONE_IMAGE,
  REGISTER_TWO_IMAGES,
  renderRegister,
  renderRow,
} from "../../_testing/fixtures.js";
import { parseRegister, RegisterRefusal } from "./index.js";

describe("parseRegister", () => {
  describe("a tier", () => {
    it("is refused when it holds rows and none designed to fail", () => {
      const text = `${REGISTER_ONE_IMAGE}\n${renderRow("x", { tier: `"merge"` })}\n`;
      expectOneFault(text, {
        table: "merge",
        reason: /holds `x` and no row marked `expect = "fail"`/,
      });
    });

    it("is admitted when its budgets sum past its wall, because the wall is judged over the schedule as it ran", () => {
      // Six pr rows at the 60 s ceiling per entry sum to 360 s against a
      // 300 s wall; as a pool they finish inside it at any concurrency of two,
      // and a parse-time sum would have demoted rows to admit the register.
      const at60 = {
        run_s: `{ class = "${MACHINE_CLASS}", p95 = 40, budget = 60 }`,
      };
      const text = renderRegister([
        renderRow("a", at60),
        renderRow("b", at60),
        renderRow("c", at60),
        renderRow("d", at60),
        renderRow("e", at60),
        renderRow("f", { ...at60, expect: `"fail"` }),
      ]);
      expect(parseRegister(text, PIPELINE).size).toBe(6);
    });

    it("is refused when it holds rows and the pipeline triggers it not", () => {
      expectOneFault(
        REGISTER_ONE_IMAGE,
        { table: "pr", reason: /nothing triggers it/ },
        { ...PIPELINE, triggeredTiers: ["merge"] },
      );
    });

    it("is refused when it holds rows and the pipeline proves it not", () => {
      expectOneFault(
        REGISTER_ONE_IMAGE,
        { table: "pr", reason: /nothing proves it/ },
        { ...PIPELINE, provenTiers: [] },
      );
    });

    it("is refused twice, with every other tier held, by a caller with no workflow", () => {
      const refusal = catchRefusal(RegisterRefusal, () =>
        parseRegister(REGISTER_TWO_IMAGES, {
          ...PIPELINE,
          triggeredTiers: [],
          provenTiers: [],
        }),
      );
      expect(
        refusal.faults.map(({ table, reason }) => [
          table,
          reason.replace(/^holds .*? and /, ""),
        ]),
      ).toEqual([
        ["pr", expect.stringMatching(/^nothing triggers it/)],
        ["pr", expect.stringMatching(/^nothing proves it/)],
        ["merge", expect.stringMatching(/^nothing triggers it/)],
        ["merge", expect.stringMatching(/^nothing proves it/)],
      ]);
    });

    it("admits any budget in the release tier, which has no ceiling per entry", () => {
      const text = renderRegister([
        renderRow("a", {
          tier: `"release"`,
          run_s: `{ class = "${MACHINE_CLASS}", p95 = 6000, budget = 9000 }`,
        }),
        renderRow("b", { tier: `"release"`, expect: `"fail"` }),
      ]);
      expect(parseRegister(text, PIPELINE).size).toBe(2);
    });
  });
});
