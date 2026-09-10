import { describe, expect, it } from "vitest";

import catchRefusal from "../../_testing/catchRefusal.js";
import { COLLECTS } from "../runner/index.js";
import { RegisterRefusal, readPipeline, TIERS } from "./index.js";

/** A workflow as one is written: steps naming the task face the corpus is run through. */
const workflow = (steps: readonly string[]) =>
  [
    "name: Guarantees",
    "on:",
    "  pull_request:",
    "jobs:",
    "  pr:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    ...steps.map((step) => `      - run: ${step}`),
    "",
  ].join("\n");

describe("readPipeline", () => {
  it("reads the tier a step runs and not the one a comment beside it writes out", () => {
    // A workflow's own comments are the likeliest place a tier is named
    // beside a backtick or a comma, and a token carrying the punctuation is
    // a name no tier has: read as a step, the whole tool would decline every
    // command over a file that reads perfectly.
    const text = [
      "# `g:tier prr` would run the rows, then `g:prove prr` prove them.",
      "# What follows g:tier prr, and only then, is the proof.",
      "      - run: bun run g:tier pr",
      "      - run: bun run g:prove pr",
    ].join("\n");
    expect(readPipeline(text, ".test.ts")).toEqual({
      triggeredTiers: ["pr"],
      provenTiers: ["pr"],
      collects: ".test.ts",
    });
  });

  it("refuses a workflow whose every guarantee step is commented out, which is how a step is switched off", () => {
    // The one gesture that used to pass: deleting the file is refused where
    // the corpus is located, and emptying the steps is refused below. A tier
    // that reads as triggered and proven while no job runs it is a set of
    // rows that look scheduled and are not.
    const refusal = catchRefusal(RegisterRefusal, () =>
      readPipeline(
        [
          "    steps:",
          "      # - run: bun run g:tier pr",
          "      # - run: bun run g:prove pr",
          "      - run: echo nothing",
        ].join("\n"),
        COLLECTS,
      ),
    );
    expect(refusal.faults).toEqual([
      expect.objectContaining({
        table: "",
        reason: expect.stringContaining("names no tier in any step it runs"),
      }),
    ]);
  });

  it("refuses a workflow whose guarantee steps a condition guards, which switches a step off in one word", () => {
    // The neighbour of the gesture above, and the same answer: a step
    // written out in full and never run is a tier nothing schedules,
    // whether a `#` or an `if:` is what stops it.
    const refusal = catchRefusal(RegisterRefusal, () =>
      readPipeline(
        [
          "    steps:",
          "      - name: Run the pr tier",
          "        if: false",
          "        run: bun run g:tier pr",
          "      - name: Prove the pr tier",
          `        if: ${"$"}{{ false }}`,
          "        run: bun run g:prove pr",
          "      - run: echo nothing",
        ].join("\n"),
        COLLECTS,
      ),
    );
    expect(refusal.faults).toEqual([
      expect.objectContaining({
        table: "",
        reason: expect.stringContaining("names no tier in any step it runs"),
      }),
    ]);
  });

  it("reads a tier a step runs inside a block, which is how a step running two commands is written", () => {
    expect(
      readPipeline(
        [
          "      - name: Run the pr tier and prove it",
          "        run: |",
          "          bun run g:tier pr",
          "          bun run g:prove pr",
        ].join("\n"),
        COLLECTS,
      ),
    ).toEqual({
      triggeredTiers: ["pr"],
      provenTiers: ["pr"],
      collects: COLLECTS,
    });
  });

  it("reads what a workflow triggers and what it proves, once each, whatever the file's shape", () => {
    expect(
      readPipeline(
        workflow(["bun install", "bun run g:tier pr", "bun run g:prove pr"]),
        COLLECTS,
      ),
    ).toEqual({
      triggeredTiers: ["pr"],
      provenTiers: ["pr"],
      collects: COLLECTS,
    });
  });

  it("names each tier once however many jobs run it", () => {
    expect(
      readPipeline(
        workflow([
          "bun run g:tier pr",
          "bun run g:tier merge",
          "bun run g:tier pr",
          "bun run g:prove merge",
        ]),
        COLLECTS,
      ).triggeredTiers,
    ).toEqual(["pr", "merge"]);
  });

  it("reads a workflow that triggers a tier and proves none, which the register is then refused against", () => {
    expect(readPipeline(workflow(["bun run g:tier pr"]), COLLECTS)).toEqual({
      triggeredTiers: ["pr"],
      provenTiers: [],
      collects: COLLECTS,
    });
  });

  it("carries the suffix the runner collects through untouched, since the register holds a row's file to it", () => {
    expect(
      readPipeline(workflow(["bun run g:tier pr"]), ".spec.ts").collects,
    ).toBe(".spec.ts");
  });

  it("refuses a name that is not a tier rather than dropping it, which would leave the tier it was meant to be looking unscheduled", () => {
    const refusal = catchRefusal(RegisterRefusal, () =>
      readPipeline(
        workflow(["bun run g:tier prr", "bun run g:prove pr"]),
        COLLECTS,
      ),
    );
    expect(refusal.faults).toEqual([
      expect.objectContaining({
        table: "prr",
        reason: expect.stringContaining(
          "is triggered by the workflow and is not a tier",
        ),
      }),
    ]);
  });

  it("refuses an unrecognised tier in the proof step too, and names every one it found", () => {
    const refusal = catchRefusal(RegisterRefusal, () =>
      readPipeline(
        workflow(["bun run g:tier nightlies", "bun run g:prove nightlies"]),
        COLLECTS,
      ),
    );
    expect(refusal.faults.map((fault) => fault.reason)).toEqual([
      expect.stringContaining("is triggered by the workflow"),
      expect.stringContaining("is proven by the workflow"),
    ]);
  });

  it("refuses a workflow that names no tier at all, which reads like a pipeline and schedules nothing", () => {
    const refusal = catchRefusal(RegisterRefusal, () =>
      readPipeline(workflow(["bun install", "bun run ci"]), COLLECTS),
    );
    expect(refusal.faults).toEqual([
      expect.objectContaining({
        table: "",
        reason: expect.stringContaining("names no tier"),
      }),
    ]);
  });

  it("reads every tier the contract carries, so a workflow naming one is never refused for the register's sake", () => {
    expect(
      readPipeline(
        workflow(TIERS.map((tier) => `bun run g:tier ${tier}`)),
        COLLECTS,
      ).triggeredTiers,
    ).toEqual([...TIERS]);
  });
});
