/**
 * Fails if any file destined for version control encodes this machine, this
 * account, a personal identity, or a pointer to a record kept outside this
 * repository.
 *
 * The identity rules are short and mechanical on purpose, and every pattern
 * is derived at runtime rather than written down, so this gate itself carries
 * no personal data:
 *
 *   - the running account's home directory and username,
 *   - the running machine's hostname,
 *   - generic home-directory prefixes on Linux, macOS and Windows,
 *   - e-mail addresses outside the attribution allowlist.
 *
 * The remaining content rules are about self-containment rather than
 * identity. A reader of this repository must be able to reconstruct every
 * decision from what is in front of them, so a tracker identifier, a
 * decision-record identifier, a session code, a standards-corpus reference or
 * a path into a planning repository is a defect: the rationale is copied in
 * instead. Two references are legitimate and allowlisted — an upstream issue
 * in another project, and a dependency's own external API.
 *
 * One rule is about the shape of prose rather than its content. A markdown
 * paragraph broken across lines is unfindable by grep and rewraps into diff
 * noise the moment a word changes, so a document with two consecutive lines
 * of paragraph text is refused.
 *
 * One rule is about register. Committed text describes this code as what it
 * is — never in relation to some other code it stands in for, which points
 * the reader at a record outside the repository, and never as unfinished,
 * which is a promise no gate can hold anyone to. The words that do either
 * are refused wherever they appear; the rationale, once again, is copied in.
 *
 * Some leaks are paths rather than contents: a directory or a document leaks
 * by existing at all, whatever is written inside it. Those rules are
 * inventories — what this repository is made of — rather than lists of what
 * to refuse, for the reason given where they are declared.
 *
 * Attribution surfaces are exempt: LICENSE carries a copyright line by
 * definition, and the house address is the value the manifest's `author`
 * field is supposed to hold.
 *
 * The file set is `git ls-files --cached --others --exclude-standard`: what
 * is tracked plus what is untracked and not ignored, i.e. exactly what a
 * commit from this tree would contain.
 *
 * @note Impure — shells out to git and reads the filesystem.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir, hostname, userInfo } from "node:os";
import { basename, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

/** Addresses that are attribution, not leakage. */
const ALLOWED_EMAILS = new Set(["47156835+advl@users.noreply.github.com"]);

/** Reserved-neutral domains are always fine in fixtures. */
const NEUTRAL_EMAIL = /@example\.(com|org|net)$/;

/** Files whose whole purpose is to name a copyright holder. */
const EXEMPT_FILES = new Set(["LICENSE"]);

/**
 * Everything this repository carries directly under its root.
 *
 * Read this as an inventory, not as a blocklist, because the inversion is the
 * whole of the rule. A list of paths to refuse has to write them down, and
 * this file is published with the repository: a gate that refuses a named
 * tooling directory publishes the toolchain it exists to keep out, which is
 * the same defect as a `.gitignore` that enumerates it. Such a list is also
 * never finished — it holds the tools that existed on the day it was written
 * and passes the next one in silence.
 *
 * Declaring what belongs has neither property. It names only what a reader
 * already sees in the tree, it refuses anything that arrives later whatever
 * it is called, and it makes a new root entry a deliberate act: adding one
 * means saying so here, in the commit that adds it.
 */
const ROOT_ENTRIES = new Set([
  ".github",
  ".gitignore",
  "AGENTS.md",
  "LICENSE",
  "README.md",
  "biome.json",
  "bun.lock",
  "contract",
  "guarantees",
  "images",
  "package.json",
  "scripts",
  "src",
  "tsconfig.build.json",
  "tsconfig.json",
  "vitest.config.ts",
]);

/**
 * The hidden directories anything below the root may carry.
 *
 * The same inventory, one level in. Everywhere below the root a dot-prefixed
 * name is refused, because that is the shape editor, machine and agent
 * tooling arrives in and none of it belongs in a published tree. The set is
 * empty: no tool this package uses keeps a hidden directory beside the code
 * it configures. A name enters here by being declared, which keeps the
 * refusal total for everything else.
 */
const HIDDEN_ENTRIES = new Set<string>();

/**
 * The documents a directory may address its reader with.
 *
 * A capitalised stem and either a markdown extension or none is how the
 * ecosystem marks a file written for whoever opens the directory — and it is
 * also how every agent harness marks the file it reads on the way in. That
 * shared convention is what makes the rule general: the legitimate members
 * are a short closed set, so asking for membership refuses a dropped-in
 * instruction file under any name, including names that do not exist yet.
 *
 * The stem test is what keeps it off ordinary code. A module named for the
 * constant it exports is capitalised too, so the rule reaches only basenames
 * whose extension is `.md` or absent.
 */
