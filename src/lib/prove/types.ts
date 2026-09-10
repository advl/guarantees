import type { RunContext } from "../run/index.js";

/**
 * What proving a tier needs: everything a run of one entry needs but the
 * image, which a proof resolves per row from the row itself.
 *
 * The image is left out because a tier's rows may name more than one, and a
 * proof runs whichever rows the tier holds — a single resolved reference
 * handed in would run the sentinel inside an image its row does not name,
 * and the proof would be about a container nobody scheduled.
 */
export type ProveContext = Omit<RunContext, "image">;
