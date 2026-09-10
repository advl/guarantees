/**
 * Shared fixture data: register texts in the shapes consumers write, the
 * probe a measuring entry writes, the runner's reports, and the renderers
 * the texts are built from. A refusal test takes a base text and applies one
 * mutation, so exactly one refusal fires and the assertion can name it.
 */

import { TIERS } from "../lib/register/index.js";

export const IMAGE_A = `ghcr.io/example/guarantees-ts@sha256:${"0123456789abcdef".repeat(4)}`;

export const IMAGE_B = `ghcr.io/example/guarantees-browser@sha256:${"fedcba9876543210".repeat(4)}`;

export const MACHINE_CLASS = "dev-x86_64-linux";

/**
 * A pipeline that triggers and proves every tier, under a runner collecting
 * `.test.ts`: what a register is read against when the test is about the
 * register and not about the pipeline.
 */
export const PIPELINE = {
  triggeredTiers: TIERS,
  provenTiers: TIERS,
  collects: ".test.ts",
};

/** The right-hand sides every rendered row starts from, in column order. */
const ROW_DEFAULTS: Readonly<Record<string, string>> = {
  kind: `"conformance"`,
  tier: `"pr"`,
  file: `""`,
  select: `""`,
  build: "[]",
  image: `"${IMAGE_A}"`,
  isolation: `"image"`,
  holds: "[]",
  teardown: "[]",
  expect: `"pass"`,
  run_s: `{ class = "${MACHINE_CLASS}", p95 = 1.0, budget = 10 }`,
};

/**
 * One register table as TOML text. `columns` overrides right-hand sides as
 * raw TOML, adds a column the defaults do not know, or removes one with
 * `null`. `file` and `select` derive from the id unless overridden.
 */
export const renderRow = (
  id: string,
  columns: Readonly<Record<string, string | null>> = {},
): string => {
  const merged: Readonly<Record<string, string | null>> = {
    ...ROW_DEFAULTS,
    file: `"${id}.test.ts"`,
    select: `"${id}"`,
    ...columns,
  };
  const lines = Object.entries(merged)
    .filter(([, value]) => value !== null)
    .map(([key, value]) => `${key} = ${value}`);
  return [`[${id}]`, ...lines].join("\n");
};

/**
 * The two rows a register is refused without, whatever else it holds: the
 * row a tier's proof rigs, and the row designed to fail. A fixture about
 * one column carries them so that the refusal under test is the only one
 * that can fire.
 */
export const REQUIRED_ROWS: readonly string[] = [
  renderRow("corpus-bijection"),
  renderRow("corpus-can-fail", { expect: `"fail"` }),
];

/** Tables joined into a register text with a trailing newline. */
export const renderRegister = (tables: readonly string[]): string =>
  `${tables.join("\n\n")}\n`;

/**
 * A register text recast into the layout a hand-edited register settles
 * into: a comment preamble that mentions a bracketed word, every key padded
 * so the `=` signs align, whitespace inside one header's brackets, and a
 * trailing comment on another. The same tables, the same rows.
 */
export const renderCommented = (text: string): string =>
  [
    "# The guarantees of this repository, one table per row.",
    "# A table is [id]; a line such as [not-a-table] in a comment is prose.",
    "",
    text
      .replace(/^([a-z_]+) =/gm, (_, key: string) => `${key.padEnd(9)} =`)
      .replace("[corpus-can-fail]", "  [ corpus-can-fail ]")
      .replace(
        "[corpus-image]",
        "[corpus-image] # measured on a quiet machine",
      ),
  ].join("\n");

/**
 * Five pr conformance rows, one of them the sentinel, all in one image: the
 * shape a corpus has on the day it is born.
 */
export const REGISTER_ONE_IMAGE = renderRegister([
  renderRow("corpus-bijection"),
  renderRow("corpus-layering"),
  renderRow("corpus-image"),
  renderRow("corpus-toolchain", { build: `["g:build:toolchain-stamp"]` }),
  renderRow("corpus-can-fail", {
    file: `"selftest/corpus-can-fail.test.ts"`,
    expect: `"fail"`,
  }),
]);

/** The one-image register in the padded, commented layout. */
export const REGISTER_COMMENTED = renderCommented(REGISTER_ONE_IMAGE);

/** The first reading of the probe a measuring entry writes. */
export const PROBE_READING = {
  metric: "bundle-size",
  value: 12_345,
  units: "bytes",
  phase: "cold",
  fixture: "dist/index.js",
  class: MACHINE_CLASS,
};

/** The stamp a measuring entry leaves on its probe. */
export const PROBE_STAMP = {
  instrument: "size-probe 1.0.0",
  at: "2026-01-01T00:00:00Z",
};

/** What a measuring entry writes beside its verdict. */
export const PROBE = {
  contract: "1",
  stamp: PROBE_STAMP,
  readings: [
    PROBE_READING,
    {
      ...PROBE_READING,
      metric: "bundle-size-compressed",
      value: 4_321,
      phase: "warm",
    },
  ],
};