const REPOSITORY_DOCUMENTS = new Set([
  "AGENTS.md",
  "CHANGELOG.md",
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "PULL_REQUEST_TEMPLATE.md",
  "README.md",
  "SECURITY.md",
]);

const SHOUTING_STEM = /^[A-Z][A-Z0-9_]{2,}$/;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/**
 * An uppercase prefix, a hyphen and a number: the shape a tracker ticket, a
 * decision record and a session code all take. Bounded on the left so that
 * an already hyphenated identifier is never read as a new one, which is what
 * keeps `BSD-3-Clause` and `CC-BY-4.0` out of the results. A path separator
 * is deliberately not in that class: an identifier standing as a URL path
 * segment is the most common way one is cited, and it is still one.
 */
const RECORD_ID = /(?<![A-Za-z0-9._%+\-@])[A-Z]{2,6}-\d{1,6}(?![A-Za-z0-9])/g;

/**
 * An uppercase prefix, a dot and a number: the shape a numbered ruling in a
 * decision record takes. Bounded on both sides so that a version such as
 * `ES2023` or a filename such as `README.md` is never read as one, and, as
 * above, a path separator does not bound it.
 */
const RULING_ID = /(?<![A-Za-z0-9._%+\-@])[A-Z]{2,6}\.\d{1,4}(?![A-Za-z0-9])/g;

/**
 * The word `session`, a separator and an identifier with a digit in it: the
 * shape a hosted session, a support case and a recorded conversation are all
 * addressed by, whatever host minted them. The digit is what keeps an
 * ordinary compound such as `session-storage` out of the results, and the
 * length is what keeps out a short word.
 */
const SESSION_CODE =
  /\bsession[_-](?=[A-Za-z0-9]*\d)[A-Za-z0-9]{6,}(?![A-Za-z0-9])/gi;

/**
 * Words that place this code in relation to some other code, or that mark
 * it as unfinished. Assembled from parts, like the probes, because this file
 * is inside the scanned set and the words themselves are what it refuses.
 */
const REGISTER_WORDS = [
  ["re", "write"].join(""),
  ["re", "written"].join(""),
  `${["re", "implement"].join("")}\\w*`,
  ["leg", "acy"].join(""),
  ["por", "ted"].join(""),
  ["par", "ity"].join(""),
  ["the ", "tw", "in"].join(""),
  ["TO", "DO"].join(""),
  ["w", "ip"].join(""),
];

const REGISTER = new RegExp(`\\b(?:${REGISTER_WORDS.join("|")})\\b`, "gi");

/**
 * Prefixes that name a public standard or licence family rather than a
 * record someone has to be given access to. These are the identifiers a
 * reader can resolve for themselves, which is the whole distinction the rule
 * draws.
 */
const STANDARD_ID_PREFIXES = new Set([
  "AES",
  "AGPL",
  "ANSI",
  "APACHE",
  "BSD",
  "CC",
  "CVE",
  "CWE",
  "ECMA",
  "EPL",
  "FIPS",
  "GPL",
  "HTTP",
  "IEC",
  "IEEE",
  "ISO",
  "LGPL",
  "MIT",
  "MPL",
  "NIST",
  "RFC",
  "RSA",
  "SHA",
  "TLS",
  "UTF",
]);

