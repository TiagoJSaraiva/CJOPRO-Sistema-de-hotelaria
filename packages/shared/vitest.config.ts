import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    maxWorkers: 2,
    setupFiles: ["./__tests__/setup.ts"],
    include: ["__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: ["text-summary", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      reportOnFailure: true,
      thresholds: {
        autoUpdate: false,
        perFile: false,
        statements: 81,
        branches: 75,
        functions: 87,
        lines: 81,
      },
    },
  },
});
