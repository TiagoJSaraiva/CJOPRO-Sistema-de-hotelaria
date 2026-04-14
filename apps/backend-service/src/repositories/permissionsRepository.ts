import { createServerClient } from "@hotel/shared";
import { isSupabaseConflictError, isSupabaseNotFoundError } from "./supabaseError";

export type PermissionWriteResult = "ok" | "conflict" | "not-found";

type PermissionRow = {
  id: string;
  name: string;
  type: "SYSTEM_PERMISSION" | "HOTEL_PERMISSION";
};

export interface PermissionsRepository {
  listPermissions(): Promise<PermissionRow[]>;
  createPermission(payload: { name: string; type: "SYSTEM_PERMISSION" | "HOTEL_PERMISSION" }): Promise<{ result: PermissionWriteResult; item?: PermissionRow }>;
  updatePermission(
    id: string,
    payload: { name?: string; type?: "SYSTEM_PERMISSION" | "HOTEL_PERMISSION" }
  ): Promise<{ result: PermissionWriteResult; item?: PermissionRow }>;
  deletePermission(id: string): Promise<PermissionWriteResult>;
}

class SupabasePermissionsRepository implements PermissionsRepository {
  async listPermissions(): Promise<PermissionRow[]> {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("permissions").select("id,name,type").order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []) as PermissionRow[];
  }

  async createPermission(payload: { name: string; type: "SYSTEM_PERMISSION" | "HOTEL_PERMISSION" }): Promise<{ result: PermissionWriteResult; item?: PermissionRow }> {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("permissions").insert(payload).select("id,name,type").single();

    if (error) {
      if (isSupabaseConflictError(error)) {
        return { result: "conflict" };
      }

      throw error;
    }

    return { result: "ok", item: data as PermissionRow };
  }

  async updatePermission(
    id: string,
    payload: { name?: string; type?: "SYSTEM_PERMISSION" | "HOTEL_PERMISSION" }
  ): Promise<{ result: PermissionWriteResult; item?: PermissionRow }> {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("permissions").update(payload).eq("id", id).select("id,name,type").single();

    if (error) {
      if (isSupabaseNotFoundError(error)) {
        return { result: "not-found" };
      }

      if (isSupabaseConflictError(error)) {
        return { result: "conflict" };
      }

      throw error;
    }

    return { result: "ok", item: data as PermissionRow };
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
