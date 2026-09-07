import { describe, expect, it } from "vitest";

import { CEILINGS, TIERS } from "../register/index.js";
import { judgeWall } from "./index.js";

describe("judgeWall", () => {
  it.each(
    TIERS.filter((tier) => Number.isFinite(CEILINGS[tier].wall)),
  )("holds the %s tier under, at and over its wall", (tier) => {
    const wall = CEILINGS[tier].wall;
    expect(judgeWall(wall - 0.5, tier)).toEqual({
      ok: true,
      reason: `${tier} tier: ${(wall - 0.5).toFixed(1)} s of wall-clock, inside its ${wall} s wall`,
    });
    expect(judgeWall(wall, tier).ok).toBe(true);
    expect(judgeWall(wall + 0.1, tier)).toEqual({
      ok: false,
      reason: `${tier} tier: ${(wall + 0.1).toFixed(1)} s of wall-clock, past its ${wall} s wall`,
    });
  });

  it("never holds the release tier past a wall", () => {
    expect(judgeWall(1_000_000_000, "release")).toEqual({
      ok: true,
      reason: "release tier: 1000000000.0 s of wall-clock, under no wall",
    });
  });
});
