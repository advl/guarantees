import { describe, expect, it } from "vitest";

import findRow from "../../_testing/findRow.js";
import { PIPELINE, REGISTER_TWO_IMAGES } from "../../_testing/fixtures.js";
import { labelSchema, Refusal } from "../contract/index.js";
import { parseRegister, UNMEASURED_S } from "../register/index.js";
import { WORKSPACE } from "../runner/index.js";
import {
  type DescribeContext,
  describeRun,
  KILL_MULTIPLIER,
  NAME_PREFIX,
} from "./index.js";

const rows = parseRegister(REGISTER_TWO_IMAGES, PIPELINE);
const walled = findRow(rows, "corpus-bijection");
const networked = findRow(rows, "examples-run");

const repositoryRoot = "/srv/checkout";
const corpusRoot = "/srv/checkout/tests/guarantees";
const checkout = "0123456789ab";

const context = (
  phase: DescribeContext["phase"],
  index?: number,
): DescribeContext => ({
  repositoryRoot,
  corpusRoot,
  checkout,
  nonce: "4242",
  image: "sha256:image",
  phase,
  index,
  command: ["bun", "run", "g:build:x"],
});

describe("describeRun", () => {
  it("names a build container by the entry, the recipe's position and the nonce", () => {
    expect(describeRun(walled, context("build", 1)).name).toBe(
      `${NAME_PREFIX}-corpus-bijection-build-1-4242`,
    );
  });

  it("names the measured container by the entry and the nonce alone", () => {
    expect(describeRun(walled, context("measured")).name).toBe(
      `${NAME_PREFIX}-corpus-bijection-measured-4242`,
    );
  });

  it("labels every container with the checkout and the entry, in the contract's shape", () => {
    for (const phase of ["build", "measured"] as const) {
      const { labels } = describeRun(walled, context(phase));
      expect(labels).toEqual({ corpus: checkout, entry: "corpus-bijection" });
      expect(labels.corpus).toMatch(
        new RegExp(labelSchema.properties.corpus.pattern),
      );
      expect(labels.entry).toMatch(
        new RegExp(labelSchema.properties.entry.pattern),
      );
    }
  });

  it("mounts the repository read-only and the entry's work directory writable where the corpus sits", () => {
    for (const phase of ["build", "measured"] as const) {
      expect(describeRun(walled, context(phase)).mounts).toEqual([
        { host: repositoryRoot, container: WORKSPACE, readOnly: true },
        {
          host: "/srv/checkout/tests/guarantees/.work/corpus-bijection",
          container: `${WORKSPACE}/tests/guarantees/.work/corpus-bijection`,
          readOnly: false,
        },
      ]);
    }
  });

  it("covers the repository's own install and leaves the corpus's own visible", () => {
    for (const phase of ["build", "measured"] as const) {
      expect(describeRun(walled, context(phase)).masks).toEqual([
        `${WORKSPACE}/node_modules`,
      ]);
    }
  });

  it("mounts a corpus at the repository root straight under the workspace", () => {
    const spec = describeRun(walled, {
      ...context("measured"),
      corpusRoot: repositoryRoot,
    });
    expect(spec.mounts[1]?.container).toBe(
      `${WORKSPACE}/.work/corpus-bijection`,
    );
    expect(spec.workdir).toBe(WORKSPACE);
  });

  it("runs a build from the workspace root and the measured phase from the corpus directory", () => {
    expect(describeRun(walled, context("build", 0)).workdir).toBe(WORKSPACE);
    expect(describeRun(walled, context("measured")).workdir).toBe(
      `${WORKSPACE}/tests/guarantees`,
    );
  });

  it("keeps the network on in the build phase whatever the row's isolation", () => {
    expect(describeRun(walled, context("build", 0)).network).toBe(true);
    expect(describeRun(networked, context("build", 0)).network).toBe(true);
  });

  it("drops the network in the measured phase unless the row declares image-net", () => {
    expect(describeRun(walled, context("measured")).network).toBe(false);
    expect(describeRun(networked, context("measured")).network).toBe(true);
  });

  it("gives a build the unmeasured deadline and the measured run the kill multiplier times its budget", () => {
    expect(describeRun(networked, context("build", 0)).deadlineS).toBe(
      UNMEASURED_S,
    );
    expect(describeRun(networked, context("measured")).deadlineS).toBe(
      60 * KILL_MULTIPLIER,
    );
  });

  it("hands the image and the command through as given", () => {
    const spec = describeRun(walled, context("measured"));
    expect(spec.image).toBe("sha256:image");
    expect(spec.command).toEqual(["bun", "run", "g:build:x"]);
  });

  it("refuses a relative root, naming which, before any containment is judged", () => {
    for (const [key, name] of [
      ["repositoryRoot", "repository"],
      ["corpusRoot", "corpus"],
    ] as const) {
      const relativeRoot = { ...context("measured"), [key]: "checkout" };
      expect(() => describeRun(walled, relativeRoot)).toThrow(Refusal);
      expect(() => describeRun(walled, relativeRoot)).toThrow(
        `the ${name} root "checkout" is not an absolute path`,
      );
    }
  });

  it("refuses a corpus outside the repository", () => {
    const outside = { ...context("measured"), corpusRoot: "/elsewhere/corpus" };
    expect(() => describeRun(walled, outside)).toThrow(Refusal);
    expect(() => describeRun(walled, outside)).toThrow(
      "is not inside the repository",
    );
  });
});
