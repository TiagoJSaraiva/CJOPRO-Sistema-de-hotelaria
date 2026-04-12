import { createServerClient } from "@hotel/shared";
import { isSupabaseConflictError, isSupabaseNotFoundError } from "./supabaseError";

export type UserWriteResult = "ok" | "conflict" | "not-found";

export type UserRoleLookupRow = {
  id: string;
  name: string;
  hotel_id: string | null;
  hotels?: { name: string | null } | Array<{ name: string | null }> | null;
};

export interface UsersRepository {
  listReferenceHotels(): Promise<Array<{ id: string; name: string }>>;
  listReferenceRoles(): Promise<UserRoleLookupRow[]>;
  listUsersWithRelations(): Promise<any[]>;
  findRolesByIds(roleIds: string[]): Promise<UserRoleLookupRow[]>;
  createUser(payload: { name: string; email: string; password_hash: string; is_active: boolean }): Promise<{ result: UserWriteResult; id?: string }>;
  assignUserRoles(items: Array<{ user_id: string; role_id: string }>): Promise<void>;
  getUserWithRelationsById(id: string): Promise<any | null>;
  updateUser(id: string, payload: Record<string, unknown>): Promise<UserWriteResult>;
  userExists(id: string): Promise<boolean>;
  clearUserRoles(userId: string): Promise<void>;
  deleteUser(id: string): Promise<UserWriteResult>;
}

class SupabaseUsersRepository implements UsersRepository {
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

  async listUsersWithRelations(): Promise<any[]> {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("users")
      .select("id,name,email,is_active,last_login_at,created_at,user_roles(role_id,roles(id,name,hotel_id,hotels(name)))")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  }

  async findRolesByIds(roleIds: string[]): Promise<UserRoleLookupRow[]> {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("roles").select("id,name,hotel_id,hotels(name)").in("id", roleIds);

    if (error) {
      throw error;
    }

    return (data || []) as UserRoleLookupRow[];
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

  async getUserWithRelationsById(id: string): Promise<any | null> {
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

    return data;
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
