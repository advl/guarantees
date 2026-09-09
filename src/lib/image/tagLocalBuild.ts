import { LOCAL_PREFIX } from "./constants.js";

/**
 * The tag a build of this repository's own image is filed under on the
 * machine that built it, which is a local name and never the published
 * one: what a row pins is pushed by the pipeline under a name that job
 * owns.
 *
 * The tag is what the engine is handed at build time, and it is
 * deliberately not a name anything else resolves by: it is a mutable name
 * in a store every process on the machine shares, and the build answers the
 * ID that outlives it.
 *
 * Pure.
 */
export default function tagLocalBuild(name: string): string {
  return `${LOCAL_PREFIX}-${name}:local`;
}
