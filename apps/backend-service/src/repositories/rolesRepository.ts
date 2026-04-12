import { createServerClient } from "@hotel/shared";
import { isSupabaseConflictError, isSupabaseNotFoundError } from "./supabaseError";

export type RoleWriteResult = "ok" | "conflict" | "not-found";

export interface RolesRepository {
  listReferenceHotels(): Promise<Array<{ id: string; name: string }>>;
  listReferencePermissions(): Promise<Array<{ id: string; name: string }>>;
  listRolesWithRelations(): Promise<any[]>;
  hotelExists(hotelId: string): Promise<boolean>;
  countPermissionsByIds(permissionIds: string[]): Promise<number>;
  createRole(payload: { name: string; hotel_id: string | null }): Promise<{ result: RoleWriteResult; id?: string }>;
  assignRolePermissions(items: Array<{ role_id: string; permission_id: string }>): Promise<void>;
  getRoleWithRelationsById(id: string): Promise<any | null>;
  updateRole(id: string, payload: Record<string, unknown>): Promise<RoleWriteResult>;
  roleExists(id: string): Promise<boolean>;
  clearRolePermissions(roleId: string): Promise<void>;
  deleteRole(id: string): Promise<RoleWriteResult>;
}

class SupabaseRolesRepository implements RolesRepository {
  async listReferenceHotels(): Promise<Array<{ id: string; name: string }>> {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("hotels").select("id,name").order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []) as Array<{ id: string; name: string }>;
  }

  async listReferencePermissions(): Promise<Array<{ id: string; name: string }>> {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("permissions").select("id,name").order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []) as Array<{ id: string; name: string }>;
  }

  async listRolesWithRelations(): Promise<any[]> {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("roles")
      .select("id,name,hotel_id,hotels(name),role_permissions(permission_id,permissions(id,name))")
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return data || [];
  }

  async hotelExists(hotelId: string): Promise<boolean> {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("hotels").select("id").eq("id", hotelId).single();

    if (error) {
      if (isSupabaseNotFoundError(error)) {
        return false;
      }

      throw error;
    }

    return !!data;
  }

  async countPermissionsByIds(permissionIds: string[]): Promise<number> {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("permissions").select("id").in("id", permissionIds);

    if (error) {
      throw error;
    }

    return (data || []).length;
  }

  async createRole(payload: { name: string; hotel_id: string | null }): Promise<{ result: RoleWriteResult; id?: string }> {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("roles").insert(payload).select("id").single();

    if (error) {
      if (isSupabaseConflictError(error)) {
        return { result: "conflict" };
      }

      throw error;
    }

    return { result: "ok", id: data.id };
  }

  async assignRolePermissions(items: Array<{ role_id: string; permission_id: string }>): Promise<void> {
    const supabase = createServerClient();
    const { error } = await supabase.from("role_permissions").insert(items);

    if (error) {
      throw error;
    }
  }

  async getRoleWithRelationsById(id: string): Promise<any | null> {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("roles")
      .select("id,name,hotel_id,hotels(name),role_permissions(permission_id,permissions(id,name))")
      .eq("id", id)
      .single();

    if (error) {
      if (isSupabaseNotFoundError(error)) {
        return null;
      }

      throw error;
    }

    return data;
  }

  async updateRole(id: string, payload: Record<string, unknown>): Promise<RoleWriteResult> {
    const supabase = createServerClient();
    const { error } = await supabase.from("roles").update(payload).eq("id", id);

    if (!error) {
      return "ok";
    }

    if (isSupabaseConflictError(error)) {
      return "conflict";
    }

    if (isSupabaseNotFoundError(error)) {
      return "not-found";
    }

    throw error;
  }

  async roleExists(id: string): Promise<boolean> {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("roles").select("id").eq("id", id).single();

    if (error) {
      if (isSupabaseNotFoundError(error)) {
        return false;
      }

      throw error;
    }

    return !!data;
  }

  async clearRolePermissions(roleId: string): Promise<void> {
    const supabase = createServerClient();
    const { error } = await supabase.from("role_permissions").delete().eq("role_id", roleId);

    if (error) {
      throw error;
    }
  }

  async deleteRole(id: string): Promise<RoleWriteResult> {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("roles").delete().eq("id", id).select("id");

    if (error) {
      throw error;
    }

    return data && data.length ? "ok" : "not-found";
  }
}

export function createRolesRepository(): RolesRepository {
  return new SupabaseRolesRepository();
}
