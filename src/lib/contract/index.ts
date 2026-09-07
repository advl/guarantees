/**
 * @module
 *
 * The versioned contract: the schemas of the register, the runner's report,
 * the probe, the freshness marker and the container labels, the exit codes,
 * the version they are published under, and the one refusal every domain
 * throws when it declines to judge, because `refused` is the code it names.
 * Nothing here runs; an implementation in another language reads the
 * emitted schema files, a TypeScript one reads these.
 */
export {
  CONTRACT_VERSION,
  EXIT_CODES,
  labelSchema,
  markerSchema,
  probeSchema,
  registerSchema,
  reportSchema,
} from "./constants.js";
export { default as Refusal } from "./Refusal.js";
