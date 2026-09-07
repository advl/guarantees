import { parse, TomlError } from "smol-toml";
import { CONTRACT_VERSION } from "../contract/index.js";
import _checkTiers from "./_checkTiers.js";
import _isTable from "./_isTable.js";
import _locateTables from "./_locateTables.js";
import _readHeader from "./_readHeader.js";
import _readRow from "./_readRow.js";
import { _HEADER_TABLE, _ID_PATTERN, RESERVED_IDS } from "./constants.js";
import RegisterRefusal from "./RegisterRefusal.js";
import type { Pipeline, Register, RegisterFault, Row } from "./types.js";

/**
 * Reads a register, or refuses it wholesale.
 *
 * Every fault is collected before the one refusal is thrown, so a register
 * with three faults reports three. Rows come back in the order they are
 * written. The header is read whether or not it is written: a register
 * without one is on the version at which the header did not exist, and is
 * refused the day this package reads another. The tier-level checks — a row
 * designed to fail in every tier, the tiers the pipeline triggers and
 * proves — run only over a register whose rows all read, because a claim
 * about a tier whose rows did not parse is noise beside the faults that
 * stopped them. The tier's wall is not held here: it bounds the schedule as
 * it ran, which the pool shortens and a sum of budgets cannot see.
 *
 * The register never reads the workflow or asks the runner. The caller
 * passes what it found as the pipeline: the tiers the workflow triggers, the
 * tiers it proves and the suffix the runner collects. A tier holding rows
 * and absent from either list is refused, so a caller with no workflow
 * passes empty lists and is refused for every tier the register holds.
 *
 * @throws RegisterRefusal carrying every fault found.
 */
export default function parseRegister(
  text: string,
  pipeline: Pipeline,
): Register {
  const { tables, duplicates } = _locateTables(text);
  if (duplicates.length > 0) {
    throw new RegisterRefusal(
      duplicates.map(({ id, line }) => ({
        table: id,
        reason:
          "is defined twice — an id is a directory and a container name, and neither can be two rows",
        line,
      })),
    );
  }

  let document: Record<string, unknown>;
  try {
    document = parse(text);
  } catch (error) {
    // Only the parser's own error is a fault in the register; anything else
    // is a defect of this program, and surfaces as itself rather than as a
    // refusal that would send the register's author to a line that is fine.
    if (!(error instanceof TomlError)) throw error;
    // Its message opens with the fault and continues with a code block, and
    // its line is the one the register's author needs.
    const { message, line } = error;
    throw new RegisterRefusal([
      {
        table: "",
        reason: `does not parse: ${message.replace(/\n[\s\S]*$/, "")}`,
        line,
      },
    ]);
  }

  const faults: RegisterFault[] = [];
  const rows = new Map<string, Row>();

  const claimed = new Set(
    tables.flatMap(({ id }) => [id, ...id.split(".").slice(0, 1)]),
  );
  for (const key of Object.keys(document)) {
    if (!claimed.has(key)) {
      faults.push({
        table: key,
        reason:
          "is a value at the top of the register — the register holds one table per row and nothing beside them",
      });
    }
  }

  let headerSeen = false;
  for (const located of tables) {
    const value = document[located.id];
    const table = _isTable(value) ? value : {};

    if (located.id === _HEADER_TABLE) {
      headerSeen = true;
      faults.push(..._readHeader({ table, located }, CONTRACT_VERSION));
      continue;
    }
    if (!_ID_PATTERN.test(located.id)) {
      faults.push({
        table: located.id,
        reason:
          "is not an id — lowercase letters, digits and hyphens, opening on a letter or a digit, because an id is a directory name and half a container name before it is anything else",
        line: located.line,
      });
      continue;
    }
    if (RESERVED_IDS.includes(located.id)) {
      faults.push({
        table: located.id,
        reason:
          "is reserved — it is where run reports are kept once an entry's own directory is torn down, so no row may take it",
        line: located.line,
      });
      continue;
    }

    const { row, faults: rowFaults } = _readRow(
      located.id,
      table,
      located,
      pipeline.collects,
    );
    faults.push(...rowFaults);
    if (row !== null) rows.set(located.id, row);
  }
  if (!headerSeen) faults.push(..._readHeader(null, CONTRACT_VERSION));

  if (faults.length === 0) {
    faults.push(..._checkTiers([...rows.values()], pipeline));
  }
  if (faults.length > 0) throw new RegisterRefusal(faults);
  return rows;
}
