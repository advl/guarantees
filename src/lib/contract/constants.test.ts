import { describe, expect, it } from "vitest";

import {
  CONTRACT_VERSION,
  EXIT_CODES,
  labelSchema,
  markerSchema,
  probeSchema,
  registerSchema,
  reportSchema,
} from "./index.js";

const DRAFT = "https://json-schema.org/draft/2020-12/schema";

describe("contract", () => {
  describe("CONTRACT_VERSION", () => {
    it("is the first version, and the register schema carries it as data", () => {
      expect(CONTRACT_VERSION).toBe("1");
      expect(registerSchema.$defs.version.const).toBe(CONTRACT_VERSION);
    });

    it("is what a validator holds a register's header and a probe to, so a document on another version fails the emitted file as it fails the parser", () => {
      expect(registerSchema.$defs.header.properties.contract.$ref).toBe(
        "#/$defs/version",
      );
      expect(probeSchema.properties.contract.const).toBe(CONTRACT_VERSION);
    });
  });

  describe("EXIT_CODES", () => {
    it("distinguishes a refusal from a red verdict, and the register schema carries them as data", () => {
      expect(EXIT_CODES).toEqual({ green: 0, red: 1, refused: 2 });
      expect(registerSchema.$defs.exitCodes.const).toEqual(EXIT_CODES);
    });
  });

  describe("registerSchema", () => {
    it("is a draft 2020-12 schema keyed by register id, with one header table beside the rows", () => {
      expect(registerSchema.$schema).toBe(DRAFT);
      expect(registerSchema.propertyNames).toEqual({
        anyOf: [{ const: "corpus" }, { $ref: "#/$defs/id" }],
      });
      expect(registerSchema.additionalProperties).toEqual({
        $ref: "#/$defs/row",
      });
    });

    it("requires the eleven columns of a row and admits no other", () => {
      expect(registerSchema.$defs.row.required).toEqual([
        "kind",
        "tier",
        "file",
        "select",
        "build",
        "image",
        "isolation",
        "holds",
        "teardown",
        "expect",
        "run_s",
      ]);
      expect(Object.keys(registerSchema.$defs.row.properties)).toEqual([
        ...registerSchema.$defs.row.required,
      ]);
      expect(registerSchema.$defs.row.additionalProperties).toBe(false);
    });

    it("admits an optional header table holding only the contract version, defaulting to the first", () => {
      expect(registerSchema.properties.corpus).toEqual({
        $ref: "#/$defs/header",
      });
      expect(Object.keys(registerSchema.$defs.header.properties)).toEqual([
        "contract",
      ]);
      expect(registerSchema.$defs.header.properties.contract.default).toBe("1");
      expect(registerSchema.$defs.header.additionalProperties).toBe(false);
    });

    it("spells the vocabulary of kind, tier, isolation and expect", () => {
      expect(registerSchema.$defs.kind.enum).toEqual([
        "oracle",
        "determinism",
        "conformance",
        "golden",
        "budget",
        "compat",
        "perf",
      ]);
      expect(registerSchema.$defs.tier.enum).toEqual([
        "pr",
        "merge",
        "nightly",
        "release",
      ]);
      expect(registerSchema.$defs.isolation.enum).toEqual([
        "image",
        "image-net",
      ]);
      expect(registerSchema.$defs.expect.enum).toEqual(["pass", "fail"]);
    });

    it("carries the kinds that pool as data, each one a kind", () => {
      const pooled = registerSchema.$defs.pooledKinds.const;
      expect(pooled).toEqual(["conformance", "oracle", "determinism"]);
      for (const kind of pooled) {
        expect(registerSchema.$defs.kind.enum).toContain(kind);
      }
    });

    it("admits an id of lowercase letters, digits and hyphens, and reserves the header and reports", () => {
      const id = new RegExp(registerSchema.$defs.id.pattern);
      expect(id.test("corpus-bijection")).toBe(true);
      expect(id.test("9lives")).toBe(true);
      expect(id.test("Corpus")).toBe(false);
      expect(id.test("-leading")).toBe(false);
      expect(id.test("a.b")).toBe(false);
      expect(registerSchema.$defs.id.not.enum).toEqual(["corpus", "reports"]);
    });

    it("admits only a digest-pinned image", () => {
      const image = new RegExp(registerSchema.$defs.image.pattern);
      expect(
        image.test(`ghcr.io/example/guarantees-ts@sha256:${"0".repeat(64)}`),
      ).toBe(true);
      expect(image.test("ghcr.io/example/guarantees-ts:latest")).toBe(false);
      expect(image.test("ghcr.io/example/guarantees-ts@sha256:abc")).toBe(
        false,
      );
      expect(
        image.test(`ghcr.io/example/guarantees-ts@sha256:${"A".repeat(64)}`),
      ).toBe(false);
    });

    it("admits a relative file inside the tree on one line, whatever its suffix", () => {
      const file = new RegExp(registerSchema.$defs.file.pattern);
      expect(file.test("corpus-bijection.test.ts")).toBe(true);
      expect(file.test("selftest/corpus-can-fail.test.ts")).toBe(true);
      expect(file.test("tests/journal_replay.rs")).toBe(true);
      expect(file.test("/tmp/x.test.ts")).toBe(false);
      expect(file.test("../packages/x.test.ts")).toBe(false);
      expect(file.test("a/../x.test.ts")).toBe(false);
      expect(file.test("a\n.test.ts")).toBe(false);
    });

    it("states every limit once, and holds a budget to the floor and to its tier's ceiling from them", () => {
      const limits = registerSchema.$defs.limits.const;
      expect(limits).toEqual({
        ceilings: {
          pr: { entry: 60, wall: 300 },
          merge: { entry: 900, wall: 900 },
          nightly: { entry: 3600, wall: 3600 },
        },
        unmeasuredS: 600,
        budget: {
          floorS: 10,
          headroom: 1.5,
          killMultiplier: 3,
          runs: 5,
          p95: "nearest-rank",
        },
      });
      expect(registerSchema.$defs.run_s.properties.budget.minimum).toBe(
        limits.budget.floorS,
      );
      expect(registerSchema.$defs.run_s.properties.p95.exclusiveMinimum).toBe(
        0,
      );
      expect(registerSchema.$defs.run_s.required).toEqual([
        "class",
        "p95",
        "budget",
      ]);
      const maxima = registerSchema.$defs.row.allOf.map((clause) => [
        clause.if.properties.tier.const,
        clause.then.properties.run_s.properties.budget.maximum,
      ]);
      expect(maxima).toEqual(
        Object.entries(limits.ceilings).map(([tier, { entry }]) => [
          tier,
          entry,
        ]),
      );
    });

    it("says of itself that it is necessary and not sufficient", () => {
      expect(registerSchema.description).toContain(
        "necessary and not sufficient",
      );
    });
  });

  describe("reportSchema", () => {
    it("requires the three counts and the assertion list, and tolerates more", () => {
      expect(reportSchema.$schema).toBe(DRAFT);
      expect(reportSchema.required).toEqual([
        "numTotalTests",
        "numPassedTests",
        "numFailedTests",
        "testResults",
      ]);
      expect(reportSchema.additionalProperties).toBe(true);
      const assertion =
        reportSchema.properties.testResults.items.properties.assertionResults
          .items;
      expect(assertion.required).toEqual(["title", "fullName", "status"]);
      expect(assertion.properties.status.enum).toEqual([
        "passed",
        "failed",
        "skipped",
        "pending",
        "disabled",
      ]);
    });
  });

  describe("probeSchema", () => {
    it("requires the contract version and at least one reading, and admits a stamp naming the instrument and the time", () => {
      expect(probeSchema.$schema).toBe(DRAFT);
      expect(probeSchema.required).toEqual(["contract", "readings"]);
      expect(Object.keys(probeSchema.properties)).toEqual([
        "contract",
        "stamp",
        "readings",
      ]);
      expect(probeSchema.additionalProperties).toBe(false);
      expect(probeSchema.$defs.stamp.required).toEqual(["instrument", "at"]);
      expect(probeSchema.$defs.stamp.additionalProperties).toBe(false);
      expect(probeSchema.properties.readings.minItems).toBe(1);
      const reading = probeSchema.$defs.reading;
      expect(reading.required).toEqual([
        "metric",
        "value",
        "units",
        "phase",
        "fixture",
        "class",
      ]);
      expect(Object.keys(reading.properties)).toEqual([...reading.required]);
      expect(reading.additionalProperties).toBe(false);
      expect(probeSchema.$defs.phase.enum).toEqual(["cold", "warm"]);
    });
  });

  describe("markerSchema", () => {
    it("names the entry, when it started and which process", () => {
      expect(markerSchema.$schema).toBe(DRAFT);
      expect(markerSchema.required).toEqual(["id", "startedAt", "pid"]);
      expect(markerSchema.properties.id).toEqual(registerSchema.$defs.id);
      expect(markerSchema.additionalProperties).toBe(false);
    });
  });

  describe("labelSchema", () => {
    it("names the checkout and the entry", () => {
      expect(labelSchema.$schema).toBe(DRAFT);
      expect(labelSchema.required).toEqual(["corpus", "entry"]);
      expect(labelSchema.properties.entry).toEqual(registerSchema.$defs.id);
      expect(
        new RegExp(labelSchema.properties.corpus.pattern).test("0123456789ab"),
      ).toBe(true);
      expect(labelSchema.additionalProperties).toBe(false);
    });
  });
});
