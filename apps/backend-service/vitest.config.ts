import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@hotel/shared/api-contract": fileURLToPath(
        new URL("../../packages/shared/src/api-contract.ts", import.meta.url),
      ),
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
    exclude: ["__tests__/database/**"],
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
        statements: 27,
        branches: 23,
        functions: 36,
        lines: 28,
      },
    },
  },
});
