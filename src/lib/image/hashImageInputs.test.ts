import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { Refusal } from "../contract/index.js";
import { hashImageInputs, INPUTS_PATTERN } from "./index.js";

const scratch: string[] = [];

/** A repository root holding one image directory with the given files. */
const tree = (files: Readonly<Record<string, string>>) => {
  const root = mkdtempSync(join(tmpdir(), "image-inputs-"));
  scratch.push(root);
  for (const [path, text] of Object.entries(files)) {
    const full = join(root, "images", "ts", path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, text);
  }
  return root;
};

const BASE = {
  Containerfile: "FROM scratch\nCOPY images/ts/package.json /\n",
  "package.json": '{ "name": "@example/image" }\n',
};

afterEach(() => {
  for (const directory of scratch.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("hashImageInputs", () => {
  it("answers a sha256 in the inputs shape, the same for the same tree twice", () => {
    const first = hashImageInputs(tree(BASE), "ts");
    const second = hashImageInputs(tree(BASE), "ts");
    expect(first).toMatch(INPUTS_PATTERN);
    expect(first).toBe(second);
  });

  it("changes when one byte of one file changes", () => {
    const changed = {
      ...BASE,
      "package.json": '{ "name": "@example/imagf" }\n',
    };
    expect(hashImageInputs(tree(BASE), "ts")).not.toBe(
      hashImageInputs(tree(changed), "ts"),
    );
  });

  it("does not count the pinned record as an input", () => {
    const pinned = { ...BASE, "pinned.toml": 'digest = "x"\ninputs = "y"\n' };
    expect(hashImageInputs(tree(BASE), "ts")).toBe(
      hashImageInputs(tree(pinned), "ts"),
    );
  });

  it("does not count a stray install as an input", () => {
    const installed = { ...BASE, "node_modules/left/index.js": "export {};\n" };
    expect(hashImageInputs(tree(BASE), "ts")).toBe(
      hashImageInputs(tree(installed), "ts"),
    );
  });

  it("tells two files that swapped contents apart", () => {
    const swapped = {
      Containerfile: BASE["package.json"],
      "package.json": BASE.Containerfile,
    };
    expect(hashImageInputs(tree(BASE), "ts")).not.toBe(
      hashImageInputs(tree(swapped), "ts"),
    );
  });

  it("counts a file in a nested directory", () => {
    const nested = { ...BASE, "patches/one.patch": "--- a\n+++ b\n" };
    expect(hashImageInputs(tree(BASE), "ts")).not.toBe(
      hashImageInputs(tree(nested), "ts"),
    );
  });

  it("refuses an image directory that does not exist", () => {
    const root = tree(BASE);
    expect(() => hashImageInputs(root, "browser")).toThrow(Refusal);
    expect(() => hashImageInputs(root, "browser")).toThrow(
      "no image directory at",
    );
  });

  it("refuses a directory without a Containerfile", () => {
    const root = tree({ "package.json": BASE["package.json"] });
    expect(() => hashImageInputs(root, "ts")).toThrow("no Containerfile under");
  });
});
