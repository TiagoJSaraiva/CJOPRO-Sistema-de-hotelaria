// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { OperationalPendingList } from "@hotel/shared";
import { PendingWorkspace } from "../../../src/app/dashboard/pending/PendingWorkspace";
import { pendingGuide } from "../../../src/app/dashboard/pending/usageGuide";
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
    vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Já assumida" }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => updated }),
  );
  render(<PendingWorkspace initial={data} userId="user" />);
  await userEvent.click(screen.getByRole("button", { name: "Assumir" }));
  expect(await screen.findByText("Já assumida")).toBeTruthy();
  expect(screen.getByText("Responsável: Outra pessoa")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Devolver à fila" })).toBeNull();
});
