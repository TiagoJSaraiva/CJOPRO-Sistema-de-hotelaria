// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdminMaintenanceFinanceOccurrence } from "@hotel/shared";
import { MaintenanceOccurrenceFinancePanel } from "../../../src/app/dashboard/maintenance/_components/MaintenanceOccurrenceFinancePanel";

const finance: AdminMaintenanceFinanceOccurrence = {
  occurrence_id: "97000000-0000-4000-8000-000000000002",
  currency: "BRL",
  estimated_cost: 100,
  approved_cost: 90,
  settled_cost: 0,
  approved_recovery: 0,
  received_recovery: 0,
  net_result: 90,
  cost_items: [
    {
      id: "99000000-0000-4000-8000-000000000001",
      occurrence_id: "97000000-0000-4000-8000-000000000002",
      work_order_id: null,
      kind: "material",
      description: "Substituição do televisor",
      quantity: 1,
      estimated_amount: 100,
      actual_amount: 90,
      currency: "BRL",
      counterparty: null,
      due_date: null,
      reference_code: null,
      approval_status: "approved",
      settlement_status: "open",
      created_by: "user-1",
      submitted_at: "2026-08-31T10:00:00Z",
      approved_by: "user-2",
      approved_at: "2026-08-31T11:00:00Z",
      decision_reason: null,
      settled_amount: 0,
      outstanding_amount: 90,
      settlements: [],
      attachments: [
        {
          id: "99300000-0000-4000-8000-000000000001",
          occurrence_id: "97000000-0000-4000-8000-000000000002",
          cost_item_id: "99000000-0000-4000-8000-000000000001",
          recovery_id: null,
          original_filename: "nota-fiscal.pdf",
          content_type: "application/pdf",
          size_bytes: 1024,
          uploaded_by: "user-1",
          created_at: "2026-08-31T10:00:00Z",
          removed_at: null,
        },
      ],
      created_at: "2026-08-31T10:00:00Z",
      updated_at: "2026-08-31T11:00:00Z",
    },
  ],
  recoveries: [],
};

function response(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("MaintenanceOccurrenceFinancePanel", () => {
  it("abre por URL temporária e remove documento somente com motivo", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({ signed_url: "https://signed.example/document" }),
      )
      .mockResolvedValueOnce(response({ item: finance }))
      .mockResolvedValueOnce(response({ item: finance }));
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    vi.spyOn(window, "prompt").mockReturnValue("Documento duplicado");
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(
      <MaintenanceOccurrenceFinancePanel
        occurrenceId={finance.occurrence_id}
        stayId={null}
        initial={finance}
        canPropose
      />,
    );

    await user.click(screen.getByRole("button", { name: "Abrir" }));
    expect(open).toHaveBeenCalledWith(
      "https://signed.example/document",
      "_blank",
      "noopener,noreferrer",
    );
    await user.click(screen.getByRole("button", { name: "Remover" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/maintenance/financial-attachments/99300000-0000-4000-8000-000000000001/remove",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reason: "Documento duplicado" }),
      }),
    );
  });

  it("submete item e cria custo e recuperação em rascunho", async () => {
    const draftFinance: AdminMaintenanceFinanceOccurrence = {
      ...finance,
      cost_items: [
        {
          ...finance.cost_items[0]!,
          approval_status: "draft",
          settlement_status: "not_posted",
        },
      ],
    };
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => response({ item: draftFinance }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(
      <MaintenanceOccurrenceFinancePanel
        occurrenceId={draftFinance.occurrence_id}
        stayId="stay-1"
        initial={draftFinance}
        canPropose
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Submeter para aprovação" }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const costForm = screen
      .getByRole("heading", { name: "Novo custo" })
      .closest("form")!;
    await user.type(
      within(costForm).getByPlaceholderText("Descrição"),
      "Peça nova",
    );
    await user.type(within(costForm).getByPlaceholderText("Estimado"), "80");
    await user.type(within(costForm).getByPlaceholderText("Real"), "75");
    await user.type(
      within(costForm).getByPlaceholderText("Favorecido"),
      "Loja local",
    );
    await user.click(
      within(costForm).getByRole("button", { name: "Salvar rascunho" }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));

    const recoveryForm = screen
      .getByRole("heading", { name: "Nova recuperação ou dispensa" })
      .closest("form")!;
    await user.type(
      within(recoveryForm).getByPlaceholderText("Cobrança"),
      "50",
    );
    await user.type(
      within(recoveryForm).getByPlaceholderText("Justificativa"),
      "Responsabilidade confirmada",
    );
    await user.click(
      within(recoveryForm).getByRole("button", { name: "Salvar rascunho" }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(6));
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/transition");
    expect(fetchMock.mock.calls[2]?.[0]).toContain("/cost-items");
    expect(fetchMock.mock.calls[4]?.[0]).toContain("/recoveries");
  });

  it("envia PDF por URL assinada e confirma seus metadados", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          items: [
            {
              storage_path: "hotel/occurrence/document.pdf",
              signed_url: "https://signed.example/upload",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(response({ item: finance }))
      .mockResolvedValueOnce(response({ item: finance }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(
      <MaintenanceOccurrenceFinancePanel
        occurrenceId={finance.occurrence_id}
        stayId={null}
        initial={finance}
        canPropose
      />,
    );
    const file = new File(["pdf"], "comprovante.pdf", {
      type: "application/pdf",
    });

    await user.upload(screen.getByLabelText("Anexar documento"), file);
    expect(await screen.findByText("Documentos adicionados.")).toBeTruthy();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://signed.example/upload",
      expect.objectContaining({
        method: "PUT",
        body: file,
      }),
    );
    expect(fetchMock.mock.calls[2]?.[0]).toContain("/finalize");
  });
});
