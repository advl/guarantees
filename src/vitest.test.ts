// The same two-specifier rule as the package index: `./vitest.js` is the
// source module coverage measures, and `@aztlan/guarantees/vitest` is
// resolved through the built `exports` map, which fails if the map or the
// build is wrong. The declaration file is read too, because a type can leave
// the surface with neither namespace moving.
import { fileURLToPath } from "node:url";
import * as published from "@aztlan/guarantees/vitest";
import { describe, expect, it } from "vitest";

import listDeclaredExports from "./_testing/listDeclaredExports.js";
import * as source from "./vitest.js";

const declared = fileURLToPath(
  new URL("../dist/types/vitest.d.ts", import.meta.url),
);

describe("@aztlan/guarantees/vitest", () => {
  it("publishes the corpus configuration and nothing else", () => {
    expect(Object.keys(source).sort()).toEqual(["defineCorpusConfig"]);
  });

  it("declares exactly that value and no type of its own", () => {
    expect(listDeclaredExports(declared)).toEqual(["defineCorpusConfig"]);
  });

  it("resolves that entry point through the built exports map", () => {
    expect(Object.keys(published).sort()).toEqual(Object.keys(source).sort());
  });
});
