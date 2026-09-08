import type { Spawn } from "../process/index.js";
import type { Verdict } from "../verdict/index.js";

/** The engine as probed: the binary every call spawns, and the version it reported. */
export type Engine = {
  readonly binary: string;
  readonly version: string;
};

/** The two phases a container is started for: a build recipe, or the measured run. @package */
export type RunPhase = "build" | "measured";

/** One bind mount: a host path at a container path. @package */
export type Mount = {
  readonly host: string;
  readonly container: string;
  readonly readOnly: boolean;
};

/**
 * The shape of one container run, as data: everything the engine is handed
 * and nothing else, so the shape can be asserted without a container.
 *
 * @package
 */
export type RunSpec = {
  readonly name: string;
  readonly labels: { readonly corpus: string; readonly entry: string };
  readonly image: string;
  readonly mounts: readonly Mount[];
  readonly workdir: string;
  readonly network: boolean;
  /** When the container is removed, in seconds from its start. */
  readonly deadlineS: number;
  readonly command: readonly string[];
};

/**
 * What `describeRun` needs beside the row to describe one container.
 *
 * @package
 */
export type DescribeContext = {
  readonly repositoryRoot: string;
  readonly corpusRoot: string;
  /** The checkout label, as `hashCheckout` computes it from the repository root. */
  readonly checkout: string;
  /** What keeps two processes running one entry apart in the container's name. */
  readonly nonce: string;
  /** The image reference the engine is handed. */
  readonly image: string;
  readonly phase: RunPhase;
  /** The recipe's position in the build phase; absent for the measured run. */
  readonly index?: number;
  readonly command: readonly string[];
};

/**
 * What a run of one entry needs beside its row. No checkout label: a run
 * hashes it from the repository root, as a reap of the same root does, so
 * the two cannot be handed different strings.
 *
 * @package
 */
export type RunContext = {
  readonly engine: Engine;
  /** The repository's root, absolute. */
  readonly repositoryRoot: string;
  readonly corpusRoot: string;
  readonly nonce: string;
  /** The resolved image reference the engine is handed. */
  readonly image: string;
  readonly spawn?: Spawn;
};

/** A verdict together with the seconds of the measured phase alone, which is what a budget is set from. */
export type Ran = Verdict & { readonly seconds: number };
