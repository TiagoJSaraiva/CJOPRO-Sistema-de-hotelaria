import type {
  AdminInventoryAuditEvent,
  AdminInventoryCountItem,
  AdminInventoryDocumentInput,
  AdminInventoryLocation,
  AdminInventoryLocationInput,
  AdminInventoryMovement,
  AdminInventoryPosition,
  AdminInventoryPositionInput,
  AdminInventoryPositionUpdateInput,
  AdminInventorySettings,
  AdminInventoryTransferInput,
  InventoryCountStatus,
  InventoryMovementKind,
  InventoryNegativeStockPolicy,
  Json,
} from "@hotel/shared";
import { createServerClient } from "../common/supabaseServer";

type MutationResult<T> =
  { result: "ok"; item: T; created?: boolean } | { result: string };
type IdResult =
  { result: "ok"; id: string; created: boolean } | { result: string };

type LocationRow = {
  id: string;
  hotel_id: string;
  name: string;
  internal_code: string | null;
  description: string | null;
  display_order: number;
  is_active: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};
type PositionRow = {
  id: string;
  hotel_id: string;
  product_id: string;
  location_id: string;
  quantity: number;
  version: number;
  minimum_quantity: number;
  ideal_quantity: number;
  average_unit_cost: number | null;
  is_active: boolean;
  archived_at: string | null;
  updated_at: string;
  product: {
    id: string;
    name: string;
    internal_code: string | null;
    kind: "physical" | "service";
    sales_unit: "unit" | "portion" | "person" | "hour" | "daily" | "service";
    provider_type: "hotel" | "partner";
    commercial_partner_id: string | null;
  } | null;
  location: {
    id: string;
    name: string;
    internal_code: string | null;
    is_active: boolean;
    archived_at: string | null;
  } | null;
};
type CountRow = {
  id: string;
  hotel_id: string;
  status: InventoryCountStatus;
  notes: string | null;
  created_by: string;
  created_at: string;
  completed_by: string | null;
  completed_at: string | null;
  canceled_by: string | null;
  canceled_at: string | null;
  location: PositionRow["location"];
  items: Array<{
    id: string;
    position_id: string;
    expected_quantity: number;
    expected_version: number;
    counted_quantity: number | null;
    position: { product_id: string; product: { name: string } | null } | null;
  }>;
};

const POSITION_SELECT =
  "id,hotel_id,product_id,location_id,quantity,version,minimum_quantity,ideal_quantity,average_unit_cost,is_active,archived_at,updated_at,product:products(id,name,internal_code,kind,sales_unit,provider_type,commercial_partner_id),location:inventory_locations(id,name,internal_code,is_active,archived_at)";
const COUNT_SELECT =
  "id,hotel_id,status,notes,created_by,created_at,completed_by,completed_at,canceled_by,canceled_at,location:inventory_locations(id,name,internal_code,is_active,archived_at),items:inventory_count_items(id,position_id,expected_quantity,expected_version,counted_quantity,position:inventory_positions(product_id,product:products(name)))";

