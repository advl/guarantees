# AGENTS.md

Instructions for whoever works on this repository. Everything here is true at the commit that carries it.

## Commands

`bun run` is the task face: every gate is a script in `package.json`, and the pipeline runs those scripts and nothing else.

| Command | What it does |
|---|---|
| `bun install` | Installs the toolchain. The lockfile is `bun.lock`; the pipeline installs with `--frozen-lockfile`. |
| `bun run build` | `tsc -p tsconfig.build.json` into `dist/`: modules under `dist/esm`, declarations under `dist/types`. |
| `bun run check` | `build`, then `check:biome` (format and lint over `src` and the root JSON files), then `check:ts` (`tsc --noEmit` over everything `tsconfig.json` includes). |
| `bun run check:fix` | The formatter and its safe fixes applied, then the type check. |
| `bun run ci` | `check`. The one target the pipeline names; run it before opening a pull request. |

## Conventions

- Licence MIT, author `advl`, declared in the manifest and carried in `LICENSE`.
- Every commit is signed. Subjects are Conventional Commits, lowercase, with no scope for a repository-wide concern; bodies say why, never what the diff already shows.
- Branches are `<type>/<slug>`, the type a conventional-commit type matching the subject the merge lands with. Never a tracker identifier.
- Prose flows: markdown and commit bodies use one paragraph per line and are never hard-wrapped, because a wrapped phrase is unfindable by grep and rewraps into diff noise the moment a word changes. Comments are code and wrap by hand at the formatter's line width, like the lines around them.
- Nothing in this repository points outward. No tracker identifier, session code, decision-record identifier or path into another repository, in source, comments, commits or documentation. Where a decision has a rationale worth keeping, the rationale is written in full where it applies.
- Fixtures use reserved-neutral names: `example.com`, `@example/*`.
- A comment explains a hazard. Code that reads as what it does carries none.
- The `@canonical/*` configs are dependencies on purpose. Do not vendor their contents and do not replace them with local copies; a ruleset correction upstream has to reach this package.
- The toolchain is pinned to exact versions, not ranges. A range would let the installed toolchain drift on the next install, and a gate whose verdict depends on the day it was installed is a different gate on every machine.
- Node APIs only, and no `Bun` global anywhere under `src/`. The package runs under Node, and nothing declares the `Bun` global, so a reach for it fails the type check here rather than failing where the code executes.

## Boundaries

- The published surface is the manifest's `exports` map and nothing beside it. `src/index.ts` is the module behind `.`: a curated barrel that admits values by name, re-exported from the barrels below it. Nothing else under `src/` is reachable from outside the package.
- `src/` holds a closed set of members: `index.ts`, one entry module per published subpath, `lib/`, `bin/`, `scripts/`, `testing/`, and the `_`-prefixed never-shipped counterpart of any of them. A member of another kind is a decision, not a drop-in.
- Two TypeScript configurations, not one. `tsconfig.json` covers everything and never emits; `tsconfig.build.json` narrows to what ships — it drops `src/_*` at the top level and every `*.test.ts` — and is the only one that writes `dist/`. A single configuration would have to either type-check less than the repository contains or emit files that must not travel.

## Gotchas

- `.gitignore` lists no editor or agent tooling. Keep such paths in your global git ignore: a public ignore file that names them publishes the list it is hiding.
- The build's `src/_*` exclusion is anchored at the top level. A `_`-prefixed module deeper in the tree is emitted, and has to be: a shipped module may import it, and `dist/` would otherwise carry a dangling import. Below the top level the `_` prefix marks intent, not shipment.
