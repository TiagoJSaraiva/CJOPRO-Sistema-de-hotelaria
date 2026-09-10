// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { MaintenancePlanningBoard } from "@hotel/shared";
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
