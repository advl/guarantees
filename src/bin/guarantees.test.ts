import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  IMAGE_A,
  REPORT_GREEN,
  REPORT_RED,
  renderReport,
} from "../_testing/fixtures.js";
import makeCorpus, { type FixtureCorpus } from "../_testing/makeCorpus.js";
import { EXIT_CODES } from "../lib/contract/index.js";
import { hashImageInputs } from "../lib/image/index.js";
import type { Spawn, Spawned } from "../lib/process/index.js";
import { ENGINE } from "../lib/run/index.js";
import { REPORT_FILE, WORK_DIR } from "../lib/runner/index.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const clean: Spawned = { code: 0, out: "", killed: false };
const DIGEST = IMAGE_A.slice(IMAGE_A.indexOf("@") + 1);

/** What the engine is scripted to do for the run of each entry. */
type Script = {
  /** The report each entry's measured run writes, by entry id. */
  readonly reports?: Readonly<Record<string, string>>;
  /** What the engine answers when asked its version; a code of 1 is a machine without one. */
  readonly version?: Spawned;
  /** What the image listing answers, so a digest resolves or does not. */
  readonly images?: Spawned;
  /** What a build answers, and the digest the image inspection reports. */
  readonly built?: string;
  /** How long a measured run takes, so a re-measurement has a window to round. */
  readonly measuredMs?: number;
  /** What the corpus's own runner answers it would collect, as its list mode prints it. */
  readonly collected?: readonly string[];
  /** Thrown by the measured run of every entry, for a fault that is not a refusal. */
  readonly throws?: unknown;
};

const corpora: FixtureCorpus[] = [];
const lines: string[] = [];

/**
 * The engine, the runner and the task face as one scripted boundary. It is
 * the one thing a unit replaces: the filesystem is real, under a temporary
 * repository, so what the binary writes is read back from disk.
 */
const scriptedSpawn = (_corpus: FixtureCorpus, script: Script): Spawn => {
  const workOf = (args: readonly string[]) => {
    const mounts = args.filter((_, index) => args[index - 1] === "-v");
    return (mounts[1] ?? "").split(":")[0] ?? "";
  };
  const entryOf = (args: readonly string[]) =>
    (args[args.indexOf("--label") + 3] ?? "").split("=").at(-1) ?? "";
  return async (binary, args) => {
    if (binary === "node") {
      return {
        ...clean,
        out: JSON.stringify((script.collected ?? []).map((file) => ({ file }))),
      };
    }
    if (binary !== ENGINE) return clean;
    const [subcommand] = args;
    if (subcommand === "--version") {
      return script.version ?? { ...clean, out: `${ENGINE} version 5.8.2` };
    }
    if (subcommand === "images") {
      return script.images ?? { ...clean, out: `${DIGEST} [] sha256:local` };
    }
    if (subcommand === "build") return clean;
    if (subcommand === "image") {
      return { ...clean, out: `abc123 ${script.built ?? DIGEST}` };
    }
    if (subcommand !== "run") return clean;
    if (script.throws !== undefined) throw script.throws;
    const id = entryOf(args);
    if (script.measuredMs !== undefined) {
      await new Promise((done) => setTimeout(done, script.measuredMs));
    }
    const written = script.reports?.[id];
    if (written !== undefined) {
      writeFileSync(join(workOf(args), REPORT_FILE), written);
    }
    return clean;
  };
};

