import { _BIJECTION_ID, TIERS } from "./constants.js";
import type { Pipeline, RegisterFault, Row } from "./types.js";

/**
 * What is true of a tier, and of the register, only once every row is
 * read: that one of its rows is designed to fail, that the pipeline
 * triggers it and that the pipeline proves it. The tier's wall is not held
 * here: it bounds the wall-clock span of the schedule as it ran, which the
 * pool shortens and a sum of budgets cannot see, so a sum held under the
 * wall at parse time would refuse exactly the registers the pool exists to
 * admit.
 *
 * The bijection is held over the register rather than per tier, because a
 * corpus has one of that row and a tier may hold none. A corpus without it
 * has never had the scan every other verdict stands on watched finding
 * anything: both of its directions compare two lists, and a scan that
 * looked nowhere compares two empty ones and reads exactly like a corpus
 * in order. Renaming that row is a single word, so the requirement is a
 * refusal here rather than a convention a proof politely reports skipping.
 *
 * Tier is one word in one row, and moving it is the cheapest way to switch
 * a gate off from inside the register: a row demoted out of the tier the
 * pipeline runs lands where nothing runs it, the tier it left stays green
 * on what remains, and no gate mentions that an entry stopped being
 * scheduled. So these are checked over the whole register, where a demotion
 * meets them before anything runs. The cheapest way from outside it is to
 * comment the step out, and that is why the pipeline this is held against
 * is read from a workflow's steps rather than from its text.
 */
export default function _checkTiers(
  rows: readonly Row[],
  pipeline: Pipeline,
): readonly RegisterFault[] {
  const faults: RegisterFault[] = [];
  for (const tier of TIERS) {
    const held = rows.filter((row) => row.tier === tier);
    if (held.length === 0) continue;
    const names = held.map((row) => `\`${row.id}\``).join(", ");

    if (!held.some((row) => row.expect === "fail")) {
      faults.push({
        table: tier,
        reason: `holds ${names} and no row marked \`expect = "fail"\` — a tier that has never been seen to fail is not evidence, so a row arrives at a tier together with the entry that shows the tier can report a failure`,
      });
    }

    if (!pipeline.triggeredTiers.includes(tier)) {
      faults.push({
        table: tier,
        reason: `holds ${names} and nothing triggers it — a tier nothing triggers is a set of rows that look scheduled and are not, so the job arrives in the same change as the first row at the tier`,
      });
    }

    if (!pipeline.provenTiers.includes(tier)) {
      faults.push({
        table: tier,
        reason: `holds ${names} and nothing proves it — a proof step nothing schedules is a gate never seen to fail, so the step that shows the tier failing is scheduled beside the tier it protects`,
      });
    }
  }

  if (rows.length > 0 && !rows.some((row) => row.id === _BIJECTION_ID)) {
    faults.push({
      table: _BIJECTION_ID,
      reason: `is the row a tier's proof rigs and this register holds none — nothing in this corpus has ever been shown able to find a file no row claims, and a scan that finds nothing reports exactly what a corpus in order reports`,
    });
  }
  return faults;
}
