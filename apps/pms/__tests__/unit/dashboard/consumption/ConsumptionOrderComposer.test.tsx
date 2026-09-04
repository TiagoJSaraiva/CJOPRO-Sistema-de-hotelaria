// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  AdminConsumptionOperationalContext,
  AdminConsumptionOrder,
} from "@hotel/shared";
import { ConsumptionOrderComposer } from "../../../../src/app/dashboard/consumption/_components/ConsumptionOrderComposer";

const postMock = vi.hoisted(() => vi.fn());
vi.mock("../../../../src/app/dashboard/consumption/operationActions", () => ({
  postConsumptionOrderAction: postMock,
}));

const context: AdminConsumptionOperationalContext = {
  stay: {
    id: "91000000-0000-4000-8000-000000000002",
    reservation_id: "90000000-0000-4000-8000-000000000002",
    reservation_code: "AUR-2",
    room_id: "20000000-0000-4000-8000-000000000102",
    room_number: "102",
    room_type: "Luxo",
    primary_guest_name: "Ana",
    checkin_date_actual: "2026-09-03T14:00:00.000Z",
    checkout_date_expected: "2026-09-05T11:00:00.000Z",
    stay_status: "checked_in",
  },
  guests: [{ id: "30000000-0000-4000-8000-000000000002", full_name: "Ana" }],
  offers: [
    {
      id: "a2000000-0000-4000-8000-000000000001",
      point_id: "a1000000-0000-4000-8000-000000000001",
      point_name: "Recepção",
      product_id: "40000000-0000-4000-8000-000000000001",
      product_name: "Água",
      product_code: "AGUA",
      product_kind: "physical",
      sales_unit: "unit",
      category_id: "41000000-0000-4000-8000-000000000001",
      category_name: "Frigobar",
      unit_price: 8,
      currency: "BRL",
      provider_type: "hotel",
      partner_id: null,
      partner_name: null,
      agreement_id: null,
      agreement_number: null,
      revision: null,
      allowed_modes: ["stay_folio", "hotel_immediate"],
      default_mode: "stay_folio",
      policy_source: "inherit",
      available: true,
      reasons: [],
      version_token: "v1",
    },
    {
      id: "a2000000-0000-4000-8000-000000000002",
      point_id: "a1000000-0000-4000-8000-000000000001",
      point_name: "Recepção",
      product_id: "40000000-0000-4000-8000-000000000002",
      product_name: "Café",
      product_code: "CAFE",
      product_kind: "service",
      sales_unit: "person",
      category_id: "41000000-0000-4000-8000-000000000002",
      category_name: "Alimentação",
      unit_price: 45,
      currency: "BRL",
      provider_type: "hotel",
      partner_id: null,
      partner_name: null,
      agreement_id: null,
      agreement_number: null,
      revision: null,
      allowed_modes: [],
      default_mode: null,
      policy_source: "inherit",
      available: false,
      reasons: ["product_inactive"],
      version_token: "v2",
    },
  ],
  occurred_at: "2026-09-04T15:00:00.000Z",
};

const receipt: AdminConsumptionOrder = {
  id: "c2000000-0000-4000-8000-000000000001",
  hotel_id: "10000000-0000-4000-8000-000000000001",
  stay_id: context.stay.id,
  reservation_id: context.stay.reservation_id,
  point_id: context.offers[0]!.point_id,
  guest_customer_id: null,
  disposition: "charged",
  billing_mode: "hotel_immediate",
  payment_method: "pix",
  payment_reference: null,
  partner_receipt_confirmed: false,
  currency: "BRL",
  gross_amount: 8,
  discount_amount: 0,
  net_amount: 8,
  reservation_code: "AUR-2",
  room_number: "102",
  guest_name: "Ana",
  point_name: "Recepção",
  notes: null,
  courtesy_reason: null,
  occurred_at: context.occurred_at,
  posted_at: context.occurred_at,
  posted_by: "80000000-0000-4000-8000-000000000002",
  operator_name: "Gerente",
  is_legacy: false,
  items: [
    {
      id: "c3000000-0000-4000-8000-000000000001",
      offer_id: context.offers[0]!.id,
      product_id: context.offers[0]!.product_id,
      quantity: 1,
      charged_unit_price: 8,
      gross_amount: 8,
      discount_amount: 0,
      net_amount: 8,
      product_name: "Água",
      product_code: "AGUA",
      category_name: "Frigobar",
      product_kind: "physical",
      sales_unit: "unit",
      provider_type: "hotel",
      partner_id: null,
      partner_name: null,
      agreement_id: null,
      agreement_number: null,
      commercial_revision_id: null,
      commercial_revision_version: null,
      billing_policy: {},
      version_token: "v1",
      notes: null,
    },
  ],
};

