import { describe, expect, it } from "vitest";

import { computeBudget } from "../budget/index.js";
import { registerSchema } from "../contract/index.js";
import {
  _COLUMNS,
  _EXPECTS,
  _FILE_PATTERN,
  _FLOOR_S,
  _HEADER_TABLE,
  _HEADERLESS_VERSION,
  _HEADROOM,
  _ID_PATTERN,
  _IMAGE_PATTERN,
  _RUN_KEYS,
} from "./constants.js";
import {
  CEILINGS,
  ISOLATIONS,
  KINDS,
  POOLED_KINDS,
  RESERVED_IDS,
  TIERS,
  UNMEASURED_S,
} from "./index.js";

describe("register constants", () => {
  it("spell the vocabulary, the patterns and the numbers the schema publishes", () => {
    expect(KINDS).toEqual(registerSchema.$defs.kind.enum);
    expect(POOLED_KINDS).toEqual(registerSchema.$defs.pooledKinds.const);
    expect(TIERS).toEqual(registerSchema.$defs.tier.enum);
    expect(ISOLATIONS).toEqual(registerSchema.$defs.isolation.enum);
    expect(_EXPECTS).toEqual(registerSchema.$defs.expect.enum);
    expect(RESERVED_IDS).toEqual(registerSchema.$defs.id.not.enum);
    expect(_COLUMNS).toEqual(registerSchema.$defs.row.required);
    expect(_RUN_KEYS).toEqual(registerSchema.$defs.run_s.required);
    expect(_ID_PATTERN.source).toBe(registerSchema.$defs.id.pattern);
    expect(_IMAGE_PATTERN.source).toBe(registerSchema.$defs.image.pattern);
    expect(_FILE_PATTERN.source).toBe(
      new RegExp(registerSchema.$defs.file.pattern).source,
    );
    expect(UNMEASURED_S).toBe(registerSchema.$defs.limits.const.unmeasuredS);
    expect(CEILINGS).toMatchObject(registerSchema.$defs.limits.const.ceilings);
    expect(_FLOOR_S).toBe(registerSchema.$defs.limits.const.budget.floorS);
    expect(_HEADROOM).toBe(registerSchema.$defs.limits.const.budget.headroom);
  });

  it("name the header table the schema binds and reserve it against rows", () => {
    expect(registerSchema.properties).toHaveProperty(_HEADER_TABLE);
    expect(RESERVED_IDS).toContain(_HEADER_TABLE);
  });

  it("pin the numbers a caller relies on, the release tier unbounded", () => {
    expect(UNMEASURED_S).toBe(600);
    expect(CEILINGS).toEqual({
      pr: { entry: 60, wall: 300 },
      merge: { entry: 900, wall: 900 },
      nightly: { entry: 3600, wall: 3600 },
      release: {
        entry: Number.POSITIVE_INFINITY,
        wall: Number.POSITIVE_INFINITY,
      },
    });
  });

  it("read the version a headerless register is on from the schema's default", () => {
    expect(_HEADERLESS_VERSION).toBe(
      registerSchema.$defs.header.properties.contract.default,
    );
    expect(_HEADERLESS_VERSION).toBe("1");
  });

  it("hold the floor the schema states to be the budget of a zero p95", () => {
    expect(registerSchema.$defs.run_s.properties.budget.minimum).toBe(
      computeBudget(0),
    );
    expect(_FLOOR_S).toBe(computeBudget(0));
  });
});
