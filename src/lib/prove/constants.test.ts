import { describe, expect, it } from "vitest";

import { registerSchema } from "../contract/index.js";
import { COLLECTS } from "../runner/index.js";
import { BIJECTION_ID, ORPHAN_ID } from "./index.js";

describe("prove constants", () => {
  it("name the installed file something no register may claim, so it is unclaimed by construction", () => {
    expect(ORPHAN_ID).not.toMatch(new RegExp(registerSchema.$defs.id.pattern));
  });

  it("name it something the runner still collects, since a file the runner skips proves nothing", () => {
    expect(`${ORPHAN_ID}${COLLECTS}`.startsWith(".")).toBe(false);
    expect(`${ORPHAN_ID}${COLLECTS}`.endsWith(COLLECTS)).toBe(true);
  });

  it("name the row a proof by orphan looks for as an id a register may take", () => {
    expect(BIJECTION_ID).toMatch(new RegExp(registerSchema.$defs.id.pattern));
  });
});
