import ts from "typescript";
import describeKind from "./describeKind.js";
import type { Checked } from "./types.js";

/**
 * A barrel re-exports at most one level down: a file in its own directory,
 * or a direct child's barrel. Nothing deeper.
 *
 * The rule is what keeps a barrel a table of contents instead of a second,
 * competing module graph. Once `src/index.ts` is allowed to name
 * `./lib/register/parseRegister.js`, the domain it belongs to has no say in
 * its own surface, deleting a file becomes a repository-wide search, and the
 * intermediate `lib/index.ts` that ought to exist never gets written.
 */
const SAME_DIRECTORY = /^\.\/([^./][^/]*)\.js$/;
const CHILD_BARREL = /^\.\/([^./][^/]*)\/index\.js$/;

/**
 * The one sibling whose exports a barrel names rather than aliases. A
 * constants file has no default to alias — it holds uniform named constants
 * by the collection rule — so the barrel takes the names it publishes, as it
 * does from a child's barrel.
 */
const COLLECTION_STEM = "constants";

/** A barrel is pure, curated, and reaches one level down. */
export default function checkBarrel({ source, lineOf, report }: Checked): void {
  for (const statement of source.statements) {
    const line = lineOf(statement);

    if (ts.isImportDeclaration(statement)) {
      report(
        "barrel/no-imports",
        `line ${line}: a barrel imports nothing — a barrel that imports has something to do with the value, and a barrel does nothing`,
      );
      continue;
    }

    if (!ts.isExportDeclaration(statement)) {
      report(
        "barrel/only-re-exports",
        `line ${line}: ${describeKind(statement)} declared in a barrel — a barrel holds re-export statements and no implementation`,
      );
      continue;
    }

    if (!statement.moduleSpecifier) {
      // `export {}` marks an otherwise-empty file as a module. Anything else
      // exported without a source is a local, and a barrel has no locals.
      const clause = statement.exportClause;
      if (clause && ts.isNamedExports(clause) && clause.elements.length === 0) {
        continue;
      }
      report(
        "barrel/only-re-exports",
        `line ${line}: export of a local binding in a barrel — a barrel re-exports from a module, it does not export its own names`,
      );
      continue;
    }

    if (
      !statement.exportClause ||
      ts.isNamespaceExport(statement.exportClause)
    ) {
      report(
        "barrel/no-star",
        `line ${line}: \`export *\` — a barrel is curated, and a star re-export admits whatever the source file happens to hold today`,
      );
      continue;
    }

    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;

    const sibling = SAME_DIRECTORY.exec(specifier);
    const child = CHILD_BARREL.exec(specifier);

    if (!sibling && !child) {
      report(
        "barrel/reach",
        `line ${line}: re-export from "${specifier}" — a barrel reaches one level down, to "./name.js" in its own directory or to "./directory/index.js"`,
      );
      continue;
    }

    const stem = sibling?.[1] ?? child?.[1] ?? "";
    if (stem.startsWith("_")) {
      report(
        "barrel/no-internals",
        `line ${line}: re-export from "${specifier}" — the \`_\` prefix marks a module internal to its directory, and a barrel is where a module stops being internal`,
      );
      continue;
    }

    for (const element of statement.exportClause.elements) {
      const typeOnly = statement.isTypeOnly || element.isTypeOnly;
      if (typeOnly) continue; // a type has no default to re-export
      const exported = element.propertyName?.text ?? element.name.text;

      if (child || stem === COLLECTION_STEM) {
        if (exported === "default") {
          report(
            "barrel/default-alias",
            `line ${line}: re-export of \`default\` from "${specifier}" — ${child ? "a child's barrel" : "a constants file"} has no default; take the names it publishes`,
          );
        } else if (exported.startsWith("_")) {
          report(
            "barrel/no-internals",
            `line ${line}: re-export of \`${exported}\` from "${specifier}" — the \`_\` prefix marks a name internal to its directory, and a barrel is where a name stops being internal`,
          );
        }
        continue;
      }

      if (exported !== "default") {
        report(
          "barrel/default-alias",
          `line ${line}: re-export of \`${exported}\` from "${specifier}" — a file publishes one value, its default; re-export it as \`{ default as ${stem} }\``,
        );
        continue;
      }
      if (element.name.text !== stem) {
        report(
          "barrel/default-alias",
          `line ${line}: default of "${specifier}" re-exported as \`${element.name.text}\` — a value keeps the name of the file that declares it, \`${stem}\``,
        );
      }
    }
  }
}
