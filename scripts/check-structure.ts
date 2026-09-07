/**
 * Fails if any file under `src/` breaks the structure law this package is
 * built on.
 *
 * The law in one breath: `src/` holds a closed set of members; a folder is
 * named for its subject, never for a property of the code; a file exports
 * one value, named after the file, declared on the definition itself;
 * collections of types or constants are the only files that export by name;
 * every barrel is pure, curated, and reaches one level down; an executable
 * exports nothing; a module never captures the environment at import time; a
 * specifier is relative, ends in `.js`, and crosses into another directory
 * only through that directory's barrel; and nothing reaches for a Bun
 * global, because the package runs under Node.
 *
 * Every clause is mechanical, and none is expressible in a type system —
 * `tsc` is happy with a file exporting nine values under six names, with a
 * barrel that re-exports from four directories down, with a `#` alias it
 * emits verbatim into a tarball no consumer can resolve, and with a
 * module-level `const isDev = process.env.NODE_ENV !== "production"` that
 * freezes the answer at import. A convention nothing enforces decays one
 * hurried file at a time, so it is enforced here.
 *
 * Parsing goes through the TypeScript compiler API rather than through
 * regular expressions: which declaration carries the `default` modifier,
 * whether an export clause is type-only, what an initializer reads are
 * questions about syntax, and a grep answers them only until the first
 * multi-line export clause or the first `default` inside a string.
 *
 * @note Impure — reads the filesystem.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, posix, relative, resolve } from "node:path";
import ts from "typescript";
import {
  type Checked,
  COLLECTIONS,
  checkBarrel,
  checkCallTimeReads,
  checkCollection,
  checkDocumentation,
  checkExecutable,
  checkImplementation,
  checkMembers,
  checkRuntime,
  checkSpecifiers,
  EXECUTABLES,
  FILE_SIZE_THRESHOLD,
  type Package,
  type Violation,
} from "./structure/index.js";

const root = resolve(import.meta.dirname, "..");
const SRC = "src";

const manifest = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf8"),
) as { readonly name: string; readonly exports?: Record<string, unknown> };

const pkg: Package = {
  name: manifest.name,
  entryModules: new Set([
    "index.ts",
    ...Object.keys(manifest.exports ?? {})
      .filter((subpath) => /^\.\/[a-z][a-z0-9-]*$/.test(subpath))
      .map((subpath) => `${subpath.slice(2)}.ts`),
  ]),
};

/**
 * Test files are exempt from the export law and from the reach rules. A test
 * is not part of the exported surface: it declares fixtures, spies and
 * helpers by the dozen, exports none of them, is named after the thing it
 * tests, and may import the package under its own name, because the built
 * `exports` map is one of the things it proves.
 */
const isTest = (file: string) => file.endsWith(".test.ts");

const isDirectory = (path: string) =>
  statSync(resolve(root, path)).isDirectory();

/** Every path under a directory, files and directories, depth first. */
const walk = (directory: string): string[] => {
  const entries: string[] = [];
  for (const name of readdirSync(resolve(root, directory)).sort()) {
    const path = posix.join(directory, name);
    entries.push(path);
    if (isDirectory(path)) entries.push(...walk(path));
  }
  return entries;
};

const violations: Violation[] = [];

/** A parsed file built from a string, with every report collected. */
const parsed = (file: string, text: string) => {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS,
  );
  const reported: Violation[] = [];
  const checked: Checked = {
    file,
    text,
    source,
    lineOf: (node) =>
      source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
    report: (rule, message) => {
      reported.push({ file, rule, message });
    },
  };
  return { checked, reported };
};

