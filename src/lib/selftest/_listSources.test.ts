import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import _listSources from "./_listSources.js";

const trees: string[] = [];

/** A tree of files, keyed by path relative to its root. */
const written = (files: Readonly<Record<string, string>>) => {
  const root = mkdtempSync(join(tmpdir(), "list-sources-"));
  trees.push(root);
  for (const [path, text] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, text);
  }
  return root;
};

afterEach(() => {
  for (const root of trees.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("_listSources", () => {
  it("answers every source file under the tree with what it says, at any depth", () => {
    const root = written({
      "entry.test.ts": "one",
      "nested/deep/helper.mts": "two",
      "config.js": "three",
    });
    expect(
      _listSources(root)
        .map((source) => source.text)
        .sort(),
    ).toEqual(["one", "three", "two"]);
    expect(
      _listSources(root).every((source) => source.path.startsWith(root)),
    ).toBe(true);
  });

  it("passes over what nobody in the tree wrote, wherever in it that sits", () => {
    const root = written({
      "entry.test.ts": "mine",
      "node_modules/pkg/index.ts": "somebody else's",
      "nested/node_modules/pkg/index.ts": "somebody else's",
      ".work/scratch/product.ts": "generated",
      "dist/esm/index.js": "built",
      "coverage/report.js": "measured",
      ".git/hooks/thing.js": "the repository's own",
      "goldens/corpus-surface/surface.d.ts": "what an entry generated",
    });
    expect(_listSources(root).map((source) => source.text)).toEqual(["mine"]);
  });

  it("passes over a file no specifier can be written in", () => {
    const root = written({ "corpus.toml": "not source", "notes.md": "prose" });
    expect(_listSources(root)).toEqual([]);
  });
});
