import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GOLDENS_DIR } from "../golden/index.js";
import { INSTALL_DIR, WORK_DIR } from "../runner/index.js";
import type { Source } from "./_findTrespasses.js";

/**
 * What a tree carries that nobody in it wrote: installs, build output,
 * scratch, reports and goldens. The install, the corpus's scratch and the
 * goldens are read from the constants that own them, so a scan skips what a
 * run writes rather than a name that happens to match; the two build
 * outputs below are named by this package's own toolchain and have no owner
 * in the code. Goldens are here for the same reason as the rest and not for
 * tidiness: a golden is what an entry generated, committed so a later run
 * is compared to it, and one that happens to be a module would otherwise be
 * read as source this corpus wrote and held to where its imports may reach.
 */
const NOT_SOURCE = new Set([
  GOLDENS_DIR,
  INSTALL_DIR,
  WORK_DIR,
  ".git",
  "dist",
  "coverage",
]);

/** What a specifier can be written in. */
const SOURCE = /\.[cm]?[jt]sx?$/;

/**
 * Every source file under a directory, with its text, for a scan that reads
 * specifiers. Directories holding what nobody wrote are skipped by name at
 * any depth, because a dependency's own imports are a fact about somebody
 * else's tree and would fail a scan for it.
 *
 * @note Impure — reads the tree under `directory`.
 */
export default function _listSources(directory: string): readonly Source[] {
  const found: Source[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!NOT_SOURCE.has(entry.name)) found.push(..._listSources(path));
      continue;
    }
    if (SOURCE.test(entry.name)) {
      found.push({ path, text: readFileSync(path, "utf8") });
    }
  }
  return found;
}
