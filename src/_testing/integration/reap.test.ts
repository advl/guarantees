import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { spawnProcess } from "../../lib/process/index.js";
import { UNMEASURED_S } from "../../lib/register/index.js";
import _listLabelled from "../../lib/run/_listLabelled.js";
import {
  CORPUS_LABEL,
  ENTRY_LABEL,
  hashCheckout,
  NAME_PREFIX,
  reapStale,
} from "../../lib/run/index.js";
import { SMALL_IMAGE } from "../constants.js";
import makeCorpus from "../makeCorpus.js";
import { renderPassing } from "./fixtures.js";

const engine = inject("engine");

const corpus = makeCorpus({
  name: "reap",
  entries: [{ row: { id: "stale-entry" }, body: renderPassing("stale-entry") }],
});
// A second checkout as fixed as the first, so the reap finds what it left.
const otherRoot = `${corpus.repositoryRoot}-other`;
const otherCheckout = hashCheckout(otherRoot);

const stale = `${NAME_PREFIX}-stale-entry-measured-${process.pid}`;
const foreign = `${NAME_PREFIX}-foreign-entry-measured-${process.pid}`;

/** A detached container that sleeps, labelled as a run of `checkout` would label it. */
const start = async (name: string, checkout: string) => {
  const ran = await spawnProcess(
    engine.binary,
    [
      "run",
      "--detach",
      "--rm",
      "--name",
      name,
      "--label",
      `${CORPUS_LABEL}=${checkout}`,
      "--label",
      `${ENTRY_LABEL}=stale-entry`,
      SMALL_IMAGE,
      "sleep",
      "600",
    ],
    { deadlineMs: UNMEASURED_S * 1000, capture: true },
  );
  expect(ran.code).toBe(0);
};

const listed = (checkout: string) =>
  _listLabelled(engine, spawnProcess, { [CORPUS_LABEL]: checkout });

const reap = async () => {
  await reapStale(engine, corpus.repositoryRoot);
  await reapStale(engine, otherRoot);
};
beforeAll(reap);
afterAll(async () => {
  await reap();
  corpus.remove();
});

describe("the reap", () => {
  it("removes what an earlier run of this checkout left and nothing of another checkout's", async () => {
    await start(stale, corpus.checkout);
    await start(foreign, otherCheckout);
    expect((await listed(corpus.checkout)).names).toEqual([stale]);

    expect(await reapStale(engine, corpus.repositoryRoot)).toEqual([stale]);

    expect(await listed(corpus.checkout)).toEqual({
      answered: true,
      names: [],
    });
    expect((await listed(otherCheckout)).names).toEqual([foreign]);
  });

  it("reaps nothing the second time", async () => {
    expect(await reapStale(engine, corpus.repositoryRoot)).toEqual([]);
  });
});
