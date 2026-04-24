import type { FastifyInstance } from "fastify";
import {
  ADMIN_ERROR_CODE,
  PERMISSIONS,
  type AdminSeasonRoomRateCreateInput,
  type AdminSeasonRoomRateUpdateInput,
  type HotelIdParams
} from "@hotel/shared";
import { ensureAuthorizedWithScope } from "../auth/authorization";
import { adminError } from "../common/adminError";
import { normalizeOptionalText } from "../common/text";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import { createSeasonRoomRatesRepository, type SeasonRoomRatesRepository } from "../repositories/seasonRoomRatesRepository";

type SeasonRoomRateCreateBody = Partial<AdminSeasonRoomRateCreateInput>;
type SeasonRoomRateUpdateBody = Partial<AdminSeasonRoomRateUpdateInput>;

export function registerSeasonRoomRateRoutes(
  app: FastifyInstance,
  repository: SeasonRoomRatesRepository = createSeasonRoomRatesRepository()
): void {
  app.get("/admin/season-room-rates", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.SEASON_ROOM_RATE_READ);
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const data = await repository.listSeasonRoomRates(activeHotelId).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!data) return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao consultar tarifas por temporada."));

    return reply.send({ items: data });
  });

  app.post<{ Body: SeasonRoomRateCreateBody }>("/admin/season-room-rates", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.SEASON_ROOM_RATE_CREATE);
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const seasonId = normalizeOptionalText(request.body?.season_id);
    const roomType = normalizeOptionalText(request.body?.room_type);
    const dailyRate = Number(request.body?.daily_rate);

    if (!seasonId || !roomType || !Number.isFinite(dailyRate) || dailyRate < 0) {
      return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Season, room type e daily rate valido sao obrigatorios."));
    }

    const createResult = await repository
      .createSeasonRoomRate(activeHotelId, {
        season_id: seasonId,
        room_type: roomType,
        daily_rate: dailyRate
      })
      .catch((error) => {
        request.log.error(error);
        return null;
      });

    if (!createResult) return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao criar tarifa por temporada."));
    if (createResult.result === "conflict") return reply.status(409).send(adminError(ADMIN_ERROR_CODE.CONFLICT, "Conflito ao criar tarifa por temporada."));
    if (!createResult.item) return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao criar tarifa por temporada."));

    return reply.status(201).send({ item: createResult.item });
  });

  app.put<{ Params: HotelIdParams; Body: SeasonRoomRateUpdateBody }>("/admin/season-room-rates/:id", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.SEASON_ROOM_RATE_UPDATE);
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const id = normalizeOptionalText(request.params.id);
    if (!id) return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Id da tarifa por temporada e obrigatorio para atualizacao."));

    const payload: Record<string, unknown> = {};
    if (request.body?.season_id !== undefined) payload.season_id = normalizeOptionalText(request.body.season_id);
    if (request.body?.room_type !== undefined) payload.room_type = normalizeOptionalText(request.body.room_type);
    if (request.body?.daily_rate !== undefined) payload.daily_rate = Number(request.body.daily_rate);

    if (!Object.keys(payload).length) return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Nenhum campo informado para atualizacao."));

    const updateResult = await repository.updateSeasonRoomRate(id, activeHotelId, payload).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!updateResult) return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao atualizar tarifa por temporada."));
    if (updateResult.result === "not-found") return reply.status(404).send(adminError(ADMIN_ERROR_CODE.NOT_FOUND, "Tarifa por temporada nao encontrada neste hotel."));
    if (updateResult.result === "conflict") return reply.status(409).send(adminError(ADMIN_ERROR_CODE.CONFLICT, "Conflito de dados ao atualizar tarifa por temporada."));

    return reply.send({ item: updateResult.item });
  });

  app.delete<{ Params: HotelIdParams }>("/admin/season-room-rates/:id", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.SEASON_ROOM_RATE_DELETE);
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const id = normalizeOptionalText(request.params.id);
    if (!id) return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Id da tarifa por temporada e obrigatorio para exclusao."));

    const result = await repository.deleteSeasonRoomRate(id, activeHotelId).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!result) return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao excluir tarifa por temporada."));
    if (result === "not-found") return reply.status(404).send(adminError(ADMIN_ERROR_CODE.NOT_FOUND, "Tarifa por temporada nao encontrada neste hotel."));
    if (result === "conflict") return reply.status(409).send(adminError(ADMIN_ERROR_CODE.CONFLICT, "Tarifa por temporada nao pode ser excluida: possui dependencias ativas."));

    return reply.send({ ok: true });
  });
}
