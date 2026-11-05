import { ADMIN_ERROR_CODE, AUTH_ERROR_CODE } from "@hotel/shared";
import type { FastifyInstance } from "fastify";
import { resolveActiveHotelContext } from "../auth/activeHotel";
import { getAuthError, getSessionFromRequest } from "../auth/session";
import { adminError } from "../common/adminError";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import {
  createHotelClockRepository,
  type HotelClockRepository,
} from "../repositories/hotelClockRepository";

export function registerHotelClockRoutes(
  app: FastifyInstance,
  repository: HotelClockRepository = createHotelClockRepository(),
): void {
  // Sem permissão de domínio: fuso e data do hotel não são sensíveis e toda tela que lê ou
  // grava horários precisa deles. O hotel vem sempre do escopo validado da sessão.
  app.get("/admin/hotel-clock", async (request, reply) => {
    const session = getSessionFromRequest(request);
    if (!session) {
      return reply
        .status(401)
        .send(getAuthError(AUTH_ERROR_CODE.TOKEN_INVALID_OR_EXPIRED));
    }

    const context = resolveActiveHotelContext(session, request.headers);
    if (!context.ok) {
      return reply
        .status(context.statusCode)
        .send(adminError(ADMIN_ERROR_CODE.SCOPE_NOT_ALLOWED, context.message));
    }

    const hotelId = requireActiveHotelId(reply, context.activeHotelId);
    if (!hotelId) return;

    try {
      const clock = await repository.getClock(hotelId);
      if (!clock) {
        return reply
          .status(404)
          .send(
            adminError(ADMIN_ERROR_CODE.NOT_FOUND, "Hotel não encontrado."),
          );
      }
      return reply.send(clock);
    } catch (error) {
      request.log.error(error);
      return reply
        .status(500)
        .send(
          adminError(
            ADMIN_ERROR_CODE.INTERNAL,
            "Falha ao consultar o relógio do hotel.",
          ),
        );
    }
  });
}
