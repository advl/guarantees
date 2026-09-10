import { Refusal } from "../contract/index.js";
import type { Verdict } from "../verdict/index.js";
import { PINNED_FILE } from "./constants.js";
import type { Built, Pinned } from "./types.js";

/**
 * Decides what a build here means for the record beside its definition:
 * whether that record still describes the files in this tree.
 *
 * The digest a row pins is the one the pipeline pushed, and no build on
 * another machine answers it. A manifest digest is computed over an image
 * configuration the build toolchain emits, and a layer is an archive of a
 * filesystem rather than the filesystem, so two machines building one
 * definition answer two digests with every file inside the two images
 * byte-identical. Comparing a build here against a published digest would
 * therefore report an unreproducible image wherever there is a second
 * machine, which is everywhere — so the digest is not compared at all.
 *
 * What a build here is for is the other half: it proves the definition
 * still builds, and it answers the hash of the files it was built from.
 * That hash is over files, needs no engine and is the same on every
 * machine, and it is what says whether the record still describes the tree.
 * A definition that has changed is a definition the published image was
 * never built from, and every row pinned to that image is measuring inside
 * something this tree no longer describes.
 *
 * Nothing is written. The record's digest is a fact about a push, and the
 * only place that fact exists is the job that made it: the publishing run
 * prints the digest it pushed and the hash beside it, and a reader copies
 * both into the record and into the rows. A command that wrote the record
 * from a build here would write a digest naming an image nobody can fetch.
 *
 * Pure: the caller builds and reads the record.
 *
 * @throws Refusal when there is no record to judge the build against.
 *
 * @package
 */
export default function judgePinned(
  before: Pinned | null,
  built: Built,
  name: string,
): Verdict {
  if (before === null) {
    throw new Refusal(
      `${name} has no ${PINNED_FILE} beside its definition, and a build here cannot write one — the digest a row pins is the one the publishing job pushed, and this build answers a digest belonging to this machine. Publish the image, then record the digest that job reports beside inputs = "${built.inputs}"`,
    );
  }
  const unchanged = before.inputs === built.inputs;
  return {
    ok: unchanged,
    reason: unchanged
      ? `${name} builds, and hashes to the inputs its record carries — the rows pin ${before.digest}, which is the image this definition was published as`
      : `${name} builds and hashes to ${built.inputs}, recorded as ${before.inputs} — the definition has changed, so ${before.digest} was never built from the tree the rows are measured against. Publish the image and take the digest that job reports, with inputs = "${built.inputs}", into ${PINNED_FILE} and into every row`,
  };
}
