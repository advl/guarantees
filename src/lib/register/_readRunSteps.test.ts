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

  // A job's condition is when the job runs, not whether its steps do, and a
  // tier that runs at merge and not on every pull request is exactly that: a
  // job the pipeline guards by event. Read as a disqualification it made a
  // merge tier undeclarable beside a pr tier in one file.
  it("reads the steps of a job a condition schedules, because that is when it runs", () => {
    expect(
      _readRunSteps(
        [
          "jobs:",
          "  merge:",
          "    if: github.event_name == 'push'",
          "    steps:",
          "      - run: bun run g:tier merge",
          "      - run: bun run g:prove merge",
        ].join("\n"),
      ),
    ).toEqual(["bun run g:tier merge", "bun run g:prove merge"]);
  });

  it("still reads nothing out of a step a condition guards inside a scheduled job", () => {
    expect(
      _readRunSteps(
        [
          "jobs:",
          "  merge:",
          "    if: github.event_name == 'push'",
          "    steps:",
          "      - run: bun run g:tier merge",
          "      - if: false",
          "        run: bun run g:prove merge",
        ].join("\n"),
      ),
    ).toEqual(["bun run g:tier merge"]);
  });

  it("reads a condition above the steps key as the job's, wherever the job writes it", () => {
    expect(
      _readRunSteps(
        [
          "jobs:",
          "  merge:",
          "    runs-on: ubuntu-latest",
          "    steps:",
          "      - run: bun run g:tier merge",
          "  other:",
          "    if: false",
          "    steps:",
          "      - run: bun run g:prove merge",
        ].join("\n"),
      ),
    ).toEqual(["bun run g:tier merge", "bun run g:prove merge"]);
  });

  it("reads a folded block the way it reads a literal one, since both are what the step runs", () => {
    expect(
      _readRunSteps(
        ["        run: >-", "          bun run g:tier pr"].join("\n"),
      ),
    ).toEqual(["bun run g:tier pr"]);
  });
});
