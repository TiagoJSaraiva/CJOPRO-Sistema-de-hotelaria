import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AdminMaintenanceCostItem,
  AdminMaintenanceFinanceOccurrence,
  AdminMaintenanceRecovery,
} from "@hotel/shared";

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

import { createMaintenanceFinanceRepository } from "../../src/repositories/maintenanceFinanceRepository";

type QueryResult = {
  data: unknown;
  error: Error | null;
  count?: number | null;
};

class FakeQuery implements PromiseLike<QueryResult> {
  constructor(private readonly result: QueryResult) {}
  select(..._args: unknown[]) {
    return this;
  }
  eq(..._args: unknown[]) {
    return this;
  }
  is(..._args: unknown[]) {
    return this;
  }
  order(..._args: unknown[]) {
    return this;
  }
  insert(..._args: unknown[]) {
    return this;
  }
  update(..._args: unknown[]) {
    return this;
  }
  async single() {
    return this.result;
  }
  async maybeSingle() {
    return this.result;
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
const STAY_ID = "50000000-0000-4000-8000-000000000001";
const OCCURRENCE_ID = "97000000-0000-4000-8000-000000000002";
const COST_ID = "99000000-0000-4000-8000-000000000001";
const RECOVERY_ID = "99100000-0000-4000-8000-000000000001";
const ACTOR_ID = "80000000-0000-4000-8000-000000000002";

const baseCostRow = {
  id: COST_ID,
  hotel_id: HOTEL_ID,
  occurrence_id: OCCURRENCE_ID,
  work_order_id: null,
  kind: "material",
  description: "Peça substituída",
  quantity: 1,
  estimated_amount: 120,
  actual_amount: 100,
  currency: "BRL",
  counterparty: "Loja",
  due_date: "2020-01-01",
  reference_code: null,
  approval_status: "approved",
  settlement_status: "open",
  created_by: ACTOR_ID,
  submitted_at: "2026-08-31T00:00:00Z",
  approved_by: "approver",
  approved_at: "2026-08-31T01:00:00Z",
  rejected_by: null,
  rejected_at: null,
  canceled_by: null,
  canceled_at: null,
  decision_reason: null,
  created_at: "2026-08-31T00:00:00Z",
  updated_at: "2026-08-31T01:00:00Z",
  proposer: { name: "Proponente" },
  occurrence: { occurrence_number: 2 },
};

const baseRecoveryRow = {
  id: RECOVERY_ID,
  hotel_id: HOTEL_ID,
  occurrence_id: OCCURRENCE_ID,
  responsible_party: "supplier",
  stay_id: null,
  debtor_name: "Terceiro",
  charge_amount: 50,
  waived_amount: 10,
  currency: "BRL",
  justification: "Recuperação parcial",
  due_date: "2020-01-01",
  approval_status: "submitted",
  settlement_status: "partially_settled",
  folio_entry_id: null,
  created_by: ACTOR_ID,
  submitted_at: "2026-08-31T00:00:00Z",
  approved_by: null,
  approved_at: null,
  rejected_by: null,
  rejected_at: null,
  canceled_by: null,
  canceled_at: null,
  decision_reason: null,
  created_at: "2026-08-31T00:30:00Z",
  updated_at: "2026-08-31T01:00:00Z",
  proposer: { name: "Proponente" },
  occurrence: { occurrence_number: 2 },
};

const settlement = {
  id: "99200000-0000-4000-8000-000000000001",
  cost_item_id: COST_ID,
  recovery_id: null,
  financial_transaction_id: "transaction-1",
  amount: 25,
  created_by: ACTOR_ID,
  created_at: "2026-08-31T02:00:00Z",
  reversal_of_id: null,
};

function query(data: unknown, count?: number) {
  return new FakeQuery({ data, error: null, count });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("maintenance finance repository", () => {
  it("monta fólio auditável e sugere alocação FIFO", async () => {
    const entries = [
      {
        id: "debit-1",
        stay_id: STAY_ID,
        reservation_id: "reservation-1",
        direction: "debit",
        kind: "lodging",
        amount: 100,
        currency: "BRL",
        description: "Hospedagem",
        maintenance_occurrence_id: null,
        financial_transaction_id: null,
        reversed_entry_id: null,
        posted_at: "2026-08-01T00:00:00Z",
      },
      {
        id: "credit-1",
        stay_id: STAY_ID,
        reservation_id: "reservation-1",
        direction: "credit",
        kind: "payment",
        amount: 40,
        currency: "BRL",
        description: "Pagamento",
        maintenance_occurrence_id: null,
        financial_transaction_id: "transaction-1",
        reversed_entry_id: null,
        posted_at: "2026-08-02T00:00:00Z",
      },
      {
        id: "debit-2",
        stay_id: STAY_ID,
        reservation_id: "reservation-1",
        direction: "debit",
        kind: "maintenance_charge",
        amount: 50,
        currency: "BRL",
        description: "Dano",
        maintenance_occurrence_id: OCCURRENCE_ID,
        financial_transaction_id: null,
        reversed_entry_id: null,
        posted_at: "2026-08-03T00:00:00Z",
      },
    ];
    const allocations = [
      {
        id: "allocation-1",
        credit_entry_id: "credit-1",
        debit_entry_id: "debit-1",
        amount: 40,
        created_at: "2026-08-02T00:00:00Z",
      },
    ];
    mocks.from.mockImplementation((table: string) => {
      if (table === "stays")
        return query({ id: STAY_ID, reservation: { hotel_id: HOTEL_ID } });
      if (table === "stay_folio_entries") return query(entries);
      if (table === "stay_folio_allocations") return query(allocations);
      return query(null);
    });
    const repository = createMaintenanceFinanceRepository();

    const folio = await repository.getStayFolio(HOTEL_ID, STAY_ID);
    const preview = await repository.previewStayAllocation(
      HOTEL_ID,
      STAY_ID,
      90,
    );

    expect(folio).toMatchObject({
      total_debits: 150,
      total_credits: 40,
      balance: 110,
      payment_status: "partial",
      pending_maintenance_entry_ids: ["debit-2"],
    });
    expect(preview).toEqual({
      amount: 90,
      allocations: [
        { debit_entry_id: "debit-1", amount: 60 },
        { debit_entry_id: "debit-2", amount: 30 },
      ],
      unallocated_amount: 0,
    });
  });

  it("calcula detalhe, filas e resumo financeiro", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === "maintenance_occurrences")
        return query({ id: OCCURRENCE_ID });
      if (table === "maintenance_cost_items") return query([baseCostRow]);
      if (table === "maintenance_recoveries") return query([baseRecoveryRow]);
      if (table === "maintenance_financial_settlements")
        return query([settlement]);
      if (table === "maintenance_financial_attachments")
        return query([
          {
            id: "attachment-1",
            occurrence_id: OCCURRENCE_ID,
            cost_item_id: COST_ID,
            recovery_id: null,
            original_filename: "nota.pdf",
            content_type: "application/pdf",
            size_bytes: 1024,
            uploaded_by: ACTOR_ID,
            created_at: "2026-08-31T00:00:00Z",
            removed_at: null,
          },
        ]);
      if (table === "hotels") return query({ currency: "brl" });
      return query(null);
    });
    const repository = createMaintenanceFinanceRepository();

    const detail = await repository.getOccurrenceFinance(
      HOTEL_ID,
      OCCURRENCE_ID,
    );
    const approval = await repository.listItems(HOTEL_ID, {
      page: 1,
      pageSize: 25,
      queue: "approval",
      occurrenceId: OCCURRENCE_ID,
    });
    await repository.listItems(HOTEL_ID, {
      page: 1,
      pageSize: 25,
      queue: "payable",
    });
    await repository.listItems(HOTEL_ID, {
      page: 1,
      pageSize: 25,
      queue: "receivable",
    });
    await repository.listItems(HOTEL_ID, {
      page: 1,
      pageSize: 25,
      queue: "overdue",
    });
    await repository.listItems(HOTEL_ID, {
      page: 1,
      pageSize: 25,
      queue: "settled",
    });
    const summary = await repository.getSummary(HOTEL_ID);

    expect(detail).toMatchObject({ estimated_cost: 120, approved_cost: 100 });
    expect(approval.items).toHaveLength(1);
    expect(summary).toMatchObject({
      currency: "BRL",
      awaiting_approval: 1,
      payable: 1,
      receivable: 1,
      overdue: 2,
    });
  });

