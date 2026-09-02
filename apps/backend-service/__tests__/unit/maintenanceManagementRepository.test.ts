import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  storageFrom: vi.fn(),
}));

vi.mock("../../src/common/supabaseServer", () => ({
  createServerClient: () => ({
    from: mocks.from,
    rpc: mocks.rpc,
    storage: { from: mocks.storageFrom },
  }),
}));

import { createMaintenanceManagementRepository } from "../../src/repositories/maintenanceManagementRepository";

type QueryResult = {
  data: any;
  error: Error | null;
  count?: number | null;
};

class FakeQuery implements PromiseLike<QueryResult> {
  constructor(private readonly result: QueryResult) {}
  select() {
    return this;
  }
  insert() {
    return this;
  }
  update() {
    return this;
  }
  eq() {
    return this;
  }
  is() {
    return this;
  }
  not() {
    return this;
  }
  in() {
    return this;
  }
  gte() {
    return this;
  }
  lte() {
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  async single() {
    return {
      ...this.result,
      data: Array.isArray(this.result.data)
        ? (this.result.data[0] ?? null)
        : this.result.data,
    };
  }
  async maybeSingle() {
    return this.single();
  }
  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

const HOTEL_ID = "10000000-0000-4000-8000-000000000001";
const ACTOR_ID = "80000000-0000-4000-8000-000000000002";
const PLAN_ID = "a1000000-0000-4000-8000-000000000001";
const RUN_ID = "a2000000-0000-4000-8000-000000000001";
const SUPPLIER_ID = "a3000000-0000-4000-8000-000000000001";
const CONTRACT_ID = "a4000000-0000-4000-8000-000000000001";
const OCCURRENCE_ID = "97000000-0000-4000-8000-000000000002";

const planRow = {
  id: PLAN_ID,
  hotel_id: HOTEL_ID,
  name: "Revisão mensal",
  category_id: "category-1",
  room_id: null,
  location_id: "location-1",
  assigned_to: ACTOR_ID,
  supplier_id: SUPPLIER_ID,
  contract_id: CONTRACT_ID,
  priority: "normal",
  instructions: "Revisar equipamento",
  requires_inspection: true,
  blocking_recommended: false,
  recurrence_unit: "monthly",
  recurrence_interval: 1,
  starts_on: "2026-09-01",
  ends_on: null,
  local_time: "09:00:00",
  generation_lead_days: 2,
  completion_due_hours: 24,
  recurrence_day: 1,
  next_due_date: "2026-10-01",
  status: "active",
  category: { name: "Climatização" },
  room: null,
  location: { name: "Ar-condicionado 101" },
  assignee: { name: "Técnico" },
  supplier: { name: "Clima Ltda" },
  contract: { contract_number: "CTR-1" },
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

const runRow = {
  id: RUN_ID,
  plan_id: PLAN_ID,
  scheduled_for: "2026-09-01T12:00:00Z",
  scheduled_local_date: "2026-09-01",
  status: "generated",
  occurrence_id: OCCURRENCE_ID,
  work_order_id: "order-1",
  snapshot: { name: "Revisão mensal" },
  decision_reason: null,
  rescheduled_for: null,
  created_at: "2026-08-30T00:00:00Z",
};

const slaRow = {
  id: "sla-1",
  hotel_id: HOTEL_ID,
  category_id: null,
  category: null,
  priority: "normal",
  name: "Normal",
  response_hours: 12,
  resolution_hours: 72,
  is_active: true,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

const contactRow = {
  id: "contact-1",
  supplier_id: SUPPLIER_ID,
  name: "Maria",
  role: "Comercial",
  email: "maria@example.test",
  phone: "11999990000",
  is_primary: true,
  is_active: true,
};

const contractRow = {
  id: CONTRACT_ID,
  hotel_id: HOTEL_ID,
  supplier_id: SUPPLIER_ID,
  contract_number: "CTR-1",
  kind: "fixed",
  status: "active",
  starts_on: "2026-01-01",
  ends_on: "2026-12-31",
  renewal_notice_on: "2026-12-01",
  scope_notes: "Climatização",
  response_hours: 4,
  resolution_hours: 24,
  commercial_terms: "Mensal",
  contract_amount: 500,
  currency: "BRL",
  category_scopes: [
    { category_id: "category-1", is_active: true },
    { category_id: "category-inactive", is_active: false },
  ],
  location_scopes: [{ location_id: "location-1", is_active: true }],
  documents: [
    {
      id: "document-1",
      original_filename: "contrato.pdf",
      content_type: "application/pdf",
      size_bytes: 1024,
      created_at: "2026-09-01T00:00:00Z",
      removed_at: null,
    },
    {
      id: "document-removed",
      original_filename: "antigo.pdf",
      content_type: "application/pdf",
      size_bytes: 512,
      created_at: "2026-08-01T00:00:00Z",
      removed_at: "2026-08-02T00:00:00Z",
    },
  ],
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

const supplierRow = {
  id: SUPPLIER_ID,
  hotel_id: HOTEL_ID,
  name: "Clima Ltda",
  legal_name: "Clima Serviços Ltda",
  tax_document: "00.000.000/0001-00",
  email: "contato@example.test",
  phone: "1133334444",
  specialties: ["Climatização"],
  notes: "Atendimento 24h",
  status: "active",
  contacts: [contactRow],
  contracts: [contractRow],
  documents: contractRow.documents,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

function query(data: any, count?: number) {
  return new FakeQuery({ data, error: null, count });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("maintenance management repository", () => {
  it("mapeia planos, competências, SLA e operações atômicas", async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({
      data:
        name === "upsert_maintenance_preventive_plan"
          ? PLAN_ID
          : name === "decide_maintenance_preventive_run"
            ? RUN_ID
            : name === "complete_maintenance_checklist_item"
              ? OCCURRENCE_ID
              : name === "transition_maintenance_supplier_work"
                ? OCCURRENCE_ID
                : true,
      error: null,
    }));
    mocks.from.mockImplementation((table: string) => {
      if (table === "maintenance_preventive_plans") return query([planRow]);
      if (table === "maintenance_preventive_plan_tasks")
        return query([
          {
            id: "task-1",
            position: 1,
            description: "Limpar filtro",
            is_required: true,
          },
        ]);
      if (table === "maintenance_preventive_runs") return query([runRow]);
      if (table === "maintenance_sla_policies") return query([slaRow]);
      return query(null);
    });
    const repository = createMaintenanceManagementRepository();
    const input = {
      name: planRow.name,
      category_id: planRow.category_id,
      location_id: planRow.location_id,
      assigned_to: ACTOR_ID,
      supplier_id: SUPPLIER_ID,
      contract_id: CONTRACT_ID,
      instructions: planRow.instructions,
      recurrence_unit: "monthly" as const,
      starts_on: planRow.starts_on,
      local_time: "09:00",
      tasks: [{ position: 1, description: "Limpar filtro" }],
    };

    expect(await repository.listPlans(HOTEL_ID)).toHaveLength(1);
    expect(await repository.getPlan(HOTEL_ID, PLAN_ID)).toMatchObject({
      target_name: "Ar-condicionado 101",
      supplier_name: "Clima Ltda",
      tasks: [expect.objectContaining({ description: "Limpar filtro" })],
    });
    expect(await repository.savePlan(HOTEL_ID, ACTOR_ID, input)).toMatchObject({
      result: "ok",
    });
    expect(
      await repository.setPlanStatus(HOTEL_ID, ACTOR_ID, PLAN_ID, "paused"),
    ).toMatchObject({ result: "ok" });
    expect(await repository.listRuns(HOTEL_ID, PLAN_ID)).toEqual([
      expect.objectContaining({ id: RUN_ID, status: "generated" }),
    ]);
    expect(
      await repository.decideRun(
        HOTEL_ID,
        ACTOR_ID,
        RUN_ID,
        "reschedule",
        "Acesso indisponível",
        "2026-09-03T12:00:00Z",
      ),
    ).toMatchObject({ result: "ok" });
    expect(
      await repository.completeChecklist(
        HOTEL_ID,
        ACTOR_ID,
        "order-1",
        "task-1",
        true,
        "Concluído",
      ),
    ).toBe(OCCURRENCE_ID);
    expect(
      await repository.transitionSupplierWork(HOTEL_ID, ACTOR_ID, "order-1", {
        action: "send",
        supplier_id: SUPPLIER_ID,
      }),
    ).toBe(OCCURRENCE_ID);
    expect(await repository.listSlaPolicies(HOTEL_ID)).toHaveLength(1);
    expect(
      await repository.createSlaPolicy(HOTEL_ID, ACTOR_ID, {
        name: "Normal",
        priority: "normal",
        response_hours: 12,
        resolution_hours: 72,
      }),
    ).toMatchObject({ result: "ok", item: { response_hours: 12 } });
    expect(
      await repository.updateSlaPolicy(HOTEL_ID, "sla-1", {
        name: "Normal revisada",
        response_hours: 10,
        resolution_hours: 70,
        priority: "normal",
        category_id: null,
        is_active: false,
      }),
    ).toMatchObject({ result: "ok" });
  });

  it("protege dados comerciais e persiste fornecedores, contatos e contratos", async () => {
    mocks.rpc.mockResolvedValue({ data: CONTRACT_ID, error: null });
    mocks.from.mockImplementation((table: string) => {
      if (table === "maintenance_suppliers") return query([supplierRow]);
      if (table === "maintenance_supplier_contacts") return query([contactRow]);
      if (table === "maintenance_contracts") return query([contractRow]);
      return query(null);
    });
    const repository = createMaintenanceManagementRepository();

    const full = await repository.listSuppliers(HOTEL_ID, true);
    expect(full[0]).toMatchObject({
      legal_name: "Clima Serviços Ltda",
      contracts: [
        expect.objectContaining({
          contract_amount: 500,
          category_ids: ["category-1"],
          documents: [expect.objectContaining({ id: "document-1" })],
        }),
      ],
    });
    const limited = await repository.listSuppliers(HOTEL_ID, false, true);
    expect(limited[0]).toMatchObject({
      legal_name: null,
      contacts: [],
      documents: [],
      contracts: [expect.objectContaining({ documents: [] })],
    });
    expect(
      await repository.createSupplier(HOTEL_ID, ACTOR_ID, {
        name: "Clima Ltda",
        specialties: ["Climatização"],
      }),
    ).toMatchObject({ result: "ok" });
    expect(
      await repository.updateSupplier(HOTEL_ID, SUPPLIER_ID, {
        name: "Clima Atualizada",
        legal_name: null,
        tax_document: null,
        email: null,
        phone: null,
        specialties: [],
        notes: null,
        status: "inactive",
      }),
    ).toMatchObject({ result: "ok" });
    expect(
      await repository.createContact(HOTEL_ID, ACTOR_ID, SUPPLIER_ID, {
        name: "Maria",
        is_primary: true,
      }),
    ).toMatchObject({ result: "ok" });
    expect(
      await repository.updateContact(HOTEL_ID, "contact-1", {
        name: "Maria Silva",
        role: null,
        email: null,
        phone: null,
        is_primary: false,
        is_active: false,
      }),
    ).toMatchObject({ result: "ok" });
    const contractInput = {
      contract_number: "CTR-1",
      kind: "fixed",
      status: "active",
      starts_on: "2026-01-01",
      ends_on: "2026-12-31",
      category_ids: ["category-1"],
      location_ids: ["location-1"],
      commercial_terms: "Mensal",
      contract_amount: 500,
      currency: "BRL",
    };
    expect(
      await repository.createContract(
        HOTEL_ID,
        ACTOR_ID,
        SUPPLIER_ID,
        contractInput,
      ),
    ).toMatchObject({ result: "ok", item: { contract_amount: 500 } });
    expect(
      await repository.updateContract(HOTEL_ID, ACTOR_ID, CONTRACT_ID, {
        status: "terminated",
        termination_reason: "Encerrado",
      }),
    ).toMatchObject({ result: "ok" });
  });

  it("calcula indicadores, exporta o recorte e opera notificações e automação", async () => {
    const occurrences = [
      {
        id: OCCURRENCE_ID,
        occurrence_number: 7,
        kind: "preventive",
        priority: "critical",
        status: "resolved",
        description: "Revisão",
        category_id: "category-1",
        room_id: null,
        location_id: "location-1",
        preventive_plan_id: PLAN_ID,
        created_at: "2026-08-01T10:00:00Z",
        triaged_at: "2026-08-01T11:00:00Z",
        operational_resolved_at: "2026-08-01T14:00:00Z",
        sla_response_due_at: "2026-08-01T12:00:00Z",
        sla_resolution_due_at: "2026-08-01T18:00:00Z",
        category: { name: "Climatização" },
        room: null,
        location: { name: "Ar-condicionado 101" },
        plan: { name: "Revisão mensal" },
      },
      {
        id: "occurrence-2",
        occurrence_number: 8,
        kind: "damage",
        priority: "normal",
        status: "reported",
        description: "Falha recorrente",
        category_id: "category-1",
        room_id: null,
        location_id: "location-1",
        preventive_plan_id: null,
        created_at: "2026-08-15T10:00:00Z",
        triaged_at: null,
        operational_resolved_at: null,
        sla_response_due_at: null,
        sla_resolution_due_at: null,
        category: { name: "Climatização" },
        room: null,
        location: { name: "Ar-condicionado 101" },
        plan: null,
      },
    ];
    mocks.rpc.mockImplementation(async (name: string) => ({
      data: name === "mark_all_maintenance_notifications_read" ? 2 : true,
      error: null,
    }));
    mocks.from.mockImplementation((table: string) => {
      if (table === "maintenance_occurrences") return query(occurrences, 2);
      if (table === "maintenance_preventive_runs")
        return query([
          { status: "generated", scheduled_local_date: "2026-08-01" },
          { status: "skipped", scheduled_local_date: "2026-08-02" },
        ]);
      if (table === "room_blocks")
        return query([
          {
            start_date: "2026-08-01T00:00:00Z",
            end_date: "2026-08-03T00:00:00Z",
            released_at: null,
          },
        ]);
      if (table === "maintenance_work_orders")
        return query([
          {
            occurrence_id: OCCURRENCE_ID,
            supplier_id: SUPPLIER_ID,
            supplier_status: "completed",
          },
        ]);
      if (table === "maintenance_cost_items")
        return query([{ occurrence_id: OCCURRENCE_ID, actual_amount: 200 }]);
      if (table === "maintenance_recoveries")
        return query([{ occurrence_id: OCCURRENCE_ID, charge_amount: 50 }]);
      if (table === "hotels") return query({ currency: "BRL" });
      if (table === "maintenance_notifications")
        return query(
          [
            {
              id: "notification-1",
              kind: "sla_due",
              severity: "warning",
              title: "SLA próximo",
              message: "Prazo próximo",
              href: "/dashboard/maintenance/occurrences/1",
              entity_type: "occurrence",
              entity_id: OCCURRENCE_ID,
              status: "unread",
              created_at: "2026-09-01T00:00:00Z",
            },
          ],
          1,
        );
      if (table === "maintenance_automation_runs")
        return query([
          {
            id: "automation-1",
            run_key: "2026-09-01",
            status: "completed",
            trigger_kind: "cron",
            local_date: "2026-09-01",
            started_at: "2026-09-01T00:00:00Z",
            finished_at: "2026-09-01T00:00:01Z",
            duration_ms: 1000,
            counters: { generated: 1 },
            error_message: null,
          },
        ]);
      return query(null);
    });
    const repository = createMaintenanceManagementRepository();
    const filters = {
      from: "2026-08-01",
      to: "2026-08-31",
      category_id: "category-1",
      priority: "critical",
      status: "resolved",
      plan_id: PLAN_ID,
      location_id: "location-1",
      supplier_id: SUPPLIER_ID,
    };

    const analytics = await repository.analytics(HOTEL_ID, filters, true);
    expect(analytics).toMatchObject({
      backlog: 1,
      average_triage_hours: 1,
      average_resolution_hours: 4,
      sla_compliance_rate: 100,
      preventive_compliance_rate: 50,
      recurring_occurrences: 1,
      blocked_room_days: 2,
      supplier_completion_rate: 100,
      financial: {
        approved_cost: 200,
        approved_recovery: 50,
        net_result: -150,
        currency: "BRL",
      },
    });
    expect(await repository.exportRows(HOTEL_ID, filters, true)).toEqual([
      expect.objectContaining({
        code: "MAN-000007",
        approved_cost: 200,
        approved_recovery: 50,
      }),
      expect.objectContaining({ code: "MAN-000008" }),
    ]);
    expect(
      await repository.listNotifications(HOTEL_ID, ACTOR_ID, {
        status: "unread",
        kind: "sla_due",
      }),
    ).toHaveLength(1);
    expect(await repository.notificationSummary(HOTEL_ID, ACTOR_ID)).toBe(1);
    expect(
      await repository.setNotificationStatus(
        HOTEL_ID,
        ACTOR_ID,
        "notification-1",
        "read",
      ),
    ).toBe(true);
    expect(await repository.readAllNotifications(HOTEL_ID, ACTOR_ID)).toBe(2);
    expect(await repository.listAutomationRuns(HOTEL_ID)).toHaveLength(1);
    expect(await repository.runAutomation(HOTEL_ID)).toBe(true);
  });

  it("valida e assina documentos gerenciais privados", async () => {
    const storage = {
      createSignedUploadUrl: vi.fn(async () => ({
        data: { token: "token", signedUrl: "https://upload.example.test" },
        error: null,
      })),
      createSignedUrl: vi.fn(async () => ({
        data: { signedUrl: "https://read.example.test" },
        error: null,
      })),
    };
    mocks.storageFrom.mockReturnValue(storage);
    mocks.from.mockImplementation((table: string) => {
      if (table === "maintenance_management_attachments")
        return query(
          { storage_path: `${HOTEL_ID}/supplier/${SUPPLIER_ID}/document.pdf` },
          0,
        );
      if (table === "maintenance_suppliers") return query({ id: SUPPLIER_ID });
      return query(null);
    });
    const repository = createMaintenanceManagementRepository();

    expect(
      await repository.createDocumentUploadIntent(
        HOTEL_ID,
        "supplier",
        SUPPLIER_ID,
        "Contrato.PDF",
      ),
    ).toMatchObject({
      token: "token",
      signed_url: "https://upload.example.test",
    });
    expect(
      await repository.finalizeDocuments(
        HOTEL_ID,
        ACTOR_ID,
        "supplier",
        SUPPLIER_ID,
        [
          {
            storage_path: `${HOTEL_ID}/supplier/${SUPPLIER_ID}/document.pdf`,
            filename: "document.pdf",
            content_type: "application/pdf",
            size_bytes: 1024,
          },
        ],
      ),
    ).toBe(true);
    expect(
      await repository.finalizeDocuments(
        HOTEL_ID,
        ACTOR_ID,
        "supplier",
        SUPPLIER_ID,
        [],
      ),
    ).toBe(false);
    expect(await repository.accessDocument(HOTEL_ID, "document-1")).toEqual({
      signed_url: "https://read.example.test",
      expires_in: 300,
    });
    expect(
      await repository.removeDocument(
        HOTEL_ID,
        ACTOR_ID,
        "document-1",
        "Duplicado",
      ),
    ).toBe(true);
  });
});
