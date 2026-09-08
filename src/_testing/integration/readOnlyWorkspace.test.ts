import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { reapStale, runEntry } from "../../lib/run/index.js";
import { WORK_DIR } from "../../lib/runner/index.js";
import makeCorpus from "../makeCorpus.js";
import { renderLookingUp, renderWriting } from "./fixtures.js";

const engine = inject("engine");
const baseImage = inject("baseImage");

const corpus = makeCorpus({
  name: "read-only-workspace",
  entries: [
    {
      row: { id: "escaping" },
      body: renderWriting("escaping", "/workspace/guarantees/escaped.txt"),
    },
    {
      row: { id: "producing" },
      body: renderWriting(
        "producing",
        `/workspace/guarantees/${WORK_DIR}/producing/product.txt`,
      ),
    },
    {
      row: { id: "walled" },
      body: renderLookingUp("walled", "example.com"),
    },
  ],
});
const rows = new Map(corpus.rows.map((row) => [row.id, row]));
const row = (id: string) => {
  const found = rows.get(id);
  if (found === undefined) throw new Error(`no fixture row ${id}`);
  return found;
};

const reap = () => reapStale(engine, corpus.repositoryRoot);
beforeAll(reap);
afterAll(async () => {
  await reap();
  corpus.remove();
});

describe("the read-only workspace and the network wall", () => {
  it("fails an entry that writes outside its work directory, on the write, and the file never reaches the host", async () => {
    const ran = await runEntry(
      row("escaping"),
      corpus.context(engine, baseImage),
    );
    expect(ran.ok).toBe(false);
    expect(ran.reason).toBe(
      "escaping: 0 passed, 1 failed, expected to pass — escaping holds",
    );
    expect(existsSync(join(corpus.corpusRoot, "escaped.txt"))).toBe(false);
  });

  it("lets an entry write under its own work directory", async () => {
    const ran = await runEntry(
      row("producing"),
      corpus.context(engine, baseImage),
    );
    expect(ran.ok).toBe(true);
  });

  it("gives an entry under isolation image no network to resolve a host with", async () => {
    const ran = await runEntry(
      row("walled"),
      corpus.context(engine, baseImage),
    );
    expect(ran.ok).toBe(true);
  });
});
