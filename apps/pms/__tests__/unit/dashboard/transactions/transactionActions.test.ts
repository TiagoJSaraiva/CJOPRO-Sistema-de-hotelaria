import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@hotel/shared";

const mocks = vi.hoisted(() => ({
  getUserFromSession: vi.fn(),
  getHotelClock: vi.fn(),
  createFinancialTransaction: vi.fn(),
  updateFinancialTransaction: vi.fn(),
  deleteFinancialTransaction: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("../../../../src/lib/auth", () => ({
  getUserFromSession: mocks.getUserFromSession,
}));
vi.mock("../../../../src/lib/adminApi", () => ({
  getHotelClock: mocks.getHotelClock,
  createFinancialTransaction: mocks.createFinancialTransaction,
  updateFinancialTransaction: mocks.updateFinancialTransaction,
  deleteFinancialTransaction: mocks.deleteFinancialTransaction,
}));

import {
  createTransactionAction,
  updateTransactionAction,
} from "../../../../src/app/dashboard/transactions/actions";

const ID = "11111111-1111-4111-8111-111111111111";

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  const values = {
    id: ID,
    type: "EXPENSE",
    category: "Limpeza",
    amount: "100",
    currency: "BRL",
    status: "COMPLETED",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function redirectedTo() {
  return String(mocks.redirect.mock.calls.at(-1)?.[0] ?? "");
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserFromSession.mockResolvedValue({
    permissions: [
      PERMISSIONS.TRANSACTION_CREATE,
      PERMISSIONS.TRANSACTION_READ,
      PERMISSIONS.TRANSACTION_UPDATE,
    ],
  });
  mocks.createFinancialTransaction.mockResolvedValue({ id: ID });
  mocks.updateFinancialTransaction.mockResolvedValue({ id: ID });
  // Tóquio para falhar em qualquer máquina se o fuso do servidor voltar a ser usado.
  mocks.getHotelClock.mockResolvedValue({
    timezone: "Asia/Tokyo",
    operational_date: "2026-11-04",
    operational_now: "2026-11-04T03:00:00.000Z",
  });
});

describe.each([
  {
    name: "createTransactionAction",
    action: createTransactionAction,
    backend: mocks.createFinancialTransaction,
    section: "create",
    failure: "create_error",
    missing: "create_missing_fields",
  },
  {
    name: "updateTransactionAction",
    action: updateTransactionAction,
    backend: mocks.updateFinancialTransaction,
    section: "view",
    failure: "update_error",
    missing: "update_missing_fields",
  },
])("$name", ({ action, backend, section, failure, missing }) => {
  const sent = () => backend.mock.calls[0]?.at(-1) as { paid_at: unknown };

  it("recusa quem não tem permissão, sem chamar o backend", async () => {
    mocks.getUserFromSession.mockResolvedValue({ permissions: [] });
    await expect(action(form())).rejects.toThrow("REDIRECT");
    expect(redirectedTo()).toContain("status=forbidden");
    expect(backend).not.toHaveBeenCalled();
  });

  it("recusa campos obrigatórios ausentes", async () => {
    await expect(action(form({ category: "" }))).rejects.toThrow("REDIRECT");
    expect(redirectedTo()).toContain(`status=${missing}`);
    expect(backend).not.toHaveBeenCalled();
  });

  it("envia pagamento vazio como nulo, sem consultar o relógio", async () => {
    await expect(action(form({ paid_at: "" }))).rejects.toThrow("REDIRECT");
    expect(sent().paid_at).toBeNull();
    expect(mocks.getHotelClock).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalled();
    expect(redirectedTo()).toContain(`/dashboard/transactions/${section}`);
  });

  it("lê a data do pagamento no fuso do hotel, não no do servidor", async () => {
    await expect(action(form({ paid_at: "2026-11-04T19:30" }))).rejects.toThrow(
      "REDIRECT",
    );
    expect(sent().paid_at).toBe("2026-11-04T10:30:00.000Z");
  });

  it("recusa data de pagamento inválida", async () => {
    await expect(action(form({ paid_at: "2026-02-31T10:00" }))).rejects.toThrow(
      "REDIRECT",
    );
    expect(redirectedTo()).toContain(`status=${missing}`);
    expect(backend).not.toHaveBeenCalled();
  });

  it("não grava se o relógio do hotel não puder ser consultado", async () => {
    mocks.getHotelClock.mockRejectedValue(new Error("indisponível"));
    await expect(action(form({ paid_at: "2026-11-04T19:30" }))).rejects.toThrow(
      "REDIRECT",
    );
    expect(redirectedTo()).toContain(`status=${failure}`);
    expect(backend).not.toHaveBeenCalled();
  });

  it("informa a falha do backend", async () => {
    backend.mockRejectedValue(new Error("falha"));
    await expect(action(form())).rejects.toThrow("REDIRECT");
    expect(redirectedTo()).toContain(`status=${failure}`);
  });
});
