import { expect, it } from "vitest";

/**
 * Registers a finder's two assertions: that it looked at something, and that
 * it found nothing.
 *
 * Every finding in this domain is a list compared against an empty one, and
 * two empty lists compare equal: a scan of a tree it never read, a tie over
 * a directory that defines no image and a stamp over no package all report
 * exactly what a corpus in order reports. So how much was looked at is
 * asserted too, and each half carries the sentence a reader meets when it
 * fires.
 *
 * The two are registered under two titles rather than asserted inside one,
 * and that is the whole reason this registers instead of asserting. A tier's
 * proof requires one of these titles among the failed, by name, on a corpus
 * it rigged for that finder to find something; under a shared title a scan
 * that read nothing fails the title the proof is looking for, and the proof
 * reports that the finder found what was planted when the finder saw
 * nothing at all — the vacuity these two assertions exist to separate,
 * reintroduced one level up.
 *
 * The counts and the findings are taken as thunks because a registration
 * runs before the hook that reads the tree.
 *
 * It is a function of its own so that the wiring from a finder to an
 * assertion is watched failing rather than only watched passing: a
 * registration shell run against a fixture that agrees with itself is green
 * whichever of the finder's lists it was handed.
 */
export default function _requireNothingFound(options: {
  /** What finding nothing means, as the title the finding's assertion carries. */
  readonly title: string;
  /** How much the finder was given to look at. Zero is a finding about nothing. */
  readonly looked: () => number;
  /** What was looked at, named so a reader knows what came back empty. */
  readonly lookedAt: string;
  /** What the finder answered, one line per thing a reader can act on. */
  readonly found: () => readonly string[];
  /** What finding one of them means, and what to do about it. */
  readonly meaning: string;
}): void {
  it(`${options.title}, having looked at ${options.lookedAt}`, () => {
    expect(
      options.looked(),
      `${options.lookedAt} — a scan that looked at nothing compares two empty lists and reads exactly like a tree in order`,
    ).toBeGreaterThan(0);
  });

  it(options.title, () => {
    expect(options.found(), options.meaning).toEqual([]);
  });
}
