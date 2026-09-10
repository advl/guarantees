import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, parse } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { Refusal } from "../contract/index.js";
import {
  CORPUS_DIR,
  locateCorpus,
  REGISTER_FILE,
  WORKFLOW_FILE,
} from "./index.js";

const roots: string[] = [];

/** A repository with a corpus in it, or with the named directory holding one. */
const repository = (
  directory: string = CORPUS_DIR,
  register = true,
  workflow = true,
) => {
  const root = mkdtempSync(join(tmpdir(), "locate-corpus-"));
  roots.push(root);
  mkdirSync(join(root, directory), { recursive: true });
  if (register) writeFileSync(join(root, directory, REGISTER_FILE), "");
  if (workflow) {
    const path = join(root, directory, "..", ...WORKFLOW_FILE.split("/"));
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, "");
  }
  return root;
};

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("locateCorpus", () => {
  it("finds the corpus under the working directory, with its register and the workflow it is checked against", () => {
    const root = repository();
    expect(locateCorpus(root)).toEqual({
      corpusRoot: join(root, CORPUS_DIR),
      repositoryRoot: root,
      registerPath: join(root, CORPUS_DIR, REGISTER_FILE),
      workflowPath: join(root, ...WORKFLOW_FILE.split("/")),
    });
  });

  it("takes the directory it is given instead, relative to the working directory or absolute", () => {
    const root = repository("tests/facts");
    expect(locateCorpus(root, "tests/facts").corpusRoot).toBe(
      join(root, "tests", "facts"),
    );
    expect(
      locateCorpus(root, join(root, "tests", "facts")).repositoryRoot,
    ).toBe(join(root, "tests"));
  });

  it("refuses a repository with no workflow, since every command reads the register against one", () => {
    const root = repository(CORPUS_DIR, true, false);
    expect(() => locateCorpus(root)).toThrow(Refusal);
    expect(() => locateCorpus(root)).toThrow(`no ${WORKFLOW_FILE} at`);
  });

  it("refuses a directory with no register in it, since an empty corpus would report green", () => {
    const root = repository(CORPUS_DIR, false);
    expect(() => locateCorpus(root)).toThrow(Refusal);
    expect(() => locateCorpus(root)).toThrow(`no ${REGISTER_FILE} at`);
  });

  it("refuses a working directory that holds no corpus at all, naming what to give instead", () => {
    const root = mkdtempSync(join(tmpdir(), "locate-corpus-"));
    roots.push(root);
    expect(() => locateCorpus(root, "elsewhere")).toThrow("--corpus");
  });

  it("refuses a corpus with no parent to be the repository a run mounts", () => {
    const root = parse(process.cwd()).root;
    expect(() => locateCorpus(root, root)).toThrow(
      "has no parent to be the repository",
    );
  });
});