/** A repository with a corpus, a register, a workflow, and a scripted engine. */
const prepared = (
  options: {
    readonly register?: string;
    readonly workflow?: string;
    readonly script?: Script;
  } = {},
) => {
  const corpus = makeCorpus({
    entries: [
      { row: { id: "corpus-bijection" }, body: "" },
      {
        // A row that keeps something beyond its own container runs alone
        // after the pool drains, which is the tier's serial list.
        row: {
          id: "examples-run",
          holds: ["a-dev-server"],
          teardown: ["g:teardown:examples-run"],
        },
        body: "",
      },
      { row: { id: "corpus-can-fail", expect: "fail" }, body: "" },
    ],
  });
  corpora.push(corpus);
  writeFileSync(
    join(corpus.corpusRoot, "corpus.toml"),
    options.register ??
      `${corpus.rows
        .map((row) =>
          [
            `[${row.id}]`,
            `kind = "conformance"`,
            `tier = "pr"`,
            `file = "${row.file}"`,
            `select = "${row.select}"`,
            "build = []",
            `image = "${IMAGE_A}"`,
            `isolation = "image"`,
            `holds = ${JSON.stringify(row.holds)}`,
            `teardown = ${JSON.stringify(row.teardown)}`,
            `expect = "${row.expect}"`,
            `run_s = { class = "dev-x86_64-linux", p95 = 1.0, budget = 10 }`,
          ].join("\n"),
        )
        .join("\n\n")}\n`,
  );
  const workflowPath = join(
    corpus.repositoryRoot,
    ".github",
    "workflows",
    "guarantees.yml",
  );
  mkdirSync(join(corpus.repositoryRoot, ".github", "workflows"), {
    recursive: true,
  });
  writeFileSync(
    workflowPath,
    options.workflow ??
      "jobs:\n  pr:\n    steps:\n      - run: bun run g:tier pr\n      - run: bun run g:prove pr\n",
  );
  return { corpus, spawn: scriptedSpawn(corpus, options.script ?? {}) };
};

/** Runs the binary as a command line, and answers what it printed. */
const invoke = async (
  argv: readonly string[],
  cwd: string,
  spawn: Spawn,
): Promise<void> => {
  vi.resetModules();
  vi.doMock("../lib/process/index.js", async () => ({
    ...(await vi.importActual("../lib/process/index.js")),
    spawnProcess: spawn,
  }));
  process.argv = ["node", "guarantees", ...argv];
  vi.spyOn(process, "cwd").mockReturnValue(cwd);
  await import("./guarantees.js");
};

beforeEach(() => {
  lines.splice(0);
  process.exitCode = undefined;
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    lines.push(String(chunk).trimEnd());
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    lines.push(String(chunk).trimEnd());
    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock("../lib/process/index.js");
  process.exitCode = undefined;
  for (const corpus of corpora.splice(0)) corpus.remove();
});

const printed = () => lines.join("\n");

/** A corpus that resolves this repository's own copy of the runner, as one with an install of its own does. */
const withRunner = (corpus: FixtureCorpus) => {
  const install = join(corpus.corpusRoot, "node_modules");
  mkdirSync(install, { recursive: true });
  symlinkSync(
    join(packageRoot, "node_modules", "vitest"),
    join(install, "vitest"),
  );
};

