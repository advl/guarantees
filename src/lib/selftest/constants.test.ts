import { describe, expect, it } from "vitest";
import {
  _DESIGNED_TITLE,
  _DRIFT_TITLE,
  _INWARD_TITLE,
  _MASK_TITLE,
  _OUTWARD_TITLE,
  _UNCOLLECTED_TITLE,
  _UNRECORDED_TITLE,
  _UNTIED_TITLE,
  _VERSIONS_TITLE,
} from "./constants.js";
import { UNCLAIMED_TITLE } from "./index.js";

const titles = [
  UNCLAIMED_TITLE,
  _UNCOLLECTED_TITLE,
  _OUTWARD_TITLE,
  _INWARD_TITLE,
  _DRIFT_TITLE,
  _UNTIED_TITLE,
  _UNRECORDED_TITLE,
  _MASK_TITLE,
  _VERSIONS_TITLE,
  _DESIGNED_TITLE,
];

describe("selftest constants", () => {
  it("name each assertion once, so no two of a corpus's suites report under one title", () => {
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("name the assertion a proof requires among the failed, in a form a report carries verbatim", () => {
    expect(UNCLAIMED_TITLE).toBe("claims every file the runner would collect");
  });
});
