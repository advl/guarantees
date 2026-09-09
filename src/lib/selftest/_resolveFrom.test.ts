import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import _resolveFrom from "./_resolveFrom.js";

const trees: string[] = [];

/** A directory with an install above it, holding each named package at a version. */
const installed = (packages: Readonly<Record<string, unknown>>) => {
  const root = mkdtempSync(join(tmpdir(), "resolve-from-"));
  trees.push(root);
  const from = join(root, "corpus");
  mkdirSync(from, { recursive: true });
  for (const [name, manifest] of Object.entries(packages)) {
    const directory = join(root, "node_modules", ...name.split("/"));
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "package.json"), JSON.stringify(manifest));
  }
  return { root, from };
};

afterEach(() => {
  for (const root of trees.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("_resolveFrom", () => {
  it("answers the install above the directory that holds each name, and the version it carries", () => {
    const { root, from } = installed({
      "example-runner": { name: "example-runner", version: "4.1.10" },
    });
    expect(_resolveFrom(from, ["example-runner"])).toEqual({
      "example-runner": {
        path: join(root, "node_modules", "example-runner", "package.json"),
        version: "4.1.10",
      },
    });
  });

  it("answers for a scoped name, whose install is two directories deep", () => {
    const { root, from } = installed({
      "@example/checker": { name: "@example/checker", version: "5.9.3" },
    });
    expect(
      _resolveFrom(from, ["@example/checker"])["@example/checker"]?.path,
    ).toBe(join(root, "node_modules", "@example", "checker", "package.json"));
  });

  it("answers for a package that publishes no path into itself, which a resolver would report as absent", () => {
    // Its manifest says every subpath but the root is private, which is what
    // several pinned toolchains say, and asking the runtime's resolver for
    // `<name>/package.json` is refused on exactly those.
    const { from } = installed({
      "example-parser": {
        name: "example-parser",
        version: "1.7.1",
        exports: { ".": "./dist/index.js" },
      },
    });
    expect(
      _resolveFrom(from, ["example-parser"])["example-parser"]?.version,
    ).toBe("1.7.1");
  });

  it("answers nothing for a name no install above the directory holds, rather than throwing where the assertion should be", () => {
    const { from } = installed({});
    expect(_resolveFrom(from, ["example-absent"])).toEqual({
      "example-absent": null,
    });
  });

  it("answers an empty version for a manifest that carries none, which is a resolution and not a version", () => {
    const { from } = installed({ "example-bare": { name: "example-bare" } });
    expect(_resolveFrom(from, ["example-bare"])["example-bare"]?.version).toBe(
      "",
    );
  });
});
