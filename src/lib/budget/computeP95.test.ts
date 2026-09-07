import { describe, expect, it } from "vitest";

import { Refusal } from "../contract/index.js";
import { computeP95 } from "./index.js";

describe("computeP95", () => {
  it("takes the slowest of five windows, in whatever order they were measured", () => {
    expect(computeP95([1.2, 5.5, 2.1, 4.8, 3.3])).toBe(5.5);
  });

  it("takes the nearest rank, not the slowest, when more windows are given", () => {
    const twenty = Array.from({ length: 20 }, (_, index) => 20 - index);
    expect(computeP95(twenty)).toBe(19);
  });

  it("refuses fewer windows than a budget is set from", () => {
    expect(() => computeP95([1, 2, 3, 4])).toThrow(Refusal);
    expect(() => computeP95([1, 2, 3, 4])).toThrow(
      "4 measured windows is fewer than the 5 a budget is set from",
    );
    expect(() => computeP95([1])).toThrow("1 measured window is fewer");
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    -1,
  ])("refuses a window of %s as not a measurement", (window) => {
    expect(() => computeP95([1, 2, window, 4, 5])).toThrow(Refusal);
    expect(() => computeP95([1, 2, window, 4, 5])).toThrow(
      `a measured window of ${window} is not a measurement`,
    );
  });
});
