import { Refusal } from "../contract/index.js";
import {
  POOLED_KINDS,
  type Register,
  type Row,
  type Tier,
} from "../register/index.js";

/**
 * A tier's plan: the rows that run as a pool at the machine's concurrency,
 * and the rows that run one at a time after the pool drains, each list in
 * register order.
 */
export type Plan = {
  readonly pool: readonly Row[];
  readonly serial: readonly Row[];
};

/**
 * Plans one tier: which rows run in the pool and which run one at a time,
 * in register order. Parallelism is a property of a row's kind, never a
 * flag on the caller: a kind in `POOLED_KINDS` pools, any other kind is
 * serial, and so is any row that declares `holds`, because what it holds is
 * a resource another row could contend for. The pooled kinds are read from
 * the register, which reads them from the schema, so the partition an
 * implementation in another language reads from the emitted file is the
 * one planned here and not a copy of it; the reason for the partition —
 * a budget measured beside three other containers is not the budget, since
 * shares reproduce under load and magnitudes do not — is stated once,
 * beside the data. The tier's wall stays one wall-clock number over the
 * whole schedule, so the pool buys headroom under it and never loosens it.
 * Nothing runs here.
 *
 * @throws Refusal on a tier with no rows, and on a tier with no row designed
 * to fail — a tier never seen to fail is not evidence.
 */
export default function planTier(register: Register, tier: Tier): Plan {
  const held = [...register.values()].filter((row) => row.tier === tier);
  if (held.length === 0) {
    throw new Refusal(
      `the ${tier} tier holds no rows — there is nothing to schedule and nothing to report`,
    );
  }
  if (!held.some((row) => row.expect === "fail")) {
    throw new Refusal(
      `the ${tier} tier holds no row marked \`expect = "fail"\` — a tier that has never been seen to fail is not evidence`,
    );
  }
  const pool = held.filter(
    (row) => POOLED_KINDS.includes(row.kind) && row.holds.length === 0,
  );
  const serial = held.filter((row) => !pool.includes(row));
  return { pool, serial };
}
