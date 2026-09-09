import { sep } from "node:path";
import { describe, expect, it } from "vitest";

import _within from "./_within.js";

const workspace = `${sep}workspace`;

describe("_within", () => {
  it("holds for the directory itself", () => {
    expect(_within(workspace, workspace)).toBe(true);
  });

  it("holds for a path under it, however deep", () => {
    expect(_within(workspace, `${workspace}${sep}guarantees`)).toBe(true);
    expect(
      _within(workspace, `${workspace}${sep}node_modules${sep}vitest`),
    ).toBe(true);
  });

  it("does not hold for a sibling whose name opens with the directory's", () => {
    expect(_within(workspace, `${workspace}-other`)).toBe(false);
    expect(_within(workspace, `${workspace}-other${sep}vitest`)).toBe(false);
  });

  it("does not hold for a path outside it", () => {
    expect(_within(workspace, `${sep}image${sep}node_modules`)).toBe(false);
  });
});
