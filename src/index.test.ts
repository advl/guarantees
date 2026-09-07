// Two specifiers for one module, on purpose, and neither proves the other.
// `./index.js` reads the source module, which is what coverage measures.
// `@aztlan/guarantees` is resolved by the self-reference rule through this
// package's own `exports` map, so it reaches `dist/esm/index.js` and fails if
// the map, `outDir`, `rootDir` or `declarationDir` is wrong. Without the
// second one the whole emit path ships untested, because nothing else in the
// repository reads what the build produced. The declaration file is read too,
// because a module namespace holds values only and a type can leave the
// surface without either namespace moving.
import { fileURLToPath } from "node:url";
import * as published from "@aztlan/guarantees";
import { describe, expect, it } from "vitest";

import listDeclaredExports from "./_testing/listDeclaredExports.js";
import * as source from "./index.js";

const declared = fileURLToPath(
  new URL("../dist/types/index.d.ts", import.meta.url),
);

describe("@aztlan/guarantees", () => {
  it("publishes exactly the values of the pure domains", () => {
    expect(Object.keys(source).sort()).toEqual([
      "CONTRACT_VERSION",
      "EXIT_CODES",
      "Refusal",
      "computeBudget",
      "computeP95",
      "labelSchema",
      "markerSchema",
      "probeSchema",
      "readProbe",
      "registerSchema",
      "reportSchema",
      "rewriteRunBudget",
    ]);
  });

  it("declares exactly those values and the types of their signatures", () => {
    expect(listDeclaredExports(declared)).toEqual(
      [
        ...Object.keys(source),
        "type Measurement",
        "type Phase",
        "type Probe",
        "type Reading",
        "type Stamp",
      ].sort(),
    );
  });

  it("resolves that entry point through the built exports map", () => {
    expect(Object.keys(published).sort()).toEqual(Object.keys(source).sort());
  });
});
