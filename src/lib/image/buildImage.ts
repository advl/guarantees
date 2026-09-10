import { posix } from "node:path";
import { Refusal, registerSchema } from "../contract/index.js";
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
 * checkout without a second copy of its inputs anywhere.
 *
 * Two flags are what make the digest this build answers a function of the
 * definition and of nothing else, and they are what keep the pipeline
 * publishing one digest for one definition rather than a new one per run.
 *
 * Every layer is dated at the epoch. A layer archive carries the
 * modification time of every file it holds, so two builds of one definition
 * minutes apart differ in bytes and hash to two digests, and a row pinning
 * either of them names an image the next machine cannot produce. Dated at a
 * fixed instant the archives are identical.
 *
 * The build history is omitted, and that is not tidiness. History is the
 * engine's own bookkeeping about the build rather than a fact about the
 * image, and it carries the throwaway name the engine mints for a stage it
 * has to materialise — a name with a random component, landing on whichever
 * step the engine happens to be committing. It is inside the image
 * configuration the manifest digest is computed over, so two builds of one
 * definition on one machine answer two digests, sometimes, and most often
 * when another build is running beside them. That is the worst shape a
 * reproducibility claim can take: a record taken on a quiet machine and a
 * job that declines on a busy one.
 *
 * What remains reproduces where it was taken: the same definition built
 * again on that machine, cold, answers the same digest. It does not
 * reproduce everywhere, and that is measured rather than assumed. One
 * engine version building this definition in two environments answered two
 * digests while every file inside the two images was byte-identical,
 * differing in exactly the layer the install writes: a layer is an archive
 * of a filesystem and not the filesystem, and what the archive of one tree
 * comes out as is a property of the machine that walked it. Across engine
 * versions it differs for a second reason, since two build toolchains emit
 * different image configurations from identical files.
 *
 * So a digest is not something a machine reproduces; it is something one
 * machine publishes and every other machine fetches. The pipeline builds
 * with these flags and pushes, a row pins what it pushed, and a build here
 * is asked two other questions: whether the definition still builds, and
 * what its files hash to. The inputs hash is what says whether the
 * DEFINITION changed, and it is the claim any machine can make: it is over
 * files, needs no build, and answers on a machine that has never built the
 * image at all.
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
    [
      "build",
      ...registerSchema.$defs.buildFlags.const,
      "--file",
      containerfile,
      "--tag",
      tag,
      root,
    ],
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