// A clause that reports nothing describes a clean tree, which is
// indistinguishable from a clause that is silently broken — and a gate is
// only worth its runtime if it has been seen to fail. So every clause is
// first run against a source built to violate it, and nothing is scanned
// until all of them have.
const probes: readonly {
  readonly rule: string;
  readonly run: () => Violation[];
}[] = [
  {
    rule: "src/closed-set",
    run: () => {
      const reported: Violation[] = [];
      checkMembers(
        ["src/stray.ts"],
        () => false,
        pkg,
        (file, rule, message) => {
          reported.push({ file, rule, message });
        },
      );
      return reported;
    },
  },
  {
    rule: "folder/subject-not-property",
    run: () => {
      const reported: Violation[] = [];
      checkMembers(
        ["src/lib/utils"],
        () => true,
        pkg,
        (file, rule, message) => {
          reported.push({ file, rule, message });
        },
      );
      return reported;
    },
  },
  {
    rule: "barrel/no-star",
    run: () => {
      const { checked, reported } = parsed(
        "index.ts",
        `export * from "./a.js";`,
      );
      checkBarrel(checked);
      return reported;
    },
  },
  {
    rule: "file/one-default",
    run: () => {
      const { checked, reported } = parsed("a.ts", "export const a = 1;");
      checkImplementation(checked, "a");
      return reported;
    },
  },
  {
    rule: "executable/no-exports",
    run: () => {
      const { checked, reported } = parsed("a.ts", "export const a = 1;");
      checkExecutable(checked);
      return reported;
    },
  },
  {
    rule: "collection/no-default",
    run: () => {
      const { checked, reported } = parsed("types.ts", "export default 1;");
      checkCollection(checked, "types");
      return reported;
    },
  },
  {
    rule: "specifier/js-extension",
    run: () => {
      const { checked, reported } = parsed("a.ts", `import a from "./a";`);
      checkSpecifiers(checked, pkg, true);
      return reported;
    },
  },
  {
    rule: "runtime/node-only",
    run: () => {
      const { checked, reported } = parsed("a.ts", `Bun.file("a");`);
      checkRuntime(checked);
      return reported;
    },
  },
  {
    rule: "runtime/call-time-env",
    run: () => {
      const { checked, reported } = parsed("a.ts", "const m = process.env.M;");
      checkCallTimeReads(checked);
      return reported;
    },
  },
  {
    rule: "docs/module-tag-on-barrels",
    run: () => {
      const { checked, reported } = parsed("a.ts", "/** @module */");
      checkDocumentation(checked, false);
      return reported;
    },
  },
  {
    rule: "docs/size-justified",
    run: () => {
      const { checked, reported } = parsed(
        "a.ts",
        "\n".repeat(FILE_SIZE_THRESHOLD),
      );
      checkDocumentation(checked, false);
      return reported;
    },
  },
  {
    rule: "barrel/no-imports",
    run: () => {
      const { checked, reported } = parsed(
        "index.ts",
        `import a from "./a.js";`,
      );
      checkBarrel(checked);
      return reported;
    },
  },
  {
    rule: "barrel/only-re-exports",
    run: () => {
      const { checked, reported } = parsed("index.ts", "const a = 1;");
      checkBarrel(checked);
      return reported;
    },
  },
  {
    rule: "barrel/reach",
    run: () => {
      const { checked, reported } = parsed(
        "index.ts",
        `export { default as a } from "./b/c/a.js";`,
      );
      checkBarrel(checked);
      return reported;
    },
  },
  {
    rule: "barrel/no-internals",
    run: () => {
      const { checked, reported } = parsed(
        "index.ts",
        `export { default as _a } from "./_a.js";`,
      );
      checkBarrel(checked);
      return reported;
    },
  },
  {
    rule: "barrel/default-alias",
    run: () => {
      const { checked, reported } = parsed(
        "index.ts",
        `export { a } from "./a.js";`,
      );
      checkBarrel(checked);
      return reported;
    },
  },
  {
    rule: "barrel/default-alias",
    run: () => {
      const { checked, reported } = parsed(
        "index.ts",
        `export { default as constants } from "./constants.js";`,
      );
      checkBarrel(checked);
      return reported;
    },
  },
  {
    rule: "barrel/no-internals",
    run: () => {
      const { checked, reported } = parsed(
        "index.ts",
        `export { _A } from "./constants.js";`,
      );
      checkBarrel(checked);
      return reported;
    },
  },
  {
    rule: "file/default-on-definition",
    run: () => {
      const { checked, reported } = parsed(
        "a.ts",
        "const a = 1;\nexport default a;",
      );
      checkImplementation(checked, "a");
      return reported;
    },
  },
  {
    rule: "file/type-only-named-exports",
    run: () => {
      const { checked, reported } = parsed(
        "a.ts",
        "export default function a() {}\nexport const b = 1;",
      );
      checkImplementation(checked, "a");
      return reported;
    },
  },
  {
    rule: "file/name-matches",
    run: () => {
      const { checked, reported } = parsed(
        "a.ts",
        "export default function b() {}",
      );
      checkImplementation(checked, "a");
      return reported;
    },
  },
  {
    rule: "file/underscore-agreement",
    run: () => {
      const { checked, reported } = parsed(
        "_a.ts",
        "export default function a() {}",
      );
      checkImplementation(checked, "_a");
      return reported;
    },
  },
  {
    rule: "collection/types-only",
    run: () => {
      const { checked, reported } = parsed("types.ts", "export const a = 1;");
      checkCollection(checked, "types");
      return reported;
    },
  },
  {
    rule: "collection/constants-only",
    run: () => {
      const { checked, reported } = parsed(
        "constants.ts",
        "export function a() {}",
      );
      checkCollection(checked, "constants");
      return reported;
    },
  },
  {
    rule: "specifier/no-alias",
    run: () => {
      const { checked, reported } = parsed("a.ts", `import a from "#a";`);
      checkSpecifiers(checked, pkg, true);
      return reported;
    },
  },
  {
    rule: "specifier/no-self-reference",
    run: () => {
      const { checked, reported } = parsed(
        "a.ts",
        `import a from "${pkg.name}";`,
      );
      checkSpecifiers(checked, pkg, true);
      return reported;
    },
  },
  {
    rule: "specifier/reach",
    run: () => {
      const { checked, reported } = parsed("a.ts", `import a from "./b/c.js";`);
      checkSpecifiers(checked, pkg, true);
      return reported;
    },
  },
  {
    rule: "specifier/no-internals",
    run: () => {
      const { checked, reported } = parsed(
        "a.ts",
        `import a from "./_b/index.js";`,
      );
      checkSpecifiers(checked, pkg, true);
      return reported;
    },
  },
];

