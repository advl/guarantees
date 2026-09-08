import { describe, expect, it } from "vitest";

import fakeSpawn from "../../_testing/fakeSpawn.js";
import { Refusal } from "../contract/index.js";
import { UNMEASURED_S } from "../register/index.js";
import { ENGINE, probeEngine } from "./index.js";

const versionLine = `${ENGINE} version 5.8.2`;

describe("probeEngine", () => {
  it("asks the engine for its version under the unmeasured deadline", async () => {
    const { spawn, calls } = fakeSpawn(() => ({
      code: 0,
      out: versionLine,
      killed: false,
    }));
    await probeEngine(spawn);
    expect(calls).toEqual([
      {
        binary: ENGINE,
        args: ["--version"],
        options: { deadlineMs: UNMEASURED_S * 1000, capture: true },
      },
    ]);
  });

  it("answers the engine's binary and the version it printed", async () => {
    const { spawn } = fakeSpawn(() => ({
      code: 0,
      out: versionLine,
      killed: false,
    }));
    expect(await probeEngine(spawn)).toEqual({
      binary: ENGINE,
      version: "5.8.2",
    });
  });

  it("refuses a machine without the engine, naming it", async () => {
    const { spawn } = fakeSpawn(() => {
      throw Object.assign(new Error("spawn failed"), { code: "ENOENT" });
    });
    await expect(probeEngine(spawn)).rejects.toThrow(Refusal);
    await expect(probeEngine(spawn)).rejects.toThrow(
      `no \`${ENGINE}\` on PATH`,
    );
  });

  it("refuses an engine that exits non-zero", async () => {
    const { spawn } = fakeSpawn(() => ({ code: 125, out: "", killed: false }));
    await expect(probeEngine(spawn)).rejects.toThrow("exited 125");
  });

  it("refuses an engine that ended on a signal", async () => {
    const { spawn } = fakeSpawn(() => ({ code: null, out: "", killed: false }));
    await expect(probeEngine(spawn)).rejects.toThrow("exited on a signal");
  });

  it("refuses an engine that did not answer within the deadline, naming it", async () => {
    const { spawn } = fakeSpawn(() => ({ code: null, out: "", killed: true }));
    await expect(probeEngine(spawn)).rejects.toThrow(
      `did not return within ${UNMEASURED_S}s`,
    );
  });

  it("refuses an answer with no version in it", async () => {
    const { spawn } = fakeSpawn(() => ({
      code: 0,
      out: "something else entirely",
      killed: false,
    }));
    await expect(probeEngine(spawn)).rejects.toThrow(
      "no version could be read from it",
    );
  });
});
