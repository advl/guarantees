import { describe, expect, it } from "vitest";

import { PIPELINE, REGISTER_ONE_IMAGE } from "../../_testing/fixtures.js";
import { parseRegister } from "../register/index.js";
import findUncollectedRows from "./findUncollectedRows.js";

const register = parseRegister(REGISTER_ONE_IMAGE, PIPELINE);
const collected = [...register.values()].map((row) => row.file);

describe("findUncollectedRows", () => {
  it("finds nothing where the runner would collect every row's file", () => {
    expect(findUncollectedRows(collected, register)).toEqual([]);
  });

  it("names each row the runner would not reach, with the file it promises, in register order", () => {
    expect(findUncollectedRows(collected.slice(0, 2), register)).toEqual([
      "corpus-image -> corpus-image.test.ts",
      "corpus-toolchain -> corpus-toolchain.test.ts",
      "corpus-can-fail -> selftest/corpus-can-fail.test.ts",
    ]);
  });

  it("names every row when the runner would collect nothing, so an empty listing cannot read as a clean corpus", () => {
    expect(findUncollectedRows([], register)).toHaveLength(register.size);
  });
});
