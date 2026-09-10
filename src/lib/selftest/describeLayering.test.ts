import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import captureRegistration from "../../_testing/captureRegistration.js";
import { _INWARD_TITLE, _OUTWARD_TITLE } from "./constants.js";
import { describeLayering } from "./index.js";

/**
 * A repository whose two layers stay on their own sides: a corpus reaching
 * its package the way a consumer does, and a package reaching nothing of
 * the corpus at all.
 */
const trees: string[] = [];
const root = mkdtempSync(join(tmpdir(), "describe-layering-"));
trees.push(root);
const corpusRoot = join(root, "guarantees");
const packageRoot = join(root, "src");
mkdirSync(corpusRoot);
mkdirSync(join(packageRoot, "lib"), { recursive: true });
writeFileSync(
  join(corpusRoot, "corpus-layering.test.ts"),
  'import { describeLayering } from "@example/guarantees/selftest";\n',
);
writeFileSync(
  join(packageRoot, "index.ts"),
  'export { default as run } from "./lib/run.js";\n',
);
writeFileSync(join(packageRoot, "lib", "run.ts"), "export default 1;\n");

// Called as a corpus calls it, against a tree that keeps the boundary, so
// both directions run rather than merely being registered. What each finds
// when a specifier crosses is asserted over the finder, in both directions.
describeLayering({
  id: "corpus-layering",
  corpusRoot,
  forbidden: [packageRoot],
});

afterAll(() => {
  for (const tree of trees) rmSync(tree, { recursive: true, force: true });
});

/**
 * The wiring from each direction's finder to the title that reports it,
 * watched failing. Above, both lists are empty and either could have been
 * handed to either title with nothing going red; here one direction is
 * broken at a time and exactly the title it belongs to is required to fail.
 */
describe("describeLayering", () => {
  const wired = (at: string) =>
    captureRegistration(
      () => import("./describeLayering.js"),
      (body) => {
        body({
          id: "corpus-layering",
          corpusRoot: join(at, "guarantees"),
          forbidden: [join(at, "src")],
        });
      },
    );

  /** A repository of its own, so a crossing specifier never reaches the fixture above. */
  const treeCrossing = (from: "corpus" | "code") => {
    const at = mkdtempSync(join(tmpdir(), "describe-layering-broken-"));
    trees.push(at);
    mkdirSync(join(at, "guarantees"), { recursive: true });
    mkdirSync(join(at, "src"), { recursive: true });
    writeFileSync(
      join(at, "guarantees", "corpus-layering.test.ts"),
      from === "corpus"
        ? 'import run from "../src/lib/run.js";\n'
        : 'import { describeLayering } from "@example/guarantees/selftest";\n',
    );
    writeFileSync(
      join(at, "src", "index.ts"),
      from === "code"
        ? 'import corpus from "../guarantees/corpus.js";\n'
        : "export default 1;\n",
    );
    return at;
  };

  it("reports a corpus file reaching into the code it judges, and not the other direction", async () => {
    const { tests } = await wired(treeCrossing("corpus"));
    expect(tests.get(_OUTWARD_TITLE)).toThrow("reaching into the code");
    expect(tests.get(_INWARD_TITLE)).not.toThrow();
  });

  it("reports code reaching into the corpus that judges it, and not the other direction", async () => {
    const { tests } = await wired(treeCrossing("code"));
    expect(tests.get(_INWARD_TITLE)).toThrow("reaching into the corpus");
    expect(tests.get(_OUTWARD_TITLE)).not.toThrow();
  });
});
