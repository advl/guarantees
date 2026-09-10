import type { Register, Tier } from "../register/index.js";
import planTier from "./planTier.js";

/**
 * Every distinct image a tier's rows run in, in the order the register
 * names them.
 *
 * It is one question with one answer: a pre-flight resolves each of them
 * before the tier is spent, and a corpus registers one toolchain stamp per
 * image the tier names, because what a stamp asserts is true of the image
 * it was handed and of no other. Both would otherwise filter the register
 * by tier and collect the column themselves, in two repositories, and two
 * implementations of one question are two answers about one corpus the day
 * either of them moves.
 *
 * It is planned rather than filtered, so the tier's own refusals — a tier
 * with no rows, a tier with no row designed to fail — reach a caller
 * counting images just as they reach one about to run them. A filter
 * answers an empty list for a tier that does not exist, and a corpus that
 * mistyped a tier name would register no stamp at all and report nothing.
 *
 * @throws Refusal from `planTier` on a tier that holds nothing, and on one
 * holding no row designed to fail.
 *
 * @package The binary composes it; no entry module admits it, because what a
 * tier's rows pin an image by is this package's own arrangement rather than
 * something an embedder decides.
 */
export default function listTierImages(
  register: Register,
  tier: Tier,
): readonly string[] {
  const plan = planTier(register, tier);
  return [...new Set([...plan.pool, ...plan.serial].map((row) => row.image))];
}
