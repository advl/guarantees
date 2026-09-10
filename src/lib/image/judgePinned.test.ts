import { describe, expect, it } from "vitest";

import { IMAGE_A } from "../../_testing/fixtures.js";
import { Refusal } from "../contract/index.js";
import { judgePinned } from "./index.js";
import type { Built, Pinned } from "./types.js";

const INPUTS = `sha256:${"a".repeat(64)}`;
const built: Built = {
  id: "sha256:local",
  localDigest: `sha256:${"d".repeat(64)}`,
  inputs: INPUTS,
};
const before: Pinned = { digest: IMAGE_A, inputs: INPUTS };

describe("judgePinned", () => {
  it("holds where the definition hashes to what its record carries, and names the image the rows pin", () => {
    expect(judgePinned(before, built, "ts")).toEqual({
      ok: true,
      reason: expect.stringContaining(IMAGE_A),
    });
  });

  it("judges the definition and never the digest, since no build here answers the one that was published", () => {
    const elsewhere = { ...built, localDigest: `sha256:${"c".repeat(64)}` };
    expect(judgePinned(before, elsewhere, "ts").ok).toBe(true);
  });

  it("goes red where the definition has changed, naming the hash to record and the image the rows are measured against", () => {
    const moved = { ...built, inputs: `sha256:${"b".repeat(64)}` };
    const verdict = judgePinned(before, moved, "ts");
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain(moved.inputs);
    expect(verdict.reason).toContain(IMAGE_A);
  });

  it("refuses a definition nothing recorded, since a build here cannot supply a digest anybody can fetch", () => {
    expect(() => judgePinned(null, built, "ts")).toThrow(Refusal);
    expect(() => judgePinned(null, built, "ts")).toThrow(
      `has no pinned.toml beside its definition`,
    );
    expect(() => judgePinned(null, built, "ts")).toThrow(INPUTS);
  });
});
