import { describe, expect, it } from "vitest";

import fakeSpawn from "../../_testing/fakeSpawn.js";
import { UNMEASURED_S } from "../register/index.js";
import _callEngine from "./_callEngine.js";
import type { Engine } from "./index.js";

const engine: Engine = { binary: "engine", version: "1" };

describe("_callEngine", () => {
  it("spawns the probed binary with the unmeasured deadline by default", async () => {
    const { spawn, calls } = fakeSpawn();
    await _callEngine(engine, spawn, ["ps"]);
    expect(calls[0]?.binary).toBe("engine");
    expect(calls[0]?.args).toEqual(["ps"]);
    expect(calls[0]?.options.deadlineMs).toBe(UNMEASURED_S * 1000);
    expect(calls[0]?.options.onDeadline).toBeUndefined();
  });

  it("converts an explicit deadline to milliseconds and passes capture and cwd through", async () => {
    const { spawn, calls } = fakeSpawn();
    await _callEngine(engine, spawn, ["images"], {
      deadlineS: 30,
      capture: true,
      cwd: "/srv/repo",
    });
    expect(calls[0]?.options).toMatchObject({
      deadlineMs: 30_000,
      capture: true,
      cwd: "/srv/repo",
    });
  });

  it("removes the named container when the deadline fires, and never signals the client first", async () => {
    const { spawn, calls } = fakeSpawn(async (call) => {
      if (call.args[0] === "run") {
        await call.options.onDeadline?.();
        return { code: null, out: "", killed: true };
      }
      return { code: 0, out: "", killed: false };
    });
    const ran = await _callEngine(engine, spawn, ["run", "image"], {
      deadlineS: 1,
      container: "guarantees-x-measured-1",
    });
    expect(ran.killed).toBe(true);
    expect(calls.map((call) => call.args)).toEqual([
      ["run", "image"],
      ["rm", "--force", "--time", "0", "--ignore", "guarantees-x-measured-1"],
    ]);
  });
});
