import type {
  AdminCatalogAuditEvent,
  AdminProduct,
  AdminProductCategory,
  TablesInsert,
  TablesUpdate,
} from "@hotel/shared";
import { applyHotelContextFilter } from "../common/hotelContextFilter";
import { createServerClient } from "../common/supabaseServer";
import {
  isSupabaseConflictError,
  isSupabaseNotFoundError,
} from "./supabaseError";

const CATEGORY_FIELDS =
  "id,hotel_id,name,display_order,is_active,archived_at,created_at,updated_at";
const PRODUCT_FIELDS = `id,hotel_id,name,description,internal_code,kind,sales_unit,unit_price,status,archived_at,created_at,updated_at,category:product_categories(${CATEGORY_FIELDS})`;

export type ProductWriteResult = "ok" | "conflict" | "not-found";
type ProductCreate = Omit<
  TablesInsert<"products">,
  "hotel_id" | "last_changed_by"
>;
type ProductUpdate = Omit<
  TablesUpdate<"products">,
  "hotel_id" | "last_changed_by"
>;
type ProductRow = Omit<AdminProduct, "category"> & {
  category: AdminProductCategory | AdminProductCategory[] | null;
};
type CatalogAuditRow = Omit<AdminCatalogAuditEvent, "actor_name"> & {
  users: { name: string } | { name: string }[] | null;
};

function mapProduct(row: ProductRow): AdminProduct {
  const category = Array.isArray(row.category) ? row.category[0] : row.category;
  if (!category) throw new Error("Produto sem categoria associada.");
  return { ...row, category };
}

export interface ProductsRepository {
  listProducts(
    activeHotelId: string,
    includeArchived?: boolean,
  ): Promise<AdminProduct[]>;
  getProduct(id: string, activeHotelId: string): Promise<AdminProduct | null>;
  listCategories(
    activeHotelId: string,
    includeArchived?: boolean,
  ): Promise<AdminProductCategory[]>;
  createProduct(
    activeHotelId: string,
    actorId: string,
    payload: ProductCreate,
  ): Promise<{ result: ProductWriteResult; item?: AdminProduct }>;
  updateProduct(
    id: string,
    activeHotelId: string,
    actorId: string,
    payload: ProductUpdate,
  ): Promise<{ result: ProductWriteResult; item?: AdminProduct }>;
  setProductArchived(
    id: string,
    activeHotelId: string,
    actorId: string,
    archived: boolean,
  ): Promise<{ result: ProductWriteResult; item?: AdminProduct }>;
  createCategory(
    activeHotelId: string,
    actorId: string,
    payload: Omit<
      TablesInsert<"product_categories">,
      "hotel_id" | "last_changed_by"
    >,
  ): Promise<{ result: ProductWriteResult; item?: AdminProductCategory }>;
  updateCategory(
    id: string,
    activeHotelId: string,
    actorId: string,
    payload: Omit<
      TablesUpdate<"product_categories">,
      "hotel_id" | "last_changed_by"
    >,
  ): Promise<{ result: ProductWriteResult; item?: AdminProductCategory }>;
  setCategoryArchived(
    id: string,
    activeHotelId: string,
    actorId: string,
    archived: boolean,
  ): Promise<{ result: ProductWriteResult; item?: AdminProductCategory }>;
  listProductHistory(
    id: string,
    activeHotelId: string,
  ): Promise<AdminCatalogAuditEvent[]>;
}

class SupabaseProductsRepository implements ProductsRepository {
  async listProducts(
    activeHotelId: string,
    includeArchived = false,
  ): Promise<AdminProduct[]> {
    const supabase = createServerClient();
    let query = supabase.from("products").select(PRODUCT_FIELDS);
    query = applyHotelContextFilter(query, activeHotelId);
    if (!includeArchived) query = query.is("archived_at", null);
    const { data, error } = await query.order("name");
    if (error) throw error;
    return ((data || []) as unknown as ProductRow[]).map(mapProduct);
  }

