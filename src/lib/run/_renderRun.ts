import { CORPUS_LABEL, ENTRY_LABEL } from "./constants.js";
import type { Mount, RunSpec } from "./types.js";

/** One bind mount as the engine takes it: host, container, and read-only when it is. */
const render = (mount: Mount): readonly string[] => [
  "-v",
  `${mount.host}:${mount.container}${mount.readOnly ? ":ro" : ""}`,
];

/**
 * The engine's `run` arguments for a described run. `--rm` removes the
 * container when it exits on its own; the hard kill removes it by name
 * when it does not.
 *
 * A mask is a volume with no host side — `-v <container path>` — which the
 * engine creates empty for this container alone and removes with it. It is
 * deliberately not a tmpfs, and the difference is the whole of whether it
 * works: the engine lays every tmpfs down before the bind mounts, so a
 * tmpfs at a path under the workspace is covered by the workspace bind
 * itself and leaves a mask that is present in the container's mount table
 * and hides nothing. Masks are rendered after the bind mounts, so a reader
 * of the argv meets what is covered after what covers it.
 */
export default function _renderRun(spec: RunSpec): readonly string[] {
  return [
    "run",
    "--rm",
    "--name",
    spec.name,
    "--label",
    `${CORPUS_LABEL}=${spec.labels.corpus}`,
    "--label",
    `${ENTRY_LABEL}=${spec.labels.entry}`,
    ...spec.mounts.flatMap(render),
    ...spec.masks.flatMap((path) => ["-v", path]),
    ...(spec.network ? [] : ["--network=none"]),
    "-w",
    spec.workdir,
    spec.image,
    ...spec.command,
  ];
}
