import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // No filename carve-out for type-only modules. A module that declares
      // only types emits no statements, so v8 records it as 0/0 and it cannot
      // drag the percentages down — excluding `**/types.ts` would buy nothing
      // except a hole any runtime value dropped into such a file falls
      // straight through.
      exclude: ["**/*.test.ts", "**/*.d.ts"],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
