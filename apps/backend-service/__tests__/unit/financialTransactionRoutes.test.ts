import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_HOTEL_HEADER_NAME,
  PERMISSIONS,
  type SessionPayload,
} from "@hotel/shared";
import { signToken } from "../../src/auth/session";
import { registerFinancialTransactionRoutes } from "../../src/routes/financialTransactionRoutes";
import type { FinancialTransactionsRepository } from "../../src/repositories/financialTransactionsRepository";

const appsToClose: Array<ReturnType<typeof Fastify>> = [];

function createToken(
  permissions: string[],
  roleAssignments: SessionPayload["roleAssignments"],
): string {
  const nowInSeconds = Math.floor(Date.now() / 1000);

  return signToken({
    id: "user-1",
    name: "Admin",
    email: "admin@example.com",
    tenantId: null,
    roles: ["Admin"],
    permissions,
    roleAssignments,
    iat: nowInSeconds,
    exp: nowInSeconds + 3600,
  });
}

function createFinancialTransactionsRepositoryMock(
  overrides: Partial<FinancialTransactionsRepository> = {},
): FinancialTransactionsRepository {
  return {
    listFinancialTransactions: vi.fn(async () => []),
    createFinancialTransaction: vi.fn(async () => ({
      result: "ok",
      item: undefined,
    })),
    updateFinancialTransaction: vi.fn(async () => ({
      result: "ok",
      item: undefined,
    })),
    deleteFinancialTransaction: vi.fn(async () => "ok"),
    ...overrides,
  };
}

async function createTestApp(repository: FinancialTransactionsRepository) {
  const app = Fastify({ logger: false });
  registerFinancialTransactionRoutes(app, repository);
  await app.ready();
  appsToClose.push(app);
  return app;
}

afterEach(async () => {
  while (appsToClose.length) {
    await appsToClose.pop()!.close();
  }
});

describe("routes/financial-transactions with injected repository", () => {
  it("exige hotel ativo para listar transacoes", async () => {
    const repository = createFinancialTransactionsRepositoryMock();
    const app = await createTestApp(repository);

    const token = createToken(
      [PERMISSIONS.TRANSACTION_READ],
      [
        {
          roleId: "role-system",
          roleName: "System",
          roleType: "SYSTEM_ROLE",
          hotelId: null,
          hotelName: null,
        },
      ],
    );

    const response = await app.inject({
      method: "GET",
      url: "/admin/financial-transactions",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      code: "ADMIN_SCOPE_NOT_ALLOWED",
      message: "Selecione um hotel ativo para operar neste modulo.",
    });
    expect(repository.listFinancialTransactions).not.toHaveBeenCalled();
  });

  it("cria transacao quando payload e valido", async () => {
    const repository = createFinancialTransactionsRepositoryMock({
      createFinancialTransaction: vi.fn(async () => ({
        result: "ok",
        item: {
          id: "tx-1",
          hotel_id: "hotel-1",
          type: "INCOME",
          category: "Hospedagem",
          amount: 1200,
          currency: "BRL",
          description: null,
          status: "COMPLETED",
          created_at: "2026-05-05T00:00:00.000Z",
          updated_at: "2026-05-05T00:00:00.000Z",
        },
      })),
    });

    const app = await createTestApp(repository);

    const token = createToken(
      [PERMISSIONS.TRANSACTION_CREATE],
      [
        {
          roleId: "role-hotel",
          roleName: "Manager",
          roleType: "HOTEL_ROLE",
          hotelId: "hotel-1",
          hotelName: "Hotel 1",
        },
      ],
    );

    const response = await app.inject({
      method: "POST",
      url: "/admin/financial-transactions",
      headers: {
        authorization: `Bearer ${token}`,
        [ACTIVE_HOTEL_HEADER_NAME]: "hotel-1",
      },
      payload: {
        type: "INCOME",
        category: "Hospedagem",
        amount: 1200,
        currency: "BRL",
        status: "COMPLETED",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(repository.createFinancialTransaction).toHaveBeenCalledWith(
      "hotel-1",
      {
        type: "INCOME",
        category: "Hospedagem",
        amount: 1200,
        currency: "BRL",
        description: null,
        status: "COMPLETED",
        payment_method: null,
        paid_at: null,
        due_date: null,
        counterparty: null,
        cost_center: null,
        reference_code: null,
        stay_id: null,
        reservation_id: null,
        created_by: "user-1",
      },
    );
    expect(response.json()).toEqual({
      item: {
        id: "tx-1",
        hotel_id: "hotel-1",
        type: "INCOME",
        category: "Hospedagem",
        amount: 1200,
        currency: "BRL",
        description: null,
        status: "COMPLETED",
        created_at: "2026-05-05T00:00:00.000Z",
        updated_at: "2026-05-05T00:00:00.000Z",
      },
    });
  });

  it.each([
    ["POST", "/admin/financial-transactions", "createFinancialTransaction"],
    ["PUT", "/admin/financial-transactions/tx-1", "updateFinancialTransaction"],
    [
      "DELETE",
      "/admin/financial-transactions/tx-1",
      "deleteFinancialTransaction",
    ],
  ] as const)(
    "%s não transforma regra de caixa em falha interna",
    async (method, url, operation) => {
      const repository = createFinancialTransactionsRepositoryMock({
        [operation]: vi.fn(async () => {
          throw Object.assign(new Error("cash_session_required"), {
            code: "P0001",
          });
        }),
      });
      const app = Fastify({ logger: false });
      app.setErrorHandler((error, _request, reply) =>
        reply.status(418).send({ repassado: (error as Error).message }),
      );
      registerFinancialTransactionRoutes(app, repository);
      await app.ready();
      appsToClose.push(app);
      const response = await app.inject({
        method,
        url,
        headers: {
          authorization: `Bearer ${createToken(
            [
              PERMISSIONS.TRANSACTION_CREATE,
              PERMISSIONS.TRANSACTION_UPDATE,
              PERMISSIONS.TRANSACTION_DELETE,
            ],
            [
              {
                roleId: "role",
                roleName: "Financeiro",
                roleType: "HOTEL_ROLE",
                hotelId: "hotel-1",
                hotelName: "Hotel 1",
              },
            ],
          )}`,
          [ACTIVE_HOTEL_HEADER_NAME]: "hotel-1",
        },
        payload:
          method === "DELETE"
            ? undefined
            : method === "POST"
              ? {
                  type: "INCOME",
                  category: "MANUAL",
                  amount: 10,
                  currency: "BRL",
                  payment_method: "cash",
                }
              : { status: "COMPLETED" },
      });
      expect(response.json()).toEqual({ repassado: "cash_session_required" });
    },
  );
});
