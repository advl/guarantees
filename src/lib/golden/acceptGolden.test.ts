import {
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import makeCorpus, { type FixtureCorpus } from "../../_testing/makeCorpus.js";
import { Refusal } from "../contract/index.js";
import type { Engine, Ran } from "../run/index.js";
import { REPORTS_DIR, WORK_DIR } from "../runner/index.js";
import { acceptGolden, GOLDENS_DIR } from "./index.js";

const engine: Engine = { binary: "engine", version: "1" };
const corpora: FixtureCorpus[] = [];

/** A corpus of one row whose run lifted the given files, and the run that lifted them. */
const prepared = (lifted: Readonly<Record<string, string>>) => {
  const corpus = makeCorpus({
    entries: [{ row: { id: "surface" }, body: "" }],
  });
  corpora.push(corpus);
  const carried = join(corpus.corpusRoot, WORK_DIR, REPORTS_DIR, "surface");
  mkdirSync(carried, { recursive: true });
  // The mark is taken before the files are written and off the same
  // filesystem they land on, as a run's own mark is: two dates from one
  // filesystem order correctly whatever its granularity, and a host clock
  // against a stored one does not.
  const mark = join(corpus.corpusRoot, WORK_DIR, "mark");
  writeFileSync(mark, "");
  const startedAt = statSync(mark).mtimeMs;
  for (const [name, body] of Object.entries(lifted)) {
    writeFileSync(join(carried, name), body);
  }
  const goldens = join(corpus.corpusRoot, GOLDENS_DIR, "surface");
  const [row] = corpus.rows;
  if (row === undefined) throw new Error("the fixture corpus holds one row");
  const ran: Ran = {
    ok: true,
    reason: "surface: green",
    seconds: 1,
    startedAt,
  };
  return {
    corpus,
    row,
    ran,
    carried,
    goldens,
    context: corpus.context(engine, "image"),
  };
};

/** A golden already in the tree, as a committed one is. */
const committed = (goldens: string, name: string, body: string) => {
  mkdirSync(goldens, { recursive: true });
  writeFileSync(join(goldens, name), body);
};

afterEach(() => {
  for (const corpus of corpora.splice(0)) corpus.remove();
});

describe("acceptGolden", () => {
  it("writes what the run generated into the row's golden directory, naming each as new", () => {
    const { row, context, ran, goldens } = prepared({
      "surface.txt": "one\ntwo\n",
      "exports.txt": "three\n",
    });
    expect(acceptGolden(row, context, ran)).toEqual({
      added: ["exports.txt", "surface.txt"],
      replaced: [],
      unchanged: [],
      orphaned: [],
    });
    expect(readFileSync(join(goldens, "surface.txt"), "utf8")).toBe(
      "one\ntwo\n",
    );
  });

  it("separates a golden whose bytes the run changed from one it generated identically", () => {
    const { row, context, ran, goldens } = prepared({
      "surface.txt": "one\ntwo\n",
      "exports.txt": "three\n",
    });
    committed(goldens, "surface.txt", "one\n");
    committed(goldens, "exports.txt", "three\n");
    expect(acceptGolden(row, context, ran)).toEqual({
      added: [],
      replaced: ["surface.txt"],
      unchanged: ["exports.txt"],
      orphaned: [],
    });
    expect(readFileSync(join(goldens, "surface.txt"), "utf8")).toBe(
      "one\ntwo\n",
    );
  });

  it("names a golden the run no longer generates and leaves it standing, since what stopped being reported on is a question for the diff", () => {
    const { row, context, ran, goldens } = prepared({ "surface.txt": "one\n" });
    committed(goldens, "retired.txt", "what a row used to pin\n");
    expect(acceptGolden(row, context, ran).orphaned).toEqual(["retired.txt"]);
    expect(readFileSync(join(goldens, "retired.txt"), "utf8")).toBe(
      "what a row used to pin\n",
    );
  });

  it("refuses a run that lifted nothing, rather than replacing a golden with silence", () => {
    const { row, context, ran, goldens } = prepared({});
    committed(goldens, "surface.txt", "what the tree still claims\n");
    expect(() => acceptGolden(row, context, ran)).toThrow(Refusal);
    expect(() => acceptGolden(row, context, ran)).toThrow("lifted nothing");
    expect(readFileSync(join(goldens, "surface.txt"), "utf8")).toBe(
      "what the tree still claims\n",
    );
  });

  it("refuses a run whose entry directory is not there at all", () => {
    const { row, context, ran, corpus } = prepared({});
    rmSync(join(corpus.corpusRoot, WORK_DIR, REPORTS_DIR, "surface"), {
      recursive: true,
    });
    expect(() => acceptGolden(row, context, ran)).toThrow("lifted nothing");
  });

  it("refuses a file older than the run that is supposed to have generated it, naming it", () => {
    const { row, context, ran, carried, goldens } = prepared({
      "surface.txt": "an earlier tree\n",
    });
    const before = new Date(ran.startedAt - 90_000);
    utimesSync(join(carried, "surface.txt"), before, before);
    expect(() => acceptGolden(row, context, ran)).toThrow(Refusal);
    expect(() => acceptGolden(row, context, ran)).toThrow(
      "which is older than the run that lifted it",
    );
    committed(goldens, "surface.txt", "what the tree still claims\n");
    expect(() => acceptGolden(row, context, ran)).toThrow("`surface.txt`");
  });
});
