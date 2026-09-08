import { posix } from "node:path";
import { Refusal } from "../contract/index.js";
import { type Spawn, spawnProcess } from "../process/index.js";
import { UNMEASURED_S } from "../register/index.js";
import type { Engine } from "../run/index.js";
import { CONTAINERFILE, IMAGES_DIR } from "./constants.js";
import hashImageInputs from "./hashImageInputs.js";
import type { Built } from "./types.js";

/**
 * Builds an image from its definition and tags it, answering this build's
 * digest and the hash of the files it was built from.
 *
 * The repository root is the build context, which is why a Containerfile's
 * `COPY` paths carry the image's directory: the image is built from a
 * checkout without a second copy of its inputs anywhere. The local digest
 * is this build's identity only — a rebuild on a cold cache yields another
 * — so the inputs hash, over files, is what says whether the definition
 * changed.
 *
 * The ID is answered beside the digest because the ID is what a caller
 * hands a run: a tag is a name in a store every process on the machine
 * shares, and the ID names this build after the tag has been repointed or
 * removed by another.
 *
 * @note Impure — spawns the engine to build and inspect, and reads the
 * image's directory to hash it.
 * @throws Refusal when the build fails or stalls to its deadline, or the
 * built image cannot be inspected.
 *
 * @package
 */
export default async function buildImage(
  engine: Engine,
  root: string,
  name: string,
  tag: string,
  spawn: Spawn = spawnProcess,
): Promise<Built> {
  const containerfile = posix.join(IMAGES_DIR, name, CONTAINERFILE);
  const built = await spawn(
    engine.binary,
    ["build", "--file", containerfile, "--tag", tag, root],
    { cwd: root, deadlineMs: UNMEASURED_S * 1000 },
  );
  if (built.killed) {
    throw new Refusal(
      `building ${containerfile} did not finish within ${UNMEASURED_S}s — the build is outside every measured window and still has a deadline, so a stalled fetch names the file rather than a cancelled job`,
    );
  }
  if (built.code !== 0) {
    throw new Refusal(
      `building ${containerfile} failed — the engine's own output above is the reason`,
    );
  }
  const inspected = await spawn(
    engine.binary,
    ["image", "inspect", "--format", "{{.Id}} {{.Digest}}", tag],
    { deadlineMs: UNMEASURED_S * 1000, capture: true },
  );
  const fields = inspected.out.split(" ");
  if (inspected.code !== 0 || inspected.killed || fields.length !== 2) {
    throw new Refusal(
      `${tag} was built and cannot be inspected, so its ID and digest are unknown`,
    );
  }
  const [id, localDigest] = fields as [string, string];
  return {
    id: `sha256:${id}`,
    localDigest,
    inputs: hashImageInputs(root, name),
  };
}
