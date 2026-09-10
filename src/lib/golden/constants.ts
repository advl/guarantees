/**
 * Where a corpus keeps its goldens, under the corpus root, one directory
 * per row. Spelled here because the accept writes into it and the layering
 * scan skips it, and the two agree by reading one constant: a golden that a
 * scan read as source would be held to where a corpus's own imports may
 * reach, which is a rule about what somebody wrote and not about what a run
 * generated.
 *
 * @package
 */
export const GOLDENS_DIR = "goldens";
