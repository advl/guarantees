import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import captureRegistration from "../../_testing/captureRegistration.js";
import {
  PIPELINE,
  renderRegister,
  renderRow,
} from "../../_testing/fixtures.js";
import { hashImageInputs, IMAGES_DIR, PINNED_FILE } from "../image/index.js";
import { parseRegister, type Register } from "../register/index.js";
import { _DRIFT_TITLE, _UNRECORDED_TITLE, _UNTIED_TITLE } from "./constants.js";
import { describeImageTie } from "./index.js";

/** What the drift direction says it looked at, which its vacuity assertion titles itself by. */
const LOOKED_AT = `images this tree defines under ${IMAGES_DIR}/, and images it pins and does not build`;

const DIGEST = `sha256:${"0123456789abcdef".repeat(4)}`;
const REFERENCE = `ghcr.io/example/guarantees-ts@${DIGEST}`;

/**
 * A tree whose one image is described by its record and named by its rows:
 * the record is written after the definition and carries the hash of it,
 * which is what a record taken by the image command looks like.
 */
const trees: string[] = [];
const root = mkdtempSync(join(tmpdir(), "describe-image-tie-"));
trees.push(root);
const definition = join(root, IMAGES_DIR, "ts");
mkdirSync(definition, { recursive: true });
writeFileSync(join(definition, "Containerfile"), "FROM docker.io/example\n");
writeFileSync(
  join(definition, PINNED_FILE),
  `digest = "${REFERENCE}"\ninputs = "${hashImageInputs(root, "ts")}"\n`,
);
const register = parseRegister(
  renderRegister([
    renderRow("corpus-image", { image: `"${REFERENCE}"` }),
    renderRow("corpus-bijection", { image: `"${REFERENCE}"` }),
    renderRow("corpus-can-fail", {
      image: `"${REFERENCE}"`,
      file: `"selftest/corpus-can-fail.test.ts"`,
      expect: `"fail"`,
    }),
  ]),
  PIPELINE,
);

// Called as a corpus calls it, against a tree whose record and rows agree,
// so all three assertions run rather than merely being registered. What each
// finds when they stop agreeing is asserted over the finder, and what each
// does with a finding is asserted over the guard they share.
describeImageTie({ id: "corpus-image", root, register });

afterAll(() => {
  for (const tree of trees) rmSync(tree, { recursive: true, force: true });
});

/**
 * The wiring from each of the three finders to the title that reports it,
 * watched failing. Above, all three lists are empty and any of them could
 * have been handed to any of the titles with nothing going red; here one
 * direction is broken at a time and exactly the title that direction belongs
 * to is required to fail.
 */
describe("describeImageTie", () => {
  const wired = (options: {
    readonly root: string;
    readonly register: Register;
    readonly published?: readonly string[];
  }) =>
    captureRegistration(
      () => import("./describeImageTie.js"),
      (body) => {
        body({ id: "corpus-image", ...options });
      },
    );

  /** A tree of its own, so a broken direction never reaches the fixture above. */
  const treeWith = (files: Readonly<Record<string, string>>) => {
    const at = mkdtempSync(join(tmpdir(), "describe-image-tie-broken-"));
    trees.push(at);
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(at, dirname(path)), { recursive: true });
      writeFileSync(join(at, path), text);
    }
    return at;
  };

  const recordOf = (at: string, name: string, reference: string) =>
    `digest = "${reference}"\ninputs = "${hashImageInputs(at, name)}"\n`;

  it("reports a record taken against a definition that has since moved, and no other direction", async () => {
    const at = treeWith({
      [`${IMAGES_DIR}/ts/Containerfile`]: "FROM docker.io/example\n",
      [`${IMAGES_DIR}/ts/${PINNED_FILE}`]: `digest = "${REFERENCE}"\ninputs = "sha256:${"f".repeat(64)}"\n`,
    });
    const { tests } = await wired({ root: at, register });
    expect(tests.get(_DRIFT_TITLE)).toThrow("not the one they were pinned");
    expect(tests.get(_UNTIED_TITLE)).not.toThrow();
    expect(tests.get(_UNRECORDED_TITLE)).not.toThrow();
  });

  it("reports an image the tree builds that no row runs in, and no other direction", async () => {
    const other = `ghcr.io/example/guarantees-browser@sha256:${"c".repeat(64)}`;
    const at = treeWith({
      [`${IMAGES_DIR}/ts/Containerfile`]: "FROM docker.io/example\n",
      [`${IMAGES_DIR}/browser/Containerfile`]: "FROM docker.io/example\n",
    });
    writeFileSync(
      join(at, IMAGES_DIR, "ts", PINNED_FILE),
      recordOf(at, "ts", REFERENCE),
    );
    writeFileSync(
      join(at, IMAGES_DIR, "browser", PINNED_FILE),
      recordOf(at, "browser", other),
    );
    const { tests } = await wired({ root: at, register });
    expect(tests.get(_UNTIED_TITLE)).toThrow("no row runs in");
    expect(tests.get(_DRIFT_TITLE)).not.toThrow();
    expect(tests.get(_UNRECORDED_TITLE)).not.toThrow();
  });

  it("ties every row of a corpus that builds no image of its own and declares the one it pins", async () => {
    const bare = mkdtempSync(join(tmpdir(), "describe-image-tie-bare-"));
    trees.push(bare);
    const { tests } = await wired({
      root: bare,
      register,
      published: [REFERENCE],
    });
    for (const assertion of tests.values()) expect(assertion).not.toThrow();
  });

  it("reports every direction on a corpus that builds no image and declares none, which ties nothing", async () => {
    const bare = mkdtempSync(join(tmpdir(), "describe-image-tie-none-"));
    trees.push(bare);
    const { tests } = await wired({ root: bare, register });
    expect(tests.get(_UNRECORDED_TITLE)).toThrow("the corpus did not declare");
    expect(tests.get(`${_DRIFT_TITLE}, having looked at ${LOOKED_AT}`)).toThrow(
      "a scan that looked at nothing",
    );
  });

  it("reports a row pinned to a digest this tree records nowhere, and no other direction", async () => {
    const elsewhere = parseRegister(
      renderRegister([
        renderRow("corpus-image", { image: `"${REFERENCE}"` }),
        renderRow("corpus-bijection", {
          image: `"ghcr.io/example/guarantees-ts@sha256:${"b".repeat(64)}"`,
        }),
        renderRow("corpus-can-fail", {
          image: `"${REFERENCE}"`,
          file: `"selftest/corpus-can-fail.test.ts"`,
          expect: `"fail"`,
        }),
      ]),
      PIPELINE,
    );
    const { tests } = await wired({ root, register: elsewhere });
    expect(tests.get(_UNRECORDED_TITLE)).toThrow("the corpus did not declare");
    expect(tests.get(_DRIFT_TITLE)).not.toThrow();
    expect(tests.get(_UNTIED_TITLE)).not.toThrow();
  });
});
