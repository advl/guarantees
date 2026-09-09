import { join } from "node:path";
import { describe, expect, it } from "vitest";

import _findTrespasses, { type Source } from "./_findTrespasses.js";

const ROOT = "/srv/checkout";
// Named for what it is and never `guarantees`: a specifier written into
// fixture data here is still a specifier in a file of this repository, and
// this repository has a corpus of that name whose own layering guarantee
// scans these files and would read the fixture as a trespass.
const CORPUS = join(ROOT, "corpus-tree");
const PACKAGE = join(ROOT, "src");

const source = (path: string, text: string): Source => ({ path, text });

describe("_findTrespasses", () => {
  it("finds nothing where every specifier stays on its own side", () => {
    expect(
      _findTrespasses(
        [
          source(
            join(CORPUS, "corpus-layering.test.ts"),
            'import { describeLayering } from "@example/guarantees/selftest";\nimport local from "./helper.js";\n',
          ),
        ],
        [PACKAGE],
      ),
    ).toEqual([]);
  });

  it("names a relative specifier that lands inside a forbidden directory, with the file that writes it", () => {
    const path = join(CORPUS, "corpus-layering.test.ts");
    expect(
      _findTrespasses(
        [source(path, 'import x from "../src/index.js";')],
        [PACKAGE],
      ),
    ).toEqual([`${path} -> ../src/index.js`]);
  });

  it("refuses the other direction too, since what is judged never depends on the layer that judges it", () => {
    const path = join(PACKAGE, "lib", "run", "runEntry.ts");
    expect(
      _findTrespasses(
        [
          source(
            path,
            'import fixture from "../../../corpus-tree/fixtures.js";',
          ),
        ],
        [CORPUS],
      ),
    ).toEqual([`${path} -> ../../../corpus-tree/fixtures.js`]);
  });

  it("names a bare specifier whose first segment is a forbidden directory, which is a path written without its dot", () => {
    const path = join(CORPUS, "entry.test.ts");
    expect(
      _findTrespasses(
        [source(path, 'import x from "src/index.js";')],
        [PACKAGE],
      ),
    ).toEqual([`${path} -> src/index.js`]);
  });

  it("admits a package whose own name carries the forbidden directory's word, which a segment scan reports as a trespass", () => {
    const path = join(CORPUS, "entry.test.ts");
    expect(
      _findTrespasses(
        [
          source(
            path,
            'import a from "@example/guarantees";\nimport b from "@example/guarantees/selftest";\nimport c from "src-tools";\n',
          ),
        ],
        [CORPUS, PACKAGE],
      ),
    ).toEqual([]);
  });

  it("reads a dynamic import and a type-only one as the specifiers they are", () => {
    const path = join(CORPUS, "entry.test.ts");
    expect(
      _findTrespasses(
        [
          source(
            path,
            'const m = await import("../src/late.js");\nimport type { T } from "../src/types.js";\n',
          ),
        ],
        [PACKAGE],
      ),
    ).toEqual([`${path} -> ../src/late.js`, `${path} -> ../src/types.js`]);
  });

  it("admits a relative specifier that climbs past a forbidden directory without landing in it", () => {
    const path = join(CORPUS, "entry.test.ts");
    expect(
      _findTrespasses(
        [source(path, 'import x from "../src-generated/index.js";')],
        [PACKAGE],
      ),
    ).toEqual([]);
  });

  it("finds nothing when nothing is forbidden, which is why a body asserts the list is not empty", () => {
    expect(
      _findTrespasses(
        [source(join(CORPUS, "e.test.ts"), 'import x from "../src/index.js";')],
        [],
      ),
    ).toEqual([]);
  });
});
