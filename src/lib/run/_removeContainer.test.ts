import { describe, expect, it } from "vitest";

import fakeSpawn from "../../_testing/fakeSpawn.js";
import { UNMEASURED_S } from "../register/index.js";
import _removeContainer from "./_removeContainer.js";
import type { Engine } from "./index.js";

const engine: Engine = { binary: "engine", version: "1" };

describe("_removeContainer", () => {
  it("removes the named container by force, at once, and treats an absent one as removed", async () => {
    const { spawn, calls } = fakeSpawn();
    await _removeContainer(engine, spawn, "guarantees-x-measured-1");
    expect(calls).toEqual([
      {
        binary: "engine",
        args: [
          "rm",
          "--force",
          "--time",
          "0",
          "--ignore",
          "guarantees-x-measured-1",
        ],
        options: { deadlineMs: UNMEASURED_S * 1000 },
      },
    ]);
  });
});
