import { describe, expect, it } from "vitest";

import fakeSpawn from "../../_testing/fakeSpawn.js";
import { IMAGE_A, IMAGE_B } from "../../_testing/fixtures.js";
import { Refusal } from "../contract/index.js";
import type { Spawned } from "../process/index.js";
import { UNMEASURED_S } from "../register/index.js";
import type { Engine } from "../run/index.js";
import { resolveImage } from "./index.js";

const engine: Engine = { binary: "engine", version: "1" };
const digestA = IMAGE_A.slice(IMAGE_A.indexOf("@") + 1);
const idA = `sha256:${"1".repeat(64)}`;
const idOther = `sha256:${"2".repeat(64)}`;
const otherDigest = `sha256:${"3".repeat(64)}`;

/** An engine holding the given listing, pulling as told. */
const holding = (
  listing: string,
  pull: Spawned = { code: 0, out: "", killed: false },
) =>
  fakeSpawn(({ args }) =>
    args[0] === "images"
      ? { code: 0, out: listing, killed: false }
      : args[0] === "pull"
        ? pull
        : { code: 1, out: "", killed: false },
  );

describe("resolveImage", () => {
  it("lists local images by digest, repo digests and untruncated ID", async () => {
    const { spawn, calls } = holding("");
    await resolveImage(engine, IMAGE_A, spawn);
    expect(calls[0]).toEqual({
      binary: "engine",
      args: [
        "images",
        "--no-trunc",
        "--format",
        "{{.Digest}} {{.RepoDigests}} {{.ID}}",
      ],
      options: { deadlineMs: UNMEASURED_S * 1000, capture: true },
    });
  });

  it("answers the ID of an image found by its digest, whatever its tag, and pulls nothing", async () => {
    const { spawn, calls } = holding(
      [
        `${otherDigest} [ghcr.io/example/other@${otherDigest}] ${idOther}`,
        `${digestA} [localhost/anything@${digestA}] ${idA}`,
      ].join("\n"),
    );
    expect(await resolveImage(engine, IMAGE_A, spawn)).toEqual({
      digest: digestA,
      reference: idA,
    });
    expect(calls.map((call) => call.args[0])).toEqual(["images"]);
  });

  it("answers the ID of an image whose repo digests carry the pinned one under another name", async () => {
    const { spawn } = holding(
      `${otherDigest} [ghcr.io/example/other@${otherDigest} ghcr.io/example/mirror@${digestA}] ${idA}`,
    );
    expect((await resolveImage(engine, IMAGE_A, spawn)).reference).toBe(idA);
  });

  it("pulls an absent image and answers the reference itself", async () => {
    const { spawn, calls } = holding(
      `${otherDigest} [ghcr.io/example/other@${otherDigest}] ${idOther}`,
    );
    expect(await resolveImage(engine, IMAGE_A, spawn)).toEqual({
      digest: digestA,
      reference: IMAGE_A,
    });
    expect(calls[1]).toEqual({
      binary: "engine",
      args: ["pull", IMAGE_A],
      options: { deadlineMs: UNMEASURED_S * 1000 },
    });
  });

  it("refuses a pull that stalled to its deadline, naming the deadline and not absence", async () => {
    const { spawn } = holding("", { code: null, out: "", killed: true });
    await expect(resolveImage(engine, IMAGE_B, spawn)).rejects.toThrow(
      `${IMAGE_B} did not pull within ${UNMEASURED_S}s`,
    );
  });

  it("refuses an image that is neither local nor pullable, naming it", async () => {
    const { spawn } = holding("", { code: 125, out: "", killed: false });
    await expect(resolveImage(engine, IMAGE_B, spawn)).rejects.toThrow(Refusal);
    await expect(resolveImage(engine, IMAGE_B, spawn)).rejects.toThrow(
      `${IMAGE_B} is neither in local storage nor pullable`,
    );
  });

  it("refuses an engine that cannot list its images", async () => {
    const { spawn } = fakeSpawn(() => ({ code: 125, out: "", killed: false }));
    await expect(resolveImage(engine, IMAGE_A, spawn)).rejects.toThrow(
      "could not list its images",
    );
  });

  it("refuses a reference that is not pinned by digest, without spawning", async () => {
    const { spawn, calls } = holding("");
    await expect(
      resolveImage(engine, "ghcr.io/example/guarantees-ts:latest", spawn),
    ).rejects.toThrow("is not an image pinned by digest");
    expect(calls).toHaveLength(0);
  });
});
