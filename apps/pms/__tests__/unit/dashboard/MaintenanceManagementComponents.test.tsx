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
  AdminMaintenanceAnalytics,
  AdminMaintenancePreventivePlan,
  AdminMaintenancePreventiveRun,
  AdminMaintenanceReferenceData,
  AdminMaintenanceSupplier,
} from "@hotel/shared";
import { MaintenanceAnalyticsExports } from "../../../src/app/dashboard/maintenance/_components/MaintenanceAnalyticsExports";
import { MaintenanceNotificationInbox } from "../../../src/app/dashboard/maintenance/_components/MaintenanceNotificationInbox";
import { MaintenancePreventiveManager } from "../../../src/app/dashboard/maintenance/_components/MaintenancePreventiveManager";
import { MaintenanceSlaManager } from "../../../src/app/dashboard/maintenance/_components/MaintenanceSlaManager";
import { MaintenanceSupplierManager } from "../../../src/app/dashboard/maintenance/_components/MaintenanceSupplierManager";

const refresh = vi.fn();
const pdfSave = vi.fn();
const pdfText = vi.fn();
const autoTable = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("jspdf", () => ({
  jsPDF: class {
    setFontSize() {}
    text = pdfText;
    save = pdfSave;
    lastAutoTable = { finalY: 42 };
  },
}));
vi.mock("jspdf-autotable", () => ({
  default: (...args: unknown[]) => autoTable(...args),
}));

