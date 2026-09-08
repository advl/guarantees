/**
 * Renderers for the entry files an integration corpus holds. Each renders a
 * test file whose one suite is named after its entry, as a row's `select`
 * finds it, so a fixture corpus is a corpus the scheduler reads like any
 * other.
 */

/** A test file whose suite is `id` and whose one test runs `body` as its assertion. */
export const renderEntry = (id: string, body: string): string =>
  [
    'import { describe, expect, it } from "vitest";',
    "",
    `describe("${id}", () => {`,
    `  it("holds", async () => {`,
    `    ${body}`,
    "  });",
    "});",
    "",
  ].join("\n");

/** An entry that passes. */
export const renderPassing = (id: string): string =>
  renderEntry(id, "expect(true).toBe(true);");

/** An entry that fails on a designed assertion. */
export const renderFailing = (id: string): string =>
  renderEntry(id, "expect(false).toBe(true);");

/** An entry that sleeps past any budget the suite would give it. */
export const renderSleeping = (id: string, seconds: number): string =>
  renderEntry(
    id,
    `await new Promise((resolve) => setTimeout(resolve, ${seconds * 1000}));`,
  );

/** An entry that writes `path` and asserts the write went through. */
export const renderWriting = (id: string, path: string): string =>
  renderEntry(
    id,
    `const { writeFileSync } = await import("node:fs"); writeFileSync(${JSON.stringify(path)}, "written"); expect(true).toBe(true);`,
  );

/** An entry that resolves a host and asserts the lookup was refused. */
export const renderLookingUp = (id: string, host: string): string =>
  renderEntry(
    id,
    `const { lookup } = await import("node:dns/promises"); await expect(lookup(${JSON.stringify(host)})).rejects.toThrow();`,
  );
