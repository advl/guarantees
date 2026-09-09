import { registerSchema } from "../contract/index.js";

/** Where a repository keeps its image definitions, one directory per image, under its root. @package */
export const IMAGES_DIR = "images";

/** The build definition inside an image's directory. @package */
export const CONTAINERFILE = "Containerfile";

/** The record of what an image's directory was last pinned as, beside its Containerfile. @package */
export const PINNED_FILE = "pinned.toml";

/**
 * What a build of this repository's own image is named on the machine that
 * built it, before the name of the directory it is defined in. It is a
 * local name and never the published one: what the rows pin is pushed by
 * the pipeline under a name that job owns, and a build here is only ever
 * asked whether the definition still builds and what it hashes to.
 * Spelled here because the command that builds and the suite that builds
 * under a tag of its own would otherwise be two spellings of one
 * convention.
 *
 * @package
 */
export const LOCAL_PREFIX = "localhost/guarantees";

/** The image directory a command means when it is given no name. @package */
export const DEFAULT_IMAGE = "ts";

/**
 * The shape of a pinned reference, read from the register schema's image
 * column so a pinned record and a row name an image by one rule.
 *
 * @package
 */
export const REFERENCE_PATTERN = new RegExp(registerSchema.$defs.image.pattern);

/** The shape of an inputs hash, and of a digest without its name. @package */
export const INPUTS_PATTERN = /^sha256:[0-9a-f]{64}$/;
