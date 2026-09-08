import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { Refusal } from "../contract/index.js";
import { type Spawn, spawnProcess } from "../process/index.js";
import { UNMEASURED_S } from "../register/index.js";

/**
 * Where the runner keeps its executable, read from its own manifest.
 *
 * @note Impure — resolves the runner from the corpus's `node_modules` and
 * reads its manifest.
 */
const locateRunner = (corpusRoot: string): string => {
  const require = createRequire(join(corpusRoot, "package.json"));
  let manifest: string;
  try {
    manifest = require.resolve("vitest/package.json");
  } catch {
    throw new Refusal(
      `the corpus at ${corpusRoot} does not resolve vitest — the runner the register's files are collected by is the corpus's own, and this package carries none to stand in for it`,
    );
  }
  const { bin } = JSON.parse(readFileSync(manifest, "utf8")) as {
    readonly bin?: string | Readonly<Record<string, string>>;
  };
  const executable = typeof bin === "string" ? bin : bin?.vitest;
  if (executable === undefined) {
    throw new Refusal(
      `the vitest resolved from ${corpusRoot} declares no executable in its manifest, so there is nothing to ask what it would collect`,
    );
  }
  return resolve(dirname(manifest), executable);
};

/**
 * The files the runner would collect for a corpus, relative to the corpus
 * root and sorted, by asking the corpus's own runner in its list mode. The
 * bijection compares the register against this list in both directions,
 * rather than against a second scan of the tree with its own idea of what is
 * excluded; the runner's answer is the only one the runner is bound by.
 *
 * A corpus without the runner installed is a refusal naming it, never a
 * fall-through to this package's copy: the corpus's runner is the one its
 * entries execute under, and a list produced by another would be a claim
 * about another corpus. The runner runs under the deadline on everything
 * outside a measured window, and one that has not answered in that long is
 * refused as such rather than as one that exited on a signal, because the
 * two are different faults with different remedies.
 *
 * @note Impure — spawns the runner on the host, from the corpus root.
 * @throws Refusal when the runner cannot be resolved from the corpus, does
 * not return within the unmeasured deadline, exits non-zero, or prints
 * anything but a list of files.
 *
 * @package
 */
export default async function listCollected(
  corpusRoot: string,
  spawn: Spawn = spawnProcess,
): Promise<readonly string[]> {
  const runner = locateRunner(corpusRoot);
  const ran = await spawn(
    "node",
    [runner, "list", "--filesOnly", "--json", "--root", corpusRoot],
    { cwd: corpusRoot, deadlineMs: UNMEASURED_S * 1000, capture: true },
  );
  if (ran.killed) {
    throw new Refusal(
      `the runner did not return within ${UNMEASURED_S}s listing the corpus at ${corpusRoot}, so what it would collect is unknown`,
    );
  }
  if (ran.code !== 0) {
    throw new Refusal(
      `the runner exited ${ran.code === null ? "on a signal" : ran.code} listing the corpus at ${corpusRoot}, so what it would collect is unknown`,
    );
  }
  let listed: unknown;
  try {
    listed = JSON.parse(ran.out);
  } catch {
    throw new Refusal(
      "the runner's list is not JSON — its list mode printed something else, and a list guessed from it would be a claim the runner never made",
    );
  }
  if (!Array.isArray(listed)) {
    throw new Refusal("the runner's list is not a list");
  }
  const files = listed.map((entry: unknown, index) => {
    const file =
      typeof entry === "object" && entry !== null && "file" in entry
        ? entry.file
        : undefined;
    if (typeof file !== "string") {
      throw new Refusal(
        `the runner's list names no file at index ${index} — every entry carries a \`file\` and this one does not`,
      );
    }
    return isAbsolute(file) ? relative(corpusRoot, file) : file;
  });
  return files.sort();
}
