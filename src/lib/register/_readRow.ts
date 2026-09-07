import { computeBudget } from "../budget/index.js";
import _isTable from "./_isTable.js";
import {
  _COLUMNS,
  _EXPECTS,
  _FILE_PATTERN,
  _FLOOR_S,
  _HEADROOM,
  _IMAGE_PATTERN,
  _RUN_KEYS,
  CEILINGS,
  ISOLATIONS,
  KINDS,
  TIERS,
} from "./constants.js";
import type { _Located, RegisterFault, Row, RunBudget } from "./types.js";

/**
 * Why a file misses the schema's pattern, in the words of the shape that
 * explains the miss. The pattern is the authority — it is what a validator
 * over the emitted file applies — and the shapes are only its explanation,
 * so the two cannot admit different files.
 */
const explainFile = (file: string): string => {
  if (file.startsWith("/")) {
    return `\`${file}\` is absolute — an entry is a file of this corpus, named relative to it`;
  }
  if (file.split("/").includes("..")) {
    return `\`${file}\` leaves the tree — a row reaching out of the corpus schedules something that was never authored as a guarantee`;
  }
  return `${JSON.stringify(file)} is not on one line — a file is named relative to the corpus directory, inside it, as one path`;
};

/**
 * Reads one table as a row, collecting every fault in it rather than
 * stopping at the first: a register is refused wholesale, and a refusal that
 * named one fault per attempt would take as many attempts as there are
 * faults. `row` is the row when nothing was wrong and `null` otherwise.
 * `collects` is the suffix the runner collects, which the caller knows and
 * the register does not.
 */
