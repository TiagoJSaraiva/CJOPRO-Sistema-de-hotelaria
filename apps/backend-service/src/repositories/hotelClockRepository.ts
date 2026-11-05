import type { HotelClock } from "@hotel/shared";
import { createServerClient } from "../common/supabaseServer";

export interface HotelClockRepository {
  getClock(hotelId: string): Promise<HotelClock | null>;
}

export function createHotelClockRepository(): HotelClockRepository {
  return {
    async getClock(hotelId) {
      const client = createServerClient();
      const [hotel, operationalDate, operationalNow] = await Promise.all([
        client
          .from("hotels")
          .select("timezone")
          .eq("id", hotelId)
          .maybeSingle(),
        client.rpc("hotel_operational_date", { p_hotel_id: hotelId }),
        client.rpc("hotel_operational_now", { p_hotel_id: hotelId }),
      ]);
      const error =
        hotel.error || operationalDate.error || operationalNow.error;
      if (error) throw error;
      if (!hotel.data || !operationalDate.data || !operationalNow.data) {
        return null;
      }
      return {
        timezone: hotel.data.timezone,
        operational_date: String(operationalDate.data),
        // O corpo de data-hora precisa sair em formato único para o contrato.
        operational_now: new Date(String(operationalNow.data)).toISOString(),
      };
    },
  };
}
