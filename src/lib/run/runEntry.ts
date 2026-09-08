import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, posix } from "node:path";
import { performance } from "node:perf_hooks";
import { Refusal } from "../contract/index.js";
import { spawnProcess } from "../process/index.js";
import { type Row, UNMEASURED_S } from "../register/index.js";
import {
  REPORT_FILE,
  REPORTS_DIR,
  renderEntryCommand,
  WORK_DIR,
} from "../runner/index.js";
import { judgeRun } from "../verdict/index.js";
import _callEngine from "./_callEngine.js";
import _readWrittenReport from "./_readWrittenReport.js";
import _renderRun from "./_renderRun.js";
import _writeMarker from "./_writeMarker.js";
import { ENGINE_FAULT_CODE, KILL_MULTIPLIER, TASK_FACE } from "./constants.js";
import describeRun from "./describeRun.js";
import hashCheckout from "./hashCheckout.js";
import tearDown from "./tearDown.js";
import type { Ran, RunContext, RunPhase } from "./types.js";

/**
 * Runs one entry through its whole lifecycle and answers the verdict with
 * the seconds of the measured phase alone, which is what a budget is set
 * from.
 *
 * The previous run's lifted report is forgotten first, so a run that stops
 * before lifting never leaves an older report standing under this run's
 * name. The work directory is cleared before the build phase and not only
 * after the run, because an interrupted earlier run is not a path the
 * teardown controls, and what it leaves is a stale product standing in for
 * a fixture and a stale report standing in for a verdict; it is created now
 * because it is a mount point.
 *
 * Each build recipe runs in its own container, with the network on and
 * outside the measured window: a budget that included its fixture build
 * would measure the cache. A recipe that fails or hangs is a refusal, not a
 * red verdict — no assertion executed, so there is nothing to judge — and
 * so is a build phase that left nothing behind, because nothing regenerates
 * on the read path. The marker is then written, and the measured run starts
 * with the network off unless the row says otherwise, under the hard kill at
 * the kill multiplier times the budget. A kill is a red verdict naming the
 * multiplier and the budget: a breach is what the kill measures, and no
 * report is read from a container removed mid-run. Otherwise the verdict is
 * judged from the report and the marker, never from an exit code, and the
 * reader's refusals propagate.
 *
 * The engine's own failure is named as the engine's. An image it does not
 * hold or a mount it refused ends a call at the engine's own exit code with
 * nothing started and nothing written, which read as a run is a runner that
 * left no report — a sentence that sends the reader into the entry. That
 * code beside no report is a refusal naming the engine; it still decides
 * no verdict, since a contained command may exit with the same number.
 *
 * Teardown runs on every path out, told whether a verdict was judged from
 * the report so it lifts the report only then, and its faults are never
 * lost behind what they followed: they turn a verdict red, and they are
 * carried in the refusal thrown after a run that already failed, because a
 * green run whose container survives holds the repository mounted for the
 * next entry.
 *
 * @note Impure — spawns the engine, writes and removes the work directory,
 * reads the clock around the measured phase.
 * @throws Refusal when a build recipe fails, hangs or leaves nothing; when
 * the engine declined to start a container; when the report cannot be
 * judged; and, carrying the original message, when teardown faulted after
 * any of those.
 */
export default async function runEntry(
  row: Row,
  context: RunContext,
): Promise<Ran> {
  const spawn = context.spawn ?? spawnProcess;
  const checkout = hashCheckout(context.repositoryRoot);
  const workDir = join(context.corpusRoot, WORK_DIR, row.id);
  rmSync(join(context.corpusRoot, WORK_DIR, REPORTS_DIR, `${row.id}.json`), {
    force: true,
  });
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });

  const describe = (
    phase: RunPhase,
    command: readonly string[],
    index?: number,
  ) =>
    describeRun(row, {
      repositoryRoot: context.repositoryRoot,
      corpusRoot: context.corpusRoot,
      checkout,
      nonce: context.nonce,
      image: context.image,
      phase,
      index,
      command,
    });

  let judged = false;
  const attempt = async (): Promise<Ran> => {
    for (const [index, recipe] of row.build.entries()) {
      const spec = describe("build", [...TASK_FACE, recipe], index);
      const built = await _callEngine(context.engine, spawn, _renderRun(spec), {
        deadlineS: spec.deadlineS,
        container: spec.name,
      });
      if (built.killed) {
        throw new Refusal(
          `build recipe \`${recipe}\` for ${row.id} did not return within ${UNMEASURED_S}s — the measured phase never started, so there is nothing to judge`,
        );
      }
      if (built.code === ENGINE_FAULT_CODE) {
        throw new Refusal(
          `the engine exited ${ENGINE_FAULT_CODE} on build recipe \`${recipe}\` for ${row.id} — that code is the engine's own, for an image it does not hold or a mount it refused, unless the recipe chose the same number, and the output above names which; the measured phase never started`,
        );
      }
      if (built.code !== 0) {
        throw new Refusal(
          `build recipe \`${recipe}\` for ${row.id} failed — the measured phase never started, so no assertion executed and there is nothing to judge`,
        );
      }
    }
    if (row.build.length > 0 && readdirSync(workDir).length === 0) {
      throw new Refusal(
        `\`${row.build.join(", ")}\` left nothing under ${WORK_DIR}/${row.id} — a build recipe writes its products there, it is the only place one can write, and nothing regenerates on the read path`,
      );
    }

    const startedAt = _writeMarker(workDir, row.id, process.pid);
    // The report path is relative to the corpus directory, which is the
    // measured run's working directory inside the container.
    const spec = describe(
      "measured",
      renderEntryCommand(row, posix.join(WORK_DIR, row.id, REPORT_FILE)),
    );
    const opened = performance.now();
    const ran = await _callEngine(context.engine, spawn, _renderRun(spec), {
      deadlineS: spec.deadlineS,
      container: spec.name,
    });
    const seconds = (performance.now() - opened) / 1000;
    if (ran.killed) {
      return {
        ok: false,
        reason: `${row.id} was killed at ${seconds.toFixed(1)}s — ${KILL_MULTIPLIER} times its budget of ${row.run.budget}s`,
        seconds,
      };
    }
    const report = _readWrittenReport(workDir);
    if (report === null && ran.code === ENGINE_FAULT_CODE) {
      throw new Refusal(
        `the engine exited ${ENGINE_FAULT_CODE} and ${row.id} left no report — that code is the engine's own, for an image it does not hold or a mount it refused, and its output above names which; a runner the engine never started measured nothing`,
      );
    }
    const verdict = judgeRun(row, report, startedAt);
    judged = true;
    return { ...verdict, seconds };
  };

  const settled = await attempt().then(
    (ran) => ({ ran }),
    (error: unknown) => ({ error }),
  );
  const faults = await tearDown(row, context, judged);
  if ("error" in settled) {
    if (faults.length === 0) throw settled.error;
    const message =
      settled.error instanceof Error
        ? settled.error.message
        : String(settled.error);
    throw new Refusal(
      `${message}; and the teardown of ${row.id} faulted: ${faults.join("; ")}`,
    );
  }
  if (faults.length === 0) return settled.ran;
  return {
    ok: false,
    reason: `${settled.ran.reason}; and the teardown of ${row.id} faulted: ${faults.join("; ")}`,
    seconds: settled.ran.seconds,
  };
}