function object(value: Json | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function num(value: unknown) {
  return Number(value || 0);
}
function mapLocation(
  row: LocationRow,
  positions: Array<{ location_id: string; quantity: number }> = [],
): AdminInventoryLocation {
  const scoped = positions.filter((item) => item.location_id === row.id);
  return {
    ...row,
    position_count: scoped.length,
    total_quantity: scoped.reduce((sum, item) => sum + num(item.quantity), 0),
  };
}
function mapPosition(
  row: PositionRow,
  includeCosts: boolean,
): AdminInventoryPosition {
  if (!row.product || !row.location)
    throw new Error("Posição sem produto ou local associado.");
  const quantity = num(row.quantity);
  const minimum = num(row.minimum_quantity);
  const ideal = num(row.ideal_quantity);
  const averageCost =
    row.average_unit_cost == null ? null : num(row.average_unit_cost);
  const status =
    quantity < 0
      ? "negative"
      : averageCost == null && quantity > 0
        ? "unvalued"
        : quantity < minimum
          ? "low"
          : "available";
  return {
    id: row.id,
    hotel_id: row.hotel_id,
    product: {
      id: row.product.id,
      name: row.product.name,
      internal_code: row.product.internal_code,
      kind: row.product.kind,
      sales_unit: row.product.sales_unit,
      provider:
        row.product.provider_type === "hotel"
          ? { type: "hotel", partner: null }
          : {
              type: "partner",
              partner: {
                id: row.product.commercial_partner_id || "",
                trade_name: "Parceiro",
              },
            },
    },
    location: row.location,
    quantity,
    version: num(row.version),
    minimum_quantity: minimum,
    ideal_quantity: ideal,
    suggested_replenishment: Math.max(0, ideal - quantity),
    ...(includeCosts
      ? {
          average_unit_cost: averageCost,
          inventory_value:
            averageCost == null ? null : Math.max(0, quantity) * averageCost,
        }
      : {}),
    status,
    is_active: row.is_active,
    archived_at: row.archived_at,
    updated_at: row.updated_at,
  };
}
function mapCount(row: CountRow) {
  if (!row.location) throw new Error("Contagem sem local associado.");
  return {
    id: row.id,
    hotel_id: row.hotel_id,
    location: row.location,
    status: row.status,
    notes: row.notes,
    created_by: row.created_by,
    created_at: row.created_at,
    completed_by: row.completed_by,
    completed_at: row.completed_at,
    canceled_by: row.canceled_by,
    canceled_at: row.canceled_at,
    items: (row.items || []).map(
      (
        item,
      ): AdminInventoryCountItem & {
        product_id: string;
        product_name: string;
      } => ({
        id: item.id,
        position_id: item.position_id,
        product_id: item.position?.product_id || "",
        product_name: item.position?.product?.name || "Produto",
        expected_quantity: num(item.expected_quantity),
        expected_version: num(item.expected_version),
        counted_quantity:
          item.counted_quantity == null ? null : num(item.counted_quantity),
        difference:
          item.counted_quantity == null
            ? null
            : num(item.counted_quantity) - num(item.expected_quantity),
      }),
    ),
  };
}

export interface InventoryRepository {
  getSettings(hotelId: string): Promise<AdminInventorySettings | null>;
  updateSettings(
    hotelId: string,
    actorId: string,
    policy: InventoryNegativeStockPolicy,
  ): Promise<AdminInventorySettings | null>;
  listLocations(
    hotelId: string,
    includeArchived: boolean,
  ): Promise<AdminInventoryLocation[]>;
  createLocation(
    hotelId: string,
    actorId: string,
    input: AdminInventoryLocationInput,
  ): Promise<MutationResult<AdminInventoryLocation>>;
  updateLocation(
    id: string,
    hotelId: string,
    actorId: string,
    input: Partial<AdminInventoryLocationInput> & {
      archived_at?: string | null;
    },
  ): Promise<MutationResult<AdminInventoryLocation>>;
  reorderLocations(
    hotelId: string,
    actorId: string,
    ids: string[],
  ): Promise<string>;
  listPositions(
    hotelId: string,
    filters: { locationId?: string; productId?: string; lowOnly?: boolean },
    includeCosts: boolean,
  ): Promise<AdminInventoryPosition[]>;
  createPosition(
    hotelId: string,
    actorId: string,
    input: AdminInventoryPositionInput,
    includeCosts: boolean,
  ): Promise<MutationResult<AdminInventoryPosition>>;
  updatePosition(
    id: string,
    hotelId: string,
    actorId: string,
    input: AdminInventoryPositionUpdateInput,
    includeCosts: boolean,
  ): Promise<MutationResult<AdminInventoryPosition>>;
  postDocument(
    hotelId: string,
    actorId: string,
    input: AdminInventoryDocumentInput,
  ): Promise<IdResult>;
  transfer(
    hotelId: string,
    actorId: string,
    input: AdminInventoryTransferInput,
  ): Promise<IdResult>;
  listMovements(
    hotelId: string,
    filters: {
      cursor?: string;
      limit: number;
      locationId?: string;
      productId?: string;
      kind?: InventoryMovementKind;
    },
    includeCosts: boolean,
  ): Promise<{ items: AdminInventoryMovement[]; next_cursor: string | null }>;
  listAudit(
    hotelId: string,
    filters: { cursor?: string; limit: number },
  ): Promise<{ items: AdminInventoryAuditEvent[]; next_cursor: string | null }>;
  listCounts(hotelId: string): Promise<ReturnType<typeof mapCount>[]>;
  createCount(
    hotelId: string,
    actorId: string,
    input: {
      location_id: string;
      product_ids?: string[];
      notes?: string | null;
      idempotency_key: string;
    },
  ): Promise<MutationResult<ReturnType<typeof mapCount>>>;
  updateCount(
    hotelId: string,
    actorId: string,
    id: string,
    items: Array<{ item_id: string; counted_quantity: number }>,
  ): Promise<MutationResult<ReturnType<typeof mapCount>>>;
  completeCount(
    hotelId: string,
    actorId: string,
    id: string,
  ): Promise<MutationResult<ReturnType<typeof mapCount>>>;
  cancelCount(
    hotelId: string,
    actorId: string,
    id: string,
  ): Promise<MutationResult<ReturnType<typeof mapCount>>>;
}

class SupabaseInventoryRepository implements InventoryRepository {
  async getSettings(hotelId: string) {
    const { data, error } = await createServerClient()
      .from("inventory_settings")
      .select("hotel_id,negative_stock_policy,updated_at")
      .eq("hotel_id", hotelId)
      .maybeSingle();
    if (error) throw error;
    return data as AdminInventorySettings | null;
  }
  async updateSettings(
    hotelId: string,
    actorId: string,
    policy: InventoryNegativeStockPolicy,
  ) {
    const client = createServerClient();
    const { data, error } = await client
      .from("inventory_settings")
      .update({
        negative_stock_policy: policy,
        updated_by: actorId,
        updated_at: new Date().toISOString(),
      })
      .eq("hotel_id", hotelId)
      .select("hotel_id,negative_stock_policy,updated_at")
      .maybeSingle();
    if (error) throw error;
    return data as AdminInventorySettings | null;
  }
  async listLocations(hotelId: string, includeArchived: boolean) {
    const client = createServerClient();
    let query = client
      .from("inventory_locations")
      .select(
        "id,hotel_id,name,internal_code,description,display_order,is_active,archived_at,created_at,updated_at",
      )
      .eq("hotel_id", hotelId)
      .order("display_order")
      .order("name");
    if (!includeArchived) query = query.is("archived_at", null);
    const [locations, positions] = await Promise.all([
      query,
      client
        .from("inventory_positions")
        .select("location_id,quantity")
        .eq("hotel_id", hotelId),
    ]);
    if (locations.error) throw locations.error;
    if (positions.error) throw positions.error;
    return (locations.data as LocationRow[]).map((row) =>
      mapLocation(row, positions.data || []),
    );
  }
  async locationById(id: string, hotelId: string) {
    return (
      (await this.listLocations(hotelId, true)).find(
        (item) => item.id === id,
      ) || null
    );
  }
  async createLocation(
    hotelId: string,
    actorId: string,
    input: AdminInventoryLocationInput,
  ) {
    const client = createServerClient();
    const { data, error } = await client
      .from("inventory_locations")
      .insert({
        hotel_id: hotelId,
        name: input.name,
        internal_code: input.internal_code || null,
        description: input.description || null,
        display_order: input.display_order || 0,
        is_active: input.is_active ?? true,
        created_by: actorId,
        updated_by: actorId,
      })
      .select("id")
      .single();
    if (error)
      return error.code === "23505"
        ? { result: "conflict" }
        : Promise.reject(error);
    return {
      result: "ok",
      item: (await this.locationById(data.id, hotelId))!,
      created: true,
    };
  }
  async updateLocation(
    id: string,
    hotelId: string,
    actorId: string,
    input: Partial<AdminInventoryLocationInput> & {
      archived_at?: string | null;
    },
  ) {
    const client = createServerClient();
    const { data, error } = await client
      .from("inventory_locations")
      .update({ ...input, updated_by: actorId })
      .eq("id", id)
      .eq("hotel_id", hotelId)
      .select("id")
      .maybeSingle();
    if (error)
      return ["23505", "23514"].includes(error.code)
        ? { result: error.code === "23505" ? "conflict" : error.message }
        : Promise.reject(error);
    if (!data) return { result: "not_found" };
    return { result: "ok", item: (await this.locationById(id, hotelId))! };
  }
  async reorderLocations(hotelId: string, actorId: string, ids: string[]) {
    const { data, error } = await createServerClient().rpc(
      "reorder_inventory_locations",
      { p_hotel_id: hotelId, p_actor_id: actorId, p_ids: ids },
    );
    if (error) throw error;
    return String(data);
  }
  async listPositions(
    hotelId: string,
    filters: { locationId?: string; productId?: string; lowOnly?: boolean },
    includeCosts: boolean,
  ) {
    let query = createServerClient()
      .from("inventory_positions")
      .select(POSITION_SELECT)
      .eq("hotel_id", hotelId)
      .is("archived_at", null)
      .order("updated_at", { ascending: false });
    if (filters.locationId) query = query.eq("location_id", filters.locationId);
    if (filters.productId) query = query.eq("product_id", filters.productId);
    const { data, error } = await query;
    if (error) throw error;
    const items = (data as unknown as PositionRow[]).map((row) =>
      mapPosition(row, includeCosts),
    );
    return filters.lowOnly
      ? items.filter((item) => item.quantity < item.minimum_quantity)
      : items;
  }
  async positionById(id: string, hotelId: string, includeCosts: boolean) {
    const items = await this.listPositions(hotelId, {}, includeCosts);
    return items.find((item) => item.id === id) || null;
  }
  async createPosition(
    hotelId: string,
    actorId: string,
    input: AdminInventoryPositionInput,
    includeCosts: boolean,
  ) {
    const { data, error } = await createServerClient().rpc(
      "configure_inventory_position",
      {
        p_hotel_id: hotelId,
        p_actor_id: actorId,
        p_product_id: input.product_id,
        p_location_id: input.location_id,
        p_initial_quantity: input.initial_quantity,
        p_minimum_quantity: input.minimum_quantity || 0,
        p_ideal_quantity: input.ideal_quantity || 0,
        p_average_unit_cost: (input.average_unit_cost ??
          null) as unknown as number,
        p_idempotency_key: input.idempotency_key,
      },
    );
    if (error) throw error;
    const payload = object(data);
    if (payload.result !== "ok") return { result: String(payload.result) };
    return {
      result: "ok",
      item: (await this.positionById(
        String(payload.position_id),
        hotelId,
        includeCosts,
      ))!,
      created: payload.created === true,
    };
  }
  async updatePosition(
    id: string,
    hotelId: string,
    actorId: string,
    input: AdminInventoryPositionUpdateInput,
    includeCosts: boolean,
  ) {
    const { data, error } = await createServerClient()
      .from("inventory_positions")
      .update({ ...input, updated_by: actorId })
      .eq("id", id)
      .eq("hotel_id", hotelId)
      .select("id")
      .maybeSingle();
    if (error)
      return error.code === "23514"
        ? { result: error.message }
        : Promise.reject(error);
    if (!data) return { result: "not_found" };
    const item = await this.positionById(id, hotelId, includeCosts);
    return item ? { result: "ok", item } : { result: "not_found" };
  }
  async postDocument(
    hotelId: string,
    actorId: string,
    input: AdminInventoryDocumentInput,
  ) {
    const { data, error } = await createServerClient().rpc(
      "post_inventory_document",
      {
        p_hotel_id: hotelId,
        p_actor_id: actorId,
        p_kind: input.kind,
        p_direction: (input.direction || null) as unknown as string,
        p_reason: input.reason,
        p_reference: (input.reference_code || null) as unknown as string,
        p_occurred_at: input.occurred_at,
        p_lines: input.lines as unknown as Json,
        p_idempotency_key: input.idempotency_key,
      },
    );
    if (error) throw error;
    const payload = object(data);
    return payload.result === "ok"
      ? {
          result: "ok",
          id: String(payload.document_id),
          created: payload.created === true,
        }
      : { result: String(payload.result) };
  }
  async transfer(
    hotelId: string,
    actorId: string,
    input: AdminInventoryTransferInput,
  ) {
    const { data, error } = await createServerClient().rpc(
      "transfer_inventory",
      {
        p_hotel_id: hotelId,
        p_actor_id: actorId,
        p_source_location_id: input.source_location_id,
        p_destination_location_id: input.destination_location_id,
        p_product_id: input.product_id,
        p_quantity: input.quantity,
        p_reason: input.reason,
        p_reference: (input.reference_code || null) as unknown as string,
        p_occurred_at: input.occurred_at,
        p_idempotency_key: input.idempotency_key,
      },
    );
    if (error) throw error;
    const payload = object(data);
    return payload.result === "ok"
      ? {
          result: "ok",
          id: String(payload.document_id),
          created: payload.created === true,
        }
      : { result: String(payload.result) };
  }
  async listMovements(
    hotelId: string,
    filters: {
      cursor?: string;
      limit: number;
      locationId?: string;
      productId?: string;
      kind?: InventoryMovementKind;
    },
    includeCosts: boolean,
  ) {
    let query = createServerClient()
      .from("inventory_movements")
      .select(
        "*,product:products(name),location:inventory_locations(name),actor:users(name)",
      )
      .eq("hotel_id", hotelId)
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(filters.limit + 1);
    if (filters.cursor) query = query.lt("occurred_at", filters.cursor);
    if (filters.locationId) query = query.eq("location_id", filters.locationId);
    if (filters.productId) query = query.eq("product_id", filters.productId);
    if (filters.kind) query = query.eq("kind", filters.kind);
    const { data, error } = await query;
    if (error) throw error;
    const page = (data || []).slice(0, filters.limit) as Array<
      Record<string, unknown>
    >;
    return {
      items: page.map((row) => ({
        id: String(row.id),
        hotel_id: String(row.hotel_id),
        position_id: String(row.position_id),
        product_id: String(row.product_id),
        product_name: String(
          (row.product as { name?: string } | null)?.name || "Produto",
        ),
        location_id: String(row.location_id),
        location_name: String(
          (row.location as { name?: string } | null)?.name || "Local",
        ),
        kind: row.kind as InventoryMovementKind,
        quantity_delta: num(row.quantity_delta),
        quantity_before: num(row.quantity_before),
        quantity_after: num(row.quantity_after),
        ...(includeCosts
          ? {
              average_unit_cost:
                row.average_unit_cost == null
                  ? null
                  : num(row.average_unit_cost),
              total_cost: row.total_cost == null ? null : num(row.total_cost),
            }
          : {}),
        reason: row.reason as string | null,
        reference_code: row.reference_code as string | null,
        occurred_at: String(row.occurred_at),
        posted_at: String(row.posted_at),
        actor_id: row.actor_id as string | null,
        actor_name: (row.actor as { name?: string } | null)?.name || null,
        consumption_order_id: row.consumption_order_id as string | null,
        consumption_order_item_id: row.consumption_order_item_id as
          string | null,
        consumption_correction_id: row.consumption_correction_id as
          string | null,
        document_id: row.document_id as string | null,
        count_session_id: row.count_session_id as string | null,
      })),
      next_cursor:
        (data || []).length > filters.limit
          ? String(page[page.length - 1]?.occurred_at || "")
          : null,
    };
  }
  async listAudit(
    hotelId: string,
    filters: { cursor?: string; limit: number },
  ) {
    let query = createServerClient()
      .from("inventory_audit_events")
      .select("*,actor:users(name)")
      .eq("hotel_id", hotelId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(filters.limit + 1);
    if (filters.cursor) query = query.lt("created_at", filters.cursor);
    const { data, error } = await query;
    if (error) throw error;
    const page = (data || []).slice(0, filters.limit) as Array<
      Record<string, unknown>
    >;
    return {
      items: page.map((row) => ({
        id: String(row.id),
        hotel_id: String(row.hotel_id),
        entity_type: row.entity_type as AdminInventoryAuditEvent["entity_type"],
        entity_id: String(row.entity_id),
        action: String(row.action),
        actor_id: row.actor_id as string | null,
        actor_name: (row.actor as { name?: string } | null)?.name || null,
        changes: object(row.changes as Json),
        created_at: String(row.created_at),
      })),
      next_cursor:
        (data || []).length > filters.limit
          ? String(page[page.length - 1]?.created_at || "")
          : null,
    };
  }
  async listCounts(hotelId: string) {
    const { data, error } = await createServerClient()
      .from("inventory_count_sessions")
      .select(COUNT_SELECT)
      .eq("hotel_id", hotelId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as unknown as CountRow[]).map(mapCount);
  }
  async countById(hotelId: string, id: string) {
    return (
      (await this.listCounts(hotelId)).find((item) => item.id === id) || null
    );
  }
  async createCount(
    hotelId: string,
    actorId: string,
    input: {
      location_id: string;
      product_ids?: string[];
      notes?: string | null;
      idempotency_key: string;
    },
  ) {
    const { data, error } = await createServerClient().rpc(
      "create_inventory_count",
      {
        p_hotel_id: hotelId,
        p_actor_id: actorId,
        p_location_id: input.location_id,
        p_product_ids: (input.product_ids || null) as unknown as string[],
        p_notes: (input.notes || null) as unknown as string,
        p_idempotency_key: input.idempotency_key,
      },
    );
    if (error) throw error;
    const payload = object(data);
    if (payload.result !== "ok") return { result: String(payload.result) };
    const item = await this.countById(hotelId, String(payload.count_id));
    return item
      ? { result: "ok", item, created: payload.created === true }
      : { result: "not_found" };
  }
  async updateCount(
    hotelId: string,
    actorId: string,
    id: string,
    items: Array<{ item_id: string; counted_quantity: number }>,
  ) {
    return this.countMutation("update_inventory_count", hotelId, actorId, id, {
      p_items: items as unknown as Json,
    });
  }
  async completeCount(hotelId: string, actorId: string, id: string) {
    return this.countMutation("complete_inventory_count", hotelId, actorId, id);
  }
  async cancelCount(hotelId: string, actorId: string, id: string) {
    return this.countMutation("cancel_inventory_count", hotelId, actorId, id);
  }
  private async countMutation(
    name:
      | "update_inventory_count"
      | "complete_inventory_count"
      | "cancel_inventory_count",
    hotelId: string,
    actorId: string,
    id: string,
    extra: { p_items?: Json } = {},
  ) {
    const { data, error } = await createServerClient().rpc(name, {
      p_hotel_id: hotelId,
      p_actor_id: actorId,
      p_count_id: id,
      ...extra,
    });
    if (error) throw error;
    const payload = object(data);
    if (payload.result !== "ok") return { result: String(payload.result) };
    const item = await this.countById(hotelId, id);
    return item ? { result: "ok", item } : { result: "not_found" };
  }
}

export function createInventoryRepository(): InventoryRepository {
  return new SupabaseInventoryRepository();
}
