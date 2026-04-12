import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@hotel/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url))
    }
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./__tests__/setup.ts"],
    include: ["__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "./coverage"
    }
  }
});