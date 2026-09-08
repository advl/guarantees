import { labelSchema, registerSchema } from "../contract/index.js";

/**
 * The container engine, spelled here and nowhere else. Every call reaches it
 * through `ENGINE` or through the `binary` of a probed `Engine`, so the day
 * another engine with the same command surface is admitted, one line moves.
 *
 * @package
 */
export const ENGINE = "podman";

/**
 * The exit code the engine reserves for a failure of its own — an image it
 * does not hold, a mount it refused, a name it will not accept — as opposed
 * to a code the contained command exited with. Never a verdict, since a
 * container's command may exit with the same number; read only beside the
 * absence of what the command would have written, to name the engine in a
 * refusal that would otherwise name the runner.
 *
 * @package
 */
export const ENGINE_FAULT_CODE = 125;

/** What every container name opens with, before the entry's id. @package */
export const NAME_PREFIX = "guarantees";

/**
 * The two label keys every container carries, read from the contract's
 * label schema so a reader of the emitted `label.schema.json` filters by the
 * same keys this package writes: the checkout the run belongs to, and the
 * entry the container was started for.
 *
 * @package
 */
export const CORPUS_LABEL = labelSchema.required[0];

/** The second label key: the entry the container was started for. @package */
export const ENTRY_LABEL = labelSchema.required[1];

/** The freshness marker a run writes into the entry's work directory before anything starts. @package */
export const MARKER_FILE = "marker.json";

/**
 * The consumer's task face: what a build recipe runs under inside the image
 * and a teardown recipe under on the host. A recipe named in a register row
 * is a script in the repository's root manifest.
 *
 * @package
 */
export const TASK_FACE = ["bun", "run"] as const;

/**
 * The hard kill is this many times the row's budget, read from the
 * register schema's limits so the number a verdict names is the number the
 * emitted file states.
 *
 * @package
 */
export const KILL_MULTIPLIER =
  registerSchema.$defs.limits.const.budget.killMultiplier;
