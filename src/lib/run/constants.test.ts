import { describe, expect, it } from "vitest";

import { labelSchema, registerSchema } from "../contract/index.js";
import { RESERVED_IDS } from "../register/index.js";
import { REPORTS_DIR, WORK_DIR, WORKSPACE } from "../runner/index.js";
import {
  CORPUS_LABEL,
  ENTRY_LABEL,
  KILL_MULTIPLIER,
  NAME_PREFIX,
  TASK_FACE,
} from "./index.js";

describe("run constants", () => {
  it("keep the lifted reports under an id no row may take", () => {
    expect(RESERVED_IDS).toContain(REPORTS_DIR);
  });

  it("label containers by exactly the keys the contract's label schema declares", () => {
    expect([CORPUS_LABEL, ENTRY_LABEL]).toEqual(
      Object.keys(labelSchema.properties),
    );
    expect([CORPUS_LABEL, ENTRY_LABEL]).toEqual(labelSchema.required);
  });

  it("read the kill multiplier from the register schema's limits", () => {
    expect(KILL_MULTIPLIER).toBe(
      registerSchema.$defs.limits.const.budget.killMultiplier,
    );
    expect(KILL_MULTIPLIER).toBe(3);
  });

  it("build a container name the engine accepts from the prefix, an id, a phase and a nonce", () => {
    const name = [NAME_PREFIX, "corpus-bijection", "measured", "4242"].join(
      "-",
    );
    expect(name).toMatch(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/);
  });

  it("run recipes through a task face of one binary and its subcommand, under an absolute workspace", () => {
    expect(TASK_FACE).toEqual(["bun", "run"]);
    expect(WORKSPACE.startsWith("/")).toBe(true);
    expect(WORK_DIR).toBe(".work");
  });
});
