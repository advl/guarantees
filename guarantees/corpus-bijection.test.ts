import { describeBijection } from "@aztlan/guarantees/selftest";

import { corpusRoot, register } from "./corpus.js";

describeBijection({ id: "corpus-bijection", corpusRoot, register });
