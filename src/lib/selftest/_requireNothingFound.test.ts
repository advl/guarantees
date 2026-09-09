import { describe, expect, it } from "vitest";

import captureRegistration from "../../_testing/captureRegistration.js";

const TITLE = "finds nothing it looks for";
const asked = {
  title: TITLE,
  looked: () => 2,
  lookedAt: "things this looked at",
  found: (): readonly string[] => [],
  meaning: "what finding one would mean",
};

const registered = (
  overrides: Partial<typeof asked>,
): ReturnType<typeof captureRegistration> =>
  captureRegistration(
    () => import("./_requireNothingFound.js"),
    (body) => {
      body({ ...asked, ...overrides });
    },
  );

const VACUITY = `${TITLE}, having looked at things this looked at`;

describe("_requireNothingFound", () => {
  it("declares the finding and the count it rests on under titles of their own", async () => {
    expect([...(await registered({})).tests.keys()]).toEqual([VACUITY, TITLE]);
  });

  it("holds both where something was looked at and nothing was found", async () => {
    const { tests } = await registered({});
    expect(tests.get(VACUITY)).not.toThrow();
    expect(tests.get(TITLE)).not.toThrow();
  });

  it("fails the finding on a finding, naming what finding one means", async () => {
    const { tests } = await registered({ found: () => ["one -> two"] });
    expect(tests.get(TITLE)).toThrow("what finding one would mean");
    expect(tests.get(VACUITY)).not.toThrow();
  });

  it("fails the count and not the finding where nothing was looked at, so a proof reading a title cannot take one for the other", async () => {
    const { tests } = await registered({ looked: () => 0 });
    expect(tests.get(VACUITY)).toThrow("things this looked at");
    expect(tests.get(TITLE)).not.toThrow();
  });
});
