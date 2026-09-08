import { defineConfig } from "vitest/config";

const INTEGRATION = "src/_testing/integration";

export default defineConfig({
  test: {
    projects: [
      // Everything that runs without an engine: `vitest run --project unit`
      // is the suite on a machine with nothing to start a container with.
      {
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: [`${INTEGRATION}/**`],
        },
      },
      // Everything that runs against the real engine, one file at a time:
      // the files share one engine and one image store. The deadline per
      // test is wide because a test here builds and runs containers.
      {
        test: {
          name: "integration",
          include: [`${INTEGRATION}/**/*.test.ts`],
          fileParallelism: false,
          testTimeout: 180_000,
          hookTimeout: 120_000,
          globalSetup: ["src/_testing/prepareEngine.ts"],
        },
      },
    ],
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
