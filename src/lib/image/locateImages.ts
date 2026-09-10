import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

import { Refusal } from "../contract/index.js";
import { IMAGES_DIR } from "./constants.js";

/** Whether a directory of image definitions sits directly under `at`. */
const holdsImages = (at: string): boolean => {
  const directory = join(at, IMAGES_DIR);
  return existsSync(directory) && statSync(directory).isDirectory();
};

/**
 * Which of a repository's two roots holds its image definitions.
 *
 * An image a corpus derives is the corpus's own: it exists because that
 * corpus's entries need more than the base carries — a DOM implementation, a
 * browser — and it belongs beside the register that pins it, under the one
 * tree a repository gives its guarantees. An image a repository publishes is
 * a different thing wearing the same shape: it is a product of that
 * repository rather than furniture of its corpus, and it sits at the
 * repository's own root.
 *
 * So the answer is a position rather than a declaration, and no repository
 * has to say which kind it is: the corpus is asked first, because a corpus
 * that derives its own image is the case that has to work for every consumer,
 * and the repository answers when the corpus holds none.
 *
 * A repository holding both is refused rather than resolved. The two are
 * indistinguishable from here — a directory of definitions is a directory of
 * definitions — and picking one would leave the other's rows pinned to
 * records nothing reads and its definitions unbuilt, which is the silent half
 * of an ambiguity rather than the loud one.
 *
 * @note Impure — reads the filesystem to see which root holds them.
 */
export default function locateImages(
  repositoryRoot: string,
  corpusRoot: string,
): string {
  const inCorpus = holdsImages(corpusRoot);
  const inRepository =
    corpusRoot !== repositoryRoot && holdsImages(repositoryRoot);
  if (inCorpus && inRepository) {
    throw new Refusal(
      `image definitions under both ${join(corpusRoot, IMAGES_DIR)} and ${join(repositoryRoot, IMAGES_DIR)} — one of them is read and the other is a set of definitions nothing builds beside records nothing reads, so say which by removing the other`,
    );
  }
  return inCorpus ? corpusRoot : repositoryRoot;
}
