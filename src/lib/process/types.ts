/**
 * What a spawned process left: its exit code, `null` when a signal ended it;
 * what it printed when captured; and whether the deadline fired, recorded
 * rather than inferred from the clock afterwards, because a process killed
 * at its deadline and one that finished a millisecond inside it are
 * indistinguishable by elapsed time and only one of them is a breach.
 */
export type Spawned = {
  readonly code: number | null;
  readonly out: string;
  readonly killed: boolean;
};

export type SpawnOptions = {
  readonly cwd?: string;
  /** When the process is given up on, in milliseconds. */
  readonly deadlineMs: number;
  /** Whether standard output is captured into `out`; standard error is never captured. */
  readonly capture?: boolean;
  /**
   * What stops the work when the deadline fires, awaited before the process
   * itself is signalled. For an engine client this is the container's
   * removal, which is what actually ends a run.
   */
  readonly onDeadline?: () => Promise<void>;
};

/**
 * The one process boundary in the package, which every impure module that
 * runs a host process takes — the engine's client, the corpus's runner, the
 * task face: a test hands in a fake that records what it was asked and
 * answers as scripted; the default spawns for real.
 */
export type Spawn = (
  binary: string,
  args: readonly string[],
  options: SpawnOptions,
) => Promise<Spawned>;
