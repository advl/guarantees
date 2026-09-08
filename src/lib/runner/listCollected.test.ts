import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import fakeSpawn from "../../_testing/fakeSpawn.js";
import { Refusal } from "../contract/index.js";
import type { Spawned } from "../process/index.js";
import { UNMEASURED_S } from "../register/index.js";
import { listCollected } from "./index.js";

const packageRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const scratch: string[] = [];

/** A corpus directory under the temp dir, removed after the test. */
const fresh = () => {
  const directory = mkdtempSync(join(tmpdir(), "list-collected-"));
  scratch.push(directory);
  return directory;
};

/** A corpus that resolves this repository's copy of the runner. */
const corpusWithRunner = () => {
  const corpus = fresh();
  mkdirSync(join(corpus, "node_modules"));
  symlinkSync(
    join(packageRoot, "node_modules", "vitest"),
    join(corpus, "node_modules", "vitest"),
  );
  return corpus;
};

/** A runner that answers as scripted, whatever it is asked. */
const scripted = (answer: Partial<Spawned>) =>
  fakeSpawn(() => ({ code: 0, out: "", killed: false, ...answer }));

const listing = (files: readonly string[]) =>
  JSON.stringify(files.map((file) => ({ file })));

afterEach(() => {
  for (const directory of scratch.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("listCollected", () => {
  it("asks the corpus's runner for its files only, as JSON, rooted at the corpus, under the unmeasured deadline", async () => {
    const corpus = corpusWithRunner();
    const { calls, spawn } = scripted({ out: listing([]) });
    await listCollected(corpus, spawn);
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.binary).toBe("node");
    expect(call?.options).toEqual({
      cwd: corpus,
      deadlineMs: UNMEASURED_S * 1000,
      capture: true,
    });
    expect(call?.args.at(0)).toMatch(/vitest\.mjs$/);
    expect(call?.args.slice(1)).toEqual([
      "list",
      "--filesOnly",
      "--json",
      "--root",
      corpus,
    ]);
  });

  it("answers the files relative to the corpus root, sorted", async () => {
    const corpus = corpusWithRunner();
    const { spawn } = scripted({
      out: listing([
        join(corpus, "zeta.test.ts"),
        join(corpus, "nested", "alpha.test.ts"),
        "already-relative.test.ts",
      ]),
    });
    expect(await listCollected(corpus, spawn)).toEqual([
      "already-relative.test.ts",
      join("nested", "alpha.test.ts"),
      "zeta.test.ts",
    ]);
  });

  it("refuses a corpus that does not resolve the runner, naming it", async () => {
    const corpus = fresh();
    const { calls, spawn } = scripted({ out: listing([]) });
    await expect(listCollected(corpus, spawn)).rejects.toThrow(Refusal);
    await expect(listCollected(corpus, spawn)).rejects.toThrow(
      "does not resolve vitest",
    );
    expect(calls).toHaveLength(0);
  });

  it("refuses a runner whose manifest names no executable", async () => {
    const corpus = fresh();
    mkdirSync(join(corpus, "node_modules", "vitest"), { recursive: true });
    writeFileSync(
      join(corpus, "node_modules", "vitest", "package.json"),
      JSON.stringify({ name: "vitest", version: "0.0.0" }),
    );
    const { spawn } = scripted({ out: listing([]) });
    await expect(listCollected(corpus, spawn)).rejects.toThrow(
      "declares no executable",
    );
  });

  it("reads an executable declared as a bare string", async () => {
    const corpus = fresh();
    mkdirSync(join(corpus, "node_modules", "vitest"), { recursive: true });
    writeFileSync(
      join(corpus, "node_modules", "vitest", "package.json"),
      JSON.stringify({ name: "vitest", version: "0.0.0", bin: "./run.mjs" }),
    );
    const { calls, spawn } = scripted({ out: listing([]) });
    await listCollected(corpus, spawn);
    expect(calls.at(0)?.args.at(0)).toBe(
      join(corpus, "node_modules", "vitest", "run.mjs"),
    );
  });

  it("refuses a runner that did not return within the deadline, naming it", async () => {
    const corpus = corpusWithRunner();
    const { spawn } = scripted({ code: null, killed: true });
    await expect(listCollected(corpus, spawn)).rejects.toThrow(
      `the runner did not return within ${UNMEASURED_S}s listing the corpus at ${corpus}`,
    );
  });

  it("refuses a non-zero exit, naming the code", async () => {
    const corpus = corpusWithRunner();
    const { spawn } = scripted({ code: 2 });
    await expect(listCollected(corpus, spawn)).rejects.toThrow(
      "the runner exited 2 listing the corpus",
    );
  });

  it("refuses a runner that ended on a signal", async () => {
    const corpus = corpusWithRunner();
    const { spawn } = scripted({ code: null });
    await expect(listCollected(corpus, spawn)).rejects.toThrow(
      "the runner exited on a signal",
    );
  });

  it("refuses output that is not JSON", async () => {
    const corpus = corpusWithRunner();
    const { spawn } = scripted({ out: "no tests found" });
    await expect(listCollected(corpus, spawn)).rejects.toThrow(
      "the runner's list is not JSON",
    );
  });

  it("refuses JSON that is not a list", async () => {
    const corpus = corpusWithRunner();
    const { spawn } = scripted({ out: JSON.stringify({ file: "a" }) });
    await expect(listCollected(corpus, spawn)).rejects.toThrow(
      "the runner's list is not a list",
    );
  });

  it("refuses an entry without a file", async () => {
    const corpus = corpusWithRunner();
    const { spawn } = scripted({
      out: JSON.stringify([{ file: "a.test.ts" }, { name: "b" }, null]),
    });
    await expect(listCollected(corpus, spawn)).rejects.toThrow(
      "names no file at index 1",
    );
  });

  it("lists exactly what the real runner collects for a corpus under the published corpus configuration", async () => {
    // Resolved through the built `exports` map, as a consumer does, so the
    // list is produced under the shipped configuration and not a copy of it.
    const corpus = corpusWithRunner();
    mkdirSync(join(corpus, "node_modules", "@aztlan"));
    symlinkSync(
      packageRoot,
      join(corpus, "node_modules", "@aztlan", "guarantees"),
    );
    writeFileSync(join(corpus, "package.json"), '{ "type": "module" }\n');
    writeFileSync(
      join(corpus, "vitest.config.ts"),
      'import { defineCorpusConfig } from "@aztlan/guarantees/vitest";\nexport default defineCorpusConfig();\n',
    );
    const body = 'import { it } from "vitest";\nit("holds", () => {});\n';
    for (const directory of ["fixtures", "nested/fixtures", ".work/x"]) {
      mkdirSync(join(corpus, directory), { recursive: true });
      writeFileSync(join(corpus, directory, "skipped.test.ts"), body);
    }
    writeFileSync(join(corpus, "one.test.ts"), body);
    writeFileSync(join(corpus, "nested", "two.test.ts"), body);
    writeFileSync(join(corpus, "not-collected.ts"), body);
    expect(await listCollected(corpus)).toEqual([
      join("nested", "two.test.ts"),
      "one.test.ts",
    ]);
  }, 60_000);
});
