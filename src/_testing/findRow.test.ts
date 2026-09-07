import { describe, expect, it } from "vitest";

import { parseRegister } from "../lib/register/index.js";
import findRow from "./findRow.js";
import { PIPELINE, REGISTER_ONE_IMAGE } from "./fixtures.js";

const rows = parseRegister(REGISTER_ONE_IMAGE, PIPELINE);

describe("findRow", () => {
  it("returns the row the register holds under the id", () => {
    expect(findRow(rows, "corpus-image").id).toBe("corpus-image");
  });

  it("fails naming the id when the register holds no such row", () => {
    expect(() => findRow(rows, "corpus-missing")).toThrow(
      "no fixture row corpus-missing",
    );
  });
});
