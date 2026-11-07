// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserFromSession: vi.fn(),
  requestOperationsFinanceEndpoint: vi.fn(),
  listCustomers: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
  revalidatePath: vi.fn(),
}));

vi.mock("../../../../src/lib/auth", () => ({
  getUserFromSession: mocks.getUserFromSession,
}));
vi.mock("../../../../src/lib/adminApi", () => ({
  requestOperationsFinanceEndpoint: mocks.requestOperationsFinanceEndpoint,
  listCustomers: mocks.listCustomers,
}));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/dashboard/reservations/unassigned",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock(
  "../../../../src/app/dashboard/_components/DashboardEntityPageShell",
  () => ({
    DashboardEntityPageShell: ({ children }: { children: React.ReactNode }) => (
      <main>{children}</main>
    ),
  }),
);
vi.mock(
  "../../../../src/app/dashboard/reservations/_components/ReservationArrivalPanel",
  () => ({ ReservationArrivalPanel: () => <div>painel do adiantamento</div> }),
);

import { PERMISSIONS } from "@hotel/shared";
import {
  assignReservationRoomAction,
  cancelUnassignedReservationAction,
  linkReservationCustomerAction,
} from "../../../../src/app/dashboard/reservations/unassigned/actions";
import Page from "../../../../src/app/dashboard/reservations/unassigned/page";

const accommodation = {
  id: "accommodation-1",
  room_type: "Standard",
  checkin_date: "2026-12-10",
  checkout_date: "2026-12-12",
  adults: 2,
  children: 0,
  version: 3,
};
const item = {
  id: "reservation-1",
  code: "CH-ABC",
  version: 2,
  lifecycle_status: "confirmed",
  source: "agency",
  guest_count: 2,
  customer_id: null,
  customer_name: null,
  contact: {
    full_name: "Hóspede do Canal",
    email: "a@example.invalid",
    phone: null,
  },
  closure_balance: 0,
  cancel_penalty: 0,
  accommodations: [accommodation],
};
const reception = [
  PERMISSIONS.ROOM_ASSIGNMENTS_MANAGE,
  PERMISSIONS.CUSTOMER_CREATE,
  PERMISSIONS.RESERVATION_GUARANTEES_MANAGE,
];

