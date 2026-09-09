import { beforeAll, describe } from "vitest";

import { IMAGES_DIR, PINNED_FILE } from "../image/index.js";
import type { Register } from "../register/index.js";
import _findUntiedImages, { type Untied } from "./_findUntiedImages.js";
import _listPinnedImages from "./_listPinnedImages.js";
import _requireNothingFound from "./_requireNothingFound.js";
import { _DRIFT_TITLE, _UNRECORDED_TITLE, _UNTIED_TITLE } from "./constants.js";

/**
 * The tie between the images a tree defines and the images its rows run in.
 *
 * An image is the whole basis of a corpus: every verdict is a verdict about
 * a system built and run by one pinned toolchain, and every budget assumes
 * that toolchain does not move underneath it. A toolchain stamp checks that
 * from the inside, where the answer is the fact rather than the intention.
 * This checks it from the outside — whether the image the rows name is
 * still the one this tree describes — and without it the definition could
 * be edited into anything, every entry would go on running inside the image
 * the edit was never built into, and the tier would report green.
 *
 * What it asserts is a three-way agreement: the digest the rows pin, the
 * digest the record carries, and the inputs hash the tree's own files
 * answer. It does not rebuild anything and compare digests, and could not:
 * an image is published by one job and fetched everywhere, and the digest
 * of a build taken here is a property of this machine. The hash is what
 * every machine can compute, so the hash is what says whether the published
 * image was built from the tree the rows are measured against.
 *
 * The root is the directory that HOLDS `images/`, which is the repository
 * root for a package that defines its own base and the corpus root for a
 * consumer that derives one, and it is the caller's fact because the body
 * must not guess which of the two it is looking at.
 *
 * Every distinct digest the register names is covered, in both directions.
 * A repository deriving its own image from a base another one publishes
 * defines that derived image here and records it beside the base's, so a
 * row pinned to a digest nothing in this tree records is a row nothing
 * ties: neither of the other two directions can reach it, and both report a
 * corpus in order while its entries run inside whatever that digest is
 * today.
 *
 * A corpus deriving nothing of its own — pinning a base another repository
 * publishes and holding no `images/` at all — is the shape this would
 * otherwise report three failures on, every one of them about the corpus
 * having nothing rather than about anything being wrong: two vacuity
 * assertions over an empty scan, and a register whose every row is pinned
 * to a digest no record here carries. What such a corpus pins is the
 * caller's fact and arrives as `published`, since there is nowhere in the
 * tree to read it from, and the tie then says what it can: every row is
 * pinned to something this corpus declared or built, and nothing was
 * scanned in silence.
 *
 * @note Impure — reads the image definitions and the records under `root`.
 */
export default function describeImageTie(options: {
  /** The row's id, which its selector matches. */
  readonly id: string;
  /** The directory that holds `images/`, absolute. */
  readonly root: string;
  /** The register as the corpus parsed it, rows keyed by id. */
  readonly register: Register;
  /**
   * The references this corpus pins and does not build: a base another
   * repository publishes and records, which no `images/` here describes.
   * Rows pinned to one of these are tied by the caller's word, which is the
   * only record there is for an image built somewhere else.
   */
  readonly published?: readonly string[];
}): void {
  const published = options.published ?? [];
  describe(options.id, () => {
    let found: Untied = { drifted: [], untied: [], unrecorded: [] };
    let defined = 0;
    beforeAll(() => {
      const images = _listPinnedImages(options.root);
      defined = images.length;
      found = _findUntiedImages(images, options.register, published);
    });

    _requireNothingFound({
      title: _DRIFT_TITLE,
      looked: () => defined + published.length,
      lookedAt: `images this tree defines under ${IMAGES_DIR}/, and images it pins and does not build`,
      found: () => found.drifted,
      meaning: `images whose definition in this tree is not the one they were pinned against — publish the image from this definition and take the digest that job reports, with the new hash, into ${PINNED_FILE} and the rows. Editing the rows until they stop complaining leaves the corpus measuring inside an image the tree no longer describes`,
    });

    _requireNothingFound({
      title: _UNTIED_TITLE,
      looked: () => defined + published.length,
      lookedAt: `image definitions this tree carries under ${IMAGES_DIR}/, and images it pins and does not build`,
      found: () => found.untied,
      meaning:
        "images this tree builds that no row runs in — a record about one of them is a true statement about something nothing measures in",
    });

    _requireNothingFound({
      title: _UNRECORDED_TITLE,
      looked: () => options.register.size,
      lookedAt: "rows whose image this looked for a record of",
      found: () => found.unrecorded,
      meaning: `rows pinned to a digest no ${IMAGES_DIR}/<name>/${PINNED_FILE} records and the corpus did not declare — a derived image is defined in the tree that runs in it and recorded beside the base it derives from, and a digest nothing here accounts for is one no direction of this tie can see move`,
    });
  });
}
