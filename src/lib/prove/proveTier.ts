import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { Refusal, UNCLAIMED_TITLE } from "../contract/index.js";
import { resolveImage } from "../image/index.js";
import type { Register, Row, Tier } from "../register/index.js";
import { type Ran, runEntry } from "../run/index.js";
import { REPORTS_DIR, WORK_DIR } from "../runner/index.js";
import { planTier } from "../schedule/index.js";
import { readReport, type Verdict } from "../verdict/index.js";
import _installOrphan from "./_installOrphan.js";
import { BIJECTION_ID } from "./constants.js";
import type { ProveContext } from "./types.js";

/**
 * Proves that a tier can report a failure, and answers a verdict.
 *
 * Every tier proves its row designed to fail actually goes red, which is
 * what shows the runner and the scheduler are able to report a failure at
 * all. Without it a green tier is equally consistent with a runner that
 * never ran, an image whose toolchain never installed, a selector matching
 * nothing and a scheduler reporting success on any exit code — every one of
 * which looks exactly like a corpus with nothing to report.
 *
 * The tier holding the bijection proves it a second way, because the
 * sentinel cannot stand in for it: the sentinel shows a failure can be
 * reported, not that this particular scan can find anything. Both of the
 * bijection's directions compare two lists, and a scan that sees nothing
 * compares two empty lists and stays green while the sentinel beside it
 * stays red on schedule. So a file no row claims is installed, the row is
 * run, and the one named assertion is required among the failed — by the
 * title the body carries, read from the lifted run report and never from a
 * count line and never from an exit code. A count would accept any
 * assertion in the file, including a rotted one in the other direction,
 * which is the same fault this exists to refuse one level down. An exit
 * code is worse: a register that no longer parses, an image that will not
 * resolve and a hard kill all exit non-zero with the bijection never having
 * run.
 *
 * The title is the one the suite opens under, which is the row's id, and
 * never the row's selector: a selector is a prefix the runner matches
 * titles from the start of, and a corpus is free to write one that selects a
 * single assertion of the suite rather than the whole of it. Composed from
 * the selector, the wanted title would be a string no runner could emit and
 * a sound corpus would report a failed proof.
 *
 * The report has to be this run's. A lifted report outlives the run that
 * wrote it, so a run that died before writing one would leave the previous
 * report exactly where this looks; freshness is the mark the run made
 * against the date the runner's report carries, both from the filesystem
 * the corpus lives on, never the host clock against a stored date.
 *
 * The tree is restored on every path out, the throw included, and the
 * rigged run's own evidence goes with it: a corpus left holding a file no
 * row claims fails the next honest run for a reason nobody planted, and a
 * lifted report from a run rigged to fail would be read as a verdict.
 *
 * @note Impure — resolves images, starts containers, and writes and removes
 * a file in the corpus tree.
 * @throws Refusal when the tier cannot be planned, when a run cannot be
 * judged, and when the rigged run left no report or one older than itself.
 */
export default async function proveTier(
  tier: Tier,
  register: Register,
  context: ProveContext,
): Promise<Verdict> {
  const plan = planTier(register, tier);
  const rows = [...plan.pool, ...plan.serial];
  const run = async (row: Row): Promise<Ran> => {
    const image = await resolveImage(context.engine, row.image, context.spawn);
    return runEntry(row, { ...context, image: image.reference });
  };

  // The plan is what refuses a tier holding no row designed to fail, so the
  // loop below is never the zero-iteration assertion that a tier reports
  // failures having watched none.
  for (const sentinel of rows.filter((row) => row.expect === "fail")) {
    const ran = await run(sentinel);
    if (!ran.ok) {
      return {
        ok: false,
        reason: `the ${tier} tier was not proved: ${ran.reason} — a tier whose row designed to fail does not fail has shown nothing about what its green rows mean`,
      };
    }
  }
  const proved = `the ${tier} tier reports a failure when one is designed`;

  const bijection = rows.find((row) => row.id === BIJECTION_ID);
  if (bijection === undefined) {
    return {
      ok: true,
      reason: `${proved}, and holds no ${BIJECTION_ID} row, so nothing here was proved by orphan`,
    };
  }

  const lifted = join(
    context.corpusRoot,
    WORK_DIR,
    REPORTS_DIR,
    `${bijection.id}.json`,
  );
  const restore = _installOrphan(context.corpusRoot);
  try {
    const ran = await run(bijection);
    if (!existsSync(lifted)) {
      throw new Refusal(
        `${bijection.id} left no report of the run this proof rigged, so which assertion failed is unknown — and an exit code cannot say, which is the whole reason this reads a report`,
      );
    }
    if (statSync(lifted).mtimeMs < ran.startedAt) {
      throw new Refusal(
        `${bijection.id} left a report older than the run this proof rigged — a lifted report outlives the run that wrote it, and an earlier run's verdict read as this one's would prove nothing`,
      );
    }
    const summary = readReport(readFileSync(lifted, "utf8"));
    const wanted = `${bijection.id} ${UNCLAIMED_TITLE}`;
    if (!summary.failedTitles.includes(wanted)) {
      return {
        ok: false,
        reason: `${bijection.id} did not report \`${wanted}\` failing on a corpus holding a file no row claims (${summary.failedTitles.join("; ") || "nothing failed"}) — either that assertion is not finding what it claims to find, or the entry never reached it`,
      };
    }
    return {
      ok: true,
      reason: `${proved}, and ${bijection.id} reports \`${wanted}\` failing on a file no row claims`,
    };
  } finally {
    restore();
    rmSync(lifted, { force: true });
    rmSync(join(context.corpusRoot, WORK_DIR, REPORTS_DIR, bijection.id), {
      recursive: true,
      force: true,
    });
  }
}
