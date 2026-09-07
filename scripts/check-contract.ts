/**
 * Fails if the committed schema files under `contract/` differ from what the
 * `contract` domain declares.
 *
 * It runs after `build`, which has already emitted a fresh set over the
 * committed one, so the question is whether git sees a change: a modified
 * file is a schema whose source moved without its file, and an untracked one
 * is a schema whose file was never committed. Either way a consumer in
 * another language would be reading a contract this package no longer
 * implements. The check reads git rather than the filesystem on purpose — an
 * emission that has not been committed is exactly the state it refuses.
 *
 * @note Impure — shells out to git.
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

const status = execFileSync(
  "git",
  ["status", "--porcelain", "--", "contract"],
  { cwd: root, encoding: "utf8" },
);

const changed = status.split("\n").filter((line) => line !== "");

if (changed.length > 0) {
  console.error("Schema files that differ from the contract domain:\n");
  for (const line of changed) console.error(`  ${line}`);
  console.error(
    "\n`bun run build:contract` has re-emitted `contract/` from `src/lib/contract`;",
  );
  console.error(
    "commit the emitted files together with the source that changed them.",
  );
  process.exit(1);
}

console.log("check:contract — contract/ matches its source");
