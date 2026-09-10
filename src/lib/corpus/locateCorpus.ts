import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { Refusal } from "../contract/index.js";
import { CORPUS_DIR, REGISTER_FILE, WORKFLOW_FILE } from "./constants.js";
import type { Located } from "./types.js";

/**
 * Finds the corpus a command is about: the directory given, or the one
 * named under the working directory, with the register and the workflow it
 * is checked against.
 *
 * What makes a directory a corpus is its register, so a directory without
 * one is refused by name rather than treated as an empty corpus — an empty
 * corpus reports green, which is the worst possible answer to being run in
 * the wrong place. The repository is the corpus's parent, because that is
 * what a run mounts and what a build recipe's task face belongs to, so a
 * corpus at the root of a filesystem has no repository to be run from and
 * is refused too.
 *
 * The workflow is checked here beside the register, because every command
 * parses the register against it and none of them can do anything without
 * it. A file that is not there surfaces otherwise as the reader's own fault
 * at exit `red`, which says a guarantee failed about a run in which none was
 * ever scheduled.
 *
 * @note Impure — reads the filesystem to see whether the two files are there.
 * @throws Refusal when the directory holds no register, when the repository
 * holds no workflow, or when there is no parent to be the repository.
 *
 * @package
 */
export default function locateCorpus(cwd: string, override?: string): Located {
  const corpusRoot = resolve(cwd, override ?? CORPUS_DIR);
  const repositoryRoot = dirname(corpusRoot);
  // Whether this is a place a corpus can be at all, before whether one is
  // here: a directory with no parent has no repository to be mounted and no
  // task face to run a recipe on, whatever it holds.
  if (repositoryRoot === corpusRoot) {
    throw new Refusal(
      `the corpus at ${corpusRoot} has no parent to be the repository — a run mounts the repository and a recipe runs on its task face, and there is nothing above this to be either`,
    );
  }
  const registerPath = join(corpusRoot, REGISTER_FILE);
  if (!existsSync(registerPath)) {
    throw new Refusal(
      `no ${REGISTER_FILE} at ${corpusRoot} — a corpus is a directory with a register in it, and a directory without one is not an empty corpus; give the directory with \`--corpus\`, or run this where a \`${CORPUS_DIR}/\` is`,
    );
  }
  const workflowPath = join(repositoryRoot, ...WORKFLOW_FILE.split("/"));
  if (!existsSync(workflowPath)) {
    throw new Refusal(
      `no ${WORKFLOW_FILE} at ${repositoryRoot} — every command holds the register to the tiers a workflow triggers and proves, and a corpus whose pipeline is somewhere else names that file with \`--workflow\``,
    );
  }
  return { corpusRoot, repositoryRoot, registerPath, workflowPath };
}
