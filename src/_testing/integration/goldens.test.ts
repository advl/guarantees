import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { Refusal } from "../../lib/contract/index.js";
import { acceptGolden, GOLDENS_DIR } from "../../lib/golden/index.js";
import { reapStale, runEntry } from "../../lib/run/index.js";
import { LIFT_DIR, WORK_DIR } from "../../lib/runner/index.js";
import makeCorpus from "../makeCorpus.js";
import { renderEntry } from "./fixtures.js";

const engine = inject("engine");
const baseImage = inject("baseImage");

/**
 * An entry that generates a golden the way one does: it writes what it
 * found under its own lift directory, and compares it against what the tree
 * holds, going red when the tree holds nothing. The comparison is the
 * entry's, which is what makes a missing golden the entry's failure.
 */
const body = renderEntry(
  "surface",
  [
    'const { mkdirSync, writeFileSync, existsSync, readFileSync } = await import("node:fs");',
    `const lift = \`${WORK_DIR}/surface/${LIFT_DIR}\`;`,
    "mkdirSync(lift, { recursive: true });",
    `const generated = "alpha\\nbeta\\n";`,
    "writeFileSync(`${lift}/surface.txt`, generated);",
    `const golden = "${GOLDENS_DIR}/surface/surface.txt";`,
    "expect(existsSync(golden), golden).toBe(true);",
    'expect(readFileSync(golden, "utf8")).toBe(generated);',
  ].join(" "),
);

const corpus = makeCorpus({
  name: "goldens",
  entries: [{ row: { id: "surface" }, body }],
});
const [row] = corpus.rows;
if (row === undefined) throw new Error("the fixture corpus holds one row");
const context = corpus.context(engine, baseImage);
const golden = join(corpus.corpusRoot, GOLDENS_DIR, "surface", "surface.txt");

const reap = () => reapStale(engine, corpus.repositoryRoot);
beforeAll(reap);
afterAll(async () => {
  await reap();
  corpus.remove();
});

describe("a golden's update path", () => {
  it("takes what the entry generated inside its image out of a run that went red for want of it", async () => {
    const ran = await runEntry(row, context);
    expect(ran.ok).toBe(false);
    expect(existsSync(golden)).toBe(false);
    expect(acceptGolden(row, context, ran)).toEqual({
      added: ["surface.txt"],
      replaced: [],
      unchanged: [],
      orphaned: [],
    });
    expect(readFileSync(golden, "utf8")).toBe("alpha\nbeta\n");
  });

  it("turns the entry green once the tree holds what it generates, and reports the second accept as unchanged", async () => {
    const ran = await runEntry(row, context);
    expect(ran.ok).toBe(true);
    expect(acceptGolden(row, context, ran).unchanged).toEqual(["surface.txt"]);
  });

  it("replaces a golden the entry no longer generates the bytes of, and never writes one from a run that did not reach its container", async () => {
    writeFileSync(golden, "alpha\n");
    const ran = await runEntry(row, context);
    expect(acceptGolden(row, context, ran).replaced).toEqual(["surface.txt"]);
    expect(readFileSync(golden, "utf8")).toBe("alpha\nbeta\n");

    // A run that fails before its container starts lifts nothing, and what
    // the previous run lifted is gone rather than standing under this run's
    // name: the refusal is what keeps an accept from committing an earlier
    // tree's claim, and the golden is left exactly as it was.
    await expect(
      runEntry(row, { ...context, image: "localhost/absent:nothing" }),
    ).rejects.toThrow(Refusal);
    expect(
      existsSync(join(corpus.corpusRoot, WORK_DIR, "reports", "surface")),
    ).toBe(false);
    expect(readFileSync(golden, "utf8")).toBe("alpha\nbeta\n");
  });
});
