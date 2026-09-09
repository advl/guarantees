import { isAbsolute, join, posix, relative, sep } from "node:path";
import { Refusal } from "../contract/index.js";
import { type Row, UNMEASURED_S } from "../register/index.js";
import { WORK_DIR, WORKSPACE } from "../runner/index.js";
import {
  CORPUS_LABEL,
  ENTRY_LABEL,
  KILL_MULTIPLIER,
  NAME_PREFIX,
} from "./constants.js";
import type { DescribeContext, RunSpec } from "./types.js";

/** What a package manager installs into, at the root of the repository. */
const INSTALL_DIR = "node_modules";

/**
 * The shape of one container run, as data, before anything starts.
 *
 * The name carries the entry, the phase, the recipe's position in the build
 * phase, and a nonce from the process, so two processes running one entry
 * never race for a name. The labels carry the checkout and the entry, which
 * is how a container is found afterwards whichever process started it. The
 * repository is mounted read-only at the workspace and the entry's own work
 * directory writable on top of it, at the path the corpus already promises,
 * so an entry that wrote anywhere else fails on the write rather than being
 * reported green over a tree it edited. The repository's own install is
 * masked, because it sits directly above the corpus on the runtime's upward
 * resolution path and would otherwise answer for every module the image
 * installed at its root; the corpus's own install is left visible, since
 * that is where a corpus keeps the package whose bodies its entries import.
 * Nothing is mounted over the image's toolchain. A build recipe runs from
 * the workspace root, because it is a
 * script of the repository's root manifest, and the measured run from the
 * corpus directory. The network is on for a build — a pinned fixture is
 * fetched there, outside the measured window — and off for the measured run
 * unless the row declares `image-net`, because a guarantee reaching the
 * outside world mid-measurement is measuring the outside world. The
 * deadline is the unmeasured one for a build and the kill multiplier times
 * the budget for the measured run.
 *
 * Both roots must be absolute, and the refusal is here rather than at the
 * engine, because a relative host path in a bind mount is not a path to the
 * engine at all: a bare name is a named volume created empty in silence, a
 * name with slashes a malformed volume name, and a dot-prefixed one resolves
 * against wherever the engine's client runs. None is the repository, and
 * nothing downstream can tell them from a runner that failed.
 *
 * @throws Refusal when a root is not absolute, or the corpus is not inside
 * the repository, since its path inside the container is derived from where
 * it sits in the tree.
 *
 * @package
 */
export default function describeRun(
  row: Row,
  context: DescribeContext,
): RunSpec {
  for (const [name, root] of [
    ["repository", context.repositoryRoot],
    ["corpus", context.corpusRoot],
  ] as const) {
    if (!isAbsolute(root)) {
      throw new Refusal(
        `the ${name} root ${JSON.stringify(root)} is not an absolute path — a bind mount needs the host path in full, since a relative one names a volume or a place that moves with the working directory, and either would measure something other than the repository`,
      );
    }
  }
  const corpusDir = relative(context.repositoryRoot, context.corpusRoot);
  if (corpusDir.startsWith("..") || isAbsolute(corpusDir)) {
    throw new Refusal(
      `the corpus at ${context.corpusRoot} is not inside the repository at ${context.repositoryRoot} — the repository is what a container is handed, and a corpus outside it would be mounted nowhere`,
    );
  }
  const corpusInImage = posix.join(WORKSPACE, ...corpusDir.split(sep));
  const build = context.phase === "build";
  const index = context.index === undefined ? "" : `-${context.index}`;
  return {
    name: `${NAME_PREFIX}-${row.id}-${context.phase}${index}-${context.nonce}`,
    labels: { [CORPUS_LABEL]: context.checkout, [ENTRY_LABEL]: row.id },
    image: context.image,
    mounts: [
      { host: context.repositoryRoot, container: WORKSPACE, readOnly: true },
      {
        host: join(context.corpusRoot, WORK_DIR, row.id),
        container: posix.join(corpusInImage, WORK_DIR, row.id),
        readOnly: false,
      },
    ],
    masks: [posix.join(WORKSPACE, INSTALL_DIR)],
    workdir: build ? WORKSPACE : corpusInImage,
    network: build || row.isolation === "image-net",
    deadlineS: build ? UNMEASURED_S : row.run.budget * KILL_MULTIPLIER,
    command: context.command,
  };
}
