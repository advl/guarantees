import { basename, dirname, posix, relative } from "node:path";
import ts from "typescript";
import type { Checked, Package } from "./types.js";

/**
 * A specifier is what the tarball carries verbatim: the build is plain
 * `tsc`, which leaves every specifier as written, so a `#` alias or an
 * extensionless relative path that resolves here resolves nowhere for a
 * consumer. And a specifier that leaves its own directory lands on that
 * directory's barrel, because the barrel is where a directory decides its
 * surface; a path reaching past it makes every file in the directory public
 * whether its barrel names it or not.
 *
 * The reach rules are lifted for a test, which may import the package under
 * its own name because the built `exports` map is one of the things it
 * proves, and may reach its fixtures wherever they live.
 */
export default function checkSpecifiers(
  { file, source, lineOf, report }: Checked,
  pkg: Package,
  reachRulesApply: boolean,
): void {
  for (const statement of source.statements) {
    const specifier =
      ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)
        ? statement.moduleSpecifier
        : undefined;
    if (!specifier || !ts.isStringLiteral(specifier)) continue;
    const text = specifier.text;
    const line = lineOf(statement);

    if (text.startsWith("#")) {
      report(
        "specifier/no-alias",
        `line ${line}: "${text}" — a \`#\` alias is emitted verbatim into \`dist/\`, where nothing resolves it; write the relative path`,
      );
      continue;
    }

    if (!text.startsWith(".")) {
      if (
        reachRulesApply &&
        (text === pkg.name || text.startsWith(`${pkg.name}/`))
      ) {
        report(
          "specifier/no-self-reference",
          `line ${line}: "${text}" — a module imports its own package by relative path; the bare name resolves into \`dist/\`, which is the previous build`,
        );
      }
      continue;
    }

    if (!text.endsWith(".js")) {
      report(
        "specifier/js-extension",
        `line ${line}: "${text}" — a relative specifier names the emitted file, with its \`.js\` extension; without it the import resolves here and fails in a consumer`,
      );
      continue;
    }

    if (!reachRulesApply) continue;

    const target = posix.normalize(posix.join(dirname(file), text));
    const targetDirectory = dirname(target);
    if (targetDirectory === dirname(file)) continue;

    if (basename(target) !== "index.js") {
      report(
        "specifier/reach",
        `line ${line}: "${text}" — an import that leaves its own directory lands on that directory's \`index.js\`; siblings are imported by path, everything else through a barrel`,
      );
      continue;
    }

    const crossed = relative(dirname(file), targetDirectory).split("/");
    if (crossed.some((segment) => segment.startsWith("_"))) {
      report(
        "specifier/no-internals",
        `line ${line}: "${text}" — a \`_\`-prefixed directory is internal to the directory that holds it, and nothing outside reaches into it`,
      );
    }
  }
}
