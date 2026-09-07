import { Refusal } from "../contract/index.js";
import _roundToTenth from "./_roundToTenth.js";
import computeBudget from "./computeBudget.js";

/** A fresh measurement of one entry, on a named class of machine. */
export type Measurement = {
  /** A machine class, never a hostname. */
  readonly class: string;
  /** The p95 of the measured windows, in seconds. */
  readonly p95: number;
};

// A header line is recognised by shape and never by a TOML parse: the
// rebudget keeps every other byte of the text, layout included, which a
// parse and a re-serialisation would not.
const HEADER = /^\s*\[\s*([^\]]*?)\s*\]\s*(?:#.*)?\r?$/;
const RUN_S_KEY = /^\s*run_s\s*=/;
// A quoted string inside the table may carry a brace, and the register
// admits one in a class, so the table ends at the first brace outside a
// string and never at the first brace.
const RUN_S_TABLE =
  /^(?<prefix>\s*run_s\s*=\s*)(?<table>\{(?:[^"}]|"[^"]*")*\})(?<tail>.*\r?)$/;

/** Characters a TOML basic string cannot carry without escaping. */
const UNWRITABLE = /["\\\p{Cc}]/u;

const findHeader = (line: string) => HEADER.exec(line)?.at(1);

/**
 * Writes a measurement into the register text as the `run_s` of one row, and
 * changes nothing else: the inline table is replaced, keeping the key, its
 * spacing and whatever follows the table on the line, and every other byte
 * of the text is kept, so the result is a diff a reviewer reads in one
 * glance.
 *
 * The scan runs from the row's header line to the next header, and only a
 * line that is a header ends it — the `[` opening a list on a `build` line
 * does not. Nothing here parses the result; the caller that writes the file
 * parses what it wrote, so the rule for what a well-formed row is stays in
 * one place and this domain depends on nothing above it. What it does
 * refuse is the pair it can see would be declined: a p95 that rounds to
 * nothing, a class no TOML string carries, a `run_s` that is not the inline
 * table the register reads.
 *
 * @throws Refusal when the p95 is not a measurement or rounds to zero, when
 * the class cannot be written as a TOML string, when no `[id]` header is in
 * the text, when the row has no `run_s` line to replace, or when that line
 * does not carry an inline table.
 */
export default function rewriteRunBudget(
  text: string,
  id: string,
  measurement: Measurement,
): string {
  const budget = computeBudget(measurement.p95);
  if (measurement.class === "" || UNWRITABLE.test(measurement.class)) {
    throw new Refusal(
      `a class of ${JSON.stringify(measurement.class)} cannot be written into the register — a machine class is a plain word`,
    );
  }
  const rounded = _roundToTenth(measurement.p95);
  if (rounded === 0) {
    throw new Refusal(
      `a p95 of ${measurement.p95} rounds to nothing — the register admits a measurement above zero, and a tenth of a second is the least it records`,
    );
  }

  const lines = text.split("\n");
  const header = lines.findIndex((line) => findHeader(line) === id);
  if (header === -1) {
    throw new Refusal(`no table [${id}] in the register`);
  }

  for (const [offset, line] of lines.slice(header + 1).entries()) {
    if (findHeader(line) !== undefined) break;
    if (!RUN_S_KEY.test(line)) continue;
    const match = RUN_S_TABLE.exec(line);
    if (match === null) {
      throw new Refusal(
        `table [${id}] writes run_s as something other than an inline table { class, p95, budget }, and a line the register would not read is not replaced blind`,
      );
    }
    const groups = match.groups;
    /* v8 ignore next 9 -- no group in RUN_S_TABLE is optional, so a match binds all three; the guard states that at runtime, where the type would have written the word `undefined` into the register instead */
    if (
      groups === undefined ||
      groups.prefix === undefined ||
      groups.tail === undefined
    ) {
      throw new Error(
        "a run_s line matched without its prefix and tail — the pattern has no optional group, so this cannot be a match",
      );
    }
    const { prefix, tail } = groups;
    lines[header + 1 + offset] =
      `${prefix}{ class = "${measurement.class}", p95 = ${rounded}, budget = ${budget} }${tail}`;
    return lines.join("\n");
  }
  throw new Refusal(`table [${id}] has no run_s line to replace`);
}
