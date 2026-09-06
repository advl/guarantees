import ts from "typescript";
import { ENV_HOSTS } from "./constants.js";
import type { Checked } from "./types.js";

/** `process`, `Bun`, `Deno`, `globalThis.process`, `import.meta`. */
const isEnvironmentHost = (node: ts.Expression): boolean => {
  if (ts.isIdentifier(node)) return ENV_HOSTS.has(node.text);
  if (ts.isMetaProperty(node)) return true;
  if (ts.isPropertyAccessExpression(node)) return ENV_HOSTS.has(node.name.text);
  return false;
};

const readsEnvironment = (node: ts.Node): boolean => {
  let found = false;
  const visit = (current: ts.Node) => {
    if (found) return;
    if (
      ts.isPropertyAccessExpression(current) &&
      current.name.text === "env" &&
      isEnvironmentHost(current.expression)
    ) {
      found = true;
      return;
    }
    if (
      ts.isElementAccessExpression(current) &&
      ts.isStringLiteralLike(current.argumentExpression) &&
      current.argumentExpression.text === "env" &&
      isEnvironmentHost(current.expression)
    ) {
      found = true;
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
};

const isFunctionLike = (node: ts.Node) =>
  ts.isArrowFunction(node) ||
  ts.isFunctionExpression(node) ||
  ts.isClassExpression(node);

/**
 * A mode predicate reads its source when it is asked, every time. A
 * module-level constant answers once, at import, and then answers the same
 * way forever — which is why a test that sets the variable and re-runs the
 * code sees no change, and why the branch not taken at import is
 * unreachable and untestable for the rest of the module's life. There is no
 * hot-path exception: a property read is not the cost anyone is paying.
 *
 * A constant holding a *function* that reads the environment is exactly the
 * lawful shape, so an initializer that is itself a function is left alone.
 */
export default function checkCallTimeReads({
  source,
  lineOf,
  report,
}: Checked): void {
  // One hop of resolution inside the file: `const isDev = readMode();` hides
  // the capture behind a name, and hiding it does not make it call-time.
  const localFunctions = new Map<string, ts.Node>();
  for (const statement of source.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name &&
      statement.body
    ) {
      localFunctions.set(statement.name.text, statement.body);
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.initializer &&
          isFunctionLike(declaration.initializer)
        ) {
          localFunctions.set(declaration.name.text, declaration.initializer);
        }
      }
    }
  }

  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const initializer = declaration.initializer;
      if (!initializer || isFunctionLike(initializer)) continue;

      let captured = readsEnvironment(initializer);
      if (
        !captured &&
        ts.isCallExpression(initializer) &&
        ts.isIdentifier(initializer.expression)
      ) {
        const body = localFunctions.get(initializer.expression.text);
        captured = Boolean(body && readsEnvironment(body));
      }
      if (!captured) continue;

      const name = ts.isIdentifier(declaration.name)
        ? declaration.name.text
        : "binding";
      report(
        "runtime/call-time-env",
        `line ${lineOf(declaration)}: module-level \`${name}\` captures the environment at import — read it inside the function that needs the answer, so the answer is current every time it is asked`,
      );
    }
  }
}
