import { TIERS } from "./constants.js";
import type { Pipeline, RegisterFault, Row } from "./types.js";

/**
 * What is true of a tier only once every row of it is read: that one of its
 * rows is designed to fail, that the pipeline triggers it and that the
 * pipeline proves it. The tier's wall is not held here: it bounds the
 * wall-clock span of the schedule as it ran, which the pool shortens and a
 * sum of budgets cannot see, so a sum held under the wall at parse time
 * would refuse exactly the registers the pool exists to admit.
 *
 * Tier is one word in one row, and moving it is the cheapest way to switch
 * a gate off: a row demoted out of the tier the pipeline runs lands where
 * nothing runs it, the tier it left stays green on what remains, and no
 * gate mentions that an entry stopped being scheduled. So these are checked
 * over the whole register, where a demotion meets them before anything
 * runs.
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
  return faults;
}
