/**
 * What an image's directory was last pinned as: the reference the rows
 * name, and a hash over the files the image is built from.
 *
 * @package
 */
export type Pinned = {
  /** The image, digest-pinned, as a row names it. */
  readonly digest: string;
  /** `sha256:<hex>` over the directory's files, as `hashImageInputs` computes it. */
  readonly inputs: string;
};

/** A pinned reference resolved to what the engine is handed. */
export type ImageRef = {
  /** The digest the reference pins, without its name. */
  readonly digest: string;
  /** An image ID when the digest was found in local storage, else the reference as pulled. */
  readonly reference: string;
};

/**
 * What a build left: the image's ID in the store, this build's own digest,
 * and the hash of what it was built from.
 *
 * @package
 */
export type Built = {
  /**
   * The ID the store files the image under, `sha256:<hex>`, which is what
   * a run is handed: it names this build whatever tags come and go, where a
   * tag is a name any process on the machine can repoint or remove.
   */
  readonly id: string;
  /**
   * The digest of the image as built here. It is this build's identity
   * only: the same definition on a cold cache yields another, so it says
   * nothing about whether the definition changed.
   */
  readonly localDigest: string;
  /** `sha256:<hex>` over the directory's files, which is what says whether the definition changed. */
  readonly inputs: string;
};
