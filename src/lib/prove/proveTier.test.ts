import {
  existsSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import fakeSpawn from "../../_testing/fakeSpawn.js";
import { IMAGE_A, renderReport } from "../../_testing/fixtures.js";
import makeCorpus, { type FixtureCorpus } from "../../_testing/makeCorpus.js";
import { Refusal, UNCLAIMED_TITLE } from "../contract/index.js";
import type { Spawned } from "../process/index.js";
import type { Row } from "../register/index.js";
import type { Engine } from "../run/index.js";
import {
  COLLECTS,
  REPORT_FILE,
  REPORTS_DIR,
  WORK_DIR,
} from "../runner/index.js";
import {
  BIJECTION_ID,
  ORPHAN_ID,
  type ProveContext,
  proveTier,
} from "./index.js";

const engine: Engine = { binary: "engine", version: "1" };
const clean: Spawned = { code: 0, out: "", killed: false };
const DIGEST = IMAGE_A.slice(IMAGE_A.indexOf("@") + 1);

/** One assertion as the runner reports it, under the suite the row selects. */
const assertion = (select: string, title: string, status: string) => ({
  ancestorTitles: [select],
  title,
  fullName: `${select} ${title}`,
  status,
});

/** A report of one file whose assertions are as given. */
const report = (
  file: string,
  assertions: readonly { readonly status: string }[],
) =>
  renderReport({
    numTotalTests: assertions.length,
    numPassedTests: assertions.filter((one) => one.status === "passed").length,
    numFailedTests: assertions.filter((one) => one.status === "failed").length,
    numPendingTests: 0,
    startTime: 1_700_000_000_000,
    success: assertions.every((one) => one.status !== "failed"),
    testResults: [
      { name: file, status: "passed", assertionResults: assertions },
    ],
  });

/** The bijection's report, with its first assertion failed or passed as asked. */
const bijectionReport = (status: string) =>
  report(`${BIJECTION_ID}${COLLECTS}`, [
    assertion(BIJECTION_ID, UNCLAIMED_TITLE, status),
    assertion(BIJECTION_ID, "resolves every row", "passed"),
  ]);

/** The sentinel's report, red as its row expects or green as it must not be. */
const sentinelReport = (status: string) =>
  report(`selftest/corpus-can-fail${COLLECTS}`, [
    assertion("corpus-can-fail", "fails on purpose", status),
  ]);

const corpora: FixtureCorpus[] = [];

/** How a scripted engine answers each run of the tier's rows. */
type Script = {
  /** The report each entry's measured run writes, by entry id; `null` writes none. */
  readonly reports?: Readonly<Record<string, string | null>>;
  /** Thrown by the measured run of that entry. */
  readonly throwsOn?: string;
  /** What a teardown recipe does to the report the run left, before it is lifted. */
  readonly tamper?: (path: string) => void;
};

const prepared = (rows: readonly Partial<Row>[], script: Script = {}) => {
  const corpus = makeCorpus({
    entries: rows.map((row) => ({
      row: { id: "unnamed", ...row } as Partial<Row> & { id: string },
      body: "",
    })),
  });
  corpora.push(corpus);
  const entryOf = (args: readonly string[]) =>
    (args[args.indexOf("--label") + 3] ?? "").split("=").at(-1) ?? "";
  const workOf = (args: readonly string[]) => {
    const mounts = args.filter((_, index) => args[index - 1] === "-v");
    return (mounts[1] ?? "").split(":")[0] ?? "";
  };
  const { spawn, calls } = fakeSpawn(async (call) => {
    if (call.binary !== engine.binary) {
      for (const id of rows.map((row) => row.id ?? "")) {
        const path = join(corpus.corpusRoot, WORK_DIR, id, REPORT_FILE);
        if (existsSync(path)) script.tamper?.(path);
      }
      return clean;
    }
    const [subcommand] = call.args;
    if (subcommand === "images") {
      return { ...clean, out: `${DIGEST} [] sha256:local` };
    }
    if (subcommand !== "run") return clean;
    const id = entryOf(call.args);
    if (id === script.throwsOn) throw new Error("the engine's client died");
    const written = script.reports?.[id];
    if (written !== null) {
      writeFileSync(join(workOf(call.args), REPORT_FILE), written ?? "{}");
    }
    return clean;
  });
  const context: ProveContext = {
    engine,
    repositoryRoot: corpus.repositoryRoot,
    corpusRoot: corpus.corpusRoot,
    nonce: String(process.pid),
    spawn,
  };
  return { corpus, context, calls };
};

/** The rows a tier holds when it is proved both ways. */
const TIER = [
  {
    id: BIJECTION_ID,
    select: BIJECTION_ID,
    teardown: ["g:teardown:report"],
  },
  {
    id: "corpus-can-fail",
    file: `selftest/corpus-can-fail${COLLECTS}`,
    expect: "fail" as const,
  },
];

const REPORTS = {
  [BIJECTION_ID]: bijectionReport("failed"),
  "corpus-can-fail": sentinelReport("failed"),
};

const orphanAt = (corpus: FixtureCorpus) =>
  join(corpus.corpusRoot, `${ORPHAN_ID}${COLLECTS}`);

const liftedAt = (corpus: FixtureCorpus) =>
  join(corpus.corpusRoot, WORK_DIR, REPORTS_DIR, `${BIJECTION_ID}.json`);

afterEach(() => {
  for (const corpus of corpora.splice(0)) corpus.remove();
});

describe("proveTier", () => {
  it("refuses a tier it cannot plan, before it starts anything", async () => {
    const { context, calls } = prepared(TIER, { reports: REPORTS });
    await expect(proveTier("pr", new Map(), context)).rejects.toThrow(Refusal);
    expect(calls).toEqual([]);
  });

  it("requires the title under the row's id and not under its selector, since the suite is opened under the id", async () => {
    // A selector is a prefix the runner matches a title from the start of,
    // and a corpus may write one that selects a single assertion of the
    // suite. Composed from it, the wanted title would be a string no runner
    // could emit, and a corpus in order would report a failed proof.
    const selecting = [
      { ...TIER[0], select: `${BIJECTION_ID} ${UNCLAIMED_TITLE}` },
      TIER[1],
    ] as readonly Partial<Row>[];
    const { corpus, context } = prepared(selecting, { reports: REPORTS });
    const register = new Map(corpus.rows.map((row) => [row.id, row]));
    const proved = await proveTier("pr", register, context);
    expect(proved.ok).toBe(true);
  });

  it("declines a bijection that failed on having looked at nothing, which is the vacuity it was rigged to rule out", async () => {
    // The scan's own guard carries a title of its own, so a run that read
    // nothing fails that one and not the finding's. Read as the finding, a
    // proof would report the planted file found by a scan that never saw it.
    const vacuous = report(`${BIJECTION_ID}${COLLECTS}`, [
      assertion(
        BIJECTION_ID,
        `${UNCLAIMED_TITLE}, having looked at files`,
        "failed",
      ),
      assertion(BIJECTION_ID, UNCLAIMED_TITLE, "passed"),
    ]);
    const { corpus, context } = prepared(TIER, {
      reports: { ...REPORTS, [BIJECTION_ID]: vacuous },
    });
    const register = new Map(corpus.rows.map((row) => [row.id, row]));
    const proved = await proveTier("pr", register, context);
    expect(proved.ok).toBe(false);
    expect(proved.reason).toContain("either that assertion is not finding");
  });

  it("proves the tier by its sentinel going red and its bijection naming the file no row claims", async () => {
    const { corpus, context } = prepared(TIER, { reports: REPORTS });
    const register = new Map(corpus.rows.map((row) => [row.id, row]));
    const proved = await proveTier("pr", register, context);
    expect(proved.ok).toBe(true);
    expect(proved.reason).toContain(`${BIJECTION_ID} ${UNCLAIMED_TITLE}`);
    expect(existsSync(orphanAt(corpus))).toBe(false);
    expect(existsSync(liftedAt(corpus))).toBe(false);
  });

  it("refuses to call a tier proved when the row designed to fail did not fail", async () => {
    const { corpus, context } = prepared(TIER, {
      reports: { ...REPORTS, "corpus-can-fail": sentinelReport("passed") },
    });
    const register = new Map(corpus.rows.map((row) => [row.id, row]));
    const proved = await proveTier("pr", register, context);
    expect(proved.ok).toBe(false);
    expect(proved.reason).toContain("designed to fail");
    expect(existsSync(orphanAt(corpus))).toBe(false);
  });

  it("refuses to call a tier proved when the bijection stayed green with a file no row claims in the tree, which is the vacuous scan this exists to catch", async () => {
    const { corpus, context } = prepared(TIER, {
      reports: { ...REPORTS, [BIJECTION_ID]: bijectionReport("passed") },
    });
    const register = new Map(corpus.rows.map((row) => [row.id, row]));
    const proved = await proveTier("pr", register, context);
    expect(proved.ok).toBe(false);
    expect(proved.reason).toContain("nothing failed");
    expect(existsSync(orphanAt(corpus))).toBe(false);
  });

  it("refuses to call a tier proved when the bijection went red on some other assertion", async () => {
    const { corpus, context } = prepared(TIER, {
      reports: {
        ...REPORTS,
        [BIJECTION_ID]: report(`${BIJECTION_ID}${COLLECTS}`, [
          assertion(BIJECTION_ID, UNCLAIMED_TITLE, "passed"),
          assertion(BIJECTION_ID, "resolves every row", "failed"),
        ]),
      },
    });
    const register = new Map(corpus.rows.map((row) => [row.id, row]));
    const proved = await proveTier("pr", register, context);
    expect(proved.ok).toBe(false);
    expect(proved.reason).toContain("resolves every row");
  });

  it("refuses a rigged run whose report a teardown recipe removed before it could be lifted", async () => {
    const { corpus, context } = prepared(TIER, {
      reports: REPORTS,
      tamper: (path) => {
        rmSync(path);
      },
    });
    const register = new Map(corpus.rows.map((row) => [row.id, row]));
    await expect(proveTier("pr", register, context)).rejects.toThrow(Refusal);
    expect(existsSync(orphanAt(corpus))).toBe(false);
  });

  it("refuses a lifted report older than the run this proof rigged", async () => {
    const { corpus, context } = prepared(TIER, {
      reports: REPORTS,
      tamper: (path) => {
        // A teardown recipe runs between the read the verdict was judged
        // from and the copy that outlives the work directory, so the two
        // are not the same read: this backdates what is lifted.
        const before = new Date(statSync(path).mtimeMs - 90_000);
        utimesSync(path, before, before);
      },
    });
    const register = new Map(corpus.rows.map((row) => [row.id, row]));
    await expect(proveTier("pr", register, context)).rejects.toThrow(
      "older than the run this proof rigged",
    );
    expect(existsSync(orphanAt(corpus))).toBe(false);
  });

  it("restores the tree when the run itself throws, so the next honest run does not fail on a file nobody planted", async () => {
    const { corpus, context } = prepared(TIER, {
      reports: REPORTS,
      throwsOn: BIJECTION_ID,
    });
    const register = new Map(corpus.rows.map((row) => [row.id, row]));
    await expect(proveTier("pr", register, context)).rejects.toThrow();
    expect(existsSync(orphanAt(corpus))).toBe(false);
  });

  it("proves a tier holding no bijection row by its sentinel alone, and says so rather than passing over it", async () => {
    const rows = [
      { id: "teardown-completeness", kind: "oracle" as const },
      {
        id: "corpus-can-fail",
        file: `selftest/corpus-can-fail${COLLECTS}`,
        expect: "fail" as const,
      },
    ];
    const { corpus, context } = prepared(rows, {
      reports: {
        "teardown-completeness": report("teardown.test.ts", [
          assertion("teardown-completeness", "holds", "passed"),
        ]),
        "corpus-can-fail": sentinelReport("failed"),
      },
    });
    const register = new Map(corpus.rows.map((row) => [row.id, row]));
    const proved = await proveTier("pr", register, context);
    expect(proved.ok).toBe(true);
    expect(proved.reason).toContain(`holds no ${BIJECTION_ID} row`);
    expect(existsSync(orphanAt(corpus))).toBe(false);
  });
});
