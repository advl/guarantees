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

/** An engine that answers its version, builds, inspects and pulls as told, holding the small image already when asked to. */
const healthy = (
  build = { code: 0, out: "", killed: false },
  holdsSmall = false,
) =>
  fakeSpawn(({ args }) => {
    const out = {
      "--version": `${ENGINE} version 9.9.9`,
      image: `${ID.slice("sha256:".length)} sha256:${"6".repeat(64)}`,
      images: holdsSmall ? `${DIGEST} [] ${ID}` : "",
    }[args[0] ?? ""];
    if (args[0] === "build") return build;
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
      "build",
      "image",
      "images",
      "pull",
    ]);
    expect(calls[1]?.args).toContain(TAG);
    expect(calls[4]?.args).toEqual(["pull", SMALL_IMAGE]);
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
