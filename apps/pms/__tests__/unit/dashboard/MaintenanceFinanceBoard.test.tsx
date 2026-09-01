// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  AdminMaintenanceCostItem,
  AdminMaintenanceRecovery,
} from "@hotel/shared";
import { MaintenanceFinanceBoard } from "../../../src/app/dashboard/maintenance/_components/MaintenanceFinanceBoard";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const item: AdminMaintenanceCostItem = {
  id: "99000000-0000-4000-8000-000000000001",
  occurrence_id: "97000000-0000-4000-8000-000000000001",
  occurrence_code: "MAN-001001",
  work_order_id: null,
  kind: "material",
  description: "Substituição do abajur",
  quantity: 1,
  estimated_amount: 200,
  actual_amount: 180,
  currency: "BRL",
  counterparty: "Fornecedor",
  due_date: "2026-09-10",
  reference_code: null,
  approval_status: "submitted",
  settlement_status: "not_posted",
  created_by: "user-author",
  proposer_name: "Proponente",
  submitted_at: "2026-08-31T00:00:00.000Z",
  approved_by: null,
  approved_at: null,
  decision_reason: null,
  settled_amount: 0,
  outstanding_amount: 180,
  settlements: [],
  attachments: [],
  created_at: "2026-08-31T00:00:00.000Z",
  updated_at: "2026-08-31T00:00:00.000Z",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("MaintenanceFinanceBoard", () => {
  it("mostra valores e ações conforme segregação financeira", () => {
    render(
      <MaintenanceFinanceBoard
        data={{ items: [item], page: 1, page_size: 25, total: 1 }}
        currentUserId="approver"
        canApprove
        canSettle={false}
      />,
    );
    expect(screen.getByText("Substituição do abajur")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Aprovar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pagar" })).toBeNull();
  });

  it("impede aprovação visual pelo próprio proponente", () => {
    render(
      <MaintenanceFinanceBoard
        data={{ items: [item], page: 1, page_size: 25, total: 1 }}
        currentUserId="user-author"
        canApprove
        canSettle
      />,
    );
    expect(
      (screen.getByRole("button", { name: "Aprovar" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("aprova e apresenta o erro devolvido ao rejeitar", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Decisão inválida." }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(
      <MaintenanceFinanceBoard
        data={{ items: [item], page: 1, page_size: 25, total: 1 }}
        currentUserId="approver"
        canApprove
        canSettle={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Aprovar" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    await user.type(
      screen.getByLabelText("Justificativa para rejeição"),
      "Documento incompleto",
    );
    await user.click(screen.getByRole("button", { name: "Rejeitar" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Decisão inválida.",
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/maintenance/cost-items/${item.id}/transition`,
      expect.objectContaining({
        body: JSON.stringify({
          action: "reject",
          reason: "Documento incompleto",
        }),
      }),
    );
  });

  it("recebe e estorna uma recuperação parcialmente liquidada", async () => {
    const recovery: AdminMaintenanceRecovery = {
      id: "99100000-0000-4000-8000-000000000001",
      occurrence_id: item.occurrence_id,
      occurrence_code: item.occurrence_code,
      responsible_party: "supplier",
      stay_id: null,
      debtor_name: "Terceiro",
      charge_amount: 100,
      waived_amount: 0,
      currency: "BRL",
      justification: "Recuperação parcial",
      due_date: null,
      approval_status: "approved",
      settlement_status: "partially_settled",
      folio_entry_id: null,
      created_by: "user-author",
      submitted_at: item.submitted_at,
      approved_by: "approver",
      approved_at: item.approved_at,
      decision_reason: null,
      settled_amount: 40,
      outstanding_amount: 60,
      settlements: [
        {
          id: "99200000-0000-4000-8000-000000000001",
          cost_item_id: null,
          recovery_id: "99100000-0000-4000-8000-000000000001",
          financial_transaction_id: "transaction-1",
          amount: 40,
          created_by: "liquidator",
          created_at: "2026-08-31T00:00:00Z",
          reversal_of_id: null,
        },
      ],
      attachments: [],
      created_at: item.created_at,
      updated_at: item.updated_at,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(
      <MaintenanceFinanceBoard
        data={{ items: [recovery], page: 1, page_size: 25, total: 1 }}
        currentUserId="liquidator"
        canApprove={false}
        canSettle
      />,
    );

    await user.type(screen.getByLabelText("Valor"), "25");
    await user.clear(screen.getByLabelText("Método"));
    await user.type(screen.getByLabelText("Método"), "pix");
    await user.type(screen.getByLabelText("Observação"), "Recebimento parcial");
    await user.click(screen.getByRole("button", { name: "Receber" }));
    await user.type(
      screen.getByPlaceholderText("Motivo do estorno"),
      "Duplicado",
    );
    await user.click(screen.getByRole("button", { name: "Estornar" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[0]?.[0]).toContain("recoveries");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("settlements");
  });

  it("mostra o estado vazio", () => {
    render(
      <MaintenanceFinanceBoard
        data={{ items: [], page: 1, page_size: 25, total: 0 }}
        currentUserId="user"
        canApprove={false}
        canSettle={false}
      />,
    );
    expect(screen.getByText("Nenhum item financeiro nesta fila.")).toBeTruthy();
  });
});
