import { describe, expect, it } from "vitest";

import { EXIT_CODES, Refusal } from "../contract/index.js";
import { toExitCode } from "./index.js";

describe("toExitCode", () => {
  it("maps a green verdict to the contract's green code", () => {
    expect(toExitCode({ ok: true, reason: "2 passed" })).toBe(EXIT_CODES.green);
    expect(toExitCode({ ok: true, reason: "2 passed" })).toBe(0);
  });

  it("maps a red verdict to the contract's red code", () => {
    expect(toExitCode({ ok: false, reason: "1 failed" })).toBe(EXIT_CODES.red);
    expect(toExitCode({ ok: false, reason: "1 failed" })).toBe(1);
  });

  it("maps a refusal to the contract's refused code", () => {
    expect(toExitCode(new Refusal("declined"))).toBe(EXIT_CODES.refused);
    expect(toExitCode(new Refusal("declined"))).toBe(2);
  });
});
