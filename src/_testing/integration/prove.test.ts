import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LOCAL_PREFIX } from "../../lib/image/index.js";
import { spawnProcess } from "../../lib/process/index.js";
import {
  BIJECTION_ID,
  ORPHAN_ID,
  type ProveContext,
  proveTier,
} from "../../lib/prove/index.js";
import type { Register, Row } from "../../lib/register/index.js";
import { UNMEASURED_S } from "../../lib/register/index.js";
import { reapStale } from "../../lib/run/index.js";
import { COLLECTS, REPORTS_DIR, WORK_DIR } from "../../lib/runner/index.js";
import { BASE_IMAGE_NAME } from "../constants.js";
import makeCorpus from "../makeCorpus.js";
import { renderFailing } from "./fixtures.js";

const engine = inject("engine");
const baseImage = inject("baseImage");
const packageRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

/**
 * A corpus whose bijection is the real body, run inside the image against
 * the corpus's own runner, beside the sentinel its tier is proved by. The
 * bodies reach the package the way a consumer's do, through the built
 * `exports` map, and the runner the corpus resolves is this repository's,
 * which is what a corpus of its own would install.
 */
const corpus = makeCorpus({
  name: "prove",
  entries: [
    {
      row: { id: BIJECTION_ID, teardown: [] },
      body: [
        'import { readFileSync } from "node:fs";',
        'import { dirname, join, resolve } from "node:path";',
        'import { fileURLToPath } from "node:url";',
        'import { parseRegister, TIERS } from "@aztlan/guarantees";',
        'import { describeBijection } from "@aztlan/guarantees/selftest";',
        "",
        "const corpusRoot = resolve(dirname(fileURLToPath(import.meta.url)));",
        'const text = readFileSync(join(corpusRoot, "corpus.toml"), "utf8");',
        "const register = parseRegister(text, {",
        "  triggeredTiers: TIERS,",
        "  provenTiers: TIERS,",
        '  collects: ".test.ts",',
        "});",
        "",
        `describeBijection({ id: "${BIJECTION_ID}", corpusRoot, register });`,
        "",
      ].join("\n"),
    },
    {
      row: { id: "corpus-can-fail", expect: "fail" },
      body: renderFailing("corpus-can-fail"),
    },
  ],
});

/** The register the corpus's own entry parses, written as a register is. */
const renderRegister = (rows: readonly Row[]) =>
  `${rows
    .map((row) =>
      [
        `[${row.id}]`,
        `kind = "conformance"`,
        `tier = "pr"`,
        `file = "${row.file}"`,
        `select = "${row.select}"`,
        "build = []",
        `image = "ghcr.io/example/guarantees-ts@sha256:${"0123456789abcdef".repeat(4)}"`,
        `isolation = "image"`,
        "holds = []",
        "teardown = []",
        `expect = "${row.expect}"`,
        `run_s = { class = "integration", p95 = 1.0, budget = 10 }`,
      ].join("\n"),
    )
    .join("\n\n")}\n`;

writeFileSync(
  join(corpus.corpusRoot, "corpus.toml"),
  renderRegister(corpus.rows),
);
writeFileSync(
  join(corpus.corpusRoot, "package.json"),
  '{ "name": "@example/prove-corpus", "private": true, "type": "module" }\n',
);
// The package is copied into the corpus's own install rather than linked,
// because the container is handed the fixture repository and nothing else:
// a link would point at a path outside the mount. The corpus's install is
// where a consumer keeps it, and the one the run deliberately leaves
// visible. Nothing else goes in it — the runner and the parser's own
// dependency come from the image, which is what the toolchain row pins.
const install = join(
  corpus.corpusRoot,
  "node_modules",
  "@aztlan",
  "guarantees",
);
mkdirSync(install, { recursive: true });
cpSync(join(packageRoot, "dist"), join(install, "dist"), { recursive: true });
cpSync(join(packageRoot, "package.json"), join(install, "package.json"));

let register: Register = new Map();
const context: ProveContext = {
  engine,
  repositoryRoot: corpus.repositoryRoot,
  corpusRoot: corpus.corpusRoot,
  nonce: String(process.pid),
};
const orphan = join(corpus.corpusRoot, `${ORPHAN_ID}${COLLECTS}`);

const reap = () => reapStale(engine, corpus.repositoryRoot);
beforeAll(async () => {
  await reap();
  // The rows name the image this suite built, by the digest it carries in
  // local storage, because a proof resolves each row's image from the row:
  // the register written into the tree may name anything, and what a proof
  // starts is what the rows it was handed say.
  const inspected = await spawnProcess(
    engine.binary,
    ["image", "inspect", "--format", "{{.Digest}}", baseImage],
    { deadlineMs: UNMEASURED_S * 1000, capture: true },
  );
  const image = `${LOCAL_PREFIX}-${BASE_IMAGE_NAME}@${inspected.out}`;
  register = new Map(corpus.rows.map((row) => [row.id, { ...row, image }]));
});
afterAll(async () => {
  await reap();
  corpus.remove();
});

describe("a tier's proof", () => {
  it("watches the sentinel go red and the bijection name the file no row claims, and leaves the tree as it found it", async () => {
    const proved = await proveTier("pr", register, context);
    expect(proved.reason).toContain(`${BIJECTION_ID} claims every file`);
    expect(proved.ok).toBe(true);
    expect(existsSync(orphan)).toBe(false);
    expect(
      existsSync(
        join(corpus.corpusRoot, WORK_DIR, REPORTS_DIR, `${BIJECTION_ID}.json`),
      ),
    ).toBe(false);
  });
});
