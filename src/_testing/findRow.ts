import type { Register, Row } from "../lib/register/index.js";

/**
 * The row a fixture register holds under `id`, or a failure naming the id.
 * A cast would silence the `undefined` and let a renamed fixture id surface
 * as a property read on nothing, three tests later; this names the missing
 * row at the line that asked for it.
 */
export default function findRow(register: Register, id: string): Row {
  const row = register.get(id);
  if (row === undefined) throw new Error(`no fixture row ${id}`);
  return row;
}
