import { statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MARKER_FILE } from "./constants.js";

/**
 * Writes the freshness marker into the entry's work directory and answers
 * the time it was written, as the filesystem the report will be written to
 * dates it: written once, dated, and written again carrying that date. A
 * mark on the report's own filesystem rather than a host clock reading,
 * because two marks from one clock order correctly whatever its
 * granularity, and a host clock against a timestamp stored to whole seconds
 * does not — where it does not, every honest run is refused as one that
 * reported nothing.
 *
 * @note Impure — writes and reads the filesystem under `workDir`.
 */
export default function _writeMarker(
  workDir: string,
  id: string,
  pid: number,
): number {
  const path = join(workDir, MARKER_FILE);
  writeFileSync(path, JSON.stringify({ id, startedAt: 0, pid }));
  const startedAt = Math.floor(statSync(path).mtimeMs);
  writeFileSync(path, `${JSON.stringify({ id, startedAt, pid })}\n`);
  return startedAt;
}