const references: AdminMaintenanceReferenceData = {
  rooms: [{ id: "room-1", room_number: "101", room_type: "standard" }],
  locations: [
    {
      id: "location-1",
      hotel_id: "hotel-1",
      name: "Gerador",
      description: null,
      kind: "equipment",
      parent_location_id: null,
      is_active: true,
      asset_tag: "AT-1",
      manufacturer: "Demo",
      model: "GX",
      serial_number: "SN-1",
      installed_on: "2026-01-01",
      warranty_ends_on: "2027-01-01",
      supplier_id: "supplier-1",
      contract_id: "contract-1",
      lifecycle_status: "active",
      display_order: 1,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ],
  categories: [
    {
      id: "category-1",
      hotel_id: "hotel-1",
      name: "Elétrica",
      description: null,
      display_order: 1,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "category-off",
      hotel_id: "hotel-1",
      name: "Inativa",
      description: null,
      display_order: 2,
      is_active: false,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ],
  stays: [],
  assignable_users: [{ id: "user-1", name: "Marina" }],
};

const contract = {
  id: "contract-1",
  supplier_id: "supplier-1",
  contract_number: "CT-1",
  kind: "fixed" as const,
  status: "active" as const,
  starts_on: "2026-01-01",
  ends_on: "2026-12-31",
  renewal_notice_on: null,
  scope_notes: "Gerador",
  response_hours: 4,
  resolution_hours: 24,
  commercial_terms: "Mensal",
  contract_amount: 500,
  currency: "BRL",
  category_ids: ["category-1"],
  location_ids: ["location-1"],
  documents: [
    {
      id: "document-contract",
      original_filename: "contrato.pdf",
      content_type: "application/pdf",
      size_bytes: 120,
      created_at: "2026-01-01T00:00:00Z",
    },
  ],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const suppliers: AdminMaintenanceSupplier[] = [
  {
    id: "supplier-1",
    hotel_id: "hotel-1",
    name: "Manutenção Demo",
    legal_name: "Demo Ltda",
    tax_document: "123",
    email: "demo@example.com",
    phone: null,
    specialties: ["Elétrica"],
    notes: "Plantão",
    status: "active",
    contacts: [
      {
        id: "contact-1",
        supplier_id: "supplier-1",
        name: "Ana",
        role: "Plantão",
        email: "ana@example.com",
        phone: null,
        is_primary: true,
        is_active: true,
      },
    ],
    contracts: [contract],
    documents: [
      {
        id: "document-supplier",
        original_filename: "cadastro.pdf",
        content_type: "application/pdf",
        size_bytes: 100,
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const plan: AdminMaintenancePreventivePlan = {
  id: "plan-1",
  hotel_id: "hotel-1",
  name: "Revisão do gerador",
  category_id: "category-1",
  room_id: null,
  location_id: "location-1",
  assigned_to: "user-1",
  supplier_id: "supplier-1",
  contract_id: "contract-1",
  priority: "high",
  instructions: "Testar partida",
  requires_inspection: true,
  blocking_recommended: false,
  recurrence_unit: "monthly",
  recurrence_interval: 1,
  recurrence_day: 31,
  starts_on: "2026-01-31",
  ends_on: null,
  local_time: "09:00:00",
  generation_lead_days: 2,
  completion_due_hours: 24,
  next_due_date: "2026-02-28",
  status: "active",
  tasks: [
    {
      id: "task-1",
      position: 0,
      description: "Testar partida",
      is_required: true,
    },
  ],
  category_name: "Elétrica",
  target_name: "Gerador",
  assignee_name: "Marina",
  supplier_name: "Manutenção Demo",
  contract_number: "CT-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const deferredRun: AdminMaintenancePreventiveRun = {
  id: "run-1",
  plan_id: "plan-1",
  scheduled_for: "2026-02-28T12:00:00Z",
  scheduled_local_date: "2026-02-28",
  status: "deferred",
  occurrence_id: null,
  work_order_id: null,
  snapshot: {},
  decision_reason: null,
  rescheduled_for: null,
  created_at: "2026-02-20T00:00:00Z",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("componentes da gestão avançada de manutenção", () => {
  it("cria política de SLA e apresenta conflito devolvido pela API", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 201 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Política duplicada." }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    const { rerender } = render(
      <MaintenanceSlaManager
        policies={[
          {
            id: "sla-1",
            hotel_id: "hotel-1",
            category_id: null,
            category_name: null,
            priority: "critical",
            name: "SLA crítico",
            response_hours: 1,
            resolution_hours: 8,
            is_active: true,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ]}
        categories={references.categories}
        canManage
      />,
    );
    await user.type(screen.getByLabelText("Nome"), "SLA elétrico");
    await user.selectOptions(screen.getByLabelText("Categoria"), "category-1");
    await user.type(screen.getByLabelText("Resposta (horas)"), "2");
    await user.type(screen.getByLabelText("Resolução (horas)"), "10");
    await user.click(screen.getByRole("button", { name: "Criar política" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    await user.type(screen.getByLabelText("Nome"), "SLA repetido");
    await user.type(screen.getByLabelText("Resposta (horas)"), "2");
    await user.type(screen.getByLabelText("Resolução (horas)"), "10");
    await user.click(screen.getByRole("button", { name: "Criar política" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Política duplicada",
    );
    rerender(
      <MaintenanceSlaManager policies={[]} categories={[]} canManage={false} />,
    );
    expect(screen.queryByRole("button", { name: "Criar política" })).toBeNull();
  });

  it("opera a caixa de notificações, filtros e leitura em massa", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(
      <MaintenanceNotificationInbox
        initialItems={[
          {
            id: "notification-1",
            kind: "sla_resolution",
            severity: "critical",
            title: "SLA vencido",
            message: "Resolva a ocorrência.",
            href: "/dashboard/maintenance/occurrences/occurrence-1",
            entity_type: "occurrence",
            entity_id: "occurrence-1",
            status: "unread",
            created_at: "2026-01-01T00:00:00Z",
          },
          {
            id: "notification-2",
            kind: "contract_expiry",
            severity: "warning",
            title: "Contrato vencendo",
            message: "Revise a vigência.",
            href: "/dashboard/maintenance/suppliers",
            entity_type: "contract",
            entity_id: "contract-1",
            status: "read",
            created_at: "2026-01-02T00:00:00Z",
          },
        ]}
      />,
    );
    await user.selectOptions(screen.getByLabelText("Filtrar"), "unread");
    expect(screen.getByText("SLA vencido")).toBeTruthy();
    expect(screen.queryByText("Contrato vencendo")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Marcar lida" }));
    await user.selectOptions(screen.getByLabelText("Filtrar"), "all");
    await user.click(screen.getAllByRole("button", { name: "Dispensar" })[0]!);
    await user.click(
      screen.getByRole("button", { name: "Marcar todas como lidas" }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("edita plano, altera recorrência e decide competência adiada", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "prompt")
      .mockReturnValueOnce("Executar agora")
      .mockReturnValueOnce("Reagendar")
      .mockReturnValueOnce("2026-03-05");
    Element.prototype.scrollIntoView = vi.fn();
    const user = userEvent.setup();
    render(
      <MaintenancePreventiveManager
        plans={[plan]}
        runs={[deferredRun]}
        references={references}
        suppliers={suppliers}
        canManage
      />,
    );
    await user.click(screen.getByRole("button", { name: "Editar" }));
    expect(
      screen.getByRole("button", { name: "Salvar alterações" }),
    ).toBeTruthy();
    const recurrence = screen.getByLabelText("Recorrência");
    await user.selectOptions(recurrence, "daily");
    await user.selectOptions(recurrence, "weekly");
    await user.selectOptions(recurrence, "yearly");
    await user.click(screen.getByRole("button", { name: "Pausar" }));
    await user.click(screen.getByRole("button", { name: "Gerar agora" }));
    await user.click(screen.getByRole("button", { name: "Reagendar" }));
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/maintenance/preventive-runs/run-1/reschedule",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("cobre estados vazios e erros de plano sem oferecer mutações a executor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 409 })),
    );
    const user = userEvent.setup();
    const { rerender } = render(
      <MaintenancePreventiveManager
        plans={[plan]}
        runs={[]}
        references={references}
        suppliers={[]}
        canManage
      />,
    );
    await user.click(screen.getByRole("button", { name: "Desativar" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    rerender(
      <MaintenancePreventiveManager
        plans={[]}
        runs={[]}
        references={references}
        suppliers={[]}
        canManage={false}
      />,
    );
    expect(screen.getByText("Nenhum plano cadastrado.")).toBeTruthy();
    expect(screen.queryByText("Novo plano")).toBeNull();
  });

  it("mantém termos financeiros condicionados e opera fornecedor, contato e documentos", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "prompt").mockReturnValue("Documento substituído");
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const user = userEvent.setup();
    render(
      <MaintenanceSupplierManager
        suppliers={suppliers}
        categories={references.categories}
        locations={references.locations}
        canReadFinance
      />,
    );
    expect(screen.getByText(/R\$\s*500,00/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Desativar" }));
    await user.click(screen.getByText("Adicionar contato"));
    await user.type(screen.getByLabelText("Nome do contato"), "Carlos");
    await user.type(
      screen.getByLabelText("E-mail do contato"),
      "carlos@example.com",
    );
    await user.click(screen.getByRole("button", { name: "Salvar contato" }));
    await user.click(
      screen.getByRole("button", { name: "Abrir cadastro.pdf" }),
    );
    expect(open).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Remover cadastro.pdf" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/maintenance/management-documents/document-supplier/remove",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("exporta CSV detalhado e PDF executivo sem depender de rede", async () => {
    const createObjectURL = vi.fn(() => "blob:report");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const analytics: AdminMaintenanceAnalytics = {
      filters: { priority: "high" },
      backlog: 3,
      critical_open: 1,
      average_triage_hours: 2,
      average_resolution_hours: 10,
      sla_compliance_rate: 80,
      preventive_compliance_rate: 90,
      recurring_occurrences: 1,
      blocked_room_days: 2.5,
      supplier_completion_rate: 75,
      aging: [],
      series: [],
    };
    render(
      <MaintenanceAnalyticsExports
        analytics={analytics}
        rows={[{ code: "MAN-1", description: 'Teste "CSV"' }]}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Exportar CSV detalhado" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Exportar PDF executivo" }),
    );
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:report");
    expect(autoTable).toHaveBeenCalledTimes(2);
    expect(pdfText).toHaveBeenCalled();
    expect(pdfSave).toHaveBeenCalledWith("manutencao-resumo-executivo.pdf");
  });
});
