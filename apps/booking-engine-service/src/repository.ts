import { createClient } from "@supabase/supabase-js";

export type BookingRepository = {
  call(name: string, params: Record<string, unknown>): Promise<unknown>;
};

export function createBookingRepository(): BookingRepository {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.",
    );
  }
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    async call(name, params) {
      const { data, error } = await client.rpc(name, params);
      if (error) throw error;
      return data;
    },
  };
}
