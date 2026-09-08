import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { Refusal } from "../../lib/contract/index.js";
import { reapStale, runEntry } from "../../lib/run/index.js";
import { REPORTS_DIR, WORK_DIR } from "../../lib/runner/index.js";
import { readReport } from "../../lib/verdict/index.js";
import makeCorpus from "../makeCorpus.js";
import { renderPassing } from "./fixtures.js";

const engine = inject("engine");
const baseImage = inject("baseImage");

const corpus = makeCorpus({
  name: "lifted-report",
  entries: [{ row: { id: "lifted" }, body: renderPassing("lifted") }],
  scripts: { "g:build:broken": "exit 1" },
});
const [row] = corpus.rows;
if (row === undefined) throw new Error("the fixture corpus holds one row");
const lifted = join(corpus.corpusRoot, WORK_DIR, REPORTS_DIR, "lifted.json");

/** A mark on the corpus's filesystem, dated as it dates files. */
const mark = () => {
  const path = join(corpus.corpusRoot, "mark");
  writeFileSync(path, "");
  return statSync(path).mtimeMs;
};

const reap = () => reapStale(engine, corpus.repositoryRoot);
beforeAll(reap);
afterAll(async () => {
  await reap();
  corpus.remove();
});

describe("the lifted report", () => {
  it("outlives the work directory and reads into the summary the verdict was judged from, dated as the runner wrote it", async () => {
    const before = mark();
    const ran = await runEntry(row, corpus.context(engine, baseImage));
    expect(ran.ok).toBe(true);
    const summary = readReport(readFileSync(lifted, "utf8"));
    expect(summary).toEqual({
      total: 1,
      passed: 1,
      failed: 0,
      failedTitles: [],
    });
    expect(statSync(lifted).mtimeMs).toBeGreaterThanOrEqual(before);
    expect(statSync(lifted).mtimeMs).toBeLessThanOrEqual(mark());
  });

  it("is replaced by the next run's own", async () => {
    const first = statSync(lifted).mtimeMs;
    await new Promise((resolve) => setTimeout(resolve, 20));
    await runEntry(row, corpus.context(engine, baseImage));
    expect(statSync(lifted).mtimeMs).toBeGreaterThan(first);
  });

  it("is forgotten when the next run stops in its build phase, rather than standing under that run's name", async () => {
    expect(existsSync(lifted)).toBe(true);
    await expect(
      runEntry(
        { ...row, build: ["g:build:broken"] },
        corpus.context(engine, baseImage),
      ),
    ).rejects.toThrow(Refusal);
    expect(existsSync(lifted)).toBe(false);
  });
});
