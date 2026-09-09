/**
 * The runner's binary, at the image's root. The repository is bind-mounted
 * at `WORKSPACE` when an entry runs, so a binary installed anywhere under it
 * would be covered by the mount; at `/node_modules` no mount can cover it,
 * and node's upward resolution finds the toolchain beside it from any
 * working directory.
 *
 * @package
 */
export const RUNNER_BIN = "/node_modules/.bin/vitest";

/** Where the repository is mounted inside a container, read-only. @package */
export const WORKSPACE = "/workspace";

/**
 * What a package manager installs into, at every level of a tree.
 *
 * Spelled here because three parts of the package answer to it and have to
 * agree: a run masks the repository's own install, the toolchain stamp walks
 * the same path to find which install answered for a module, and the
 * layering scan skips what nobody in the tree wrote. A mask that stopped
 * covering what the stamp walks would report a corpus in order over a
 * toolchain nobody chose.
 *
 * @package
 */
export const INSTALL_DIR = "node_modules";

/**
 * The corpus's scratch directory: one subdirectory per entry, the one place
 * an entry can write, and the lifted reports. Spelled here because the
 * runner is told to collect nothing under it and a run mounts an entry's
 * subdirectory writable, and the two agree by reading one constant.
 *
 * @package
 */
export const WORK_DIR = ".work";

/** Where a run's report is lifted to when its entry's directory is removed, under `WORK_DIR`. @package */
export const REPORTS_DIR = "reports";

/** The report the runner writes under the entry's work directory. @package */
export const REPORT_FILE = "report.json";

/**
 * The suffix the runner collects: what a caller hands `parseRegister` as the
 * pipeline's `collects`, so the register and the runner hold a row's file to
 * one rule.
 *
 * @package
 */
export const COLLECTS = ".test.ts";

/**
 * The one directory under an entry's work directory whose contents outlive
 * the run. Teardown removes `.work/<id>` on every path, so what an entry
 * generated for a golden has no other route out of the container; it is
 * spelled here beside the rest of the corpus layout because the run lifts
 * it and the golden reads it, and the two agree by reading one constant.
 *
 * @package
 */
export const LIFT_DIR = "lift";
