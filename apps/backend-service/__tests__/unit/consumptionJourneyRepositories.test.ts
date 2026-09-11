import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());

vi.mock("../../src/common/supabaseServer", () => ({
  createServerClient: () => ({
    marker: "supabase-client",
    rpc(
      this: { marker?: string },
      name: string,
      args: Record<string, unknown>,
    ) {
      if (this.marker !== "supabase-client") {
        throw new Error("rpc chamado sem o contexto do cliente");
      }
      return rpc(name, args);
    },
  }),
}));

import { createConsumptionBenefitsRepository } from "../../src/repositories/consumptionBenefitsRepository";
import { createConsumptionJourneyRepository } from "../../src/repositories/consumptionJourneyRepository";
import { createPostCheckoutConsumptionRepository } from "../../src/repositories/postCheckoutConsumptionRepository";
import { createStayPayersRepository } from "../../src/repositories/stayPayersRepository";

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: { items: [] }, error: null });
});

describe("repositórios da jornada de consumo", () => {
  it("preserva o contexto do cliente Supabase ao chamar RPC", async () => {
    await createConsumptionJourneyRepository().board("hotel-1", {});
    await createConsumptionBenefitsRepository().list("hotel-1");
    await createStayPayersRepository().list("hotel-1", "stay-1");
    await createPostCheckoutConsumptionRepository().list("hotel-1");

    expect(rpc).toHaveBeenCalledTimes(4);
    expect(rpc).toHaveBeenNthCalledWith(1, "list_consumption_service_orders", {
      p_hotel_id: "hotel-1",
      p_status: undefined,
      p_point_id: undefined,
      p_search: undefined,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "list_consumption_benefit_plans", {
      p_hotel_id: "hotel-1",
    });
    expect(rpc).toHaveBeenNthCalledWith(3, "list_stay_payer_accounts", {
      p_hotel_id: "hotel-1",
      p_stay_id: "stay-1",
    });
    expect(rpc).toHaveBeenNthCalledWith(4, "list_post_checkout_consumption", {
      p_hotel_id: "hotel-1",
      p_case_id: undefined,
    });
  });
});
