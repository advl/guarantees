import { vi } from "vitest";

/** What a registration left behind: the suites it opened and the tests it declared, by title. */
export type Registered = {
  readonly suites: readonly string[];
  readonly tests: ReadonlyMap<string, () => unknown>;
};

/**
 * Runs a registration body against a replaced runner and hands back what it
 * registered, its `beforeAll` hooks already awaited.
 *
 * A body that registers assertions cannot be watched by running it: a
 * fixture broken on purpose would turn this package's own suite red for
 * reporting exactly what it was built to report. Registered under a replaced
 * runner, every title and every assertion is a value instead, so a fixture
 * broken in one direction can be required to fail one titled assertion and
 * no other — which is the wiring from a finder to a title, and the one part
 * of these bodies a fixture that agrees with itself can never watch.
 *
 * The module is imported inside, after the replacement is in place, because
 * a body binds the runner's functions at load.
 *
 * @note Impure — replaces the `vitest` module for one dynamic import and
 * runs whatever the body registered as a hook.
 */
export default async function captureRegistration<T>(
  load: () => Promise<{ readonly default: T }>,
  call: (body: T) => void,
): Promise<Registered> {
  const suites: string[] = [];
  const tests = new Map<string, () => unknown>();
  const hooks: (() => unknown)[] = [];
  vi.resetModules();
  vi.doMock("vitest", async () => ({
    ...(await vi.importActual<typeof import("vitest")>("vitest")),
    beforeAll: (hook: () => unknown) => {
      hooks.push(hook);
    },
    describe: (name: string, body: () => void) => {
      suites.push(name);
      body();
    },
    it: (name: string, body: () => unknown) => {
      tests.set(name, body);
    },
  }));
  try {
    const { default: body } = await load();
    call(body);
    for (const hook of hooks) await hook();
  } finally {
    vi.doUnmock("vitest");
    vi.resetModules();
  }
  return { suites, tests };
}