async function renderPage(items: unknown[], permissions: string[] = reception) {
  mocks.getUserFromSession.mockResolvedValue({ permissions });
  mocks.requestOperationsFinanceEndpoint.mockImplementation(
    async (path: string) => {
      if (path === "reservations/unassigned") return { items };
      if (path.endsWith("/room-assignments/simulate"))
        return {
          candidates: [
            { room_id: "room-1", room_number: "103", readiness: "ready" },
          ],
        };
      return {};
    },
  );
  mocks.listCustomers.mockResolvedValue([
    { id: "customer-1", full_name: "Ana Souza" },
  ]);
  render(await Page({ searchParams: Promise.resolve({}) }));
}
const form = (values: Record<string, string>) => {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
};

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("reservas sem quarto", () => {
  it("recusa quem não aloca quartos", async () => {
    await renderPage([], [PERMISSIONS.RESERVATION_READ]);
    expect(screen.getByText("Sem permissão para alocar quartos.")).toBeTruthy();
    expect(mocks.requestOperationsFinanceEndpoint).not.toHaveBeenCalled();
  });

  it("explica quando não há nada a fazer", async () => {
    await renderPage([]);
    expect(
      screen.getByText("Nenhuma reserva aguarda quarto ou acerto."),
    ).toBeTruthy();
  });

  it("sem cliente pede a identificação e não oferece quarto", async () => {
    await renderPage([item]);
    expect(screen.getByText(/Canal de reserva/)).toBeTruthy();
    expect(screen.getByText(/Hóspede do Canal/)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Vincular cliente" }),
    ).toBeTruthy();
    expect(
      screen.getByText("Identifique o hóspede para alocar o quarto."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Alocar quarto" })).toBeNull();
  });

  it("sem permissão de criar cliente, oferece só a lista", async () => {
    await renderPage([item], [PERMISSIONS.ROOM_ASSIGNMENTS_MANAGE]);
    expect(screen.queryByText("Cadastrar novo cliente")).toBeNull();
    expect(screen.queryByText("Cancelar reserva")).toBeNull();
  });

  it("com cliente oferece os quartos da categoria", async () => {
    await renderPage([
      { ...item, customer_id: "c", customer_name: "Ana Souza" },
    ]);
    expect(screen.getByText("Ana Souza")).toBeTruthy();
    const room = screen.getByLabelText("Quarto");
    expect(
      within(room).getByRole("option", { name: "103 (pronto)" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Alocar quarto" })).toBeTruthy();
  });

  it("avisa quando não há quarto livre", async () => {
    mocks.getUserFromSession.mockResolvedValue({ permissions: reception });
    mocks.requestOperationsFinanceEndpoint.mockImplementation(
      async (path: string) =>
        path === "reservations/unassigned"
          ? { items: [{ ...item, customer_id: "c", customer_name: "Ana" }] }
          : { candidates: [] },
    );
    mocks.listCustomers.mockResolvedValue([]);
    render(await Page({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText(/Nenhum quarto dessa categoria/)).toBeTruthy();
  });

  it("pré-reserva pede o adiantamento e não busca quartos", async () => {
    await renderPage([{ ...item, lifecycle_status: "hold", customer_id: "c" }]);
    expect(screen.getByText("painel do adiantamento")).toBeTruthy();
    expect(
      mocks.requestOperationsFinanceEndpoint.mock.calls.some(([path]) =>
        String(path).endsWith("/simulate"),
      ),
    ).toBe(false);
  });

  it("reserva encerrada com saldo mostra só o acerto", async () => {
    await renderPage([
      {
        ...item,
        lifecycle_status: "canceled",
        closure_balance: 80,
        accommodations: [],
      },
    ]);
    expect(
      screen.getByRole("heading", { name: "Devolver crédito" }),
    ).toBeTruthy();
    expect(screen.queryByText("1. Hóspede")).toBeNull();
  });

  it("uma falha do backend aparece em vez de fila vazia", async () => {
    mocks.getUserFromSession.mockResolvedValue({ permissions: reception });
    mocks.requestOperationsFinanceEndpoint.mockRejectedValue(
      new Error("indisponível"),
    );
    mocks.listCustomers.mockResolvedValue([]);
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "indisponível",
    );
  });
});

describe("ações de reservas sem quarto", () => {
  beforeEach(() => {
    mocks.requestOperationsFinanceEndpoint.mockResolvedValue({ ok: true });
  });

  it("vincula cliente existente", async () => {
    await expect(
      linkReservationCustomerAction(
        form({ id: "r", version: "2", customer_id: "customer-1" }),
      ),
    ).rejects.toThrow("status=reservation-customer-linked");
    expect(mocks.requestOperationsFinanceEndpoint).toHaveBeenCalledWith(
      "reservations/r/booking-customer",
      "POST",
      { expected_version: 2, customer_id: "customer-1" },
    );
  });

  it("cadastra e vincula", async () => {
    await expect(
      linkReservationCustomerAction(
        form({
          id: "r",
          version: "2",
          full_name: "Novo",
          document_type: "cpf",
          document_number: "123",
          birth_date: "1990-01-01",
        }),
      ),
    ).rejects.toThrow("status=reservation-customer-linked");
    expect(
      mocks.requestOperationsFinanceEndpoint.mock.calls[0]?.[2],
    ).toMatchObject({
      new_customer: { full_name: "Novo", document_number: "123" },
    });
  });

  it("aloca com a versão da acomodação", async () => {
    await expect(
      assignReservationRoomAction(
        form({
          id: "r",
          accommodation_id: "a",
          room_id: "room-1",
          version: "3",
          reason: "Alocação",
        }),
      ),
    ).rejects.toThrow("status=reservation-room-assigned");
    expect(
      mocks.requestOperationsFinanceEndpoint.mock.calls[0]?.[2],
    ).toMatchObject({
      accommodation_id: "a",
      room_id: "room-1",
      expected_version: 3,
    });
  });

  it("cancela com o motivo", async () => {
    await expect(
      cancelUnassignedReservationAction(
        form({ id: "r", version: "2", reason: "Pedido" }),
      ),
    ).rejects.toThrow("status=reservation-canceled");
    expect(mocks.requestOperationsFinanceEndpoint).toHaveBeenCalledWith(
      "reservations/r/actions",
      "POST",
      { action: "cancel", expected_version: 2, reason: "Pedido" },
    );
  });

  it("traduz a recusa do backend na mensagem da tela", async () => {
    mocks.requestOperationsFinanceEndpoint.mockRejectedValue(
      Object.assign(new Error("recusa"), {
        statusCode: 409,
        details: "customer_required",
      }),
    );
    await expect(
      assignReservationRoomAction(form({ id: "r", version: "1" })),
    ).rejects.toThrow("status=customer-required");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
