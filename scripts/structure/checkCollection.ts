import ts from "typescript";
import describeKind from "./describeKind.js";
import hasModifier from "./hasModifier.js";
import type { Checked } from "./types.js";

/**
 * `types.ts` holds types; `constants.ts` holds constants. Homogeneity is the
 * whole justification for these files existing at all — the moment one grows
 * a function, it is an implementation file wearing a collection's name, and
 * every import of it drags in whatever else it has accumulated.
 */
export default function checkCollection(
  { source, lineOf, report }: Checked,
  stem: string,
): void {
  const typesOnly = stem === "types";
  const rule = typesOnly
    ? "collection/types-only"
    : "collection/constants-only";
  const holds = typesOnly
    ? "type and interface declarations"
    : "`const` declarations";

  for (const statement of source.statements) {
    const line = lineOf(statement);

    if (ts.isImportDeclaration(statement)) continue;

    if (
      ts.isExportAssignment(statement) ||
      hasModifier(statement, ts.SyntaxKind.DefaultKeyword)
    ) {
      report(
        "collection/no-default",
        `line ${line}: default export — a collection file has no single value to be the default; it exports by name`,
      );
      continue;
    }

    if (ts.isExportDeclaration(statement)) continue;

    const lawful = typesOnly
      ? ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement)
      : ts.isVariableStatement(statement) &&
        Boolean(statement.declarationList.flags & ts.NodeFlags.Const);

    if (!lawful) {
      report(
        rule,
        `line ${line}: ${describeKind(statement)} in \`${stem}.ts\` — a ${stem} file holds ${holds} and nothing else`,
      );
    }
  }
}
