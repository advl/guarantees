import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import {
  buildImage,
  IMAGES_DIR,
  INPUTS_PATTERN,
  PINNED_FILE,
} from "../../lib/image/index.js";
import { spawnProcess } from "../../lib/process/index.js";
import { UNMEASURED_S } from "../../lib/register/index.js";
import _renderRun from "../../lib/run/_renderRun.js";
import { describeRun, reapStale } from "../../lib/run/index.js";
import { RUNNER_BIN, WORK_DIR } from "../../lib/runner/index.js";
import { BASE_IMAGE_NAME, BASE_TAG_PREFIX } from "../constants.js";
import makeCorpus from "../makeCorpus.js";
import { renderPassing } from "./fixtures.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const engine = inject("engine");
const baseImage = inject("baseImage");

const corpus = makeCorpus({
  name: "base-image",
  entries: [{ row: { id: "tooling" }, body: renderPassing("tooling") }],
});
const [row] = corpus.rows;
if (row === undefined) throw new Error("the fixture corpus holds one row");
mkdirSync(join(corpus.corpusRoot, WORK_DIR, row.id), { recursive: true });

/** What a command prints when run inside the base image as a measured run would be. */
const inside = async (command: readonly string[]) => {
  const spec = describeRun(row, {
    ...corpus.context(engine, baseImage),
    checkout: corpus.checkout,
    phase: "measured",
    command,
  });
  const ran = await spawnProcess(engine.binary, _renderRun(spec), {
    deadlineMs: UNMEASURED_S * 1000,
    capture: true,
  });
  expect(ran.code).toBe(0);
  return ran.out;
};

const reap = () => reapStale(engine, corpus.repositoryRoot);
beforeAll(reap);
afterAll(async () => {
  await reap();
  corpus.remove();
});

describe("the base image", () => {
  it("holds the runner at the image's root, at the pinned version", async () => {
    expect(await inside([RUNNER_BIN, "--version"])).toMatch(
      /^vitest\/4\.1\.10\b/,
    );
  });

  it("runs the runner under node 22", async () => {
    expect(await inside(["node", "--version"])).toMatch(/^v22\./);
  });

  it("runs the task face under the pinned bun", async () => {
    expect(await inside(["bun", "--version"])).toBe("1.3.13");
  });

  it("sees the repository at the workspace and its own work directory beside the corpus", async () => {
    const listed = await inside([
      "ls",
      "-A",
      "/workspace",
      "/workspace/guarantees",
    ]);
    expect(listed).toContain("package.json");
    expect(listed).toContain(WORK_DIR);
  });

  it("links itself to this repository through the source label", async () => {
    const manifest = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    ) as { readonly repository: { readonly url: string } };
    const ran = await spawnProcess(
      engine.binary,
      [
        "image",
        "inspect",
        "--format",
        '{{index .Labels "org.opencontainers.image.source"}}',
        baseImage,
      ],
      { deadlineMs: UNMEASURED_S * 1000, capture: true },
    );
    expect(ran.out).toBe(manifest.repository.url);
  });

  it("rebuilds from an unchanged definition to the very image the suite runs in, and answers a digest in the digest shape", async () => {
    const tag = `${BASE_TAG_PREFIX}-${process.pid}-again`;
    const built = await buildImage(engine, root, BASE_IMAGE_NAME, tag);
    await spawnProcess(engine.binary, ["untag", tag, tag], {
      deadlineMs: UNMEASURED_S * 1000,
    });
    expect(built.id).toBe(baseImage);
    expect(built.localDigest).toMatch(INPUTS_PATTERN);
  });

  it("carries no pinned record until it has been pushed", () => {
    expect(
      existsSync(join(root, IMAGES_DIR, BASE_IMAGE_NAME, PINNED_FILE)),
    ).toBe(false);
  });
});
