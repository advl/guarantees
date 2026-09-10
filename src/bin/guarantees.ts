#!/usr/bin/env node
/**
 * The `guarantees` binary: eight subcommands, each a composition of the
 * package's domains, each ending in one exit code.
 *
 * It parses arguments and composes; it holds no judgement of its own, walks
 * no tree, starts no process directly and reads no report. Two decisions are
 * made here that no domain makes for it: which corpus a command is about,
 * composing `locateCorpus` with what `--corpus` gave; and that the register
 * is read against the workflow at all, composing `readPipeline` into
 * `parseRegister`, so a tier no job runs is refused on every command rather
 * than by an assertion inside that tier which cannot observe its own
 * absence. Both are compositions; neither is a rule spelled here.
 *
 * It reaches the domains it composes one at a time rather than through the
 * barrel that gathers them, because that barrel mints the bodies a corpus
 * registers and every one of those imports the test runner at load. Through
 * it, `guarantees list` over five rows would start the runner to print
 * them: an executable's import graph is what it composes, and this one
 * composes no test.
 *
 * It sets `process.exitCode` and never calls `process.exit`, which is both
 * the correctness rule — a teardown still has to run, and an exit does not
 * unwind — and the reason this module can be imported by its own test.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import {
  BUDGET_RUNS,
  computeP95,
  rewriteRunBudget,
} from "../lib/budget/index.js";
import { EXIT_CODES, Refusal } from "../lib/contract/index.js";
import { locateCorpus } from "../lib/corpus/index.js";
import { acceptGolden } from "../lib/golden/index.js";
import {
  buildImage,
  DEFAULT_IMAGE,
  judgePinned,
  locatePinned,
  readPinned,
  resolveImage,
  tagLocalBuild,
} from "../lib/image/index.js";
import { proveTier } from "../lib/prove/index.js";
import {
  parseRegister,
  type Register,
  type Row,
  readPipeline,
  TIERS,
  type Tier,
} from "../lib/register/index.js";
import {
  type Engine,
  probeEngine,
  type RunContext,
  reapStale,
  runEntry,
} from "../lib/run/index.js";
import { COLLECTS, judgeCorpus, listCollected } from "../lib/runner/index.js";
import {
  judgeBudget,
  judgeWall,
  listTierImages,
  planTier,
  runPool,
} from "../lib/schedule/index.js";
import {
  type ExitCode,
  toExitCode,
  type Verdict,
  worstCode,
} from "../lib/verdict/index.js";

const USAGE = [
  "usage: guarantees <subcommand> [argument] [--corpus <dir>] [--workflow <file>]",
  "                   [--class <name>]",
  "",
  "  list                 every row of the register, in the order it is written",
  "  check [tier]         the register against the runner and the tier's images",
  "  image [name]         build an image and check its record against the tree",
  "  run <id>             one entry, through its whole lifecycle",
  "  tier <tier>          a tier's rows, pooled by kind, under its wall",
  "  prove <tier>         a tier's sentinel red, and its bijection by orphan",
  "  rebudget <id>        re-measure an entry and write its budget back, under",
  "                       --class <name> or the class the row already carries",
  "  accept <id>          run an entry and take what it generated as goldens",
].join("\n");

const write = (line: string) => {
  process.stdout.write(`${line}\n`);
};

try {
  /**
   * The command line: flags with a value, and the subcommand and its one
   * argument. Every flag here takes one, and a flag at the end of the line
   * or in front of another flag was given none — which is refused rather
   * than read as the empty string, because the empty string is a plausible
   * value for each of them and each would silently mean something else: a
   * corpus under the working directory, the workflow beside it, or the
   * machine class the row already carries. Refused once, for all three:
   * a rule about what a flag is cannot be a rule one flag remembers.
   */
  const flags = new Map<string, string>();
  const positional: string[] = [];
  const argv = process.argv.slice(2);
  let taken = -1;
  for (const [index, token] of argv.entries()) {
    if (index === taken) continue;
    if (token.startsWith("--")) {
      const value = argv[index + 1];
      if (value === undefined || value === "" || value.startsWith("--")) {
        throw new Refusal(
          `\`${token}\` takes a value, and none was given\n\n${USAGE}`,
        );
      }
      flags.set(token.slice(2), value);
      taken = index + 1;
      continue;
    }
    positional.push(token);
  }
  const [subcommand = "", argument] = positional;

  /** The one argument a subcommand needs, or a refusal naming what it is for. */
  const required = (what: string): string => {
    if (argument === undefined || argument === "") {
      throw new Refusal(
        `\`guarantees ${subcommand}\` takes ${what}, and none was given\n\n${USAGE}`,
      );
    }
    return argument;
  };

  const tierOf = (given: string): Tier => {
    if (!(TIERS as readonly string[]).includes(given)) {
      throw new Refusal(
        `\`${given}\` is not a tier (${TIERS.join(" | ")})\n\n${USAGE}`,
      );
    }
    return given as Tier;
  };

  const rowOf = (register: Register, id: string): Row => {
    const row = register.get(id);
    if (row === undefined) {
      throw new Refusal(
        `the register holds no row \`${id}\` — \`guarantees list\` prints the ones it does`,
      );
    }
    return row;
  };

  const located = locateCorpus(process.cwd(), flags.get("corpus"));
  const workflowPath = flags.get("workflow") ?? located.workflowPath;
  const registerText = readFileSync(located.registerPath, "utf8");
  const register = parseRegister(
    registerText,
    readPipeline(readFileSync(workflowPath, "utf8"), COLLECTS),
  );

  /** What a run of one row needs, with that row's own image resolved. */
  const contextFor = async (engine: Engine, row: Row): Promise<RunContext> => ({
    engine,
    repositoryRoot: located.repositoryRoot,
    corpusRoot: located.corpusRoot,
    nonce: String(process.pid),
    image: (await resolveImage(engine, row.image)).reference,
  });

  /** Every judgement is printed and reduced to its code the one way. */
  const say = (verdict: Verdict): ExitCode => {
    write(`${verdict.ok ? "ok " : "RED"} ${verdict.reason}`);
    return toExitCode(verdict);
  };

  /** What was reaped before anything of this run started, never in silence. */
  const reap = async (engine: Engine) => {
    const names = await reapStale(engine, located.repositoryRoot);
    write(`reaped ${names.join(", ") || "nothing"}`);
  };

  if (subcommand === "list") {
    const width = Math.max(...[...register.keys()].map((id) => id.length));
    for (const row of register.values()) {
      write(
        `${row.id.padEnd(width)}  ${row.kind.padEnd(11)} ${row.tier.padEnd(7)} ${row.expect.padEnd(4)} ${row.file}`,
      );
    }
    process.exitCode = EXIT_CODES.green;
  } else if (subcommand === "check") {
    const tier = tierOf(argument ?? "pr");
    const corpus = judgeCorpus(
      await listCollected(located.corpusRoot),
      register,
    );
    for (const row of corpus.uncollected) {
      write(`RED ${row}, which this corpus's runner would not collect`);
    }
    for (const file of corpus.unclaimed) {
      write(`RED ${file} is collected and no row claims it`);
    }
    const plan = planTier(register, tier);
    const engine = await probeEngine();
    for (const image of listTierImages(register, tier)) {
      const resolved = await resolveImage(engine, image);
      write(`ok  ${image} resolves to ${resolved.reference}`);
    }
    write(
      `ok  ${tier} tier planned: ${plan.pool.length} pooled, ${plan.serial.length} one at a time`,
    );
    process.exitCode = say(corpus.verdict);
  } else if (subcommand === "image") {
    const name = argument ?? DEFAULT_IMAGE;
    const engine = await probeEngine();
    const built = await buildImage(
      engine,
      located.repositoryRoot,
      name,
      tagLocalBuild(name),
    );
    const record = locatePinned(located.repositoryRoot, name);
    // Nothing is written. The digest a row pins is the one the publishing
    // job pushed, and a build here answers a digest belonging to this
    // machine; what this build settles is whether the definition still
    // builds and whether the record still describes the files it names.
    process.exitCode = say(
      judgePinned(
        existsSync(record) ? readPinned(readFileSync(record, "utf8")) : null,
        built,
        name,
      ),
    );
  } else if (subcommand === "run") {
    const row = rowOf(register, required("the id of a row"));
    const engine = await probeEngine();
    const context = await contextFor(engine, row);
    await reap(engine);
    process.exitCode = say(await runEntry(row, context));
  } else if (subcommand === "tier") {
    const tier = tierOf(required("a tier"));
    const plan = planTier(register, tier);
    const engine = await probeEngine();
    await reap(engine);
    // Each row answers its own code rather than the slice racing to the
    // first rejection: every row of a slice tore its own entry down and has
    // something to report, and a refusal by one is not a reason to lose the
    // verdicts beside it. Resolving the row's image is inside that guard and
    // not awaited outside it, because it is the likeliest refusal of the two
    // and one taken outside the chain would lose the whole slice, the serial
    // list and the wall with it.
    const runToCode = (row: Row): Promise<ExitCode> =>
      contextFor(engine, row)
        .then((context) => runEntry(row, context))
        .then(say, (error: unknown) => {
          if (!(error instanceof Refusal)) throw error;
          write(`REF ${row.id}: ${error.message}`);
          return toExitCode(error);
        });
    const codes: ExitCode[] = [];
    const opened = performance.now();
    codes.push(...(await runPool(plan.pool, runToCode)));
    for (const row of plan.serial) codes.push(await runToCode(row));
    const wall = say(judgeWall((performance.now() - opened) / 1000, tier));
    process.exitCode = worstCode([wall, ...codes]);
  } else if (subcommand === "prove") {
    const tier = tierOf(required("a tier"));
    const engine = await probeEngine();
    await reap(engine);
    process.exitCode = say(
      await proveTier(tier, register, {
        engine,
        repositoryRoot: located.repositoryRoot,
        corpusRoot: located.corpusRoot,
        nonce: String(process.pid),
      }),
    );
  } else if (subcommand === "rebudget") {
    const row = rowOf(register, required("the id of a row"));
    const engine = await probeEngine();
    const context = await contextFor(engine, row);
    await reap(engine);
    const windows: number[] = [];
    const measured: ExitCode[] = [];
    for (let round = 0; round < BUDGET_RUNS; round += 1) {
      const ran = await runEntry(row, context);
      measured.push(
        say({ ...ran, reason: `${ran.reason} in ${ran.seconds.toFixed(1)}s` }),
      );
      windows.push(ran.seconds);
    }
    const measurement = {
      class: flags.get("class") ?? row.run.class,
      p95: computeP95(windows),
    };
    const judged = judgeBudget(measurement, row.tier);
    // The measurement is written only where the register would carry it,
    // and only where every window measured the entry doing what the row
    // promises. A pair past the tier's ceiling is refused by the parser, so
    // writing one replaces a budget that parses with a file every later
    // command declines. A window taken from a run that went red is not a
    // measurement of the entry at all: an entry that used to cost forty
    // seconds and now fails an assertion early measures nothing like forty,
    // and a budget written from it hard-kills every later honest run and
    // reports a breach nobody introduced. The number this measured is in
    // the lines above either way.
    const took = worstCode(measured);
    if (judged.ok && took === EXIT_CODES.green) {
      writeFileSync(
        located.registerPath,
        rewriteRunBudget(registerText, row.id, measurement),
      );
    }
    process.exitCode = worstCode([
      say({
        ...judged,
        ok: judged.ok && took === EXIT_CODES.green,
        reason:
          took === EXIT_CODES.green
            ? `${row.id}: ${judged.reason}`
            : `${row.id}: ${judged.reason}, and nothing was written — a window measured by a run that did not do what the row promises is not a measurement of the entry`,
      }),
      ...measured,
    ]);
  } else if (subcommand === "accept") {
    const row = rowOf(register, required("the id of a row"));
    const engine = await probeEngine();
    const context = await contextFor(engine, row);
    await reap(engine);
    const ran = await runEntry(row, context);
    say(ran);
    const accepted = acceptGolden(row, context, ran);
    for (const [what, names] of Object.entries(accepted)) {
      for (const name of names) write(`${what.padEnd(9)} ${name}`);
    }
    write(
      `ok  ${row.id}: read the diff before committing it — a golden is a claim about what this artifact is, and one accepted unread is a change nobody ruled on`,
    );
    // A red run is the ordinary shape of an accept: the first accept of any
    // golden runs an entry that is red because the golden is not there yet,
    // and the accept after an intended change runs one that is red because
    // the surface moved. What says the redness WAS the golden comparison is
    // that the accept had something to write — a file the tree did not hold,
    // or one whose bytes differ. A run that went red and generated nothing
    // the tree did not already carry was red for some other reason, and
    // exiting green over it would report a guarantee that failed as one that
    // passed, on the one command a developer runs when something is already
    // broken.
    const explained = accepted.added.length > 0 || accepted.replaced.length > 0;
    process.exitCode = ran.ok || explained ? EXIT_CODES.green : toExitCode(ran);
  } else {
    throw new Refusal(
      `\`${subcommand}\` is not a subcommand of guarantees\n\n${USAGE}`,
    );
  }
} catch (error) {
  if (error instanceof Refusal) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = toExitCode(error);
  } else {
    // A fault that is not a refusal surfaces as itself, and still not as a
    // verdict. Rethrown out of a module's top level it would leave the
    // process at 1, which this contract spends `toExitCode` and `worstCode`
    // keeping for a guarantee that was judged and failed; a missing file or
    // an engine client that died judged nothing. The stack is what a reader
    // needs and the code says the scheduler declined.
    process.stderr.write(
      `${error instanceof Error ? error.stack : String(error)}\n`,
    );
    process.exitCode = EXIT_CODES.refused;
  }
}
