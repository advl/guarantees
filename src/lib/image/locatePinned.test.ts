import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { IMAGES_DIR, locatePinned, PINNED_FILE } from "./index.js";

describe("locatePinned", () => {
  it("puts an image's record beside the definition it was taken from", () => {
    expect(locatePinned("/srv/checkout", "ts")).toBe(
      join("/srv/checkout", IMAGES_DIR, "ts", PINNED_FILE),
    );
  });
});
