import { Value } from "typebox/value";
import { describe, expect, it } from "vitest";
import {
  GovernanceActionSchema,
  GovernanceCycleCreateSchema,
  RoomOperationalStateSchema,
  StayRelocationConfirmSchema,
} from "../../src/governance";

const id = "10000000-0000-4000-8000-000000000001";

describe("contratos de governança", () => {
  it("representa os eixos independentes do quarto", () => {
    expect(
      Value.Check(RoomOperationalStateSchema, {
        room_id: id,
        occupancy: "vacant",
        housekeeping: "inspection_pending",
        maintenance: "clear",
        readiness: "not_ready",
        cycle_id: id,
        cycle_version: 2,
        next_arrival_at: null,
        assignee_id: null,
        assignee_name: null,
        last_updated_at: "2026-09-08T12:00:00.000Z",
        blockers: ["Governança: inspection pending"],
      }),
    ).toBe(true);
  });

  it("exige versão e textos úteis nas decisões concorrentes", () => {
    expect(
      Value.Check(GovernanceActionSchema, {
        action: "handoff_note",
        expected_version: 3,
        note: "Aguardar a troca do enxoval.",
        next_action: "Retomar após a entrega da lavanderia.",
      }),
    ).toBe(true);
    expect(
      Value.Check(GovernanceActionSchema, {
        action: "handoff_note",
        expected_version: 0,
        note: "",
      }),
    ).toBe(false);
  });

  it("limita a abertura e a realocação aos dados aprovados", () => {
    expect(
      Value.Check(GovernanceCycleCreateSchema, {
        room_id: id,
        source: "manual",
      }),
    ).toBe(true);
    expect(
      Value.Check(StayRelocationConfirmSchema, {
        destination_room_id: id,
        expected_version: 1,
        reason: "Interdição impeditiva antes da chegada.",
      }),
    ).toBe(true);
  });
});
