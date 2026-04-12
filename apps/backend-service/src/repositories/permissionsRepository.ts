import { createServerClient } from "@hotel/shared";
import { isSupabaseConflictError, isSupabaseNotFoundError } from "./supabaseError";

export type PermissionWriteResult = "ok" | "conflict" | "not-found";

export interface PermissionsRepository {
  listPermissions(): Promise<Array<{ id: string; name: string }>>;
  createPermission(payload: { name: string }): Promise<{ result: PermissionWriteResult; item?: { id: string; name: string } }>;
  updatePermission(id: string, payload: { name: string }): Promise<{ result: PermissionWriteResult; item?: { id: string; name: string } }>;
  deletePermission(id: string): Promise<PermissionWriteResult>;
}

class SupabasePermissionsRepository implements PermissionsRepository {
  async listPermissions(): Promise<Array<{ id: string; name: string }>> {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("permissions").select("id,name").order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []) as Array<{ id: string; name: string }>;
  }

  async createPermission(payload: { name: string }): Promise<{ result: PermissionWriteResult; item?: { id: string; name: string } }> {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("permissions").insert(payload).select("id,name").single();

    if (error) {
      if (isSupabaseConflictError(error)) {
        return { result: "conflict" };
      }

      throw error;
    }

    return { result: "ok", item: data as { id: string; name: string } };
  }

  async updatePermission(id: string, payload: { name: string }): Promise<{ result: PermissionWriteResult; item?: { id: string; name: string } }> {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("permissions").update(payload).eq("id", id).select("id,name").single();

    if (error) {
      if (isSupabaseNotFoundError(error)) {
        return { result: "not-found" };
      }

      if (isSupabaseConflictError(error)) {
        return { result: "conflict" };
      }

      throw error;
    }

    return { result: "ok", item: data as { id: string; name: string } };
  }

  async deletePermission(id: string): Promise<PermissionWriteResult> {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("permissions").delete().eq("id", id).select("id");

    if (error) {
      throw error;
    }

    return data && data.length ? "ok" : "not-found";
  }
}

export function createPermissionsRepository(): PermissionsRepository {
  return new SupabasePermissionsRepository();
}
