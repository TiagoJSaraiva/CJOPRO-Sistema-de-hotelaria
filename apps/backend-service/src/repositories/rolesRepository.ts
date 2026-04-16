import { createServerClient } from "../common/supabaseServer";
import { isSupabaseConflictError, isSupabaseForeignKeyError, isSupabaseNotFoundError } from "./supabaseError";

export type RoleWriteResult = "ok" | "conflict" | "not-found";

export type RoleWithRelationsRow = {
  id: string;
  name: string;
  role_type: "SYSTEM_ROLE" | "HOTEL_ROLE";
  hotel_id: string | null;
  hotels?: { name: string | null } | Array<{ name: string | null }> | null;
  role_permissions?:
    | Array<{
        permission_id?: string | null;
        permissions?:
          | { id?: string | null; name?: string | null; type?: "SYSTEM_PERMISSION" | "HOTEL_PERMISSION" | null }
          | Array<{ id?: string | null; name?: string | null; type?: "SYSTEM_PERMISSION" | "HOTEL_PERMISSION" | null }>
          | null;
      }>
    | null;
};

type RpcRoleWriteResultRow = {
  result?: RoleWriteResult;
  id?: string | null;
};

function normalizeRpcRoleWriteResult(data: unknown): { result: RoleWriteResult; id?: string } | null {
  const row = Array.isArray(data) ? data[0] : data;

  if (!row || typeof row !== "object") {
    return null;
  }

  const result = (row as RpcRoleWriteResultRow).result;

  if (result !== "ok" && result !== "conflict" && result !== "not-found") {
    return null;
  }

  const id = (row as RpcRoleWriteResultRow).id;

  return {
    result,
    id: typeof id === "string" ? id : undefined
  };
}

function isMissingRpcFunctionError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? String((error as { code?: unknown }).code || "") : "";
  const message = "message" in error ? String((error as { message?: unknown }).message || "").toLowerCase() : "";

  return code === "PGRST202" || code === "42883" || message.includes("function") && message.includes("does not exist");
}

function isRolePermissionsDependencyError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const message = "message" in error ? String((error as { message?: unknown }).message || "").toLowerCase() : "";
  const details = "details" in error ? String((error as { details?: unknown }).details || "").toLowerCase() : "";
  const hint = "hint" in error ? String((error as { hint?: unknown }).hint || "").toLowerCase() : "";

  return message.includes("role_permissions") || details.includes("role_permissions") || hint.includes("role_permissions");
}

export interface RolesRepository {
  listReferenceHotels(): Promise<Array<{ id: string; name: string }>>;
  listReferencePermissions(): Promise<Array<{ id: string; name: string; type: "SYSTEM_PERMISSION" | "HOTEL_PERMISSION" }>>;
  listRolesWithRelations(): Promise<RoleWithRelationsRow[]>;
  hotelExists(hotelId: string): Promise<boolean>;
  findPermissionsByIds(permissionIds: string[]): Promise<Array<{ id: string; type: "SYSTEM_PERMISSION" | "HOTEL_PERMISSION" }>>;
  createRoleWithPermissions(
    payload: { name: string; role_type: "SYSTEM_ROLE" | "HOTEL_ROLE"; hotel_id: string | null },
    permissionIds: string[]
  ): Promise<{ result: RoleWriteResult; id?: string }>;
  createRole(payload: { name: string; role_type: "SYSTEM_ROLE" | "HOTEL_ROLE"; hotel_id: string | null }): Promise<{ result: RoleWriteResult; id?: string }>;
  assignRolePermissions(items: Array<{ role_id: string; permission_id: string }>): Promise<void>;
  getRoleWithRelationsById(id: string): Promise<RoleWithRelationsRow | null>;
  updateRoleWithPermissions(id: string, payload: Record<string, unknown>, permissionIds?: string[]): Promise<RoleWriteResult>;
  updateRole(id: string, payload: Record<string, unknown>): Promise<RoleWriteResult>;
  roleExists(id: string): Promise<boolean>;
  clearRolePermissions(roleId: string): Promise<void>;
  deleteRole(id: string): Promise<RoleWriteResult>;
}

class SupabaseRolesRepository implements RolesRepository {
  private async getRolePermissionIds(roleId: string): Promise<string[]> {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("role_permissions").select("permission_id").eq("role_id", roleId);

    if (error) {
      throw error;
    }

    const rows = (data || []) as Array<{ permission_id: string | null }>;
    return rows
      .map((row) => row.permission_id)
      .filter((permissionId): permissionId is string => typeof permissionId === "string" && permissionId.length > 0);
  }

  private async createRoleWithPermissionsFallback(
    payload: { name: string; role_type: "SYSTEM_ROLE" | "HOTEL_ROLE"; hotel_id: string | null },
    permissionIds: string[]
  ): Promise<{ result: RoleWriteResult; id?: string }> {
    const createResult = await this.createRole(payload);

    if (createResult.result !== "ok" || !createResult.id) {
      return createResult;
    }

    if (!permissionIds.length) {
      return createResult;
    }

    try {
      await this.assignRolePermissions(
        permissionIds.map((permissionId) => ({ role_id: createResult.id!, permission_id: permissionId }))
      );
      return createResult;
    } catch (error) {
      await this.deleteRole(createResult.id).catch(() => undefined);
      throw error;
    }
  }

