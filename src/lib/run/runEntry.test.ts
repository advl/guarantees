import {
  existsSync,
  mkdirSync,
  readFileSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import fakeSpawn, { type SpawnCall } from "../../_testing/fakeSpawn.js";
import {
  REPORT_EMPTY,
  REPORT_GREEN,
  REPORT_RED,
  renderReport,
} from "../../_testing/fixtures.js";
import makeCorpus, { type FixtureCorpus } from "../../_testing/makeCorpus.js";
import { Refusal } from "../contract/index.js";
import type { Spawned } from "../process/index.js";
import { type Row, UNMEASURED_S } from "../register/index.js";
import { REPORT_FILE, REPORTS_DIR, WORK_DIR } from "../runner/index.js";
import {
  CORPUS_LABEL,
  ENGINE_FAULT_CODE,
  type Engine,
  KILL_MULTIPLIER,
  NAME_PREFIX,
  type RunContext,
  runEntry,
} from "./index.js";

const engine: Engine = { binary: "engine", version: "1" };
const clean: Spawned = { code: 0, out: "", killed: false };

/** How a scripted engine answers each part of the lifecycle. */
type Script = {
  /** What the build container answers; it leaves a product unless told not to. */
  readonly build?: Spawned;
  readonly buildLeaves?: boolean;
  /** How long the build container takes to answer, in milliseconds. */
  readonly buildMs?: number;
  /** What the measured container answers; a killed one has its removal awaited first. */
  readonly measured?: Spawned;
  /** The report the measured container writes; `null` for none. Dated as given. */
  readonly report?: unknown;
  readonly reportAgeMs?: number;
  /** What the listings answer, in turn; `null` is an engine that does not answer. */
  readonly listings?: readonly (string | null)[];
  /** What a task-face recipe answers. */
  readonly recipe?: Spawned;
  /** Thrown by the measured spawn, for a failure that is not the engine's answer. */
  readonly throws?: unknown;
};

const corpora: FixtureCorpus[] = [];

/** The host directory a run's second mount comes from, read off the argv. */
const workMount = (args: readonly string[]) => {
  const mounts = args.filter((_, index) => args[index - 1] === "-v");
  return (mounts[1] ?? "").split(":")[0] ?? "";
};

const containerName = (args: readonly string[]) =>
  args[args.indexOf("--name") + 1] ?? "";

/** A corpus of one row under a scripted engine, and the means to run it. */
const prepared = (row: Partial<Row> = {}, script: Script = {}) => {
  const corpus = makeCorpus({
    entries: [{ row: { id: "entry", ...row }, body: "" }],
  });
  corpora.push(corpus);
  const listings = [...(script.listings ?? [])];
  const { spawn, calls } = fakeSpawn(async (call) => {
    const [subcommand] = call.args;
    if (call.binary !== engine.binary) return script.recipe ?? clean;
    if (subcommand === "ps") {
      const answer = listings.length > 0 ? listings.shift() : "";
      return answer === null || answer === undefined
        ? { code: 125, out: "", killed: false }
        : { ...clean, out: answer };
    }
    if (subcommand !== "run") return clean;
    const workDir = workMount(call.args);
    if (containerName(call.args).includes("-build-")) {
      if (script.buildLeaves !== false) {
        writeFileSync(join(workDir, "product"), "built");
      }
      if (script.buildMs !== undefined) {
        await new Promise((resolve) => setTimeout(resolve, script.buildMs));
      }
      return script.build ?? clean;
    }
    if (script.throws !== undefined) throw script.throws;
    if (script.report !== null) {
      const path = join(workDir, REPORT_FILE);
      writeFileSync(path, renderReport(script.report ?? REPORT_GREEN));
      if (script.reportAgeMs !== undefined) {
        const dated = new Date(Date.now() - script.reportAgeMs);
        utimesSync(path, dated, dated);
      }
    }
    const measured = script.measured ?? clean;
    if (measured.killed) await call.options.onDeadline?.();
    return measured;
  });
  const context: RunContext = { ...corpus.context(engine, "image"), spawn };
  const [entry] = corpus.rows;
  if (entry === undefined) throw new Error("the fixture corpus holds one row");
  const workDir = join(corpus.corpusRoot, WORK_DIR, "entry");
  const lifted = join(corpus.corpusRoot, WORK_DIR, REPORTS_DIR, "entry.json");
  return { corpus, row: entry, context, calls, workDir, lifted };
};

/** The `run` calls the engine saw, by container name. */
const runs = (calls: readonly SpawnCall[]) =>
  calls.filter((call) => call.args[0] === "run").map((call) => call.args);

/** Every path out of a run ends the same way: the directory gone, the containers swept. */
const expectTornDown = (
  calls: readonly SpawnCall[],
  workDir: string,
  corpus: FixtureCorpus,
) => {
  expect(existsSync(workDir)).toBe(false);
  const listings = calls.filter((call) => call.args[0] === "ps");
  expect(listings.length).toBeGreaterThanOrEqual(2);
  expect(listings.at(-1)?.args).toContain(
    `label=${CORPUS_LABEL}=${corpus.checkout}`,
  );
};

afterEach(() => {
  for (const corpus of corpora.splice(0)) corpus.remove();
});

describe("runEntry", () => {
  it("answers a green verdict from the report, with the seconds of the measured phase", async () => {
    const { row, context, calls, workDir, corpus, lifted } = prepared();
    const ran = await runEntry(row, context);
    expect(ran.ok).toBe(true);
    expect(ran.reason).toBe("entry: 2 passed, 0 failed, expected to pass");
    expect(ran.seconds).toBeGreaterThanOrEqual(0);
    expectTornDown(calls, workDir, corpus);
    expect(readFileSync(lifted, "utf8")).toBe(renderReport(REPORT_GREEN));
  });

  it("answers a red verdict naming the failed assertion", async () => {
    const { row, context } = prepared({}, { report: REPORT_RED });
    const ran = await runEntry(row, context);
    expect(ran.ok).toBe(false);
    expect(ran.reason).toContain("corpus-can-fail asserts a falsehood");
  });

  it("judges the row designed to fail from the report, like any other", async () => {
    const { row, context } = prepared(
      { expect: "fail" },
      { report: REPORT_RED },
    );
    expect((await runEntry(row, context)).ok).toBe(true);
  });

  it("measures the seconds of the measured phase alone, not the build", async () => {
    // A slow build and a fast measured phase: a window opened before the
    // build reads as longer than the build.
    const buildMs = 200;
    const { row, context } = prepared({ build: ["g:build:slow"] }, { buildMs });
    const started = performance.now();
    const ran = await runEntry(row, context);
    expect(performance.now() - started).toBeGreaterThanOrEqual(buildMs);
    expect(ran.seconds).toBeLessThan(buildMs / 1000);
  });

  it("names build containers by recipe position and the measured one by phase, all under the checkout label", async () => {
    const { row, context, calls, corpus } = prepared({
      build: ["g:build:one", "g:build:two"],
    });
    await runEntry(row, context);
    expect(runs(calls).map(containerName)).toEqual([
      `${NAME_PREFIX}-entry-build-0-${process.pid}`,
      `${NAME_PREFIX}-entry-build-1-${process.pid}`,
      `${NAME_PREFIX}-entry-measured-${process.pid}`,
    ]);
    for (const argv of runs(calls)) {
      expect(argv).toContain(`${CORPUS_LABEL}=${corpus.checkout}`);
    }
    expect(runs(calls)[0]?.slice(-3)).toEqual(["bun", "run", "g:build:one"]);
  });

  it("walls the measured phase off the network for isolation image and keeps it for image-net, and never walls a build", async () => {
    const walled = prepared({ build: ["g:build:x"] });
    await runEntry(walled.row, walled.context);
    const [build, measured] = runs(walled.calls);
    expect(build).not.toContain("--network=none");
    expect(measured).toContain("--network=none");
    const open = prepared({ isolation: "image-net" });
    await runEntry(open.row, open.context);
    expect(runs(open.calls)[0]).not.toContain("--network=none");
  });

  it("turns a kill at the deadline into a red verdict naming the multiplier and the budget, and neither reads nor lifts the report the runner had written", async () => {
    const { row, context, calls, workDir, corpus, lifted } = prepared(
      {},
      { measured: { code: null, out: "", killed: true }, report: REPORT_GREEN },
    );
    const ran = await runEntry(row, context);
    expect(ran.ok).toBe(false);
    expect(ran.reason).toMatch(
      new RegExp(
        `^entry was killed at \\d+\\.\\ds — ${KILL_MULTIPLIER} times its budget of 30s$`,
      ),
    );
    expect(calls.some((call) => call.args[0] === "rm")).toBe(true);
    expectTornDown(calls, workDir, corpus);
    expect(existsSync(lifted)).toBe(false);
  });

  it("refuses naming the engine when its own exit code comes with no report, in either phase", async () => {
    const fault = { ...clean, code: ENGINE_FAULT_CODE };
    const measured = prepared({}, { measured: fault, report: null });
    await expect(runEntry(measured.row, measured.context)).rejects.toThrow(
      `the engine exited ${ENGINE_FAULT_CODE} and entry left no report`,
    );
    const build = prepared({ build: ["g:build:x"] }, { build: fault });
    await expect(runEntry(build.row, build.context)).rejects.toThrow(
      `the engine exited ${ENGINE_FAULT_CODE} on build recipe \`g:build:x\` for entry`,
    );
  });

  it("refuses a failing build recipe, naming it, and never starts the measured phase", async () => {
    const { row, context, calls, workDir, corpus } = prepared(
      { build: ["g:build:fixture"] },
      { build: { ...clean, code: 1 } },
    );
    const run = runEntry(row, context);
    await expect(run).rejects.toThrow(Refusal);
    await expect(run).rejects.toThrow(
      "build recipe `g:build:fixture` for entry failed — the measured phase never started",
    );
    expect(runs(calls)).toHaveLength(1);
    expectTornDown(calls, workDir, corpus);
  });

  it("refuses a build recipe killed at the deadline, naming the deadline", async () => {
    const { row, context } = prepared(
      { build: ["g:build:fixture"] },
      { build: { code: null, out: "", killed: true } },
    );
    await expect(runEntry(row, context)).rejects.toThrow(
      `build recipe \`g:build:fixture\` for entry did not return within ${UNMEASURED_S}s`,
    );
  });

  it("refuses a build phase that left nothing in the work directory", async () => {
    const { row, context, calls } = prepared(
      { build: ["g:build:fixture"] },
      { buildLeaves: false },
    );
    await expect(runEntry(row, context)).rejects.toThrow(
      `\`g:build:fixture\` left nothing under ${WORK_DIR}/entry`,
    );
    expect(runs(calls)).toHaveLength(1);
  });

  it("refuses a run that left no report", async () => {
    const { row, context, workDir, calls, corpus } = prepared(
      {},
      { report: null },
    );
    await expect(runEntry(row, context)).rejects.toThrow(
      "entry left no report of its own",
    );
    expectTornDown(calls, workDir, corpus);
  });

  it("refuses a report dated before the marker, and lifts nothing under the run's name", async () => {
    const { row, context, lifted } = prepared({}, { reportAgeMs: 120_000 });
    await expect(runEntry(row, context)).rejects.toThrow(
      "entry left a report older than this run",
    );
    expect(existsSync(lifted)).toBe(false);
  });

  it("refuses a run in which nothing executed", async () => {
    const { row, context } = prepared({}, { report: REPORT_EMPTY });
    await expect(runEntry(row, context)).rejects.toThrow(
      "entry executed no test",
    );
  });

  it("forgets the previous run's lifted report before anything starts", async () => {
    const { row, context, lifted } = prepared(
      { build: ["g:build:fixture"] },
      { build: { ...clean, code: 1 } },
    );
    mkdirSync(join(lifted, ".."), { recursive: true });
    writeFileSync(lifted, renderReport(REPORT_GREEN));
    await expect(runEntry(row, context)).rejects.toThrow(Refusal);
    expect(existsSync(lifted)).toBe(false);
  });

  it("clears what an interrupted run left in the work directory before the build phase", async () => {
    const { row, context, workDir, calls } = prepared({ build: ["g:build:x"] });
    mkdirSync(workDir, { recursive: true });
    writeFileSync(join(workDir, "stale"), "");
    let seen: string[] = [];
    const spawn = context.spawn;
    if (spawn === undefined) throw new Error("the context carries a spawn");
    await runEntry(row, {
      ...context,
      spawn: async (binary, args, options) => {
        if (args[0] === "run" && containerName(args).includes("-build-")) {
          const { readdirSync } = await import("node:fs");
          seen = readdirSync(workMount(args));
        }
        return spawn(binary, args, options);
      },
    });
    expect(seen).toEqual([]);
    expect(calls.length).toBeGreaterThan(0);
  });

  it("turns a green verdict red when teardown faulted, naming the fault", async () => {
    const { row, context } = prepared({}, { listings: ["ghost", "ghost"] });
    const ran = await runEntry(row, context);
    expect(ran.ok).toBe(false);
    expect(ran.reason).toBe(
      "entry: 2 passed, 0 failed, expected to pass; and the teardown of entry faulted: entry left ghost running after teardown — still holding the repository mounted, so nothing measured after this is trustworthy until they are removed",
    );
  });

  it("carries teardown faults in the refusal thrown after a failed run", async () => {
    const { row, context } = prepared(
      { build: ["g:build:fixture"] },
      { build: { ...clean, code: 1 }, listings: ["", null] },
    );
    const run = runEntry(row, context);
    await expect(run).rejects.toThrow(Refusal);
    await expect(run).rejects.toThrow(
      /^build recipe `g:build:fixture` for entry failed.*; and the teardown of entry faulted: the engine did not say whether entry left a container running/,
    );
  });

  it("lets a failure that is not a refusal surface as itself when teardown is clean", async () => {
    const { row, context } = prepared({}, { throws: "the engine vanished" });
    await expect(runEntry(row, context)).rejects.toBe("the engine vanished");
  });

  it("carries teardown faults beside a failure that is not a refusal", async () => {
    const { row, context } = prepared(
      {},
      { throws: "the engine vanished", listings: ["", null] },
    );
    await expect(runEntry(row, context)).rejects.toThrow(
      /^the engine vanished; and the teardown of entry faulted/,
    );
  });
});
