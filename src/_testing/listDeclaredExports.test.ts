import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import listDeclaredExports from "./listDeclaredExports.js";

describe("listDeclaredExports", () => {
  const scratch: string[] = [];
  afterEach(() => {
    for (const directory of scratch.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("lists the named re-exports of a declaration file, types marked, sorted, and nothing else", () => {
    const directory = mkdtempSync(resolve(tmpdir(), "declared-exports-"));
    scratch.push(directory);
    const path = resolve(directory, "index.d.ts");
    writeFileSync(
      path,
      [
        `import type { Ignored } from "./ignored.js";`,
        `export * from "./star.js";`,
        `export { zeta, type Alpha, beta as gamma } from "./a.js";`,
        `export type { Delta } from "./b.js";`,
        "",
      ].join("\n"),
    );
    expect(listDeclaredExports(path)).toEqual([
      "gamma",
      "type Alpha",
      "type Delta",
      "zeta",
    ]);
  });
});
