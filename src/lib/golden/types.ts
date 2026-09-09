/**
 * What an accept did to a row's goldens, each list of file names sorted:
 * what the run generated and the tree had not, what it generated over a
 * golden whose bytes differed, what it generated identically, and what the
 * tree holds and the run did not generate at all.
 *
 * The orphans are answered rather than removed. A golden the entry no
 * longer generates means a row stopped reporting on something it used to,
 * which is a question for whoever reads the diff; deleting the evidence of
 * it is the one answer nobody asked for.
 */
export type Accepted = {
  readonly added: readonly string[];
  readonly replaced: readonly string[];
  readonly unchanged: readonly string[];
  readonly orphaned: readonly string[];
};
