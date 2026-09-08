import { describe, expect, it } from "vitest";

import fakeSpawn from "./fakeSpawn.js";

const clean = { code: 0, out: "", killed: false };

describe("fakeSpawn", () => {
  it("records every call in order and answers a clean exit by default", async () => {
    const { spawn, calls } = fakeSpawn();
    const first = await spawn("engine", ["ps"], { deadlineMs: 1 });
    const second = await spawn("engine", ["rm", "x"], { deadlineMs: 2 });
    expect(first).toEqual(clean);
    expect(second).toEqual(clean);
    expect(calls.map((call) => call.args)).toEqual([["ps"], ["rm", "x"]]);
    expect(calls[1]?.options.deadlineMs).toBe(2);
  });

  it("answers what the script says for the call it sees", async () => {
    const { spawn } = fakeSpawn(({ args }) =>
      args[0] === "ps"
        ? { code: 0, out: "one\ntwo", killed: false }
        : { code: 1, out: "", killed: true },
    );
    expect((await spawn("engine", ["ps"], { deadlineMs: 1 })).out).toBe(
      "one\ntwo",
    );
    expect((await spawn("engine", ["rm"], { deadlineMs: 1 })).killed).toBe(
      true,
    );
  });
});
