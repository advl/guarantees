/**
 * The contract, as data: the version, the exit codes, the limits and the
 * five schemas every implementation of the scheduler reads. They live in one
 * file because they are one artifact — the schemas cite each other's
 * fragments, and a version that moved without its schemas would be a number
 * about nothing.
 *
 * A schema states what a document must look like. It cannot state what the
 * parser also requires — relations between values, sums across rows, what the
 * pipeline runs — so each schema says of itself that it is necessary and not
 * sufficient, and the parser is the authority on the rest.
 *
 * It is past 500 lines, and the content is irreducible rather than
 * unsorted. Most of it is the descriptions the emitted files carry: the
 * schema is the document a second implementation reads instead of this
 * source, so every constraint it states carries the sentence saying why,
 * and a description moved out of the object would be a description the
 * emitted file no longer has. Splitting the five schemas across files would
 * break the citations between their fragments — the marker, the label and
 * the report all reference the register's own `$defs` — and would leave the
 * version in one file and the documents it versions in others.
 */

/**
 * The contract version. It moves when the shape of a document a consumer
 * writes or reads changes meaning, and a register or a probe naming another
 * version is refused at parse time rather than being read as something it is
 * not. It is carried inside the register schema as `$defs.version`, so a
 * reader of the emitted file has it as data.
 */
export const CONTRACT_VERSION = "1";

/**
 * The version at which the register's header did not exist, and so what a
 * register without one — or a header without `contract` — is written
 * against. It is the header property's `default` and never moves with
 * `CONTRACT_VERSION`: the day the contract moves, every headerless register
 * is still what it was, and reading it as the new version is the misreading
 * the version exists to refuse.
 */
const HEADERLESS_VERSION = "1";

/**
 * What a run's exit code means. `refused` is the scheduler declining to
 * judge: a register, a report or a probe it could not read, a report that is
 * not this run's, a run in which nothing executed. Neither `green` nor `red`
 * is ever derived from a runner's exit code; both come from a report the run
 * wrote. Carried inside the register schema as `$defs.exitCodes`, so a
 * reader of the emitted file has the codes as data.
 */
export const EXIT_CODES = { green: 0, red: 1, refused: 2 } as const;

const DRAFT = "https://json-schema.org/draft/2020-12/schema";

// A schema spells an implication as `if`/`then`, and `then` on an object
// literal is what a thenable is duck-typed by, so the linter refuses the key
// written plainly. Written through a name it is the same key and no thenable:
// `then` here is a schema keyword, never a function.
const THEN = "then";

/**
 * Every number the parser and the scheduler hold a register to, stated once
 * and carried inside the register schema as `$defs.limits`, so that an
 * implementation in another language reads them from the file rather than
 * transcribing them from prose. The per-tier ceilings are in seconds:
 * `entry` bounds one row's budget; `wall` bounds the wall-clock span of the
 * tier's whole schedule, pool and serial list together, from the first row
 * starting to the last one torn down — every phase of every row, not the
 * measured ones alone, because the wall is what the tier costs whoever
 * waits for it. Running rows in parallel buys room under it and never
 * loosens it, and it is judged over the schedule as it ran, never over the
 * budgets summed. The pr tier is
 * sixty seconds each and five minutes of wall; the later tiers are
 * one number, the wall, which is the per-entry ceiling too since a budget
 * past the wall is one the tier could never meet. The release tier is per
 * repository and is absent here, which reads as unbounded. `unmeasuredS` is
 * the deadline on everything outside the measured window — an image pull, a
 * recipe, an engine call — and is not a row's budget, because a recipe
 * fetching a heavy fixture is expected to outlast the guarantee it feeds. A
 * budget is set from `runs` measured windows of the entry, each the seconds
 * of its measured phase, taken to a p95 by nearest rank — the sample at
 * position ceil(0.95 × n) of the n samples sorted ascending, which for five
 * is the slowest — then rounded to a tenth, times `headroom`, rounded up,
 * and never below `floorS`; the hard kill is `killMultiplier` times the
 * budget.
 */
const LIMITS = {
  ceilings: {
    pr: { entry: 60, wall: 300 },
    merge: { entry: 900, wall: 900 },
    nightly: { entry: 3600, wall: 3600 },
  },
  unmeasuredS: 600,
  budget: {
    floorS: 10,
    headroom: 1.5,
    killMultiplier: 3,
    runs: 5,
    p95: "nearest-rank",
  },
} as const;

