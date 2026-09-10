import { join } from "node:path";
import { describeLayering } from "@aztlan/guarantees/selftest";

import { corpusRoot, repositoryRoot } from "./corpus.js";

describeLayering({
  id: "corpus-layering",
  corpusRoot,
  // The package's own source, which this corpus reaches only through what
  // the package publishes, and which reaches nothing of this corpus at all.
  forbidden: [join(repositoryRoot, "src")],
});