  it("exercita mutações, liquidações, estorno e documentos privados", async () => {
    mocks.rpc.mockResolvedValue({ data: OCCURRENCE_ID, error: null });
    mocks.storageFrom.mockReturnValue({
      createSignedUploadUrl: vi.fn(async () => ({
        data: { token: "token", signedUrl: "https://upload" },
        error: null,
      })),
      createSignedUrl: vi.fn(async () => ({
        data: { signedUrl: "https://access" },
        error: null,
      })),
      list: vi.fn(async () => ({
        data: [
          {
            name: "document.pdf",
            metadata: { size: 1024, mimetype: "application/pdf" },
          },
        ],
        error: null,
      })),
      remove: vi.fn(async () => ({ data: [], error: null })),
    });
    mocks.from.mockImplementation((table: string) => {
      if (table === "hotels") return query({ currency: "BRL" });
      if (table === "maintenance_cost_items") return query({ id: COST_ID });
      if (table === "maintenance_recoveries") return query({ id: RECOVERY_ID });
      if (table === "maintenance_financial_attachments")
        return query(
          {
            occurrence_id: OCCURRENCE_ID,
            storage_path: `${HOTEL_ID}/${OCCURRENCE_ID}/document.pdf`,
            removed_at: null,
          },
          2,
        );
      return query(null);
    });
    const repository = createMaintenanceFinanceRepository();
    const mutable = repository as unknown as {
      currency: (hotelId: string) => Promise<string>;
      getCost: (
        hotelId: string,
        id: string,
      ) => Promise<AdminMaintenanceCostItem>;
      getRecovery: (
        hotelId: string,
        id: string,
      ) => Promise<AdminMaintenanceRecovery>;
      countAttachments: (
        hotelId: string,
        occurrenceId: string,
      ) => Promise<number>;
      getOccurrenceFinance: (
        hotelId: string,
        occurrenceId: string,
      ) => Promise<AdminMaintenanceFinanceOccurrence>;
    };
    const cost = {
      ...baseCostRow,
      settled_amount: 0,
      outstanding_amount: 100,
      settlements: [],
      attachments: [],
    } as unknown as AdminMaintenanceCostItem;
    const recovery = {
      ...baseRecoveryRow,
      settled_amount: 0,
      outstanding_amount: 50,
      settlements: [],
      attachments: [],
    } as unknown as AdminMaintenanceRecovery;
    const finance = {
      occurrence_id: OCCURRENCE_ID,
      currency: "BRL",
      estimated_cost: 120,
      approved_cost: 100,
      settled_cost: 0,
      approved_recovery: 0,
      received_recovery: 0,
      net_result: 100,
      cost_items: [cost],
      recoveries: [recovery],
    };
    mutable.currency = vi.fn(async () => "BRL");
    mutable.getCost = vi.fn(async () => cost);
    mutable.getRecovery = vi.fn(async () => recovery);
    mutable.getOccurrenceFinance = vi.fn(async () => finance);

    const costInput = {
      kind: "material" as const,
      description: " Peça ",
      quantity: 1,
      actual_amount: 100,
    };
    const recoveryInput = {
      responsible_party: "supplier" as const,
      charge_amount: 50,
      justification: " Terceiro responsável ",
    };
    await repository.createCostItem(
      HOTEL_ID,
      OCCURRENCE_ID,
      ACTOR_ID,
      costInput,
    );
    await repository.updateCostItem(HOTEL_ID, COST_ID, ACTOR_ID, costInput);
    await repository.transitionCostItem(HOTEL_ID, COST_ID, ACTOR_ID, "submit");
    await repository.settleCostItem(HOTEL_ID, COST_ID, ACTOR_ID, {
      amount: 25,
      method: "pix",
    });
    await repository.createRecovery(
      HOTEL_ID,
      OCCURRENCE_ID,
      ACTOR_ID,
      recoveryInput,
    );
    await repository.updateRecovery(
      HOTEL_ID,
      RECOVERY_ID,
      ACTOR_ID,
      recoveryInput,
    );
    await repository.transitionRecovery(
      HOTEL_ID,
      RECOVERY_ID,
      ACTOR_ID,
      "submit",
    );
    await repository.settleRecovery(HOTEL_ID, RECOVERY_ID, ACTOR_ID, {
      amount: 20,
      method: "pix",
    });
    await repository.reverseSettlement(
      HOTEL_ID,
      settlement.id,
      ACTOR_ID,
      "Duplicado",
    );
    expect(await repository.countAttachments(HOTEL_ID, OCCURRENCE_ID)).toBe(2);
    expect(
      await repository.createUploadIntent(
        HOTEL_ID,
        OCCURRENCE_ID,
        "document.PDF",
      ),
    ).toMatchObject({ token: "token", signed_url: "https://upload" });
    expect(
      await repository.createAttachmentAccess(HOTEL_ID, "attachment-1"),
    ).toEqual({
      signed_url: "https://access",
      expires_in: 300,
    });
    mutable.countAttachments = vi.fn(async () => 0);
    expect(
      await repository.finalizeAttachments(
        HOTEL_ID,
        OCCURRENCE_ID,
        ACTOR_ID,
        "cost_item",
        COST_ID,
        [
          {
            storage_path: `${HOTEL_ID}/${OCCURRENCE_ID}/document.pdf`,
            filename: "document.pdf",
            content_type: "application/pdf",
            size_bytes: 1024,
          },
        ],
      ),
    ).toMatchObject({ result: "ok" });
    expect(
      await repository.removeAttachment(
        HOTEL_ID,
        "attachment-1",
        ACTOR_ID,
        "Duplicado",
      ),
    ).toMatchObject({ result: "ok" });
  });
});