type Rule = {
  readonly label: string;
  /** Every violation `text` carries. */
  readonly hits: (text: string) => string[];
  /** The files this rule reads; every scanned file when absent. */
  readonly appliesTo?: (file: string) => boolean;
  /**
   * Strings this rule must flag, one per shape the rule exists to catch.
   * Assembled from parts rather than written out, because this file is
   * inside the scanned set: a literal violation here would be found by the
   * very scan it exists to prove.
   */
  readonly probes: readonly string[];
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every match of `pattern`, less those `allow` waves through. */
const matching =
  (pattern: RegExp, allow?: (hit: string) => boolean) =>
  (text: string): string[] => {
    const found: string[] = [];
    for (const hit of text.matchAll(pattern)) {
      if (allow?.(hit[0])) continue;
      found.push(hit[0]);
    }
    return found;
  };

const FENCE = /^\s*(?:```|~~~)/;

/** A line that is not paragraph text: a heading, a list item or a table row. */
const NOT_PROSE = /^\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|\|)/;

/**
 * Every second line of a paragraph broken across lines, in a markdown
 * document. Blank lines, headings, list items, table rows and fenced code
 * end a paragraph; anything else that follows a line of paragraph text is a
 * wrap.
 */
const wrappedParagraphs = (text: string): string[] => {
  const found: string[] = [];
  let fenced = false;
  let previousWasProse = false;
  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (FENCE.test(line)) {
      fenced = !fenced;
      previousWasProse = false;
      continue;
    }
    const prose = !fenced && line.trim() !== "" && !NOT_PROSE.test(line);
    if (prose && previousWasProse) found.push(`line ${index + 1}`);
    previousWasProse = prose;
  }
  return found;
};

/**
 * Where an account or machine name is evidence of leakage.
 *
 * A bare word match is unusable as a gate, because these names are not
 * distinctive words. On a hosted runner the account is literally `runner`,
 * so a word-boundary match on it hits `${{ runner.os }}`, `task-runner` and
 * `@vitest/runner`, and fails every pipeline run — and the same holds locally
 * for any account or host called `debian`, `docker`, `build` or `admin`.
 * What leakage actually looks like is a name standing in a path or in an
 * address, so the pattern is anchored to exactly those three shapes:
 *
 *   - a home-directory path segment, `<home>/<name>` on any of the three
 *     platforms, or `~/<name>`,
 *   - the local part of an address, `<name>@host.tld`,
 *   - the host part of an address or URL, `user@<name>` or `scheme://<name>`.
 *
 * Every anchor is bounded on both sides so that a longer name merely
 * containing this one does not match, and so that an npm scope — which is
 * always followed by `/` — is never mistaken for a host.
 */
const identityPattern = (name: string) => {
  const escaped = escapeRegExp(name);
  // Nothing that would make this a path, package or address fragment instead.
  const free = "(?<![A-Za-z0-9._%+\\-/@])";
  return new RegExp(
    [
      `(?:/home/|/Users/|\\\\Users\\\\|~/)${escaped}(?![A-Za-z0-9_-])`,
      `${free}${escaped}@[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)*\\.[A-Za-z]{2,}`,
      `(?:@|://)${escaped}(?![A-Za-z0-9_/-])`,
    ].join("|"),
    "gi",
  );
};

const rules: Rule[] = [
  {
    label: "home directory path",
    hits: matching(new RegExp(escapeRegExp(homedir()), "g")),
    probes: [`${homedir()}/notes.txt`],
  },
  {
    label: "home directory prefix",
    hits: matching(/\/home\/[a-z]|\/Users\/[A-Za-z]|C:\\Users\\/g),
    probes: [["", "home", "someone", "notes.txt"].join("/")],
  },
  {
    label: "e-mail address",
    hits: matching(
      EMAIL,
      (hit) => ALLOWED_EMAILS.has(hit) || NEUTRAL_EMAIL.test(hit),
    ),
    probes: [["someone", "@", "elsewhere", ".", "invalid"].join("")],
  },
  {
    label: "tracker or decision-record identifier",
    hits: matching(RECORD_ID, (hit) =>
      STANDARD_ID_PREFIXES.has(hit.split("-")[0] ?? ""),
    ),
    probes: [
      ["ZZ", "-", "1"].join(""),
      ["https://tracker.example/issue/", "ZZ", "-", "1"].join(""),
    ],
  },
  {
    label: "decision-record ruling identifier",
    hits: matching(RULING_ID),
    probes: [
      ["ZZ", ".", "1"].join(""),
      ["https://records.example/", "ZZ", ".", "1"].join(""),
    ],
  },
  {
    label: "session code",
    hits: matching(SESSION_CODE),
    probes: [
      ["session", "_", "0123abcdef"].join(""),
      ["https://host.example/", "session", "-", "0123abcdef"].join(""),
    ],
  },
  {
    label: "planning-repository document path",
    hits: matching(
      /(?<![A-Za-z0-9._\-/])(?:planning|code-standards)\/[A-Za-z0-9._\-/]*\.md\b/g,
    ),
    probes: [["planning", "/", "somewhere/note.md"].join("")],
  },
  {
    label: "external standards-corpus reference",
    hits: matching(/\bcso?:[a-z][A-Za-z0-9_.]*/g),
    probes: [["cs", ":", "some.rule"].join("")],
  },
  {
    label: "predecessor vocabulary or hesitation marker",
    hits: matching(REGISTER),
    probes: [
      ["re", "write"].join(""),
      ["leg", "acy"].join(""),
      ["TO", "DO"].join(""),
    ],
  },
  {
    label: "markdown paragraph broken across lines",
    hits: wrappedParagraphs,
    appliesTo: (file) => file.endsWith(".md"),
    probes: [
      ["one line of a paragraph", "and the line it wraps onto"].join("\n"),
    ],
  },
];

// A username or hostname is only a useful signal when it is long enough to be
// distinctive; a two-character host name would match half the corpus.
const username = userInfo().username;
if (username.length >= 4) {
  rules.push({
    label: "local account name",
    hits: matching(identityPattern(username)),
    probes: [`~/${username}/notes.txt`],
  });
}

const host = hostname().split(".")[0] ?? "";
if (host.length >= 4 && host !== "localhost") {
  rules.push({
    label: "machine hostname",
    hits: matching(identityPattern(host)),
    probes: [`ssh://${host}`],
  });
}

/**
 * A rule about a path rather than about what a file contains.
 *
 * Kept in the same shape as the content rules, and proven the same way, so
 * that neither kind can be silently broken.
 */
type PathRule = {
  readonly label: string;
  /** Every violation the path itself carries. */
  readonly hits: (file: string) => string[];
  /** Paths this rule must flag. */
  readonly probes: readonly string[];
};

const pathRules: PathRule[] = [
  {
    label: "undeclared root entry",
    hits: (file) => {
      const entry = file.split("/")[0] ?? "";
      return ROOT_ENTRIES.has(entry) ? [] : [entry];
    },
    probes: [["undeclared", "file.txt"].join("/")],
  },
  {
    label: "hidden entry below the root",
    hits: (file) =>
      file
        .split("/")
        .slice(1)
        .filter(
          (segment) => segment.startsWith(".") && !HIDDEN_ENTRIES.has(segment),
        ),
    probes: [["src", ".hidden", "file.txt"].join("/")],
  },
  {
    label: "undeclared document",
    hits: (file) => {
      const base = file.split("/").at(-1) ?? "";
      const [stem = "", ...extensions] = base.split(".");
      const addressesTheReader =
        SHOUTING_STEM.test(stem) &&
        (extensions.length === 0 || extensions.at(-1) === "md");
      return addressesTheReader && !REPOSITORY_DOCUMENTS.has(base)
        ? [base]
        : [];
    },
    probes: [["ZZZ", "md"].join(".")],
  },
];

/** Every violation `text` carries, as `<label> — <hit>` lines. */
const scan = (file: string, text: string): string[] => {
  const found: string[] = [];
  for (const { label, hits, appliesTo } of rules) {
    if (appliesTo && !appliesTo(file)) continue;
    for (const hit of hits(text)) found.push(`${label} — ${hit}`);
  }
  return found;
};

// A rule that matches nothing reports a clean tree, which is indistinguishable
// from a rule that is silently broken — and a gate is only worth its runtime
// if it has been seen to fail. So every rule is first run against each string
// built to violate it, and nothing is scanned until all of them have.
const unproven = rules.filter(({ hits, probes }) =>
  probes.some((probe) => hits(probe).length === 0),
);
if (unproven.length > 0) {
  console.error("check:leakage selftest failed — these rules match nothing:\n");
  for (const { label } of unproven) console.error(`  ${label}`);
  process.exit(1);
}

const unprovenPaths = pathRules.filter(({ hits, probes }) =>
  probes.some((probe) => hits(probe).length === 0),
);
if (unprovenPaths.length > 0) {
  console.error(
    "check:leakage selftest failed — these path rules match nothing:\n",
  );
  for (const { label } of unprovenPaths) console.error(`  ${label}`);
  process.exit(1);
}

const listed = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: root, encoding: "utf8" },
);
const files = listed.split("\0").filter(Boolean);

const failures: string[] = [];

for (const file of files) {
  for (const { label, hits } of pathRules) {
    for (const hit of hits(file)) failures.push(`${file}: ${label} — ${hit}`);
  }

  if (EXEMPT_FILES.has(basename(file))) continue;

  let text: string;
  try {
    text = readFileSync(resolve(root, file), "utf8");
  } catch {
    continue; // unreadable — nothing to grep
  }
  if (text.includes("\0")) continue; // binary

  for (const hit of scan(file, text)) failures.push(`${file}: ${hit}`);
}

if (failures.length > 0) {
  console.error("Identity or external references found in committed files:\n");
  for (const failure of failures) console.error(`  ${failure}`);
  console.error(
    "\nUse reserved-neutral names (example.com, @example/*) in fixtures, keep",
  );
  console.error(
    "editor or agent tooling in your global git ignore file, copy a record's",
  );
  console.error(
    "rationale in rather than citing the record, and write each markdown",
  );
  console.error("paragraph on one line.");
  process.exit(1);
}

console.log(`check:leakage — ${files.length} files clean`);
