/**
 * What an image's directory was last pinned as: the reference the rows
 * name, and a hash over the files the image is built from.
 *
 * @package
 */
export type Pinned = {
  /**
   * The image, digest-pinned, as a row names it. It is the digest the
   * pipeline published, so a machine that lacks the image fetches it by
   * this reference rather than building one of its own.
   */
  readonly digest: string;
  /**
   * `sha256:<hex>` over the directory's files, as `hashImageInputs`
   * computes it. It is the claim any machine can make about the definition
   * without an engine and without a build, and it is what says whether a
   * rebuild was a rebuild of the same definition.
   */
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
   * The digest of the image as built here. Every layer is dated at the
   * epoch and no build history is written, so this reproduces on the
   * machine that took it: the same definition built there again answers the
   * same digest, which is what keeps the pipeline republishing one digest
   * for one definition rather than a new one per run. It is not what a row
   * pins — a row pins the digest the pipeline pushed, and a build on
   * another machine, or under another engine version, answers a different
   * one, since a layer is an archive of a filesystem rather than the
   * filesystem.
   */
  readonly localDigest: string;
  /** `sha256:<hex>` over the directory's files, which is what says whether the definition changed. */
  readonly inputs: string;
};