  async getProduct(
    id: string,
    activeHotelId: string,
  ): Promise<AdminProduct | null> {
    const supabase = createServerClient();
    let query = supabase.from("products").select(PRODUCT_FIELDS).eq("id", id);
    query = applyHotelContextFilter(query, activeHotelId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data ? mapProduct(data as unknown as ProductRow) : null;
  }

  async listCategories(
    activeHotelId: string,
    includeArchived = false,
  ): Promise<AdminProductCategory[]> {
    const supabase = createServerClient();
    let query = supabase.from("product_categories").select(CATEGORY_FIELDS);
    query = applyHotelContextFilter(query, activeHotelId);
    if (!includeArchived) query = query.is("archived_at", null);
    const { data, error } = await query.order("display_order").order("name");
    if (error) throw error;
    return (data || []) as unknown as AdminProductCategory[];
  }

  async createProduct(
    activeHotelId: string,
    actorId: string,
    payload: ProductCreate,
  ) {
    const { data, error } = await createServerClient()
      .from("products")
      .insert({ ...payload, hotel_id: activeHotelId, last_changed_by: actorId })
      .select(PRODUCT_FIELDS)
      .single();
    if (error) {
      if (isSupabaseConflictError(error))
        return { result: "conflict" as const };
      throw error;
    }
    return {
      result: "ok" as const,
      item: mapProduct(data as unknown as ProductRow),
    };
  }

  async updateProduct(
    id: string,
    activeHotelId: string,
    actorId: string,
    payload: ProductUpdate,
  ) {
    let query = createServerClient()
      .from("products")
      .update({ ...payload, last_changed_by: actorId })
      .eq("id", id);
    query = applyHotelContextFilter(query, activeHotelId);
    const { data, error } = await query.select(PRODUCT_FIELDS).single();
    if (error) {
      if (isSupabaseNotFoundError(error))
        return { result: "not-found" as const };
      if (isSupabaseConflictError(error))
        return { result: "conflict" as const };
      throw error;
    }
    return {
      result: "ok" as const,
      item: mapProduct(data as unknown as ProductRow),
    };
  }

  async setProductArchived(
    id: string,
    activeHotelId: string,
    actorId: string,
    archived: boolean,
  ) {
    return this.updateProduct(id, activeHotelId, actorId, {
      archived_at: archived ? new Date().toISOString() : null,
    });
  }

  async createCategory(
    activeHotelId: string,
    actorId: string,
    payload: Omit<
      TablesInsert<"product_categories">,
      "hotel_id" | "last_changed_by"
    >,
  ) {
    const { data, error } = await createServerClient()
      .from("product_categories")
      .insert({ ...payload, hotel_id: activeHotelId, last_changed_by: actorId })
      .select(CATEGORY_FIELDS)
      .single();
    if (error) {
      if (isSupabaseConflictError(error))
        return { result: "conflict" as const };
      throw error;
    }
    return {
      result: "ok" as const,
      item: data as unknown as AdminProductCategory,
    };
  }

  async updateCategory(
    id: string,
    activeHotelId: string,
    actorId: string,
    payload: Omit<
      TablesUpdate<"product_categories">,
      "hotel_id" | "last_changed_by"
    >,
  ) {
    let query = createServerClient()
      .from("product_categories")
      .update({ ...payload, last_changed_by: actorId })
      .eq("id", id);
    query = applyHotelContextFilter(query, activeHotelId);
    const { data, error } = await query.select(CATEGORY_FIELDS).single();
    if (error) {
      if (isSupabaseNotFoundError(error))
        return { result: "not-found" as const };
      if (isSupabaseConflictError(error))
        return { result: "conflict" as const };
      throw error;
    }
    return {
      result: "ok" as const,
      item: data as unknown as AdminProductCategory,
    };
  }

  async setCategoryArchived(
    id: string,
    activeHotelId: string,
    actorId: string,
    archived: boolean,
  ) {
    return this.updateCategory(id, activeHotelId, actorId, {
      archived_at: archived ? new Date().toISOString() : null,
    });
  }

  async listProductHistory(
    id: string,
    activeHotelId: string,
  ): Promise<AdminCatalogAuditEvent[]> {
    let query = createServerClient()
      .from("catalog_audit_events")
      .select(
        "id,hotel_id,entity_type,entity_id,actor_id,action,changes,created_at,users:actor_id(name)",
      )
      .eq("entity_type", "product")
      .eq("entity_id", id);
    query = applyHotelContextFilter(query, activeHotelId);
    const { data, error } = await query.order("created_at", {
      ascending: false,
    });
    if (error) throw error;
    return ((data || []) as unknown as CatalogAuditRow[]).map((row) => {
      const { users, ...event } = row;
      const actor = Array.isArray(users) ? users[0] : users;
      return { ...event, actor_name: actor?.name || null };
    });
  }
}

export function createProductsRepository(): ProductsRepository {
  return new SupabaseProductsRepository();
}
