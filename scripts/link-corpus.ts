/**
 * Links this package into its own corpus's install, which is the whole of
 * what that corpus installs.
 *
 * A corpus reaches the package the way a consumer does, through its
 * `exports` map, so it needs the package under its own `node_modules` — the
 * one directory a run deliberately leaves visible, since the repository's
 * own install is covered inside the image. Everything else an entry
 * resolves comes from the image, and that is exactly what the toolchain
 * guarantee pins.
 *
 * It is a link and not an install for that reason. Installing the parent by
 * path brings the parent's own dependencies into the corpus's install, and
 * every one of them is a package the image already carries at a pinned
 * version — so the corpus would resolve its toolchain from the checkout,
 * which is the fault the mask and the toolchain guarantee exist to refuse,
 * and the guarantee would go red on the arrangement meant to support it.
 *
 * The link is relative, so it resolves to the same place inside the
 * container as on the host: the repository is mounted at a different path
 * there, and an absolute link would point at a directory that is not in the
 * mount at all.
 *
 * @note Impure — writes a link under the corpus's `node_modules`.
 */
import { mkdirSync, rmSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const scope = join(root, "guarantees", "node_modules", "@aztlan");
const link = join(scope, "guarantees");

mkdirSync(scope, { recursive: true });
rmSync(link, { recursive: true, force: true });
symlinkSync("../../..", link, "dir");

console.log(
  "install:corpus — the corpus resolves this package through its own install",
);
