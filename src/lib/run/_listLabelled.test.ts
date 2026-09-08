import { describe, expect, it } from "vitest";

import fakeSpawn from "../../_testing/fakeSpawn.js";
import _listLabelled from "./_listLabelled.js";
import type { Engine } from "./index.js";

const engine: Engine = { binary: "engine", version: "1" };

describe("_listLabelled", () => {
  it("lists every container, running or not, carrying all of the labels, by name", async () => {
    const { spawn, calls } = fakeSpawn(() => ({
      code: 0,
      out: "one\ntwo",
      killed: false,
    }));
    const listed = await _listLabelled(engine, spawn, {
      corpus: "0123456789ab",
      entry: "x",
    });
    expect(listed).toEqual({ answered: true, names: ["one", "two"] });
    expect(calls[0]?.args).toEqual([
      "ps",
      "--all",
      "--filter",
      "label=corpus=0123456789ab",
      "--filter",
      "label=entry=x",
      "--format",
      "{{.Names}}",
    ]);
    expect(calls[0]?.options.capture).toBe(true);
  });

  it("answers no names for an engine that answered with nothing", async () => {
    const { spawn } = fakeSpawn();
    expect(await _listLabelled(engine, spawn, { corpus: "a" })).toEqual({
      answered: true,
      names: [],
    });
  });

  it("tells an engine that did not answer apart from one that found nothing", async () => {
    const failed = fakeSpawn(() => ({ code: 125, out: "", killed: false }));
    expect(await _listLabelled(engine, failed.spawn, { corpus: "a" })).toEqual({
      answered: false,
      names: [],
    });
    const killed = fakeSpawn(() => ({ code: null, out: "", killed: true }));
    expect(await _listLabelled(engine, killed.spawn, { corpus: "a" })).toEqual({
      answered: false,
      names: [],
    });
  });
});
