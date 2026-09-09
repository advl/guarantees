import { describe, expect, it } from "vitest";

import { PIPELINE, REGISTER_ONE_IMAGE } from "../../_testing/fixtures.js";
import { parseRegister } from "../register/index.js";
import findUnclaimedFiles from "./findUnclaimedFiles.js";

const register = parseRegister(REGISTER_ONE_IMAGE, PIPELINE);
const claimed = [...register.values()].map((row) => row.file).sort();

describe("findUnclaimedFiles", () => {
  it("finds nothing where every file the runner would collect has a row", () => {
    expect(findUnclaimedFiles(claimed, register)).toEqual([]);
  });

  it("names every collected file no row claims, sorted, whatever order the runner listed them in", () => {
    expect(
      findUnclaimedFiles(
        ["zeta.test.ts", ...claimed, "alpha.test.ts"],
        register,
      ),
    ).toEqual(["alpha.test.ts", "zeta.test.ts"]);
  });

  it("finds nothing in an empty listing, which is why a tier proves this row by installing a file", () => {
    expect(findUnclaimedFiles([], register)).toEqual([]);
  });

  it("claims a file once however many rows name it, since what it answers is what no row claims", () => {
    const one = claimed[0] ?? "";
    expect(findUnclaimedFiles([one, one], register)).toEqual([]);
  });
});
