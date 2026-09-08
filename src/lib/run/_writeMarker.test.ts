import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { markerSchema } from "../contract/index.js";
import _writeMarker from "./_writeMarker.js";
import { MARKER_FILE } from "./index.js";

const scratch: string[] = [];
const fresh = () => {
  const directory = mkdtempSync(join(tmpdir(), "marker-"));
  scratch.push(directory);
  return directory;
};

afterEach(() => {
  for (const directory of scratch.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("_writeMarker", () => {
  it("writes a marker holding exactly the schema's keys, with the time it answers", () => {
    const workDir = fresh();
    const startedAt = _writeMarker(workDir, "corpus-bijection", 4242);
    const marker = JSON.parse(readFileSync(join(workDir, MARKER_FILE), "utf8"));
    expect(Object.keys(marker).sort()).toEqual(
      [...markerSchema.required].sort(),
    );
    expect(marker).toEqual({ id: "corpus-bijection", startedAt, pid: 4242 });
    expect(Number.isInteger(startedAt)).toBe(true);
  });

  it("answers a time the marker's own file is not dated before", () => {
    const workDir = fresh();
    const startedAt = _writeMarker(workDir, "corpus-bijection", 4242);
    expect(statSync(join(workDir, MARKER_FILE)).mtimeMs).toBeGreaterThanOrEqual(
      startedAt,
    );
  });

  it("dates before a report written after it", () => {
    const workDir = fresh();
    const startedAt = _writeMarker(workDir, "corpus-bijection", 4242);
    writeFileSync(join(workDir, "report.json"), "{}");
    expect(
      statSync(join(workDir, "report.json")).mtimeMs,
    ).toBeGreaterThanOrEqual(startedAt);
  });
});
