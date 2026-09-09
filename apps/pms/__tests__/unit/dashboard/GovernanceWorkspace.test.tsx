// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { GovernanceBoard } from "@hotel/shared";
import { GovernanceWorkspace } from "../../../src/app/dashboard/governance/GovernanceWorkspace";
import { governanceGuide } from "../../../src/app/dashboard/governance/usageGuide";

const cycleId = "a0000000-0000-4000-8000-000000000001";
const taskId = "a0000000-0000-4000-8000-000000000002";
const board: GovernanceBoard = {
  items: [
    {
      id: cycleId,
      hotel_id: "10000000-0000-4000-8000-000000000001",
      room_id: "20000000-0000-4000-8000-000000000101",
      room_number: "101",
      stay_id: null,
      status: "cleaning_pending",
      source: "manual",
      version: 3,
      next_arrival_at: "2026-09-09T14:00:00Z",
      severity: "warning",
      last_updated_at: "2026-09-08T12:00:00Z",
      released_at: null,
      events: [],
      tasks: [
        {
          id: taskId,
          kind: "cleaning",
          status: "pending",
          assigned_to: null,
          assignee_name: null,
          next_action: "Higienizar o banheiro",
          version: 1,
          started_at: null,
          completed_at: null,
          checklist: [],
        },
      ],
    },
  ],
  rooms: [
    {
      id: "20000000-0000-4000-8000-000000000101",
      room_number: "101",
      room_type: "Standard",
    },
  ],
  maintenance_categories: [],
  minibar_options: [],
  assignable_users: [],
  summary: { total: 1, critical: 0, unassigned: 1, awaiting_inspection: 0 },
};
const access = {
  canRead: true,
  canExecute: true,
  canInspect: false,
  canAssign: false,
  canManageTemplates: false,
  canPostConsumption: false,
  canReportMaintenance: false,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("orienta a fila, cria ciclo por seleção e assume com a versão atual", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ item: board.items[0] }),
    })
    .mockResolvedValue({ ok: true, json: async () => board });
  vi.stubGlobal("fetch", fetchMock);
  render(
    <GovernanceWorkspace initial={board} templates={[]} access={access} />,
  );
  expect(screen.getByText("Próxima ação:")).toBeTruthy();
  await userEvent.selectOptions(
    screen.getByLabelText("Quarto para limpeza avulsa"),
    board.rooms[0]!.id,
  );
  await userEvent.click(screen.getByRole("button", { name: "Abrir ciclo" }));
  expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
    room_id: board.rooms[0]!.id,
    source: "manual",
  });
  await userEvent.click(screen.getByRole("button", { name: "Assumir" }));
  expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toMatchObject({
    action: "claim",
    task_id: taskId,
    expected_version: 3,
  });
});

it("mantém todos os alvos do guia vinculados a conteúdo operacional", () => {
  const detailed = structuredClone(board);
  detailed.items[0]!.tasks[0]!.status = "assigned";
  detailed.items[0]!.tasks[0]!.checklist = [
    {
      id: "a0000000-0000-4000-8000-000000000003",
      label: "Conferir enxoval",
      display_order: 10,
      required: true,
      result: "pending",
      notes: null,
    },
  ];
  render(
    <GovernanceWorkspace initial={detailed} templates={[]} access={access} />,
  );
  for (const step of governanceGuide({
    ...access,
    hasMinibarOptions: false,
    hasMaintenanceCategories: false,
  }).steps) {
    expect(
      document.querySelector(`[data-usage-guide="${step.target}"]`),
    ).toBeTruthy();
  }
});

it("conclui uma reposição assumida com a versão atual do ciclo", async () => {
  const replenishment = structuredClone(board);
  replenishment.items[0]!.tasks[0]!.kind = "replenishment";
  replenishment.items[0]!.tasks[0]!.status = "assigned";
  replenishment.items[0]!.tasks[0]!.assigned_to =
    "80000000-0000-4000-8000-000000000002";
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ item: replenishment.items[0] }),
    })
    .mockResolvedValue({ ok: true, json: async () => replenishment });
  vi.stubGlobal("fetch", fetchMock);
  render(
    <GovernanceWorkspace
      initial={replenishment}
      templates={[]}
      access={access}
    />,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Concluir reposição" }),
  );
  expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
    action: "complete",
    task_id: taskId,
    expected_version: 3,
  });
});
