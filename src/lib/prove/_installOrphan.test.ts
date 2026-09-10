import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { Refusal } from "../contract/index.js";
import { COLLECTS } from "../runner/index.js";
import _installOrphan from "./_installOrphan.js";
import { ORPHAN_ID } from "./index.js";

const corpora: string[] = [];

const fresh = () => {
  const corpus = mkdtempSync(join(tmpdir(), "install-orphan-"));
  corpora.push(corpus);
  return corpus;
};

afterEach(() => {
  for (const corpus of corpora.splice(0)) {
    rmSync(corpus, { recursive: true, force: true });
  }
});

describe("_installOrphan", () => {
  it("puts a file the runner collects into the corpus and answers its removal", () => {
    const corpus = fresh();
    const path = join(corpus, `${ORPHAN_ID}${COLLECTS}`);
    const restore = _installOrphan(corpus);
    expect(readFileSync(path, "utf8")).toContain("it(");
    restore();
    expect(existsSync(path)).toBe(false);
  });

  it("answers a removal that can be called on a tree somebody else already tidied", () => {
    const corpus = fresh();
    const restore = _installOrphan(corpus);
    rmSync(join(corpus, `${ORPHAN_ID}${COLLECTS}`));
    expect(restore).not.toThrow();
  });

  it("refuses a corpus already holding that file, since a tree broken before this broke it makes the red meaningless", () => {
    const corpus = fresh();
    writeFileSync(join(corpus, `${ORPHAN_ID}${COLLECTS}`), "somebody else's");
    expect(() => _installOrphan(corpus)).toThrow(Refusal);
    expect(() => _installOrphan(corpus)).toThrow("is already in the corpus");
    expect(readFileSync(join(corpus, `${ORPHAN_ID}${COLLECTS}`), "utf8")).toBe(
      "somebody else's",
    );
  });
});
