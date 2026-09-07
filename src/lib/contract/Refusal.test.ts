import { describe, expect, it } from "vitest";

import { Refusal } from "./index.js";

describe("Refusal", () => {
  it("is an error carrying the fault as its message", () => {
    const refusal = new Refusal("the nightly tier holds no rows");
    expect(refusal).toBeInstanceOf(Error);
    expect(refusal.name).toBe("Refusal");
    expect(refusal.message).toBe("the nightly tier holds no rows");
  });
});
