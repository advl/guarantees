import type ts from "typescript";

/** One file under `src/`, parsed once, with the means to report on it. */
export type Checked = {
  /** The path, relative to the repository root. */
  readonly file: string;
  readonly text: string;
  readonly source: ts.SourceFile;
  /** Where a node starts, as a line number a reader can act on. */
  readonly lineOf: (node: ts.Node) => number;
  readonly report: (rule: string, message: string) => void;
};

/** What the manifest says about the package, read once for every clause. */
export type Package = {
  readonly name: string;
  /**
   * The barrels at the top of `src/`: the package index and one entry module
   * per subpath the manifest publishes, read from the `exports` map so that
   * the two cannot disagree.
   */
  readonly entryModules: ReadonlySet<string>;
};

export type Violation = {
  readonly file: string;
  readonly rule: string;
  readonly message: string;
};