describe("guarantees", () => {
  it("prints one line per row of the register and exits green", async () => {
    const { corpus, spawn } = prepared();
    await invoke(["list"], corpus.repositoryRoot, spawn);
    expect(printed()).toContain("corpus-bijection");
    expect(printed()).toContain("corpus-can-fail");
    expect(lines).toHaveLength(3);
    expect(process.exitCode).toBe(EXIT_CODES.green);
  });

  it("takes the corpus it is given rather than the one under the working directory", async () => {
    const { corpus, spawn } = prepared();
    await invoke(
      ["list", "--corpus", corpus.corpusRoot],
      corpus.repositoryRoot,
      spawn,
    );
    expect(lines).toHaveLength(3);
    expect(process.exitCode).toBe(EXIT_CODES.green);
  });

  it("refuses a working directory with no corpus under it, naming what to give instead", async () => {
    const { corpus, spawn } = prepared();
    await invoke(["list"], corpus.corpusRoot, spawn);
    expect(printed()).toContain("--corpus");
    expect(process.exitCode).toBe(EXIT_CODES.refused);
  });

  it("refuses a directory given as a corpus that holds no register", async () => {
    const { corpus, spawn } = prepared();
    await invoke(
      ["list", "--corpus", corpus.repositoryRoot],
      corpus.repositoryRoot,
      spawn,
    );
    expect(printed()).toContain("corpus.toml");
    expect(process.exitCode).toBe(EXIT_CODES.refused);
  });

  it("refuses a register whose tiers the workflow does not run, on every command and not only on the tier's own", async () => {
    const { corpus, spawn } = prepared({
      workflow: "jobs:\n  pr:\n    steps:\n      - run: bun run ci\n",
    });
    await invoke(["list"], corpus.repositoryRoot, spawn);
    expect(printed()).toContain("names no tier");
    expect(process.exitCode).toBe(EXIT_CODES.refused);
  });

  it("reads the workflow it is given instead of the one under the repository root", async () => {
    const { corpus, spawn } = prepared();
    const elsewhere = join(corpus.repositoryRoot, "pipeline.yml");
    writeFileSync(elsewhere, "steps:\n  - run: bun run g:tier pr\n");
    await invoke(
      ["list", "--workflow", elsewhere],
      corpus.repositoryRoot,
      spawn,
    );
    expect(printed()).toContain("nothing proves it");
    expect(process.exitCode).toBe(EXIT_CODES.refused);
  });

  it("refuses a flag at the end of the line, rather than reading the absent value as one it could mean", async () => {
    const { corpus, spawn } = prepared();
    await invoke(["list", "--corpus"], corpus.repositoryRoot, spawn);
    expect(printed()).toContain("`--corpus` takes a value");
    expect(process.exitCode).toBe(EXIT_CODES.refused);
  });

  it("refuses a flag whose value is the next flag, rather than taking that flag as the value", async () => {
    const { corpus, spawn } = prepared();
    await invoke(
      ["list", "--corpus", "--workflow", corpus.corpusRoot],
      corpus.repositoryRoot,
      spawn,
    );
    expect(printed()).toContain("`--corpus` takes a value");
    expect(process.exitCode).toBe(EXIT_CODES.refused);
  });

  it("lets a fault that is not a refusal surface as itself, and still declines rather than reporting a verdict", async () => {
    // The stack, because a fault is not a sentence anybody wrote for a
    // reader; and `refused`, because `red` is the code for a guarantee that
    // was judged and failed, and an engine client that died judged nothing.
    const { corpus, spawn } = prepared({
      script: { throws: new Error("the engine's client died") },
    });
    await invoke(["tier", "pr"], corpus.repositoryRoot, spawn);
    expect(printed()).toContain("the engine's client died");
    expect(printed()).toContain("guarantees.test.ts");
    expect(process.exitCode).toBe(EXIT_CODES.refused);
  });

  it("prints a fault that is not an error object as what it is, and still declines", async () => {
    // Nothing in this package throws a bare value, and the process boundary
    // is where that stops being a safe assumption: a rejected promise carries
    // whatever it was rejected with, and one row's run is the shortest path
    // from a fault to here — the pool wraps what it re-throws in an error.
    const { corpus, spawn } = prepared({ script: { throws: "a bare string" } });
    await invoke(["run", "corpus-bijection"], corpus.repositoryRoot, spawn);
    expect(printed()).toContain("a bare string");
    expect(process.exitCode).toBe(EXIT_CODES.refused);
  });

  it("refuses a subcommand it does not have, printing what it does have", async () => {
    const { corpus, spawn } = prepared();
    await invoke(["explain"], corpus.repositoryRoot, spawn);
    expect(printed()).toContain("is not a subcommand");
    expect(printed()).toContain("usage: guarantees");
    expect(process.exitCode).toBe(EXIT_CODES.refused);
  });

  it("refuses a run with no id, naming what the argument is for", async () => {
    const { corpus, spawn } = prepared();
    await invoke(["run"], corpus.repositoryRoot, spawn);
    expect(printed()).toContain("takes the id of a row");
    expect(process.exitCode).toBe(EXIT_CODES.refused);
  });

  it("refuses an id the register does not hold, pointing at the command that prints the ones it does", async () => {
    const { corpus, spawn } = prepared();
    await invoke(["run", "corpus-layering"], corpus.repositoryRoot, spawn);
    expect(printed()).toContain("holds no row `corpus-layering`");
    expect(process.exitCode).toBe(EXIT_CODES.refused);
  });

  it("refuses a tier that is not one, naming the tiers there are", async () => {
    const { corpus, spawn } = prepared();
    await invoke(["tier", "nightlies"], corpus.repositoryRoot, spawn);
    expect(printed()).toContain("is not a tier");
    expect(process.exitCode).toBe(EXIT_CODES.refused);
  });

  it("refuses a machine with no engine before it starts anything", async () => {
    const { corpus, spawn } = prepared({
      script: { version: { code: 1, out: "", killed: false } },
    });
    await invoke(["run", "corpus-bijection"], corpus.repositoryRoot, spawn);
    expect(printed()).toContain(ENGINE);
    expect(process.exitCode).toBe(EXIT_CODES.refused);
  });

  it("runs one entry, reaping first, and exits green on the verdict its report bears out", async () => {
    const { corpus, spawn } = prepared({
      script: { reports: { "corpus-bijection": renderReport(REPORT_GREEN) } },
    });
    await invoke(["run", "corpus-bijection"], corpus.repositoryRoot, spawn);
    expect(printed()).toContain("reaped nothing");
    expect(printed()).toContain("ok  corpus-bijection: 2 passed, 0 failed");
    expect(process.exitCode).toBe(EXIT_CODES.green);
  });

  it("exits red on an entry whose report says its expectation was not met", async () => {
    const { corpus, spawn } = prepared({
      script: { reports: { "corpus-bijection": renderReport(REPORT_RED) } },
    });
    await invoke(["run", "corpus-bijection"], corpus.repositoryRoot, spawn);
    expect(printed()).toContain("RED corpus-bijection");
    expect(process.exitCode).toBe(EXIT_CODES.red);
  });

  it("exits refused on an entry that left no report, since no verdict was judged", async () => {
    const { corpus, spawn } = prepared();
    await invoke(["run", "corpus-bijection"], corpus.repositoryRoot, spawn);
    expect(printed()).toContain("left no report");
    expect(process.exitCode).toBe(EXIT_CODES.refused);
  });

  it("runs a tier's rows and judges the wall over the whole schedule", async () => {
    const { corpus, spawn } = prepared({
      script: {
        reports: {
          "corpus-bijection": renderReport(REPORT_GREEN),
          "examples-run": renderReport(REPORT_GREEN),
          "corpus-can-fail": renderReport(REPORT_RED),
        },
      },
    });
    await invoke(["tier", "pr"], corpus.repositoryRoot, spawn);
    expect(printed()).toContain("ok  corpus-bijection");
    expect(printed()).toContain("ok  examples-run");
    expect(printed()).toContain("ok  corpus-can-fail");
    expect(printed()).toContain("pr tier:");
    expect(printed()).toContain("inside its 300 s wall");
    expect(process.exitCode).toBe(EXIT_CODES.green);
  });

  it("reports every row of a tier even when one of them is refused, since each tore its own entry down", async () => {
    const { corpus, spawn } = prepared({
      script: {
        reports: {
          "examples-run": renderReport(REPORT_GREEN),
          "corpus-can-fail": renderReport(REPORT_RED),
        },
      },
    });
    await invoke(["tier", "pr"], corpus.repositoryRoot, spawn);
    expect(printed()).toContain("REF corpus-bijection");
    expect(printed()).toContain("ok  corpus-can-fail");
    expect(process.exitCode).toBe(EXIT_CODES.refused);
  });

  it("reports every row of a tier and runs its serial list when one row's image will not resolve", async () => {
    // The likeliest per-row refusal of the two, and the one taken before a
    // row's own lifecycle starts: the listing answers for the first row and
    // fails for every one after it, so the refusal arrives while the slice
    // beside it is still running.
    let listings = 0;
    const { corpus, spawn } = prepared({
      script: {
        reports: {
          "examples-run": renderReport(REPORT_GREEN),
          "corpus-can-fail": renderReport(REPORT_RED),
          "corpus-bijection": renderReport(REPORT_GREEN),
        },
      },
    });
    const flaky: Spawn = async (binary, args, options) => {
      if (binary === ENGINE && args[0] === "images") {
        listings += 1;
        if (listings > 1) return { code: 1, out: "", killed: false };
      }
      return spawn(binary, args, options);
    };
    await invoke(["tier", "pr"], corpus.repositoryRoot, flaky);
    expect(printed()).toMatch(/REF (corpus-bijection|corpus-can-fail):/);
    expect(printed()).toContain("pr tier:");
    expect(process.exitCode).toBe(EXIT_CODES.refused);
  });

  it("proves a tier by its sentinel, and exits red when the sentinel did not fail", async () => {
    const { corpus, spawn } = prepared({
      script: { reports: { "corpus-can-fail": renderReport(REPORT_GREEN) } },
    });
    await invoke(["prove", "pr"], corpus.repositoryRoot, spawn);
    expect(printed()).toContain("designed to fail");
    expect(process.exitCode).toBe(EXIT_CODES.red);
  });

  it("refuses a repository with no workflow rather than dying in the read of it", async () => {
    const { corpus, spawn } = prepared();
    rmSync(join(corpus.repositoryRoot, ".github"), {
      recursive: true,
      force: true,
    });
    await invoke(["list"], corpus.repositoryRoot, spawn);
    expect(printed()).toContain("no .github/workflows/guarantees.yml at");
    expect(process.exitCode).toBe(EXIT_CODES.refused);
  });

  it("refuses a workflow flag given no value rather than falling back to the located one, which is the file it was overriding", async () => {
    const { corpus, spawn } = prepared();
    await invoke(["list", "--workflow"], corpus.repositoryRoot, spawn);
    expect(printed()).toContain("`--workflow` takes a value");
    expect(process.exitCode).toBe(EXIT_CODES.refused);
  });

  it("refuses a corpus that does not resolve the runner it would be collected by", async () => {
    const { corpus, spawn } = prepared();
    await invoke(["check"], corpus.repositoryRoot, spawn);
    expect(printed()).toContain("does not resolve vitest");
    expect(process.exitCode).toBe(EXIT_CODES.refused);
  });

  it("checks every row against what the runner would collect and every image of the tier against what it resolves to", async () => {
    const { corpus, spawn } = prepared({
      script: {
        collected: [
          "corpus-bijection.test.ts",
          "examples-run.test.ts",
          "corpus-can-fail.test.ts",
        ],
      },
    });
    withRunner(corpus);
    await invoke(["check", "pr"], corpus.repositoryRoot, spawn);
    expect(printed()).toContain(`ok  ${IMAGE_A} resolves to sha256:local`);
    expect(printed()).toContain(
      "ok  pr tier planned: 2 pooled, 1 one at a time",
    );
    expect(printed()).toContain("3 rows, 3 files collected");
    expect(process.exitCode).toBe(EXIT_CODES.green);
  });

  it("names a row whose file the runner would not collect, and exits red on it", async () => {
    const { corpus, spawn } = prepared({
      script: {
        collected: ["examples-run.test.ts", "corpus-can-fail.test.ts"],
      },
    });
    withRunner(corpus);
    await invoke(["check"], corpus.repositoryRoot, spawn);
    expect(printed()).toContain(
      "RED corpus-bijection -> corpus-bijection.test.ts, which this corpus's runner would not collect",
    );
    expect(process.exitCode).toBe(EXIT_CODES.red);
  });

  it("names a file the runner would collect that no row claims, and exits red on it", async () => {
    const { corpus, spawn } = prepared({
      script: {
        collected: [
          "corpus-bijection.test.ts",
          "examples-run.test.ts",
          "corpus-can-fail.test.ts",
          "nobody-claims-me.test.ts",
        ],
      },
    });
    withRunner(corpus);
    await invoke(["check"], corpus.repositoryRoot, spawn);
    expect(printed()).toContain(
      "RED nobody-claims-me.test.ts is collected and no row claims it",
    );
    expect(process.exitCode).toBe(EXIT_CODES.red);
  });

  it("re-measures an entry and writes the pair back into the register it read", async () => {
    const { corpus, spawn } = prepared({
      script: {
        reports: { "corpus-bijection": renderReport(REPORT_GREEN) },
        measuredMs: 60,
      },
    });
    await invoke(
      ["rebudget", "corpus-bijection", "--class", "gh-ubuntu"],
      corpus.repositoryRoot,
      spawn,
    );
    const written = readFileSync(
      join(corpus.corpusRoot, "corpus.toml"),
      "utf8",
    );
    expect(written).toContain(`class = "gh-ubuntu"`);
    expect(written).toContain("budget = 10");
    expect(process.exitCode).toBe(EXIT_CODES.green);
  });

  it("re-measures on the class the row already carries when none is given, since a class is a property of the machine and not of the command", async () => {
    const { corpus, spawn } = prepared({
      script: {
        reports: { "corpus-bijection": renderReport(REPORT_GREEN) },
        measuredMs: 60,
      },
    });
    await invoke(
      ["rebudget", "corpus-bijection"],
      corpus.repositoryRoot,
      spawn,
    );
    expect(
      readFileSync(join(corpus.corpusRoot, "corpus.toml"), "utf8"),
    ).toContain('class = "dev-x86_64-linux"');
    expect(process.exitCode).toBe(EXIT_CODES.green);
  });

  it("refuses a class flag given without a value rather than writing a class no register carries", async () => {
    const { corpus, spawn } = prepared({
      script: {
        reports: { "corpus-bijection": renderReport(REPORT_GREEN) },
        measuredMs: 60,
      },
    });
    const before = readFileSync(join(corpus.corpusRoot, "corpus.toml"), "utf8");
    await invoke(
      ["rebudget", "corpus-bijection", "--class"],
      corpus.repositoryRoot,
      spawn,
    );
    expect(printed()).toContain("`--class` takes a value");
    expect(readFileSync(join(corpus.corpusRoot, "corpus.toml"), "utf8")).toBe(
      before,
    );
    expect(process.exitCode).toBe(EXIT_CODES.refused);
  });

  it("writes nothing from windows measured by a run that did not do what the row promises, and says so", async () => {
    // The hazard the write is guarded against: an entry that used to cost
    // most of its budget and now fails an assertion early measures nothing
    // like its cost, and a budget written from those windows hard-kills
    // every later honest run of it.
    const { corpus, spawn } = prepared({
      script: {
        reports: { "corpus-bijection": renderReport(REPORT_RED) },
        measuredMs: 60,
      },
    });
    const before = readFileSync(join(corpus.corpusRoot, "corpus.toml"), "utf8");
    await invoke(
      ["rebudget", "corpus-bijection"],
      corpus.repositoryRoot,
      spawn,
    );
    expect(readFileSync(join(corpus.corpusRoot, "corpus.toml"), "utf8")).toBe(
      before,
    );
    expect(printed()).toContain("is not a measurement of the entry");
    expect(process.exitCode).toBe(EXIT_CODES.red);
  });

  it("goes red on a measurement past the tier's ceiling and leaves the register it read standing, since one carrying that pair is one every command refuses", async () => {
    // The window is read off the clock the run measures with rather than
    // waited out: a p95 past the tier's ceiling is forty seconds an entry,
    // five times over, and a suite cannot spend that to watch a comparison.
    const clock = vi.spyOn(performance, "now");
    let at = 0;
    clock.mockImplementation(() => {
      at += 45_000;
      return at;
    });
    const { corpus, spawn } = prepared({
      script: { reports: { "corpus-bijection": renderReport(REPORT_GREEN) } },
    });
    const before = readFileSync(join(corpus.corpusRoot, "corpus.toml"), "utf8");
    await invoke(
      ["rebudget", "corpus-bijection", "--class", "gh-ubuntu"],
      corpus.repositoryRoot,
      spawn,
    );
    expect(printed()).toContain("past the pr tier's");
    expect(printed()).toContain("promote the row to a later tier");
    expect(readFileSync(join(corpus.corpusRoot, "corpus.toml"), "utf8")).toBe(
      before,
    );
    expect(process.exitCode).toBe(EXIT_CODES.red);
    clock.mockRestore();
  });

  /** The scripted engine, with the measured run of an entry generating one file to lift. */
  const generatingInto = (
    corpus: FixtureCorpus,
    spawn: Spawn,
    text: string,
  ): Spawn => {
    const lift = join(corpus.corpusRoot, WORK_DIR, "corpus-bijection", "lift");
    return async (binary, args, options) => {
      const answered = await spawn(binary, args, options);
      if (args[0] === "run" && args.includes("--rm")) {
        mkdirSync(lift, { recursive: true });
        writeFileSync(join(lift, "surface.txt"), text);
      }
      return answered;
    };
  };

  it("takes what an entry generated as its goldens, and says so loudly on a run that went red", async () => {
    const { corpus, spawn } = prepared({
      script: { reports: { "corpus-bijection": renderReport(REPORT_RED) } },
    });
    await invoke(
      ["accept", "corpus-bijection"],
      corpus.repositoryRoot,
      generatingInto(corpus, spawn, "one line per unit\n"),
    );
    expect(printed()).toContain("RED corpus-bijection");
    expect(printed()).toContain("added     surface.txt");
    expect(
      readFileSync(
        join(corpus.corpusRoot, "goldens", "corpus-bijection", "surface.txt"),
        "utf8",
      ),
    ).toBe("one line per unit\n");
    expect(process.exitCode).toBe(EXIT_CODES.green);
  });

  it("exits red over a run that went red and generated nothing the tree did not already hold, since that red was not the golden comparison", async () => {
    const { corpus, spawn } = prepared({
      script: { reports: { "corpus-bijection": renderReport(REPORT_RED) } },
    });
    const goldens = join(corpus.corpusRoot, "goldens", "corpus-bijection");
    mkdirSync(goldens, { recursive: true });
    writeFileSync(join(goldens, "surface.txt"), "one line per unit\n");
    await invoke(
      ["accept", "corpus-bijection"],
      corpus.repositoryRoot,
      generatingInto(corpus, spawn, "one line per unit\n"),
    );
    expect(printed()).toContain("unchanged surface.txt");
    expect(process.exitCode).toBe(EXIT_CODES.red);
  });

  it("exits green over a run that was green, whatever the accept had to write", async () => {
    const { corpus, spawn } = prepared({
      script: { reports: { "corpus-bijection": renderReport(REPORT_GREEN) } },
    });
    const goldens = join(corpus.corpusRoot, "goldens", "corpus-bijection");
    mkdirSync(goldens, { recursive: true });
    writeFileSync(join(goldens, "surface.txt"), "one line per unit\n");
    await invoke(
      ["accept", "corpus-bijection"],
      corpus.repositoryRoot,
      generatingInto(corpus, spawn, "one line per unit\n"),
    );
    expect(printed()).toContain("ok  corpus-bijection");
    expect(process.exitCode).toBe(EXIT_CODES.green);
  });

  /** A repository holding one image definition, and where its record goes. */
  const defining = (
    corpus: FixtureCorpus,
    from = "FROM docker.io/example\n",
  ) => {
    const definition = join(corpus.repositoryRoot, "images", "ts");
    mkdirSync(definition, { recursive: true });
    writeFileSync(join(definition, "Containerfile"), from);
    return { definition, record: join(definition, "pinned.toml") };
  };

  it("holds where the definition still hashes to what its record carries, and names the image the rows pin", async () => {
    const { corpus, spawn } = prepared();
    const { definition, record } = defining(corpus);
    writeFileSync(
      record,
      `digest = "${IMAGE_A}"\ninputs = "${hashImageInputs(corpus.repositoryRoot, "ts")}"\n`,
    );
    const before = readFileSync(record, "utf8");
    await invoke(["image", "ts"], corpus.repositoryRoot, spawn);
    expect(printed()).toContain(`the rows pin ${IMAGE_A}`);
    // Nothing is written: the digest is a fact about a push, and this
    // machine's build is not the one that made it.
    expect(readFileSync(record, "utf8")).toBe(before);
    expect(process.exitCode).toBe(EXIT_CODES.green);
    expect(definition).toContain("images");
  });

  it("judges the definition and never the digest, since no build here answers the one that was published", async () => {
    const { corpus } = prepared();
    const { record } = defining(corpus);
    writeFileSync(
      record,
      `digest = "${IMAGE_A}"\ninputs = "${hashImageInputs(corpus.repositoryRoot, "ts")}"\n`,
    );
    const { spawn: elsewhere } = prepared({
      script: { built: `sha256:${"c".repeat(64)}` },
    });
    await invoke(["image"], corpus.repositoryRoot, elsewhere);
    expect(process.exitCode).toBe(EXIT_CODES.green);
  });

  it("exits red where the definition has changed, naming the hash to record, and leaves the record standing", async () => {
    const { corpus, spawn } = prepared();
    const { definition, record } = defining(corpus);
    const stale = `sha256:${"e".repeat(64)}`;
    writeFileSync(record, `digest = "${IMAGE_A}"\ninputs = "${stale}"\n`);
    writeFileSync(join(definition, "Containerfile"), "FROM docker.io/other\n");
    const before = readFileSync(record, "utf8");
    await invoke(["image"], corpus.repositoryRoot, spawn);
    expect(printed()).toContain(
      `recorded as ${stale} — the definition has changed`,
    );
    expect(readFileSync(record, "utf8")).toBe(before);
    expect(process.exitCode).toBe(EXIT_CODES.red);
  });

  it("refuses a definition nothing recorded, since a build here cannot supply a digest anybody can fetch", async () => {
    const { corpus, spawn } = prepared();
    const { record } = defining(corpus);
    await invoke(["image"], corpus.repositoryRoot, spawn);
    expect(printed()).toContain("has no pinned.toml beside its definition");
    expect(existsSync(record)).toBe(false);
    expect(process.exitCode).toBe(EXIT_CODES.refused);
  });
});

