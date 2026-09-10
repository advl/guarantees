/** A mapping key, with whatever a list dash puts in front of it. */
const KEY = /^(\s*)(-\s+)?([A-Za-z0-9_.-]+):(.*)$/;

/** What opens a block scalar, with its chomping and indentation indicators. */
const BLOCK = /^[|>][-+]?\d*$/;

/**
 * A mapping the reader is inside: whether a list dash opened it, which is
 * what tells a step from the job holding it, and whether a condition of its
 * own guards it.
 */
type _Scope = {
  readonly column: number;
  readonly item: boolean;
  guarded: boolean;
};

/**
 * A line with everything from the first `#` that opens a word removed.
 *
 * One rule covers both layers, because both spell a comment the same way: a
 * `#` opening a word ends a YAML line and ends a shell line, and a `#` in the
 * middle of a word is part of it in either.
 */
const _uncommented = (line: string): string => {
  const at = line.search(/(?:^|\s)#/);
  return at === -1 ? line : line.slice(0, at);
};

/**
 * Every command a workflow's steps run unconditionally, one line each,
 * comments removed.
 *
 * A workflow is read for the tiers it schedules, and the file has to be read
 * as a pipeline rather than as bytes for that answer to mean anything. The
 * ordinary way to switch a step off is to comment it out, and a scan over
 * the whole text cannot tell a step that runs from one that a `#` disabled
 * this morning: the tier goes on looking triggered and proven while no job
 * touches it, which is precisely the state the register is checked against
 * a workflow to refuse. Prose has the same shape from the other side — a
 * comment writing a command out in full is not a job running it.
 *
 * A condition on a STEP is the same gesture one line shorter, so it is read
 * too: a step that may run nothing schedules nothing, its commands are
 * dropped, the tier they name looks unscheduled, and that is already refused
 * by name. Dropping rather than refusing outright is what lets a job guard a
 * step naming no tier at all, which is ordinary; the cost falls only where
 * the guarded step was the only thing naming a tier.
 *
 * A condition on the JOB is not that gesture and is not read. Switching a
 * step off is what a step's condition and a step's comment have in common;
 * a job's condition is how a pipeline says WHEN a job runs, which is
 * scheduling itself rather than a way of not scheduling. The distinction is
 * a position and not a reading of the expression: a step is a list item and
 * a job is a mapping key, so the dash that opened the mapping is the whole
 * of the test, and nothing here interprets what a condition says.
 *
 * Reading a job's condition as a disqualification made one tier kind
 * undeclarable. A tier that runs at merge and not on every pull request is
 * exactly a job the pipeline guards by event, so a merge tier could not be
 * declared in a workflow that also served the pr tier — the vocabulary the
 * register is checked against could not be spelled in the file it is checked
 * against. It also had the asymmetry backwards: an `on:` block that never
 * fires is not read at all and fails open, so the rule refused the visible,
 * machine-checkable condition and passed over the invisible one.
 *
 * What is read is the scalar of every `run:` key, single-line and block
 * alike, and the indentation of the mapping each one sits in, which is how
 * a step and its job are told apart from the file around them. A block ends
 * where the indentation returns to the key's own, which is the runtime's own
 * rule for it.
 *
 * What is NOT read: whether the workflow is triggered at all. An `on:` block
 * that never fires for a pull request leaves every step in this file looking
 * live, and no reading of the steps can say otherwise — as can an anchor, a
 * matrix or a composite action putting a command somewhere this does not
 * look. The first fails open and is the one gesture a reader of this file
 * has to check by eye; the rest fail closed, into a tier that looks
 * unscheduled and is refused rather than passed over.
 *
 * Pure: the caller reads the file.
 *
 * @package
 */
export default function _readRunSteps(text: string): readonly string[] {
  const scopes: _Scope[] = [];
  const found: { command: string; within: readonly _Scope[] }[] = [];
  let block: { column: number; within: readonly _Scope[] } | null = null;
  for (const line of text.split(/\r?\n/)) {
    if (block !== null) {
      const indent = line.length - line.trimStart().length;
      if (line.trim() === "" || indent > block.column) {
        const command = _uncommented(line).trim();
        if (command !== "") found.push({ command, within: block.within });
        continue;
      }
      block = null;
    }
    const key = KEY.exec(line);
    if (key === null) continue;
    const [, indent = "", dash, name = "", rest = ""] = key;
    const column = indent.length + (dash ?? "").length;
    // A key closes every mapping nested deeper than it, and a list dash
    // closes the item before it as well: the next step's `if:` is not the
    // last step's.
    for (let top = scopes.at(-1); top !== undefined; top = scopes.at(-1)) {
      const closed =
        top.column > column || (top.column === column && dash !== undefined);
      if (!closed) break;
      scopes.pop();
    }
    let scope = scopes.at(-1);
    if (scope === undefined || scope.column < column) {
      scope = { column, item: dash !== undefined, guarded: false };
      scopes.push(scope);
    }
    // A step is a list item and a job is a mapping key, so the dash that
    // opened the scope is the whole of the distinction: no expression is read
    // and no key name is looked for.
    if (name === "if" && scope.item) scope.guarded = true;
    if (name !== "run") continue;
    const scalar = _uncommented(rest).trim();
    if (BLOCK.test(rest.trim())) {
      block = { column, within: [...scopes] };
      continue;
    }
    if (scalar !== "") found.push({ command: scalar, within: [...scopes] });
  }
  // Read at the end and not as each command is met, because a step spells
  // its condition wherever it likes: `if:` under `run:` guards the step
  // above it just as much as one written over it.
  return found
    .filter(({ within }) => !within.some((scope) => scope.guarded))
    .map(({ command }) => command);
}
