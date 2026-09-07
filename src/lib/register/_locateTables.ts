import type { _Located } from "./types.js";

// The budget domain holds a copy of this line grammar for its rebudget, and a
// test here pins the two equal: the register reads the budget, so the budget
// cannot read this without a cycle.
const HEADER = /^\s*\[\s*([^\]]*?)\s*\]\s*(?:#.*)?\r?$/;
const KEY = /^\s*([A-Za-z0-9_-]+)\s*=/;

/**
 * Where each table is in the text: its id, its header line, and a way to
 * point at the line a column sits on.
 *
 * The scan is what gives the register its order and its line numbers. The
 * parser's object cannot: a JavaScript object lists integer-like keys first
 * whatever the text says, so a row named `1` would jump the queue, and the
 * parser reports no positions at all. A second definition of an id is
 * reported here rather than parsed, because the parser refuses a redefined
 * table before any row can be read.
 *
 * The scan reads lines, not the grammar: a line inside a multi-line string
 * that looks like `[x]` is taken for a header. No register writes one, and a
 * table located that way has no columns, so it is refused as a row with
 * every column missing rather than passed in silence.
 */
export default function _locateTables(text: string): {
  readonly tables: readonly _Located[];
  readonly duplicates: readonly {
    readonly id: string;
    readonly line: number;
  }[];
} {
  const lines = text.split("\n");
  const headers = lines.flatMap((line, index) => {
    const id = HEADER.exec(line)?.at(1);
    return id === undefined ? [] : [{ id, index }];
  });

  const tables: _Located[] = [];
  const duplicates: { id: string; line: number }[] = [];
  const seen = new Set<string>();

  for (const [position, { id, index }] of headers.entries()) {
    const line = index + 1;
    if (seen.has(id)) {
      duplicates.push({ id, line });
      continue;
    }
    seen.add(id);
    const end = headers.at(position + 1)?.index ?? lines.length;
    const body = lines.slice(index + 1, end);
    tables.push({
      id,
      line,
      locateColumn: (column) => {
        const offset = body.findIndex(
          (candidate) => KEY.exec(candidate)?.at(1) === column,
        );
        return offset === -1 ? line : line + 1 + offset;
      },
    });
  }

  return { tables, duplicates };
}
