import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_HOTEL_HEADER_NAME,
  PERMISSIONS,
  type SessionPayload,
  type TrainingEnvironment,
} from "@hotel/shared";
import { signToken } from "../../src/auth/session";
import type { TrainingRepository } from "../../src/repositories/trainingRepository";
import {
  localTrainingEnabled,
  registerTrainingRoutes,
} from "../../src/routes/trainingRoutes";
import { registerLocalTrainingRoutes } from "../../src/app";

const HOTEL_ID = "10000000-0000-4000-8000-000000000001";
const USER_ID = "80000000-0000-4000-8000-000000000002";
const apps: ReturnType<typeof Fastify>[] = [];
const environment: TrainingEnvironment = {
  hotel_id: HOTEL_ID,
  timezone: "America/Sao_Paulo",
  scenario_key: "orientation",
  scenario_version: 1,
  clock_mode: "frozen",
  frozen_at: "2026-09-19T12:00:00.000Z",
  operational_now: "2026-09-19T12:00:00.000Z",
  real_now: "2026-09-20T12:00:00.000Z",
  version: 2,
  updated_by: USER_ID,
  updated_at: "2026-09-20T12:00:00.000Z",
};

function authHeaders(permissions: string[] = []) {
  const now = Math.floor(Date.now() / 1000);
  const session: SessionPayload = {
    id: USER_ID,
    name: "Gerente",
    email: "gerente.aurora@hotelaria.local",
    tenantId: null,
    roles: ["Gerente"],
    permissions,
    roleAssignments: [
      {
        roleId: "role",
        roleName: "Gerente",
        roleType: "HOTEL_ROLE",
        hotelId: HOTEL_ID,
        hotelName: "Hotel Aurora",
      },
    ],
    iat: now,
    exp: now + 3600,
  };
  return {
    authorization: `Bearer ${signToken(session)}`,
    [ACTIVE_HOTEL_HEADER_NAME]: HOTEL_ID,
  };
}

async function setup(overrides: Partial<TrainingRepository> = {}) {
  const repository: TrainingRepository = {
    getEnvironment: vi.fn(async () => environment),
    actClock: vi.fn(async () => ({ result: "ok", environment })),
    ...overrides,
  };
  const app = Fastify();
  registerTrainingRoutes(app, repository);
  await app.ready();
  apps.push(app);
  return { app, repository };
}

afterEach(async () => {
  while (apps.length) await apps.pop()!.close();
  vi.unstubAllEnvs();
});

describe("capacidade local de treinamento", () => {
  it("recusa produção e qualquer Supabase remoto", () => {
    expect(() =>
      localTrainingEnabled({
        LOCAL_TRAINING_ENABLED: "true",
        NODE_ENV: "production",
        SUPABASE_URL: "http://127.0.0.1:54321",
      }),
    ).toThrow(/produção/);
    expect(() =>
      localTrainingEnabled({
        LOCAL_TRAINING_ENABLED: "true",
        NODE_ENV: "test",
        SUPABASE_URL: "https://example.supabase.co",
      }),
    ).toThrow(/Supabase local/);
    expect(
      localTrainingEnabled({
        LOCAL_TRAINING_ENABLED: "true",
        NODE_ENV: "test",
        SUPABASE_URL: "http://localhost:54321",
      }),
    ).toBe(true);
  });

  it("does not register the training routes when the local flag is disabled", async () => {
    vi.stubEnv("LOCAL_TRAINING_ENABLED", "false");
    const app = Fastify();
    apps.push(app);
    expect(registerLocalTrainingRoutes(app)).toBe(false);
    await app.ready();

    expect(
      (await app.inject({ url: "/admin/training/environment" })).statusCode,
    ).toBe(404);
  });

  it("protege a leitura por autenticação, permissão e hotel ativo", async () => {
    const { app, repository } = await setup();
    expect(
      (await app.inject({ url: "/admin/training/environment" })).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          url: "/admin/training/environment",
          headers: authHeaders([]),
        })
      ).statusCode,
    ).toBe(403);
    expect(repository.getEnvironment).not.toHaveBeenCalled();
  });

  it("encaminha ação versionada no escopo do hotel ativo", async () => {
    const { app, repository } = await setup();
    const response = await app.inject({
      method: "POST",
      url: "/admin/training/clock/actions",
      headers: authHeaders([PERMISSIONS.TRAINING_ENVIRONMENT_MANAGE]),
      payload: {
        action: "advance",
        amount: 1,
        unit: "days",
        expected_version: 2,
        reason: "Avançar a lição",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(repository.actClock).toHaveBeenCalledWith(
      HOTEL_ID,
      USER_ID,
      expect.objectContaining({ action: "advance", amount: 1 }),
    );
  });
});
