import { _COLUMNS, _HEADER_TABLE, _HEADERLESS_VERSION } from "./constants.js";
import type { _Located, RegisterFault } from "./types.js";

/**
 * Reads the `[corpus]` header table, present or absent, against `current`,
 * the contract version the caller reads. The header's one key is
 * `contract`, the version the register is written against. Absent — no
 * header, or a header without the key — the register is read as written
 * against the version at which the header did not exist, never the current
 * one, because a headerless register does not change meaning when this
 * package's version moves, and reading it as the new version would be
 * exactly the misreading the version exists to refuse. A version other
 * than `current` is refused, with or without a header. A `[corpus]` table
 * written as a row is refused as one fault naming the reservation, not as
 * one fault per column the header does not carry.
 *
 * `current` is a parameter and not a read of the contract so that the
 * refusal of a headerless register is watched firing now, on a version the
 * contract has not reached, rather than trusted until the day it moves.
 */
export default function _readHeader(
  header: {
    readonly table: Record<string, unknown>;
    readonly located: _Located;
  } | null,
  current: string,
): readonly RegisterFault[] {
  if (
    header !== null &&
    Object.keys(header.table).some((key) => _COLUMNS.includes(key))
  ) {
    return [
      {
        table: _HEADER_TABLE,
        reason:
          "is reserved for the register's header, and this table is written as a row — no row may take the name, because the header is where the contract version lives",
        line: header.located.line,
      },
    ];
  }

  const faults: RegisterFault[] = [];
  if (header !== null) {
    for (const [key, value] of Object.entries(header.table)) {
      const line = header.located.locateColumn(key);
      if (key !== "contract") {
        faults.push({
          table: _HEADER_TABLE,
          column: key,
          reason:
            "is not a key the header carries — the header holds `contract` and nothing else",
          line,
        });
      } else if (typeof value !== "string") {
        faults.push({
          table: _HEADER_TABLE,
          column: key,
          reason: "is not a string — the contract version is written as text",
          line,
        });
      }
    }
  }

  const named = header?.table.contract ?? _HEADERLESS_VERSION;
  if (typeof named === "string" && named !== current) {
    faults.push({
      table: _HEADER_TABLE,
      column: "contract",
      reason: `is "${named}", and this package reads contract "${current}" — a register on another version is not read as this one, and a register without a header, or a header without \`contract\`, is on contract "${_HEADERLESS_VERSION}"`,
      line: header?.located.locateColumn("contract"),
    });
  }
  return faults;
}
