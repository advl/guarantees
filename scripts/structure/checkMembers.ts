import { basename, dirname } from "node:path";
import { MEMBERS, PROPERTY_FOLDERS } from "./constants.js";
import type { Package } from "./types.js";

type Report = (path: string, rule: string, message: string) => void;

/**
 * The tree: `src/` holds a closed set of members, and every folder below is
 * named for its subject.
 *
 * The members are the complete answer to who consumes this and when —
 * shipped-and-imported, shipped-and-executed, shipped-on-request, never
 * shipped — so a member of another kind is a decision, not a drop-in. A
 * folder named for a property of its code places nothing: a stranger reading
 * the folder list cannot put a new file in exactly one of them.
 */
export default function checkMembers(
  paths: readonly string[],
  isDirectory: (path: string) => boolean,
  pkg: Package,
  report: Report,
): void {
  const own = pkg.name.split("/").at(-1) ?? pkg.name;

  for (const path of paths) {
    const name = basename(path);
    const atTop = dirname(path) === "src";

    if (atTop && isDirectory(path)) {
      if (!MEMBERS.has(name.replace(/^_/, ""))) {
        report(
          path,
          "src/closed-set",
          `directory \`${name}\` directly under \`src/\` — the members are ${[...MEMBERS].join(", ")}, each optionally \`_\`-prefixed for its never-shipped counterpart; a member of another kind is a decision, not a drop-in`,
        );
      }
      continue;
    }

    if (atTop) {
      const stem = name.replace(/\.test\.ts$/, ".ts");
      if (!pkg.entryModules.has(stem)) {
        report(
          path,
          "src/closed-set",
          `file \`${name}\` directly under \`src/\` — beside the members, \`src/\` holds the package index, one entry module per published subpath, and their tests`,
        );
      }
      continue;
    }

    if (!isDirectory(path)) continue;

    if (PROPERTY_FOLDERS.has(name.replace(/^_/, ""))) {
      report(
        path,
        "folder/subject-not-property",
        `directory \`${name}\` — a folder is named for what its files are about, never for a property of the code: not visibility, shape, part of speech or layer`,
      );
    }
    if (name === own) {
      report(
        path,
        "folder/subject-not-property",
        `directory \`${name}\` — a domain named after its own package places nothing; every folder in the package is about ${own}`,
      );
    }
    if (/-?v\d+$/.test(name)) {
      report(
        path,
        "folder/subject-not-property",
        `directory \`${name}\` — a version suffix is a property of the code's history, not a subject`,
      );
    }
  }
}
