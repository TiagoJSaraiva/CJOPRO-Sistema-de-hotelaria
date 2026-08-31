import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@hotel/shared": fileURLToPath(
        new URL("../../packages/shared/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    globals: true,
    maxWorkers: 2,
    setupFiles: ["./__tests__/setup.ts"],
    include: ["__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts"],
      reporter: ["text-summary", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      reportOnFailure: true,
      thresholds: {
        autoUpdate: false,
        perFile: false,
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
