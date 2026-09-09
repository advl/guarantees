import { readdirSync } from "node:fs";
import { posix } from "node:path";
import { describe, expect, it } from "vitest";

import { INSTALL_DIR, WORKSPACE } from "../runner/index.js";
import _findWrongVersions from "./_findWrongVersions.js";
import _requireNothingFound from "./_requireNothingFound.js";
import _resolveFrom from "./_resolveFrom.js";
import { _MASK_TITLE, _VERSIONS_TITLE } from "./constants.js";

/**
 * What an entry actually resolves, asserted from inside the image, where
 * the answer is the fact rather than the intention.
 *
 * Two mechanisms behind "the same verdict on any machine" fail silently,
 * and both are checked here. The first is the mask: the repository is
 * bind-mounted read-only inside the container and its own install sits
 * directly above the corpus on the runtime's upward resolution path, so a
 * mask that leaves the files visible looks exactly like one that works, and
 * the only symptom is a corpus quietly checked against a toolchain nobody
 * chose. The second is what the corpus then resolves: the versions the
 * image installs, from outside the repository, since the image carries its
 * toolchain where no bind mount of the checkout can cover it.
 *
 * The expected versions are the caller's fact, so that a corpus derives
 * them from the image's own definition in its tree rather than restating a
 * list that would be true on the day it was written. One body per image the
 * tier names: what it asserts is true of the image it was handed and of no
 * other, so a corpus running two images registers it twice.
 *
 * @note Impure — reads the workspace install and the manifests the corpus
 * resolves from its own directory.
 */
export default function describeToolchainStamp(options: {
  /** The row's id, which its selector matches. */
  readonly id: string;
  /** The image this is asserted inside, named so a failure says which one moved. */
  readonly image: string;
  /** The corpus directory, which is where resolution starts, as it does for an entry. */
  readonly corpusRoot: string;
  /**
   * Where the repository's own install is mounted inside the image, which
   * the run covers. It defaults to where the run puts it, and a corpus is
   * not asked for it: the path is the run's own fact, made of two constants
   * a consumer cannot reach, so a corpus asked to state it can only retype
   * the literal — and a wrong path that happens to name an empty directory
   * passes both assertions below while the mask is broken. The override is
   * for a test pointing this at a directory it made.
   */
  readonly workspaceInstall?: string;
  /** Each package the image installs, at the version its definition names. */
  readonly expected: Readonly<Record<string, string>>;
}): void {
  const install =
    options.workspaceInstall ?? posix.join(WORKSPACE, INSTALL_DIR);
  describe(options.id, () => {
    it(_MASK_TITLE, () => {
      expect(
        readdirSync(install),
        `what the run covers ${install} with — anything here is a toolchain this entry resolves instead of ${options.image}`,
      ).toEqual([]);
    });

    _requireNothingFound({
      title: _VERSIONS_TITLE,
      looked: () => Object.keys(options.expected).length,
      lookedAt: `packages ${options.image} is expected to carry`,
      found: () =>
        _findWrongVersions(
          options.expected,
          _resolveFrom(options.corpusRoot, Object.keys(options.expected)),
          posix.dirname(install),
        ),
      meaning: `what the corpus resolves instead of what ${options.image} installs — a toolchain that moved underneath every budget this corpus ever measured`,
    });
  });
}
