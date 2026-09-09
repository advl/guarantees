import { dirname, resolve, sep } from "node:path";
import _within from "./_within.js";

/** One source file as the scan reads it: where it is, and what it says. */
export type Source = {
  /** The file's absolute path, which is what a relative specifier resolves against. */
  readonly path: string;
  readonly text: string;
};

/** Every module specifier a file names, static, type-only or dynamic. */
const SPECIFIER = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;

/**
 * A path's last segment, and a specifier's first, taken without an index so
 * that there is no absent case to invent a fallback for: a split of a
 * string always yields at least one part, and a fallback for the part that
 * cannot be missing is a branch no test can reach.
 */
const lastSegment = (path: string) => path.split(sep).slice(-1).join("");

const firstSegment = (specifier: string) => specifier.split("/", 1).join("");

/**
 * Every specifier in `sources` that reaches into one of the `forbidden`
 * directories, each as `<file> -> <specifier>`.
 *
 * A relative specifier is resolved against the file that writes it and
 * refused when it lands inside a forbidden directory. A bare specifier is
 * refused only when its first segment is the name of one — that is the
 * shape a path written without a leading dot takes, and it is the only
 * shape of bare specifier that reaches a directory. A package name is what
 * a consumer writes and is admitted, which is also what keeps a package
 * whose own name ends in the word a directory is called from being read as
 * a reach into that directory.
 *
 * Directories are compared as resolved paths and never as name segments
 * anywhere in a specifier, because a segment scan cannot tell `../src/x`
 * from `@scope/src-tools` and reports the second as a trespass. The
 * containment itself is `_within`, which the other scan in this domain
 * reads too: a directory's name is a prefix of its siblings' as often as
 * not, and one rule for that is one answer.
 */
export default function _findTrespasses(
  sources: readonly Source[],
  forbidden: readonly string[],
): readonly string[] {
  const roots = forbidden.map((directory) => resolve(directory));
  const names = new Set(roots.map(lastSegment));
  return sources.flatMap((source) =>
    [...source.text.matchAll(SPECIFIER)]
      .flatMap((match) => match.slice(1))
      .filter((specifier) =>
        specifier.startsWith(".")
          ? roots.some((root) =>
              _within(root, resolve(dirname(source.path), specifier)),
            )
          : names.has(firstSegment(specifier)),
      )
      .map((specifier) => `${source.path} -> ${specifier}`),
  );
}
