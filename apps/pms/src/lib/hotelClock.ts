import {
  DEFAULT_DISPLAY_TIME_ZONE,
  hotelLocalInputToInstant,
} from "@hotel/shared";
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

/**
 * Fuso em que o painel mostra os instantes. Sem hotel ativo, vale o fuso padrão; se o relógio
 * falhar, devolve `null`, e as telas mostram "—" em vez de uma hora em outro fuso.
 */
export async function resolveHotelTimeZone(
  activeHotelId: string | null | undefined,
): Promise<string | null> {
  if (!activeHotelId) return DEFAULT_DISPLAY_TIME_ZONE;
  return getHotelClock()
    .then((clock) => clock.timezone)
    .catch(() => null);
}
