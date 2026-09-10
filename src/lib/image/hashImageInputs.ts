import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix } from "node:path";
import { Refusal } from "../contract/index.js";
import { CONTAINERFILE, IMAGES_DIR, PINNED_FILE } from "./constants.js";

/** What a stray install leaves beside a definition, and never an input to it. */
const INSTALLED = "node_modules";

/**
 * Every file under `directory`, as posix paths relative to it, sorted.
 *
 * @note Impure — reads the directory tree under `directory`.
 */
const listFiles = (directory: string, prefix = ""): string[] =>
  readdirSync(directory)
    .sort()
    .flatMap((name) => {
      const path = posix.join(prefix, name);
      if (statSync(join(directory, name)).isDirectory()) {
        return name === INSTALLED ? [] : listFiles(join(directory, name), path);
      }
      return path === PINNED_FILE ? [] : [path];
    });

/**
 * One hash over the files an image is built from, as `sha256:<hex>`.
 *
 * A row pins its image by digest, and a digest answers which image an entry
 * ran in; it cannot answer whether that image is still the one the
 * repository describes, because answering that would mean building the
 * image on every machine that asks — and a definition edited into anything
 * would go on being green until somebody did. Files hash the same on every
 * machine and need no engine, so the definition is pinned by its inputs:
 * every file under the image's directory except the pinned record, which
 * records this hash and cannot be an input to it. Each file's path is
 * hashed before its bytes, because two files exchanging contents are a
 * different tree. An install directory under the definition is skipped:
 * the build reads the lockfile, never it.
 *
 * @note Impure — reads the filesystem under `<root>/images/<name>/`.
 * @throws Refusal when the directory is missing or holds no Containerfile.
 *
 * @package
 */
export default function hashImageInputs(root: string, name: string): string {
  const directory = join(root, IMAGES_DIR, name);
  if (!existsSync(directory) || !statSync(directory).isDirectory()) {
    throw new Refusal(
      `no image directory at ${directory} — an image is defined by the files under \`${IMAGES_DIR}/${name}/\`, and there are none`,
    );
  }
  if (!existsSync(join(directory, CONTAINERFILE))) {
    throw new Refusal(
      `no ${CONTAINERFILE} under ${directory} — a directory without one defines no image`,
    );
  }
  const digest = createHash("sha256");
  for (const file of listFiles(directory)) {
    digest.update(`${file}\n`);
    digest.update(readFileSync(join(directory, file)));
    digest.update("\n");
  }
  return `sha256:${digest.digest("hex")}`;
}
