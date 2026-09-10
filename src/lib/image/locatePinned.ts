import { join } from "node:path";
import { IMAGES_DIR, PINNED_FILE } from "./constants.js";

/**
 * Where an image's record lives: beside the definition it was taken from,
 * under the directory that holds the tree's images.
 *
 * Two readers compose this path — the command that takes a record, and the
 * scan that reads every record a tree carries — and a layout spelled twice
 * is a layout that moves once. It is the image's own fact, so it is
 * answered here rather than joined at each of them.
 *
 * Pure: the caller reads the file, and decides what its absence means.
 */
export default function locatePinned(root: string, name: string): string {
  return join(root, IMAGES_DIR, name, PINNED_FILE);
}
