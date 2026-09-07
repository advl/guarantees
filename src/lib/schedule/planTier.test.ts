import { describe, expect, it } from "vitest";

import findRow from "../../_testing/findRow.js";
import {
  PIPELINE,
  REGISTER_ONE_IMAGE,
  REGISTER_TWO_IMAGES,
} from "../../_testing/fixtures.js";
import { Refusal } from "../contract/index.js";
import {
  KINDS,
  type Kind,
  POOLED_KINDS,
  parseRegister,
  type Row,
} from "../register/index.js";
import { planTier } from "./index.js";

const rows = parseRegister(REGISTER_TWO_IMAGES, PIPELINE);
const listIds = (planned: readonly Row[]) => planned.map((row) => row.id);

/** A pr register of one row per kind given, in that order, and the sentinel last. */
const registerOfKinds = (kinds: readonly Kind[]) => {
  const base = findRow(rows, "corpus-bijection");
  const sentinel = findRow(rows, "corpus-can-fail");
  return new Map<string, Row>([
    ...kinds.map((kind, index): [string, Row] => [
      `${kind}-${index}`,
      { ...base, id: `${kind}-${index}`, kind },
    ]),
    ["corpus-can-fail", sentinel],
  ]);
};

describe("planTier", () => {
  it("pools the pr conformance and oracle rows and serializes the golden and budget rows after them", () => {
    const plan = planTier(rows, "pr");
    expect(listIds(plan.pool)).toEqual([
      "corpus-bijection",
      "teardown-completeness",
      "corpus-can-fail",
    ]);
    expect(listIds(plan.serial)).toEqual(["surface-closure", "bundle-size"]);
  });

  it("serializes a merge row that holds resources and pools the rest", () => {
    const plan = planTier(rows, "merge");
    expect(listIds(plan.pool)).toEqual(["merge-can-fail"]);
    expect(listIds(plan.serial)).toEqual(["examples-run"]);
  });

  it.each([
    "conformance",
    "oracle",
    "determinism",
  ] as const)("pools a %s row", (kind) => {
    const plan = planTier(registerOfKinds([kind]), "pr");
    expect(listIds(plan.pool)).toEqual([`${kind}-0`, "corpus-can-fail"]);
    expect(plan.serial).toEqual([]);
  });

  it.each([
    "golden",
    "budget",
    "compat",
    "perf",
  ] as const)("serializes a %s row", (kind) => {
    const plan = planTier(registerOfKinds([kind]), "pr");
    expect(listIds(plan.pool)).toEqual(["corpus-can-fail"]);
    expect(listIds(plan.serial)).toEqual([`${kind}-0`]);
  });

  it("pools exactly the kinds the register schema names as pooled, and serializes every other", () => {
    // The named cases above are what a caller observes; this one is the
    // pin that the plan follows the schema's partition rather than a copy
    // of it, so a kind moved between the lists moves here without an edit.
    const plan = planTier(registerOfKinds(KINDS), "pr");
    expect(plan.pool.map((row) => row.kind)).toEqual([
      ...KINDS.filter((kind) => POOLED_KINDS.includes(kind)),
      "conformance",
    ]);
    expect(plan.serial.map((row) => row.kind)).toEqual(
      KINDS.filter((kind) => !POOLED_KINDS.includes(kind)),
    );
  });

  it("keeps register order inside the pool and inside the serial list", () => {
    const plan = planTier(
      registerOfKinds([
        "perf",
        "conformance",
        "compat",
        "oracle",
        "golden",
        "determinism",
        "budget",
      ]),
      "pr",
    );
    expect(listIds(plan.pool)).toEqual([
      "conformance-1",
      "oracle-3",
      "determinism-5",
      "corpus-can-fail",
    ]);
    expect(listIds(plan.serial)).toEqual([
      "perf-0",
      "compat-2",
      "golden-4",
      "budget-6",
    ]);
  });

  it("refuses a tier with no rows", () => {
    const one = parseRegister(REGISTER_ONE_IMAGE, PIPELINE);
    expect(() => planTier(one, "nightly")).toThrow(Refusal);
    expect(() => planTier(one, "nightly")).toThrow(
      "the nightly tier holds no rows",
    );
  });

  it("refuses a tier with no row designed to fail", () => {
    const base = findRow(rows, "corpus-bijection");
    const register = new Map<string, Row>([
      ["a", { ...base, id: "a", tier: "merge" }],
      ["b", { ...base, id: "b", tier: "merge" }],
    ]);
    expect(() => planTier(register, "merge")).toThrow(Refusal);
    expect(() => planTier(register, "merge")).toThrow(
      'the merge tier holds no row marked `expect = "fail"`',
    );
  });
});