/** The one table of a register that is not a row: its header. */
const HEADER = "corpus";

/**
 * A register id is a directory name and half a container name before it is
 * anything else, so it is lowercase letters, digits and hyphens, opening on a
 * letter or a digit. Two names are reserved: `corpus` is the register's own
 * header table, and `reports` is where run reports are kept after an entry's
 * own directory is torn down.
 */
const ID = {
  type: "string",
  pattern: "^[a-z0-9][a-z0-9-]*$",
  not: { enum: [HEADER, "reports"] },
  description:
    "Lowercase letters, digits and hyphens, opening on a letter or a digit; a directory name and half a container name before it is anything else. `corpus` is reserved for the register's header and `reports` for the lifted run reports.",
} as const;

/**
 * The kinds whose rows share the machine. A conformance, oracle or
 * determinism row reports the same thing whether or not another container
 * is running beside it; a budget measured beside three other containers is
 * not the budget — shares reproduce under load and magnitudes do not — and
 * the remaining kinds are serialized with it rather than each argued into
 * the pool on its own. Carried inside the register schema as
 * `$defs.pooledKinds`, so the partition is data in the emitted file.
 */
const POOLED_KINDS = ["conformance", "oracle", "determinism"] as const;

/**
 * The three strings a proof by orphan is written in, carried inside the
 * register schema as `$defs.prove` so that an implementation in another
 * language reads them from the emitted file rather than guessing at them. A
 * proof installs a file named for `orphanId`, runs the row whose id is
 * `bijectionId`, and requires the assertion titled `unclaimedTitle` among
 * that run report's failed assertions. Two implementations that are to
 * report the same verdicts have to reproduce all three verbatim, and a
 * title typed a second time somewhere else would prove that the two
 * spellings agree and nothing more.
 */
const PROVE = {
  bijectionId: "corpus-bijection",
  orphanId: "_prove_orphan",
  unclaimedTitle: "claims every file the runner would collect",
} as const;

/**
 * What an image build is asked for beyond its definition, carried inside
 * the register schema as `$defs.buildFlags`.
 *
 * A row pins an image by the digest of a build, and that digest is a
 * function of these two arguments as much as of the files: dated at a fixed
 * instant the layer archives are identical between two builds minutes
 * apart, and with the build history omitted the image configuration carries
 * none of the engine's own bookkeeping about the build, including the
 * throwaway name it mints for a stage it materialises. An implementation
 * that built the same definition without them would answer a digest no row
 * here names and no reader could account for, so the arguments are data in
 * the file rather than a habit of one command.
 */
const BUILD_FLAGS = ["--timestamp", "0", "--omit-history"] as const;

/**
 * The title of the assertion a tier's proof requires among the failed,
 * lifted out of the schema so that the body that carries it and the proof
 * that names it read one datum. It is a fact of the contract and not of
 * either of them: a proof matching a title typed a second time proves that
 * two strings agree and nothing else, and goes quiet the day one of them is
 * reworded. It lives in this domain because its two readers are in
 * different ones, and because the domain that registers assertions imports
 * the test runner at load — a name minted there is a name the executable
 * cannot reach without loading a runner it composes no test with.
 *
 * @package
 */
export const UNCLAIMED_TITLE: string = PROVE.unclaimedTitle;

/**
 * How a workflow's steps name a tier, carried inside the register schema as
 * `$defs.face`. A register is held to what its pipeline runs, and what the
 * pipeline runs is read out of the steps by looking for these two commands:
 * a step running `tier <name>` triggers that tier, a step running
 * `prove <name>` proves it. They are the task face's own names, and two
 * implementations that read one workflow the same way have to look for the
 * same two strings — a corpus whose job spells them otherwise is a corpus
 * every command refuses, so the strings are data rather than one language's
 * source.
 */
const FACE = { tier: "g:tier", prove: "g:prove" } as const;

const RECIPES = {
  type: "array",
  items: { type: "string", minLength: 1 },
  description: "Task-face recipe names, each run in order.",
} as const;