afterEach(() => {
  cleanup();
  postMock.mockReset();
});

describe("ConsumptionOrderComposer", () => {
  it("shows unavailable reasons, intersects modes and restores focus after Escape", async () => {
    const user = userEvent.setup();
    render(
      <ConsumptionOrderComposer
        context={context}
        canReceivePayment
        canGrantCourtesy
      />,
    );
    expect(screen.getByText(/Indisponível: Produto inativo/)).toBeTruthy();
    await user.clear(
      screen.getByRole("spinbutton", { name: "Quantidade de Água" }),
    );
    await user.type(
      screen.getByRole("spinbutton", { name: "Quantidade de Água" }),
      "1",
    );
    await waitFor(() =>
      expect(
        (
          screen.getByRole("radio", {
            name: "Lançamento no fólio",
          }) as HTMLInputElement
        ).checked,
      ).toBe(true),
    );
    const trigger = screen.getByRole("button", { name: "Revisar comanda" });
    await user.click(trigger);
    expect(
      screen.getByRole("dialog", { name: "Confirmar comanda" }),
    ).toBeTruthy();
    const back = screen.getByRole("button", { name: "Voltar" });
    const confirm = screen.getByRole("button", {
      name: "Confirmar lançamento",
    });
    await waitFor(() => expect(document.activeElement).toBe(back));
    confirm.focus();
    await user.tab();
    expect(document.activeElement).toBe(back);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(confirm);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("posts immediate payment after confirmation and renders the receipt", async () => {
    const user = userEvent.setup();
    postMock.mockResolvedValue({ receipt, error: null, conflict: false });
    vi.stubGlobal("crypto", {
      randomUUID: () => "c1000000-0000-4000-8000-000000000001",
    });
    render(
      <ConsumptionOrderComposer
        context={context}
        canReceivePayment
        canGrantCourtesy={false}
      />,
    );
    const quantity = screen.getByRole("spinbutton", {
      name: "Quantidade de Água",
    });
    await user.clear(quantity);
    await user.type(quantity, "1");
    await user.click(
      screen.getByRole("radio", { name: "Pagamento imediato ao hotel" }),
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Meio de pagamento" }),
      "pix",
    );
    await user.click(screen.getByRole("button", { name: "Revisar comanda" }));
    await user.click(
      screen.getByRole("button", { name: "Confirmar lançamento" }),
    );
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    expect(postMock.mock.calls[0]![0]).toMatchObject({
      billing_mode: "hotel_immediate",
      payment_method: "pix",
      lines: [
        { offer_id: context.offers[0]!.id, quantity: 1, version_token: "v1" },
      ],
    });
    expect(await screen.findByText(/Recibo c2000000/)).toBeTruthy();
  });

  it("keeps the cart when a concurrent change requires a new confirmation", async () => {
    const user = userEvent.setup();
    postMock.mockResolvedValue({
      receipt: null,
      error: "A configuração mudou. O carrinho foi preservado.",
      conflict: true,
    });
    vi.stubGlobal("crypto", {
      randomUUID: () => "c1000000-0000-4000-8000-000000000002",
    });
    render(
      <ConsumptionOrderComposer
        context={context}
        canReceivePayment={false}
        canGrantCourtesy
      />,
    );
    const quantity = screen.getByRole("spinbutton", {
      name: "Quantidade de Água",
    });
    await user.clear(quantity);
    await user.type(quantity, "2");
    await user.click(screen.getByRole("radio", { name: "Cortesia integral" }));
    await user.type(
      screen.getByRole("textbox", { name: "Justificativa da cortesia" }),
      "Falha no serviço",
    );
    await user.click(screen.getByRole("button", { name: "Revisar comanda" }));
    await user.click(
      screen.getByRole("button", { name: "Confirmar lançamento" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "carrinho foi preservado",
    );
    expect((quantity as HTMLInputElement).value).toBe("2");
    expect(
      screen.getByRole("button", { name: "Atualizar preços e políticas" }),
    ).toBeTruthy();
  });
});
