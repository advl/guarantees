import type { Pinned } from "../image/index.js";
import type { Register } from "../register/index.js";

/** One image the tree defines: its directory's name, what it was pinned as, and what its files hash to now. */
export type PinnedImage = {
  readonly name: string;
  readonly pinned: Pinned;
  /** The hash of the image's files as they are today, from `hashImageInputs`. */
  readonly inputs: string;
};

/** Where a tree's image records and its register stop agreeing, in every direction. */
export type Untied = {
  /** Records describing a definition other than the one in the tree. */
  readonly drifted: readonly string[];
  /** Images the tree builds that no row names. */
  readonly untied: readonly string[];
  /** Rows naming a digest no record in the tree accounts for. */
  readonly unrecorded: readonly string[];
};

/** A reference's digest, whatever name it is published under. */
const digestOf = (reference: string) =>
  reference.slice(reference.indexOf("@") + 1);

/**
 * What a tree's image records and its register disagree about.
 *
 * The first direction is whether a record still describes the files it was
 * taken from: without it the definition could be edited into anything,
 * every entry would go on running inside the image the edit was never built
 * into, and the tier would report green. It is closed by the inputs hash
 * and never by rebuilding and comparing digests — an image is published by
 * one job and fetched everywhere, so a build taken here answers a digest
 * belonging to this machine, and the hash over the files is the one claim
 * every machine can make about the definition.
 *
 * The second is what makes the first load-bearing: an image the tree builds
 * and no row names is a definition nothing runs in, and a record about it
 * is a true statement about an unrelated thing.
 *
 * The third closes both. Every distinct digest the register names has a
 * record: one the tree carries, because a repository deriving its own image
 * from a base another one publishes writes a definition of that derived
 * image here and records it beside the base's — or one the caller declares,
 * because a corpus that derives nothing of its own has no `images/` to hold
 * a record in and still pins something. A row pinned to a digest neither
 * accounts for is a row whose image no direction above can reach: the
 * definition it was built from is not in this tree to have drifted, and the
 * row is not an image this tree builds, so every entry of it runs inside
 * something nothing ties and both of the other directions report a corpus
 * in order.
 */
export default function _findUntiedImages(
  images: readonly PinnedImage[],
  register: Register,
  published: readonly string[],
): Untied {
  const named = new Set(
    [...register.values()].map((row) => digestOf(row.image)),
  );
  const recorded = new Set([
    ...images.map((image) => digestOf(image.pinned.digest)),
    ...published.map(digestOf),
  ]);
  return {
    drifted: images
      .filter((image) => image.pinned.inputs !== image.inputs)
      .map(
        (image) =>
          `${image.name}: the files hash to ${image.inputs}, recorded as ${image.pinned.inputs}`,
      ),
    untied: images
      .filter((image) => !named.has(digestOf(image.pinned.digest)))
      .map((image) => `${image.name} -> ${image.pinned.digest}`),
    unrecorded: [...register.values()]
      .filter((row) => !recorded.has(digestOf(row.image)))
      .map((row) => `${row.id} -> ${row.image}`),
  };
}
