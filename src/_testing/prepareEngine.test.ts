import { describe, expect, it } from "vitest";
import type { TestProject } from "vitest/node";

import { Refusal } from "../lib/contract/index.js";
import { ENGINE } from "../lib/run/index.js";
import { BASE_TAG_PREFIX, SMALL_IMAGE } from "./constants.js";
import fakeSpawn from "./fakeSpawn.js";
import prepareEngine from "./prepareEngine.js";

const ID = `sha256:${"5".repeat(64)}`;
const TAG = `${BASE_TAG_PREFIX}-${process.pid}`;
const DIGEST = SMALL_IMAGE.slice(SMALL_IMAGE.indexOf("@") + 1);

/** A project that records what it was handed. */
const fakeProject = () => {
  const provided: [string, unknown][] = [];
  const project = {
    provide: (key: string, value: unknown) => {
      provided.push([key, value]);
    },
  } as unknown as TestProject;
  return { project, provided };
};

/** What the engine answers the tag listing the reap reads, when a test gives it one. */
const TAG_FORMAT = "{{.Repository}}:{{.Tag}}";

/** An engine that answers its version, builds, inspects and pulls as told, holding the small image already when asked to. */
const healthy = (
  build = { code: 0, out: "", killed: false },
  holdsSmall = false,
  tags = "",
) =>
  fakeSpawn(({ args }) => {
    const out = {
      "--version": `${ENGINE} version 9.9.9`,
      image: `${ID.slice("sha256:".length)} sha256:${"6".repeat(64)}`,
      images: holdsSmall ? `${DIGEST} [] ${ID}` : "",
    }[args[0] ?? ""];
    if (args[0] === "build") return build;
    if (args.includes(TAG_FORMAT)) {
      return { code: 0, out: tags, killed: false };
    }
    return { code: 0, out: out ?? "", killed: false };
  });

describe("prepareEngine", () => {
  it("provides the probed engine and the built image by its ID, never by its tag", async () => {
    const { project, provided } = fakeProject();
    await prepareEngine(project, healthy().spawn);
    expect(provided).toEqual([
      ["engine", { binary: ENGINE, version: "9.9.9" }],
      ["baseImage", ID],
    ]);
  });

  it("probes, builds once under a tag of this process's own, and pulls once, in that order", async () => {
    const { spawn, calls } = healthy();
    await prepareEngine(fakeProject().project, spawn);
    expect(calls.map((call) => call.args[0])).toEqual([
      "--version",
      "images",
      "build",
      "image",
      "images",
      "pull",
    ]);
    expect(calls[2]?.args).toContain(TAG);
    expect(calls[5]?.args).toEqual(["pull", SMALL_IMAGE]);
  });

  it("removes a tag an earlier run left behind, and never one a running suite still holds", async () => {
    // A tag names the process that minted it, so what is safe to remove is
    // what no process answers to any more; a live sibling's tag may be the
    // only name its image has, and removing it would take the image with it.
    const dead = `${BASE_TAG_PREFIX}-2147483`;
    const { spawn, calls } = healthy(
      undefined,
      false,
      [dead, TAG, "localhost/something-else:latest"].join("\n"),
    );
    await prepareEngine(fakeProject().project, spawn);
    expect(calls[2]?.args).toEqual(["rmi", "--ignore", dead]);
  });

  it("builds without removing anything when the store holds no tag of an earlier run", async () => {
    const { spawn, calls } = healthy(undefined, false, "");
    await prepareEngine(fakeProject().project, spawn);
    expect(calls.map((call) => call.args[0])).not.toContain("rmi");
  });

  it("builds anyway when the engine will not say what the store holds, since the build is the answer either way", async () => {
    const { spawn, calls } = fakeSpawn(({ args }) =>
      args.includes(TAG_FORMAT)
        ? { code: 1, out: "", killed: false }
        : {
            code: 0,
            out:
              args[0] === "--version"
                ? `${ENGINE} version 9.9.9`
                : args[0] === "image"
                  ? `${ID.slice("sha256:".length)} sha256:${"6".repeat(64)}`
                  : "",
            killed: false,
          },
    );
    await prepareEngine(fakeProject().project, spawn);
    expect(calls.map((call) => call.args[0])).toContain("build");
  });

  it("answers a teardown that removes its own tag and the small image it pulled, ignoring what is already gone", async () => {
    const { spawn, calls } = healthy();
    await (await prepareEngine(fakeProject().project, spawn))();
    expect(calls.at(-1)?.args).toEqual(["rmi", "--ignore", TAG, SMALL_IMAGE]);
  });

  it("leaves a small image the store already held where it found it", async () => {
    const { spawn, calls } = healthy(undefined, true);
    await (await prepareEngine(fakeProject().project, spawn))();
    expect(calls.map((call) => call.args[0])).not.toContain("pull");
    expect(calls.at(-1)?.args).toEqual(["rmi", "--ignore", TAG]);
  });

  it("lets a failed build refuse the whole suite, naming the Containerfile", async () => {
    const { project, provided } = fakeProject();
    const { spawn } = healthy({ code: 1, out: "", killed: false });
    await expect(prepareEngine(project, spawn)).rejects.toThrow(Refusal);
    await expect(prepareEngine(project, spawn)).rejects.toThrow(
      "building images/ts/Containerfile failed",
    );
    expect(provided).toHaveLength(0);
  });
});
