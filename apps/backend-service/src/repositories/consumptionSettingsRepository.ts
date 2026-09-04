import type {
  AdminConsumptionConfigurationAuditEvent,
  AdminConsumptionOffer,
  AdminConsumptionOfferBatchInput,
  AdminConsumptionOfferUpdateInput,
  AdminConsumptionPoint,
  AdminConsumptionPointInput,
  AdminProduct,
  ConsumptionBillingMode,
  ConsumptionUnavailableReason,
  TablesInsert,
  TablesUpdate,
} from "@hotel/shared";
import { applyHotelContextFilter } from "../common/hotelContextFilter";
import { createServerClient } from "../common/supabaseServer";
import {
  isSupabaseConflictError,
  isSupabaseNotFoundError,
} from "./supabaseError";

const POINT_FIELDS =
  "id,hotel_id,name,internal_code,description,display_order,is_active,default_allowed_billing_modes,default_billing_mode,archived_at,created_at,updated_at";
const CATEGORY_FIELDS =
  "id,hotel_id,name,display_order,is_active,archived_at,created_at,updated_at";
const PRODUCT_FIELDS = `id,hotel_id,name,description,internal_code,kind,sales_unit,unit_price,status,archived_at,created_at,updated_at,category:product_categories(${CATEGORY_FIELDS})`;
const OFFER_FIELDS = `id,hotel_id,point_id,product_id,display_order,is_active,policy_source,allowed_billing_modes,default_billing_mode,archived_at,created_at,updated_at,point:consumption_points(${POINT_FIELDS}),product:products(${PRODUCT_FIELDS})`;

export type ConsumptionSettingsWriteResult = "ok" | "conflict" | "not-found";

type PointRow = {
  id: string;
  hotel_id: string;
  name: string;
  internal_code: string | null;
  description: string | null;
  display_order: number;
  is_active: boolean;
  default_allowed_billing_modes: ConsumptionBillingMode[];
  default_billing_mode: ConsumptionBillingMode;
  archived_at: string | null;
  created_at?: string;
  updated_at?: string;
};
type OfferRow = {
  id: string;
  hotel_id: string;
  point_id: string;
  product_id: string;
  display_order: number;
  is_active: boolean;
  policy_source: "inherit" | "override";
  allowed_billing_modes: ConsumptionBillingMode[] | null;
  default_billing_mode: ConsumptionBillingMode | null;
  archived_at: string | null;
  created_at?: string;
  updated_at?: string;
  point: PointRow | PointRow[] | null;
  product:
    | (Omit<AdminProduct, "category"> & {
        category: AdminProduct["category"] | AdminProduct["category"][] | null;
      })
    | Array<
        Omit<AdminProduct, "category"> & {
          category:
            AdminProduct["category"] | AdminProduct["category"][] | null;
        }
      >
    | null;
};
type AuditRow = Omit<AdminConsumptionConfigurationAuditEvent, "actor_name"> & {
  users: { name: string } | { name: string }[] | null;
};

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] || null : value;
}

