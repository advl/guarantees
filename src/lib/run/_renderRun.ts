import { CORPUS_LABEL, ENTRY_LABEL } from "./constants.js";
import type { RunSpec } from "./types.js";

/**
 * The engine's `run` arguments for a described run. `--rm` removes the
 * container when it exits on its own; the hard kill removes it by name
 * when it does not.
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
    ...spec.mounts.flatMap((mount) => [
      "-v",
      `${mount.host}:${mount.container}${mount.readOnly ? ":ro" : ""}`,
    ]),
    ...(spec.network ? [] : ["--network=none"]),
    "-w",
    spec.workdir,
    spec.image,
    ...spec.command,
  ];
}
