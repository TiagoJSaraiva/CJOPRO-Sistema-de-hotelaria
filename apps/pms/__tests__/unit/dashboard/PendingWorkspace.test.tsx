// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { OperationalPendingList } from "@hotel/shared";
import { PendingWorkspace } from "../../../src/app/dashboard/pending/PendingWorkspace";
import { pendingGuide } from "../../../src/app/dashboard/pending/usageGuide";
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const data: OperationalPendingList = {
  items: [
    {
      id: "a",
      entity_id: "room",
      source: "maintenance",
      kind: "sla_response",
      title: "Triagem atrasada",
      href: "/dashboard/maintenance",
      severity: "critical",
      status: "open",
      assigned_to: null,
      assignee_name: null,
      version: 1,
      opened_at: "2026-09-08T12:00:00Z",
      resolved_at: null,
      resolution_reason: null,
      read: false,
    },
  ],
  total: 1,
  summary: { open: 1, claimed: 0, resolved: 0, unread: 1 },
  sync: { last_success_at: null, error_message: null },
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("sincroniza lista, resumo e formulário com novas propriedades da página", () => {
  const { rerender } = render(
    <PendingWorkspace initial={data} userId="user" />,
  );
  rerender(
    <PendingWorkspace
      initial={{ ...data, items: [], total: 0 }}
      userId="user"
      initialQuery="status=claimed"
    />,
  );
  expect(screen.queryByText("Triagem atrasada")).toBeNull();
  expect((screen.getByLabelText("Situação") as HTMLSelectElement).value).toBe(
    "claimed",
  );
  expect(
    screen.getByRole("link", { name: /Assumida/ }).getAttribute("aria-current"),
  ).toBe("page");
});
it("separa leitura de responsabilidade e usa alvos reais do guia", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => data });
  vi.stubGlobal("fetch", fetchMock);
  render(<PendingWorkspace initial={data} userId="user" />);
  for (const step of pendingGuide.steps)
    expect(
      document.querySelector(`[data-usage-guide="${step.target}"]`),
    ).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Marcar lida" }));
  expect(fetchMock.mock.calls[0]?.[1].body).toBe(
    JSON.stringify({ ids: ["a"], action: "read" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Assumir" }));
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/operational-pending",
    expect.objectContaining({
      body: JSON.stringify({
        ids: ["a"],
        action: "claim",
        expected_version: 1,
      }),
    }),
  );
  expect(screen.queryByRole("button", { name: "Resolver" })).toBeNull();
});
it("conflito atualiza responsável e não oferece devolução de outro usuário", async () => {
  const updated = {
    ...data,
    items: [
      {
        ...data.items[0],
        status: "claimed",
        assigned_to: "other",
        assignee_name: "Outra pessoa",
        version: 2,
      },
    ],
  };
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "Já assumida" }),
    }),
  );
  const { rerender } = render(
    <PendingWorkspace initial={data} userId="user" />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Assumir" }));
  expect(await screen.findByText("Já assumida")).toBeTruthy();
  expect(router.refresh).toHaveBeenCalled();
  rerender(
    <PendingWorkspace
      initial={updated as OperationalPendingList}
      userId="user"
    />,
  );
  expect(screen.getByText("Responsável: Outra pessoa")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Devolver à fila" })).toBeNull();
});
it("cards abrem filas globais e filtros/paginação navegam pela URL", async () => {
  render(
    <PendingWorkspace
      initial={{ ...data, total: 31 }}
      userId="user"
      initialQuery="source=maintenance&status=open&page=1"
    />,
  );
  expect(
    screen.getByRole("link", { name: /Assumida/ }).getAttribute("href"),
  ).toBe("/dashboard/pending?status=claimed");
  await userEvent.click(screen.getByRole("button", { name: "Próxima" }));
  expect(router.push).toHaveBeenCalledWith(
    "/dashboard/pending?source=maintenance&status=open&page=2",
  );
  await userEvent.selectOptions(screen.getByLabelText("Situação"), "claimed");
  await userEvent.click(
    screen.getByRole("button", { name: "Aplicar filtros" }),
  );
  expect(router.push).toHaveBeenCalledWith(
    "/dashboard/pending?source=maintenance&status=claimed",
  );
});
it("assumir em fila aberta atualiza a página e orienta a fila de destino", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }),
  );
  const { rerender } = render(
    <PendingWorkspace
      initial={data}
      userId="user"
      initialQuery="status=open"
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Assumir" }));
  expect(router.refresh).toHaveBeenCalled();
  expect(
    screen
      .getByRole("link", { name: "Abrir fila de destino" })
      .getAttribute("href"),
  ).toBe("/dashboard/pending?status=claimed");
  rerender(
    <PendingWorkspace
      initial={{
        ...data,
        items: [],
        total: 0,
        summary: { open: 0, claimed: 1, resolved: 0, unread: 1 },
      }}
      userId="user"
      initialQuery="status=open"
    />,
  );
  expect(screen.queryByText("Triagem atrasada")).toBeNull();
  expect(screen.getByRole("link", { name: /Assumida/ }).textContent).toContain(
    "1",
  );
});
it("mantém a lista e informa falha sem sucesso quando a ação falha", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error("Serviço indisponível")),
  );
  render(<PendingWorkspace initial={data} userId="user" />);
  await userEvent.click(screen.getByRole("button", { name: "Assumir" }));
  expect(await screen.findByText("Serviço indisponível")).toBeTruthy();
  expect(screen.getByText("Triagem atrasada")).toBeTruthy();
  expect(screen.queryByText("Pendências atualizadas.")).toBeNull();
});
it("bloqueia ações duplicadas durante uma requisição", async () => {
  const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
  vi.stubGlobal("fetch", fetchMock);
  render(<PendingWorkspace initial={data} userId="user" />);
  await userEvent.dblClick(screen.getByRole("button", { name: "Assumir" }));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(
    (screen.getByRole("button", { name: "Assumir" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});
it.each(["status=claimed", "assignee=me"])(
  "devolver explica saída da fila %s e preserva consulta aplicada",
  async (query) => {
    const claimed: OperationalPendingList = {
      ...data,
      items: [
        {
          ...data.items[0]!,
          status: "claimed",
          assigned_to: "user",
          assignee_name: "Operador",
          version: 2,
        },
      ],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <PendingWorkspace initial={claimed} userId="user" initialQuery={query} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Devolver à fila" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/operational-pending",
      expect.objectContaining({
        body: JSON.stringify({
          ids: ["a"],
          action: "release",
          expected_version: 2,
        }),
      }),
    );
    expect(router.refresh).toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole("link", { name: "Abrir fila de destino" })
        .getAttribute("href"),
    ).toBe("/dashboard/pending?status=open");
  },
);
it("ler na fila não lida oferece acesso à leitura de destino", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }),
  );
  render(
    <PendingWorkspace
      initial={data}
      userId="user"
      initialQuery="read=unread"
    />,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Marcar esta página como lida" }),
  );
  expect(router.refresh).toHaveBeenCalled();
  expect(
    screen
      .getByRole("link", { name: "Abrir fila de destino" })
      .getAttribute("href"),
  ).toBe("/dashboard/pending?read=read");
  expect(screen.getByRole("status").textContent).toContain("filtro de leitura");
});
