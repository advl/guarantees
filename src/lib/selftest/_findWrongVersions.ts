import _within from "./_within.js";

/** What resolving one name from the corpus answered: where it landed and what version it carries. */
export type Resolution = {
  readonly path: string;
  readonly version: string;
} | null;

/**
 * Every name the corpus does not resolve to the version it expects, from
 * outside the repository.
 *
 * Three ways to be wrong, and each is named as itself: a name that resolves
 * to nothing, one that resolves inside the repository — which is the
 * repository's own install answering for the image's, the very thing the
 * run's mask exists to prevent — and one at another version, which is a
 * toolchain that moved underneath every budget the corpus ever measured.
 *
 * Outside the repository rather than at some particular path, because that
 * is the property that matters and the one a caller can state: the image
 * carries its toolchain where no bind mount of the repository can cover it,
 * so a resolution landing anywhere under the workspace is one the checkout
 * answered. Under it is `_within`, the same containment the trespass scan
 * reads, because a bare prefix test calls `/workspace-tools` a path inside
 * `/workspace` and would report the image's own toolchain as the
 * checkout's.
 */
export default function _findWrongVersions(
  expected: Readonly<Record<string, string>>,
  resolved: Readonly<Record<string, Resolution>>,
  workspace: string,
): readonly string[] {
  return Object.entries(expected).flatMap(([name, version]) => {
    const resolution = resolved[name];
    if (resolution === undefined || resolution === null) {
      return [`${name} resolves to nothing from the corpus`];
    }
    if (_within(workspace, resolution.path)) {
      return [
        `${name} resolves to ${resolution.path}, inside the repository at ${workspace} — the checkout's own install answering for the image's`,
      ];
    }
    return resolution.version === version
      ? []
      : [`${name} resolves at ${resolution.version}, expected ${version}`];
  });
}
