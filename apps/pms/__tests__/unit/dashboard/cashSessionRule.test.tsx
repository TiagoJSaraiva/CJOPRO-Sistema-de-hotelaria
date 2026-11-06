// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  revalidate: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  payCase: vi.fn(),
  payReceivable: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("../../../src/lib/hotelClock", () => ({ readHotelInstant: vi.fn() }));
vi.mock("../../../src/lib/adminApi", () => ({
  actPostCheckoutConsumptionCase: vi.fn(),
  addPostCheckoutConsumptionEvidence: vi.fn(),
  createPostCheckoutConsumptionCase: vi.fn(),
  payPostCheckoutConsumptionCase: mocks.payCase,
  actCorporateCreditAuthorization: vi.fn(),
  createCorporateAccount: vi.fn(),
  payCorporateReceivable: mocks.payReceivable,
  requestCorporateCredit: vi.fn(),
}));

import { CashMethodOption } from "../../../src/app/dashboard/_components/CashMethodOption";
import { payCorporateReceivableAction } from "../../../src/app/dashboard/consumption/companies/actions";
import { payPostCheckoutCaseAction } from "../../../src/app/dashboard/consumption/post-checkout/actions";

function payment() {
  const form = new FormData();
  form.set("id", "item");
  form.set("version", "1");
  form.set("payment_method", "cash");
  form.set("amount", "10");
  return form;
}
const refusal = Object.assign(new Error("Dinheiro exige sessão"), {
  details: "cash_session_required",
});

afterEach(cleanup);

describe("CashMethodOption", () => {
  it("sem sessão, a opção existe, mas não pode ser escolhida, e diz o motivo", () => {
    render(
      <select aria-label="Meio">
        <CashMethodOption hasSession={false} />
      </select>,
    );
    const option = screen.getByRole<HTMLOptionElement>("option");
    expect(option.disabled).toBe(true);
    expect(option.textContent).toContain("exige sua sessão de caixa aberta");
  });

  it("com sessão, o dinheiro pode ser escolhido", () => {
    render(
      <select aria-label="Meio">
        <CashMethodOption hasSession />
      </select>,
    );
    const option = screen.getByRole<HTMLOptionElement>("option");
    expect(option.disabled).toBe(false);
    expect(option.textContent).toBe("Dinheiro");
  });
});

describe("recebimentos fora da conta da estadia", () => {
  beforeEach(() => {
    mocks.redirect.mockClear();
    mocks.revalidate.mockClear();
    mocks.payCase.mockReset();
    mocks.payReceivable.mockReset();
  });

  it.each([
    [
      "consumo pós-checkout",
      payPostCheckoutCaseAction,
      mocks.payCase,
      "/dashboard/consumption/post-checkout",
    ],
    [
      "recebível de empresa",
      payCorporateReceivableAction,
      mocks.payReceivable,
      "/dashboard/consumption/companies",
    ],
  ])("%s explica a falta de sessão", async (_name, action, api, path) => {
    api.mockRejectedValue(refusal);
    await expect(action(payment())).rejects.toThrow(
      `REDIRECT:${path}?status=cash-session-required`,
    );
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it.each([
    ["consumo pós-checkout", payPostCheckoutCaseAction, mocks.payCase],
    ["recebível de empresa", payCorporateReceivableAction, mocks.payReceivable],
  ])("%s não disfarça outras falhas", async (_name, action, api) => {
    api.mockRejectedValue(new Error("falhou"));
    await expect(action(payment())).rejects.toThrow("status=unavailable");
  });
});
