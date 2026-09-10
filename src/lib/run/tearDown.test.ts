import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import fakeSpawn, { type SpawnAnswer } from "../../_testing/fakeSpawn.js";
import { REPORT_GREEN, renderReport } from "../../_testing/fixtures.js";
import makeCorpus, { type FixtureCorpus } from "../../_testing/makeCorpus.js";
import type { Spawned } from "../process/index.js";
import { UNMEASURED_S } from "../register/index.js";
import {
  LIFT_DIR,
  REPORT_FILE,
  REPORTS_DIR,
  WORK_DIR,
} from "../runner/index.js";
import {
  CORPUS_LABEL,
  ENTRY_LABEL,
  type Engine,
  type RunContext,
  TASK_FACE,
  tearDown,
} from "./index.js";

const engine: Engine = { binary: "engine", version: "1" };
const clean: Spawned = { code: 0, out: "", killed: false };

const corpora: FixtureCorpus[] = [];

/** A corpus of one row, its work directory holding a green report, and the context to tear it down. */
const prepared = (
  row: Partial<Parameters<typeof makeCorpus>[0]["entries"][number]["row"]> = {},
  answer: SpawnAnswer = () => clean,
) => {
  const corpus = makeCorpus({
    entries: [{ row: { id: "held", ...row }, body: "" }],
  });
  corpora.push(corpus);
  const workDir = join(corpus.corpusRoot, WORK_DIR, "held");
  mkdirSync(workDir, { recursive: true });
  writeFileSync(join(workDir, REPORT_FILE), renderReport(REPORT_GREEN));
  const { spawn, calls } = fakeSpawn(answer);
  const context: RunContext = { ...corpus.context(engine, "image"), spawn };
  const [held] = corpus.rows;
  if (held === undefined) throw new Error("the fixture corpus holds one row");
  return { corpus, row: held, context, calls, workDir };
};

/** An engine whose listings answer in turn. */
const listing = (...answers: readonly (string | null)[]): SpawnAnswer => {
  let listed = 0;
  return ({ args }) => {
    if (args[0] !== "ps") return clean;
    const answer = listed < answers.length ? answers[listed] : "";
    listed += 1;
    return answer === null
      ? { code: 125, out: "", killed: false }
      : { ...clean, out: answer ?? "" };
  };
};

afterEach(() => {
  for (const corpus of corpora.splice(0)) corpus.remove();
});

