import { describe, expect, it } from "vitest";

import { COLLECTS, defineCorpusConfig, WORK_DIR } from "./index.js";

describe("defineCorpusConfig", () => {
  it("includes only the files carrying the collected suffix", () => {
    expect(defineCorpusConfig().test?.include).toEqual([`**/*${COLLECTS}`]);
  });

  it("excludes node_modules, .work and fixtures at any depth", () => {
    expect(defineCorpusConfig().test?.exclude).toEqual([
      "**/node_modules/**",
      `**/${WORK_DIR}/**`,
      "**/fixtures/**",
    ]);
  });

  it("runs files one at a time", () => {
    expect(defineCorpusConfig().test?.fileParallelism).toBe(false);
  });

  it("reports no coverage", () => {
    expect(defineCorpusConfig().test?.coverage).toEqual({ enabled: false });
  });

  it("lets an override win on the key it names and keeps the base beside it", () => {
    const config = defineCorpusConfig({
      test: { include: ["only/*.test.ts"], testTimeout: 30_000 },
      cacheDir: ".cache",
    });
    expect(config.test?.include).toEqual(["only/*.test.ts"]);
    expect(config.test?.testTimeout).toBe(30_000);
    expect(config.test?.fileParallelism).toBe(false);
    expect(config.cacheDir).toBe(".cache");
  });

  it("returns a fresh object on every call", () => {
    const first = defineCorpusConfig();
    const second = defineCorpusConfig();
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.test).not.toBe(second.test);
  });
});
