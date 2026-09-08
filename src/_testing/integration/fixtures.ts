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
