import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { spawnProcess } from "../../lib/process/index.js";
import _listLabelled from "../../lib/run/_listLabelled.js";
import {
  CORPUS_LABEL,
  ENTRY_LABEL,
  KILL_MULTIPLIER,
  reapStale,
  runEntry,
} from "../../lib/run/index.js";
import { REPORTS_DIR, WORK_DIR } from "../../lib/runner/index.js";
import makeCorpus from "../makeCorpus.js";
import { renderSleeping } from "./fixtures.js";

const engine = inject("engine");
const baseImage = inject("baseImage");

const corpus = makeCorpus({
  name: "kill",
  entries: [
    {
      row: { id: "sleeper", run: { class: "integration", p95: 1, budget: 1 } },
      body: renderSleeping("sleeper", 60),
    },
  ],
});
const [row] = corpus.rows;
if (row === undefined) throw new Error("the fixture corpus holds one row");

const byEntry = () =>
  _listLabelled(engine, spawnProcess, {
    [CORPUS_LABEL]: corpus.checkout,
    [ENTRY_LABEL]: row.id,
  });

const reap = () => reapStale(engine, corpus.repositoryRoot);
beforeAll(reap);
afterAll(async () => {
  await reap();
  corpus.remove();
});

describe("the hard kill", () => {
  it("removes the container at the kill multiplier times the budget and reports a red verdict naming both", async () => {
    const running = runEntry(row, corpus.context(engine, baseImage));
    // The container is observed alive before the verdict, so the kill is
    // seen as a removal and not as a run that never started.
    let alive: readonly string[] = [];
    for (let polled = 0; polled < 50 && alive.length === 0; polled += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      alive = (await byEntry()).names;
    }
    expect(alive).toHaveLength(1);

    const ran = await running;
    expect(ran.ok).toBe(false);
    expect(ran.reason).toMatch(
      new RegExp(
        `^sleeper was killed at \\d+\\.\\ds — ${KILL_MULTIPLIER} times its budget of 1s$`,
      ),
    );
    expect(ran.seconds).toBeGreaterThanOrEqual(KILL_MULTIPLIER);
    expect(ran.seconds).toBeLessThanOrEqual(10);

    expect((await byEntry()).names).toEqual([]);
    expect(existsSync(join(corpus.corpusRoot, WORK_DIR, row.id))).toBe(false);
    expect(
      existsSync(
        join(corpus.corpusRoot, WORK_DIR, REPORTS_DIR, `${row.id}.json`),
      ),
    ).toBe(false);
  });
});
