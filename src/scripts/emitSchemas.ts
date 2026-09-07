/**
 * Writes the contract's schemas as files, one per schema, so that an
 * implementation in another language reads a schema rather than a type.
 *
 * The target directory is the first argument, or `contract` under the working
 * directory when none is given — the repository root under `bun run`. The
 * bytes are `JSON.stringify(schema, null, 2)` and a newline, and nothing
 * formats them afterwards: the emission is the canonical form, and a
 * formatter with an opinion of its own would make every build a diff.
 *
 * @note Impure — writes the filesystem.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  labelSchema,
  markerSchema,
  probeSchema,
  registerSchema,
  reportSchema,
} from "../lib/contract/index.js";

const schemas = {
  register: registerSchema,
  report: reportSchema,
  marker: markerSchema,
  probe: probeSchema,
  label: labelSchema,
};

const target = resolve(process.argv.at(2) ?? "contract");
mkdirSync(target, { recursive: true });

for (const [name, schema] of Object.entries(schemas)) {
  writeFileSync(
    resolve(target, `${name}.schema.json`),
    `${JSON.stringify(schema, null, 2)}\n`,
  );
}
