import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  describeToolchainStamp,
  listTierImages,
} from "@aztlan/guarantees/selftest";

import { corpusRoot, register, repositoryRoot } from "./corpus.js";

/**
 * What the image installs, read from the definition the image is built from
 * rather than restated here: a list written out by hand would be true on the
 * day it was written and would go on passing after the image moved.
 */
const { dependencies } = JSON.parse(
  readFileSync(join(repositoryRoot, "images", "ts", "package.json"), "utf8"),
) as { readonly dependencies: Readonly<Record<string, string>> };

/**
 * One stamp per image the tier names, asked of the scheduler rather than
 * filtered here: what the body asserts is true of the image it was handed
 * and of no other, so an image added to a row tomorrow would otherwise run
 * every entry in it with nothing asserting from the inside what that image
 * carries — and the tier would be green. Asked of the scheduler, a tier
 * this corpus mistyped is refused rather than answering no images and
 * registering nothing.
 */
for (const image of listTierImages(register, "pr")) {
  // Where the run covers the repository's own install is not stated here.
  // It is the run's own fact, and a corpus restating it can only retype a
  // path it cannot import — one that reads correctly for a corpus sitting
  // directly under the repository root and names the wrong directory for
  // one a level deeper, where an empty directory passes the assertion the
  // mask is there to make.
  describeToolchainStamp({
    id: "corpus-toolchain",
    image,
    corpusRoot,
    expected: dependencies,
  });
}
