import type { TrainingClockAction, TrainingEnvironment } from "@hotel/shared";
import { createServerClient } from "../common/supabaseServer";

type RpcClient = {
  rpc(
    name: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: Error | null }>;
};

export interface TrainingRepository {
  getEnvironment(hotelId: string): Promise<TrainingEnvironment>;
  actClock(
    hotelId: string,
    actorId: string,
    input: TrainingClockAction,
  ): Promise<
    | { result: "ok"; environment: TrainingEnvironment }
    | { result: string; context?: unknown }
  >;
}

export function createTrainingRepository(
  client?: RpcClient,
): TrainingRepository {
  const rpcClient = () =>
    client ?? (createServerClient() as unknown as RpcClient);
  return {
    async getEnvironment(hotelId) {
      const { data, error } = await rpcClient().rpc(
        "get_training_environment",
        {
          p_hotel_id: hotelId,
        },
      );
      if (error) throw error;
      return data as TrainingEnvironment;
    },
    async actClock(hotelId, actorId, input) {
      const { data, error } = await rpcClient().rpc("act_training_clock", {
        p_hotel_id: hotelId,
        p_actor_id: actorId,
        p_input: input,
      });
      if (error) throw error;
      return data as Awaited<ReturnType<TrainingRepository["actClock"]>>;
    },
  };
}
