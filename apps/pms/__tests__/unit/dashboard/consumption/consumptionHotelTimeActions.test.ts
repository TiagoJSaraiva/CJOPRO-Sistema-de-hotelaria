import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@hotel/shared";

const mocks = vi.hoisted(() => ({
  getHotelClock: vi.fn(),
  getUserFromSession: vi.fn(),
  requestCorporateCredit: vi.fn(),
  createPostCheckoutConsumptionCase: vi.fn(),
  createConsumptionServiceOrder: vi.fn(),
  reversePartnerSettlementPayment: vi.fn(),
  payPartnerSettlement: vi.fn(),
  requestOperationsFinanceEndpoint: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("../../../../src/lib/auth", () => ({
  getUserFromSession: mocks.getUserFromSession,
}));
vi.mock("../../../../src/lib/adminApi", () => ({
  getHotelClock: mocks.getHotelClock,
  requestCorporateCredit: mocks.requestCorporateCredit,
  createCorporateAccount: vi.fn(),
  actCorporateCreditAuthorization: vi.fn(),
  payCorporateReceivable: vi.fn(),
  createPostCheckoutConsumptionCase: mocks.createPostCheckoutConsumptionCase,
  actPostCheckoutConsumptionCase: vi.fn(),
  addPostCheckoutConsumptionEvidence: vi.fn(),
  payPostCheckoutConsumptionCase: vi.fn(),
  createConsumptionServiceOrder: mocks.createConsumptionServiceOrder,
  actConsumptionServiceOrder: vi.fn(),
  reversePartnerSettlementPayment: mocks.reversePartnerSettlementPayment,
  payPartnerSettlement: mocks.payPartnerSettlement,
  requestOperationsFinanceEndpoint: mocks.requestOperationsFinanceEndpoint,
  createPartnerSettlement: vi.fn(),
  decidePartnerSettlement: vi.fn(),
  recalculatePartnerSettlement: vi.fn(),
  submitPartnerSettlement: vi.fn(),
  updateConsumptionManagementSettings: vi.fn(),
}));

import { requestCorporateCreditAction } from "../../../../src/app/dashboard/consumption/companies/actions";
import { createPostCheckoutCaseAction } from "../../../../src/app/dashboard/consumption/post-checkout/actions";
import { createServiceOrderAction } from "../../../../src/app/dashboard/consumption/service/actions";
import {
  paySettlementAction,
  paySettlementPartialAction,
  reverseSettlementPaymentAction,
} from "../../../../src/app/dashboard/consumption/managementActions";

const TYPED = "2026-11-04T19:30";
const STORED = "2026-11-04T10:30:00.000Z"; // 19:30 em Tóquio

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getHotelClock.mockResolvedValue({
    timezone: "Asia/Tokyo",
    operational_date: "2026-11-04",
    operational_now: "2026-11-04T03:00:00.000Z",
  });
  mocks.getUserFromSession.mockResolvedValue({
    permissions: [PERMISSIONS.PARTNER_SETTLEMENTS_SETTLE],
  });
});

describe("datas digitadas na hora do hotel", () => {
  it("estorno de pagamento envia um instante aceito pelo contrato", async () => {
    await expect(
      reverseSettlementPaymentAction(
        form({
          settlement_id: "s1",
          payment_id: "p1",
          reason: "Pagamento em duplicidade",
          reversed_at: TYPED,
        }),
      ),
    ).rejects.toThrow("REDIRECT");
    expect(mocks.reversePartnerSettlementPayment).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ reversed_at: STORED }),
    );
    expect(String(mocks.redirect.mock.calls.at(-1)?.[0])).toContain(
      "payment-reversed",
    );
  });

  it("estorno não chega ao backend sem o relógio do hotel", async () => {
    mocks.getHotelClock.mockRejectedValue(new Error("indisponível"));
    await expect(
      reverseSettlementPaymentAction(
        form({ settlement_id: "s1", payment_id: "p1", reversed_at: TYPED }),
      ),
    ).rejects.toThrow("REDIRECT");
    expect(mocks.reversePartnerSettlementPayment).not.toHaveBeenCalled();
  });

  it("pagamento de apuração usa a hora do hotel", async () => {
    await expect(
      paySettlementAction(
        form({
          id: "s1",
          expected_version: "1",
          amount: "10",
          payment_method: "pix",
          paid_at: TYPED,
        }),
      ),
    ).rejects.toThrow("REDIRECT");
    expect(mocks.payPartnerSettlement).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ paid_at: STORED }),
    );
  });

  it("pagamento parcial usa a hora do hotel", async () => {
    await expect(
      paySettlementPartialAction(
        form({
          id: "s1",
          expected_version: "1",
          payment_method: "pix",
          amount: "10",
          paid_at: TYPED,
        }),
      ),
    ).rejects.toThrow("REDIRECT");
    expect(mocks.requestOperationsFinanceEndpoint).toHaveBeenCalledWith(
      "consumption/partner-settlements/s1/payments",
      "POST",
      expect.objectContaining({ paid_at: STORED }),
    );
  });

  it("crédito corporativo expira na hora do hotel", async () => {
    await requestCorporateCreditAction(
      form({
        stay_id: "stay",
        corporate_account_id: "account",
        amount_limit: "100",
        reason: "Evento",
        expires_at: TYPED,
      }),
    );
    expect(mocks.requestCorporateCredit).toHaveBeenCalledWith(
      expect.objectContaining({ expires_at: STORED }),
    );
  });

  it("consumo pós-saída ocorre na hora do hotel", async () => {
    await createPostCheckoutCaseAction(
      form({
        stay_id: "stay",
        occurred_at: TYPED,
        report: "Frigobar",
        offer_id: "offer",
        quantity: "1",
      }),
    );
    expect(mocks.createPostCheckoutConsumptionCase).toHaveBeenCalledWith(
      expect.objectContaining({ occurred_at: STORED }),
    );
  });

  it("pedido de serviço envia o horário previsto como instante", async () => {
    const input = {
      stay_id: "stay",
      point_id: "point",
      mode: "room_service",
      idempotency_key: "key",
      items: [],
    } as const;
    await createServiceOrderAction({ ...input, items: [], expected_at: TYPED });
    expect(mocks.createConsumptionServiceOrder).toHaveBeenCalledWith(
      expect.objectContaining({ expected_at: STORED }),
    );
  });

  it("pedido de serviço sem horário não consulta o relógio", async () => {
    const result = await createServiceOrderAction({
      stay_id: "stay",
      point_id: "point",
      mode: "room_service",
      idempotency_key: "key",
      items: [],
    });
    expect(result.ok).toBe(true);
    expect(mocks.getHotelClock).not.toHaveBeenCalled();
  });

  it("pedido de serviço informa data inválida sem chamar o backend", async () => {
    const result = await createServiceOrderAction({
      stay_id: "stay",
      point_id: "point",
      mode: "room_service",
      idempotency_key: "key",
      items: [],
      expected_at: "2026-02-31T10:00",
    });
    expect(result).toEqual({ ok: false, error: "Data e hora inválidas." });
    expect(mocks.createConsumptionServiceOrder).not.toHaveBeenCalled();
  });
});
