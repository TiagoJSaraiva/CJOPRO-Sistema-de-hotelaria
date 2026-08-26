import { defineConfig, devices } from "@playwright/test";

const appPort = Number(process.env.PMS_E2E_PORT || 3001);
const mockBackendPort = Number(process.env.PMS_E2E_BACKEND_PORT || 4334);
const baseURL = `http://127.0.0.1:${appPort}`;
const mockBackendURL = `http://127.0.0.1:${mockBackendPort}`;

export default defineConfig({
  testDir: "./__tests__/e2e",
  timeout: 45_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  reporter: [["list"]],
  outputDir: "../../node_modules/.cache/pms-playwright-results",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: [
    {
      command: "node __tests__/e2e/mockBackend.mjs",
      url: `${mockBackendURL}/health`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        PMS_E2E_BACKEND_PORT: String(mockBackendPort)
      }
    },
    {
      command: "pnpm dev",
      url: `${baseURL}/login`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        BACKEND_SERVICE_URL: mockBackendURL
      }
    }
  ],
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 960 }
      }
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 5"]
      }
    }
  ]
});
