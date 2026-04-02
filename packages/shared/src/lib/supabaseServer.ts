import { createClient } from "@supabase/supabase-js";

function getRequiredEnvVar(name: "SUPABASE_URL"): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getRequiredSupabaseAdminKey(): string {
  const value = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!value) {
    throw new Error(
      "Missing required environment variable: SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY)"
    );
  }

  return value;
}

// Uso apenas no backend-service, com chave administrativa.
export const createServerClient = () => {
  return createClient(
    getRequiredEnvVar("SUPABASE_URL"),
    getRequiredSupabaseAdminKey()
  );
};