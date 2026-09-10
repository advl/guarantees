import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { Refusal } from "../contract/index.js";
import {
  CONTAINERFILE,
  hashImageInputs,
  IMAGES_DIR,
  locatePinned,
  PINNED_FILE,
  readPinned,
} from "../image/index.js";
import type { PinnedImage } from "./_findUntiedImages.js";

/**
 * Every image a tree defines: its record as written, and what its files hash
 * to today.
 *
 * A tree with no `images/` under it answers an empty list rather than a
 * fault. That is a corpus deriving nothing of its own — pinning a base
 * another repository publishes — and it is a shape the tie still has
 * something to say about, from the register's side; a bare missing-directory
 * error out of a registration hook is reported as tests that never ran,
 * which is a refusal where a verdict was asked for.
 *
 * A definition with no record beside it is the same shape one level down: a
 * tree deriving an image and not yet having recorded it is an ordinary state
 * of a repository, and it is declined by name, with the command that ends
 * it, rather than by a missing-file error carrying only a path.
 *
 * @note Impure — reads the image directories under `root` and their records.
 * @throws Refusal when a definition has no record beside it, from
 * `readPinned` when a record is not one, and from `hashImageInputs` when a
 * directory defines no image.
 */
export default function _listPinnedImages(root: string): PinnedImage[] {
  const directory = join(root, IMAGES_DIR);
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const record = locatePinned(root, entry.name);
      if (!existsSync(record)) {
        throw new Refusal(
          `no ${PINNED_FILE} beside ${IMAGES_DIR}/${entry.name}/${CONTAINERFILE} — an image this tree builds is recorded beside its definition, and a definition nothing recorded is one no row can pin; build it once and the record is written`,
        );
      }
      return {
        name: entry.name,
        pinned: readPinned(readFileSync(record, "utf8")),
        inputs: hashImageInputs(root, entry.name),
      };
    });
}