export const registerSchema = {
  $schema: DRAFT,
  title: "Register",
  description: `One table per guarantee, keyed by id, plus an optional \`corpus\` header table. This schema is necessary and not sufficient: the parser also requires a budget of at least ceil(p95 × ${LIMITS.budget.headroom}), a teardown wherever holds is non-empty, a file carrying the suffix the runner collects, one row expecting failure in every tier that holds rows, every such tier triggered and proven by the pipeline, and a row under the id \`$defs/prove\` names for the bijection.`,
  type: "object",
  properties: {
    [HEADER]: { $ref: "#/$defs/header" },
  },
  propertyNames: { anyOf: [{ const: HEADER }, { $ref: "#/$defs/id" }] },
  additionalProperties: { $ref: "#/$defs/row" },
  $defs: {
    version: {
      const: CONTRACT_VERSION,
      description:
        "The contract version this schema is published under. A register names it in `corpus.contract` and a probe in `contract`; a document naming another version is refused rather than read as this one.",
    },
    exitCodes: {
      const: EXIT_CODES,
      description:
        "What a run's exit code means. `green` and `red` are verdicts read from the report the run wrote, never from the runner's own exit code; `refused` is the scheduler declining to judge — a register, a report or a probe it could not read, a report that is not this run's, a run in which nothing executed. Carried here because the register is the document every implementation reads first.",
    },
    limits: {
      const: LIMITS,
      description:
        "The numbers the parser and the scheduler hold a register to: per-tier ceilings in seconds — `entry` bounds one row's budget, which is its measured phase alone, and `wall` bounds the wall-clock span of the tier's whole schedule from the first row starting to the last one torn down, image resolution, build recipes and teardown included, because that span is what the tier costs whoever waits for it — the deadline on everything outside the measured window, and the budget rule — the floor, the headroom, the hard-kill multiplier, how many measured windows a budget is set from and the p95 estimator over them, nearest rank. A tier absent from `ceilings` has none.",
    },
    header: {
      type: "object",
      properties: {
        contract: {
          $ref: "#/$defs/version",
          default: HEADERLESS_VERSION,
          description:
            "The contract version the register is written against; any other is refused. Absent — no header, or a header without it — the register is written against the default, the version at which the header did not exist, and never against the current one.",
        },
      },
      additionalProperties: false,
    },
    id: ID,
    kind: {
      enum: [
        "oracle",
        "determinism",
        "conformance",
        "golden",
        "budget",
        "compat",
        "perf",
      ],
      description:
        "What sort of fact the row pins. The kinds in `$defs/pooledKinds` run as a pool; every other kind runs one at a time after the pool drains, as does any row that declares `holds`.",
    },
    prove: {
      const: PROVE,
      description:
        "What a tier's proof by orphan is written in: the id of the row that scans the corpus, the id the file installed under it is named for — opening with a character no id may carry, so no register can claim it — and the title of the assertion that rigged run must report failing. The proof reads that title out of the run's own report, so the three are one datum here rather than three literals in every implementation.",
    },
    buildFlags: {
      const: BUILD_FLAGS,
      description:
        "What the engine is asked for when an image is built, beyond its definition: every layer dated at one instant and no build history in the image configuration. Without them one definition answers a new digest on every build, and the job that publishes the image would repoint every row each time it ran. They do not make a digest reproduce across machines and nothing does — a layer is an archive of a filesystem rather than the filesystem — which is why an image is published once and fetched by digest rather than rebuilt, and why what a record pins the definition by is a hash over its files.",
    },
    face: {
      const: FACE,
      description:
        "How a workflow names a tier: the task-face commands its steps run. A step running `<tier> <name>` triggers that tier and a step running `<prove> <name>` proves it, and a tier a register holds that no step names either way is refused on every command. Carried here because the pipeline is read from a file both implementations read, and a name each of them guessed at would refuse the other's workflow.",
    },
    pooledKinds: {
      const: POOLED_KINDS,
      description:
        "The kinds whose rows share the machine, running as a pool at its concurrency. A row of any other kind, and a row of these that declares `holds`, runs alone after the pool drains: a budget measured beside other containers is not the budget, and a held resource is one another row could contend for. Carried as data so an implementation reads the partition from the file rather than from prose.",
    },
    tier: {
      enum: ["pr", "merge", "nightly", "release"],
      description:
        "The earliest moment the thing the row pins could have changed, demoted only as its cost demands.",
    },
    isolation: {
      enum: ["image", "image-net"],
      description:
        "What the measured run may reach. `image-net` keeps the image and drops only the network wall.",
    },
    expect: {
      enum: ["pass", "fail"],
      description:
        "`fail` marks the row designed to fail; a tier is green only once it has been seen to fail.",
    },
    image: {
      type: "string",
      pattern: "^[^@\\s]+@sha256:[0-9a-f]{64}$",
      description:
        "The image the run is admissible in, pinned by digest and never by tag.",
    },
    file: {
      type: "string",
      pattern: "^(?!/)(?!.*(^|/)\\.\\.(/|$)).*$",
      description:
        "The test file, relative to the corpus directory and inside it, on one line. Which suffix a runner collects is that runner's rule, so the parser holds the file to the suffix its caller names and the schema does not.",
    },
    recipes: RECIPES,
    run_s: {
      type: "object",
      properties: {
        class: {
          type: "string",
          minLength: 1,
          description: "A machine class, never a hostname.",
        },
        p95: {
          type: "number",
          exclusiveMinimum: 0,
          description: "The measurement the budget came from, in seconds.",
        },
        budget: {
          type: "integer",
          minimum: LIMITS.budget.floorS,
          description: `Seconds: the p95 rounded to a tenth, times ${LIMITS.budget.headroom}, rounded up, and never below ${LIMITS.budget.floorS}. The hard kill is ${LIMITS.budget.killMultiplier} times this.`,
        },
      },
      required: ["class", "p95", "budget"],
      additionalProperties: false,
    },
    row: {
      type: "object",
      properties: {
        kind: { $ref: "#/$defs/kind" },
        tier: { $ref: "#/$defs/tier" },
        file: { $ref: "#/$defs/file" },
        select: {
          type: "string",
          minLength: 1,
          description:
            "The title of the entry's suite, or of its one test, as the host runner joins titles with single spaces; matched from the start of the full title and never as a pattern, so what the row writes is what the runner selects.",
        },
        build: { $ref: "#/$defs/recipes" },
        image: { $ref: "#/$defs/image" },
        isolation: { $ref: "#/$defs/isolation" },
        holds: {
          type: "array",
          items: { type: "string", minLength: 1 },
          description:
            "Resources the entry keeps beyond its own container. Naming one obliges a teardown.",
        },
        teardown: { $ref: "#/$defs/recipes" },
        expect: { $ref: "#/$defs/expect" },
        run_s: { $ref: "#/$defs/run_s" },
      },
      required: [
        "kind",
        "tier",
        "file",
        "select",
        "build",
        "image",
        "isolation",
        "holds",
        "teardown",
        "expect",
        "run_s",
      ],
      additionalProperties: false,
      allOf: Object.entries(LIMITS.ceilings).map(([tier, { entry }]) => ({
        if: { properties: { tier: { const: tier } }, required: ["tier"] },
        [THEN]: {
          properties: { run_s: { properties: { budget: { maximum: entry } } } },
        },
      })),
    },
  },
} as const;

