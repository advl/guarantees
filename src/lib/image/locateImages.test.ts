import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { Refusal } from "../contract/index.js";
import locateImages from "./locateImages.js";

/** A repository with a corpus under it, and image definitions where asked. */
const laid = (where: readonly ("corpus" | "repository")[]) => {
  const repositoryRoot = mkdtempSync(join(tmpdir(), "images-"));
  const corpusRoot = join(repositoryRoot, "guarantees");
  mkdirSync(corpusRoot);
  for (const at of where) {
    const root = at === "corpus" ? corpusRoot : repositoryRoot;
    mkdirSync(join(root, "images", "ts"), { recursive: true });
    writeFileSync(
      join(root, "images", "ts", "Containerfile"),
      "FROM scratch\n",
    );
  }
  return { corpusRoot, repositoryRoot };
};

describe("locateImages", () => {
  it("reads a corpus's own definitions where the corpus derives an image", () => {
    const { corpusRoot, repositoryRoot } = laid(["corpus"]);
    expect(locateImages(repositoryRoot, corpusRoot)).toBe(corpusRoot);
  });

  it("reads the repository's where it publishes one and its corpus derives none", () => {
    const { corpusRoot, repositoryRoot } = laid(["repository"]);
    expect(locateImages(repositoryRoot, corpusRoot)).toBe(repositoryRoot);
  });

  // A corpus pinning only images somebody else publishes defines none of its
  // own, and the answer has to be a directory either way — the repository's,
  // where a definition would go if one were ever written.
  it("answers the repository where neither holds a definition", () => {
    const { corpusRoot, repositoryRoot } = laid([]);
    expect(locateImages(repositoryRoot, corpusRoot)).toBe(repositoryRoot);
  });

  it("refuses a repository holding both, naming each place", () => {
    const { corpusRoot, repositoryRoot } = laid(["corpus", "repository"]);
    expect(() => locateImages(repositoryRoot, corpusRoot)).toThrow(Refusal);
    expect(() => locateImages(repositoryRoot, corpusRoot)).toThrow(
      /under both .*guarantees\/images and .*\/images/,
    );
  });

  // A corpus sitting at the repository root is one directory wearing both
  // names, so the two readings are the same reading and there is nothing to
  // be ambiguous about.
  it("does not read one directory as two when the corpus is the repository", () => {
    const root = mkdtempSync(join(tmpdir(), "images-"));
    mkdirSync(join(root, "images", "ts"), { recursive: true });
    expect(locateImages(root, root)).toBe(root);
  });
});
