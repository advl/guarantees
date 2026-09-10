import { describe, expect, it } from "vitest";

import catchRefusal from "../../_testing/catchRefusal.js";
import {
  IMAGE_A,
  IMAGE_B,
  PIPELINE,
  renderRegister,
  renderRow,
} from "../../_testing/fixtures.js";
import { Refusal } from "../contract/index.js";
import { parseRegister } from "../register/index.js";
import { listTierImages } from "./index.js";

const register = parseRegister(
  renderRegister([
    renderRow("corpus-bijection", { image: `"${IMAGE_A}"` }),
    renderRow("corpus-image", { image: `"${IMAGE_B}"` }),
    renderRow("corpus-can-fail", {
      image: `"${IMAGE_A}"`,
      file: `"selftest/corpus-can-fail.test.ts"`,
      expect: `"fail"`,
    }),
  ]),
  PIPELINE,
);

describe("listTierImages", () => {
  it("answers each image once, in the order the register names them", () => {
    expect(listTierImages(register, "pr")).toEqual([IMAGE_A, IMAGE_B]);
  });

  it("refuses a tier the register holds nothing at, rather than answering none", () => {
    expect(
      catchRefusal(Refusal, () => listTierImages(register, "nightly")).message,
    ).toContain("holds no rows");
  });
});
