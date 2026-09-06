# AGENTS.md

Instructions for whoever works on this repository. Everything here is true at the commit that carries it.

## Commands

`bun run` is the task face: every gate is a script in `package.json`, and the pipeline runs those scripts and nothing else.

| Command | What it does |
|---|---|
| `bun install` | Installs the toolchain. The lockfile is `bun.lock`; the pipeline installs with `--frozen-lockfile`. |
| `bun run build` | `tsc -p tsconfig.build.json` into `dist/`: modules under `dist/esm`, declarations under `dist/types`. |
| `bun run check` | `build`, then `check:biome` (format and lint over `scripts`, `src`, `vitest.config.ts` and the root JSON files), then `check:ts` (`tsc --noEmit` over everything `tsconfig.json` includes), then `check:leakage`. |
| `bun run check:fix` | The formatter and its safe fixes applied, then the type check. |
| `bun run test` | `vitest run` over `src/**/*.test.ts`. |
| `bun run test:coverage` | The same suite under v8 coverage, with a 100% floor on statements, branches, functions and lines over `src/`. |
| `bun run ci` | `check`, then `test:coverage`. The one target the pipeline names; run it before opening a pull request. |

`check` begins with `build` because the type check reads `dist/`: the suite imports the package under its own name, which resolves through the `exports` map into `dist/`, and `check:ts` resolves that import the same way. `check` is therefore green on a fresh clone, `ci` builds once, and `test` on a clean tree needs a `build` or a `check` before it.

`check:leakage` refuses any file a commit from this tree would contain that encodes a home path, a local account name, a machine name, a personal e-mail address, a tracker identifier, a decision-record or ruling identifier, a session code, a standards-corpus reference or a path into a planning repository; a word that places this code in relation to some other code or marks it as unfinished; any markdown paragraph broken across lines; and any root entry, hidden directory or capitalised document the gate does not declare. Its identity patterns are derived at runtime, so the gate carries no personal data; its path rules are inventories of what the repository is made of, so adding a root file means declaring it in `scripts/check-leakage.ts` in the same commit. The gate proves itself before it scans: every rule is first run against an input built to violate it, and the gate exits non-zero if any rule stays silent, because a gate that has never been seen to fail is not evidence.

The pipeline is `.github/workflows/ci.yml`. Its gate job installs with the lockfile frozen and runs `bun run ci`, so what the pipeline enforces is decided in the manifest, not in the workflow. One gate has no local face: a second job runs `gitleaks` over the full commit history, which is why its checkout is `fetch-depth: 0` — a requirement, not an optimisation, since a shallow clone would scan nothing.

## Conventions

- Licence MIT, author `advl`, declared in the manifest and carried in `LICENSE`.
- Every commit is signed. Subjects are Conventional Commits, lowercase, with no scope for a repository-wide concern; bodies say why, never what the diff already shows.
- Pull request titles are Conventional Commits too, and `.github/workflows/pr-lint.yml` enforces it: merges are squash-only and take the title as the subject that lands on main. `.github/PULL_REQUEST_TEMPLATE.md` is the body's shape.
- Branches are `<type>/<slug>`, the type a conventional-commit type matching the subject the merge lands with. Never a tracker identifier.
- Prose flows: markdown and commit bodies use one paragraph per line and are never hard-wrapped, because a wrapped phrase is unfindable by grep and rewraps into diff noise the moment a word changes. Comments are code and wrap by hand at the formatter's line width, like the lines around them. `check:leakage` refuses a markdown paragraph broken across lines.
- Nothing in this repository points outward. No tracker identifier, session code, decision-record identifier or path into another repository, in source, comments, commits or documentation; `check:leakage` refuses each of these shapes. Where a decision has a rationale worth keeping, the rationale is written in full where it applies.
- Committed text describes this code as what it is: never in relation to some other code it stands in for, and never as unfinished. `check:leakage` refuses the words that do either, in source, comments and documentation alike.
- Fixtures use reserved-neutral names: `example.com`, `@example/*`.
- A comment explains a hazard. Code that reads as what it does carries none.
- Tests are colocated: `<module>.test.ts` beside `<module>.ts`. An `it` names what a caller can observe, never a mechanism; if the implementation were swapped for a different correct one, the sentence still reads as true.
- Coverage is a floor, not a target. Behaviour lands with the tests that pin it, and the fill comes after; a suite aimed straight at the number runs every line and pins nothing, and the number looks identical either way.
- The `@canonical/*` configs are dependencies on purpose. Do not vendor their contents and do not replace them with local copies; a ruleset correction upstream has to reach this package.
- The toolchain is pinned to exact versions, not ranges. A range would let the installed toolchain drift on the next install, and a gate whose verdict depends on the day it was installed is a different gate on every machine.
- Node APIs only, and no `Bun` global anywhere under `src/`. The package runs under Node, and nothing declares the `Bun` global, so a reach for it fails the type check here rather than failing where the code executes.

## Boundaries

- The published surface is the manifest's `exports` map and nothing beside it. `src/index.ts` is the module behind `.`: a curated barrel that admits values by name, re-exported from the barrels below it. Nothing else under `src/` is reachable from outside the package.
- `src/` holds a closed set of members: `index.ts`, one entry module per published subpath, `lib/`, `bin/`, `scripts/`, `testing/`, and the `_`-prefixed never-shipped counterpart of any of them. A member of another kind is a decision, not a drop-in.
- Two TypeScript configurations, not one. `tsconfig.json` covers everything and never emits; `tsconfig.build.json` narrows to what ships — it drops `src/_*` at the top level and every `*.test.ts` — and is the only one that writes `dist/`. A single configuration would have to either type-check less than the repository contains or emit files that must not travel.
- The pipeline names one target, `ci`. A gate that is added to the manifest is enforced without the workflow changing; a gate the workflow named instead could be added to the manifest and never run, with nothing to say so.
- The coverage `exclude` in `vitest.config.ts` holds tests and declaration files and nothing else. A source file is never added to it to avoid writing its tests.

## Gotchas

- `.gitignore` lists no editor or agent tooling. Keep such paths in your global git ignore: a public ignore file that names them publishes the list it is hiding.
- The build's `src/_*` exclusion is anchored at the top level. A `_`-prefixed module deeper in the tree is emitted, and has to be: a shipped module may import it, and `dist/` would otherwise carry a dangling import. Below the top level the `_` prefix marks intent, not shipment.
- Bun runs the scripts, but `tsc` and `vitest` are `#!/usr/bin/env node` executables and run under whatever Node is on PATH; the suite therefore runs under Node, which is the runtime the package is written for. The manifest's `engines` names 22 or later, and the pipeline installs exactly that; locally, an older Node fails in ways that read like a package defect.
- The leakage gate's probes are assembled from parts, never written out: the gate is inside the set it scans, and a literal violation in it would be found by the very scan it exists to prove.
- A module that declares only types has no statements, so v8 records it as 0/0 and it cannot move the percentages. That is why `vitest.config.ts` carves out no `types.ts`: the carve-out would buy nothing except a hole for any runtime value dropped into such a file.
