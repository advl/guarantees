import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import catchRefusal from "../../_testing/catchRefusal.js";
import { IMAGE_A } from "../../_testing/fixtures.js";
import { Refusal } from "../contract/index.js";
import { hashImageInputs, IMAGES_DIR, PINNED_FILE } from "../image/index.js";
import _listPinnedImages from "./_listPinnedImages.js";

const roots: string[] = [];

/** A tree defining the named images, each with a record of its own. */
const tree = (names: readonly string[]) => {
  const root = mkdtempSync(join(tmpdir(), "list-pinned-"));
  roots.push(root);
  for (const name of names) {
    const definition = join(root, IMAGES_DIR, name);
    mkdirSync(definition, { recursive: true });
    writeFileSync(
      join(definition, "Containerfile"),
      "FROM docker.io/example\n",
    );
    writeFileSync(
      join(definition, PINNED_FILE),
      `digest = "${IMAGE_A}"\ninputs = "${hashImageInputs(root, name)}"\n`,
    );
  }
  return root;
};

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("_listPinnedImages", () => {
  it("answers every image the tree defines, with its record and what its files hash to now", () => {
    const root = tree(["ts", "browser"]);
    expect(
      _listPinnedImages(root)
        .map((image) => image.name)
        .sort(),
    ).toEqual(["browser", "ts"]);
    const [first] = _listPinnedImages(root);
    expect(first?.pinned.digest).toBe(IMAGE_A);
    expect(first?.inputs).toBe(hashImageInputs(root, first?.name ?? ""));
  });

  it("answers nothing for a tree that defines no image at all, which is a corpus deriving none", () => {
    const root = mkdtempSync(join(tmpdir(), "list-pinned-"));
    roots.push(root);
    expect(_listPinnedImages(root)).toEqual([]);
  });

  it("declines a definition nothing recorded by name, rather than dying on the file it went looking for", () => {
    const root = tree(["ts"]);
    mkdirSync(join(root, IMAGES_DIR, "browser"), { recursive: true });
    writeFileSync(
      join(root, IMAGES_DIR, "browser", "Containerfile"),
      "FROM docker.io/example\n",
    );
    expect(
      catchRefusal(Refusal, () => _listPinnedImages(root)).message,
    ).toContain(`no ${PINNED_FILE} beside ${IMAGES_DIR}/browser/`);
  });

  it("passes over a file sitting beside the definitions, since an image is a directory", () => {
    const root = tree(["ts"]);
    writeFileSync(join(root, IMAGES_DIR, "README.md"), "what these are\n");
    expect(_listPinnedImages(root)).toHaveLength(1);
  });
});
