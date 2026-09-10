import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { EXIT_CODES } from "../../lib/contract/index.js";
import { LOCAL_PREFIX } from "../../lib/image/index.js";
import { spawnProcess } from "../../lib/process/index.js";
import { type Row, UNMEASURED_S } from "../../lib/register/index.js";
import { reapStale } from "../../lib/run/index.js";
import { BASE_IMAGE_NAME } from "../constants.js";
import makeCorpus from "../makeCorpus.js";
import { renderFailing, renderPassing } from "./fixtures.js";

const engine = inject("engine");
const baseImage = inject("baseImage");
const packageRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

/**
 * The binary as a consumer runs it: the built file, from its own path,
 * against a repository that holds a corpus and a workflow. It is mounted
 * rather than constructed — nothing here imports it — so what is exercised
 * is the file the manifest's `bin` names.
 */
const BINARY = join(packageRoot, "dist", "esm", "bin", "guarantees.js");

const corpus = makeCorpus({
  name: "binary",
  entries: [
    {
      row: { id: "corpus-bijection" },
      body: renderPassing("corpus-bijection"),
    },
    {
      row: { id: "corpus-can-fail", expect: "fail" },
      body: renderFailing("corpus-can-fail"),
    },
  ],
});

/** The register the binary reads, with the rows pinned to a reference given later. */
const renderRegister = (rows: readonly Row[], image: string) =>
  `${rows
    .map((row) =>
      [
        `[${row.id}]`,
        `kind = "conformance"`,
        `tier = "pr"`,
        `file = "${row.file}"`,
        `select = "${row.select}"`,
        "build = []",
        `image = "${image}"`,
        `isolation = "image"`,
        "holds = []",
        "teardown = []",
        `expect = "${row.expect}"`,
        `run_s = { class = "integration", p95 = 1.0, budget = 10 }`,
      ].join("\n"),
    )
    .join("\n\n")}\n`;

mkdirSync(join(corpus.repositoryRoot, ".github", "workflows"), {
  recursive: true,
});
writeFileSync(
  join(corpus.repositoryRoot, ".github", "workflows", "guarantees.yml"),
  [
    "jobs:",
    "  pr:",
    "    steps:",
    "      - run: bun run g:tier pr",
    "      - run: bun run g:prove pr",
    "",
  ].join("\n"),
);

/** The binary, as a task-face script runs it, from a directory of the caller's choosing. */
const run = (argv: readonly string[], cwd = corpus.repositoryRoot) =>
  spawnProcess("node", [BINARY, ...argv], {
    cwd,
    deadlineMs: UNMEASURED_S * 1000,
    capture: true,
  });

const reap = () => reapStale(engine, corpus.repositoryRoot);
beforeAll(async () => {
  await reap();
  const inspected = await spawnProcess(
    engine.binary,
    ["image", "inspect", "--format", "{{.Digest}}", baseImage],
    { deadlineMs: UNMEASURED_S * 1000, capture: true },
  );
  writeFileSync(
    join(corpus.corpusRoot, "corpus.toml"),
    renderRegister(
      corpus.rows,
      `${LOCAL_PREFIX}-${BASE_IMAGE_NAME}@${inspected.out}`,
    ),
  );
});
afterAll(async () => {
  await reap();
  corpus.remove();
});

describe("the guarantees binary", () => {
  it("prints the register it found under the working directory", async () => {
    const listed = await run(["list"]);
    expect(listed.out).toContain("corpus-bijection");
    expect(listed.out).toContain("corpus-can-fail");
    expect(listed.code).toBe(EXIT_CODES.green);
  });

  it("runs one entry inside its image and exits on the verdict its report bears out", async () => {
    expect((await run(["run", "corpus-bijection"])).code).toBe(
      EXIT_CODES.green,
    );
    expect((await run(["run", "corpus-can-fail"])).code).toBe(EXIT_CODES.green);
  });

  it("runs a tier's rows and exits green under its wall", async () => {
    const ran = await run(["tier", "pr"]);
    expect(ran.out).toContain("pr tier:");
    expect(ran.code).toBe(EXIT_CODES.green);
  });

  it("refuses a corpus it cannot find, from a working directory that holds none", async () => {
    const elsewhere = await run(["list"], corpus.corpusRoot);
    expect(elsewhere.code).toBe(EXIT_CODES.refused);
  });
});
