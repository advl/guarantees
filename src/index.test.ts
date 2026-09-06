// Two specifiers for one module, on purpose, and neither proves the other.
// `./index.js` reads the source module, which is what coverage measures.
// `@aztlan/guarantees` is resolved by the self-reference rule through this
// package's own `exports` map, so it reaches `dist/esm/index.js` and fails if
// the map, `outDir`, `rootDir` or `declarationDir` is wrong. Without the
// second one the whole emit path ships untested, because nothing else in the
// repository reads what the build produced.
import * as published from "@aztlan/guarantees";
import { describe, expect, it } from "vitest";

import * as source from "./index.js";

describe("@aztlan/guarantees", () => {
  it("publishes no value from its root entry point", () => {
    expect(Object.keys(source)).toEqual([]);
  });

  it("resolves that entry point through the built exports map", () => {
    expect(Object.keys(published)).toEqual(Object.keys(source));
  });
});
