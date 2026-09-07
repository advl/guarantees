import type { _EXPECTS, ISOLATIONS, KINDS, TIERS } from "./constants.js";

export type Kind = (typeof KINDS)[number];
export type Tier = (typeof TIERS)[number];
export type Isolation = (typeof ISOLATIONS)[number];
export type Expect = (typeof _EXPECTS)[number];

/** A row's `run_s`: the measurement, the machine class it was taken on, and the budget it set. */
export type RunBudget = {
  /** A machine class, never a hostname. */
  readonly class: string;
  /** The measurement the budget came from, in seconds. */
  readonly p95: number;
  /** Whole seconds; the hard kill is the contract's kill multiplier times this. */
  readonly budget: number;
};

/**
 * One guarantee, as the register states it. The property is `run` where the
 * column is `run_s`, because the suffix is the column's unit and a property
 * is named in the house's camel case.
 */
export type Row = {
  readonly id: string;
  readonly kind: Kind;
  readonly tier: Tier;
  /** The test file, relative to the corpus directory. */
  readonly file: string;
  /** How the host runner finds the entry inside its file. */
  readonly select: string;
  readonly build: readonly string[];
  /** The image the run is admissible in, pinned by digest. */
  readonly image: string;
  readonly isolation: Isolation;
  readonly holds: readonly string[];
  readonly teardown: readonly string[];
  readonly expect: Expect;
  readonly run: RunBudget;
};

/** The rows of a register, keyed by id, in the order they are written. */
export type Register = ReadonlyMap<string, Row>;

/** One thing wrong with a register. */
export type RegisterFault = {
  /** The table the fault is in; a tier name for a fault about a tier; empty for the text itself. */
  readonly table: string;
  readonly column?: string;
  readonly reason: string;
  /** The line the parser can point at, one-based. */
  readonly line?: number;
};

/**
 * What the register cannot read for itself and the caller has: the tiers the
 * workflow triggers, the tiers it proves, and the suffix the runner collects.
 * The register never reads the workflow or asks the runner; the caller does,
 * and passes what it found. A tier holding rows and absent from either list
 * is refused — a tier nothing triggers is rows that look scheduled and are
 * not, and a tier nothing proves is a gate never seen to fail — so a caller
 * with no workflow passes empty lists and is refused for every tier it
 * holds, rather than passing nothing and having the guards in the package
 * and not in practice.
 */
export type Pipeline = {
  readonly triggeredTiers: readonly Tier[];
  readonly provenTiers: readonly Tier[];
  /** The suffix of every file the runner collects, such as `.test.ts`. */
  readonly collects: string;
};

/** One table as the text lays it out, with the means to point at its lines. */
export type _Located = {
  readonly id: string;
  /** The header's line, one-based. */
  readonly line: number;
  /** The line of a column inside the table, or the header's line when the column is not on one. */
  readonly locateColumn: (column: string) => number;
};
