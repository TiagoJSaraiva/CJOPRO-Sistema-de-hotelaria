import { createServerClient } from "@hotel/shared";
import { isSupabaseConflictError, isSupabaseNotFoundError } from "./supabaseError";

export type UserWriteResult = "ok" | "conflict" | "not-found";

export type UserRoleLookupRow = {
  id: string;
  name: string;
  hotel_id: string | null;
  hotels?: { name: string | null } | Array<{ name: string | null }> | null;
};

export type UserRoleRelationRow = {
  role_id?: string | null;
  roles?:
    | {
        id?: string | null;
        name?: string | null;
        hotel_id?: string | null;
        hotels?: { name: string | null } | Array<{ name: string | null }> | null;
      }
    | Array<{
        id?: string | null;
        name?: string | null;
        hotel_id?: string | null;
        hotels?: { name: string | null } | Array<{ name: string | null }> | null;
      }>
    | null;
};

export type UserWithRelationsRow = {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string | null;
  user_roles?: UserRoleRelationRow[] | null;
};

type RpcUserWriteResultRow = {
  result?: UserWriteResult;
  id?: string | null;
};

function normalizeRpcUserWriteResult(data: unknown): { result: UserWriteResult; id?: string } | null {
  const row = Array.isArray(data) ? data[0] : data;

  if (!row || typeof row !== "object") {
    return null;
  }

  const result = (row as RpcUserWriteResultRow).result;

  if (result !== "ok" && result !== "conflict" && result !== "not-found") {
    return null;
  }

  const id = (row as RpcUserWriteResultRow).id;

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

export interface UsersRepository {
  listReferenceHotels(): Promise<Array<{ id: string; name: string }>>;
  listReferenceRoles(): Promise<UserRoleLookupRow[]>;
  listUsersWithRelations(): Promise<UserWithRelationsRow[]>;
  findRolesByIds(roleIds: string[]): Promise<UserRoleLookupRow[]>;
  createUserWithRoles(payload: { name: string; email: string; password_hash: string; is_active: boolean }, roleIds: string[]): Promise<{ result: UserWriteResult; id?: string }>;
  createUser(payload: { name: string; email: string; password_hash: string; is_active: boolean }): Promise<{ result: UserWriteResult; id?: string }>;
  assignUserRoles(items: Array<{ user_id: string; role_id: string }>): Promise<void>;
  getUserWithRelationsById(id: string): Promise<UserWithRelationsRow | null>;
  updateUserWithRoles(id: string, payload: Record<string, unknown>, roleIds?: string[]): Promise<UserWriteResult>;
  updateUser(id: string, payload: Record<string, unknown>): Promise<UserWriteResult>;
  userExists(id: string): Promise<boolean>;
  clearUserRoles(userId: string): Promise<void>;
  deleteUser(id: string): Promise<UserWriteResult>;
}

class SupabaseUsersRepository implements UsersRepository {
  private async getUserRoleIds(userId: string): Promise<string[]> {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("user_roles").select("role_id").eq("user_id", userId);

    if (error) {
      throw error;
    }

    const rows = (data || []) as Array<{ role_id: string | null }>;
    return rows.map((row) => row.role_id).filter((roleId): roleId is string => typeof roleId === "string" && roleId.length > 0);
  }

  private async createUserWithRolesFallback(
    payload: { name: string; email: string; password_hash: string; is_active: boolean },
    roleIds: string[]
  ): Promise<{ result: UserWriteResult; id?: string }> {
    const createResult = await this.createUser(payload);

    if (createResult.result !== "ok" || !createResult.id) {
      return createResult;
    }

    if (!roleIds.length) {
      return createResult;
    }

    try {
      await this.assignUserRoles(roleIds.map((roleId) => ({ user_id: createResult.id!, role_id: roleId })));
      return createResult;
    } catch (error) {
      await this.deleteUser(createResult.id).catch(() => undefined);
      throw error;
    }
  }

  private async updateUserWithRolesFallback(
    id: string,
    payload: Record<string, unknown>,
    roleIds?: string[]
  ): Promise<UserWriteResult> {
    if (Object.keys(payload).length) {
      const updateResult = await this.updateUser(id, payload);

      if (updateResult !== "ok") {
        return updateResult;
      }
    } else if (roleIds !== undefined) {
      const exists = await this.userExists(id);

      if (!exists) {
        return "not-found";
      }
    }

    if (roleIds === undefined) {
      return "ok";
    }

    const previousRoleIds = await this.getUserRoleIds(id);
    await this.clearUserRoles(id);

    try {
      if (roleIds.length) {
        await this.assignUserRoles(roleIds.map((roleId) => ({ user_id: id, role_id: roleId })));
      }
    } catch (error) {
      await this.clearUserRoles(id).catch(() => undefined);

      if (previousRoleIds.length) {
        await this.assignUserRoles(previousRoleIds.map((roleId) => ({ user_id: id, role_id: roleId }))).catch(() => undefined);
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

  async listReferenceRoles(): Promise<UserRoleLookupRow[]> {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("roles").select("id,name,hotel_id,hotels(name)").order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []) as UserRoleLookupRow[];
  }

  async listUsersWithRelations(): Promise<UserWithRelationsRow[]> {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("users")
      .select("id,name,email,is_active,last_login_at,created_at,user_roles(role_id,roles(id,name,hotel_id,hotels(name)))")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []) as UserWithRelationsRow[];
  }

  async findRolesByIds(roleIds: string[]): Promise<UserRoleLookupRow[]> {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("roles").select("id,name,hotel_id,hotels(name)").in("id", roleIds);

    if (error) {
      throw error;
    }

    return (data || []) as UserRoleLookupRow[];
  }

  async createUserWithRoles(
    payload: { name: string; email: string; password_hash: string; is_active: boolean },
    roleIds: string[]
  ): Promise<{ result: UserWriteResult; id?: string }> {
    const supabase = createServerClient();
    const { data, error } = await supabase.rpc("create_user_with_roles", {
      p_name: payload.name,
      p_email: payload.email,
      p_password_hash: payload.password_hash,
      p_is_active: payload.is_active,
      p_role_ids: roleIds
    });

    if (!error) {
      const normalized = normalizeRpcUserWriteResult(data);

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

    return this.createUserWithRolesFallback(payload, roleIds);
  }

  async createUser(payload: { name: string; email: string; password_hash: string; is_active: boolean }): Promise<{ result: UserWriteResult; id?: string }> {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("users").insert(payload).select("id").single();

    if (error) {
      if (isSupabaseConflictError(error)) {
        return { result: "conflict" };
      }

      throw error;
    }

    return { result: "ok", id: data.id };
  }

  async assignUserRoles(items: Array<{ user_id: string; role_id: string }>): Promise<void> {
    const supabase = createServerClient();
    const { error } = await supabase.from("user_roles").insert(items);

    if (error) {
      throw error;
    }
  }

  async getUserWithRelationsById(id: string): Promise<UserWithRelationsRow | null> {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("users")
      .select("id,name,email,is_active,last_login_at,created_at,user_roles(role_id,roles(id,name,hotel_id,hotels(name)))")
      .eq("id", id)
      .single();

    if (error) {
      if (isSupabaseNotFoundError(error)) {
        return null;
      }

      throw error;
    }

    return data as UserWithRelationsRow;
  }

  async updateUserWithRoles(id: string, payload: Record<string, unknown>, roleIds?: string[]): Promise<UserWriteResult> {
    const supabase = createServerClient();
    const { data, error } = await supabase.rpc("update_user_with_roles", {
      p_id: id,
      p_payload: payload,
      p_role_ids: roleIds ?? null,
      p_should_replace_roles: roleIds !== undefined
    });

    if (!error) {
      const normalized = normalizeRpcUserWriteResult(data);

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

    return this.updateUserWithRolesFallback(id, payload, roleIds);
  }

  async updateUser(id: string, payload: Record<string, unknown>): Promise<UserWriteResult> {
    const supabase = createServerClient();
    const { error } = await supabase.from("users").update(payload).eq("id", id);

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

  async userExists(id: string): Promise<boolean> {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("users").select("id").eq("id", id).single();

    if (error) {
      if (isSupabaseNotFoundError(error)) {
        return false;
      }

      throw error;
    }

    return !!data;
  }

  async clearUserRoles(userId: string): Promise<void> {
    const supabase = createServerClient();
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId);

    if (error) {
      throw error;
    }
  }

  async deleteUser(id: string): Promise<UserWriteResult> {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("users").delete().eq("id", id).select("id");

    if (error) {
      throw error;
    }

    return data && data.length ? "ok" : "not-found";
  }
}

export function createUsersRepository(): UsersRepository {
  return new SupabaseUsersRepository();
}
