import { defineConfig, devices } from "@playwright/test";

const appPort = Number(process.env.PUBLIC_E2E_PORT || 3000);
const apiPort = Number(process.env.PUBLIC_E2E_API_PORT || 4333);
const baseURL = `http://127.0.0.1:${appPort}`;
const apiURL = `http://127.0.0.1:${apiPort}`;

export default defineConfig({
  testDir: "./__tests__/e2e",
  timeout: 45_000,
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  outputDir: "../../node_modules/.cache/public-playwright-results",
  use: { baseURL, locale: "pt-BR", timezoneId: "America/Sao_Paulo" },
  webServer: [
    {
      command: "node __tests__/e2e/mockBookingApi.mjs",
      url: `${apiURL}/health`,
      reuseExistingServer: false,
      env: { PUBLIC_E2E_API_PORT: String(apiPort) },
    },
    {
      command: `pnpm exec next dev --port ${appPort}`,
      url: baseURL,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { NEXT_PUBLIC_BOOKING_API_URL: apiURL },
    },
  ],
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 5"] } },
  ],
});
