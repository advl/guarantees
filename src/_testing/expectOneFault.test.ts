import { describe, expect, it } from "vitest";

import expectOneFault from "./expectOneFault.js";
import { renderRegister, renderRow } from "./fixtures.js";

const SENTINEL = renderRow("corpus-can-fail", { expect: `"fail"` });

describe("expectOneFault", () => {
  it("passes on a register refused for exactly the fault named", () => {
    expectOneFault(
      renderRegister([renderRow("a", { kind: `"smoke"` }), SENTINEL]),
      { table: "a", column: "kind", reason: /is not one of/ },
    );
  });

  it("fails on a register that parses", () => {
    expect(() =>
      expectOneFault(renderRegister([renderRow("a"), SENTINEL]), {
        table: "a",
        column: "kind",
        reason: /is not one of/,
      }),
    ).toThrow("expected a RegisterRefusal and nothing was thrown");
  });

  it("fails on a register refused for two faults, even when one is the fault named", () => {
    expect(() =>
      expectOneFault(
        renderRegister([
          renderRow("a", { kind: `"smoke"`, tier: `"weekly"` }),
          SENTINEL,
        ]),
        { table: "a", column: "kind", reason: /is not one of/ },
      ),
    ).toThrow();
  });

  it("fails when the one fault is not the one named", () => {
    expect(() =>
      expectOneFault(
        renderRegister([renderRow("a", { kind: `"smoke"` }), SENTINEL]),
        { table: "a", column: "tier", reason: /is not one of/ },
      ),
    ).toThrow();
  });
});
