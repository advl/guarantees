import ts from "typescript";
import hasModifier from "./hasModifier.js";
import type { Checked } from "./types.js";

/**
 * An executable is run, not imported: `bin` names it and nothing re-exports
 * it, so it has no value to publish and no filename to agree with. Any
 * export is a module wearing an executable's place.
 */
export default function checkExecutable({
  source,
  lineOf,
  report,
}: Checked): void {
  for (const statement of source.statements) {
    if (
      hasModifier(statement, ts.SyntaxKind.ExportKeyword) ||
      ts.isExportAssignment(statement) ||
      ts.isExportDeclaration(statement)
    ) {
      report(
        "executable/no-exports",
        `line ${lineOf(statement)}: export in an executable — a file under \`bin/\` or \`scripts/\` is run, never imported, and a value worth importing belongs in \`lib/\``,
      );
    }
  }
}
