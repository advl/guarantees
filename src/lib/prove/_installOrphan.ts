import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Refusal } from "../contract/index.js";
import { COLLECTS } from "../runner/index.js";
import { _ORPHAN_BODY, ORPHAN_ID } from "./constants.js";

/**
 * Writes a test file into the corpus that the register does not claim, and
 * answers the removal of it.
 *
 * This is what makes the bijection's first direction provable. Both of its
 * directions compare two lists, and two empty lists compare equal, so an
 * assertion that scans nothing passes exactly as an assertion that scans
 * everything and finds nothing wrong. Installing a file no row claims is
 * the difference between the two, and the only form of proof that tells
 * them apart.
 *
 * A file of that name already in the tree is a refusal rather than an
 * overwrite: a tree that was broken before this broke it makes the red that
 * follows meaningless, since the assertion would be failing on somebody
 * else's file and would go on failing after this removed its own.
 *
 * @note Impure — writes and removes a file in the corpus tree.
 * @throws Refusal when a file of that name is already there.
 */
export default function _installOrphan(corpusRoot: string): () => void {
  const path = join(corpusRoot, `${ORPHAN_ID}${COLLECTS}`);
  if (existsSync(path)) {
    throw new Refusal(
      `${ORPHAN_ID}${COLLECTS} is already in the corpus at ${corpusRoot} — an earlier proof left it there or something else wrote it, and a tree already broken makes the red this would produce evidence of nothing; remove it and prove again`,
    );
  }
  writeFileSync(path, _ORPHAN_BODY);
  return () => {
    rmSync(path, { force: true });
  };
}
