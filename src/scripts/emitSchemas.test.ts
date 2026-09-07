import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  labelSchema,
  markerSchema,
  probeSchema,
  registerSchema,
  reportSchema,
} from "../lib/contract/index.js";

const NAMES = ["register", "report", "probe", "marker", "label"] as const;

const expected = {
  register: registerSchema,
  report: reportSchema,
  marker: markerSchema,
  probe: probeSchema,
  label: labelSchema,
};

/** Runs the emitter afresh with the given arguments, from `cwd`. */
const emit = async (cwd: string, args: readonly string[]) => {
  const argv = process.argv;
  const previous = process.cwd();
  process.chdir(cwd);
  process.argv = [...argv.slice(0, 2), ...args];
  try {
    vi.resetModules();
    await import("./emitSchemas.js");
  } finally {
    process.argv = argv;
    process.chdir(previous);
  }
};

const filesUnder = (directory: string) =>
  Object.fromEntries(
    NAMES.map((name) => [
      name,
      readFileSync(resolve(directory, `${name}.schema.json`), "utf8"),
    ]),
  );

describe("emitSchemas", () => {
  const scratch: string[] = [];
  const fresh = () => {
    const directory = mkdtempSync(resolve(tmpdir(), "emit-schemas-"));
    scratch.push(directory);
    return directory;
  };
  afterEach(() => {
    for (const directory of scratch.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("writes one pretty-printed file per schema into the directory it is given", async () => {
    const target = resolve(fresh(), "out");
    await emit(fresh(), [target]);
    const files = filesUnder(target);
    for (const name of NAMES) {
      expect(files[name]).toBe(`${JSON.stringify(expected[name], null, 2)}\n`);
    }
  });

  it("writes into contract/ under the working directory when given no target", async () => {
    const cwd = fresh();
    await emit(cwd, []);
    const files = filesUnder(resolve(cwd, "contract"));
    for (const name of NAMES) {
      expect(JSON.parse(files[name])).toEqual(expected[name]);
    }
  });
});
