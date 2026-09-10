/**
 * Where a repository keeps its corpus, under its root, when no directory is
 * given on the command line.
 *
 * @package
 */
export const CORPUS_DIR = "guarantees";

/** The register, inside the corpus directory: the file whose presence says a directory is one. @package */
export const REGISTER_FILE = "corpus.toml";

/**
 * The workflow a corpus is checked against, under the repository root, when
 * no file is given. It is read rather than assumed because the tiers it
 * triggers and proves are what the register is held to, and a corpus whose
 * pipeline lives elsewhere says so on the command line.
 *
 * @package
 */
export const WORKFLOW_FILE = ".github/workflows/guarantees.yml";
