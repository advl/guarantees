import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
} from "node:fs";
import { join } from "node:path";
import { spawnProcess } from "../process/index.js";
import { type Row, UNMEASURED_S } from "../register/index.js";
import {
  LIFT_DIR,
  REPORT_FILE,
  REPORTS_DIR,
  WORK_DIR,
} from "../runner/index.js";
import _listLabelled from "./_listLabelled.js";
import _removeContainer from "./_removeContainer.js";
import { CORPUS_LABEL, ENTRY_LABEL, TASK_FACE } from "./constants.js";
import hashCheckout from "./hashCheckout.js";
import type { RunContext } from "./types.js";

/**
 * Tears an entry down on every path out of its run — the green one, the red
 * one, a refusal and a kill alike — and answers the faults it met, empty
 * when everything worked. Faults are reported and never thrown, because the
 * rest of the teardown still has to happen whatever went wrong in one step.
 *
 * Every container of the entry is removed, found by the checkout and entry
 * labels whichever process started them, and the listing afterwards is
 * what verifies the removal, since `--rm` fires only when a container exits
 * on its own and the case worth catching is the one where it did not; an
 * engine that does not answer either listing is a fault, not an empty
 * machine. The row's teardown recipes run on the host task face, from the
 * repository root, under the unmeasured deadline: what `holds` names is
 * outside the entry's container by definition, and a fresh container shares
 * none of its namespaces. A recipe that fails or is killed is a fault
 * naming what the row may still hold, because the next entry inherits it.
 *
 * The judged report outlives the directory it was written in. The work
 * directory is removed on the failing path exactly as on the passing one,
 * and the report is the only account of what the runner did — the run that
 * needs it most is the red one whose log scrolled — so it is lifted first
 * to a sibling directory the teardown does not touch, dated as the runner
 * wrote it. Only when the caller says a verdict was judged from it: the
 * runner writes its report before its own teardown hooks finish, so a
 * container killed at its deadline can leave a passing report beside a red
 * verdict, and a report the reader refused is the account of no verdict;
 * lifted under the run's name, either would be read as one.
 *
 * What the entry generated for a golden leaves the same way and under the
 * same condition. An entry writes it under `lift/` inside its work
 * directory, which is the only writable path it has, and the removal below
 * takes that directory with everything else; the copy to a sibling of the
 * report is the one route out of the container, and it is taken only when a
 * verdict was judged, because files a killed or refused run left behind are
 * not an account of what the artifact is. The dates the runner gave them
 * are kept, so a caller can ask whether this run generated them. What a
 * lift holds is a flat set of files, one per unit a golden pins; a
 * directory there is named as a fault rather than flattened or copied in
 * silence, since either would leave a reader guessing which of the two
 * happened. A work directory that could not be removed is the last fault.
 *
 * @note Impure — spawns the engine and the task face, and removes the work
 * directory.
 *
 * @package
 */
export default async function tearDown(
  row: Row,
  context: RunContext,
  judged: boolean,
): Promise<readonly string[]> {
  const spawn = context.spawn ?? spawnProcess;
  const faults: string[] = [];
  const filter = {
    [CORPUS_LABEL]: hashCheckout(context.repositoryRoot),
    [ENTRY_LABEL]: row.id,
  };

  const running = await _listLabelled(context.engine, spawn, filter);
  for (const name of running.names) {
    await _removeContainer(context.engine, spawn, name);
  }
  const left = await _listLabelled(context.engine, spawn, filter);
  if (!left.answered) {
    faults.push(
      `the engine did not say whether ${row.id} left a container running — an engine that cannot be asked is not evidence that the machine is clear`,
    );
  } else if (left.names.length > 0) {
    faults.push(
      `${row.id} left ${left.names.join(", ")} running after teardown — still holding the repository mounted, so nothing measured after this is trustworthy until they are removed`,
    );
  }

  for (const recipe of row.teardown) {
    const [binary, ...face] = TASK_FACE;
    const ran = await spawn(binary, [...face, recipe], {
      cwd: context.repositoryRoot,
      deadlineMs: UNMEASURED_S * 1000,
    });
    if (ran.killed || ran.code !== 0) {
      const why = ran.killed
        ? `did not return within ${UNMEASURED_S}s`
        : `exited ${ran.code}`;
      faults.push(
        `teardown recipe \`${recipe}\` for ${row.id} ${why} — ${row.holds.join(", ")} may still be held`,
      );
    }
  }

  const workDir = join(context.corpusRoot, WORK_DIR, row.id);
  const report = join(workDir, REPORT_FILE);
  const reports = join(context.corpusRoot, WORK_DIR, REPORTS_DIR);
  if (judged && existsSync(report)) {
    mkdirSync(reports, { recursive: true });
    const lifted = join(reports, `${row.id}.json`);
    copyFileSync(report, lifted);
    const { atime, mtime } = statSync(report);
    utimesSync(lifted, atime, mtime);
  }

  const lift = join(workDir, LIFT_DIR);
  if (judged && existsSync(lift)) {
    const carried = join(reports, row.id);
    mkdirSync(carried, { recursive: true });
    for (const entry of readdirSync(lift, { withFileTypes: true })) {
      if (!entry.isFile()) {
        faults.push(
          `${WORK_DIR}/${row.id}/${LIFT_DIR} holds \`${entry.name}\`, which is not a file — what an entry lifts is a flat set of files, one per unit a golden pins, and a directory there is generated evidence this leaves behind rather than carries out`,
        );
        continue;
      }
      const from = join(lift, entry.name);
      const to = join(carried, entry.name);
      copyFileSync(from, to);
      const { atime, mtime } = statSync(from);
      utimesSync(to, atime, mtime);
    }
  }
  // A removal that could not complete throws, and the throw is the
  // verification: a directory that is still there is a stale product
  // standing in for a fixture on the next run.
  try {
    rmSync(workDir, { recursive: true, force: true });
  } catch (error) {
    faults.push(
      `${WORK_DIR}/${row.id} could not be removed (${String(error)}) — what it holds is a stale product standing in for a fixture on the next run`,
    );
  }
  return faults;
}
