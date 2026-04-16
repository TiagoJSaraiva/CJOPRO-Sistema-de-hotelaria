import { createServerClient } from "../common/supabaseServer";
import { isSupabaseNotFoundError } from "./supabaseError";

export type AuthUserRolePermissionRow = {
  permissions?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

export type AuthUserRoleRow = {
  id?: string | null;
  name?: string | null;
  role_type?: "SYSTEM_ROLE" | "HOTEL_ROLE" | null;
  hotel_id?: string | null;
  hotels?: { name?: string | null } | Array<{ name?: string | null }> | null;
  role_permissions?: AuthUserRolePermissionRow[] | null;
};

export type AuthUserRoleAssignmentRow = {
  hotel_id?: string | null;
  hotels?: { name?: string | null } | Array<{ name?: string | null }> | null;
  roles?: AuthUserRoleRow | AuthUserRoleRow[] | null;
};

export type AuthUserRow = {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  password_hash: string | null;
  failed_attempts: number | null;
  locked_until: string | null;
  user_roles?: AuthUserRoleAssignmentRow[];
};

export interface AuthRepository {
  findUserByEmail(email: string): Promise<AuthUserRow | null>;
  markSuccessfulLogin(userId: string): Promise<void>;
  markFailedLoginAttempt(userId: string, failedAttempts: number, lockedUntilIso: string | null): Promise<void>;
  clearExpiredLoginLock(userId: string): Promise<void>;
}

class SupabaseAuthRepository implements AuthRepository {
  async findUserByEmail(email: string): Promise<AuthUserRow | null> {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("users")
      .select(
        "id,name,email,is_active,password_hash,failed_attempts,locked_until,user_roles(hotel_id,hotels(name),roles(id,name,role_type,hotel_id,hotels(name),role_permissions(permissions(name))))"
      )
      .eq("email", email)
      .single();

    if (error) {
      if (isSupabaseNotFoundError(error)) {
        return null;
      }

      throw error;
    }

    return data;
  }

  async markSuccessfulLogin(userId: string): Promise<void> {
    const supabase = createServerClient();
    const { error } = await supabase
      .from("users")
      .update({ last_login_at: new Date().toISOString(), failed_attempts: 0, locked_until: null })
      .eq("id", userId);

    if (error) {
      throw error;
    }
  }

  async markFailedLoginAttempt(userId: string, failedAttempts: number, lockedUntilIso: string | null): Promise<void> {
    const supabase = createServerClient();
    const { error } = await supabase
      .from("users")
      .update({ failed_attempts: failedAttempts, locked_until: lockedUntilIso })
      .eq("id", userId);

    if (error) {
      throw error;
    }
  }

  async clearExpiredLoginLock(userId: string): Promise<void> {
    const supabase = createServerClient();
    const { error } = await supabase.from("users").update({ failed_attempts: 0, locked_until: null }).eq("id", userId);

    if (error) {
      throw error;
    }
  }
}

export function createAuthRepository(): AuthRepository {
  return new SupabaseAuthRepository();
}