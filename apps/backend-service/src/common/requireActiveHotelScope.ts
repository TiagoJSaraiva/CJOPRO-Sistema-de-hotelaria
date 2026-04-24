import { ADMIN_ERROR_CODE } from "@hotel/shared";
import { adminError } from "./adminError";

type ReplyLike = {
  status: (statusCode: number) => { send: (payload: unknown) => unknown };
};

export function requireActiveHotelId(reply: ReplyLike, activeHotelId: string | null): string | null {
  if (activeHotelId) {
    return activeHotelId;
  }

  reply
    .status(400)
    .send(adminError(ADMIN_ERROR_CODE.SCOPE_NOT_ALLOWED, "Selecione um hotel ativo para operar neste modulo."));

  return null;
}
