import { registerSchema } from "../contract/index.js";

/**
 * The id the file a proof installs is named for.
 *
 * It opens with an underscore, which a row's id may not carry, so no
 * register can claim it and the file is unclaimed by construction rather
 * than by a promise nobody checks. It is still a name the runner collects,
 * because a file the runner skips is not the fact the proof installs it to
 * establish. It is read from the contract, so an implementation in another
 * language installs the file this one would.
 *
 * @package
 */
export const ORPHAN_ID: string = registerSchema.$defs.prove.const.orphanId;

/**
 * The id a corpus gives the row that holds the bijection.
 *
 * A proof by orphan has to know which row scans the tree, and no column
 * says so: what a row carries is where its file is and how the runner finds
 * it inside that file, not what it asserts. The contract names that row, and
 * the parser refuses a register holding none under the name, so the id is a
 * datum every implementation reads rather than a convention each is trusted
 * to keep. A tier holding no row under it is not the tier that row sits at
 * and is proved by its sentinel alone, and the verdict says so rather than
 * passing over it in silence.
 *
 * @package
 */
export const BIJECTION_ID: string =
  registerSchema.$defs.prove.const.bijectionId;

/** A collectable test file, and a real one, so that nothing about it but its absence from the register is unusual. */
export const _ORPHAN_BODY = [
  'import { it } from "vitest";',
  "",
  'it("is collected by the runner and claimed by no row", () => {});',
  "",
].join("\n");
