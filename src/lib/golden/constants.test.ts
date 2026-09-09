import { describe, expect, it } from "vitest";

import { GOLDENS_DIR } from "./index.js";

describe("golden constants", () => {
  it("name the goldens as one directory of the corpus, holding a directory per row", () => {
    expect(GOLDENS_DIR).toBe("goldens");
  });
});
