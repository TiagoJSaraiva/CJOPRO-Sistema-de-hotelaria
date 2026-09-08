// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  list: vi.fn(),
  act: vi.fn(),
  reconcile: vi.fn(),
}));
vi.mock("../../../src/lib/auth", () => ({ getUserFromSession: mocks.user }));
vi.mock("../../../src/lib/adminApi", () => ({
  getOperationalPending: mocks.list,
  actOperationalPending: mocks.act,
  reconcileOperationalPending: mocks.reconcile,
}));
vi.mock("../../../src/app/dashboard/pending/PendingWorkspace", () => ({
  PendingWorkspace: () => <p>Fila operacional</p>,
  PendingCards: () => <p>Resumo operacional</p>,
}));
import PendingPage from "../../../src/app/dashboard/pending/page";
import DashboardPage from "../../../src/app/dashboard/page";
import { GET, POST } from "../../../src/app/api/operational-pending/route";
import { NextRequest } from "next/server";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("página exige acesso e preserva filtros autorizados", async () => {
  mocks.user.mockResolvedValue(null);
  render(await PendingPage({}));
  expect(
    screen.getByText("Sem permissão para consultar pendências."),
  ).toBeTruthy();
  cleanup();
  mocks.user.mockResolvedValue({ id: "user", permissions: ["read_inventory"] });
  mocks.list.mockResolvedValue({});
  render(
    await PendingPage({
      searchParams: Promise.resolve({
        source: "consumption",
        page: "2",
        extra: "ignored",
      }),
    }),
  );
  expect(mocks.list).toHaveBeenCalledWith("page=2&source=consumption");
  expect(screen.getByText("Fila operacional")).toBeTruthy();
});
it("inicial distingue ausência de acesso de falha de consulta", async () => {
  mocks.user.mockResolvedValue({ permissions: [] });
  render(await DashboardPage());
  expect(screen.getByText(/Os módulos disponíveis/)).toBeTruthy();
  cleanup();
  mocks.user.mockResolvedValue({ permissions: ["read_inventory"] });
  mocks.list.mockRejectedValueOnce(new Error("offline"));
  render(await DashboardPage());
  expect(screen.getByText(/Não foi possível consultar/)).toBeTruthy();
  cleanup();
  mocks.list.mockResolvedValue({});
  render(await DashboardPage());
  expect(screen.getByText("Resumo operacional")).toBeTruthy();
});
it("proxy mantém consulta sem mutação e encaminha ações", async () => {
  mocks.list.mockResolvedValue({ items: [] });
  expect(
    (
      await GET(
        new NextRequest(
          "http://localhost/api/operational-pending?source=maintenance",
        ),
      )
    ).status,
  ).toBe(200);
  expect(mocks.list).toHaveBeenCalledWith("source=maintenance");
  expect(mocks.reconcile).not.toHaveBeenCalled();
  mocks.act.mockResolvedValue({ ok: true });
  mocks.reconcile.mockResolvedValue({ ok: true });
  const post = (body: unknown) =>
    POST(
      new NextRequest("http://localhost/api/operational-pending", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  expect((await post({ ids: ["id"], action: "read" })).status).toBe(200);
  expect((await post({ action: "reconcile" })).status).toBe(200);
  mocks.act.mockRejectedValueOnce(
    Object.assign(new Error("Conflito"), { statusCode: 409 }),
  );
  expect((await post({ ids: ["id"], action: "claim" })).status).toBe(409);
  mocks.list.mockRejectedValueOnce(new Error("offline"));
  expect(
    (await GET(new NextRequest("http://localhost/api/operational-pending")))
      .status,
  ).toBe(500);
});
