import ts from "typescript";

/** What a declaration is called, in the words the language uses for it. */
export default function describeKind(node: ts.Node): string {
  if (ts.isFunctionDeclaration(node)) return "function";
  if (ts.isClassDeclaration(node)) return "class";
  if (ts.isInterfaceDeclaration(node)) return "interface";
  if (ts.isTypeAliasDeclaration(node)) return "type alias";
  if (ts.isEnumDeclaration(node)) return "enum";
  if (ts.isModuleDeclaration(node)) return "namespace";
  if (ts.isVariableStatement(node)) {
    const flags = node.declarationList.flags;
    if (flags & ts.NodeFlags.Const) return "const";
    if (flags & ts.NodeFlags.Let) return "let";
    return "var";
  }
  return ts.SyntaxKind[node.kind];
}
