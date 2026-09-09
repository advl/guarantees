import { describe, it } from "vitest";

import _failOnPurpose from "./_failOnPurpose.js";
import { _DESIGNED_TITLE } from "./constants.js";

/**
 * The sentinel: one suite, one assertion, designed to fail.
 *
 * Its row carries `expect = "fail"`, and no tier is called green until this
 * has been seen to go red inside the image. Without it a green tier is
 * equally consistent with a runner that never ran, an image whose toolchain
 * never installed, a selector matching nothing and a scheduler reporting
 * success on any exit code — every one of which looks exactly like a corpus
 * with nothing to report. A gate that has never been observed to fail is
 * not evidence, and this is a corpus applying that rule to itself first.
 *
 * If it ever passes, the tier is red and the scheduler says why. Repairing
 * it is the failure.
 *
 * The suite is named by the caller, which is the row's id, so that the row's
 * selector finds it. It takes the id positionally because it has no other
 * fact to take: the sentinel asserts nothing about the corpus around it.
 */
export default function describeCanFail(id: string): void {
  describe(id, () => {
    it(_DESIGNED_TITLE, _failOnPurpose);
  });
}
