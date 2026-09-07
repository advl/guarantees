import { describe, expect, it } from "vitest";

import catchRefusal from "../../_testing/catchRefusal.js";
import {
  PROBE,
  PROBE_READING,
  PROBE_STAMP,
  PROBE_TEXT,
} from "../../_testing/fixtures.js";
import { Refusal } from "../contract/index.js";
import { readProbe } from "./index.js";

/** The probe text with its first reading replaced by `reading`. */
const withReading = (reading: unknown) =>
  JSON.stringify({ ...PROBE, readings: [reading, ...PROBE.readings.slice(1)] });

/** The probe text with its stamp replaced by `stamp`. */
const withStamp = (stamp: unknown) => JSON.stringify({ ...PROBE, stamp });

describe("readProbe", () => {
  it("reads the stamp and every reading of a well-formed probe, in order", () => {
    expect(readProbe(PROBE_TEXT)).toEqual({
      stamp: PROBE_STAMP,
      readings: PROBE.readings,
    });
  });

  it("reads a probe without a stamp as one that left none", () => {
    expect(readProbe(withStamp(undefined)).stamp).toBeNull();
  });

  it.each([
    ["text that is not JSON", "{ readings:", "does not parse"],
    ["a JSON value that is not an object", "[]", "is not an object"],
    [
      "a probe without a contract version",
      JSON.stringify({ ...PROBE, contract: undefined }),
      "`contract` is missing or not a string",
    ],
    [
      "a probe on another contract version",
      JSON.stringify({ ...PROBE, contract: "0" }),
      '`contract` is "0", and this package reads contract "1"',
    ],
    [
      "a probe with a key the shape does not carry",
      JSON.stringify({ ...PROBE, host: "x" }),
      "the probe: `host` is not a key a probe carries (contract, stamp, readings)",
    ],
    [
      "a probe without readings",
      JSON.stringify({ ...PROBE, readings: undefined }),
      "`readings` is missing",
    ],
    [
      "readings that are not a list",
      JSON.stringify({ ...PROBE, readings: {} }),
      "`readings` is missing or not a list",
    ],
    [
      "an empty list of readings",
      JSON.stringify({ ...PROBE, readings: [] }),
      "`readings` is empty",
    ],
    ["a stamp that is not an object", withStamp(1), "`stamp` is not an object"],
    [
      "a stamp with a key the shape does not carry",
      withStamp({ ...PROBE_STAMP, host: "x" }),
      "stamp: `host` is not a key a stamp carries (instrument, at)",
    ],
    [
      "a stamp without an instrument",
      withStamp({ ...PROBE_STAMP, instrument: "" }),
      "stamp: `instrument` is missing or not a non-empty string",
    ],
    [
      "a stamp without a time",
      withStamp({ ...PROBE_STAMP, at: undefined }),
      "stamp: `at` is missing or not a non-empty string",
    ],
    ["a reading that is not an object", withReading(7), "is not an object"],
    [
      "a reading with a key the shape does not carry",
      withReading({ ...PROBE_READING, budget: 1 }),
      "`budget` is not a key a reading carries",
    ],
    [
      "a reading spelled as name, unit and value",
      withReading({ name: "bundle-size", unit: "bytes", value: 1 }),
      "`name` is not a key a reading carries (metric, value, units, phase, fixture, class)",
    ],
    [
      "a reading without a value",
      withReading({ ...PROBE_READING, value: undefined }),
      "`value` is missing or not a finite number",
    ],
    [
      "a reading whose value is not a number",
      withReading({ ...PROBE_READING, value: "12" }),
      "`value` is missing or not a finite number",
    ],
    [
      "a reading without a phase",
      withReading({ ...PROBE_READING, phase: undefined }),
      "`phase` is missing or not one of cold | warm",
    ],
    [
      "a reading with a phase outside cold and warm",
      withReading({ ...PROBE_READING, phase: "hot" }),
      "`phase` is missing or not one of cold | warm",
    ],
    [
      "a reading without a metric",
      withReading({ ...PROBE_READING, metric: undefined }),
      "`metric` is missing or not a non-empty string",
    ],
    [
      "a reading with an empty metric",
      withReading({ ...PROBE_READING, metric: "" }),
      "`metric` is missing or not a non-empty string",
    ],
    [
      "a reading whose units are not a string",
      withReading({ ...PROBE_READING, units: 1 }),
      "`units` is missing or not a non-empty string",
    ],
    [
      "a reading without a fixture",
      withReading({ ...PROBE_READING, fixture: undefined }),
      "`fixture` is missing or not a non-empty string",
    ],
    [
      "a reading without a machine class",
      withReading({ ...PROBE_READING, class: undefined }),
      "`class` is missing or not a non-empty string",
    ],
  ])("refuses %s", (_, text, reason) => {
    expect(() => readProbe(text)).toThrow(Refusal);
    expect(() => readProbe(text)).toThrow(reason);
  });

  it("names the reading it refuses by position", () => {
    const text = JSON.stringify({
      ...PROBE,
      readings: [PROBE_READING, { ...PROBE_READING, value: Number.NaN }],
    });
    const refusal = catchRefusal(Refusal, () => readProbe(text));
    expect(refusal.message).toContain("readings[1]");
  });
});
