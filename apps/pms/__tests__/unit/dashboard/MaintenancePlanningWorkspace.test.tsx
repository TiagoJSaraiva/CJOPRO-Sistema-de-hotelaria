// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MaintenancePlanningBoard } from "@hotel/shared";
import { HotelTimeZoneProvider } from "../../../src/app/dashboard/_components/HotelTimeZone";
import { MaintenancePlanningWorkspace } from "../../../src/app/dashboard/maintenance/_components/MaintenancePlanningWorkspace";

const board: MaintenancePlanningBoard = {
  generated_at: "2026-09-09T12:00:00Z",
  teams: [
    {
      id: "10000000-0000-4000-8000-000000000010",
      name: "Elétrica",
      description: null,
      is_active: true,
      version: 1,
      members: [],
      availability: [],
    },
  ],
  schedules: [],
  backlog: [
    {
      work_order_id: "20000000-0000-4000-8000-000000000010",
      occurrence_id: "30000000-0000-4000-8000-000000000010",
      occurrence_code: "MAN-000010",
      title: "Revisar quadro",
      priority: "high",
      impact_score: 80,
      recommended_priority: "critical",
      room_number: "101",
      due_at: null,
    },
  ],
  users: [{ id: "80000000-0000-4000-8000-000000000002", name: "Técnico" }],
  summary: {
    scheduled: 0,
    backlog: 1,
    conflicts: 0,
    capacity_minutes: 480,
    allocated_minutes: 0,
  },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("explica capacidade, impacto e oferece simulação ao planejador", () => {
  render(
    <MaintenancePlanningWorkspace
      initial={board}
      viewerId="viewer"
      access={{
        canExecute: false,
        canManageTeams: true,
        canManageSchedule: true,
        canOverrideSchedule: true,
      }}
    />,
  );
  expect(screen.getByText("480 min")).toBeTruthy();
  expect(screen.getByText(/recomendação critical \(80 pontos\)/i)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Simular" })).toBeTruthy();
  expect(screen.getByText("Exceção de disponibilidade")).toBeTruthy();
  expect(screen.getByLabelText("Início planejado")).toBeTruthy();
  expect(screen.getByLabelText("Duração estimada em minutos")).toBeTruthy();
  expect(screen.getByLabelText("Membro")).toBeTruthy();
  expect(screen.getByLabelText("Dia da semana")).toBeTruthy();
  expect(screen.getByLabelText("Início da exceção")).toBeTruthy();
  expect(screen.getByLabelText("Tipo de exceção")).toBeTruthy();
});

it("oculta controles gerenciais de um técnico", () => {
  render(
    <MaintenancePlanningWorkspace
      initial={board}
      viewerId="viewer"
      access={{
        canExecute: true,
        canManageTeams: false,
        canManageSchedule: false,
        canOverrideSchedule: false,
      }}
    />,
  );
  expect(screen.queryByText("Backlog não agendado")).toBeNull();
  expect(screen.queryByText("Equipes e capacidade")).toBeNull();
});

it("o reagendamento envia a data pedida como instante, aceito pelo contrato", async () => {
  const fetchMock = vi.fn(
    async () => new Response(JSON.stringify(board), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const technician = "80000000-0000-4000-8000-000000000002";
  render(
    <MaintenancePlanningWorkspace
      initial={{
        ...board,
        schedules: [
          {
            id: "40000000-0000-4000-8000-000000000010",
            work_order_id: "20000000-0000-4000-8000-000000000010",
            occurrence_id: "30000000-0000-4000-8000-000000000010",
            occurrence_code: "MAN-000010",
            title: "Revisar quadro",
            room_number: "101",
            team_id: null,
            team_name: null,
            technician_id: technician,
            technician_name: "Técnico",
            planned_start: "2026-09-09T13:00:00Z",
            planned_end: "2026-09-09T14:00:00Z",
            estimated_minutes: 60,
            status: "scheduled",
            access_kind: "free",
            access_notes: null,
            version: 1,
            impact_score: 80,
            recommended_priority: "high",
            next_arrival_at: null,
          },
        ],
      }}
      viewerId={technician}
      access={{
        canExecute: true,
        canManageTeams: false,
        canManageSchedule: false,
        canOverrideSchedule: false,
      }}
    />,
  );

  const button = screen.getByRole("button", {
    name: "Solicitar reagendamento",
  });
  const form = button.closest("form") as HTMLFormElement;
  fireEvent.change(
    form.querySelector('input[name="requested_start"]') as HTMLInputElement,
    { target: { value: "2026-09-10T09:30" } },
  );
  fireEvent.change(form.querySelector('[name="reason"]') as HTMLInputElement, {
    target: { value: "Hóspede pediu outro horário" },
  });
  fireEvent.submit(form);

  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  const [url, init] = fetchMock.mock.calls[0] as unknown as [
    string,
    RequestInit,
  ];
  expect(url).toContain("reschedule-requests");
  expect(JSON.parse(String(init.body)).requested_start).toBe(
    "2026-09-10T12:30:00.000Z",
  );
});

describe("agenda na hora do hotel", () => {
  const scheduled = (
    id: string,
    planned_start: string,
    planned_end: string,
  ) => ({
    id,
    work_order_id: "20000000-0000-4000-8000-000000000010",
    occurrence_id: "30000000-0000-4000-8000-000000000010",
    occurrence_code: id,
    title: "Revisar quadro",
    room_number: "101",
    team_id: null,
    team_name: null,
    technician_id: "80000000-0000-4000-8000-000000000002",
    technician_name: "Técnico",
    planned_start,
    planned_end,
    estimated_minutes: 60,
    status: "scheduled" as const,
    access_kind: "free" as const,
    access_notes: null,
    version: 1,
    impact_score: 80,
    recommended_priority: "high" as const,
    next_arrival_at: null,
  });
  const access = {
    canExecute: true,
    canManageTeams: false,
    canManageSchedule: false,
    canOverrideSchedule: false,
  };

  function renderInTokyo(initial: MaintenancePlanningBoard) {
    render(
      <HotelTimeZoneProvider timeZone="Asia/Tokyo">
        <MaintenancePlanningWorkspace
          initial={initial}
          viewerId="80000000-0000-4000-8000-000000000002"
          access={access}
        />
      </HotelTimeZoneProvider>,
    );
  }

  it("a visão Dia usa o dia do hotel, não o dia em UTC", () => {
    renderInTokyo({
      ...board,
      // 05:00 do dia 10 em Tóquio; em UTC ainda é dia 9.
      generated_at: "2026-09-09T20:00:00Z",
      schedules: [
        // 01:00 do dia 10 em Tóquio: é hoje no hotel, embora em UTC seja dia 9.
        scheduled(
          "HOJE-NO-HOTEL",
          "2026-09-09T16:00:00Z",
          "2026-09-09T17:00:00Z",
        ),
        // 14:00 do dia 9 em Tóquio: já passou, embora em UTC também seja dia 9.
        scheduled(
          "ONTEM-NO-HOTEL",
          "2026-09-09T05:00:00Z",
          "2026-09-09T06:00:00Z",
        ),
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: "Dia" }));
    expect(screen.getByText(/HOJE-NO-HOTEL/)).toBeTruthy();
    expect(screen.queryByText(/ONTEM-NO-HOTEL/)).toBeNull();
  });

  it("mostra o agendamento na hora do hotel", () => {
    renderInTokyo({
      ...board,
      schedules: [
        scheduled("MAN-1", "2026-09-09T16:00:00Z", "2026-09-09T17:30:00Z"),
      ],
    });
    expect(screen.getByText(/10\/09\/2026, 01:00:00–02:30/)).toBeTruthy();
  });

  it("o reagendamento grava a hora digitada no fuso do hotel", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify(board), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderInTokyo({
      ...board,
      schedules: [
        scheduled("MAN-1", "2026-09-09T13:00:00Z", "2026-09-09T14:00:00Z"),
      ],
    });
    const form = screen
      .getByRole("button", { name: "Solicitar reagendamento" })
      .closest("form") as HTMLFormElement;
    fireEvent.change(
      form.querySelector('input[name="requested_start"]') as HTMLInputElement,
      { target: { value: "2026-09-10T09:30" } },
    );
    fireEvent.change(
      form.querySelector('[name="reason"]') as HTMLInputElement,
      {
        target: { value: "Hóspede pediu outro horário" },
      },
    );
    fireEvent.submit(form);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(String(init.body)).requested_start).toBe(
      "2026-09-10T00:30:00.000Z",
    );
  });
});
