// The same two-specifier rule as the package index: `./contract.js` is the
// source module coverage measures, and `@aztlan/guarantees/contract` is
// resolved through the built `exports` map, which fails if the map or the
// build is wrong. The schema files are resolved the same way, through the
// map's glob, and compared to the objects they were emitted from — the one
// proof that what a consumer in another language reads is what this one
// declares.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import * as published from "@aztlan/guarantees/contract";
import { describe, expect, it } from "vitest";

import listDeclaredExports from "./_testing/listDeclaredExports.js";
import * as source from "./contract.js";

const require = createRequire(import.meta.url);

const declared = fileURLToPath(
  new URL("../dist/types/contract.d.ts", import.meta.url),
);

describe("@aztlan/guarantees/contract", () => {
  it("publishes the version, the exit codes and the five schemas", () => {
    expect(Object.keys(source).sort()).toEqual([
      "CONTRACT_VERSION",
      "EXIT_CODES",
      "labelSchema",
      "markerSchema",
      "probeSchema",
      "registerSchema",
      "reportSchema",
    ]);
  });

  it("declares exactly those values and no type", () => {
    expect(listDeclaredExports(declared)).toEqual(Object.keys(source).sort());
  });

  it("resolves that entry point through the built exports map", () => {
    expect(Object.keys(published).sort()).toEqual(Object.keys(source).sort());
  });

  it.each([
    ["register", source.registerSchema],
    ["report", source.reportSchema],
    ["probe", source.probeSchema],
    ["marker", source.markerSchema],
    ["label", source.labelSchema],
  ])("ships %s.schema.json equal to its source object", (name, schema) => {
    const path = require.resolve(
      `@aztlan/guarantees/contract/${name}.schema.json`,
    );
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual(schema);
  });
});
