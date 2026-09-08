import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { REPORT_FILE } from "../runner/index.js";
import { readReport, type Summary } from "../verdict/index.js";

/**
 * The report the runner left in the entry's work directory, read into a
 * summary beside the time it was written, or `null` when there is none. A
 * report that is there and cannot be read is not a missing one: the
 * reader's refusal propagates, so an unreadable report is reported as
 * unreadable and never as a run that reported nothing.
 *
 * @note Impure — reads the filesystem under `workDir`.
 */
export default function _readWrittenReport(
  workDir: string,
): { readonly summary: Summary; readonly writtenAt: number } | null {
  const path = join(workDir, REPORT_FILE);
  if (!existsSync(path)) return null;
  return {
    summary: readReport(readFileSync(path, "utf8")),
    writtenAt: statSync(path).mtimeMs,
  };
}
