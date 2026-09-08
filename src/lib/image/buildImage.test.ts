import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import fakeSpawn from "../../_testing/fakeSpawn.js";
import { Refusal } from "../contract/index.js";
import type { Spawned } from "../process/index.js";
import { UNMEASURED_S } from "../register/index.js";
import type { Engine } from "../run/index.js";
import { buildImage, hashImageInputs } from "./index.js";

const engine: Engine = { binary: "engine", version: "1" };
const ID = "4".repeat(64);
const DIGEST = `sha256:${"3".repeat(64)}`;

const scratch: string[] = [];

/** A repository root with a minimal image definition under images/ts. */
const repository = () => {
  const root = mkdtempSync(join(tmpdir(), "build-image-"));
  scratch.push(root);
  mkdirSync(join(root, "images", "ts"), { recursive: true });
  writeFileSync(join(root, "images", "ts", "Containerfile"), "FROM scratch\n");
  return root;
};

/** An engine that builds as told and inspects to a fixed digest. */
const building = (build: Spawned = { code: 0, out: "", killed: false }) =>
  fakeSpawn(({ args }) =>
    args[0] === "build"
      ? build
      : { code: 0, out: `${ID} ${DIGEST}`, killed: false },
  );

afterEach(() => {
  for (const directory of scratch.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("buildImage", () => {
  it("builds the image's Containerfile with the repository root as context, tagged as asked", async () => {
    const root = repository();
    const { spawn, calls } = building();
    await buildImage(engine, root, "ts", "localhost/example:x", spawn);
    expect(calls[0]).toEqual({
      binary: "engine",
      args: [
        "build",
        "--file",
        "images/ts/Containerfile",
        "--tag",
        "localhost/example:x",
        root,
      ],
      options: { cwd: root, deadlineMs: UNMEASURED_S * 1000 },
    });
  });

  it("answers the built image's ID and digest, and the hash of the image's inputs", async () => {
    const root = repository();
    const { spawn, calls } = building();
    const built = await buildImage(
      engine,
      root,
      "ts",
      "localhost/example:x",
      spawn,
    );
    expect(built).toEqual({
      id: `sha256:${ID}`,
      localDigest: DIGEST,
      inputs: hashImageInputs(root, "ts"),
    });
    expect(calls[1]?.args).toEqual([
      "image",
      "inspect",
      "--format",
      "{{.Id}} {{.Digest}}",
      "localhost/example:x",
    ]);
  });

  it("refuses a failed build, naming the Containerfile", async () => {
    const root = repository();
    const { spawn } = building({ code: 1, out: "", killed: false });
    await expect(
      buildImage(engine, root, "ts", "localhost/example:x", spawn),
    ).rejects.toThrow(Refusal);
    await expect(
      buildImage(engine, root, "ts", "localhost/example:x", spawn),
    ).rejects.toThrow("building images/ts/Containerfile failed");
  });

  it("refuses a build that stalled to its deadline, naming the deadline", async () => {
    const root = repository();
    const { spawn } = building({ code: null, out: "", killed: true });
    await expect(
      buildImage(engine, root, "ts", "localhost/example:x", spawn),
    ).rejects.toThrow(
      `building images/ts/Containerfile did not finish within ${UNMEASURED_S}s`,
    );
  });

  it("refuses a built image that cannot be inspected", async () => {
    const root = repository();
    const { spawn } = fakeSpawn(({ args }) =>
      args[0] === "build"
        ? { code: 0, out: "", killed: false }
        : { code: 125, out: "", killed: false },
    );
    await expect(
      buildImage(engine, root, "ts", "localhost/example:x", spawn),
    ).rejects.toThrow("was built and cannot be inspected");
  });
});
