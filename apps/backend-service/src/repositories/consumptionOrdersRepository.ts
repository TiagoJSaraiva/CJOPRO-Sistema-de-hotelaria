import type {
  AdminConsumptionEligibleStay,
  AdminConsumptionOperationalContext,
  AdminConsumptionOrder,
  AdminConsumptionOrderCreateInput,
  AdminConsumptionOrderHistory,
  AdminConsumptionOrderItem,
  Json,
  Tables,
} from "@hotel/shared";
import { createServerClient } from "../common/supabaseServer";

export type ConsumptionOrderPostResult =
  | { result: "ok"; item: AdminConsumptionOrder; created: boolean }
  | { result: string; reasons?: string[] };

export type ConsumptionOperationalContextResult =
  | { result: "ok"; item: AdminConsumptionOperationalContext }
  | { result: string };

export type ConsumptionOrderFilters = {
  cursor?: string;
  limit: number;
  from?: string;
  to?: string;
  search?: string;
  pointId?: string;
  billingMode?: string;
  disposition?: string;
  providerType?: string;
  operatorId?: string;
};

type OrderRow = Tables<"consumption_orders"> & {
  operator?: { name: string } | null;
};
type ItemRow = Tables<"consumption_order_items"> & {
  effective_quantity?: number | null;
  effective_discount?: number | null;
  effective_net_amount?: number | null;
};
type EffectiveOrderRow = {
  id: string;
  effective_gross_amount: number | null;
  effective_discount_amount: number | null;
  effective_net_amount: number | null;
  effective_status: string | null;
};
type EventRow = Tables<"consumption_order_events"> & {
  actor?: { name: string } | null;
};

function money(value: unknown) {
  return Number(Number(value || 0).toFixed(2));
}

function asObject(value: Json | null): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function mapItem(
  row: ItemRow,
  includeTerms: boolean,
): AdminConsumptionOrderItem {
  return {
    id: row.id,
    offer_id: row.offer_id,
    product_id: row.product_id,
    quantity: Number(row.quantity),
    charged_unit_price: money(row.charged_unit_price),
    gross_amount: money(row.item_total_amount),
    discount_amount: money(row.discount_amount),
    net_amount: money(row.net_amount),
    effective_quantity: Number(row.effective_quantity ?? row.quantity),
    effective_discount: money(row.effective_discount ?? row.discount_amount),
    effective_net_amount: money(row.effective_net_amount ?? row.net_amount),
    product_name: row.product_name_snapshot,
    product_code: row.product_internal_code_snapshot,
    category_name: row.category_name_snapshot,
    product_kind: row.product_kind_snapshot,
    sales_unit: row.sales_unit_snapshot,
    provider_type: row.provider_type_snapshot,
    partner_id: row.commercial_partner_id,
    partner_name: row.partner_name_snapshot,
    agreement_id: row.commercial_agreement_id,
    agreement_number: row.agreement_number_snapshot,
    commercial_revision_id: row.commercial_revision_id,
    commercial_revision_version: row.commercial_revision_version_snapshot,
    ...(includeTerms
      ? { commercial_terms: asObject(row.commercial_terms_snapshot) }
      : {}),
    billing_policy: asObject(row.billing_policy_snapshot) || {},
    version_token: row.version_token,
    notes: row.notes,
    inventory_controlled: row.inventory_controlled_snapshot,
    inventory_location_id: row.inventory_location_id_snapshot,
    inventory_location_name: row.inventory_location_name_snapshot,
    inventory_position_version: row.inventory_position_version_snapshot,
  };
}

function mapOrder(
  row: OrderRow,
  items: ItemRow[],
  events: EventRow[] = [],
  includeTerms = false,
  folioEntryIds: string[] = [],
  transactionIds: string[] = [],
  effective?: EffectiveOrderRow | null,
  accountVersion?: number,
): AdminConsumptionOrder {
  return {
    id: row.id,
    hotel_id: row.hotel_id,
    stay_id: row.stay_id,
    reservation_id: row.reservation_id,
    point_id: row.point_id,
    guest_customer_id: row.guest_customer_id,
    disposition: row.disposition,
    billing_mode: row.billing_mode,
    payment_method: row.payment_method,
    payment_reference: row.payment_reference,
    partner_receipt_confirmed: row.partner_receipt_confirmed,
    currency: row.currency,
    gross_amount: money(row.gross_amount),
    discount_amount: money(row.discount_amount),
    net_amount: money(row.net_amount),
    effective_gross_amount: money(
      effective?.effective_gross_amount ?? row.gross_amount,
    ),
    effective_discount_amount: money(
      effective?.effective_discount_amount ?? row.discount_amount,
    ),
    effective_net_amount: money(
      effective?.effective_net_amount ?? row.net_amount,
    ),
    effective_status: (effective?.effective_status ||
      (row.is_legacy ? "legacy" : "active")) as NonNullable<
      AdminConsumptionOrder["effective_status"]
    >,
    reservation_code: row.reservation_code_snapshot,
    room_number: row.room_number_snapshot,
    guest_name: row.guest_name_snapshot,
    point_name: row.point_name_snapshot,
    notes: row.notes,
    courtesy_reason: row.courtesy_reason,
    occurred_at: row.occurred_at,
    posted_at: row.posted_at,
    posted_by: row.posted_by,
    operator_name: row.operator?.name || null,
    is_legacy: row.is_legacy,
    ...(accountVersion == null ? {} : { account_version: accountVersion }),
    items: items.map((item) => mapItem(item, includeTerms)),
    events: events.map((event) => ({
      id: event.id,
      action: event.action,
      actor_id: event.actor_id,
      actor_name: event.actor?.name || null,
      details: asObject(event.details) || {},
      created_at: event.created_at,
    })),
    folio_entry_ids: folioEntryIds,
    financial_transaction_ids: transactionIds,
  };
}

