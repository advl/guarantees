import { describe, expect, it } from "vitest";

import { IMAGE_A } from "../../_testing/fixtures.js";
import { registerSchema } from "../contract/index.js";
import { INPUTS_PATTERN, PINNED_FILE, REFERENCE_PATTERN } from "./index.js";

describe("image constants", () => {
  it("hold a pinned reference to the register's image column", () => {
    expect(REFERENCE_PATTERN.source).toBe(registerSchema.$defs.image.pattern);
    expect(REFERENCE_PATTERN.test(IMAGE_A)).toBe(true);
    expect(REFERENCE_PATTERN.test("ghcr.io/example/guarantees-ts:latest")).toBe(
      false,
    );
  });

  it("hold an inputs hash to a bare sha256 of sixty-four hex digits", () => {
    expect(INPUTS_PATTERN.test(`sha256:${"0".repeat(64)}`)).toBe(true);
    expect(INPUTS_PATTERN.test(`sha256:${"0".repeat(63)}`)).toBe(false);
    expect(INPUTS_PATTERN.test(IMAGE_A)).toBe(false);
  });

  it("name the pinned record as a TOML file", () => {
    expect(PINNED_FILE).toBe("pinned.toml");
  });
});
