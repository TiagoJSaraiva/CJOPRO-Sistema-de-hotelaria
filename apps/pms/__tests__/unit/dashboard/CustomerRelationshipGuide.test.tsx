// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PERMISSIONS } from "@hotel/shared";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  customers: vi.fn(),
  request: vi.fn(),
}));
vi.mock("../../../src/lib/auth", () => ({ getUserFromSession: mocks.user }));
vi.mock("../../../src/lib/adminApi", () => ({
  listCustomers: mocks.customers,
  requestOperationsFinanceEndpoint: mocks.request,
}));

import RelationshipPage from "../../../src/app/dashboard/customers/relationship/page";

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("guides reception from the guest history to a consented preference", async () => {
  mocks.user.mockResolvedValue({
    permissions: [
      PERMISSIONS.GUEST_RELATIONSHIP_READ,
      PERMISSIONS.GUEST_RELATIONSHIP_MANAGE,
    ],
  });
  mocks.customers.mockResolvedValue([
    { id: "customer-1", full_name: "Bruno Exemplo" },
  ]);
  mocks.request.mockResolvedValue({
    customer: { id: "customer-1", full_name: "Bruno Exemplo" },
    preferences: [],
    reservations: [{}],
    stays: [{}],
  });

  render(
    await RelationshipPage({
      searchParams: Promise.resolve({ customerId: "customer-1" }),
    }),
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Guia desta página" }));

  expect(
    screen.getByRole("dialog", { name: "Consulte o histórico do hóspede" }),
  ).toBeTruthy();
  expect(screen.getByText("Consulte o histórico do hóspede")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Próximo" }));
  expect(screen.getByText("Registre somente o que foi declarado")).toBeTruthy();
  expect(
    screen.getByText(/não altera a reserva nem garante o pedido/),
  ).toBeTruthy();
});
