// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { AdminConsumptionOperationalContext } from "@hotel/shared";
import { ConsumptionSplitQueue } from "../../../../src/app/dashboard/consumption/_components/ConsumptionSplitQueue";
const mocks = vi.hoisted(() => ({ post: vi.fn(), refresh: vi.fn() }));
vi.mock("../../../../src/app/dashboard/consumption/operationActions", () => ({
  postConsumptionOrderAction: mocks.post,
  refreshConsumptionContext: mocks.refresh,
}));
vi.mock(
  "../../../../src/app/dashboard/consumption/_components/ConsumptionOrderComposer",
  () => ({
    Receipt: ({ order }: { order: { id: string } }) => <p>Recibo {order.id}</p>,
  }),
);
const context = {
  stay: { id: "stay" },
  offers: [
    {
      id: "a",
      point_id: "point",
      product_name: "Água",
      available: true,
      allowed_modes: ["stay_folio"],
      default_mode: "stay_folio",
      provider_type: "hotel",
      unit_price: 5,
      currency: "BRL",
      version_token: "v1",
    },
    {
      id: "b",
      point_id: "point",
      product_name: "Passeio",
      available: true,
      allowed_modes: ["partner_direct"],
      default_mode: "partner_direct",
      provider_type: "partner",
      partner_id: "partner",
      agreement_id: "agreement",
      unit_price: 20,
      currency: "BRL",
      version_token: "v1",
    },
  ],
} as unknown as AdminConsumptionOperationalContext;
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function setup() {
  render(
    <ConsumptionSplitQueue
      initialContext={context}
      quantities={{ a: 1, b: 1 }}
      pointId="point"
      metadata={{
        guest: "guest",
        occurredAt: "2026-09-08T12:00:00Z",
        notes: "Varanda",
      }}
      canReceive={true}
      close={vi.fn()}
    />,
  );
}
it("preserva primeiro recibo e repete segundo pedido incerto com a mesma chave", async () => {
  mocks.post
    .mockResolvedValueOnce({ receipt: { id: "first" } })
    .mockResolvedValueOnce({ error: "Resposta incerta", uncertain: true })
    .mockResolvedValueOnce({ receipt: { id: "second" } });
  setup();
  await userEvent.click(
    screen.getAllByRole("button", { name: "Confirmar este grupo" })[0]!,
  );
  expect(await screen.findByText("Recibo first")).toBeTruthy();
  await userEvent.click(
    screen.getByLabelText("Confirmo que este parceiro recebeu diretamente."),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Confirmar este grupo" }),
  );
  await userEvent.click(
    await screen.findByRole("button", { name: "Repetir a mesma solicitação" }),
  );
  expect(mocks.post.mock.calls[1]?.[0]).toEqual(mocks.post.mock.calls[2]?.[0]);
  expect(mocks.post.mock.calls[1]?.[0].guest_customer_id).toBe("guest");
  expect(await screen.findByText("Recibo second")).toBeTruthy();
  expect(screen.getByText("Recibo first")).toBeTruthy();
});
it("conflito exige atualizar antes de nova confirmação", async () => {
  mocks.post.mockResolvedValueOnce({ error: "Preço mudou", conflict: true });
  mocks.refresh.mockResolvedValue(context);
  setup();
  await userEvent.click(
    screen.getAllByRole("button", { name: "Confirmar este grupo" })[0]!,
  );
  await userEvent.click(
    await screen.findByRole("button", { name: "Atualizar preços e políticas" }),
  );
  expect(mocks.refresh).toHaveBeenCalledWith("stay", "2026-09-08T12:00:00Z");
  expect(screen.getByText(/Contexto atualizado/)).toBeTruthy();
});
it("mantém a chave para nova tentativa com o mesmo conteúdo após erro confirmado", async () => {
  mocks.post.mockResolvedValue({
    error: "Referência recusada",
    conflict: false,
  });
  setup();
  await userEvent.click(
    screen.getAllByRole("button", { name: "Confirmar este grupo" })[0]!,
  );
  await userEvent.click(
    screen.getAllByRole("button", { name: "Confirmar este grupo" })[0]!,
  );
  expect(mocks.post.mock.calls[0]?.[0]).toEqual(mocks.post.mock.calls[1]?.[0]);
});
