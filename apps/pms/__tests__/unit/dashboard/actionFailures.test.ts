import { beforeEach, describe, expect, it, vi } from "vitest";

// Sem tratamento, uma recusa do backend levava a uma página de erro genérica, e o formulário se perdia.
const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  revalidate: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("../../../src/lib/hotelClock", () => ({
  readHotelInstant: async () => "2026-11-06T12:00:00.000Z",
}));
vi.mock("../../../src/lib/adminApi", () => ({
  requestOperationsFinanceEndpoint: mocks.api,
  createCorporateAccount: mocks.api,
  requestCorporateCredit: mocks.api,
  actCorporateCreditAuthorization: mocks.api,
  payCorporateReceivable: mocks.api,
  createPostCheckoutConsumptionCase: mocks.api,
  actPostCheckoutConsumptionCase: mocks.api,
  addPostCheckoutConsumptionEvidence: mocks.api,
  payPostCheckoutConsumptionCase: mocks.api,
  createConsumptionBenefitPlan: mocks.api,
  createConsumptionBenefitVersion: mocks.api,
  transferConsumption: mocks.api,
}));

import { createBenefitPlanAction } from "../../../src/app/dashboard/consumption/benefits/actions";
import {
  createCorporateAccountAction,
  payCorporateReceivableAction,
} from "../../../src/app/dashboard/consumption/companies/actions";
import {
  actPostCheckoutCaseAction,
  payPostCheckoutCaseAction,
} from "../../../src/app/dashboard/consumption/post-checkout/actions";
import { transferConsumptionAction } from "../../../src/app/dashboard/consumption/transferActions";
import { createGuestPreferenceAction } from "../../../src/app/dashboard/customers/relationship/actions";
import {
  actBookingChannelEventAction,
  actPrearrivalRequestAction,
  createBookingChannelWithSecretAction,
  importBookingChannelCsvAction,
  reconcileAnalyticsAction,
  saveBookingChannelMappingAction,
  saveBookingConfigurationAction,
} from "../../../src/app/dashboard/reservations/stage6Actions";
import { actTrainingClockAction } from "../../../src/app/dashboard/training/actions";

const refusal = (statusCode: number, details?: string) =>
  Object.assign(new Error("Recusado"), { statusCode, details });

const form = (values: Record<string, string> = {}) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

beforeEach(() => {
  mocks.api.mockReset();
  mocks.revalidate.mockClear();
  mocks.redirect.mockClear();
  mocks.api.mockResolvedValue({});
});

