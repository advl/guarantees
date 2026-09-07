import { Refusal } from "../contract/index.js";
import type { Row } from "../register/index.js";
import type { Summary, Verdict } from "./types.js";

/**
 * Judges one run from the report it wrote, and never from an exit code. An
 * exit code cannot tell a designed assertion failure from a missing binary,
 * a file that would not load, or a selector that matched nothing and
 * quietly ran zero tests — and each of those is a way to report a fact
 * nobody checked. So: no report is not a verdict; a report older than the
 * run is a verdict about an earlier run; a report in which nothing executed
 * is a coincidence; and only then does the count meet the row's
 * expectation. The first three are refusals, not red verdicts, because the
 * contract's `refused` is the scheduler declining to judge and that is what
 * each of them is; a red verdict says the row's expectation was not met,
 * which none of them can say, and for the row designed to fail a refusal
 * must never pass as the red the proof is waiting for.
 *
 * `report` is the summary read from the run's report together with the
 * time the report was written, or `null` when the run left none; a summary
 * without a date, or a date without a summary, is not a state a run can be
 * in, so one value carries both and no refusal exists for the half-state.
 * `startedAt` is a mark the run made before it started. Both times are as
 * the filesystem the report lives on dates them: two marks from one clock
 * order correctly whatever that clock's granularity is, and a host clock
 * against a timestamp stored to whole seconds does not — where it does not,
 * every honest run is refused as one that reported nothing.
 *
 * @throws Refusal when there is no report, when the report is older than
 * the run, or when nothing in it executed.
 */
export default function judgeRun(
  row: Row,
  report: { readonly summary: Summary; readonly writtenAt: number } | null,
  startedAt: number,
): Verdict {
  if (report === null) {
    throw new Refusal(
      `${row.id} left no report of its own — the runner did not get far enough to say what it did, and neither an exit code nor an older run's report is a verdict about this one`,
    );
  }
  if (report.writtenAt < startedAt) {
    throw new Refusal(
      `${row.id} left a report older than this run — a report from an earlier run is not a verdict about this one`,
    );
  }
  const { summary } = report;
  if (summary.passed + summary.failed === 0) {
    throw new Refusal(
      `${row.id} executed no test — \`select = "${row.select}"\` matched nothing that ran in ${row.file} (${summary.total} collected, none executed), and an entry that asserted nothing is the most expensive thing a corpus can report as green`,
    );
  }

  const counted = `${summary.passed} passed, ${summary.failed} failed, expected to ${row.expect}`;
  if (row.expect === "fail") {
    return summary.failed > 0
      ? { ok: true, reason: `${row.id}: ${counted}` }
      : {
          ok: false,
          reason: `${row.id} is the entry designed to fail and no assertion in it failed — the corpus can no longer show that it is able to report a failure`,
        };
  }
  return summary.failed === 0
    ? { ok: true, reason: `${row.id}: ${counted}` }
    : {
        ok: false,
        reason: `${row.id}: ${counted} — ${summary.failedTitles.join("; ")}`,
      };
}
