import { Refusal } from "../contract/index.js";
import type { RegisterFault } from "./types.js";

const describeFault = ({ table, column, reason, line }: RegisterFault) =>
  `${table === "" ? "the register" : `[${table}]`}${column === undefined ? "" : ` ${column}`} — ${reason}${line === undefined ? "" : ` (line ${line})`}`;

/**
 * Thrown when a register cannot be run as written. It carries every fault
 * found, not the first: the register is refused wholesale, because a fault
 * left in a row nobody happens to select is the same as a fault nobody
 * checked for. A `Refusal` like every other domain's, so one catch maps it
 * to the one exit code; its own class because its faults are structured.
 */
export default class RegisterRefusal extends Refusal {
  readonly faults: readonly RegisterFault[];

  constructor(faults: readonly RegisterFault[]) {
    const count = faults.length;
    super(
      `the register holds ${count} fault${count === 1 ? "" : "s"}:\n${faults.map(describeFault).join("\n")}`,
    );
    this.name = "RegisterRefusal";
    this.faults = faults;
  }
}