describe("tarifas, canais, pré-chegada e indicadores", () => {
  const cases: Array<
    [string, (data: FormData) => Promise<unknown>, string, string]
  > = [
    [
      "venda direta",
      saveBookingConfigurationAction,
      "/dashboard/reservations/channels",
      "booking-configuration-saved",
    ],
    [
      "mapeamento",
      saveBookingChannelMappingAction,
      "/dashboard/reservations/channels",
      "channel-mapping-saved",
    ],
    [
      "evento de canal",
      actBookingChannelEventAction,
      "/dashboard/reservations/channels",
      "channel-event-updated",
    ],
    [
      "arquivo de canal",
      importBookingChannelCsvAction,
      "/dashboard/reservations/channels",
      "channel-csv-imported",
    ],
    [
      "pré-chegada",
      actPrearrivalRequestAction,
      "/dashboard/reservations/prearrival",
      "prearrival-updated",
    ],
    [
      "indicadores",
      reconcileAnalyticsAction,
      "/dashboard/reservations/analytics",
      "analytics-reconciled",
    ],
  ];

  it.each(cases)("%s informa o sucesso", async (_, action, path, code) => {
    await expect(action(form())).rejects.toThrow(
      `REDIRECT:${path}?status=${code}`,
    );
    expect(mocks.revalidate).toHaveBeenCalledWith(path);
  });

  it.each(cases)("%s informa a recusa", async (_, action, path) => {
    mocks.api.mockRejectedValue(refusal(409));
    await expect(action(form())).rejects.toThrow(
      `REDIRECT:${path}?status=conflict`,
    );
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("canal criado devolve o segredo", async () => {
    mocks.api.mockResolvedValue({ secret: "segredo" });
    const state = await createBookingChannelWithSecretAction(
      { message: "" },
      form({ name: "Canal", code: "C1" }),
    );
    expect(state.secret).toBe("segredo");
  });

  it("canal recusado explica e não devolve segredo", async () => {
    mocks.api.mockRejectedValue(refusal(409));
    const state = await createBookingChannelWithSecretAction(
      { message: "" },
      form({ name: "Canal", code: "C1" }),
    );
    expect(state.secret).toBeUndefined();
    expect(state.message).toContain("não foi concluída");
    expect(state.failed).toBe(true);
  });
});

describe("relacionamento e treinamento", () => {
  it("a preferência mantém o hóspede na tela, com sucesso ou falha", async () => {
    const data = form({ customer_id: "c1" });
    await expect(createGuestPreferenceAction(data)).rejects.toThrow(
      "?customerId=c1&status=preference-created",
    );
    mocks.api.mockRejectedValue(refusal(400));
    await expect(createGuestPreferenceAction(data)).rejects.toThrow(
      "?customerId=c1&status=invalid",
    );
  });

  it("o relógio informa o sucesso e a recusa", async () => {
    const data = form({ action: "freeze", expected_version: "1" });
    await expect(actTrainingClockAction(data)).rejects.toThrow(
      "status=training-clock-updated",
    );
    mocks.api.mockRejectedValue(refusal(409, "version_conflict"));
    await expect(actTrainingClockAction(data)).rejects.toThrow(
      "status=version-conflict",
    );
  });
});

describe("empresas, pós-checkout, benefícios e correção de quarto", () => {
  it("sucesso atualiza a tela sem sair dela", async () => {
    await createCorporateAccountAction(form({ legal_name: "Empresa" }));
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.revalidate).toHaveBeenCalledWith(
      "/dashboard/consumption/companies",
    );
    await createBenefitPlanAction(form({ name: "Plano" }));
    expect(mocks.revalidate).toHaveBeenCalledWith(
      "/dashboard/consumption/benefits",
    );
  });

  it("empresa recusada fica na tela com a mensagem", async () => {
    mocks.api.mockRejectedValue(refusal(409));
    await expect(createCorporateAccountAction(form())).rejects.toThrow(
      "REDIRECT:/dashboard/consumption/companies?status=conflict",
    );
  });

  it("dinheiro sem sessão continua explicado em empresas e pós-checkout", async () => {
    mocks.api.mockRejectedValue(refusal(409, "cash_session_required"));
    await expect(payCorporateReceivableAction(form())).rejects.toThrow(
      "companies?status=cash-session-required",
    );
    await expect(payPostCheckoutCaseAction(form())).rejects.toThrow(
      "post-checkout?status=cash-session-required",
    );
  });

  it("caso pós-checkout recusado por permissão explica", async () => {
    mocks.api.mockRejectedValue(refusal(403));
    await expect(actPostCheckoutCaseAction(form())).rejects.toThrow(
      "post-checkout?status=forbidden",
    );
  });

  it("benefício recusado fica na tela", async () => {
    mocks.api.mockRejectedValue(refusal(400));
    await expect(createBenefitPlanAction(form())).rejects.toThrow(
      "benefits?status=invalid",
    );
  });

  it("correção de quarto informa o sucesso e, na recusa, mantém a comanda", async () => {
    const data = form({ order_id: "o1" });
    await expect(transferConsumptionAction(data)).rejects.toThrow(
      "history?id=o1&transfer=completed",
    );
    mocks.api.mockRejectedValue(refusal(409, "version_conflict"));
    await expect(transferConsumptionAction(data)).rejects.toThrow(
      "history?id=o1&transfer=version-conflict",
    );
  });
});
