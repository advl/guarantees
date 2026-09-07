/**
 * Runs `attempt` and returns the refusal it throws, so a test can read the
 * refusal's fields. An attempt that throws something else re-throws it, and
 * one that does not throw fails the test: a refusal test that passes on a
 * register that parsed is the test that would let the guard rot.
 */
export default function catchRefusal<T extends Error>(
  kind: new (...args: never[]) => T,
  attempt: () => unknown,
): T {
  try {
    attempt();
  } catch (error) {
    if (error instanceof kind) return error;
    throw error;
  }
  throw new Error(`expected a ${kind.name} and nothing was thrown`);
}
