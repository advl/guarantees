import { describe, expect, it } from "vitest";

import { EXIT_CODES } from "../contract/index.js";
import { worstCode } from "./index.js";

describe("worstCode", () => {
  it("answers green where every code is green, which is a tier with nothing to report", () => {
    expect(worstCode([EXIT_CODES.green, EXIT_CODES.green])).toBe(
      EXIT_CODES.green,
    );
  });

  it("answers red where one code is red, since one failing row fails the tier", () => {
    expect(worstCode([EXIT_CODES.green, EXIT_CODES.red])).toBe(EXIT_CODES.red);
  });

  it("answers refused over red, since a run nobody judged is not a run that passed", () => {
    expect(
      worstCode([EXIT_CODES.red, EXIT_CODES.refused, EXIT_CODES.green]),
    ).toBe(EXIT_CODES.refused);
  });

  it("answers green for no codes at all, which is a schedule that ran nothing", () => {
    expect(worstCode([])).toBe(EXIT_CODES.green);
  });
});
