import { CEILINGS, type Tier } from "../register/index.js";
import type { Verdict } from "../verdict/index.js";

/**
 * Judges the wall-clock span of a tier's schedule against its wall.
 * `elapsedSeconds` is the span from the first row of the pool starting to
 * the last serial row being torn down: every phase of every row, image
 * resolution, build recipes and teardown included, because the wall is what
 * the tier costs whoever waits for it and none of that time is free. It is
 * never the runs summed, which is the same number whether the rows ran as a
 * pool or one after another, and never the measured phases alone, which is
 * what each row's own budget bounds. The wall is one number over the whole
 * schedule, so running rows in parallel buys room under it and never moves
 * it. The release tier has no wall, and the verdict says so rather than
 * printing an infinity.
 */
export default function judgeWall(elapsedSeconds: number, tier: Tier): Verdict {
  const wall = CEILINGS[tier].wall;
  const ok = elapsedSeconds <= wall;
  const ceiling = Number.isFinite(wall)
    ? `${ok ? "inside" : "past"} its ${wall} s wall`
    : "under no wall";
  return {
    ok,
    reason: `${tier} tier: ${elapsedSeconds.toFixed(1)} s of wall-clock, ${ceiling}`,
  };
}
