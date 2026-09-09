import type {
  GovernanceActionInput,
  GovernanceBoard,
  GovernanceCycle,
  GovernanceCycleCreateInput,
  GovernanceDefectInput,
  GovernanceMinibarInput,
  GovernanceTemplate,
  GovernanceTemplateCreateInput,
  Json,
  RoomOperationalState,
  StayRelocationCandidate,
  StayRelocationConfirmInput,
} from "@hotel/shared";
import { createServerClient } from "../common/supabaseServer";

type RpcResult = {
  result: string;
  cycle_id?: string;
  template_id?: string;
  items?: unknown[];
  version?: number;
};

function object(value: Json): RpcResult {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RpcResult)
    : { result: "failed" };
}

export interface GovernanceRepository {
  listBoard(hotelId: string): Promise<GovernanceBoard>;
  getCycle(hotelId: string, cycleId: string): Promise<GovernanceCycle | null>;
  createCycle(
    hotelId: string,
    actorId: string,
    input: GovernanceCycleCreateInput,
  ): Promise<{ result: string; item?: GovernanceCycle }>;
  act(
    hotelId: string,
    cycleId: string,
    actorId: string,
    input: GovernanceActionInput,
  ): Promise<{ result: string; item?: GovernanceCycle }>;
  registerMinibar(
    hotelId: string,
    cycleId: string,
    actorId: string,
    input: GovernanceMinibarInput,
  ): Promise<{ result: string; item?: GovernanceCycle }>;
  createDefect(
    hotelId: string,
    cycleId: string,
    actorId: string,
    input: GovernanceDefectInput,
  ): Promise<{ result: string; item?: GovernanceCycle }>;
  listTemplates(hotelId: string): Promise<GovernanceTemplate[]>;
  createTemplate(
    hotelId: string,
    actorId: string,
    input: GovernanceTemplateCreateInput,
  ): Promise<{ result: string; item?: GovernanceTemplate }>;
  roomState(
    hotelId: string,
    roomId: string,
  ): Promise<RoomOperationalState | null>;
  simulateRelocation(
    hotelId: string,
    stayId: string,
  ): Promise<{
    result: string;
    version?: number;
    items: StayRelocationCandidate[];
  }>;
  relocate(
    hotelId: string,
    stayId: string,
    actorId: string,
    input: StayRelocationConfirmInput,
  ): Promise<{ result: string }>;
}

export function createGovernanceRepository(): GovernanceRepository {
  return {
    async listBoard(hotelId) {
      const { data, error } = await createServerClient().rpc(
        "list_governance_board",
        { p_hotel_id: hotelId },
      );
      if (error) throw error;
      return data as unknown as GovernanceBoard;
    },
    async getCycle(hotelId, cycleId) {
      const { data, error } = await createServerClient().rpc(
        "get_governance_cycle",
        { p_hotel_id: hotelId, p_cycle_id: cycleId },
      );
      if (error) throw error;
      return data as unknown as GovernanceCycle | null;
    },
    async createCycle(hotelId, actorId, input) {
      const { data, error } = await createServerClient().rpc(
        "create_governance_cycle",
        {
          p_hotel_id: hotelId,
          p_actor_id: actorId,
          p_room_id: input.room_id,
          p_stay_id: input.stay_id,
          p_source: input.source,
          p_note: input.note,
        },
      );
      if (error) throw error;
      const value = object(data);
      return value.result === "ok" && value.cycle_id
        ? {
            result: "ok",
            item: (await this.getCycle(hotelId, value.cycle_id))!,
          }
        : { result: value.result };
    },
    async act(hotelId, cycleId, actorId, input) {
      const { data, error } = await createServerClient().rpc(
        "act_governance_cycle",
        {
          p_hotel_id: hotelId,
          p_cycle_id: cycleId,
          p_actor_id: actorId,
          p_input: input as unknown as Json,
        },
      );
      if (error) throw error;
      const value = object(data);
      return value.result === "ok"
        ? { result: "ok", item: (await this.getCycle(hotelId, cycleId))! }
        : { result: value.result };
    },
    async registerMinibar(hotelId, cycleId, actorId, input) {
      const { data, error } = await createServerClient().rpc(
        "governance_register_minibar",
        {
          p_hotel_id: hotelId,
          p_cycle_id: cycleId,
          p_actor_id: actorId,
          p_input: input as unknown as Json,
        },
      );
      if (error) throw error;
      const value = object(data);
      return value.result === "ok"
        ? { result: "ok", item: (await this.getCycle(hotelId, cycleId))! }
        : { result: value.result };
    },
    async createDefect(hotelId, cycleId, actorId, input) {
      const { data, error } = await createServerClient().rpc(
        "governance_create_defect",
        {
          p_hotel_id: hotelId,
          p_cycle_id: cycleId,
          p_actor_id: actorId,
          p_input: input as unknown as Json,
        },
      );
      if (error) throw error;
      const value = object(data);
      return value.result === "ok"
        ? { result: "ok", item: (await this.getCycle(hotelId, cycleId))! }
        : { result: value.result };
    },
    async listTemplates(hotelId) {
      const { data, error } = await createServerClient().rpc(
        "list_governance_templates",
        { p_hotel_id: hotelId },
      );
      if (error) throw error;
      return (data || []) as unknown as GovernanceTemplate[];
    },
    async createTemplate(hotelId, actorId, input) {
      const { data, error } = await createServerClient().rpc(
        "create_governance_template",
        {
          p_hotel_id: hotelId,
          p_actor_id: actorId,
          p_input: input as unknown as Json,
        },
      );
      if (error) throw error;
      const value = object(data);
      if (value.result !== "ok" || !value.template_id)
        return { result: value.result };
      const item = (await this.listTemplates(hotelId)).find(
        (template) => template.id === value.template_id,
      );
      return item ? { result: "ok", item } : { result: "failed" };
    },
    async roomState(hotelId, roomId) {
      const { data, error } = await createServerClient().rpc(
        "governance_room_state",
        { p_hotel_id: hotelId, p_room_id: roomId },
      );
      if (error) throw error;
      return data as unknown as RoomOperationalState | null;
    },
    async simulateRelocation(hotelId, stayId) {
      const { data, error } = await createServerClient().rpc(
        "simulate_stay_relocation",
        { p_hotel_id: hotelId, p_stay_id: stayId },
      );
      if (error) throw error;
      const value = object(data);
      return {
        result: value.result,
        version: value.version,
        items: (value.items || []) as StayRelocationCandidate[],
      };
    },
    async relocate(hotelId, stayId, actorId, input) {
      const { data, error } = await createServerClient().rpc(
        "relocate_confirmed_stay",
        {
          p_hotel_id: hotelId,
          p_stay_id: stayId,
          p_actor_id: actorId,
          p_destination_room_id: input.destination_room_id,
          p_expected_version: input.expected_version,
          p_reason: input.reason,
          p_room_block_id: input.room_block_id,
        },
      );
      if (error) throw error;
      return { result: object(data).result };
    },
  };
}
