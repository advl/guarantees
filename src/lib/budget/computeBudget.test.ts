import { describe, expect, it } from "vitest";

import { Refusal } from "../contract/index.js";
import { computeBudget } from "./index.js";

describe("computeBudget", () => {
  it("never sets a budget below ten seconds", () => {
    expect(computeBudget(0)).toBe(10);
    expect(computeBudget(0.7)).toBe(10);
    expect(computeBudget(6.6)).toBe(10);
  });

  it("sets one and a half times the p95, rounded up, above the floor", () => {
    expect(computeBudget(6.7)).toBe(11);
    expect(computeBudget(20)).toBe(30);
    expect(computeBudget(38)).toBe(57);
  });

  it("rounds the p95 to a tenth before multiplying, and not after", () => {
    // 7.34 × 1.5 is 11.01 and rounds up to 12 unrounded; rounded first it is
    // 7.3 × 1.5 = 10.95, so 11. 7.36 rounds to 7.4, whose 11.1 rounds up to
    // 12, where rounding after multiplying would give 11.04 and so 11.
    expect(computeBudget(7.34)).toBe(11);
    expect(computeBudget(7.36)).toBe(12);
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    -1,
  ])("refuses a p95 of %s as not a measurement", (p95) => {
    expect(() => computeBudget(p95)).toThrow(Refusal);
    expect(() => computeBudget(p95)).toThrow("is not a measurement");
  });
});
