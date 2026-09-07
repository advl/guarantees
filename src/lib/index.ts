/**
 * @module
 *
 * The lib barrel: every name a domain barrel mints, in one place, so that the
 * entry modules at the top of `src/` reach one level down and no deeper.
 */
export {
  CONTRACT_VERSION,
  EXIT_CODES,
  labelSchema,
  markerSchema,
  probeSchema,
  Refusal,
  registerSchema,
  reportSchema,
} from "./contract/index.js";
