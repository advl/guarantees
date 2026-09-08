import { describe, expect, it } from "vitest";

import fakeSpawn from "../../_testing/fakeSpawn.js";
import { Refusal } from "../contract/index.js";
import { CORPUS_LABEL, type Engine, hashCheckout, reapStale } from "./index.js";

const engine: Engine = { binary: "engine", version: "1" };
const repositoryRoot = "/srv/checkout";
const checkout = hashCheckout(repositoryRoot);

/** An engine whose listings answer in turn, the last answer repeating, and whose removals succeed. */
const listing = (...answers: readonly (string | null)[]) => {
  let listed = 0;
  return fakeSpawn(({ args }) => {
    if (args[0] !== "ps") return { code: 0, out: "", killed: false };
    const answer =
      answers.length === 0 ? "" : answers[Math.min(listed, answers.length - 1)];
    listed += 1;
    return answer === null
      ? { code: 125, out: "", killed: false }
      : { code: 0, out: answer, killed: false };
  });
};

describe("reapStale", () => {
  it("answers nothing reaped on a clean machine, after one listing", async () => {
    const { spawn, calls } = listing("");
    expect(await reapStale(engine, repositoryRoot, spawn)).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it("lists by the label of the root it is given, as a run of that root labels its containers, and no other", async () => {
    const { spawn, calls } = listing("");
    await reapStale(engine, repositoryRoot, spawn);
    expect(calls[0]?.args).toEqual([
      "ps",
      "--all",
      "--filter",
      `label=${CORPUS_LABEL}=${checkout}`,
      "--format",
      "{{.Names}}",
    ]);
  });

  it("removes every container an earlier run left, verifies, and answers their names", async () => {
    const { spawn, calls } = listing("old-build-0\nold-measured", "");
    expect(await reapStale(engine, repositoryRoot, spawn)).toEqual([
      "old-build-0",
      "old-measured",
    ]);
    expect(calls.map((call) => call.args[0])).toEqual(["ps", "rm", "rm", "ps"]);
    expect(calls[1]?.args.at(-1)).toBe("old-build-0");
    expect(calls[2]?.args.at(-1)).toBe("old-measured");
  });

  it("refuses a relative root before asking the engine anything", async () => {
    const { spawn, calls } = listing("");
    await expect(reapStale(engine, "checkout", spawn)).rejects.toThrow(Refusal);
    expect(calls).toHaveLength(0);
  });

  it("refuses when the engine does not say what is running", async () => {
    const { spawn } = listing(null);
    await expect(reapStale(engine, repositoryRoot, spawn)).rejects.toThrow(
      Refusal,
    );
    await expect(reapStale(engine, repositoryRoot, spawn)).rejects.toThrow(
      "did not say whether an earlier run of this checkout left a container running",
    );
  });

  it("refuses when the engine does not answer after the removal", async () => {
    const { spawn } = listing("old-measured", null);
    await expect(reapStale(engine, repositoryRoot, spawn)).rejects.toThrow(
      "did not answer after removing old-measured",
    );
  });

  it("refuses when a container survives its removal, naming it", async () => {
    const { spawn } = listing("old-measured", "old-measured");
    await expect(reapStale(engine, repositoryRoot, spawn)).rejects.toThrow(
      "old-measured could not be removed",
    );
  });
});
