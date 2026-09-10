import { describe, expect, it } from "vitest";

import { CORPUS_DIR, REGISTER_FILE, WORKFLOW_FILE } from "./index.js";

describe("corpus constants", () => {
  it("name the corpus and its register as a repository carries them, relative to what holds them", () => {
    expect(CORPUS_DIR).toBe("guarantees");
    expect(REGISTER_FILE).toBe("corpus.toml");
  });

  it("name the workflow as a path under the repository root and never an absolute one", () => {
    expect(WORKFLOW_FILE.startsWith("/")).toBe(false);
    expect(WORKFLOW_FILE.endsWith(".yml")).toBe(true);
  });
});
