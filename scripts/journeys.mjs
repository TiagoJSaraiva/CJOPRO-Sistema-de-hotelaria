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
const SWEEP_FILE = "sweep-pages";

/**
 * Arquivos que também rodam sobre o build de produção do PMS. A varredura roda só lá. As lições 7 a 9 rodam
 * nas duas fases: em produção, elas reproduziam o QA-095, a tela parada depois de ações, que `next dev` não mostra.
 */
export const PRODUCTION_JOURNEYS = [
  SWEEP_FILE,
  "lesson-07-inventory",
  "lesson-08-procurement",
  "lesson-09-cash-close",
];
const PRODUCTION_LESSON_TITLES = [
  "lição 7: posições, lotes, contagem e reposição do frigobar",
  "lição 8: da reposição à conta do fornecedor",
  "lição 9: sessão, contagem cega e fechamento diário",
];

function filterReachesProduction(filter) {
  if (/varredura/i.test(filter)) return true;
  try {
    const pattern = new RegExp(filter, "i");
    return PRODUCTION_LESSON_TITLES.some((title) => pattern.test(title));
  } catch {
    // Na dúvida, roda: a fase sem teste correspondente termina vazia.
    return true;
  }
}

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
    // Validado aqui uma vez; o treinamento reaproveita sem chamar a CLI de novo (QA-096).
    SUPABASE_LOCAL_VALIDATED_URL: assertLocalApiUrl(apiUrl),
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

/**
 * A varredura roda sobre o build de produção do PMS: em `next dev`, ela compila cada rota na primeira visita e
 * reinicia por memória, o que custava mais de uma hora. As jornadas seguem em dev, onde os avisos de hidratação
 * aparecem; o custo delas é o reset do banco. As de PRODUCTION_JOURNEYS rodam também em produção.
 */
export function journeyPhases(argv) {
  const args = parseJourneyArguments(argv);
  const paths = args.filter(
    (argument) =>
      !argument.startsWith("-") &&
      /\.spec\b|__tests__[\\/]journeys/.test(argument),
  );
  const nameFilters = args.flatMap((argument, index) => {
    if (argument === "-g" || argument === "--grep") {
      return args[index + 1] === undefined ? [] : [args[index + 1]];
    }
    return argument.startsWith("--grep=")
      ? [argument.slice("--grep=".length)]
      : [];
  });

  const isSweepPath = (path) => path.includes(SWEEP_FILE);
  const isProductionPath = (path) =>
    PRODUCTION_JOURNEYS.some((name) => path.includes(name));
  const productionSelected =
    paths.length > 0
      ? paths.some(isProductionPath)
      : nameFilters.length === 0 || nameFilters.some(filterReachesProduction);
  const developmentSelected =
    paths.length === 0 || paths.some((path) => !isSweepPath(path));

  return [
    ...(developmentSelected ? ["development"] : []),
    ...(productionSelected ? ["production"] : []),
  ];
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

  // Roda as duas fases mesmo se a primeira falhar, para o relatório sair completo.
  let exitCode = 0;
  for (const phase of journeyPhases(argv)) {
    if (phase === "production") {
      buildPms(environment);
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
        "--pass-with-no-tests",
        ...parseJourneyArguments(argv),
      ],
      {
        env: {
          ...environment,
          JOURNEY_PMS_MODE: phase,
          JOURNEY_PRODUCTION_JOURNEYS: PRODUCTION_JOURNEYS.join(","),
        },
      },
    );
    exitCode ||= playwright.status ?? 1;
  }
  process.exitCode = exitCode;
}

function buildPms(environment) {
  const build = runPnpm(["--filter", "@hotel/pms", "build"], {
    capture: true,
    env: environment,
  });
  if (build.status !== 0) {
    throw new Error(
      "A compilação do PMS falhou.\nCorreção: execute pnpm --filter @hotel/pms build e revise o erro.",
    );
  }
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