export const PROBE_TEXT = JSON.stringify(PROBE);

/**
 * Seven rows across two tiers and two images: pr holds conformance, oracle,
 * golden and budget rows beside the sentinel; merge holds a row that keeps a
 * dev server and a browser, with the teardown that releases them, beside its
 * own sentinel. The shape a corpus grows into.
 */
export const REGISTER_TWO_IMAGES = renderRegister([
  renderRow("corpus-bijection"),
  renderRow("teardown-completeness", {
    kind: `"oracle"`,
    build: `["g:build:teardown-completeness"]`,
  }),
  renderRow("surface-closure", {
    kind: `"golden"`,
    build: `["g:build:surface-closure"]`,
  }),
  renderRow("bundle-size", {
    kind: `"budget"`,
    build: `["g:build:bundle-size"]`,
  }),
  renderRow("corpus-can-fail", {
    file: `"selftest/corpus-can-fail.test.ts"`,
    expect: `"fail"`,
  }),
  renderRow("examples-run", {
    tier: `"merge"`,
    build: `["g:build:examples"]`,
    image: `"${IMAGE_B}"`,
    isolation: `"image-net"`,
    holds: `["dev-server", "browser"]`,
    teardown: `["g:teardown:examples-run"]`,
    run_s: `{ class = "${MACHINE_CLASS}", p95 = 40, budget = 60 }`,
  }),
  renderRow("merge-can-fail", {
    tier: `"merge"`,
    file: `"selftest/merge-can-fail.test.ts"`,
    expect: `"fail"`,
  }),
]);

const REPORT_FILE = "/workspace/guarantees/corpus-bijection.test.ts";

/** One passed assertion as the runner reports it. */
export const ASSERTION_PASSED = {
  ancestorTitles: ["corpus-bijection"],
  title: "every file has a row",
  fullName: "corpus-bijection every file has a row",
  status: "passed",
};

/** One file's results as the runner reports them, every assertion passed. */
export const FILE_GREEN = {
  name: REPORT_FILE,
  status: "passed",
  assertionResults: [
    ASSERTION_PASSED,
    {
      ...ASSERTION_PASSED,
      title: "every row resolves to a file",
      fullName: "corpus-bijection every row resolves to a file",
    },
  ],
};

/** The runner's report of a run in which every assertion passed. */
export const REPORT_GREEN = {
  numTotalTests: 2,
  numPassedTests: 2,
  numFailedTests: 0,
  numPendingTests: 0,
  startTime: 1_700_000_000_000,
  success: true,
  testResults: [FILE_GREEN],
};

/** The runner's report of a run in which one assertion failed. */
export const REPORT_RED = {
  numTotalTests: 2,
  numPassedTests: 1,
  numFailedTests: 1,
  numPendingTests: 0,
  startTime: 1_700_000_000_000,
  success: false,
  testResults: [
    {
      name: "/workspace/guarantees/selftest/corpus-can-fail.test.ts",
      status: "failed",
      assertionResults: [
        {
          ancestorTitles: ["corpus-can-fail"],
          title: "reads its own row",
          fullName: "corpus-can-fail reads its own row",
          status: "passed",
        },
        {
          ancestorTitles: ["corpus-can-fail"],
          title: "asserts a falsehood",
          fullName: "corpus-can-fail asserts a falsehood",
          status: "failed",
        },
      ],
    },
  ],
};

/** The runner's report of a run in which nothing was collected. */
export const REPORT_EMPTY = {
  numTotalTests: 0,
  numPassedTests: 0,
  numFailedTests: 0,
  numPendingTests: 0,
  startTime: 1_700_000_000_000,
  success: true,
  testResults: [{ name: REPORT_FILE, status: "passed", assertionResults: [] }],
};

/**
 * The runner's report of a run in which two assertions were collected and
 * every one was skipped: nothing passed and nothing failed, and the counts
 * agree with the statuses.
 */
export const REPORT_SKIPPED = {
  numTotalTests: 2,
  numPassedTests: 0,
  numFailedTests: 0,
  numPendingTests: 2,
  startTime: 1_700_000_000_000,
  success: true,
  testResults: [
    {
      ...FILE_GREEN,
      status: "skipped",
      assertionResults: FILE_GREEN.assertionResults.map((assertion) => ({
        ...assertion,
        status: "skipped",
      })),
    },
  ],
};

/**
 * The skipped report with a passed count its assertions do not bear out:
 * two counted, none listed. A reader that trusted the count would judge a
 * run that asserted nothing as green.
 */
export const REPORT_SKIPPED_COUNTED = { ...REPORT_SKIPPED, numPassedTests: 2 };

/** A report object as the runner writes it. */
export const renderReport = (report: unknown): string => JSON.stringify(report);
