import { defineConfig, devices } from "@playwright/test";

const appPort = Number(process.env.PMS_E2E_PORT || 3001);
const mockBackendPort = Number(process.env.PMS_E2E_BACKEND_PORT || 4334);
const baseURL = `http://127.0.0.1:${appPort}`;
const mockBackendURL = `http://127.0.0.1:${mockBackendPort}`;

export default defineConfig({
  testDir: "./__tests__/e2e",
  timeout: 45_000,
  updateSnapshots: "none",
  snapshotPathTemplate:
    "{testDir}/__screenshots__/{platform}/{projectName}/{arg}{ext}",
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      scale: "css",
      maxDiffPixelRatio: 0.001,
    },
  },
  fullyParallel: false,
  // A single shared Next.js development server compiles routes on demand. Keep
  // the browser projects serialized so two projects cannot race the first
  // compilation of the same server-rendered route.
  workers: 1,
  reporter: [
    ["list"],
    [
      "html",
      {
        outputFolder: "../../node_modules/.cache/pms-playwright-report",
        open: "never",
      },
    ],
  ],
  outputDir: "../../node_modules/.cache/pms-playwright-results",
  use: {
    baseURL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    colorScheme: "light",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "node __tests__/e2e/mockBackend.mjs",
      url: `${mockBackendURL}/health`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        PMS_E2E_BACKEND_PORT: String(mockBackendPort),
      },
    },
    {
      command: "pnpm dev",
      url: `${baseURL}/login`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        BACKEND_SERVICE_URL: mockBackendURL,
      },
    },
  ],
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 960 },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 5"],
      },
    },
  ],
});
