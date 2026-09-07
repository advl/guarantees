import { registerSchema } from "../contract/index.js";

/**
 * The register's vocabulary, its patterns and its numbers are read from the
 * schema, so the contract has one definition and the parser cannot drift
 * from what the emitted schema files promise.
 */

/** What sort of fact a row pins. */
export const KINDS = registerSchema.$defs.kind.enum;

/**
 * The kinds whose rows share the machine, read from the schema so the
 * scheduler's partition is the one the emitted file states. A row of any
 * other kind runs alone after the pool drains, as does a row of these that
 * declares `holds`.
 */
export const POOLED_KINDS: readonly (typeof KINDS)[number][] =
  registerSchema.$defs.pooledKinds.const;

/** When a row runs, earliest first. */
export const TIERS = registerSchema.$defs.tier.enum;

/** What a measured run may reach. */
export const ISOLATIONS = registerSchema.$defs.isolation.enum;

/**
 * Ids no row may take: the register's own header table, and the directory
 * where the scheduler keeps run reports.
 */
export const RESERVED_IDS: readonly string[] = registerSchema.$defs.id.not.enum;

/** The one table that is not a row: the register's own header. */
export const _HEADER_TABLE = "corpus";

/**
 * The contract version a register without a header, or a header without
 * `contract`, is written against: the version at which the header did not
 * exist, read from the schema's default for the property. Never the current
 * version, because the day the current version moves, every headerless
 * register is still what it was, and reading it as the new version is the
 * misreading the version exists to refuse.
 */
export const _HEADERLESS_VERSION: string =
  registerSchema.$defs.header.properties.contract.default;

export const _EXPECTS = registerSchema.$defs.expect.enum;

/** The columns, in the order a row is written. */
export const _COLUMNS: readonly string[] = registerSchema.$defs.row.required;

/** The three keys of `run_s`. */
export const _RUN_KEYS: readonly string[] = registerSchema.$defs.run_s.required;

export const _ID_PATTERN = new RegExp(registerSchema.$defs.id.pattern);

export const _IMAGE_PATTERN = new RegExp(registerSchema.$defs.image.pattern);

export const _FILE_PATTERN = new RegExp(registerSchema.$defs.file.pattern);

/**
 * The budget rule's numbers, read from the schema's limits so a refusal that
 * names them names what the emitted file says; the arithmetic itself is the
 * budget domain's.
 */
export const _FLOOR_S = registerSchema.$defs.limits.const.budget.floorS;

export const _HEADROOM = registerSchema.$defs.limits.const.budget.headroom;

/**
 * Per-tier ceilings, in seconds, from the contract's limits. `entry` bounds
 * one row's budget at parse time; `wall` bounds the wall-clock span of the
 * tier's whole schedule as it ran, judged at the tier's end and never at
 * parse time, since the budgets summed are the same number whether the rows
 * pooled or not. The release tier is per repository, absent from the
 * limits, and unbounded here.
 */
export const CEILINGS = {
  ...registerSchema.$defs.limits.const.ceilings,
  release: {
    entry: Number.POSITIVE_INFINITY,
    wall: Number.POSITIVE_INFINITY,
  },
} as const satisfies Record<
  (typeof TIERS)[number],
  { readonly entry: number; readonly wall: number }
>;

/**
 * The deadline, in seconds, on everything outside the measured window: an
 * image pull, a build recipe, a teardown recipe, an engine call. It is not
 * the row's budget, because a budget is a statement about the measured run
 * and a recipe fetching a heavy fixture is expected to outlast the guarantee
 * it feeds. A stated ceiling names the operation that hung; without one a
 * cancelled job names the workflow.
 */
export const UNMEASURED_S = registerSchema.$defs.limits.const.unmeasuredS;
