#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertLocalApiUrl,
  getLocalCredentials,
  runPnpm,
  validatePrerequisites,
} from "./database.mjs";

const JOURNEY_SESSION_SECRET = "journeys-local-session-secret-synthetic-only";

export function buildJourneyEnvironment(
  { apiUrl, serviceRoleKey },
  baseEnvironment = process.env,
) {
  if (!serviceRoleKey) {
    throw new Error(
      "A chave local do Supabase não foi informada.\nCorreção: execute pnpm db:stop e pnpm db:start.",
    );
  }
  return {
    ...baseEnvironment,
    SUPABASE_URL: assertLocalApiUrl(apiUrl),
    SUPABASE_SECRET_KEY: serviceRoleKey,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    AUTH_SESSION_SECRET: JOURNEY_SESSION_SECRET,
    LOCAL_TRAINING_ENABLED: "true",
    PMS_DEV_KEEP_ROUTES: "true",
  };
}

export function parseJourneyArguments(argv) {
  return argv.filter((argument) => argument !== "--");
}

function main(argv) {
  validatePrerequisites();
  const environment = buildJourneyEnvironment(
    getLocalCredentials({ allowDerivedKey: true }),
  );

  const shared = runPnpm(["--filter", "@hotel/shared", "build"], {
    capture: true,
    env: environment,
  });
  if (shared.status !== 0) {
    throw new Error(
      "A compilação de @hotel/shared falhou.\nCorreção: execute pnpm --filter @hotel/shared build e revise o erro.",
    );
  }

  const playwright = runPnpm(
    [
      "--filter",
      "@hotel/pms",
      "exec",
      "playwright",
      "test",
      "--config",
      "playwright.journeys.config.ts",
      ...parseJourneyArguments(argv),
    ],
    { env: environment },
  );
  process.exitCode = playwright.status ?? 1;
}

const invokedFile = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedFile === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
