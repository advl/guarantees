import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it, vi } from "vitest";
import captureRegistration from "../../_testing/captureRegistration.js";
import {
  PIPELINE,
  renderRegister,
  renderRow,
} from "../../_testing/fixtures.js";
import { parseRegister, type Register } from "../register/index.js";
import { _UNCOLLECTED_TITLE, UNCLAIMED_TITLE } from "./constants.js";
import { describeBijection } from "./index.js";

// The body starts the corpus's own runner in its list mode, which is a
// process start and a configuration load, and the runner's default hook
// deadline is shorter than that on a cold machine. A corpus row pays the
// same cost inside its measured window, which is what its budget covers.
vi.setConfig({ hookTimeout: 120_000 });

const packageRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

/**
 * A corpus whose tree and register agree: one row, its file, and this
 * repository's own copy of the runner resolvable from it, since the body
 * asks the corpus's runner and this package's copy never stands in.
 */
const corpusRoot = mkdtempSync(join(tmpdir(), "describe-bijection-"));
mkdirSync(join(corpusRoot, "node_modules"));
symlinkSync(
  join(packageRoot, "node_modules", "vitest"),
  join(corpusRoot, "node_modules", "vitest"),
);
writeFileSync(join(corpusRoot, "package.json"), '{ "type": "module" }\n');
writeFileSync(
  join(corpusRoot, "corpus-bijection.test.ts"),
  'import { it } from "vitest";\nit("holds", () => {});\n',
);
const register = parseRegister(
  renderRegister([
    renderRow("corpus-bijection"),
    renderRow("corpus-can-fail", {
      file: `"corpus-bijection.test.ts"`,
      expect: `"fail"`,
    }),
  ]),
  PIPELINE,
);

// Called as a corpus calls it, against a tree that agrees with its
// register, so both assertions run rather than merely being registered.
// What each finds when the two disagree is asserted over the finders, in
// both directions and without a runner.
describeBijection({ id: "corpus-bijection", corpusRoot, register });

afterAll(() => {
  rmSync(corpusRoot, { recursive: true, force: true });
});

/**
 * The wiring from each finder to the title that reports it, watched failing.
 * The registration above runs against a tree that agrees with its register,
 * where both finders answer an empty list and either could have been handed
 * to either title with nothing going red. Here the corpus's runner is
 * replaced with a scripted answer, one direction is broken at a time, and
 * exactly the title that direction belongs to is required to fail.
 */
describe("describeBijection", () => {
  const wired = async (collected: readonly string[], held: Register) => {
    vi.doMock("../runner/index.js", async () => ({
      ...(await vi.importActual<typeof import("../runner/index.js")>(
        "../runner/index.js",
      )),
      listCollected: async () => collected,
    }));
    const registered = await captureRegistration(
      () => import("./describeBijection.js"),
      (body) => {
        body({ id: "corpus-bijection", corpusRoot, register: held });
      },
    );
    vi.doUnmock("../runner/index.js");
    return registered;
  };

  it("reports a file no row claims under the title a tier's proof requires, and no other", async () => {
    const { tests } = await wired(
      ["corpus-bijection.test.ts", "nobody-claims-this.test.ts"],
      register,
    );
    expect(tests.get(UNCLAIMED_TITLE)).toThrow("belongs to no row");
    expect(tests.get(_UNCOLLECTED_TITLE)).not.toThrow();
  });

  it("reports a row the runner would not collect under the other direction's title, and no other", async () => {
    const promising = parseRegister(
      renderRegister([
        renderRow("corpus-bijection"),
        renderRow("corpus-can-fail", {
          file: `"never-collected.test.ts"`,
          expect: `"fail"`,
        }),
      ]),
      PIPELINE,
    );
    const { tests } = await wired(["corpus-bijection.test.ts"], promising);
    expect(tests.get(_UNCOLLECTED_TITLE)).toThrow("will match nothing");
    expect(tests.get(UNCLAIMED_TITLE)).not.toThrow();
  });
});
