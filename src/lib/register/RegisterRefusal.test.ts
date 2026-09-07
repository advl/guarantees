import { describe, expect, it } from "vitest";

import { Refusal } from "../contract/index.js";
import { RegisterRefusal } from "./index.js";

describe("RegisterRefusal", () => {
  it("lists every fault as table, column, reason and line, as a refusal", () => {
    const refusal = new RegisterRefusal([
      { table: "a", column: "kind", reason: "is missing", line: 3 },
      { table: "pr", reason: "holds no row designed to fail" },
      { table: "", reason: "does not parse", line: 1 },
    ]);
    expect(refusal).toBeInstanceOf(Error);
    expect(refusal).toBeInstanceOf(Refusal);
    expect(refusal.name).toBe("RegisterRefusal");
    expect(refusal.faults).toHaveLength(3);
    expect(refusal.message).toBe(
      [
        "the register holds 3 faults:",
        "[a] kind — is missing (line 3)",
        "[pr] — holds no row designed to fail",
        "the register — does not parse (line 1)",
      ].join("\n"),
    );
  });

  it("counts one fault in the singular", () => {
    const refusal = new RegisterRefusal([{ table: "a", reason: "is odd" }]);
    expect(refusal.message).toBe("the register holds 1 fault:\n[a] — is odd");
  });
});
