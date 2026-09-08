import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Row } from "../lib/register/index.js";
import {
  type Engine,
  hashCheckout,
  type RunContext,
} from "../lib/run/index.js";
import { IMAGE_A } from "./fixtures.js";

/** One entry of a fixture corpus: its row, with the defaults below for what it leaves out, and its file's text. */
export type FixtureEntry = {
  readonly row: Partial<Row> & { readonly id: string };
  readonly body: string;
};

/** A temporary repository holding a corpus, and the means to run it and remove it. */
export type FixtureCorpus = {
  readonly repositoryRoot: string;
  readonly corpusRoot: string;
  readonly rows: readonly Row[];
  /** The checkout label of this corpus, as its containers carry it. */
  readonly checkout: string;
  /** The context a run of this corpus takes, under the given engine and image. */
  readonly context: (engine: Engine, image: string) => RunContext;
  readonly remove: () => void;
};

/**
 * Writes a temporary repository with a `guarantees/` corpus: a root manifest
 * carrying the given scripts, so build and teardown recipes resolve on the
 * task face, and one entry file per row. Rows are built directly as plain
 * objects rather than through the register, because the register's floor
 * binds registers and a fixture row here needs a budget of a second.
 *
 * Where the repository is written decides what its containers are
 * labelled, since the label is a hash of the root: a fixed place under the
 * temp directory keyed by this package's own checkout and the name,
 * recreated empty, so the label is the same on every run from this checkout
 * and what an interrupted run left running is what the next run's reap
 * finds, while a second checkout of this package hashes to another place.
 *
 * @note Impure — writes a temp directory; `remove` deletes it.
 */
export default function makeCorpus(options: {
  readonly entries: readonly FixtureEntry[];
  readonly scripts?: Readonly<Record<string, string>>;
  readonly name: string;
}): FixtureCorpus {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const repositoryRoot = join(
    tmpdir(),
    `guarantees-${hashCheckout(packageRoot)}`,
    options.name,
  );
  rmSync(repositoryRoot, { recursive: true, force: true });
  mkdirSync(repositoryRoot, { recursive: true });
  const corpusRoot = join(repositoryRoot, "guarantees");
  mkdirSync(corpusRoot);
  writeFileSync(
    join(repositoryRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "@example/fixture-repository",
        private: true,
        type: "module",
        scripts: options.scripts ?? {},
      },
      null,
      2,
    )}\n`,
  );
  const rows = options.entries.map(({ row, body }) => {
    const file = `${row.id}.test.ts`;
    writeFileSync(join(corpusRoot, file), body);
    return {
      kind: "conformance",
      tier: "pr",
      file,
      select: row.id,
      build: [],
      image: IMAGE_A,
      isolation: "image",
      holds: [],
      teardown: [],
      expect: "pass",
      run: { class: "integration", p95: 1, budget: 30 },
      ...row,
    } satisfies Row;
  });
  return {
    repositoryRoot,
    corpusRoot,
    rows,
    checkout: hashCheckout(repositoryRoot),
    context: (engine, image) => ({
      engine,
      repositoryRoot,
      corpusRoot,
      nonce: String(process.pid),
      image,
    }),
    remove: () => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    },
  };
}
