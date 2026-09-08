import { describe, expect, it } from "vitest";

import { spawnProcess } from "./index.js";

const LONG = 600_000;

describe("spawnProcess", () => {
  it("answers the exit code and the captured output, trimmed", async () => {
    const ran = await spawnProcess(
      "node",
      ["-e", "process.stdout.write('  answered\\n'); process.exit(4)"],
      { deadlineMs: LONG, capture: true },
    );
    expect(ran).toEqual({ code: 4, out: "answered", killed: false });
  });

  it("captures nothing when not asked to", async () => {
    const ran = await spawnProcess(
      "node",
      ["-e", "process.stdout.write('unread')"],
      { deadlineMs: LONG },
    );
    expect(ran).toEqual({ code: 0, out: "", killed: false });
  });

  it("runs the process from the working directory it is given", async () => {
    const ran = await spawnProcess(
      "node",
      ["-e", "process.stdout.write(process.cwd())"],
      { deadlineMs: LONG, capture: true, cwd: "/" },
    );
    expect(ran.out).toBe("/");
  });

  it("kills a process at the deadline and reports it killed", async () => {
    const ran = await spawnProcess("sleep", ["5"], { deadlineMs: 100 });
    expect(ran.killed).toBe(true);
    expect(ran.code).toBeNull();
  });

  it("awaits the deadline hook before the process is signalled", async () => {
    // The process writes a heartbeat every 20 ms; how many it wrote says how
    // long it lived. Signalled at the 100 ms deadline it writes about five;
    // left alone until the hook's 400 ms are over, about twenty-five.
    const ran = await spawnProcess(
      "node",
      ["-e", "setInterval(() => process.stdout.write('.'), 20)"],
      {
        deadlineMs: 100,
        capture: true,
        onDeadline: () => new Promise((resolve) => setTimeout(resolve, 400)),
      },
    );
    expect(ran.killed).toBe(true);
    expect(ran.out.length).toBeGreaterThan(12);
  });

  it("does not signal a process that ended while the hook was running", async () => {
    const ran = await spawnProcess("sleep", ["0.3"], {
      deadlineMs: 100,
      onDeadline: () => new Promise((resolve) => setTimeout(resolve, 600)),
    });
    expect(ran).toEqual({ code: 0, out: "", killed: true });
  });

  it("rejects with the hook's failure once the process has closed", async () => {
    await expect(
      spawnProcess("sleep", ["5"], {
        deadlineMs: 100,
        onDeadline: () => Promise.reject(new Error("no engine to remove with")),
      }),
    ).rejects.toThrow("no engine to remove with");
  });

  it("rejects when the binary cannot be started", async () => {
    await expect(
      spawnProcess("no-such-engine-binary", [], { deadlineMs: LONG }),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
});
