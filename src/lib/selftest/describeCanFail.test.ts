import { describe, expect, it } from "vitest";

import captureRegistration from "../../_testing/captureRegistration.js";
import { _DESIGNED_TITLE } from "./constants.js";
import { describeCanFail } from "./index.js";

/**
 * The sentinel registered and not run, which is the only way this body can
 * be watched at all: its one assertion is designed to fail, so running it
 * here would turn this package's own suite red for reporting exactly what
 * it exists to report. Under a skip the registration still runs — the suite
 * is opened under the name the caller gave and the test is declared — and
 * the assertion does not.
 */
describe.skip("the sentinel a corpus's failing row runs", () => {
  describeCanFail("corpus-can-fail");
});

/**
 * What the registration under that skip actually registered, which a skip
 * cannot report: the runner is replaced for one dynamic import, so the suite
 * name, the count, the title and the body are read back as values. Without
 * this the file is green whether the body opens the suite under the wrong
 * name, registers nothing, titles its one test something else or asserts
 * something that holds — every realistic defect in the unit it names.
 */
describe("describeCanFail", () => {
  it("opens one suite under the caller's id, holding one assertion that fails on purpose", async () => {
    const { suites, tests } = await captureRegistration(
      () => import("./describeCanFail.js"),
      (body) => {
        body("corpus-can-fail");
      },
    );
    expect(suites).toEqual(["corpus-can-fail"]);
    expect([...tests.keys()]).toEqual([_DESIGNED_TITLE]);
    expect(tests.get(_DESIGNED_TITLE)).toThrow("the corpus reports failure");
  });
});
