import ts from "typescript";
import describeKind from "./describeKind.js";
import hasModifier from "./hasModifier.js";
import type { Checked } from "./types.js";

/**
 * An implementation file exports exactly one value, as `export default` on
 * the definition itself, named after the file; beyond it only the types of
 * that value's signature, by name.
 *
 * A default assembled at the end hides which of the file's names is the one
 * it publishes; a second exported value means the file is two files. The
 * leading underscore is how a module internal to its directory announces
 * itself, and carried by only one of the file and the symbol it announces
 * nothing.
 */
export default function checkImplementation(
  { file, source, lineOf, report }: Checked,
  stem: string,
): void {
  type Default = { readonly name: string | undefined; readonly line: number };
  const defaults: Default[] = [];
  const isExported = (node: ts.Node) =>
    hasModifier(node, ts.SyntaxKind.ExportKeyword);
  const isDefaulted = (node: ts.Node) =>
    hasModifier(node, ts.SyntaxKind.DefaultKeyword);

  for (const statement of source.statements) {
    const line = lineOf(statement);

    // `export default function name` / `export default class Name` — the only
    // lawful shape, because the export is part of the definition.
    if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement)) &&
      isExported(statement) &&
      isDefaulted(statement)
    ) {
      defaults.push({ name: statement.name?.text, line });
      continue;
    }

    // `export default expression` — the gathered-at-the-end form.
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      report(
        "file/default-on-definition",
        `line ${line}: \`export default <expression>\` — declare the export on the definition (\`export default function ${stem}\`) so the file's one value is never assembled somewhere below it`,
      );
      defaults.push({ name: undefined, line });
      continue;
    }

    if (ts.isExportDeclaration(statement)) {
      if (
        !statement.exportClause ||
        ts.isNamespaceExport(statement.exportClause)
      ) {
        report(
          "file/type-only-named-exports",
          `line ${line}: \`export *\` — a file publishes one default and the types of its signature, by name`,
        );
        continue;
      }
      for (const element of statement.exportClause.elements) {
        const typeOnly = statement.isTypeOnly || element.isTypeOnly;
        if (element.name.text === "default") {
          report(
            "file/default-on-definition",
            `line ${line}: \`export { … as default }\` — declare the export on the definition (\`export default function ${stem}\`)`,
          );
          defaults.push({ name: element.propertyName?.text, line });
          continue;
        }
        if (!typeOnly) {
          report(
            "file/type-only-named-exports",
            `line ${line}: named export \`${element.name.text}\` — beyond its default a file exports types only; a second value belongs in its own file`,
          );
        }
      }
      continue;
    }

    if (!isExported(statement)) continue;

    // Exported, not default: lawful only if it is a type.
    if (
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement)
    ) {
      continue;
    }
    const name = ts.isVariableStatement(statement)
      ? statement.declarationList.declarations
          .map((declaration) => declaration.name.getText(source))
          .join(", ")
      : ((ts.isFunctionDeclaration(statement) ||
          ts.isClassDeclaration(statement) ||
          ts.isEnumDeclaration(statement)) &&
          statement.name?.text) ||
        describeKind(statement);
    report(
      "file/type-only-named-exports",
      `line ${line}: exported ${describeKind(statement)} \`${name}\` — a file exports one value, as \`export default\`; beyond it only the types of that value's signature`,
    );
  }

  if (defaults.length === 0) {
    report(
      "file/one-default",
      `no default export — every implementation file publishes exactly one value, \`export default … ${stem}\` (${file})`,
    );
    return;
  }
  if (defaults.length > 1) {
    report(
      "file/one-default",
      `${defaults.length} default exports (lines ${defaults.map((entry) => entry.line).join(", ")}) — a file publishes one value`,
    );
  }

  for (const { name, line } of defaults) {
    if (name === undefined) continue; // already reported as an unlawful shape
    if (name === stem) continue;

    const fileInternal = stem.startsWith("_");
    const symbolInternal = name.startsWith("_");
    if (
      fileInternal !== symbolInternal &&
      name.replace(/^_/, "") === stem.replace(/^_/, "")
    ) {
      report(
        "file/underscore-agreement",
        `line ${line}: file \`${stem}.ts\` exports \`${name}\` — the leading underscore marks a module internal to its directory, and it is carried by the file and the symbol together or by neither`,
      );
      continue;
    }
    report(
      "file/name-matches",
      `line ${line}: file \`${stem}.ts\` exports \`${name}\` — the filename is the exported identifier, casing preserved`,
    );
  }
}
