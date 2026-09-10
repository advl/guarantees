/**
 * @module
 *
 * The image: a hash over the files an image is built from, the record of
 * what its directory was last pinned as, a digest resolved in local storage
 * before the registry, and a build. `readPinned` is pure; the rest read the
 * filesystem or spawn the engine, and every module that spawns takes a
 * `Spawn` defaulting to the real one.
 */
export { default as buildImage } from "./buildImage.js";
export {
  CONTAINERFILE,
  DEFAULT_IMAGE,
  IMAGES_DIR,
  INPUTS_PATTERN,
  LOCAL_PREFIX,
  PINNED_FILE,
  REFERENCE_PATTERN,
} from "./constants.js";
export { default as hashImageInputs } from "./hashImageInputs.js";
export { default as judgePinned } from "./judgePinned.js";
export { default as locatePinned } from "./locatePinned.js";
export { default as readPinned } from "./readPinned.js";
export { default as resolveImage } from "./resolveImage.js";
export { default as tagLocalBuild } from "./tagLocalBuild.js";
export type { Built, ImageRef, Pinned } from "./types.js";
