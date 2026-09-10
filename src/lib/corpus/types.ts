/**
 * Where a corpus is on disk, and the two files a command reads before it
 * reads anything else.
 *
 * @package
 */
export type Located = {
  /** The corpus directory, absolute. */
  readonly corpusRoot: string;
  /** Its parent, which is the repository a run mounts. */
  readonly repositoryRoot: string;
  readonly registerPath: string;
  readonly workflowPath: string;
};
