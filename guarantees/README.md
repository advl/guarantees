# The guarantees of this package

One table per guarantee in `corpus.toml`, and one test file per row. A row carries everything its file cannot say about itself: what sort of fact it pins, when it runs, what has to be built first, which image it is admissible in, what it holds, how long it may take, and whether it is expected to pass or to fail. The scheduler is the package this corpus judges, run through the `g:*` scripts of the repository's task face.

This tree is two artifacts at once. It is this package's own guarantee layer, so the package is held to the law it enforces. It is also the conformance fixture: a small corpus with known verdicts that an implementation of the contract in another language reproduces, which is what makes "the shared thing is the contract" enforceable by a job rather than asserted in a document.

Every entry is a call to a body the package publishes, rather than a scan written out here. That is not economy: the bijection scans the tree it is standing in and has to find itself in it, so a copy of it in every corpus is a copy that drifts, silently, in the direction that hides an entry.

## The image

The rows pin `ghcr.io/advl/guarantees-base-ts` by digest. That image is built and pushed by `.github/workflows/image.yml`, it is public, and every machine that runs a row fetches it: a run resolves the digest in local storage first and pulls it when the storage does not hold it, so no credential and no build are needed to run this corpus anywhere.

It is fetched rather than reproduced because a digest is not a thing a machine reproduces. A manifest digest is computed over the image configuration the build toolchain emits, and a layer is an archive of a filesystem rather than the filesystem: one engine version building this definition in two environments answered two digests while every file inside the two images was byte-identical, the difference confined to the layer the install writes. Across engine versions it differs for a second reason, since two build toolchains emit different image configurations from identical files. So the digest belongs to the machine that took it, and the only useful thing to do with it is publish it once.

`images/ts/pinned.toml` records that digest and, beside it, a hash over the files the image is built from. The hash is what every machine can check: it is over files, needs no engine and no build, and it is what says whether a rebuild was a rebuild of the same definition. The image tie the `corpus-image` row runs asserts the three agree — the digest the rows pin, the digest the record carries, and the hash this tree's own files answer — and it is red the moment the definition is edited without the image being republished and the record moved to what that job pushed. Two arguments carried in the contract as `$defs.buildFlags` are what keep that publish answering one digest per definition rather than a new one per run: every layer is dated at one fixed instant, so two builds minutes apart do not differ in the modification times their archives carry, and no build history is written, so the image configuration carries none of the engine's own bookkeeping — including the throwaway name it mints for a stage it has to materialise, which lands on whichever step it happens to be committing.

`bun run g:image` builds the definition here and asks the one question a machine can answer on its own: whether the record still describes the files it names. It writes nothing. The digest is a fact about a push, so the publishing job prints the digest it pushed and the hash beside it, and a reader copies both into `images/ts/pinned.toml` and into every row.

## Running it

`bun run build` first, because the corpus resolves the package through its own install and that install is a link into `dist/`. Then `bun run install:corpus` once. Then `bun run g:list`, `bun run g:check`, `bun run g:tier pr` and `bun run g:prove pr`; the first of those to need the image pulls it. A budget is written by `bun run g:rebudget <id>` on a quiet machine and never by hand, under `--class <name>` where the machine is not the class the row already carries.

## What this fixture pins, and what it does not

An implementation of the contract in another language reproduces these verdicts, and reproducing them is necessary and not sufficient. Every row here is a `conformance` row at the `pr` tier, in one image, with no build recipes, nothing held, no teardown and no golden — so what a green run of it demonstrates is the register, the bijection, the layering, the image tie, the toolchain stamp, the sentinel and the proof by orphan. It does not exercise the partition by kind, the rule that a row declaring `holds` runs alone, build or teardown recipes, the `image-net` isolation, the `golden` kind, or any tier but `pr`; those are stated as data in `contract/register.schema.json` and read from there rather than shown here.

The image is the one thing an implementation does not have to bring with it. The rows pin a published, public image by digest, so an implementation in another language fetches exactly the image these verdicts were taken in, on any machine, with no credential — which is what makes them reproducible at all rather than reproducible where somebody once built something.
