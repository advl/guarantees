import { beforeAll, describe } from "vitest";

import _findTrespasses, { type Source } from "./_findTrespasses.js";
import _listSources from "./_listSources.js";
import _requireNothingFound from "./_requireNothingFound.js";
import { _INWARD_TITLE, _OUTWARD_TITLE } from "./constants.js";

/**
 * The boundary between a corpus and the code it judges, refused in both
 * directions.
 *
 * The two are separate testing layers, and the whole value of the
 * arrangement is that they are derived separately: a suite pins behaviour
 * from the inside, colocated with the code it covers, and a corpus pins
 * facts about the assembled system from outside it, against the surface a
 * consumer sees. One shared helper collapses that — the two layers begin
 * failing and passing together, and the corpus stops being independent
 * evidence at the exact moment somebody needs it to be. The other direction
 * matters as much: code that depends on the layer that judges it can be
 * made to pass by editing the judge.
 *
 * The collapse happens one convenient import at a time and never on
 * purpose, so it is checked mechanically rather than remembered. What is
 * out of bounds is the caller's fact, read from its own tree rather than
 * listed here, so that a directory added later is covered the day it
 * appears; and what each direction read is asserted non-empty, because a
 * scan that read nothing compares two empty lists and reads exactly like a
 * clean tree — a corpus resolved to a directory that is not there, and a
 * directory the source walk passes over, both look like that.
 *
 * @note Impure — reads every source file under the corpus and under each
 * forbidden directory.
 */
export default function describeLayering(options: {
  /** The row's id, which its selector matches. */
  readonly id: string;
  /** The corpus, whose every source file is scanned. */
  readonly corpusRoot: string;
  /** The directories the corpus judges, absolute: neither side may reach the other. */
  readonly forbidden: readonly string[];
}): void {
  describe(options.id, () => {
    let outward: readonly string[] = [];
    let inward: readonly string[] = [];
    let scanned: readonly Source[] = [];
    let judged: readonly Source[] = [];
    beforeAll(() => {
      scanned = _listSources(options.corpusRoot);
      judged = options.forbidden.flatMap((directory) =>
        _listSources(directory),
      );
      outward = _findTrespasses(scanned, options.forbidden);
      inward = _findTrespasses(judged, [options.corpusRoot]);
    });

    _requireNothingFound({
      title: _OUTWARD_TITLE,
      looked: () => Math.min(options.forbidden.length, scanned.length),
      lookedAt:
        "source files read under this corpus, against directories it stands outside of",
      found: () => outward,
      meaning:
        "corpus files reaching into the code they judge — a guarantee reaches what it judges the way a consumer does, through what it publishes",
    });

    _requireNothingFound({
      title: _INWARD_TITLE,
      looked: () => judged.length,
      lookedAt:
        "source files read under the directories this corpus stands outside of",
      found: () => inward,
      meaning:
        "files of the code reaching into the corpus — what is judged never depends on the layer that judges it",
    });
  });
}
