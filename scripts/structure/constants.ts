/**
 * The members `src/` may hold, named for the kind of artifact each is: the
 * shipped-and-imported library, the shipped-and-executed binary, the
 * shipped-on-request scripts, the shipped test support. A `_` prefix marks
 * the never-shipped counterpart of any of them. Beside these, only the
 * package index, one entry module per published subpath, and the tests of
 * those files.
 */
export const MEMBERS: ReadonlySet<string> = new Set([
  "bin",
  "lib",
  "scripts",
  "testing",
]);

/** Members that are executed rather than imported: they export nothing. */
export const EXECUTABLES: ReadonlySet<string> = new Set(["bin", "scripts"]);

/**
 * Words that describe the code rather than a subject. A folder carrying one
 * says what its files are like — their visibility, their shape, their part
 * of speech, their layer — and nothing about what they are about, so a
 * stranger reading the folder list cannot place a new file in exactly one.
 */
export const PROPERTY_FOLDERS: ReadonlySet<string> = new Set([
  "commands",
  "common",
  "constants",
  "core",
  "facade",
  "helper",
  "helpers",
  "internal",
  "misc",
  "shared",
  "types",
  "util",
  "utils",
]);

/**
 * Collection files are the one lawful exception to one-default-per-file. A
 * fixtures file is a constants file by another name: static test data and
 * pure renderers, each a `const`, and never a JSON file.
 */
export const COLLECTIONS: ReadonlySet<string> = new Set([
  "types.ts",
  "constants.ts",
  "fixtures.ts",
]);

/** Objects whose `env` property is the ambient environment. */
export const ENV_HOSTS: ReadonlySet<string> = new Set([
  "process",
  "Bun",
  "Deno",
]);

/** A file this long carries a header saying why it cannot be smaller. */
export const FILE_SIZE_THRESHOLD = 500;
