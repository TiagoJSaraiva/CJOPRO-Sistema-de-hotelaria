import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic", importSource: "react" } },
  test: {
    environment: "jsdom",
    include: ["__tests__/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: ["src/app/**/*.{ts,tsx}"],
      exclude: ["src/app/**/page.tsx", "src/app/layout.tsx"],
      reporter: ["text-summary", "json-summary", "lcov"],
      reportsDirectory: "./coverage",
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
