import { defineConfig, devices } from "@playwright/test";

// Jornadas no sistema real: navegador, PMS, site público, backend, booking engine
// e Supabase local. Use `pnpm test:journeys`, que valida o destino e fornece as
// credenciais locais. Portas próprias evitam colisão com os serviços de `pnpm dev`.
const supabaseUrl = process.env.SUPABASE_URL || "";
if (!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(supabaseUrl)) {
  throw new Error(
    "As jornadas exigem o Supabase local. Execute-as com pnpm test:journeys.",
  );
}

const pmsPort = Number(process.env.JOURNEY_PMS_PORT || 4101);
const backendPort = Number(process.env.JOURNEY_BACKEND_PORT || 4102);
const publicPort = Number(process.env.JOURNEY_PUBLIC_PORT || 4103);
const bookingPort = Number(process.env.JOURNEY_BOOKING_PORT || 4104);

const pmsUrl = `http://127.0.0.1:${pmsPort}`;
const backendUrl = `http://127.0.0.1:${backendPort}`;
const publicUrl = `http://127.0.0.1:${publicPort}`;
const bookingUrl = `http://127.0.0.1:${bookingPort}`;
const allowedOrigins = [pmsUrl, publicUrl, bookingUrl].join(",");

export default defineConfig({
  testDir: "./__tests__/journeys",
  testMatch: "*.spec.ts",
  timeout: 300_000,
  updateSnapshots: "none",
  expect: { timeout: 20_000 },
  fullyParallel: false,
  // Cada jornada recria o banco local compartilhado.
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    [
      "html",
      {
        outputFolder: "../../node_modules/.cache/pms-journeys-report",
        open: "never",
      },
    ],
  ],
  outputDir: "../../node_modules/.cache/pms-journeys-results",
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 960 },
    baseURL: pmsUrl,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    colorScheme: "light",
    actionTimeout: 30_000,
    navigationTimeout: 120_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command:
        "pnpm --filter @hotel/backend-service exec tsx ../pms/__tests__/journeys/realBackend.mjs",
      url: `${backendUrl}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { PORT: String(backendPort), ALLOWED_ORIGINS: allowedOrigins },
    },
    {
      command:
        "pnpm --filter @hotel/booking-engine-service exec tsx src/index.ts",
      url: `${bookingUrl}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { PORT: String(bookingPort), ALLOWED_ORIGINS: allowedOrigins },
    },
    {
      command: `pnpm exec next dev --port ${pmsPort}`,
      url: `${pmsUrl}/login`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { BACKEND_SERVICE_URL: backendUrl, PUBLIC_SITE_URL: publicUrl },
    },
    {
      command: `pnpm --filter @hotel/public exec next dev --port ${publicPort}`,
      url: publicUrl,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { NEXT_PUBLIC_BOOKING_API_URL: bookingUrl },
    },
  ],
});
