import ts from "typescript";

/** Whether a declaration carries the given modifier keyword. */
export default function hasModifier(
  node: ts.Node,
  kind: ts.SyntaxKind,
): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === kind)
  );
}
