import { registerSchema } from "../contract/index.js";

/** Where a repository keeps its image definitions, one directory per image, under its root. @package */
export const IMAGES_DIR = "images";

/** The build definition inside an image's directory. @package */
export const CONTAINERFILE = "Containerfile";

/** The record of what an image's directory was last pinned as, beside its Containerfile. @package */
export const PINNED_FILE = "pinned.toml";

/**
 * The shape of a pinned reference, read from the register schema's image
 * column so a pinned record and a row name an image by one rule.
 *
 * @package
 */
export const REFERENCE_PATTERN = new RegExp(registerSchema.$defs.image.pattern);

/** The shape of an inputs hash, and of a digest without its name. @package */
export const INPUTS_PATTERN = /^sha256:[0-9a-f]{64}$/;
