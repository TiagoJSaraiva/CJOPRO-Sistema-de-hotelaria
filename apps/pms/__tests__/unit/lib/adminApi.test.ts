import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn()
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock
}));

import { createHotel, deleteHotel, getUsersReferenceData, listHotels } from "../../../src/lib/adminApi";

function mockSessionToken(token: string | null) {
  cookiesMock.mockReturnValue({
    get: vi.fn(() => (token ? { value: token } : undefined))
  });
}

describe("lib/adminApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
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
      new Response(JSON.stringify({ items: [{ id: "hotel-1", name: "Hotel Centro" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
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
        currency: "BRL"
      })
    ).rejects.toThrow("Sessao invalida. Faca login novamente.");
  });

  it("createHotel propaga mensagem de erro do backend", async () => {
    mockSessionToken("token-123");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Slug ja utilizado por outro hotel." }), {
        status: 409,
        headers: { "Content-Type": "application/json" }
      })
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
        currency: "BRL"
      })
    ).rejects.toThrow("Slug ja utilizado por outro hotel.");
  });

  it("deleteHotel retorna null quando backend confirma exclusao", async () => {
    mockSessionToken("token-123");

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await deleteHotel("hotel-1");

    expect(result).toBeNull();
  });

  it("getUsersReferenceData falha com mensagem padrao quando backend responde erro sem payload", async () => {
    mockSessionToken("token-123");

    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getUsersReferenceData()).rejects.toThrow("Falha na consulta administrativa.");
  });
});