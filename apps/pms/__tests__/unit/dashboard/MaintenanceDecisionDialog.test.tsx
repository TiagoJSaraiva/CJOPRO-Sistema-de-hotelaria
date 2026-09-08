// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { MaintenanceDecisionDialog } from "../../../src/app/dashboard/maintenance/_components/MaintenanceDecisionDialog";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function setup() {
  const submit = vi.fn().mockResolvedValue(true),
    close = vi.fn();
  render(
    <MaintenanceDecisionDialog
      decision={{
        title: "Selecionar duplicidade",
        path: "/duplicate",
        body: {},
        field: "reason",
        duplicate: true,
      }}
      occurrenceId="origin"
      occurrenceCode="OCO-1"
      referenceData={{
        rooms: [],
        locations: [],
        stays: [],
        categories: [],
        assignable_users: [],
      }}
      submit={submit}
      close={close}
    />,
  );
  return { submit, close };
}
it("busca com filtros, exclui origem e confirma destino e motivo aparado", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      total: 2,
      items: [
        { id: "origin", code: "OCO-1", description: "Origem" },
        {
          id: "target",
          code: "OCO-2",
          description: "Vazamento",
          room_number: "101",
          status: "triaged",
          created_at: "2026-09-08T12:00:00Z",
        },
      ],
    }),
  });
  vi.stubGlobal("fetch", fetchMock);
  const { submit, close } = setup();
  await userEvent.type(
    screen.getByLabelText("Buscar código ou descrição"),
    "Vazamento",
  );
  await userEvent.selectOptions(screen.getByLabelText("Situação"), "triaged");
  await userEvent.click(
    screen.getByRole("button", { name: "Buscar ocorrências" }),
  );
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining("search=Vazamento&status=triaged"),
  );
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining("canonical=true"),
  );
  expect(screen.getAllByRole("radio")).toHaveLength(1);
  expect(
    screen
      .getByRole("link", { name: "Comparar detalhes" })
      .getAttribute("href"),
  ).toContain("target");
  await userEvent.click(screen.getByRole("radio"));
  await userEvent.type(
    screen.getByLabelText("Justificativa / observação"),
    "  Mesmo vazamento  ",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Confirmar decisão" }),
  );
  expect(submit).toHaveBeenCalledWith("/duplicate", {
    reason: "Mesmo vazamento",
    duplicate_of_id: "target",
  });
  expect(close).toHaveBeenCalledOnce();
});
it("não envia seleção ausente ou motivo vazio e preserva saída por Escape", async () => {
  const { submit, close } = setup();
  await userEvent.type(
    screen.getByLabelText("Justificativa / observação"),
    "   ",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Confirmar decisão" }),
  );
  expect(screen.getByRole("alert").textContent).toContain("justificativa real");
  await userEvent.type(
    screen.getByLabelText("Justificativa / observação"),
    "Mesmo problema",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Confirmar decisão" }),
  );
  expect(screen.getByRole("alert").textContent).toContain("Selecione");
  expect(submit).not.toHaveBeenCalled();
  await userEvent.keyboard("{Escape}");
  expect(close).toHaveBeenCalledOnce();
});
it("mostra falha de busca sem inventar resultados", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error("Busca indisponível")),
  );
  setup();
  await userEvent.click(
    screen.getByRole("button", { name: "Buscar ocorrências" }),
  );
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "Busca indisponível",
  );
  expect(screen.queryByRole("radio")).toBeNull();
});
