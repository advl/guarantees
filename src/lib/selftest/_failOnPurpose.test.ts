import { describe, expect, it } from "vitest";

import _failOnPurpose from "./_failOnPurpose.js";

describe("_failOnPurpose", () => {
  it("fails whenever it is asked, which is the fact the sentinel exists to report", () => {
    expect(_failOnPurpose).toThrow("the corpus reports failure");
  });
});
