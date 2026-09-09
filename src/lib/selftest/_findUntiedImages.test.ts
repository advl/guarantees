import { describe, expect, it } from "vitest";

import {
  IMAGE_A,
  IMAGE_B,
  PIPELINE,
  REGISTER_ONE_IMAGE,
} from "../../_testing/fixtures.js";
import { parseRegister } from "../register/index.js";
import _findUntiedImages, { type PinnedImage } from "./_findUntiedImages.js";

const register = parseRegister(REGISTER_ONE_IMAGE, PIPELINE);
const INPUTS = `sha256:${"a".repeat(64)}`;

const image = (name: string, digest: string, inputs = INPUTS): PinnedImage => ({
  name,
  pinned: { digest, inputs: INPUTS },
  inputs,
});

describe("_findUntiedImages", () => {
  it("finds nothing where every record describes its own files and every image has a row", () => {
    expect(_findUntiedImages([image("ts", IMAGE_A)], register, [])).toEqual({
      drifted: [],
      untied: [],
      unrecorded: [],
    });
  });

  it("names a record taken against a definition the tree no longer holds, with both hashes", () => {
    const moved = `sha256:${"b".repeat(64)}`;
    expect(
      _findUntiedImages([image("ts", IMAGE_A, moved)], register, []).drifted,
    ).toEqual([`ts: the files hash to ${moved}, recorded as ${INPUTS}`]);
  });

  it("names an image the tree builds that no row runs in", () => {
    expect(
      _findUntiedImages(
        [image("ts", IMAGE_A), image("browser", IMAGE_B)],
        register,
        [],
      ).untied,
    ).toEqual([`browser -> ${IMAGE_B}`]);
  });

  it("names every row pinned to a digest no record in the tree accounts for", () => {
    expect(_findUntiedImages([], register, []).unrecorded).toEqual(
      [...register.values()].map((row) => `${row.id} -> ${row.image}`),
    );
  });

  it("answers one row per digest nothing records, and says nothing of the digests that are recorded", () => {
    expect(
      _findUntiedImages([image("browser", IMAGE_B)], register, []).unrecorded,
    ).toHaveLength(register.size);
    expect(
      _findUntiedImages([image("ts", IMAGE_A)], register, []).unrecorded,
    ).toEqual([]);
  });

  it("ties a record to a row by the digest and not by the name it is published under", () => {
    const renamed = `ghcr.io/example/elsewhere@${IMAGE_A.slice(IMAGE_A.indexOf("@") + 1)}`;
    expect(
      _findUntiedImages([image("ts", renamed)], register, []).untied,
    ).toEqual([]);
  });
});
