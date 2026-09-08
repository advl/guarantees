import { afterAll, describe, expect, inject, it } from "vitest";

import { Refusal } from "../../lib/contract/index.js";
import { resolveImage } from "../../lib/image/index.js";
import { spawnProcess } from "../../lib/process/index.js";
import { UNMEASURED_S } from "../../lib/register/index.js";
import { SMALL_IMAGE } from "../constants.js";

const engine = inject("engine");
const baseImage = inject("baseImage");

// A tag of this process's own, since the store is shared by every process.
const OTHER_TAG = `localhost/example-other:x-${process.pid}`;
const ABSENT = `ghcr.io/example/absent@sha256:${"0".repeat(64)}`;

/** The engine's answer to an image subcommand, captured. */
const image = async (...args: readonly string[]) => {
  const ran = await spawnProcess(engine.binary, ["image", ...args], {
    deadlineMs: UNMEASURED_S * 1000,
    capture: true,
  });
  return ran;
};

afterAll(async () => {
  await image("untag", OTHER_TAG, OTHER_TAG);
});

describe("image resolution", () => {
  it("finds an image in local storage by its digest whatever its tag, and answers its ID", async () => {
    expect((await image("tag", baseImage, OTHER_TAG)).code).toBe(0);
    const digest = (
      await image("inspect", "--format", "{{.Digest}}", OTHER_TAG)
    ).out;
    const resolved = await resolveImage(
      engine,
      `ghcr.io/example/other@${digest}`,
    );
    expect(resolved.digest).toBe(digest);
    expect(resolved.reference).toBe(baseImage);
  }, 60_000);

  it("pulls an image that is absent and answers the reference, after which it is local under its ID", async () => {
    expect((await image("rm", "--ignore", SMALL_IMAGE)).code).toBe(0);
    const pulled = await resolveImage(engine, SMALL_IMAGE);
    expect(pulled.reference).toBe(SMALL_IMAGE);
    const local = await resolveImage(engine, SMALL_IMAGE);
    expect(local.reference).toMatch(/^sha256:[0-9a-f]{64}$/);
  }, 120_000);

  it("refuses an image that is neither local nor pullable, naming it", async () => {
    await expect(resolveImage(engine, ABSENT)).rejects.toThrow(Refusal);
    await expect(resolveImage(engine, ABSENT)).rejects.toThrow(
      `${ABSENT} is neither in local storage nor pullable`,
    );
  }, 120_000);
});
