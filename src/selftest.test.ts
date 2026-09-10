// Two specifiers for one module, on purpose, and neither proves the other.
// `./selftest.js` reads the source module, which is what coverage measures.
// `@aztlan/guarantees/selftest` is resolved by the self-reference rule
// through this package's own `exports` map, so it reaches
// `dist/esm/selftest.js` and fails if the map or the build's layout is
// wrong — which is how a corpus reaches these bodies. The declaration file
// is read too, because a module namespace holds values only and a type can
// leave the surface without either namespace moving.
import { fileURLToPath } from "node:url";
import * as published from "@aztlan/guarantees/selftest";
import { describe, expect, it } from "vitest";

import listDeclaredExports from "./_testing/listDeclaredExports.js";
import * as source from "./selftest.js";

const declared = fileURLToPath(
  new URL("../dist/types/selftest.d.ts", import.meta.url),
);

describe("@aztlan/guarantees/selftest", () => {
  // The five bodies, and the three facts a corpus needs before it can hand
  // them anything: the suffix the runner collects, the reader that turns a
  // workflow into the tiers it triggers and proves, and the images a tier's
  // rows name. They are here rather than on the root entry because they are a
  // corpus's business and not that of a program driving the scheduler.
  it("publishes the five bodies a corpus imports and the three facts it hands them", () => {
    expect(Object.keys(source).sort()).toEqual([
      "COLLECTS",
      "describeBijection",
      "describeCanFail",
      "describeImageTie",
      "describeLayering",
      "describeToolchainStamp",
      "listTierImages",
      "readPipeline",
    ]);
  });

  it("declares exactly those values and nothing beside them", () => {
    expect(listDeclaredExports(declared)).toEqual(Object.keys(source).sort());
  });

  it("resolves that entry point through the built exports map", () => {
    expect(Object.keys(published).sort()).toEqual(Object.keys(source).sort());
  });
});