export interface ConsumptionOrdersRepository {
  listEligibleStays(
    hotelId: string,
    search: string,
  ): Promise<AdminConsumptionEligibleStay[]>;
  getContext(
    hotelId: string,
    stayId: string,
    occurredAt: string,
  ): Promise<ConsumptionOperationalContextResult>;
  post(
    hotelId: string,
    actorId: string,
    input: AdminConsumptionOrderCreateInput,
    includeTerms: boolean,
  ): Promise<ConsumptionOrderPostResult>;
  list(
    hotelId: string,
    filters: ConsumptionOrderFilters,
  ): Promise<AdminConsumptionOrderHistory>;
  get(
    hotelId: string,
    id: string,
    includeTerms: boolean,
  ): Promise<AdminConsumptionOrder | null>;
}

class SupabaseConsumptionOrdersRepository implements ConsumptionOrdersRepository {
  async listEligibleStays(hotelId: string, search: string) {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("reservations")
      .select(
        "id,reservation_code,booking_customer:customers(full_name),stays!inner(id,stay_status,checkin_date_actual,room:rooms(room_number,room_type))",
      )
      .eq("hotel_id", hotelId)
      .eq("stays.stay_status", "checked_in")
      .order("reservation_code")
      .limit(100);
    if (error) throw error;
    const needle = search.trim().toLocaleLowerCase("pt-BR");
    return (data || [])
      .flatMap((reservation) =>
        (reservation.stays || []).map((stay) => ({
          id: stay.id,
          reservation_id: reservation.id,
          reservation_code: reservation.reservation_code,
          room_number: stay.room?.room_number || "—",
          room_type: stay.room?.room_type || "—",
          primary_guest_name:
            reservation.booking_customer?.full_name || "Hóspede",
          checkin_date_actual: stay.checkin_date_actual || "",
        })),
      )
      .filter((stay) =>
        needle
          ? [stay.reservation_code, stay.room_number, stay.primary_guest_name]
              .join(" ")
              .toLocaleLowerCase("pt-BR")
              .includes(needle)
          : true,
      )
      .sort((left, right) => left.room_number.localeCompare(right.room_number))
      .slice(0, 20);
  }

  async getContext(hotelId: string, stayId: string, occurredAt: string) {
    const { data, error } = await createServerClient().rpc(
      "get_consumption_operational_context",
      { p_hotel_id: hotelId, p_stay_id: stayId, p_occurred_at: occurredAt },
    );
    if (error) throw error;
    const payload = asObject(data);
    if (!payload || payload.result !== "ok")
      return { result: String(payload?.result || "not_found") };
    return {
      result: "ok",
      item: payload as unknown as AdminConsumptionOperationalContext,
    };
  }

  async post(
    hotelId: string,
    actorId: string,
    input: AdminConsumptionOrderCreateInput,
    includeTerms: boolean,
  ) {
    const { data, error } = await createServerClient().rpc(
      "post_consumption_order",
      {
        p_hotel_id: hotelId,
        p_stay_id: input.stay_id,
        p_point_id: input.point_id,
        p_actor_id: actorId,
        p_occurred_at: input.occurred_at,
        p_disposition: input.disposition,
        p_billing_mode: input.billing_mode as "hotel_immediate",
        p_items: input.lines as unknown as Json,
        p_idempotency_key: input.idempotency_key,
        p_guest_customer_id: input.guest_customer_id || undefined,
        p_payment_method: input.payment_method || undefined,
        p_payment_reference: input.payment_reference || undefined,
        p_partner_receipt_confirmed: input.partner_receipt_confirmed || false,
        p_notes: input.notes || undefined,
        p_courtesy_reason: input.courtesy_reason || undefined,
      },
    );
    if (error) {
      const inventoryResult = [
        "inventory_source_missing",
        "inventory_position_inactive",
        "inventory_version_conflict",
        "insufficient_inventory",
      ].find((reason) => error.message.includes(reason));
      if (inventoryResult) return { result: inventoryResult };
      throw error;
    }
    const result = asObject(data) || { result: "internal_error" };
    if (result.result !== "ok") {
      return {
        result: String(result.result),
        reasons: Array.isArray(result.reasons)
          ? result.reasons.map(String)
          : undefined,
      };
    }
    const item = await this.get(hotelId, String(result.order_id), includeTerms);
    if (!item) return { result: "not_found" };
    return { result: "ok", item, created: result.created === true };
  }

