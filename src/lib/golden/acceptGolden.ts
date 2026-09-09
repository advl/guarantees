import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { Refusal } from "../contract/index.js";
import type { Row } from "../register/index.js";
import type { Ran, RunContext } from "../run/index.js";
import { LIFT_DIR, REPORTS_DIR, WORK_DIR } from "../runner/index.js";
import { GOLDENS_DIR } from "./constants.js";
import type { Accepted } from "./types.js";

/**
 * Replaces a row's committed goldens with what its run generated, and
 * answers what changed.
 *
 * This is the only path by which a golden changes, which is the whole of
 * why it exists. A golden is a claim about what an artifact is, kept as a
 * file a reviewer reads as a diff, and it has to be generated inside the
 * image the entry runs in — a golden written by whatever toolchain a
 * developer happens to have is a claim about that machine. So accepting is
 * not a copy between two directories somebody could make by hand: it is a
 * run, and then a copy of what that run lifted out of its container.
 *
 * A MISSING golden is the entry's failure and never this function's. An
 * entry compares what it generated against what the tree holds and goes red
 * when the tree holds nothing, which is the failure a reader must see;
 * nothing here writes a golden the entry did not generate, and nothing here
 * quietly creates one to make a red entry green.
 *
 * It does not require the run to be green, and that is deliberate rather
 * than lax: the first accept of any golden happens on a run that is red
 * because the golden is not there yet, and the accept after an intended
 * change happens on a run that is red because the surface moved. Requiring
 * green would make the command unable to do the one thing it is for. What
 * it does require is that the run left files of its own — a run that lifted
 * nothing has nothing to say about what the artifact is, and copying from
 * it would replace a golden with silence — and that those files are this
 * run's. Freshness is two dates from one filesystem: the mark the run made
 * before its measured phase, and the dates the runner gave the files it
 * generated, both as the filesystem the corpus lives on reports them. A
 * host clock read against either would order them wrongly wherever the two
 * disagree, and refuse every honest accept.
 *
 * @note Impure — reads the run's lifted files and writes under `goldens/`.
 * @throws Refusal when the run lifted nothing, or lifted a file older than
 * the run that is supposed to have generated it.
 */
export default function acceptGolden(
  row: Row,
  context: RunContext,
  ran: Ran,
): Accepted {
  const lifted = join(context.corpusRoot, WORK_DIR, REPORTS_DIR, row.id);
  const generated = existsSync(lifted)
    ? readdirSync(lifted, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .sort()
    : [];
  if (generated.length === 0) {
    throw new Refusal(
      `${row.id} lifted nothing — an entry whose goldens are accepted writes them under ${WORK_DIR}/${row.id}/${LIFT_DIR}/, and a run that generated none has nothing to say about what the artifact is`,
    );
  }
  const stale = generated.find(
    (name) => statSync(join(lifted, name)).mtimeMs < ran.startedAt,
  );
  if (stale !== undefined) {
    throw new Refusal(
      `${row.id} lifted \`${stale}\`, which is older than the run that lifted it — a file an earlier run generated is a claim about an earlier tree, and accepting it would commit that claim under this run's name`,
    );
  }

  const goldens = join(context.corpusRoot, GOLDENS_DIR, row.id);
  mkdirSync(goldens, { recursive: true });
  const added: string[] = [];
  const replaced: string[] = [];
  const unchanged: string[] = [];
  for (const name of generated) {
    const from = join(lifted, name);
    const to = join(goldens, name);
    if (!existsSync(to)) added.push(name);
    else if (readFileSync(to).equals(readFileSync(from))) unchanged.push(name);
    else replaced.push(name);
    copyFileSync(from, to);
  }
  const orphaned = readdirSync(goldens)
    .filter((name) => !generated.includes(name))
    .sort();
  return { added, replaced, unchanged, orphaned };
}
