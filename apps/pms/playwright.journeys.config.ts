import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

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

// Eventos do backend real; o caminho precisa ser o mesmo no servidor e nos testes.
process.env.JOURNEY_BACKEND_LOG = resolve(
  process.cwd(),
  "../../node_modules/.cache/pms-journeys-backend.jsonl",
);

// A varredura e as lições de PRODUCTION_JOURNEYS rodam sobre o build de produção, e as jornadas em dev:
// scripts/journeys.mjs executa uma fase de cada vez. Pastas próprias, porque cada execução limpa as da anterior.
const productionPhase = process.env.JOURNEY_PMS_MODE === "production";
// A lista vem de PRODUCTION_JOURNEYS em scripts/journeys.mjs: o Playwright não importa aquele módulo ESM.
const productionJourneys = (process.env.JOURNEY_PRODUCTION_JOURNEYS || "")
  .split(",")
  .filter(Boolean);
if (productionPhase && !productionJourneys.length) {
  throw new Error(
    "A fase de produção das jornadas não recebeu a lista de arquivos. Execute pnpm test:journeys.",
  );
}
const outputName = productionPhase ? "pms-journeys-production" : "pms-journeys";

export default defineConfig({
  testDir: "./__tests__/journeys",
  ...(productionPhase
    ? { testMatch: productionJourneys.map((name) => `${name}.spec.ts`) }
    : { testMatch: "*.spec.ts", testIgnore: "sweep-pages.spec.ts" }),
  timeout: 600_000,
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
        outputFolder: `../../node_modules/.cache/${outputName}-report`,
        open: "never",
      },
    ],
  ],
  outputDir: `../../node_modules/.cache/${outputName}-results`,
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
        "pnpm --filter @hotel/backend-service exec tsx __tests__/journeys/realBackend.mjs",
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
      command: `pnpm exec next ${productionPhase ? "start" : "dev"} --port ${pmsPort}`,
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