describe("tearDown", () => {
  it("removes every container of the entry, found by the checkout and the entry labels, and verifies", async () => {
    const { row, context, calls, corpus } = prepared(
      {},
      listing("held-build-0\nheld-measured", ""),
    );
    expect(await tearDown(row, context, true)).toEqual([]);
    expect(calls.map((call) => call.args[0])).toEqual(["ps", "rm", "rm", "ps"]);
    expect(calls[0]?.args).toContain(
      `label=${CORPUS_LABEL}=${corpus.checkout}`,
    );
    expect(calls[0]?.args).toContain(`label=${ENTRY_LABEL}=held`);
    expect(calls[1]?.args.at(-1)).toBe("held-build-0");
    expect(calls[2]?.args.at(-1)).toBe("held-measured");
  });

  it("spawns no recipe when the row names none", async () => {
    const { row, context, calls } = prepared();
    await tearDown(row, context, true);
    expect(calls.every((call) => call.binary === engine.binary)).toBe(true);
  });

  it("runs each teardown recipe on the host task face from the repository root", async () => {
    const { row, context, calls, corpus } = prepared({
      holds: ["a-daemon"],
      teardown: ["g:teardown:a-daemon", "g:teardown:cache"],
    });
    expect(await tearDown(row, context, true)).toEqual([]);
    const recipes = calls.filter((call) => call.binary === TASK_FACE[0]);
    expect(recipes.map((call) => call.args)).toEqual([
      ["run", "g:teardown:a-daemon"],
      ["run", "g:teardown:cache"],
    ]);
    expect(recipes[0]?.options).toEqual({
      cwd: corpus.repositoryRoot,
      deadlineMs: UNMEASURED_S * 1000,
    });
  });

  it("faults a failing recipe, naming it and what may still be held", async () => {
    const { row, context } = prepared(
      { holds: ["a-daemon", "a-port"], teardown: ["g:teardown:a-daemon"] },
      ({ binary }) => (binary === TASK_FACE[0] ? { ...clean, code: 1 } : clean),
    );
    expect(await tearDown(row, context, true)).toEqual([
      "teardown recipe `g:teardown:a-daemon` for held exited 1 — a-daemon, a-port may still be held",
    ]);
  });

  it("faults a recipe killed at the deadline, naming the deadline", async () => {
    const { row, context } = prepared(
      { holds: ["a-daemon"], teardown: ["g:teardown:a-daemon"] },
      ({ binary }) =>
        binary === TASK_FACE[0] ? { code: null, out: "", killed: true } : clean,
    );
    expect(await tearDown(row, context, true)).toEqual([
      `teardown recipe \`g:teardown:a-daemon\` for held did not return within ${UNMEASURED_S}s — a-daemon may still be held`,
    ]);
  });

  it("lifts the judged report clear, dated as the runner wrote it, and removes the work directory", async () => {
    const { row, context, corpus, workDir } = prepared();
    const written = new Date(Date.now() - 90_000);
    utimesSync(join(workDir, REPORT_FILE), written, written);
    await tearDown(row, context, true);
    expect(existsSync(workDir)).toBe(false);
    const lifted = join(corpus.corpusRoot, WORK_DIR, REPORTS_DIR, "held.json");
    expect(readFileSync(lifted, "utf8")).toBe(renderReport(REPORT_GREEN));
    // Within a second and never equal to it. A date reaches the filesystem as
    // seconds and nanoseconds and comes back as a float, and how much of it
    // survives is the mount's business: a filesystem keeping whole seconds
    // answers up to a second away from what was asked, on a machine where
    // nothing is wrong. What is claimed is the date the runner wrote, and that
    // date is a minute and a half in the past, so a lift stamping the report
    // with the present instead is off by ninety times this tolerance.
    expect(Math.abs(statSync(lifted).mtimeMs - written.getTime())).toBeLessThan(
      1_000,
    );
  });

  it("lifts the report and removes the directory on a faulting path too", async () => {
    const { row, context, corpus, workDir } = prepared(
      { holds: ["a-daemon"], teardown: ["g:teardown:a-daemon"] },
      ({ binary }) => (binary === TASK_FACE[0] ? { ...clean, code: 1 } : clean),
    );
    expect(await tearDown(row, context, true)).toHaveLength(1);
    expect(existsSync(workDir)).toBe(false);
    expect(
      existsSync(join(corpus.corpusRoot, WORK_DIR, REPORTS_DIR, "held.json")),
    ).toBe(true);
  });

  it("carries what the entry generated out of the work directory, dated as the entry wrote it", async () => {
    const { row, context, corpus, workDir } = prepared();
    const lift = join(workDir, LIFT_DIR);
    mkdirSync(lift);
    writeFileSync(join(lift, "surface.txt"), "one line per unit\n");
    const written = new Date(Date.now() - 90_000);
    utimesSync(join(lift, "surface.txt"), written, written);
    expect(await tearDown(row, context, true)).toEqual([]);
    expect(existsSync(workDir)).toBe(false);
    const carried = join(
      corpus.corpusRoot,
      WORK_DIR,
      REPORTS_DIR,
      "held",
      "surface.txt",
    );
    expect(readFileSync(carried, "utf8")).toBe("one line per unit\n");
    // Within a second and never equal to it, for the reason above: the date
    // the entry wrote is a minute and a half in the past, so a lift stamping
    // the file with the present is off by ninety times this tolerance.
    expect(
      Math.abs(statSync(carried).mtimeMs - written.getTime()),
    ).toBeLessThan(1_000);
  });

  it("carries nothing out of a run no verdict was judged from, whatever it generated", async () => {
    const { row, context, corpus, workDir } = prepared();
    mkdirSync(join(workDir, LIFT_DIR));
    writeFileSync(join(workDir, LIFT_DIR, "surface.txt"), "generated\n");
    await tearDown(row, context, false);
    expect(
      existsSync(join(corpus.corpusRoot, WORK_DIR, REPORTS_DIR, "held")),
    ).toBe(false);
  });

  it("faults a directory under the lift and carries the files beside it, rather than flattening one or dropping the other", async () => {
    const { row, context, corpus, workDir } = prepared();
    const lift = join(workDir, LIFT_DIR);
    mkdirSync(join(lift, "nested"), { recursive: true });
    writeFileSync(join(lift, "surface.txt"), "generated\n");
    expect(await tearDown(row, context, true)).toEqual([
      `${WORK_DIR}/held/${LIFT_DIR} holds \`nested\`, which is not a file — what an entry lifts is a flat set of files, one per unit a golden pins, and a directory there is generated evidence this leaves behind rather than carries out`,
    ]);
    expect(
      existsSync(
        join(corpus.corpusRoot, WORK_DIR, REPORTS_DIR, "held", "surface.txt"),
      ),
    ).toBe(true);
  });

  it("lifts nothing when the run left no report, and still removes the directory", async () => {
    const { row, context, corpus, workDir } = prepared();
    writeFileSync(join(workDir, REPORT_FILE), "");
    const { rmSync } = await import("node:fs");
    rmSync(join(workDir, REPORT_FILE));
    await tearDown(row, context, true);
    expect(existsSync(workDir)).toBe(false);
    expect(existsSync(join(corpus.corpusRoot, WORK_DIR, REPORTS_DIR))).toBe(
      false,
    );
  });

  it("faults a container that survives its removal, naming it", async () => {
    const { row, context } = prepared(
      {},
      listing("held-measured", "held-measured"),
    );
    expect(await tearDown(row, context, true)).toEqual([
      "held left held-measured running after teardown — still holding the repository mounted, so nothing measured after this is trustworthy until they are removed",
    ]);
  });

  it("faults an engine that does not say whether a container survived", async () => {
    const { row, context } = prepared({}, listing("", null));
    expect(await tearDown(row, context, true)).toEqual([
      "the engine did not say whether held left a container running — an engine that cannot be asked is not evidence that the machine is clear",
    ]);
  });

  it("faults a work directory that could not be removed", async () => {
    const { row, context, workDir } = prepared();
    const locked = join(workDir, "locked");
    mkdirSync(locked);
    writeFileSync(join(locked, "product"), "");
    chmodSync(locked, 0o500);
    try {
      const faults = await tearDown(row, context, true);
      expect(faults).toHaveLength(1);
      expect(faults[0]).toContain(`${WORK_DIR}/held could not be removed`);
    } finally {
      chmodSync(locked, 0o700);
    }
  });
});
