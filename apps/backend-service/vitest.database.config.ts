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
    include: ["__tests__/database/**/*.test.ts"],
    setupFiles: ["./__tests__/setup.ts"],
    maxWorkers: 1,
    minWorkers: 1,
    fileParallelism: false,
    sequence: {
      concurrent: false
    }
  }
});
