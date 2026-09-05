import type {
  AdminCommercialPartnerSummary,
  AdminConsumptionAnalytics,
  AdminConsumptionManagementSettings,
  AdminConsumptionManagementSettingsInput,
  AdminManagementAlerts,
  AdminPartnerSettlement,
  AdminPartnerSettlementCandidate,
  AdminPartnerSettlementComponent,
  AdminPartnerSettlementDecisionInput,
  AdminPartnerSettlementPaymentInput,
  AdminPartnerSettlementPaymentReversalInput,
  AdminPartnerSettlementSource,
  ConsumptionAnalyticsDimension,
  ConsumptionBillingMode,
  ConsumptionOrderDisposition,
  ConsumptionPaymentMethod,
  Json,
  PartnerSettlementStatus,
  ProductProviderType,
  Tables,
} from "@hotel/shared";
import { createServerClient } from "../common/supabaseServer";

type RpcResult = {
  result: string;
  id?: string;
  created?: boolean;
  version?: number;
};
type SettlementRow = Tables<"partner_settlements"> & {
  partner:
    AdminCommercialPartnerSummary | AdminCommercialPartnerSummary[] | null;
};
type EventRow = Tables<"partner_settlement_events"> & {
  actor: { name: string } | { name: string }[] | null;
};

export type ConsumptionAnalyticsFilters = {
  from: string;
  to: string;
  dimension: ConsumptionAnalyticsDimension;
  pointId?: string;
  categoryId?: string;
  productId?: string;
  staySearch?: string;
  disposition?: ConsumptionOrderDisposition;
  billingMode?: ConsumptionBillingMode;
  paymentMethod?: ConsumptionPaymentMethod;
  providerType?: ProductProviderType;
  partnerId?: string;
  operatorId?: string;
  cursor?: string;
  limit: number;
};

