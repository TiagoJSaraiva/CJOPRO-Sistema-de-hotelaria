// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { AdminReservationCalendarResponse } from "@hotel/shared";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
import {
  ReservationsCalendarBoard,
  operationalStateLabel,
} from "../../../../src/app/dashboard/reservations/_components/ReservationsCalendarBoard";
afterEach(cleanup);
it.each([null, "occurrence"])(
  "explica bloqueio e só vincula ocorrência existente (%s)",
  (occurrenceId) => {
    const data: AdminReservationCalendarResponse = {
      window_start: "2026-10-04",
      window_end: "2026-10-05",
      days: [
        { date: "2026-10-04", day_number: 4, weekday_short: "dom" },
        { date: "2026-10-05", day_number: 5, weekday_short: "seg" },
      ],
      rooms: [
        {
          room_id: "r",
          room_number: "103",
          room_type: "Standard",
          max_occupancy: 2,
        },
      ],
      stays: [],
      legend: [],
      blocks: [
        {
          id: "b",
          maintenance_occurrence_id: occurrenceId,
          room_id: "r",
          status: "blocked",
          label: "Limpeza programada",
          start_date: "2026-10-04",
          end_date: "2026-10-05",
        },
      ],
    };
    render(
      <ReservationsCalendarBoard
        data={data}
        startDate={data.window_start}
        customers={[]}
        canPostConsumption={false}
        canRelocate={false}
        canOverrideReadiness={false}
        canExecuteGovernance={false}
      />,
    );
    expect(
      screen.getByRole("list", { name: "Bloqueios no período" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("list", { name: "Bloqueios no período" }).textContent,
    ).toContain("Quarto 103: Limpeza programada");
    expect(
      (
        screen.getByLabelText(
          "Abrir ou selecionar 103 em 04/10/2026",
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    if (occurrenceId) {
      expect(
        screen
          .getByRole("link", { name: "Consultar ocorrência" })
          .getAttribute("href"),
      ).toBe(`/dashboard/maintenance/occurrences/${occurrenceId}`);
    } else {
      expect(screen.queryByRole("link", { name: /ocorrência/ })).toBeNull();
    }
  },
);

it.each([
  ["arrival_expected", "Chegada prevista"],
  ["occupied", "Ocupado"],
  ["ready", "Pronto"],
  ["not_ready", "Não liberado"],
  ["blocked", "Bloqueado"],
  ["clear", "Sem interdição"],
  ["departure_review", "Conferência de saída"],
  ["cleaning_pending", "Limpeza pendente"],
  ["inspection_pending", "Inspeção pendente"],
  ["unknown", "unknown"],
])("traduz prontidão %s para a recepção", (value, label) => {
  expect(operationalStateLabel(value)).toBe(label);
});
