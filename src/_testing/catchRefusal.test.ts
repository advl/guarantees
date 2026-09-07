import { describe, expect, it } from "vitest";

import catchRefusal from "./catchRefusal.js";

class Refusal extends Error {}

describe("catchRefusal", () => {
  it("returns the refusal an attempt throws", () => {
    const thrown = new Refusal("no");
    expect(
      catchRefusal(Refusal, () => {
        throw thrown;
      }),
    ).toBe(thrown);
  });

  it("lets an error of another kind through", () => {
    expect(() =>
      catchRefusal(Refusal, () => {
        throw new TypeError("other");
      }),
    ).toThrow(TypeError);
  });

  it("fails when the attempt does not throw", () => {
    expect(() => catchRefusal(Refusal, () => 1)).toThrow(
      "expected a Refusal and nothing was thrown",
    );
  });
});