/**
 * The one claim this module makes about itself that no run of it can show:
 * that an executable's import graph is what it composes, and this one
 * composes no test. It is read off the source rather than off the built
 * tree, because the built tree is a step away and a graph checked there is
 * a graph checked only where somebody ran the build first.
 */
describe("the executable's import graph", () => {
  it("reaches no module that loads the test runner, which is what it composes none of", () => {
    const entry = fileURLToPath(new URL("./guarantees.ts", import.meta.url));
    const seen = new Set<string>();
    const loading: string[] = [];
    const walk = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      const text = readFileSync(file, "utf8");
      for (const [statement, specifier = ""] of text.matchAll(
        /^(?:import|export)[^"';]*?\bfrom\s*["']([^"']+)["']/gm,
      )) {
        // A `type` import is erased and loads nothing, so it is not an edge
        // of the graph the runtime walks.
        if (/^(?:import|export)\s+type\b/.test(statement)) continue;
        if (specifier === "vitest") loading.push(file);
        if (specifier.startsWith("."))
          walk(resolve(dirname(file), specifier.replace(/\.js$/, ".ts")));
      }
    };
    walk(entry);
    expect(loading.map((file) => file.slice(packageRoot.length + 1))).toEqual(
      [],
    );
    // The walk found the graph rather than stopping at the first import.
    expect(seen.size).toBeGreaterThan(20);
  });
});
