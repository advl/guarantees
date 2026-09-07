/**
 * @module
 *
 * What a run proved: the runner's report read into a summary or refused,
 * the summary judged against the row's expectation and the run's freshness,
 * and the verdict or the refusal mapped to an exit code. Pure: the caller
 * reads the report and dates it.
 */
export { default as judgeRun } from "./judgeRun.js";
export { default as readReport } from "./readReport.js";
export { default as toExitCode, type ExitCode } from "./toExitCode.js";
export type { Summary, Verdict } from "./types.js";
