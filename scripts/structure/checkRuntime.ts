import ts from "typescript";
import type { Checked } from "./types.js";

/**
 * The package runs under Node. A reach for `Bun` fails the type check only
 * while nothing declares the global; the first ambient declaration to arrive
 * with a dependency would let it through, and it would then fail where the
 * code executes, at the moment it is called.
 */
export default function checkRuntime({
  source,
  lineOf,
  report,
}: Checked): void {
  const visit = (node: ts.Node) => {
    if (
      ts.isIdentifier(node) &&
      node.text === "Bun" &&
      !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)
    ) {
      report(
        "runtime/node-only",
        `line ${lineOf(node)}: \`Bun\` — the package runs under Node, and the global does not exist where this code executes`,
      );
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