/**
 * The subset of the runner's JSON report a verdict is read from. The runner
 * writes more, and a report is not refused for it.
 */
export const reportSchema = {
  $schema: DRAFT,
  title: "Report",
  description:
    "The runner's JSON report, as far as a verdict reads it: the shape the TypeScript test runner writes. An implementation over another runner reads that runner's own report into the same three counts and the same list of assertions, and is held to the same verdict. Necessary and not sufficient: the parser also requires the passed count and the failed count each to equal the number of assertions of that status listed.",
  type: "object",
  properties: {
    numTotalTests: { type: "integer", minimum: 0 },
    numPassedTests: { type: "integer", minimum: 0 },
    numFailedTests: { type: "integer", minimum: 0 },
    testResults: {
      type: "array",
      items: {
        type: "object",
        properties: {
          assertionResults: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                fullName: { type: "string" },
                // The runner has one more status, for an assertion nobody
                // has written yet. It is left out on purpose: a guarantee
                // file carrying an unwritten assertion is not a guarantee,
                // and a report that lists one is refused rather than read.
                status: {
                  enum: ["passed", "failed", "skipped", "pending", "disabled"],
                },
              },
              required: ["title", "fullName", "status"],
              additionalProperties: true,
            },
          },
        },
        required: ["assertionResults"],
        additionalProperties: true,
      },
    },
  },
  required: [
    "numTotalTests",
    "numPassedTests",
    "numFailedTests",
    "testResults",
  ],
  additionalProperties: true,
} as const;