const unproven = probes.filter(
  ({ rule, run }) => !run().some((violation) => violation.rule === rule),
);
if (unproven.length > 0) {
  console.error(
    "check:structure selftest failed — these clauses report nothing:\n",
  );
  for (const { rule } of unproven) console.error(`  ${rule}`);
  process.exit(1);
}

const entries = walk(SRC);

checkMembers(entries, isDirectory, pkg, (file, rule, message) => {
  violations.push({ file, rule, message });
});

const files = entries.filter((path) => path.endsWith(".ts"));

for (const file of files) {
  const text = readFileSync(resolve(root, file), "utf8");
  const { checked, reported } = parsed(file, text);
  const name = basename(file);
  const stem = name.slice(0, -".ts".length);
  const member = (relative(SRC, file).split("/")[0] ?? "").replace(/^_/, "");
  const isBarrel =
    name === "index.ts" ||
    (dirname(file) === SRC && pkg.entryModules.has(name));
  const test = isTest(file);

  checkRuntime(checked);
  checkSpecifiers(checked, pkg, !test);
  if (!test) {
    checkCallTimeReads(checked);
    checkDocumentation(checked, isBarrel);
    if (isBarrel) {
      checkBarrel(checked);
    } else if (EXECUTABLES.has(member)) {
      checkExecutable(checked);
    } else if (COLLECTIONS.has(name)) {
      checkCollection(checked, stem);
    } else {
      checkImplementation(checked, stem);
    }
  }
  violations.push(...reported);
}

if (violations.length > 0) {
  console.error("Files breaking the structure law:\n");
  let current = "";
  for (const { file, rule, message } of violations) {
    if (file !== current) {
      console.error(`  ${file}`);
      current = file;
    }
    console.error(`    ${rule}: ${message}`);
  }
  console.error(
    "\n`src/` holds a closed set of members. A file exports one value, as `export default`",
  );
  console.error(
    "on the definition, named after the file; types and constants collect in `types.ts`",
  );
  console.error(
    "and `constants.ts`, by name; every barrel is pure and reaches one level down; an",
  );
  console.error(
    "executable exports nothing. Specifiers are relative, end in `.js`, and cross into a",
  );
  console.error(
    "directory only through its barrel. Nothing captures the environment at import, and",
  );
  console.error(
    "nothing reaches for a Bun global: the package runs under Node.",
  );
  process.exit(1);
}

console.log(`check:structure — ${files.length} files clean`);
