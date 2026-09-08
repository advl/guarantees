import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { spawnProcess } from "../../lib/process/index.js";
import _listLabelled from "../../lib/run/_listLabelled.js";
import {
  CORPUS_LABEL,
  ENTRY_LABEL,
  reapStale,
  runEntry,
} from "../../lib/run/index.js";
import { REPORTS_DIR, WORK_DIR } from "../../lib/runner/index.js";
import makeCorpus from "../makeCorpus.js";
import { renderFailing, renderPassing } from "./fixtures.js";

const engine = inject("engine");
const baseImage = inject("baseImage");

const corpus = makeCorpus({
  name: "teardown",
  entries: [
    { row: { id: "passing" }, body: renderPassing("passing") },
    { row: { id: "failing" }, body: renderFailing("failing") },
    {
      row: {
        id: "holding",
        holds: ["a-daemon"],
        teardown: ["g:teardown:a-daemon"],
      },
      body: renderPassing("holding"),
    },
    {
      row: {
        id: "leaking",
        holds: ["a-daemon"],
        teardown: ["g:teardown:broken"],
      },
      body: renderPassing("leaking"),
    },
  ],
  scripts: {
    "g:teardown:a-daemon":
      "node -e \"require('node:fs').writeFileSync('released.txt', process.cwd())\"",
    "g:teardown:broken": "exit 1",
  },
});
const rows = new Map(corpus.rows.map((row) => [row.id, row]));
const row = (id: string) => {
  const found = rows.get(id);
  if (found === undefined) throw new Error(`no fixture row ${id}`);
  return found;
};

/** What every torn-down entry leaves: no directory, no container of this checkout, a lifted report. */
const expectTornDown = async (id: string) => {
  expect(existsSync(join(corpus.corpusRoot, WORK_DIR, id))).toBe(false);
  const left = await _listLabelled(engine, spawnProcess, {
    [CORPUS_LABEL]: corpus.checkout,
    [ENTRY_LABEL]: id,
  });
  expect(left).toEqual({ answered: true, names: [] });
  expect(
    existsSync(join(corpus.corpusRoot, WORK_DIR, REPORTS_DIR, `${id}.json`)),
  ).toBe(true);
};

const reap = () => reapStale(engine, corpus.repositoryRoot);
beforeAll(reap);
afterAll(async () => {
  await reap();
  corpus.remove();
});

describe("teardown on every path", () => {
  it("tears a passing entry down after its green verdict", async () => {
    const ran = await runEntry(
      row("passing"),
      corpus.context(engine, baseImage),
    );
    expect(ran).toMatchObject({
      ok: true,
      reason: "passing: 1 passed, 0 failed, expected to pass",
    });
    await expectTornDown("passing");
  });

  it("tears a failing entry down after its red verdict, which names the assertion", async () => {
    const ran = await runEntry(
      row("failing"),
      corpus.context(engine, baseImage),
    );
    expect(ran.ok).toBe(false);
    expect(ran.reason).toBe(
      "failing: 0 passed, 1 failed, expected to pass — failing holds",
    );
    await expectTornDown("failing");
  });

  it("runs the row's teardown recipe on the host task face from the repository root", async () => {
    const ran = await runEntry(
      row("holding"),
      corpus.context(engine, baseImage),
    );
    expect(ran.ok).toBe(true);
    const released = join(corpus.repositoryRoot, "released.txt");
    expect(existsSync(released)).toBe(true);
    await expectTornDown("holding");
  });

  it("turns a green verdict red when a teardown recipe fails, naming the recipe and the hold", async () => {
    const ran = await runEntry(
      row("leaking"),
      corpus.context(engine, baseImage),
    );
    expect(ran.ok).toBe(false);
    expect(ran.reason).toContain(
      "leaking: 1 passed, 0 failed, expected to pass",
    );
    expect(ran.reason).toContain(
      "teardown recipe `g:teardown:broken` for leaking exited 1 — a-daemon may still be held",
    );
    await expectTornDown("leaking");
  });
});
