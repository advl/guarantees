import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import captureRegistration from "../../_testing/captureRegistration.js";
import { INSTALL_DIR, WORKSPACE } from "../runner/index.js";
import { _MASK_TITLE, _VERSIONS_TITLE } from "./constants.js";
import { describeToolchainStamp } from "./index.js";

const IMAGE = `ghcr.io/example/guarantees-ts@sha256:${"0123456789abcdef".repeat(4)}`;
const EXPECTED = { "example-runner": "4.1.10", "example-checker": "5.9.3" };

/**
 * The layout an entry meets inside its image, standing on the host: a
 * workspace whose own install is covered and therefore empty, a corpus
 * inside it, and the toolchain installed above the workspace where no mount
 * of the checkout reaches — which is where an image keeps its own.
 */
const trees: string[] = [];
const root = mkdtempSync(join(tmpdir(), "describe-toolchain-"));
trees.push(root);
const workspace = join(root, "workspace");
const corpusRoot = join(workspace, "guarantees");
mkdirSync(corpusRoot, { recursive: true });
mkdirSync(join(workspace, "node_modules"));
writeFileSync(join(corpusRoot, "package.json"), '{ "type": "module" }\n');
for (const [name, version] of Object.entries(EXPECTED)) {
  const directory = join(root, "node_modules", name);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, "package.json"),
    JSON.stringify({ name, version }),
  );
}

// Called as a corpus calls it, against a layout where the mask holds and
// the toolchain answers from outside the workspace, so both assertions run
// rather than merely being registered. What each finds when the mask leaks
// or a version moves is asserted over the finder.
describeToolchainStamp({
  id: "corpus-toolchain",
  image: IMAGE,
  corpusRoot,
  workspaceInstall: join(workspace, "node_modules"),
  expected: EXPECTED,
});

afterAll(() => {
  for (const tree of trees) rmSync(tree, { recursive: true, force: true });
});

/**
 * The wiring from each assertion to what it reads, watched failing. Above,
 * the mask is empty and every version matches, so either assertion could
 * have been handed the other's input with nothing going red; here one is
 * broken at a time and exactly the assertion it belongs to is required to
 * fail.
 */
describe("describeToolchainStamp", () => {
  const wired = (at: string) =>
    captureRegistration(
      () => import("./describeToolchainStamp.js"),
      (body) => {
        body({
          id: "corpus-toolchain",
          image: IMAGE,
          corpusRoot: join(at, "workspace", "guarantees"),
          workspaceInstall: join(at, "workspace", "node_modules"),
          expected: EXPECTED,
        });
      },
    );

  /** A layout of its own, so a leaking mask never reaches the fixture above. */
  const layoutWith = (broken: "mask" | "version") => {
    const at = mkdtempSync(join(tmpdir(), "describe-toolchain-broken-"));
    trees.push(at);
    const installed = join(at, "workspace", "node_modules");
    mkdirSync(join(at, "workspace", "guarantees"), { recursive: true });
    mkdirSync(installed, { recursive: true });
    writeFileSync(
      join(at, "workspace", "guarantees", "package.json"),
      '{ "type": "module" }\n',
    );
    for (const [name, version] of Object.entries(EXPECTED)) {
      const directory = join(at, "node_modules", name);
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        join(directory, "package.json"),
        JSON.stringify({
          name,
          version: broken === "version" ? "0.0.1" : version,
        }),
      );
    }
    if (broken === "mask") {
      mkdirSync(join(installed, "example-runner"), { recursive: true });
    }
    return at;
  };

  it("reports the run's own install answering through a mask that did not hold, and not the versions", async () => {
    const { tests } = await wired(layoutWith("mask"));
    expect(tests.get(_MASK_TITLE)).toThrow("what the run covers");
    expect(tests.get(_VERSIONS_TITLE)).not.toThrow();
  });

  it("reports a package resolving at a version the image does not install, and not the mask", async () => {
    const { tests } = await wired(layoutWith("version"));
    expect(tests.get(_VERSIONS_TITLE)).toThrow("what the corpus resolves");
    expect(tests.get(_MASK_TITLE)).not.toThrow();
  });

  it("reads the covered install where the run puts it when the caller names none", async () => {
    // A corpus passes nothing and the body looks where a run mounts the
    // checkout, which on this host is a path that is not there — the point
    // being that it is the run's path and not one the corpus retyped.
    const { tests } = await captureRegistration(
      () => import("./describeToolchainStamp.js"),
      (body) => {
        body({
          id: "corpus-toolchain",
          image: IMAGE,
          corpusRoot,
          expected: EXPECTED,
        });
      },
    );
    expect(tests.get(_MASK_TITLE)).toThrow(join(WORKSPACE, INSTALL_DIR));
  });
});
