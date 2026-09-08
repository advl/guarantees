import ts from "typescript";
import hasModifier from "./hasModifier.js";
import type { Checked } from "./types.js";

/** The names a file exports: its default's own name, and every named type or constant. */
const exportedNames = (source: ts.SourceFile) =>
  source.statements.flatMap((statement) => {
    if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) return [];
    if (ts.isVariableStatement(statement)) {
      return statement.declarationList.declarations.map((declaration) => ({
        name: declaration.name.getText(source),
        statement,
      }));
    }
    const name =
      ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement)
        ? statement.name?.text
        : undefined;
    return name === undefined ? [] : [{ name, statement }];
  });

/**
 * A name the lib barrel mints and no entry module admits is internal to the
 * package, and its definition says so with `@package`; a name an entry
 * module admits carries no such tag. The entry modules are the published
 * surface and the lib barrel is where every domain's names meet before the
 * entry modules choose among them, so the two lists are the whole
 * distinction between contract and scaffolding; without the tag a reader
 * of a module cannot tell which side of it they are on, and a promotion or
 * a demotion moves a name between the lists with nothing on the definition
 * changing. A definition is matched to the lists by its own name, which is
 * the name a barrel re-exports it under.
 */
export default function checkVisibility(
  { source, lineOf, report }: Checked,
  minted: ReadonlySet<string>,
  admitted: ReadonlySet<string>,
): void {
  for (const { name, statement } of exportedNames(source)) {
    if (!minted.has(name)) continue;
    const tagged = ts
      .getJSDocTags(statement)
      .some((tag) => tag.tagName.text === "package");
    if (admitted.has(name) && tagged) {
      report(
        "visibility/admitted-untagged",
        `line ${lineOf(statement)}: \`${name}\` carries \`@package\` and an entry module admits it — a name is contract or internal, and the tag says internal`,
      );
    } else if (!admitted.has(name) && !tagged) {
      report(
        "visibility/package-tag",
        `line ${lineOf(statement)}: \`${name}\` is minted by the lib barrel and admitted by no entry module — its definition carries \`@package\`, so a reader knows it is internal to the package`,
      );
    }
  }
}
