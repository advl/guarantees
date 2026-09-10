import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { INSTALL_DIR } from "../runner/index.js";
import type { Resolution } from "./_findWrongVersions.js";

/**
 * The manifest of the install that answers for `name` from `directory`, by
 * the upward walk the runtime itself makes: the first `node_modules` above
 * the directory that holds the package, and `null` when nothing does.
 *
 * The walk is made here rather than asked of the runtime's own resolver,
 * and the reason is what the question is: which install answers, not which
 * file. A resolver is asked for a path inside the package and answers
 * through the package's `exports` map, so a package that does not publish
 * its own manifest — several of the pinned toolchain do not — comes back as
 * one that resolves to nothing, and a stamp reading that answer would
 * report a toolchain fault on a toolchain that is exactly right.
 *
 * @note Impure — reads the filesystem above `directory`.
 */
const answering = (directory: string, name: string): string | null => {
  let at = directory;
  for (;;) {
    const manifest = join(at, INSTALL_DIR, ...name.split("/"), "package.json");
    if (existsSync(manifest)) return manifest;
    const parent = dirname(at);
    if (parent === at) return null;
    at = parent;
  }
};

/**
 * Where each name resolves from a directory, and at what version, with
 * `null` for a name nothing above that directory answers for.
 *
 * @note Impure — reads the filesystem and the manifests it finds.
 */
export default function _resolveFrom(
  directory: string,
  names: readonly string[],
): Readonly<Record<string, Resolution>> {
  const resolved: Record<string, Resolution> = {};
  for (const name of names) {
    const manifest = answering(directory, name);
    if (manifest === null) {
      resolved[name] = null;
      continue;
    }
    const { version } = JSON.parse(readFileSync(manifest, "utf8")) as {
      readonly version?: string;
    };
    resolved[name] = { path: manifest, version: version ?? "" };
  }
  return resolved;
}
