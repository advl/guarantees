import { createHash } from "node:crypto";
import { isAbsolute } from "node:path";
import { Refusal } from "../contract/index.js";

/**
 * The label that says which checkout a container belongs to: the first
 * twelve hex digits of a hash of the repository root's absolute path.
 *
 * Two checkouts of one repository — a main tree and a worktree, two jobs on
 * one runner — share no work directory and no register, and the label is
 * what makes that true of their containers too: a reap removes what carries
 * this checkout's label and touches nothing carrying another's. Hashed
 * rather than written out, because a reap names what it removed and a path
 * is the operator's own directory layout. A relative path is refused: two
 * processes with different working directories would hash one checkout to
 * two labels, and neither would find what the other left.
 *
 * @throws Refusal when the path is not absolute.
 *
 * @package
 */
export default function hashCheckout(repositoryRoot: string): string {
  if (!isAbsolute(repositoryRoot)) {
    throw new Refusal(
      `the repository root ${JSON.stringify(repositoryRoot)} is not an absolute path — a checkout is labelled by where it is, and a relative path names a different place from every working directory`,
    );
  }
  return createHash("sha256").update(repositoryRoot).digest("hex").slice(0, 12);
}
