// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type {
  AdminMaintenanceOccurrenceDetail,
  AdminMaintenanceReferenceData,
} from "@hotel/shared";
import { MaintenanceOccurrenceWorkspace } from "../../../src/app/dashboard/maintenance/_components/MaintenanceOccurrenceWorkspace";

const initial = {
  id: "occurrence",
  code: "OCO-000001",
  category_name: "Elétrica",
  description: "Lâmpada apagada",
  status: "triaged",
  priority: "normal",
  kind: "maintenance",
  liability_status: "not_assessed",
  active_block: false,
  room_number: "101",
  room_id: "room",
  work_orders: [],
  attachments: [],
  room_blocks: [],
  inspections: [],
  events: [
    {
      id: "event",
      actor_name: "Ana",
      event_type: "occurrence_created",
      message: "Lâmpada apagada",
    },
  ],
} as unknown as AdminMaintenanceOccurrenceDetail;
const referenceData: AdminMaintenanceReferenceData = {
  categories: [],
  locations: [],
  rooms: [],
  stays: [],
  assignable_users: [],
};
const access = {
  canCreate: false,
  canTriage: false,
  canExecute: false,
  canManageBlocks: false,
  canInspect: false,
  canConfirmLiability: false,
  canManageSuppliers: false,
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("preserva contexto, histórico e restrições do leitor", () => {
  render(
    <MaintenanceOccurrenceWorkspace
      initial={initial}
      referenceData={referenceData}
      access={access}
    />,
  );
  expect(screen.getByText("Quarto 101")).toBeTruthy();
  expect(screen.getByText("Ana")).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Cancelar ocorrência" }),
  ).toBeNull();
});

it("identifica as datas do bloqueio para quem pode gerenciá-lo", () => {
  render(
    <MaintenanceOccurrenceWorkspace
      initial={initial}
      referenceData={referenceData}
      access={{ ...access, canManageBlocks: true }}
    />,
  );
  expect(screen.getByLabelText("Início do bloqueio").getAttribute("name")).toBe(
    "start_date",
  );
  expect(
    screen.getByLabelText("Fim previsto do bloqueio").getAttribute("name"),
  ).toBe("end_date");
});

it("envia comentário real ao contexto da ocorrência", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ item: initial }) });
  vi.stubGlobal("fetch", fetchMock);
  render(
    <MaintenanceOccurrenceWorkspace
      initial={initial}
      referenceData={referenceData}
      access={access}
    />,
  );
  await userEvent.type(
    screen.getByPlaceholderText("Adicionar comentário"),
    "Acesso combinado às 14h",
  );
  await userEvent.click(screen.getByRole("button", { name: "Comentar" }));
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/maintenance/occurrences/occurrence/comments",
    expect.objectContaining({
      body: JSON.stringify({ reason: "Acesso combinado às 14h" }),
    }),
  );
});

it("pede motivo de cancelamento e preserva o foco ao voltar", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ item: initial }) });
  vi.stubGlobal("fetch", fetchMock);
  render(
    <MaintenanceOccurrenceWorkspace
      initial={initial}
      referenceData={referenceData}
      access={{ ...access, canTriage: true }}
    />,
  );
  const button = screen.getByRole("button", { name: "Cancelar ocorrência" });
  await userEvent.click(button);
  expect(screen.getByRole("dialog")).toBeTruthy();
  await userEvent.keyboard("{Escape}");
  expect(document.activeElement).toBe(button);
  await userEvent.click(button);
  await userEvent.type(
    screen.getByLabelText("Justificativa / observação"),
    "Registro aberto no quarto incorreto",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Confirmar decisão" }),
  );
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/maintenance/occurrences/occurrence/cancel",
    expect.objectContaining({
      body: JSON.stringify({ reason: "Registro aberto no quarto incorreto" }),
    }),
  );
});
