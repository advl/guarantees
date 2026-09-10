import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import {
  buildImage,
  hashImageInputs,
  IMAGES_DIR,
  INPUTS_PATTERN,
  PINNED_FILE,
  readPinned,
} from "../../lib/image/index.js";
import { spawnProcess } from "../../lib/process/index.js";
import { UNMEASURED_S } from "../../lib/register/index.js";
import _renderRun from "../../lib/run/_renderRun.js";
import { describeRun, reapStale } from "../../lib/run/index.js";
import { RUNNER_BIN, WORK_DIR } from "../../lib/runner/index.js";
import { BASE_IMAGE_NAME, BASE_TAG_PREFIX } from "../constants.js";
import fakeSpawn from "../fakeSpawn.js";
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

  it("answers one digest for two builds of one definition that shared no layer, so one definition publishes as one digest rather than a new one per run", async () => {
    // Every layer rebuilt, twice, which is the only way to ask the question:
    // a build that reuses cached layers answers the cached digest and would
    // pass whether or not the definition reproduces. What has to agree is
    // two runs of the publishing job over one definition — a job that
    // answered a new digest each time would move every row on every run.
    //
    // The arguments come from `buildImage` rather than being written here,
    // so the flags this measurement rests on are the ones the package
    // actually passes: dropped there, these two builds stop agreeing and
    // this goes red, where a copy of the argv would go on measuring itself.
    const digests: string[] = [];
    const minted: string[] = [];
    try {
      for (const round of ["first", "second"]) {
        const tag = `${BASE_TAG_PREFIX}-${process.pid}-cold-${round}`;
        minted.push(tag);
        const { spawn, calls } = fakeSpawn(() => ({
          code: 0,
          out: "id digest",
          killed: false,
        }));
        await buildImage(engine, root, BASE_IMAGE_NAME, tag, spawn);
        const [asked] = calls;
        if (asked === undefined)
          throw new Error("the build asked the engine nothing");
        await spawnProcess(
          engine.binary,
          ["build", "--no-cache", ...asked.args.slice(1)],
          { cwd: root, deadlineMs: UNMEASURED_S * 1000 },
        );
        const inspected = await spawnProcess(
          engine.binary,
          ["image", "inspect", "--format", "{{.Digest}}", tag],
          { deadlineMs: UNMEASURED_S * 1000, capture: true },
        );
        digests.push(inspected.out);
      }
    } finally {
      // Two images of half a gigabyte each, and the intermediates the
      // uncached builds left: a build that failed between the tag and the
      // removal would otherwise leave them in the store with no teardown
      // anywhere that reaches them.
      for (const tag of minted) {
        await spawnProcess(engine.binary, ["rmi", "--ignore", tag], {
          deadlineMs: UNMEASURED_S * 1000,
        });
      }
    }
    expect(digests[0]).toMatch(INPUTS_PATTERN);
    expect(digests[1]).toBe(digests[0]);
  }, 300_000);

  it("is recorded as the reference this repository's own rows pin, over the definition the record was taken from", () => {
    const pinned = readPinned(
      readFileSync(
        join(root, IMAGES_DIR, BASE_IMAGE_NAME, PINNED_FILE),
        "utf8",
      ),
    );
    expect(pinned.inputs).toBe(hashImageInputs(root, BASE_IMAGE_NAME));
    // The digest and not the ID: the record names the image as a row names
    // it, and the ID is a name in this machine's store alone.
    expect(pinned.digest).toContain("@sha256:");
  });
});
