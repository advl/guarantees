import { sep } from "node:path";

/**
 * Whether `path` is `directory` itself or lies under it.
 *
 * Containment is a comparison of path SEGMENTS and never of characters. A
 * bare prefix test answers true for `/workspace-other` against `/workspace`
 * and for `../src-tools` against `../src`, which is a sibling reported as a
 * child — and the two scans in this domain that ask the question ask it
 * about exactly those shapes: where a specifier lands, and which install
 * answered for a package. Two containment tests written twice in one domain
 * are two answers the day either of them is fixed, so it is answered here
 * and read from here.
 *
 * Pure.
 */
export default function _within(directory: string, path: string): boolean {
  return path === directory || path.startsWith(`${directory}${sep}`);
}
