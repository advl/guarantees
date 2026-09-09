import { describe, expect, it } from "vitest";

import _findWrongVersions from "./_findWrongVersions.js";

const WORKSPACE = "/workspace";
const EXPECTED = { vitest: "4.1.10", typescript: "5.9.3" };

describe("_findWrongVersions", () => {
  it("finds nothing where every name resolves outside the repository at the version expected", () => {
    expect(
      _findWrongVersions(
        EXPECTED,
        {
          vitest: {
            path: "/node_modules/vitest/package.json",
            version: "4.1.10",
          },
          typescript: {
            path: "/node_modules/typescript/package.json",
            version: "5.9.3",
          },
        },
        WORKSPACE,
      ),
    ).toEqual([]);
  });

  it("names a package that resolves to nothing at all", () => {
    expect(
      _findWrongVersions({ vitest: "4.1.10" }, { vitest: null }, WORKSPACE),
    ).toEqual(["vitest resolves to nothing from the corpus"]);
  });

  it("names a package the checkout answered for, since that is the repository's install standing in for the image's", () => {
    expect(
      _findWrongVersions(
        { vitest: "4.1.10" },
        {
          vitest: {
            path: "/workspace/node_modules/vitest/package.json",
            version: "4.1.10",
          },
        },
        WORKSPACE,
      ),
    ).toEqual([
      "vitest resolves to /workspace/node_modules/vitest/package.json, inside the repository at /workspace — the checkout's own install answering for the image's",
    ]);
  });

  it("names a package at another version, which is a toolchain that moved underneath every budget", () => {
    expect(
      _findWrongVersions(
        { vitest: "4.1.10" },
        {
          vitest: {
            path: "/node_modules/vitest/package.json",
            version: "4.2.0",
          },
        },
        WORKSPACE,
      ),
    ).toEqual(["vitest resolves at 4.2.0, expected 4.1.10"]);
  });

  it("names a package nothing answered for at all, rather than passing it over", () => {
    expect(_findWrongVersions({ vitest: "4.1.10" }, {}, WORKSPACE)).toEqual([
      "vitest resolves to nothing from the corpus",
    ]);
  });

  it("does not read a sibling of the workspace as the workspace, since a directory's name is a prefix of its neighbours'", () => {
    expect(
      _findWrongVersions(
        { vitest: "4.1.10" },
        {
          vitest: {
            path: "/workspace-tools/node_modules/vitest/package.json",
            version: "4.1.10",
          },
        },
        WORKSPACE,
      ),
    ).toEqual([]);
  });

  it("finds nothing where nothing is expected, which is why a body asserts the list is not empty", () => {
    expect(_findWrongVersions({}, {}, WORKSPACE)).toEqual([]);
  });
});