export type SettlementListFilters = {
  partnerId?: string;
  status?: PartnerSettlementStatus;
  periodStart?: string;
  cursor?: string;
  limit: number;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function number(value: unknown): number {
  return Number(value || 0);
}
function rpc(value: Json | null): RpcResult {
  const data = record(value);
  return {
    result: String(data.result || "internal_error"),
    ...(typeof data.id === "string" ? { id: data.id } : {}),
    ...(typeof data.created === "boolean" ? { created: data.created } : {}),
    ...(typeof data.version === "number" ? { version: data.version } : {}),
  };
}
function mapPartner(
  value: SettlementRow["partner"],
): AdminCommercialPartnerSummary {
  const partner = Array.isArray(value) ? value[0] : value;
  if (!partner) throw new Error("Apuração sem parceiro associado.");
  return partner;
}
function mapComponent(
  row: Tables<"partner_settlement_components">,
): AdminPartnerSettlementComponent {
  return {
    ...row,
    fixed_rent: row.fixed_rent == null ? null : number(row.fixed_rent),
    commission_percentage:
      row.commission_percentage == null
        ? null
        : number(row.commission_percentage),
    minimum_guarantee:
      row.minimum_guarantee == null ? null : number(row.minimum_guarantee),
    gross_sales: number(row.gross_sales),
    discount_total: number(row.discount_total),
    courtesy_total: number(row.courtesy_total),
    reversal_total: number(row.reversal_total),
    operational_net: number(row.operational_net),
    hotel_collected: number(row.hotel_collected),
    partner_direct: number(row.partner_direct),
    prorated_rent: number(row.prorated_rent),
    commission_amount: number(row.commission_amount),
    prorated_minimum_guarantee: number(row.prorated_minimum_guarantee),
    minimum_guarantee_topup: number(row.minimum_guarantee_topup),
    contribution_amount: number(row.contribution_amount),
    net_settlement_amount: number(row.net_settlement_amount),
    calculation_memory: record(row.calculation_memory),
  };
}
function mapSource(
  row: Tables<"partner_settlement_sources">,
): AdminPartnerSettlementSource {
  return {
    ...row,
    gross_amount: number(row.gross_amount),
    discount_amount: number(row.discount_amount),
    reversal_amount: number(row.reversal_amount),
    operational_net: number(row.operational_net),
    hotel_collected: number(row.hotel_collected),
    partner_direct: number(row.partner_direct),
    source_snapshot: record(row.source_snapshot),
  };
}
function mapSettlement(
  row: SettlementRow,
  details?: {
    components?: Tables<"partner_settlement_components">[];
    sources?: Tables<"partner_settlement_sources">[];
    payments?: Tables<"partner_settlement_payments">[];
    events?: EventRow[];
  },
): AdminPartnerSettlement {
  return {
    id: row.id,
    hotel_id: row.hotel_id,
    partner: mapPartner(row.partner),
    period_start: row.period_start,
    period_end: row.period_end,
    currency: row.currency,
    status: row.status,
    direction: row.direction,
    version: number(row.version),
    gross_sales: number(row.gross_sales),
    discount_total: number(row.discount_total),
    courtesy_total: number(row.courtesy_total),
    reversal_total: number(row.reversal_total),
    operational_net: number(row.operational_net),
    hotel_collected: number(row.hotel_collected),
    partner_direct: number(row.partner_direct),
    rent_total: number(row.rent_total),
    commission_total: number(row.commission_total),
    minimum_guarantee_topup: number(row.minimum_guarantee_topup),
    contribution_total: number(row.contribution_total),
    net_settlement: number(row.net_settlement),
    due_on: row.due_on,
    prepared_by: row.prepared_by,
    prepared_at: row.prepared_at,
    submitted_by: row.submitted_by,
    submitted_at: row.submitted_at,
    approved_by: row.approved_by,
    approved_at: row.approved_at,
    settled_by: row.settled_by,
    settled_at: row.settled_at,
    statement_snapshot:
      row.statement_snapshot == null ? null : record(row.statement_snapshot),
    components: (details?.components || []).map(mapComponent),
    sources: (details?.sources || []).map(mapSource),
    payments: (details?.payments || []).map((payment) => ({
      id: payment.id,
      financial_transaction_id: payment.financial_transaction_id,
      amount: number(payment.amount),
      direction: payment.direction,
      payment_method: payment.payment_method,
      paid_at: payment.paid_at,
      reference_code: payment.reference_code,
      notes: payment.notes,
      created_by: payment.created_by,
      created_at: payment.created_at,
      reversal_of_id: payment.reversal_of_id,
    })),
    events: (details?.events || []).map((event) => {
      const actor = Array.isArray(event.actor) ? event.actor[0] : event.actor;
      return {
        id: event.id,
        action: event.action,
        actor_id: event.actor_id,
        actor_name: actor?.name || null,
        details: record(event.details),
        created_at: event.created_at,
      };
    }),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export interface ConsumptionManagementRepository {
  getSettings(
    hotelId: string,
  ): Promise<AdminConsumptionManagementSettings | null>;
  updateSettings(
    hotelId: string,
    actorId: string,
    input: AdminConsumptionManagementSettingsInput,
  ): Promise<AdminConsumptionManagementSettings | null>;
  getAnalytics(
    hotelId: string,
    filters: ConsumptionAnalyticsFilters,
  ): Promise<{ result: string; item?: AdminConsumptionAnalytics }>;
  getAlerts(
    hotelId: string,
  ): Promise<{ result: string; item?: AdminManagementAlerts }>;
  listCandidates(
    hotelId: string,
    periodStart: string,
    partnerId?: string,
  ): Promise<AdminPartnerSettlementCandidate[]>;
  listSettlements(
    hotelId: string,
    filters: SettlementListFilters,
  ): Promise<{ items: AdminPartnerSettlement[]; nextCursor: string | null }>;
  getSettlement(
    id: string,
    hotelId: string,
  ): Promise<AdminPartnerSettlement | null>;
  refreshSettlement(
    hotelId: string,
    partnerId: string,
    periodStart: string,
    actorId: string,
    expectedVersion?: number,
  ): Promise<RpcResult>;
  submitSettlement(
    hotelId: string,
    id: string,
    actorId: string,
    expectedVersion: number,
  ): Promise<RpcResult>;
  decideSettlement(
    hotelId: string,
    id: string,
    actorId: string,
    input: AdminPartnerSettlementDecisionInput,
  ): Promise<RpcResult>;
  paySettlement(
    hotelId: string,
    id: string,
    actorId: string,
    input: AdminPartnerSettlementPaymentInput,
  ): Promise<RpcResult>;
  reversePayment(
    hotelId: string,
    id: string,
    actorId: string,
    input: AdminPartnerSettlementPaymentReversalInput,
  ): Promise<RpcResult & { settlementId?: string }>;
}

export class SupabaseConsumptionManagementRepository implements ConsumptionManagementRepository {
  private get client() {
    // Keep client creation lazy so the application can be assembled in unit and
    // contract tests that replace handlers without requiring Supabase secrets.
    return createServerClient();
  }

  async getSettings(hotelId: string) {
    const { data, error } = await this.client
      .from("consumption_management_settings")
      .select("*")
      .eq("hotel_id", hotelId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async updateSettings(
    hotelId: string,
    actorId: string,
    input: AdminConsumptionManagementSettingsInput,
  ) {
    const { data, error } = await this.client
      .from("consumption_management_settings")
      .update({ ...input, last_changed_by: actorId })
      .eq("hotel_id", hotelId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async getAnalytics(hotelId: string, filters: ConsumptionAnalyticsFilters) {
    const { data, error } = await this.client.rpc("get_consumption_analytics", {
      p_hotel_id: hotelId,
      p_from: filters.from,
      p_to: filters.to,
      p_dimension: filters.dimension,
      ...(filters.pointId ? { p_point_id: filters.pointId } : {}),
      ...(filters.categoryId ? { p_category_id: filters.categoryId } : {}),
      ...(filters.productId ? { p_product_id: filters.productId } : {}),
      ...(filters.staySearch ? { p_stay_search: filters.staySearch } : {}),
      ...(filters.disposition ? { p_disposition: filters.disposition } : {}),
      ...(filters.billingMode ? { p_billing_mode: filters.billingMode } : {}),
      ...(filters.paymentMethod
        ? { p_payment_method: filters.paymentMethod }
        : {}),
      ...(filters.providerType
        ? { p_provider_type: filters.providerType }
        : {}),
      ...(filters.partnerId ? { p_partner_id: filters.partnerId } : {}),
      ...(filters.operatorId ? { p_operator_id: filters.operatorId } : {}),
      p_offset: Number(filters.cursor || 0),
      p_limit: filters.limit,
    });
    if (error) throw error;
    const value = record(data);
    if (value.result !== "ok") return { result: String(value.result) };
    const summary = record(value.summary);
    const rows = Array.isArray(value.rows) ? value.rows : [];
    const series = Array.isArray(value.series) ? value.series : [];
    return {
      result: "ok",
      item: {
        summary: {
          gross_sales: number(summary.gross_sales),
          discount_total: number(summary.discount_total),
          courtesy_total: number(summary.courtesy_total),
          reversal_total: number(summary.reversal_total),
          operational_net: number(summary.operational_net),
          hotel_collected: number(summary.hotel_collected),
          partner_direct: number(summary.partner_direct),
          order_count: number(summary.order_count),
          legacy_count: number(summary.legacy_count),
        },
        series: series.map((item) => {
          const row = record(item as Json);
          return {
            date: String(row.date),
            gross_sales: number(row.gross_sales),
            operational_net: number(row.operational_net),
            order_count: number(row.order_count),
          };
        }),
        rows: rows.map((item) => {
          const row = record(item as Json);
          return {
            key: String(row.key),
            label: String(row.label),
            gross_sales: number(row.gross_sales),
            operational_net: number(row.operational_net),
            order_count: number(row.order_count),
          };
        }),
        total: number(value.total),
        next_cursor:
          typeof value.next_cursor === "string" ? value.next_cursor : null,
      },
    };
  }

  async getAlerts(hotelId: string) {
    const { data, error } = await this.client.rpc("get_management_alerts", {
      p_hotel_id: hotelId,
    });
    if (error) throw error;
    const value = record(data);
    if (value.result !== "ok") return { result: String(value.result) };
    const alerts = (key: string) =>
      (Array.isArray(value[key]) ? value[key] : []).map((item) => {
        const alert = record(item as Json);
        return {
          id: String(alert.id),
          kind: String(alert.kind),
          severity: String(alert.severity),
          title: String(alert.title),
          description: String(alert.description),
          href: String(alert.href),
          entity_id: String(alert.entity_id),
          ...(typeof alert.due_on === "string" ? { due_on: alert.due_on } : {}),
          ...(alert.amount != null ? { amount: number(alert.amount) } : {}),
          ...(alert.quantity != null
            ? { quantity: number(alert.quantity) }
            : {}),
          ...(typeof alert.guest_name === "string"
            ? { guest_name: alert.guest_name }
            : {}),
        };
      });
    return {
      result: "ok",
      item: {
        guest_balances: alerts("guest_balances"),
        critical_stock: alerts("critical_stock"),
        expiring_agreements: alerts("expiring_agreements"),
        pending_settlements: alerts("pending_settlements"),
      } as AdminManagementAlerts,
    };
  }

  async listCandidates(
    hotelId: string,
    periodStart: string,
    partnerId?: string,
  ) {
    const periodEnd = new Date(`${periodStart}T12:00:00.000Z`);
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1, 0);
    const end = periodEnd.toISOString().slice(0, 10);
    const revisionQuery = this.client
      .from("commercial_agreement_revisions")
      .select("agreement_id")
      .eq("hotel_id", hotelId)
      .in("status", ["activated", "terminated"])
      .lte("starts_on", end)
      .or(`ends_on.is.null,ends_on.gte.${periodStart}`);
    const revisions = await revisionQuery;
    if (revisions.error) throw revisions.error;
    const agreementIds = Array.from(
      new Set((revisions.data || []).map((item) => item.agreement_id)),
    );
    if (!agreementIds.length) return [];
    let agreementQuery = this.client
      .from("commercial_agreements")
      .select("partner_id")
      .eq("hotel_id", hotelId)
      .in("id", agreementIds);
    if (partnerId) agreementQuery = agreementQuery.eq("partner_id", partnerId);
    const agreements = await agreementQuery;
    if (agreements.error) throw agreements.error;
    const partnerIds = Array.from(
      new Set((agreements.data || []).map((item) => item.partner_id)),
    );
    if (!partnerIds.length) return [];
    const [partners, settlements] = await Promise.all([
      this.client
        .from("commercial_partners")
        .select("id,trade_name,is_active,archived_at")
        .eq("hotel_id", hotelId)
        .in("id", partnerIds),
      this.client
        .from("partner_settlements")
        .select("id,partner_id,status")
        .eq("hotel_id", hotelId)
        .eq("period_start", periodStart)
        .in("partner_id", partnerIds),
    ]);
    if (partners.error) throw partners.error;
    if (settlements.error) throw settlements.error;
    const byPartner = new Map(
      (settlements.data || []).map((item) => [item.partner_id, item]),
    );
    return (partners.data || []).map<AdminPartnerSettlementCandidate>(
      (partner) => {
        const settlement = byPartner.get(partner.id);
        return {
          partner,
          period_start: periodStart,
          period_end: end,
          settlement_id: settlement?.id || null,
          status: settlement?.status || "missing",
        };
      },
    );
  }

  async listSettlements(hotelId: string, filters: SettlementListFilters) {
    let query = this.client
      .from("partner_settlements")
      .select(
        "*,partner:commercial_partners(id,trade_name,is_active,archived_at)",
      )
      .eq("hotel_id", hotelId)
      .order("period_start", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(filters.limit + 1);
    if (filters.partnerId) query = query.eq("partner_id", filters.partnerId);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.periodStart)
      query = query.eq("period_start", filters.periodStart);
    if (filters.cursor) query = query.lt("created_at", filters.cursor);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data || []) as SettlementRow[];
    const hasMore = rows.length > filters.limit;
    const visible = rows.slice(0, filters.limit);
    return {
      items: visible.map((item) => mapSettlement(item)),
      nextCursor: hasMore ? visible.at(-1)?.created_at || null : null,
    };
  }

  async getSettlement(id: string, hotelId: string) {
    const [settlement, components, sources, payments, events] =
      await Promise.all([
        this.client
          .from("partner_settlements")
          .select(
            "*,partner:commercial_partners(id,trade_name,is_active,archived_at)",
          )
          .eq("id", id)
          .eq("hotel_id", hotelId)
          .maybeSingle(),
        this.client
          .from("partner_settlement_components")
          .select("*")
          .eq("settlement_id", id)
          .eq("hotel_id", hotelId)
          .order("segment_start"),
        this.client
          .from("partner_settlement_sources")
          .select("*")
          .eq("settlement_id", id)
          .eq("hotel_id", hotelId)
          .order("occurred_at"),
        this.client
          .from("partner_settlement_payments")
          .select("*")
          .eq("settlement_id", id)
          .eq("hotel_id", hotelId)
          .order("created_at"),
        this.client
          .from("partner_settlement_events")
          .select("*,actor:users(name)")
          .eq("settlement_id", id)
          .eq("hotel_id", hotelId)
          .order("created_at", { ascending: false }),
      ]);
    for (const result of [settlement, components, sources, payments, events])
      if (result.error) throw result.error;
    if (!settlement.data) return null;
    return mapSettlement(settlement.data as SettlementRow, {
      components: components.data || [],
      sources: sources.data || [],
      payments: payments.data || [],
      events: (events.data || []) as EventRow[],
    });
  }

  async refreshSettlement(
    hotelId: string,
    partnerId: string,
    periodStart: string,
    actorId: string,
    expectedVersion?: number,
  ) {
    const { data, error } = await this.client.rpc(
      "refresh_partner_settlement",
      {
        p_hotel_id: hotelId,
        p_partner_id: partnerId,
        p_period_start: periodStart,
        p_actor_id: actorId,
        ...(expectedVersion == null
          ? {}
          : { p_expected_version: expectedVersion }),
      },
    );
    if (error) throw error;
    return rpc(data);
  }

  async submitSettlement(
    hotelId: string,
    id: string,
    actorId: string,
    expectedVersion: number,
  ) {
    const { data, error } = await this.client.rpc("submit_partner_settlement", {
      p_hotel_id: hotelId,
      p_settlement_id: id,
      p_actor_id: actorId,
      p_expected_version: expectedVersion,
    });
    if (error) throw error;
    return rpc(data);
  }

  async decideSettlement(
    hotelId: string,
    id: string,
    actorId: string,
    input: AdminPartnerSettlementDecisionInput,
  ) {
    const { data, error } = await this.client.rpc("decide_partner_settlement", {
      p_hotel_id: hotelId,
      p_settlement_id: id,
      p_actor_id: actorId,
      p_expected_version: input.expected_version,
      p_decision: input.decision,
      ...(input.reason ? { p_reason: input.reason } : {}),
    });
    if (error) throw error;
    return rpc(data);
  }

  async paySettlement(
    hotelId: string,
    id: string,
    actorId: string,
    input: AdminPartnerSettlementPaymentInput,
  ) {
    const { data, error } = await this.client.rpc("pay_partner_settlement", {
      p_hotel_id: hotelId,
      p_settlement_id: id,
      p_actor_id: actorId,
      p_expected_version: input.expected_version,
      p_amount: input.amount,
      p_payment_method: input.payment_method,
      p_paid_at: input.paid_at,
      p_reference_code: input.reference_code || "",
      p_notes: input.notes || "",
      p_idempotency_key: input.idempotency_key,
    });
    if (error) throw error;
    return rpc(data);
  }

  async reversePayment(
    hotelId: string,
    id: string,
    actorId: string,
    input: AdminPartnerSettlementPaymentReversalInput,
  ) {
    const { data, error } = await this.client.rpc(
      "reverse_partner_settlement_payment",
      {
        p_hotel_id: hotelId,
        p_payment_id: id,
        p_actor_id: actorId,
        p_reason: input.reason,
        p_reversed_at: input.reversed_at,
        p_idempotency_key: input.idempotency_key,
      },
    );
    if (error) throw error;
    const result = rpc(data);
    const payment = await this.client
      .from("partner_settlement_payments")
      .select("settlement_id")
      .eq("id", result.id || id)
      .eq("hotel_id", hotelId)
      .maybeSingle();
    if (payment.error) throw payment.error;
    return { ...result, settlementId: payment.data?.settlement_id };
  }
}

export function createConsumptionManagementRepository(): ConsumptionManagementRepository {
  return new SupabaseConsumptionManagementRepository();
}
