import { hotelLocalInputToInstant } from "@hotel/shared";
import { getHotelClock } from "./adminApi";

/**
 * Converte, em uma Server Action, o texto de um campo `datetime-local` em um instante. O
 * campo é digitado na hora do hotel; `new Date(texto)` usaria o fuso do servidor.
 */
export async function readHotelInstant(
  value: FormDataEntryValue | null | undefined,
): Promise<string> {
  const { timezone } = await getHotelClock();
  const instant = hotelLocalInputToInstant(String(value ?? ""), timezone);
  if (!instant) throw new Error("Data e hora inválidas.");
  return instant;
}