/**
 * The probe a measuring entry writes beside its verdict: the contract version
 * it is written against, one or more readings, each carrying exactly what
 * makes it comparable to the next, and the stamp of what took them. It is a
 * schema here like the register and the report because it is the one
 * document an entry in any language writes and a scheduler in any language
 * reads; a reader without a schema would learn the shape key by key from
 * refusals. The version is required, where the register's is defaulted: no
 * probe was ever written without one.
 */
export const probeSchema = {
  $schema: DRAFT,
  title: "Probe",
  description:
    "What a measuring entry writes: the contract version, readings — each a metric, its value and units, the phase it was taken in, the fixture it ran against and the machine class it ran on — and, optionally, the stamp of what took them. A reading admits no other key, because one that cannot be compared to the next is an opinion with a number on it; a reading spelled as name, unit and value is refused, and a writer that spells it so changes.",
  type: "object",
  properties: {
    contract: {
      const: CONTRACT_VERSION,
      description:
        "The contract version the probe is written against, the register schema's `$defs/version`; a probe naming any other is refused.",
    },
    stamp: { $ref: "#/$defs/stamp" },
    readings: {
      type: "array",
      minItems: 1,
      items: { $ref: "#/$defs/reading" },
    },
  },
  required: ["contract", "readings"],
  additionalProperties: false,
  $defs: {
    phase: {
      enum: ["cold", "warm"],
      description: "`cold` before any warm-up, `warm` after.",
    },
    stamp: {
      type: "object",
      properties: {
        instrument: {
          type: "string",
          minLength: 1,
          description:
            "What took the readings — a benchmark harness, a timer, a size probe — with its version.",
        },
        at: {
          type: "string",
          format: "date-time",
          description:
            "When the readings were taken, as the entry's clock says. Freshness is judged from the filesystem, never from this.",
        },
      },
      required: ["instrument", "at"],
      additionalProperties: false,
      description:
        "Where the readings came from. Never a hostname: a machine is named by its class, on the reading.",
    },
    reading: {
      type: "object",
      properties: {
        metric: { type: "string", minLength: 1 },
        value: { type: "number" },
        units: { type: "string", minLength: 1 },
        phase: { $ref: "#/$defs/phase" },
        fixture: { type: "string", minLength: 1 },
        class: {
          type: "string",
          minLength: 1,
          description: "A machine class, never a hostname.",
        },
      },
      required: ["metric", "value", "units", "phase", "fixture", "class"],
      additionalProperties: false,
    },
  },
} as const;

/**
 * The freshness marker a run writes before it starts, on the filesystem the
 * report is written to, so that a report older than the marker is a report
 * from an earlier run whatever the filesystem's timestamp granularity is.
 */
export const markerSchema = {
  $schema: DRAFT,
  title: "Marker",
  description:
    "Written by a run before anything starts, on the same filesystem as the report; a report dated before it belongs to an earlier run.",
  type: "object",
  properties: {
    id: ID,
    startedAt: {
      type: "integer",
      minimum: 0,
      description: "Milliseconds since the epoch, as the filesystem dates it.",
    },
    pid: { type: "integer", minimum: 1 },
  },
  required: ["id", "startedAt", "pid"],
  additionalProperties: false,
} as const;

/**
 * The two labels every container a run starts carries: the checkout, so two
 * checkouts of one repository never reap each other's containers, and the
 * entry, so every container of one row is found by one filter.
 */
export const labelSchema = {
  $schema: DRAFT,
  title: "Labels",
  description:
    "The labels on every container a run starts. `corpus` is the checkout the run belongs to, so two checkouts of one repository never remove each other's containers.",
  type: "object",
  properties: {
    corpus: {
      type: "string",
      pattern: "^[0-9a-f]{12}$",
      description:
        "The first twelve hex digits of a hash of the checkout path.",
    },
    entry: ID,
  },
  required: ["corpus", "entry"],
  additionalProperties: false,
} as const;
