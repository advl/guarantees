import { describe, expect, it } from "vitest";
import { labelSchema, Refusal } from "../contract/index.js";
import { hashCheckout } from "./index.js";

const corpusPattern = new RegExp(labelSchema.properties.corpus.pattern);

describe("hashCheckout", () => {
  it("answers a label of the shape the contract's corpus label takes", () => {
    expect(hashCheckout("/srv/repositories/one")).toMatch(corpusPattern);
  });

  it("answers the same label for one path every time", () => {
    expect(hashCheckout("/srv/repositories/one")).toBe(
      hashCheckout("/srv/repositories/one"),
    );
  });

  it("answers different labels for two checkouts", () => {
    expect(hashCheckout("/srv/repositories/one")).not.toBe(
      hashCheckout("/srv/repositories/one-worktree"),
    );
  });

  it("refuses a relative path, which would name a different place from every working directory", () => {
    expect(() => hashCheckout("repositories/one")).toThrow(Refusal);
    expect(() => hashCheckout("repositories/one")).toThrow(
      "is not an absolute path",
    );
  });
});
