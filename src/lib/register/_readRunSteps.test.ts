import { describe, expect, it } from "vitest";

import _readRunSteps from "./_readRunSteps.js";

describe("_readRunSteps", () => {
  it("reads a step's one-line command", () => {
    expect(
      _readRunSteps(
        ["    steps:", "      - run: bun run g:tier pr"].join("\n"),
      ),
    ).toEqual(["bun run g:tier pr"]);
  });

  it("reads every line of a block a step opens, and stops where the block does", () => {
    expect(
      _readRunSteps(
        [
          "      - name: Run the tier",
          "        run: |",
          "          bun run g:tier pr",
          "          bun run g:prove pr",
          "      - name: Afterwards",
          "        uses: example/action@v1",
        ].join("\n"),
      ),
    ).toEqual(["bun run g:tier pr", "bun run g:prove pr"]);
  });

  it("reads nothing out of a step that is commented out, which is how a step is switched off", () => {
    expect(
      _readRunSteps(
        [
          "      # - run: bun run g:tier pr",
          "      # - run: bun run g:prove pr",
          "      - run: echo nothing",
        ].join("\n"),
      ),
    ).toEqual(["echo nothing"]);
  });

  it("reads nothing out of prose, which writes a command without running it", () => {
    expect(
      _readRunSteps("# `g:tier pr` runs the rows, then `g:prove pr`.\n"),
    ).toEqual([]);
  });

  it("drops what a comment ends, on a step's own line and inside a block alike", () => {
    expect(
      _readRunSteps(
        [
          "      - run: bun run g:tier pr # and then the proof",
          "      - run: |",
          "          # bun run g:prove pr",
          "          bun run ci",
        ].join("\n"),
      ),
    ).toEqual(["bun run g:tier pr", "bun run ci"]);
  });

  it("keeps a blank line inside a block, since a block ends at its indentation and not at a gap", () => {
    expect(
      _readRunSteps(
        [
          "        run: |",
          "          bun run g:tier pr",
          "",
          "          bun run g:prove pr",
        ].join("\n"),
      ),
    ).toEqual(["bun run g:tier pr", "bun run g:prove pr"]);
  });

  it("reads nothing out of a step whose command is empty, which runs nothing", () => {
    expect(
      _readRunSteps(["      - run:", "      - run:  "].join("\n")),
    ).toEqual([]);
  });

  it("reads nothing out of a step a condition guards, which is how a step is switched off in one word", () => {
    expect(
      _readRunSteps(
        [
          "      - name: Run the tier",
          "        if: false",
          "        run: bun run g:tier pr",
          "      - run: echo nothing",
        ].join("\n"),
      ),
    ).toEqual(["echo nothing"]);
  });

  it("reads nothing out of a step whose condition is written under its command", () => {
    expect(
      _readRunSteps(
        [
          "      - run: bun run g:tier pr",
          `        if: ${"$"}{{ false }}`,
          "      - run: echo nothing",
        ].join("\n"),
      ),
    ).toEqual(["echo nothing"]);
  });

  it("reads nothing out of a block a guarded step opens, command by command", () => {
    expect(
      _readRunSteps(
        [
          "      - if: false",
          "        run: |",
          "          bun run g:tier pr",
          "          bun run g:prove pr",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  it("reads nothing out of a job a condition guards, however many steps it holds", () => {
    expect(
      _readRunSteps(
        [
          "jobs:",
          "  pr:",
          "    if: false",
          "    steps:",
          "      - run: bun run g:tier pr",
          "      - run: bun run g:prove pr",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  it("keeps the steps of the job beside a guarded one, which is a condition on its neighbour", () => {
    expect(
      _readRunSteps(
        [
          "jobs:",
          "  guarded:",
          "    if: false",
          "    steps:",
          "      - run: bun run g:tier pr",
          "  live:",
          "    steps:",
          "      - run: bun run g:prove pr",
        ].join("\n"),
      ),
    ).toEqual(["bun run g:prove pr"]);
  });

  it("reads a folded block the way it reads a literal one, since both are what the step runs", () => {
    expect(
      _readRunSteps(
        ["        run: >-", "          bun run g:tier pr"].join("\n"),
      ),
    ).toEqual(["bun run g:tier pr"]);
  });
});