  private async updateRoleWithPermissionsFallback(
    id: string,
    payload: Record<string, unknown>,
    permissionIds?: string[]
  ): Promise<RoleWriteResult> {
    if (Object.keys(payload).length) {
      const updateResult = await this.updateRole(id, payload);

      if (updateResult !== "ok") {
        return updateResult;
      }
    } else if (permissionIds !== undefined) {
      const exists = await this.roleExists(id);

      if (!exists) {
        return "not-found";
      }
    }

    if (permissionIds === undefined) {
      return "ok";
    }

    const previousPermissionIds = await this.getRolePermissionIds(id);
    await this.clearRolePermissions(id);

    try {
      if (permissionIds.length) {
        await this.assignRolePermissions(
          permissionIds.map((permissionId) => ({ role_id: id, permission_id: permissionId }))
        );
      }
    } catch (error) {
      await this.clearRolePermissions(id).catch(() => undefined);

      if (previousPermissionIds.length) {
        await this.assignRolePermissions(
          previousPermissionIds.map((permissionId) => ({ role_id: id, permission_id: permissionId }))
        ).catch(() => undefined);
      }

      throw error;
    }

    return "ok";
  }

  async listReferenceHotels(): Promise<Array<{ id: string; name: string }>> {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("hotels").select("id,name").order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []) as Array<{ id: string; name: string }>;
  }

  async listReferencePermissions(): Promise<Array<{ id: string; name: string; type: "SYSTEM_PERMISSION" | "HOTEL_PERMISSION" }>> {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("permissions").select("id,name,type").order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []) as Array<{ id: string; name: string; type: "SYSTEM_PERMISSION" | "HOTEL_PERMISSION" }>;
  }

  async listRolesWithRelations(): Promise<RoleWithRelationsRow[]> {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("roles")
      .select("id,name,role_type,hotel_id,hotels(name),role_permissions(permission_id,permissions(id,name,type))")
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []) as RoleWithRelationsRow[];
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

  async findPermissionsByIds(permissionIds: string[]): Promise<Array<{ id: string; type: "SYSTEM_PERMISSION" | "HOTEL_PERMISSION" }>> {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("permissions").select("id,type").in("id", permissionIds);

    if (error) {
      throw error;
    }

    return (data || []) as Array<{ id: string; type: "SYSTEM_PERMISSION" | "HOTEL_PERMISSION" }>;
  }

  async createRoleWithPermissions(
    payload: { name: string; role_type: "SYSTEM_ROLE" | "HOTEL_ROLE"; hotel_id: string | null },
    permissionIds: string[]
  ): Promise<{ result: RoleWriteResult; id?: string }> {
    const supabase = createServerClient();
    const { data, error } = await supabase.rpc("create_role_with_permissions", {
      p_name: payload.name,
      p_role_type: payload.role_type,
      p_hotel_id: payload.hotel_id,
      p_permission_ids: permissionIds
    });

    if (!error) {
      const normalized = normalizeRpcRoleWriteResult(data);

      if (normalized) {
        return normalized;
      }
    }

    if (error) {
      if (isSupabaseConflictError(error)) {
        return { result: "conflict" };
      }

      if (!isMissingRpcFunctionError(error)) {
        throw error;
      }
    }

    return this.createRoleWithPermissionsFallback(payload, permissionIds);
  }

  async createRole(payload: { name: string; role_type: "SYSTEM_ROLE" | "HOTEL_ROLE"; hotel_id: string | null }): Promise<{ result: RoleWriteResult; id?: string }> {
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

  async getRoleWithRelationsById(id: string): Promise<RoleWithRelationsRow | null> {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("roles")
      .select("id,name,role_type,hotel_id,hotels(name),role_permissions(permission_id,permissions(id,name,type))")
      .eq("id", id)
      .single();

    if (error) {
      if (isSupabaseNotFoundError(error)) {
        return null;
      }

      throw error;
    }

    return data as RoleWithRelationsRow;
  }

  async updateRoleWithPermissions(
    id: string,
    payload: Record<string, unknown>,
    permissionIds?: string[]
  ): Promise<RoleWriteResult> {
    const supabase = createServerClient();
    const { data, error } = await supabase.rpc("update_role_with_permissions", {
      p_id: id,
      p_payload: payload,
      p_permission_ids: permissionIds ?? null,
      p_should_replace_permissions: permissionIds !== undefined
    });

    if (!error) {
      const normalized = normalizeRpcRoleWriteResult(data);

      if (normalized) {
        return normalized.result;
      }
    }

    if (error) {
      if (isSupabaseConflictError(error)) {
        return "conflict";
      }

      if (isSupabaseNotFoundError(error)) {
        return "not-found";
      }

      if (!isMissingRpcFunctionError(error)) {
        throw error;
      }
    }

    return this.updateRoleWithPermissionsFallback(id, payload, permissionIds);
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

    if (!error) {
      return data && data.length ? "ok" : "not-found";
    }

    if (!(isSupabaseForeignKeyError(error) || isSupabaseConflictError(error))) {
      throw error;
    }

    if (!isRolePermissionsDependencyError(error)) {
      return "conflict";
    }

    await this.clearRolePermissions(id);

    const retryResult = await supabase.from("roles").delete().eq("id", id).select("id");

    if (retryResult.error) {
      if (isSupabaseForeignKeyError(retryResult.error) || isSupabaseConflictError(retryResult.error)) {
        return "conflict";
      }

      throw retryResult.error;
    }

    return retryResult.data && retryResult.data.length ? "ok" : "not-found";
  }
}

export function createRolesRepository(): RolesRepository {
  return new SupabaseRolesRepository();
}
