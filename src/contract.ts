/**
 * @module
 *
 * The `./contract` entry point: the five schemas, the exit codes and the
 * version they are published under, and nothing of its own that runs.
 */
export {
  CONTRACT_VERSION,
  EXIT_CODES,
  labelSchema,
  markerSchema,
  probeSchema,
  registerSchema,
  reportSchema,
} from "./lib/index.js";