export default function _readRow(
  id: string,
  table: Record<string, unknown>,
  located: _Located,
  collects: string,
): { readonly row: Row | null; readonly faults: readonly RegisterFault[] } {
  const faults: RegisterFault[] = [];
  const noteFault = (column: string, reason: string) => {
    faults.push({
      table: id,
      column,
      reason,
      line: located.locateColumn(column),
    });
  };

  const readText = (column: string): string | undefined => {
    const value = table[column];
    if (value === undefined) {
      noteFault(
        column,
        `is missing — every row carries the ${_COLUMNS.length} columns`,
      );
      return undefined;
    }
    if (typeof value !== "string") {
      noteFault(column, "is not a string");
      return undefined;
    }
    if (value === "") {
      noteFault(column, "is empty");
      return undefined;
    }
    return value;
  };

  const readWord = <T extends string>(
    column: string,
    vocabulary: readonly T[],
  ): T | undefined => {
    const value = readText(column);
    if (value === undefined) return undefined;
    if (!(vocabulary as readonly string[]).includes(value)) {
      noteFault(column, `\`${value}\` is not one of ${vocabulary.join(" | ")}`);
      return undefined;
    }
    return value as T;
  };

  const readList = (column: string): readonly string[] | undefined => {
    const value = table[column];
    if (value === undefined) {
      noteFault(
        column,
        `is missing — write \`${column} = []\` to say the row needs none`,
      );
      return undefined;
    }
    if (
      !Array.isArray(value) ||
      value.some((item) => typeof item !== "string" || item === "")
    ) {
      noteFault(column, "is not a list of non-empty strings");
      return undefined;
    }
    return value;
  };

  const readRun = (): RunBudget | undefined => {
    const value = table.run_s;
    if (value === undefined) {
      noteFault(
        "run_s",
        "is missing — every row carries a budget from birth, so the hard kill has something to multiply",
      );
      return undefined;
    }
    if (!_isTable(value)) {
      noteFault("run_s", "is not a table of { class, p95, budget }");
      return undefined;
    }
    for (const key of Object.keys(value)) {
      if (!_RUN_KEYS.includes(key)) {
        noteFault(
          "run_s",
          `\`${key}\` is not a key run_s carries (${_RUN_KEYS.join(", ")})`,
        );
      }
    }
    const klass = value.class;
    const p95 = value.p95;
    const budget = value.budget;
    const named = typeof klass === "string" && klass !== "" ? klass : undefined;
    if (named === undefined) {
      noteFault(
        "run_s",
        "class is missing or empty — a budget records a machine class, never a hostname",
      );
    }
    const measured =
      typeof p95 === "number" && Number.isFinite(p95) && p95 > 0
        ? p95
        : undefined;
    if (measured === undefined) {
      noteFault(
        "run_s",
        "p95 is missing or not a number above zero — it is the measurement the budget came from",
      );
    }
    const whole =
      typeof budget === "number" && Number.isInteger(budget) && budget > 0
        ? budget
        : undefined;
    if (whole === undefined) {
      noteFault(
        "run_s",
        "budget is missing or not a whole number of seconds above zero",
      );
    }
    if (named === undefined || measured === undefined || whole === undefined) {
      return undefined;
    }
    return { class: named, p95: measured, budget: whole };
  };

  for (const key of Object.keys(table)) {
    if (!_COLUMNS.includes(key)) {
      noteFault(
        key,
        `is not a column the register admits — the columns are ${_COLUMNS.join(", ")}, and a twelfth is a typo or a widening the contract has not made`,
      );
    }
  }

  const kind = readWord("kind", KINDS);
  const tier = readWord("tier", TIERS);

  const file = readText("file");
  if (file !== undefined) {
    if (!_FILE_PATTERN.test(file)) {
      noteFault("file", explainFile(file));
    } else if (!file.endsWith(collects)) {
      noteFault(
        "file",
        `\`${file}\` does not end in ${collects} — that suffix is what the runner collects, and a row naming anything else names a file no tier can run`,
      );
    }
  }

  const select = readText("select");
  const build = readList("build");

  const image = readText("image");
  if (image !== undefined && !_IMAGE_PATTERN.test(image)) {
    noteFault(
      "image",
      `\`${image}\` is not pinned as name@sha256:<64 hex digits> — a tag moves, and an entry that ran in a different image than the row names has measured something nobody can name`,
    );
  }

  const isolation = readWord("isolation", ISOLATIONS);
  const holds = readList("holds");
  const teardown = readList("teardown");
  if (
    holds !== undefined &&
    teardown !== undefined &&
    holds.length > 0 &&
    teardown.length === 0
  ) {
    noteFault(
      "teardown",
      `is empty while holds names ${holds.map((held) => `\`${held}\``).join(", ")} — what is held must say how it is released, because teardown runs on the failing path too`,
    );
  }

  const expect = readWord("expect", _EXPECTS);

  const run = readRun();
  if (run !== undefined) {
    const required = computeBudget(run.p95);
    if (run.budget < _FLOOR_S) {
      noteFault(
        "run_s",
        `budget ${run.budget} is below the floor of ${_FLOOR_S} s — below it the number measures process startup rather than the guarantee`,
      );
    } else if (run.budget < required) {
      noteFault(
        "run_s",
        `budget ${run.budget} is below ${required}, the p95 of ${run.p95} times ${_HEADROOM} rounded up — the pair is written by a measurement, never by hand`,
      );
    }
    if (tier !== undefined && run.budget > CEILINGS[tier].entry) {
      noteFault(
        "run_s",
        `budget ${run.budget} is past the ${tier} tier's ${CEILINGS[tier].entry} s ceiling per entry — promote the row to a later tier or make it cheaper`,
      );
    }
  }

  const built: Row | null =
    kind !== undefined &&
    tier !== undefined &&
    file !== undefined &&
    select !== undefined &&
    build !== undefined &&
    image !== undefined &&
    isolation !== undefined &&
    holds !== undefined &&
    teardown !== undefined &&
    expect !== undefined &&
    run !== undefined
      ? {
          id,
          kind,
          tier,
          file,
          select,
          build,
          image,
          isolation,
          holds,
          teardown,
          expect,
          run,
        }
      : null;

  return { row: faults.length === 0 ? built : null, faults };
}
