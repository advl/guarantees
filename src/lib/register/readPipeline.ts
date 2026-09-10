import { registerSchema } from "../contract/index.js";
import _readRunSteps from "./_readRunSteps.js";
import { TIERS } from "./constants.js";
import RegisterRefusal from "./RegisterRefusal.js";
import type { Pipeline, RegisterFault, Tier } from "./types.js";

/**
 * What a workflow says it runs and what it says it proves, read from the
 * contract rather than spelled here: the two commands are what a corpus's
 * pipeline has to say in order to be read at all, so they are a datum every
 * implementation reads out of one file.
 */
const NAMES = {
  triggered: registerSchema.$defs.face.const.tier,
  proven: registerSchema.$defs.face.const.prove,
} as const;

/**
 * Every tier the commands name after `face`, in the order they name them.
 * What is captured is the shape a tier name can take and never every
 * non-space run: a command chaining the next one after a semicolon, or
 * ending the tier at a line's fold, would otherwise hand the punctuation to
 * the refusal below, and the whole tool would decline every command over a
 * workflow that reads perfectly.
 */
const named = (
  commands: readonly string[],
  face: string,
): readonly string[] => [
  ...new Set(
    [
      ...commands
        .join("\n")
        .matchAll(new RegExp(`\\b${face}\\s+([A-Za-z0-9_-]+)`, "g")),
    ].flatMap((match) => match.slice(1)),
  ),
];

/**
 * What a workflow triggers and what it proves, read from its text.
 *
 * The register cannot read this for itself and must not: a tier holding
 * rows that no job runs is rows that look scheduled and are not, and a tier
 * no job proves is a gate never seen to fail. Reading the workflow here and
 * handing the answer to the parser is what makes both refusals fire on
 * every command, locally and in every job — an assertion inside a tier's
 * own entry cannot observe its own tier being unscheduled, because when the
 * tier is unscheduled the entry never runs.
 *
 * What the file runs is read from its steps and never from its bytes.
 * Commenting a step out is how a step is switched off, and a scan over the
 * whole text reads a disabled step exactly as it reads a live one: the tier
 * goes on looking triggered and proven while no job runs it, and every
 * command over that register stays green — the one state this whole
 * composition exists to refuse. A condition on the step, or on its job, is
 * the same gesture in one word and is read the same way: what comes back is
 * what the steps run unconditionally, so a guarded step leaves its tier
 * looking unscheduled, which is refused by name where it is held.
 *
 * One gesture is outside what this reads, and no reading of the steps
 * closes it: a workflow whose `on:` block never fires. A file nothing
 * triggers runs none of the steps this reads as live, and a register held
 * against it is held against a pipeline nobody schedules.
 *
 * A name that is not a tier is refused rather than dropped. A dropped match
 * is exactly the hole this exists to close: a job running `g:tier prr` would
 * leave the pr tier looking untriggered, or worse, leave a real tier
 * unnoticed while the register was checked against a shorter list. So is a
 * workflow naming no tier at all, which is a file that reads like a
 * pipeline and schedules nothing.
 *
 * Pure: the caller reads the file.
 *
 * @throws RegisterRefusal naming every unrecognised tier, and a workflow
 * that names none.
 */
export default function readPipeline(text: string, collects: string): Pipeline {
  const commands = _readRunSteps(text);
  const found = {
    triggered: named(commands, NAMES.triggered),
    proven: named(commands, NAMES.proven),
  };
  const faults: RegisterFault[] = [];
  for (const [which, tiers] of Object.entries(found)) {
    for (const tier of tiers) {
      if (!(TIERS as readonly string[]).includes(tier)) {
        faults.push({
          table: tier,
          reason: `is ${which} by the workflow and is not a tier (${TIERS.join(" | ")}) — a name nobody recognises is dropped in silence otherwise, and the tier it was meant to be goes on looking unscheduled`,
        });
      }
    }
  }
  if (
    faults.length === 0 &&
    found.triggered.length + found.proven.length === 0
  ) {
    faults.push({
      table: "",
      reason: `names no tier in any step it runs — a workflow that runs no \`${NAMES.triggered}\` and proves no \`${NAMES.proven}\` schedules nothing, and a step that names one and is commented out, or that a condition guards, runs nothing either, so every tier the register holds is refused against it`,
    });
  }
  if (faults.length > 0) throw new RegisterRefusal(faults);
  return {
    triggeredTiers: found.triggered as readonly Tier[],
    provenTiers: found.proven as readonly Tier[],
    collects,
  };
}
