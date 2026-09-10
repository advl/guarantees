import { describe, expect, it } from "vitest";

import { IMAGE_A } from "../../_testing/fixtures.js";
import { Refusal } from "../contract/index.js";
import { readPinned } from "./index.js";

const INPUTS = `sha256:${"abcdef0123456789".repeat(4)}`;

/** The pinned record as it is written, with one key replaced or added. */
const render = (record: Readonly<Record<string, string | null>>) =>
  Object.entries({
    digest: `"${IMAGE_A}"`,
    inputs: `"${INPUTS}"`,
    ...record,
  })
    .filter(([, value]) => value !== null)
    .map(([key, value]) => `${key} = ${value}`)
    .join("\n");

describe("readPinned", () => {
  it("reads the digest and the inputs of a well-formed record", () => {
    expect(readPinned(render({}))).toEqual({
      digest: IMAGE_A,
      inputs: INPUTS,
    });
  });

  it("reads a record with comments around its keys", () => {
    expect(
      readPinned(`# what the image was last published as\n${render({})}\n`),
    ).toEqual({ digest: IMAGE_A, inputs: INPUTS });
  });

  it.each([
    ["text that does not parse", "digest = ", "does not parse"],
    ["a missing digest", render({ digest: null }), "`digest` is missing"],
    ["a missing inputs", render({ inputs: null }), "`inputs` is missing"],
    [
      "a digest that is not a string",
      render({ digest: "1" }),
      "`digest` is missing or not a string",
    ],
    [
      "a digest that is a tag",
      render({ digest: '"ghcr.io/example/guarantees-ts:latest"' }),
      "is not an image pinned by digest",
    ],
    [
      "a digest without a name",
      render({ digest: `"sha256:${"0".repeat(64)}"` }),
      "is not an image pinned by digest",
    ],
    [
      "an inputs hash of the wrong length",
      render({ inputs: `"sha256:${"0".repeat(63)}"` }),
      "is not an inputs hash",
    ],
    [
      "a key the record does not carry",
      render({ built: '"2026-01-01"' }),
      "`built` is not a key a pinned record carries (digest, inputs)",
    ],
    [
      "the engine a record used to carry, now that no version of it decides anything",
      render({ engine: '"engine 1.2.3"' }),
      "`engine` is not a key a pinned record carries (digest, inputs)",
    ],
  ])("refuses %s", (_, text, reason) => {
    expect(() => readPinned(text)).toThrow(Refusal);
    expect(() => readPinned(text)).toThrow(reason);
  });

  it("lets a fault that is not the parser's surface as itself", () => {
    // A non-string reaching the parser is a defect of the caller, and the
    // parser's own TypeError is the honest report of it.
    expect(() => readPinned(undefined as unknown as string)).toThrow(TypeError);
  });
});
