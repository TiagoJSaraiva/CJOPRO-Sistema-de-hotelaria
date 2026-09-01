// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdminStayOperationalPanelResponse } from "@hotel/shared";
import { CheckoutByRoomWorkflow } from "../../../../src/app/dashboard/reservations/_components/CheckoutByRoomWorkflow";

type PanelOverrides = {
  stay?: Partial<AdminStayOperationalPanelResponse["stay"]>;
  reservation?: Partial<AdminStayOperationalPanelResponse["reservation"]>;
  hotel?: Partial<AdminStayOperationalPanelResponse["hotel"]>;
  eligibility?: Partial<AdminStayOperationalPanelResponse["eligibility"]>;
  payments?: AdminStayOperationalPanelResponse["payments"];
  folio?: AdminStayOperationalPanelResponse["folio"];
  maintenance_occurrences?: AdminStayOperationalPanelResponse["maintenance_occurrences"];
  maintenance_acknowledgement_required?: boolean;
  maintenance_financial_acknowledgement_required?: boolean;
  maintenance_pending_folio_entry_ids?: string[];
};

function createPanel(
  overrides: PanelOverrides = {},
): AdminStayOperationalPanelResponse {
  const base: AdminStayOperationalPanelResponse = {
    stay: {
      id: "stay-2",
      reservation_id: "reservation-2",
      reservation_code: "RES-1002",
      room_id: "room-102",
      room_number: "102",
      room_type: "Standard",
      customer_name: "Bruno Lima",
      stay_status: "checked_in",
      checkin_date_expected: "2026-05-15",
      checkout_date_expected: "2026-05-18",
      checkin_date_actual: "2026-05-15T17:30:00.000Z",
      checkout_date_actual: null,
      total_price_estimated: 960,
      total_paid: 960,
      stay_payment_status: "paid",
    },
    reservation: {
      id: "reservation-2",
      code: "RES-1002",
      total_due: 960,
      total_paid: 960,
      payment_status: "paid",
    },
    hotel: {
      id: "hotel-1",
      timezone: "America/Sao_Paulo",
      checkin_time_start: "14:00",
      checkin_time_limit: "22:00",
      checkout_time_start: "08:00",
      checkout_time_limit: "12:00",
    },
    eligibility: {
      can_checkin: false,
      checkin_block_reason: "A estadia nao esta em status confirmado.",
      can_checkout: true,
      checkout_block_reason: null,
      can_no_show: false,
      no_show_block_reason:
        "No-show so pode ser aplicado em estadia confirmada.",
      can_cancel: false,
      cancel_block_reason:
        "Cancelamento permitido apenas para estadia confirmada.",
    },
    payments: [
      {
        id: "payment-1",
        stay_id: "stay-2",
        amount: 960,
        method: "pix",
        note: null,
        paid_at: "2026-05-15T18:00:00.000Z",
        created_at: "2026-05-15T18:00:00.000Z",
        created_by: "user-1",
      },
    ],
  };

  return {
    stay: {
      ...base.stay,
      ...overrides.stay,
    },
    reservation: {
      ...base.reservation,
      ...overrides.reservation,
    },
    hotel: {
      ...base.hotel,
      ...overrides.hotel,
    },
    eligibility: {
      ...base.eligibility,
      ...overrides.eligibility,
    },
    payments: overrides.payments ?? base.payments,
    folio: overrides.folio,
    maintenance_occurrences: overrides.maintenance_occurrences,
    maintenance_acknowledgement_required:
      overrides.maintenance_acknowledgement_required,
    maintenance_financial_acknowledgement_required:
      overrides.maintenance_financial_acknowledgement_required,
    maintenance_pending_folio_entry_ids:
      overrides.maintenance_pending_folio_entry_ids,
  };
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

async function searchRoom(
  user: ReturnType<typeof userEvent.setup>,
  roomNumber = "102",
) {
  await user.type(screen.getByLabelText("Numero do quarto"), roomNumber);
  await user.click(screen.getByRole("button", { name: "Buscar" }));
}

describe("CheckoutByRoomWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("busca por quarto e exibe dados da estadia", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(createPanel()));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<CheckoutByRoomWorkflow />);
    await searchRoom(user);

    expect(await screen.findByText("Bruno Lima")).toBeTruthy();
    expect(screen.getAllByText("RES-1002").length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/stays/checkout-candidate?room_number=102",
      {
        method: "GET",
        cache: "no-store",
      },
    );
  });

  it("mostra motivo e desabilita checkout quando elegibilidade bloqueia", async () => {
    const panel = createPanel({
      eligibility: {
        can_checkout: false,
        checkout_block_reason: "Checkout permitido apenas na data esperada.",
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(panel)));
    const user = userEvent.setup();

    render(<CheckoutByRoomWorkflow />);
    await searchRoom(user);

    expect(
      await screen.findByText("Checkout permitido apenas na data esperada."),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Confirmar checkout",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("registra pagamento e atualiza saldo", async () => {
    const partialPanel = createPanel({
      stay: {
        total_paid: 600,
        stay_payment_status: "partial",
      },
      reservation: {
        total_paid: 600,
        payment_status: "partial",
      },
      payments: [
        {
          id: "payment-1",
          stay_id: "stay-2",
          amount: 600,
          method: "pix",
          note: null,
          paid_at: "2026-05-15T18:00:00.000Z",
          created_at: "2026-05-15T18:00:00.000Z",
          created_by: "user-1",
        },
      ],
    });
    const paidPanel = createPanel();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(partialPanel))
      .mockResolvedValueOnce(jsonResponse(paidPanel));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<CheckoutByRoomWorkflow />);
    await searchRoom(user);

    expect(
      ((await screen.findByLabelText("Valor")) as HTMLInputElement).value,
    ).toBe("360.00");
    await user.click(
      screen.getByRole("button", { name: "Registrar pagamento" }),
    );

    expect(fetchMock).toHaveBeenLastCalledWith("/api/stays/stay-2/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: 360,
        method: "pix",
        note: null,
      }),
    });
    expect(await screen.findByText("Pagamento registrado.")).toBeTruthy();
    expect((screen.getByLabelText("Valor") as HTMLInputElement).value).toBe("");
  });

  it("revisa a alocação FIFO antes de registrar pagamento no fólio", async () => {
    const debitId = "99400000-0000-4000-8000-000000000001";
    const partialPanel = createPanel({
      stay: { total_paid: 600, stay_payment_status: "partial" },
      reservation: { total_paid: 600, payment_status: "partial" },
      folio: {
        stay_id: "stay-2",
        currency: "BRL",
        entries: [
          {
            id: debitId,
            stay_id: "stay-2",
            reservation_id: "reservation-2",
            direction: "debit",
            kind: "lodging",
            amount: 960,
            currency: "BRL",
            description: "Hospedagem",
            maintenance_occurrence_id: null,
            financial_transaction_id: null,
            reversed_entry_id: null,
            allocated_amount: 600,
            open_amount: 360,
            posted_at: "2026-05-15T12:00:00.000Z",
          },
        ],
        allocations: [],
        total_debits: 960,
        total_credits: 600,
        balance: 360,
        payment_status: "partial",
        pending_maintenance_entry_ids: [],
      },
    });
    const preview = {
      amount: 360,
      allocations: [{ debit_entry_id: debitId, amount: 360 }],
      unallocated_amount: 0,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(partialPanel))
      .mockResolvedValueOnce(jsonResponse(preview))
      .mockResolvedValueOnce(jsonResponse(createPanel()));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<CheckoutByRoomWorkflow />);
    await searchRoom(user);
    const register = await screen.findByRole("button", {
      name: "Registrar pagamento",
    });
    expect((register as HTMLButtonElement).disabled).toBe(true);
    await user.click(
      screen.getByRole("button", { name: "Revisar alocação FIFO" }),
    );
    expect(await screen.findByText(/Hospedagem:/)).toBeTruthy();
    await user.click(register);

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/stays/stay-2/payments",
      expect.objectContaining({
        body: JSON.stringify({
          amount: 360,
          method: "pix",
          note: null,
          allocations: preview.allocations,
        }),
      }),
    );
  });

  it("confirma checkout e mostra status checked-out", async () => {
    const checkedOutPanel = createPanel({
      stay: {
        stay_status: "checked_out",
        checkout_date_actual: "2026-05-18T13:20:00.000Z",
      },
      eligibility: {
        can_checkout: false,
        checkout_block_reason:
          "A estadia precisa estar em checked_in para checkout.",
      },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(createPanel()))
      .mockResolvedValueOnce(jsonResponse(checkedOutPanel));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<CheckoutByRoomWorkflow />);
    await searchRoom(user);
    await user.click(
      await screen.findByRole("button", { name: "Confirmar checkout" }),
    );

    expect(fetchMock).toHaveBeenLastCalledWith("/api/stays/stay-2/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    expect(
      await screen.findByText("Checkout confirmado para o quarto 102."),
    ).toBeTruthy();
    expect(screen.getByText("Checked-out")).toBeTruthy();
  });

  it("exige ciência explícita e envia os ids das ocorrências abertas", async () => {
    const openOccurrence = {
      id: "97000000-0000-4000-8000-000000000001",
      occurrence_number: 1,
      code: "OCO-000001",
      kind: "damage" as const,
      priority: "high" as const,
      status: "awaiting_liability" as const,
      description: "Televisor danificado",
      category_id: "category-1",
      category_name: "Eletrônicos",
      room_id: "room-102",
      room_number: "102",
      location_id: null,
      location_name: null,
      stay_id: "stay-2",
      reported_by: "user-1",
      reporter_name: "Gestor",
      blocking_recommended: false,
      liability_status: "suspected" as const,
      active_block: false,
      open_work_orders: 0,
      created_at: "2026-05-18T10:00:00Z",
      updated_at: "2026-05-18T10:00:00Z",
    };
    const panel = createPanel({
      maintenance_occurrences: [openOccurrence],
      maintenance_acknowledgement_required: true,
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(panel))
      .mockResolvedValueOnce(
        jsonResponse(createPanel({ stay: { stay_status: "checked_out" } })),
      );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<CheckoutByRoomWorkflow />);
    await searchRoom(user);
    const checkout = await screen.findByRole("button", {
      name: "Confirmar checkout",
    });
    expect((checkout as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByLabelText(/Declaro ciência/));
    await user.click(checkout);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/stays/stay-2/checkout",
      expect.objectContaining({
        body: JSON.stringify({
          maintenance_acknowledged_occurrence_ids: [openOccurrence.id],
          maintenance_acknowledged_folio_entry_ids: [],
        }),
      }),
    );
  });

  it("permite checkout com cobrança pendente após ciência sem revelar valores", async () => {
    const entryId = "99500000-0000-4000-8000-000000000001";
    const panel = createPanel({
      maintenance_financial_acknowledgement_required: true,
      maintenance_pending_folio_entry_ids: [entryId],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(panel))
      .mockResolvedValueOnce(
        jsonResponse(createPanel({ stay: { stay_status: "checked_out" } })),
      );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<CheckoutByRoomWorkflow />);
    await searchRoom(user);
    const checkout = await screen.findByRole("button", {
      name: "Confirmar checkout",
    });
    expect((checkout as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText(/valores exigem permissão financeira/i),
    ).toBeTruthy();
    await user.click(screen.getByLabelText(/Declaro ciência da cobrança/));
    await user.click(checkout);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/stays/stay-2/checkout",
      expect.objectContaining({
        body: JSON.stringify({
          maintenance_acknowledged_occurrence_ids: [],
          maintenance_acknowledged_folio_entry_ids: [entryId],
        }),
      }),
    );
  });
});
