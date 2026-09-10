import { describeImageTie } from "@aztlan/guarantees/selftest";

import { register, repositoryRoot } from "./corpus.js";

// The repository root and not the corpus root, because that is the
// directory holding `images/` here: this package defines the base image its
// own rows run in, where a consumer deriving one holds it beside its corpus.
describeImageTie({ id: "corpus-image", root: repositoryRoot, register });
