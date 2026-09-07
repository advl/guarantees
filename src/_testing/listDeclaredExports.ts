import { readFileSync } from "node:fs";
import ts from "typescript";

/**
 * The names a declaration file re-exports, sorted, each type-only name
 * prefixed `type `. A module namespace at runtime holds values only, so a
 * pin over `Object.keys` cannot see a type leave or arrive; this reads the
 * built declaration file instead, which is where a consumer's compiler
 * reads the surface from.
 *
 * @note Impure — reads the filesystem.
 */
export default function listDeclaredExports(path: string): readonly string[] {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
  );
  const names = source.statements.flatMap((statement) => {
    if (!ts.isExportDeclaration(statement)) return [];
    const clause = statement.exportClause;
    if (clause === undefined || !ts.isNamedExports(clause)) return [];
    return clause.elements.map(
      (element) =>
        `${statement.isTypeOnly || element.isTypeOnly ? "type " : ""}${element.name.text}`,
    );
  });
  return names.sort();
}
