import { describe, expect, it } from "vitest";

import { Refusal } from "../contract/index.js";
import { CEILINGS } from "../register/index.js";
import { judgeBudget } from "./index.js";

const measured = { class: "gh-ubuntu", p95: 4 };

describe("judgeBudget", () => {
  it("holds a measurement whose budget the tier admits, naming the class it was taken on", () => {
    const judged = judgeBudget(measured, "pr");
    expect(judged.ok).toBe(true);
    expect(judged.reason).toContain("gh-ubuntu");
    expect(judged.reason).toContain(`${CEILINGS.pr.entry} s ceiling per entry`);
  });

  it("goes red on a measurement whose budget is past the tier's ceiling, with the remedy the parser names", () => {
    const judged = judgeBudget({ ...measured, p95: 45 }, "pr");
    expect(judged.ok).toBe(false);
    expect(judged.reason).toContain("past the pr tier's");
    expect(judged.reason).toContain("promote the row to a later tier");
  });

  it("holds any measurement at the release tier, which has no ceiling to be past", () => {
    expect(judgeBudget({ ...measured, p95: 3600 }, "release").ok).toBe(true);
  });

  it("declines a measurement that is not one, from the rule that turns a p95 into a budget", () => {
    expect(() => judgeBudget({ ...measured, p95: -1 }, "pr")).toThrow(Refusal);
  });
});
