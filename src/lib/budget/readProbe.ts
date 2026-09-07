import { CONTRACT_VERSION, probeSchema, Refusal } from "../contract/index.js";

/**
 * The shape of the probe is read from its schema, so an entry written in
 * another language against the emitted file and this reader agree on every
 * key, at the root and inside a reading, and on the phase vocabulary, from
 * one definition.
 */
const ROOT_KEYS: readonly string[] = Object.keys(probeSchema.properties);
const STAMP_KEYS: readonly string[] = probeSchema.$defs.stamp.required;
const KEYS: readonly string[] = probeSchema.$defs.reading.required;
const PHASES = probeSchema.$defs.phase.enum;

export type Phase = (typeof PHASES)[number];

/**
 * One number a measuring entry produced, with everything needed to compare
 * it to another: what was measured, in what unit, in which phase, against
 * which fixture, on which class of machine.
 */
export type Reading = {
  readonly metric: string;
  readonly value: number;
  readonly units: string;
  readonly phase: Phase;
  readonly fixture: string;
  /** A machine class, never a hostname. */
  readonly class: string;
};

/** Where the readings came from: what took them, and when it says it did. */
export type Stamp = {
  readonly instrument: string;
  readonly at: string;
};

/** What a measuring entry wrote: its readings, and the stamp if it left one. */
export type Probe = {
  readonly stamp: Stamp | null;
  readonly readings: readonly Reading[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPhase = (value: unknown): value is Phase =>
  typeof value === "string" && (PHASES as readonly string[]).includes(value);

const refuseUnknownKeys = (
  record: Record<string, unknown>,
  keys: readonly string[],
  at: string,
  carrier: string,
) => {
  for (const key of Object.keys(record)) {
    if (!keys.includes(key)) {
      throw new Refusal(
        `${at}: \`${key}\` is not a key ${carrier} carries (${keys.join(", ")})`,
      );
    }
  }
};

const requireString = (
  record: Record<string, unknown>,
  key: string,
  at: string,
): string => {
  const value = record[key];
  if (typeof value !== "string" || value === "") {
    throw new Refusal(`${at}: \`${key}\` is missing or not a non-empty string`);
  }
  return value;
};

const readStamp = (value: unknown): Stamp | null => {
  if (value === undefined) return null;
  if (!isRecord(value)) throw new Refusal("`stamp` is not an object");
  refuseUnknownKeys(value, STAMP_KEYS, "stamp", "a stamp");
  return {
    instrument: requireString(value, "instrument", "stamp"),
    at: requireString(value, "at", "stamp"),
  };
};

const readReading = (value: unknown, index: number): Reading => {
  const at = `readings[${index}]`;
  if (!isRecord(value)) throw new Refusal(`${at} is not an object`);
  refuseUnknownKeys(value, KEYS, at, "a reading");
  const measured = value.value;
  if (typeof measured !== "number" || !Number.isFinite(measured)) {
    throw new Refusal(`${at}: \`value\` is missing or not a finite number`);
  }
  const phase = value.phase;
  if (!isPhase(phase)) {
    throw new Refusal(
      `${at}: \`phase\` is missing or not one of ${PHASES.join(" | ")}`,
    );
  }
  return {
    metric: requireString(value, "metric", at),
    value: measured,
    units: requireString(value, "units", at),
    phase,
    fixture: requireString(value, "fixture", at),
    class: requireString(value, "class", at),
  };
};

/**
 * Reads the probe a measuring entry wrote, or refuses it.
 *
 * The probe is `{ "contract": "1", "stamp": { … }, "readings": [ … ] }`, the
 * stamp optional, each reading carrying exactly a metric, a value, its
 * units, a phase, a fixture and a machine class. Nothing is tolerated: a
 * version other than the one this package reads, a key the root, the stamp
 * or a reading does not carry, a key missing, empty or mistyped, a value
 * that is not finite, or a phase outside the vocabulary refuses the whole
 * probe, because a budget resting on a reading that cannot be compared to
 * the next one is an opinion with a number on it.
 *
 * @throws Refusal naming the first fault found.
 */
export default function readProbe(text: string): Probe {
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch (error) {
    throw new Refusal(`the probe does not parse: ${String(error)}`);
  }
  if (!isRecord(document)) throw new Refusal("the probe is not an object");
  refuseUnknownKeys(document, ROOT_KEYS, "the probe", "a probe");
  const contract = document.contract;
  if (typeof contract !== "string") {
    throw new Refusal(
      "`contract` is missing or not a string — a probe names the contract version it is written against",
    );
  }
  if (contract !== CONTRACT_VERSION) {
    throw new Refusal(
      `\`contract\` is "${contract}", and this package reads contract "${CONTRACT_VERSION}" — a probe on another version is not read as this one`,
    );
  }
  const readings = document.readings;
  if (!Array.isArray(readings)) {
    throw new Refusal("`readings` is missing or not a list");
  }
  if (readings.length === 0) {
    throw new Refusal(
      "`readings` is empty — a measuring entry owes at least one reading",
    );
  }
  return {
    stamp: readStamp(document.stamp),
    readings: readings.map(readReading),
  };
}
