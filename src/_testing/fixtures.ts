/**
 * Shared fixture data: register texts in the shapes consumers write, the
 * probe a measuring entry writes, and the renderers the texts are built
 * from. A refusal test takes a base text and applies one
 * mutation, so exactly one refusal fires and the assertion can name it.
 */

export const IMAGE_A = `ghcr.io/example/guarantees-ts@sha256:${"0123456789abcdef".repeat(4)}`;

export const IMAGE_B = `ghcr.io/example/guarantees-browser@sha256:${"fedcba9876543210".repeat(4)}`;

export const MACHINE_CLASS = "dev-x86_64-linux";

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

/** Tables joined into a register text with a trailing newline. */
export const renderRegister = (tables: readonly string[]): string =>
  `${tables.join("\n\n")}\n`;

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
