import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

import {
  createHotel,
  deleteHotel,
  getUsersReferenceData,
  listHotels,
  getConsumptionOperationalContext,
  getConsumptionOrder,
  listConsumptionOrders,
  listFinancialTransactions,
  listInventoryAuditEvents,
  listInventoryLocations,
  listInventoryMovements,
} from "../../../src/lib/adminApi";

function mockSessionToken(token: string | null, activeHotelId?: string | null) {
  cookiesMock.mockReturnValue({
    get: vi.fn((name: string) => {
      if (name === "pms_session_token") {
        return token ? { value: token } : undefined;
      }

      if (name === "pms_active_hotel") {
        return activeHotelId ? { value: activeHotelId } : undefined;
      }

      return undefined;
    }),
  });
}

describe("lib/adminApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe("histórico de consumo não esconde falhas", () => {
    function backendAnswers(status: number) {
      mockSessionToken("token");
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            new Response(JSON.stringify({ message: "Falha" }), { status }),
          ),
      );
    }

    it("listConsumptionOrders propaga o erro do backend", async () => {
      backendAnswers(400);
      await expect(listConsumptionOrders({ from: "x" })).rejects.toThrow();
    });

    it.each([400, 404, 500])(
      "listas propagam a falha %s em vez de parecer sem registros",
      async (status) => {
        backendAnswers(status);
        await expect(listFinancialTransactions()).rejects.toMatchObject({
          statusCode: status,
        });
      },
    );

    it("listas ficam vazias para quem não tem permissão", async () => {
      backendAnswers(403);
      await expect(listInventoryLocations()).resolves.toEqual([]);
    });

    it("listInventoryMovements propaga a falha em vez de parecer sem movimentos", async () => {
      backendAnswers(500);
      await expect(listInventoryMovements()).rejects.toThrow();
    });

    it("listInventoryAuditEvents propaga a falha em vez de parecer sem eventos", async () => {
      backendAnswers(500);
      await expect(listInventoryAuditEvents()).rejects.toThrow();
    });

    it("getConsumptionOrder trata 404 como comanda inexistente", async () => {
      backendAnswers(404);
      await expect(getConsumptionOrder("id")).resolves.toBeNull();
    });

    it("getConsumptionOrder propaga as demais falhas", async () => {
      backendAnswers(500);
      await expect(getConsumptionOrder("id")).rejects.toThrow();
    });
  });

  it("listHotels retorna lista vazia quando sessao nao existe", async () => {
    mockSessionToken(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await listHotels();

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("listHotels retorna itens quando backend responde com sucesso", async () => {
    mockSessionToken("token-123");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ items: [{ id: "hotel-1", name: "Hotel Centro" }] }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await listHotels();

    expect(result).toEqual([{ id: "hotel-1", name: "Hotel Centro" }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("createHotel falha quando token nao existe", async () => {
    mockSessionToken(null);

    await expect(
      createHotel({
        name: "Hotel Centro",
        legal_name: "Hotel Centro LTDA",
        tax_id: "04252011000110",
        slug: "hotel-centro",
        email: "admin@hotel.com",
        phone: "5511999990000",
        address_line: "Rua A",
        address_number: "100",
        address_complement: null,
        district: "Centro",
        city: "Sao Paulo",
        state: "SP",
        country: "BR",
        zip_code: "01001-000",
        timezone: "America/Sao_Paulo",
        currency: "BRL",
      }),
    ).rejects.toThrow("Sessão inválida. Faça login novamente.");
  });

  it("createHotel propaga mensagem de erro do backend", async () => {
    mockSessionToken("token-123");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ message: "Slug ja utilizado por outro hotel." }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createHotel({
        name: "Hotel Centro",
        legal_name: "Hotel Centro LTDA",
        tax_id: "04252011000110",
        slug: "hotel-centro",
        email: "admin@hotel.com",
        phone: "5511999990000",
        address_line: "Rua A",
        address_number: "100",
        address_complement: null,
        district: "Centro",
        city: "Sao Paulo",
        state: "SP",
        country: "BR",
        zip_code: "01001-000",
        timezone: "America/Sao_Paulo",
        currency: "BRL",
      }),
    ).rejects.toThrow("Slug ja utilizado por outro hotel.");
  });

  it("deleteHotel retorna null quando backend confirma exclusao", async () => {
    mockSessionToken("token-123");

    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await deleteHotel("hotel-1");

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3334/admin/hotels/hotel-1",
      {
        method: "DELETE",
        cache: "no-store",
        headers: {
          Authorization: "Bearer token-123",
        },
        body: undefined,
      },
    );
  });

  it("getUsersReferenceData falha com mensagem padrao quando backend responde erro sem payload", async () => {
    mockSessionToken("token-123");

    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getUsersReferenceData()).rejects.toThrow(
      "Falha na consulta administrativa.",
    );
  });
});

it("preserves code and details for operational context conflicts", async () => {
  mockSessionToken("token", "hotel-id");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        message: "Conflict",
        code: "CONFLICT",
        details: "occurred_before_checkin",
      }),
    }),
  );
  await expect(
    getConsumptionOperationalContext("stay-id"),
  ).rejects.toMatchObject({
    statusCode: 409,
    code: "CONFLICT",
    details: "occurred_before_checkin",
  });
});