function mapPoint(
  row: PointRow,
  counts: { offers: number; inherited: number } = { offers: 0, inherited: 0 },
): AdminConsumptionPoint {
  return {
    id: row.id,
    hotel_id: row.hotel_id,
    name: row.name,
    internal_code: row.internal_code,
    description: row.description,
    display_order: row.display_order,
    is_active: row.is_active,
    default_policy: {
      allowed_modes: row.default_allowed_billing_modes,
      default_mode: row.default_billing_mode,
    },
    offers_count: counts.offers,
    inherited_offers_count: counts.inherited,
    archived_at: row.archived_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapOffer(row: OfferRow): AdminConsumptionOffer {
  const point = one(row.point);
  const productRow = one(row.product);
  const category = productRow ? one(productRow.category) : null;
  if (!point || !productRow || !category)
    throw new Error("Oferta sem ponto, produto ou categoria associada.");
  const product: AdminProduct = { ...productRow, category };
  const inherited = row.policy_source === "inherit";
  const allowedModes = inherited
    ? point.default_allowed_billing_modes
    : row.allowed_billing_modes || [];
  const defaultMode = inherited
    ? point.default_billing_mode
    : row.default_billing_mode || allowedModes[0];
  if (!defaultMode) throw new Error("Oferta sem política de cobrança válida.");

  const reasons: ConsumptionUnavailableReason[] = [];
  if (!point.is_active) reasons.push("point_inactive");
  if (point.archived_at) reasons.push("point_archived");
  if (!row.is_active) reasons.push("offer_inactive");
  if (row.archived_at) reasons.push("offer_archived");
  if (product.status !== "active") reasons.push("product_inactive");
  if (product.archived_at) reasons.push("product_archived");
  if (!category.is_active) reasons.push("category_inactive");
  if (category.archived_at) reasons.push("category_archived");

  return {
    id: row.id,
    hotel_id: row.hotel_id,
    point: {
      id: point.id,
      name: point.name,
      internal_code: point.internal_code,
      is_active: point.is_active,
      archived_at: point.archived_at,
    },
    product,
    display_order: row.display_order,
    is_active: row.is_active,
    policy: inherited
      ? { source: "inherit" }
      : {
          source: "override",
          allowed_modes: allowedModes,
          default_mode: defaultMode,
        },
    resolved_policy: {
      source: row.policy_source,
      allowed_modes: allowedModes,
      default_mode: defaultMode,
    },
    effective_available: reasons.length === 0,
    unavailable_reasons: reasons,
    archived_at: row.archived_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function pointInsert(input: AdminConsumptionPointInput) {
  return {
    name: input.name,
    internal_code: input.internal_code,
    description: input.description,
    display_order: input.display_order,
    is_active: input.is_active,
    default_allowed_billing_modes: input.default_policy.allowed_modes,
    default_billing_mode: input.default_policy.default_mode,
  } satisfies Omit<
    TablesInsert<"consumption_points">,
    "hotel_id" | "last_changed_by"
  >;
}

function offerPolicy(input: AdminConsumptionOfferUpdateInput["policy"]) {
  if (!input) return {};
  return input.source === "inherit"
    ? {
        policy_source: "inherit" as const,
        allowed_billing_modes: null,
        default_billing_mode: null,
      }
    : {
        policy_source: "override" as const,
        allowed_billing_modes: input.allowed_modes,
        default_billing_mode: input.default_mode,
      };
}

export interface ConsumptionSettingsRepository {
  listPoints(
    hotelId: string,
    includeArchived?: boolean,
  ): Promise<AdminConsumptionPoint[]>;
  createPoint(
    hotelId: string,
    actorId: string,
    input: AdminConsumptionPointInput,
  ): Promise<{
    result: ConsumptionSettingsWriteResult;
    item?: AdminConsumptionPoint;
  }>;
  updatePoint(
    id: string,
    hotelId: string,
    actorId: string,
    input: Partial<AdminConsumptionPointInput>,
  ): Promise<{
    result: ConsumptionSettingsWriteResult;
    item?: AdminConsumptionPoint;
  }>;
  setPointArchived(
    id: string,
    hotelId: string,
    actorId: string,
    archived: boolean,
  ): Promise<{
    result: ConsumptionSettingsWriteResult;
    item?: AdminConsumptionPoint;
  }>;
  reorderPoints(
    hotelId: string,
    actorId: string,
    ids: string[],
  ): Promise<ConsumptionSettingsWriteResult>;
  listOffers(
    hotelId: string,
    filters?: {
      includeArchived?: boolean;
      pointId?: string;
      productId?: string;
    },
  ): Promise<AdminConsumptionOffer[]>;
  createOffers(
    pointId: string,
    hotelId: string,
    actorId: string,
    input: AdminConsumptionOfferBatchInput,
  ): Promise<{
    result: ConsumptionSettingsWriteResult;
    items?: AdminConsumptionOffer[];
  }>;
  updateOffer(
    id: string,
    hotelId: string,
    actorId: string,
    input: AdminConsumptionOfferUpdateInput,
  ): Promise<{
    result: ConsumptionSettingsWriteResult;
    item?: AdminConsumptionOffer;
  }>;
  setOfferArchived(
    id: string,
    hotelId: string,
    actorId: string,
    archived: boolean,
  ): Promise<{
    result: ConsumptionSettingsWriteResult;
    item?: AdminConsumptionOffer;
  }>;
  reorderOffers(
    pointId: string,
    hotelId: string,
    actorId: string,
    ids: string[],
  ): Promise<ConsumptionSettingsWriteResult>;
  listHistory(
    entityType: "consumption_point" | "consumption_offer",
    entityId: string,
    hotelId: string,
  ): Promise<AdminConsumptionConfigurationAuditEvent[]>;
}

class SupabaseConsumptionSettingsRepository implements ConsumptionSettingsRepository {
  async listPoints(hotelId: string, includeArchived = false) {
    const supabase = createServerClient();
    let pointQuery = supabase.from("consumption_points").select(POINT_FIELDS);
    pointQuery = applyHotelContextFilter(pointQuery, hotelId);
    if (!includeArchived) pointQuery = pointQuery.is("archived_at", null);
    const [pointsResult, offersResult] = await Promise.all([
      pointQuery.order("display_order").order("name"),
      supabase
        .from("consumption_offers")
        .select("point_id,policy_source")
        .eq("hotel_id", hotelId)
        .is("archived_at", null),
    ]);
    if (pointsResult.error || offersResult.error)
      throw pointsResult.error || offersResult.error;
    const counts = new Map<string, { offers: number; inherited: number }>();
    for (const offer of offersResult.data || []) {
      const current = counts.get(offer.point_id) || { offers: 0, inherited: 0 };
      current.offers += 1;
      if (offer.policy_source === "inherit") current.inherited += 1;
      counts.set(offer.point_id, current);
    }
    return ((pointsResult.data || []) as unknown as PointRow[]).map((row) =>
      mapPoint(row, counts.get(row.id)),
    );
  }

  async getPoint(id: string, hotelId: string) {
    const items = await this.listPoints(hotelId, true);
    return items.find((item) => item.id === id) || null;
  }

  async createPoint(
    hotelId: string,
    actorId: string,
    input: AdminConsumptionPointInput,
  ) {
    const { data, error } = await createServerClient()
      .from("consumption_points")
      .insert({
        ...pointInsert(input),
        hotel_id: hotelId,
        last_changed_by: actorId,
      })
      .select(POINT_FIELDS)
      .single();
    if (error) {
      if (isSupabaseConflictError(error))
        return { result: "conflict" as const };
      throw error;
    }
    return {
      result: "ok" as const,
      item: mapPoint(data as unknown as PointRow),
    };
  }

  async updatePoint(
    id: string,
    hotelId: string,
    actorId: string,
    input: Partial<AdminConsumptionPointInput>,
  ) {
    const payload: TablesUpdate<"consumption_points"> = {
      last_changed_by: actorId,
    };
    if (input.name !== undefined) payload.name = input.name;
    if (input.internal_code !== undefined)
      payload.internal_code = input.internal_code;
    if (input.description !== undefined)
      payload.description = input.description;
    if (input.display_order !== undefined)
      payload.display_order = input.display_order;
    if (input.is_active !== undefined) payload.is_active = input.is_active;
    if (input.default_policy !== undefined) {
      payload.default_allowed_billing_modes =
        input.default_policy.allowed_modes;
      payload.default_billing_mode = input.default_policy.default_mode;
    }
    let query = createServerClient()
      .from("consumption_points")
      .update(payload)
      .eq("id", id);
    query = applyHotelContextFilter(query, hotelId);
    const { data, error } = await query.select(POINT_FIELDS).single();
    if (error) {
      if (isSupabaseNotFoundError(error))
        return { result: "not-found" as const };
      if (isSupabaseConflictError(error))
        return { result: "conflict" as const };
      throw error;
    }
    const item = await this.getPoint(id, hotelId);
    return {
      result: "ok" as const,
      item: item || mapPoint(data as unknown as PointRow),
    };
  }

  async setPointArchived(
    id: string,
    hotelId: string,
    actorId: string,
    archived: boolean,
  ) {
    let query = createServerClient()
      .from("consumption_points")
      .update({
        archived_at: archived ? new Date().toISOString() : null,
        last_changed_by: actorId,
      })
      .eq("id", id);
    query = applyHotelContextFilter(query, hotelId);
    const { error } = await query.select("id").single();
    if (error) {
      if (isSupabaseNotFoundError(error))
        return { result: "not-found" as const };
      if (isSupabaseConflictError(error))
        return { result: "conflict" as const };
      throw error;
    }
    const item = await this.getPoint(id, hotelId);
    return item
      ? { result: "ok" as const, item }
      : { result: "not-found" as const };
  }

  async reorderPoints(hotelId: string, actorId: string, ids: string[]) {
    const { data, error } = await createServerClient().rpc(
      "reorder_consumption_points",
      {
        p_hotel_id: hotelId,
        p_actor_id: actorId,
        p_ids: ids,
      },
    );
    if (error) throw error;
    return data === "ok" ? "ok" : "conflict";
  }

  async listOffers(hotelId: string, filters = {}) {
    const typedFilters = filters as {
      includeArchived?: boolean;
      pointId?: string;
      productId?: string;
    };
    let query = createServerClient()
      .from("consumption_offers")
      .select(OFFER_FIELDS)
      .eq("hotel_id", hotelId);
    if (!typedFilters.includeArchived) query = query.is("archived_at", null);
    if (typedFilters.pointId)
      query = query.eq("point_id", typedFilters.pointId);
    if (typedFilters.productId)
      query = query.eq("product_id", typedFilters.productId);
    const { data, error } = await query
      .order("display_order")
      .order("created_at");
    if (error) throw error;
    return ((data || []) as unknown as OfferRow[]).map(mapOffer);
  }

  async createOffers(
    pointId: string,
    hotelId: string,
    actorId: string,
    input: AdminConsumptionOfferBatchInput,
  ) {
    const point = await this.getPoint(pointId, hotelId);
    if (!point) return { result: "not-found" as const };
    if (point.archived_at) return { result: "conflict" as const };
    const products = await createServerClient()
      .from("products")
      .select("id,archived_at")
      .eq("hotel_id", hotelId)
      .in("id", input.product_ids);
    if (products.error) throw products.error;
    if (
      products.data.length !== input.product_ids.length ||
      products.data.some((item) => item.archived_at)
    )
      return { result: "conflict" as const };
    const existing = await this.listOffers(hotelId, {
      pointId,
      includeArchived: true,
    });
    const maxOrder = existing.reduce(
      (max, item) => Math.max(max, item.display_order),
      0,
    );
    const policy = offerPolicy(input.policy);
    const rows: TablesInsert<"consumption_offers">[] = input.product_ids.map(
      (productId, index) => ({
        hotel_id: hotelId,
        point_id: pointId,
        product_id: productId,
        display_order: maxOrder + (index + 1) * 10,
        is_active: true,
        last_changed_by: actorId,
        ...policy,
      }),
    );
    const { error } = await createServerClient()
      .from("consumption_offers")
      .insert(rows);
    if (error) {
      if (isSupabaseConflictError(error))
        return { result: "conflict" as const };
      throw error;
    }
    const items = (
      await this.listOffers(hotelId, { pointId, includeArchived: true })
    ).filter((item) => input.product_ids.includes(item.product.id));
    return { result: "ok" as const, items };
  }

  async updateOffer(
    id: string,
    hotelId: string,
    actorId: string,
    input: AdminConsumptionOfferUpdateInput,
  ) {
    const payload: TablesUpdate<"consumption_offers"> = {
      last_changed_by: actorId,
    };
    if (input.display_order !== undefined)
      payload.display_order = input.display_order;
    if (input.is_active !== undefined) payload.is_active = input.is_active;
    Object.assign(payload, offerPolicy(input.policy));
    let query = createServerClient()
      .from("consumption_offers")
      .update(payload)
      .eq("id", id);
    query = applyHotelContextFilter(query, hotelId);
    const { error } = await query.select("id").single();
    if (error) {
      if (isSupabaseNotFoundError(error))
        return { result: "not-found" as const };
      if (isSupabaseConflictError(error))
        return { result: "conflict" as const };
      throw error;
    }
    const item = (
      await this.listOffers(hotelId, { includeArchived: true })
    ).find((offer) => offer.id === id);
    return item
      ? { result: "ok" as const, item }
      : { result: "not-found" as const };
  }

  async setOfferArchived(
    id: string,
    hotelId: string,
    actorId: string,
    archived: boolean,
  ) {
    let query = createServerClient()
      .from("consumption_offers")
      .update({
        archived_at: archived ? new Date().toISOString() : null,
        last_changed_by: actorId,
      })
      .eq("id", id);
    query = applyHotelContextFilter(query, hotelId);
    const { error } = await query.select("id").single();
    if (error) {
      if (isSupabaseNotFoundError(error))
        return { result: "not-found" as const };
      if (isSupabaseConflictError(error))
        return { result: "conflict" as const };
      throw error;
    }
    const item = (
      await this.listOffers(hotelId, { includeArchived: true })
    ).find((offer) => offer.id === id);
    return item
      ? { result: "ok" as const, item }
      : { result: "not-found" as const };
  }

  async reorderOffers(
    pointId: string,
    hotelId: string,
    actorId: string,
    ids: string[],
  ) {
    const { data, error } = await createServerClient().rpc(
      "reorder_consumption_offers",
      {
        p_hotel_id: hotelId,
        p_point_id: pointId,
        p_actor_id: actorId,
        p_ids: ids,
      },
    );
    if (error) throw error;
    return data === "ok" ? "ok" : "conflict";
  }

  async listHistory(
    entityType: "consumption_point" | "consumption_offer",
    entityId: string,
    hotelId: string,
  ) {
    const { data, error } = await createServerClient()
      .from("consumption_configuration_audit_events")
      .select(
        "id,hotel_id,entity_type,entity_id,actor_id,action,changes,created_at,users:actor_id(name)",
      )
      .eq("hotel_id", hotelId)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ((data || []) as unknown as AuditRow[]).map((row) => {
      const { users, ...event } = row;
      return { ...event, actor_name: one(users)?.name || null };
    });
  }
}

export function createConsumptionSettingsRepository(): ConsumptionSettingsRepository {
  return new SupabaseConsumptionSettingsRepository();
}
