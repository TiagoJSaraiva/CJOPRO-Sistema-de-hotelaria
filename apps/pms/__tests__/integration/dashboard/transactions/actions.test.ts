import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@hotel/shared";

const {
  redirectMock,
  revalidatePathMock,
  getUserFromSessionMock,
  createTransactionMock,
  updateTransactionMock,
  deleteTransactionMock
} = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  revalidatePathMock: vi.fn(),
  getUserFromSessionMock: vi.fn(),
  createTransactionMock: vi.fn(),
  updateTransactionMock: vi.fn(),
  deleteTransactionMock: vi.fn()
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock
}));

vi.mock("../../../../src/lib/auth", () => ({
  getUserFromSession: getUserFromSessionMock
}));

vi.mock("../../../../src/lib/adminApi", () => ({
  createFinancialTransaction: createTransactionMock,
  updateFinancialTransaction: updateTransactionMock,
  deleteFinancialTransaction: deleteTransactionMock
}));

import {
  createTransactionAction,
  deleteTransactionAction,
  updateTransactionAction
} from "../../../../src/app/dashboard/transactions/actions";

describe("dashboard/transactions/actions", () => {
  function redirectPattern(pathWithoutNonce: string): RegExp {
    return new RegExp(`^REDIRECT:${pathWithoutNonce}(?:&r=[a-z0-9]+)?$`);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redireciona com forbidden quando usuario nao tem permissao de criacao", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({ permissions: [PERMISSIONS.TRANSACTION_READ] });

    const formData = new FormData();
    formData.set("type", "INCOME");
    formData.set("category", "Hospedagem");
    formData.set("amount", "1200");
    formData.set("currency", "BRL");
    formData.set("status", "COMPLETED");

    await expect(createTransactionAction(formData)).rejects.toThrow(
      redirectPattern("/dashboard/transactions/view\\?status=forbidden")
    );
  });

  it("redireciona para create_missing_fields quando payload e invalido", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({ permissions: [PERMISSIONS.TRANSACTION_CREATE] });

    const formData = new FormData();
    formData.set("type", "");
    formData.set("category", "");
    formData.set("amount", "-10");

    await expect(createTransactionAction(formData)).rejects.toThrow(
      redirectPattern("/dashboard/transactions/create\\?status=create_missing_fields")
    );

    expect(createTransactionMock).not.toHaveBeenCalled();
  });

  it("cria transacao e redireciona com status created", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({ permissions: [PERMISSIONS.TRANSACTION_CREATE] });
    createTransactionMock.mockResolvedValueOnce({ id: "tx-1" });

    const formData = new FormData();
    formData.set("type", "INCOME");
    formData.set("category", "Hospedagem");
    formData.set("amount", "1200");
    formData.set("currency", "BRL");
    formData.set("description", "Reserva premium");
    formData.set("status", "COMPLETED");

    await expect(createTransactionAction(formData)).rejects.toThrow(
      redirectPattern("/dashboard/transactions/create\\?status=created")
    );

    expect(createTransactionMock).toHaveBeenCalledWith({
      type: "INCOME",
      category: "Hospedagem",
      amount: 1200,
      currency: "BRL",
      description: "Reserva premium",
      status: "COMPLETED"
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/transactions");
  });

  it("atualiza transacao e redireciona com status updated", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({ permissions: [PERMISSIONS.TRANSACTION_UPDATE] });
    updateTransactionMock.mockResolvedValueOnce({ id: "tx-1" });

    const formData = new FormData();
    formData.set("id", "tx-1");
    formData.set("type", "EXPENSE");
    formData.set("category", "Manutencao");
    formData.set("amount", "300");
    formData.set("currency", "BRL");
    formData.set("description", "Troca de equipamentos");
    formData.set("status", "PENDING");

    await expect(updateTransactionAction(formData)).rejects.toThrow(
      redirectPattern("/dashboard/transactions/view\\?status=updated")
    );

    expect(updateTransactionMock).toHaveBeenCalledWith("tx-1", {
      type: "EXPENSE",
      category: "Manutencao",
      amount: 300,
      currency: "BRL",
      description: "Troca de equipamentos",
      status: "PENDING"
    });
  });

  it("remove transacao e redireciona com status deleted", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({ permissions: [PERMISSIONS.TRANSACTION_DELETE] });
    deleteTransactionMock.mockResolvedValueOnce(null);

    const formData = new FormData();
    formData.set("id", "tx-1");

    await expect(deleteTransactionAction(formData)).rejects.toThrow(
      redirectPattern("/dashboard/transactions/view\\?status=deleted")
    );

    expect(deleteTransactionMock).toHaveBeenCalledWith("tx-1");
  });
});
