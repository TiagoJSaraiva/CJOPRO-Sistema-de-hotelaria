import { createServerClient } from "@hotel/shared";
import { isSupabaseNotFoundError } from "./supabaseError";

export interface AuthRepository {
  findUserByEmail(email: string): Promise<any | null>;
  markSuccessfulLogin(userId: string): Promise<void>;
}

class SupabaseAuthRepository implements AuthRepository {
  async findUserByEmail(email: string): Promise<any | null> {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("users")
      .select("id,name,email,is_active,password_hash,user_roles(hotel_id,roles(id,name,hotel_id,hotels(name),role_permissions(permissions(name))))")
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
      .update({ last_login_at: new Date().toISOString(), failed_attempts: 0 })
      .eq("id", userId);

    if (error) {
      throw error;
    }
  }
}

export function createAuthRepository(): AuthRepository {
  return new SupabaseAuthRepository();
}