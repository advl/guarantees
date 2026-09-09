import { describe, expect, it } from "vitest";

import { LOCAL_PREFIX, tagLocalBuild } from "./index.js";

describe("tagLocalBuild", () => {
  it("names a build under the local prefix and never under a registry", () => {
    expect(tagLocalBuild("ts")).toBe(`${LOCAL_PREFIX}-ts:local`);
  });
});
