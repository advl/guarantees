import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { reapStale, runEntry } from "../../lib/run/index.js";
import makeCorpus from "../makeCorpus.js";
import { renderEntry } from "./fixtures.js";

const engine = inject("engine");
const baseImage = inject("baseImage");

/**
 * What the repository's own install would answer with if the run did not
 * cover it: a package under the runner's own name, at a version no image
 * carries, in the one place the runtime looks before it reaches the image's
 * root.
 */
const IMPOSTOR = { name: "vitest", version: "0.0.0-host" };

const corpus = makeCorpus({
  name: "masked-install",
  entries: [
    {
      row: { id: "masked" },
      body: renderEntry(
        "masked",
        [
          'const { readdirSync } = await import("node:fs");',
          'const { createRequire } = await import("node:module");',
          'expect(readdirSync("/workspace/node_modules")).toEqual([]);',
          'const from = createRequire("/workspace/guarantees/noop.js");',
          'expect(from.resolve("vitest/package.json")).toMatch(/^\\/node_modules\\//);',
        ].join(" "),
      ),
    },
  ],
});
const [row] = corpus.rows;
if (row === undefined) throw new Error("the fixture corpus holds one row");

const installed = join(corpus.repositoryRoot, "node_modules", "vitest");
mkdirSync(installed, { recursive: true });
writeFileSync(join(installed, "package.json"), JSON.stringify(IMPOSTOR));

const reap = () => reapStale(engine, corpus.repositoryRoot);
beforeAll(reap);
afterAll(async () => {
  await reap();
  corpus.remove();
});

describe("the masked install", () => {
  it("leaves an entry nothing of the repository's own install to resolve, so the toolchain it reaches is the image's", async () => {
    const ran = await runEntry(row, corpus.context(engine, baseImage));
    expect(ran.reason).toBe("masked: 1 passed, 0 failed, expected to pass");
    expect(ran.ok).toBe(true);
  });
});
