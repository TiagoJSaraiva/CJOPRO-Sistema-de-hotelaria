// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  AdminMaintenanceOccurrenceDetail,
  AdminMaintenanceReferenceData,
} from "@hotel/shared";
import { HotelTimeZoneProvider } from "../../../src/app/dashboard/_components/HotelTimeZone";
import { MaintenanceOccurrenceWorkspace } from "../../../src/app/dashboard/maintenance/_components/MaintenanceOccurrenceWorkspace";

const initial = {
  id: "occurrence",
  code: "OCO-000001",
  category_name: "Elétrica",
  description: "Lâmpada apagada",
  status: "triaged",
  priority: "normal",
  kind: "maintenance",
  liability_status: "not_assessed",
  active_block: false,
  room_number: "101",
  room_id: "room",
  work_orders: [],
  attachments: [],
  room_blocks: [],
  inspections: [],
  events: [
    {
      id: "event",
      actor_name: "Ana",
      event_type: "occurrence_created",
      message: "Lâmpada apagada",
    },
  ],
} as unknown as AdminMaintenanceOccurrenceDetail;
const referenceData: AdminMaintenanceReferenceData = {
  operational_date: "2026-09-01",
  categories: [],
  locations: [],
  rooms: [],
  stays: [],
  assignable_users: [],
};
const access = {
  canCreate: false,
  canTriage: false,
  canExecute: false,
  canManageBlocks: false,
  canInspect: false,
  canConfirmLiability: false,
  canManageSuppliers: false,
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("preserva contexto, histórico e restrições do leitor", () => {
  render(
    <MaintenanceOccurrenceWorkspace
      initial={initial}
      referenceData={referenceData}
      access={access}
    />,
  );
  expect(screen.getByText("Quarto 101")).toBeTruthy();
  expect(screen.getByText("Ana")).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Cancelar ocorrência" }),
  ).toBeNull();
});

it("traduz responsabilidade e componentes do impacto", () => {
  render(
    <MaintenanceOccurrenceWorkspace
      initial={
        {
          ...initial,
          impact_components: [{ key: "guest_present", points: 20 }],
        } as never
      }
      suppliers={[]}
      referenceData={referenceData}
      access={access}
    />,
  );

  expect(screen.getByText("Não avaliada")).toBeTruthy();
  expect(screen.getByText(/Hóspede no quarto/)).toBeTruthy();
  expect(screen.queryByText(/guest_present/)).toBeNull();
  expect(screen.queryByText("not_assessed")).toBeNull();
});

it("identifica as datas do bloqueio para quem pode gerenciá-lo", () => {
  render(
    <MaintenanceOccurrenceWorkspace
      initial={initial}
      referenceData={referenceData}
      access={{ ...access, canManageBlocks: true }}
    />,
  );
  expect(screen.getByLabelText("Início do bloqueio").getAttribute("name")).toBe(
    "start_date",
  );
  expect(
    screen.getByLabelText("Fim previsto do bloqueio").getAttribute("name"),
  ).toBe("end_date");
});

it("requires a real release reason and explains the governance inspection", async () => {
  const blocked = structuredClone(initial) as AdminMaintenanceOccurrenceDetail;
  blocked.active_block = true;
  blocked.room_blocks = [
    {
      id: "block-1",
      start_date: "2026-09-19",
      planned_end_date: "2026-09-20",
      released_at: null,
      is_overdue: false,
    },
  ] as AdminMaintenanceOccurrenceDetail["room_blocks"];
  const fetchMock = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ item: blocked }) });
  vi.stubGlobal("fetch", fetchMock);
  render(
    <MaintenanceOccurrenceWorkspace
      initial={blocked}
      referenceData={referenceData}
      access={{ ...access, canManageBlocks: true }}
    />,
  );

  expect(
    screen.getByText(/o quarto ainda não fica pronto para hóspedes/i),
  ).toBeTruthy();
  await userEvent.type(
    screen.getByLabelText("Justificativa da liberação técnica"),
    "Serviço e inspeção técnica concluídos",
  );
  await userEvent.click(
    screen.getByRole("button", {
      name: "Liberar para inspeção da governança",
    }),
  );
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/maintenance/room-blocks/block-1/release",
    expect.objectContaining({
      body: JSON.stringify({
        reason: "Serviço e inspeção técnica concluídos",
      }),
    }),
  );
  const message = await screen.findByRole("status");
  expect(message.textContent).toContain(
    "A inspeção final da governança foi criada",
  );
  expect(message.textContent).toContain("ainda não está pronto");
});

it("mostra a recusa como falha, não como sucesso", async () => {
  const blocked = structuredClone(initial) as AdminMaintenanceOccurrenceDetail;
  blocked.room_blocks = [
    {
      id: "block-1",
      start_date: "2026-09-19",
      planned_end_date: "2026-09-20",
      released_at: null,
      is_overdue: false,
    },
  ] as AdminMaintenanceOccurrenceDetail["room_blocks"];
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: "Conclua a ordem antes de liberar." }),
    }),
  );
  render(
    <MaintenanceOccurrenceWorkspace
      initial={blocked}
      referenceData={referenceData}
      access={{ ...access, canManageBlocks: true }}
    />,
  );
  await userEvent.type(
    screen.getByLabelText("Justificativa da liberação técnica"),
    "Tentativa cedo",
  );
  await userEvent.click(
    screen.getByRole("button", {
      name: "Liberar para inspeção da governança",
    }),
  );
  const message = await screen.findByText("Conclua a ordem antes de liberar.");
  expect(message.getAttribute("role")).toBe("alert");
  expect(message.className).toContain("pms-alert-error");
});