  async list(hotelId: string, filters: ConsumptionOrderFilters) {
    const supabase = createServerClient();
    let query = supabase
      .from("consumption_orders")
      .select("*,operator:posted_by(name)")
      .eq("hotel_id", hotelId)
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(filters.limit + 1);
    if (filters.cursor) query = query.lt("occurred_at", filters.cursor);
    if (filters.from) query = query.gte("occurred_at", filters.from);
    if (filters.to) query = query.lte("occurred_at", filters.to);
    if (filters.pointId) query = query.eq("point_id", filters.pointId);
    if (filters.billingMode)
      query = query.eq(
        "billing_mode",
        filters.billingMode as NonNullable<
          Tables<"consumption_orders">["billing_mode"]
        >,
      );
    if (filters.disposition)
      query = query.eq(
        "disposition",
        filters.disposition as Tables<"consumption_orders">["disposition"],
      );
    if (filters.operatorId) query = query.eq("posted_by", filters.operatorId);
    if (filters.search) {
      const safe = filters.search.replace(/[%_,()]/g, " ").trim();
      if (safe)
        query = query.or(
          `reservation_code_snapshot.ilike.%${safe}%,room_number_snapshot.ilike.%${safe}%,guest_name_snapshot.ilike.%${safe}%`,
        );
    }
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data || []) as OrderRow[];
    const page = rows.slice(0, filters.limit);
    const ids = page.map((row) => row.id);
    const [itemResult, effectiveResult] = ids.length
      ? await Promise.all([
          supabase
            .from("consumption_order_item_effective")
            .select("*")
            .eq("hotel_id", hotelId)
            .in("order_id", ids),
          supabase
            .from("consumption_order_effective")
            .select(
              "id,effective_gross_amount,effective_discount_amount,effective_net_amount,effective_status",
            )
            .eq("hotel_id", hotelId)
            .in("id", ids),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];
    if (itemResult.error) throw itemResult.error;
    if (effectiveResult.error) throw effectiveResult.error;
    const itemData = itemResult.data;
    const allItems = (itemData || []) as ItemRow[];
    const effectiveRows = (effectiveResult.data || []) as EffectiveOrderRow[];
    const filtered = filters.providerType
      ? page.filter((order) =>
          allItems.some(
            (item) =>
              item.order_id === order.id &&
              item.provider_type_snapshot === filters.providerType,
          ),
        )
      : page;
    return {
      items: filtered.map((row) =>
        mapOrder(
          row,
          allItems.filter((item) => item.order_id === row.id),
          [],
          false,
          [],
          [],
          effectiveRows.find((effective) => effective.id === row.id),
        ),
      ),
      next_cursor:
        rows.length > filters.limit
          ? page[page.length - 1]?.occurred_at || null
          : null,
    };
  }

  async get(hotelId: string, id: string, includeTerms: boolean) {
    const supabase = createServerClient();
    const [
      orderResult,
      itemResult,
      eventResult,
      folioResult,
      transactionResult,
      effectiveResult,
    ] = await Promise.all([
      supabase
        .from("consumption_orders")
        .select("*,operator:posted_by(name)")
        .eq("hotel_id", hotelId)
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("consumption_order_item_effective")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("order_id", id)
        .order("created_at"),
      supabase
        .from("consumption_order_events")
        .select("*,actor:actor_id(name)")
        .eq("hotel_id", hotelId)
        .eq("order_id", id)
        .order("created_at"),
      supabase
        .from("stay_folio_entries")
        .select("id")
        .eq("hotel_id", hotelId)
        .eq("consumption_order_id", id),
      supabase
        .from("financial_transactions")
        .select("id")
        .eq("hotel_id", hotelId)
        .eq("consumption_order_id", id),
      supabase
        .from("consumption_order_effective")
        .select(
          "id,effective_gross_amount,effective_discount_amount,effective_net_amount,effective_status",
        )
        .eq("hotel_id", hotelId)
        .eq("id", id)
        .maybeSingle(),
    ]);
    if (orderResult.error) throw orderResult.error;
    if (!orderResult.data) return null;
    for (const result of [
      itemResult,
      eventResult,
      folioResult,
      transactionResult,
      effectiveResult,
    ])
      if (result.error) throw result.error;
    const { data: stayData, error: stayError } = orderResult.data.stay_id
      ? await supabase
          .from("stays")
          .select("account_version")
          .eq("id", orderResult.data.stay_id)
          .maybeSingle()
      : { data: null, error: null };
    if (stayError) throw stayError;
    return mapOrder(
      orderResult.data as OrderRow,
      (itemResult.data || []) as ItemRow[],
      (eventResult.data || []) as EventRow[],
      includeTerms,
      (folioResult.data || []).map((entry) => entry.id),
      (transactionResult.data || []).map((entry) => entry.id),
      effectiveResult.data as EffectiveOrderRow | null,
      stayData == null ? undefined : Number(stayData.account_version),
    );
  }
}

export function createConsumptionOrdersRepository(): ConsumptionOrdersRepository {
  return new SupabaseConsumptionOrdersRepository();
}