it("mostra a avaliação de reparar ou substituir em português", () => {
  const item = structuredClone(initial) as AdminMaintenanceOccurrenceDetail;
  item.lifecycle_decisions = [
    {
      id: "decision",
      status: "submitted",
      recommendation: "replace",
      version: 1,
      options: [
        {
          id: "option",
          kind: "repair",
          estimated_cost: 100,
          estimated_downtime_hours: 2,
        },
      ],
    },
  ] as unknown as AdminMaintenanceOccurrenceDetail["lifecycle_decisions"];
  const { container } = render(
    <MaintenanceOccurrenceWorkspace
      initial={item}
      referenceData={referenceData}
      access={access}
    />,
  );
  expect(container.textContent).toContain("Avaliação: aguardando aprovação");
  expect(container.textContent).toContain("Recomendação: Substituir");
  expect(container.textContent).toContain("Reparar");
  expect(container.textContent).not.toContain("submitted");
});

it("traduz a prioridade e não expõe o identificador da estadia", () => {
  const item = structuredClone(initial) as AdminMaintenanceOccurrenceDetail;
  item.priority = "critical";
  item.stay_id = "91000000-0000-4000-8000-000000000001";
  const { container } = render(
    <MaintenanceOccurrenceWorkspace
      initial={item}
      referenceData={referenceData}
      access={access}
    />,
  );
  expect(container.textContent).toContain("Crítica");
  expect(container.textContent).toContain("Vinculada");
  expect(container.textContent).not.toContain("91000000-0000");
});

it("identifica a recomendação da avaliação de ciclo de vida", () => {
  render(
    <MaintenanceOccurrenceWorkspace
      initial={initial}
      referenceData={referenceData}
      access={{ ...access, canProposeLifecycle: true }}
    />,
  );
  expect(
    screen.getByLabelText("Recomendação operacional").getAttribute("name"),
  ).toBe("recommendation");
});

it("envia comentário real ao contexto da ocorrência", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ item: initial }) });
  vi.stubGlobal("fetch", fetchMock);
  render(
    <MaintenanceOccurrenceWorkspace
      initial={initial}
      referenceData={referenceData}
      access={access}
    />,
  );
  await userEvent.type(
    screen.getByPlaceholderText("Adicionar comentário"),
    "Acesso combinado às 14h",
  );
  await userEvent.click(screen.getByRole("button", { name: "Comentar" }));
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/maintenance/occurrences/occurrence/comments",
    expect.objectContaining({
      body: JSON.stringify({ reason: "Acesso combinado às 14h" }),
    }),
  );
});

it("pede motivo de cancelamento e preserva o foco ao voltar", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ item: initial }) });
  vi.stubGlobal("fetch", fetchMock);
  render(
    <MaintenanceOccurrenceWorkspace
      initial={initial}
      referenceData={referenceData}
      access={{ ...access, canTriage: true }}
    />,
  );
  const button = screen.getByRole("button", { name: "Cancelar ocorrência" });
  await userEvent.click(button);
  expect(screen.getByRole("dialog")).toBeTruthy();
  await userEvent.keyboard("{Escape}");
  expect(document.activeElement).toBe(button);
  await userEvent.click(button);
  await userEvent.type(
    screen.getByLabelText("Justificativa / observação"),
    "Registro aberto no quarto incorreto",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Confirmar decisão" }),
  );
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/maintenance/occurrences/occurrence/cancel",
    expect.objectContaining({
      body: JSON.stringify({ reason: "Registro aberto no quarto incorreto" }),
    }),
  );
});

describe("datas da ordem de serviço na hora do hotel", () => {
  const waiting = {
    ...initial,
    sla_response_due_at: "2026-05-12T15:30:00.000Z",
    work_orders: [
      {
        id: "order",
        status: "waiting",
        title: "Trocar lâmpada",
        waiting_episode: {
          owner_name: "Marina",
          next_follow_up_at: "2026-05-12T15:30:00.000Z",
          version: 3,
        },
      },
    ],
  } as unknown as typeof initial;

  function renderIn(timeZone: string | null) {
    render(
      <HotelTimeZoneProvider timeZone={timeZone}>
        <MaintenanceOccurrenceWorkspace
          initial={waiting}
          referenceData={referenceData}
          access={access}
        />
      </HotelTimeZoneProvider>,
    );
    const form = screen
      .getByRole("button", { name: "Registrar cobrança" })
      .closest("form") as HTMLFormElement;
    fireEvent.change(form.querySelector('[name="notes"]') as HTMLInputElement, {
      target: { value: "Fornecedor respondeu" },
    });
    fireEvent.change(
      form.querySelector('[name="next_follow_up_at"]') as HTMLInputElement,
      { target: { value: "2026-05-13T00:30" } },
    );
    return form;
  }

  it("mostra prazo e cobrança no fuso do hotel", () => {
    renderIn("Asia/Tokyo");
    expect(screen.getByText("13/05/2026, 00:30:00")).toBeTruthy();
    expect(
      screen.getByText(/Marina · cobrar em 13\/05\/2026, 00:30:00/),
    ).toBeTruthy();
  });

  it("grava a próxima cobrança na hora digitada no fuso do hotel", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ item: waiting }),
    });
    vi.stubGlobal("fetch", fetchMock);
    fireEvent.submit(renderIn("Asia/Tokyo"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).next_follow_up_at).toBe(
      "2026-05-12T15:30:00.000Z",
    );
  });

  it("sem o relógio do hotel, avisa e não grava em outro fuso", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    fireEvent.submit(renderIn(null));
    expect(await screen.findByText("Data e hora inválidas.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
