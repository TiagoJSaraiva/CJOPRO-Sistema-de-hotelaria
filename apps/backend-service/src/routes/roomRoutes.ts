import type { FastifyInstance } from "fastify";
import { ADMIN_ERROR_CODE, PERMISSIONS, type AdminRoomCreateInput, type AdminRoomUpdateInput, type HotelIdParams } from "@hotel/shared";
import { ensureAuthorizedWithScope } from "../auth/authorization";
import { adminError } from "../common/adminError";
import { normalizeOptionalText } from "../common/text";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import { createRoomsRepository, type RoomsRepository } from "../repositories/roomsRepository";

type RoomCreateBody = Partial<AdminRoomCreateInput>;
type RoomUpdateBody = Partial<AdminRoomUpdateInput>;

export function registerRoomRoutes(app: FastifyInstance, repository: RoomsRepository = createRoomsRepository()): void {
  app.get("/admin/rooms", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.ROOM_READ);
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const data = await repository.listRooms(activeHotelId).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!data) {
      return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao consultar quartos."));
    }

    return reply.send({ items: data });
  });

  app.post<{ Body: RoomCreateBody }>("/admin/rooms", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.ROOM_CREATE);
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const roomNumber = normalizeOptionalText(request.body?.room_number);
    const roomType = normalizeOptionalText(request.body?.room_type);
    const maxOccupancy = Number(request.body?.max_occupancy);
    const baseDailyRate = Number(request.body?.base_daily_rate);
    const status = normalizeOptionalText(request.body?.status);

    if (!roomNumber || !roomType || !Number.isFinite(maxOccupancy) || maxOccupancy <= 0 || !Number.isFinite(baseDailyRate) || baseDailyRate < 0) {
      return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Dados invalidos para criar quarto."));
    }

    const createResult = await repository
      .createRoom(activeHotelId, {
        room_number: roomNumber,
        room_type: roomType,
        max_occupancy: maxOccupancy,
        base_daily_rate: baseDailyRate,
        status: status || "available",
        notes: normalizeOptionalText(request.body?.notes)
      })
      .catch((error) => {
        request.log.error(error);
        return null;
      });

    if (!createResult) {
      return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao criar quarto."));
    }

    if (createResult.result === "conflict") {
      return reply.status(409).send(adminError(ADMIN_ERROR_CODE.CONFLICT, "Numero de quarto ja cadastrado neste hotel."));
    }

    if (!createResult.item) {
      return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao criar quarto."));
    }

    return reply.status(201).send({ item: createResult.item });
  });

  app.put<{ Params: HotelIdParams; Body: RoomUpdateBody }>("/admin/rooms/:id", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.ROOM_UPDATE);
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const id = normalizeOptionalText(request.params.id);

    if (!id) {
      return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Id do quarto e obrigatorio para atualizacao."));
    }

    const payload: Record<string, unknown> = {};

    if (request.body?.room_number !== undefined) payload.room_number = normalizeOptionalText(request.body.room_number);
    if (request.body?.room_type !== undefined) payload.room_type = normalizeOptionalText(request.body.room_type);
    if (request.body?.notes !== undefined) payload.notes = normalizeOptionalText(request.body.notes);
    if (request.body?.status !== undefined) payload.status = normalizeOptionalText(request.body.status);

    if (request.body?.max_occupancy !== undefined) {
      const maxOccupancy = Number(request.body.max_occupancy);
      if (!Number.isFinite(maxOccupancy) || maxOccupancy <= 0) {
        return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Max occupancy invalido."));
      }
      payload.max_occupancy = maxOccupancy;
    }

    if (request.body?.base_daily_rate !== undefined) {
      const baseDailyRate = Number(request.body.base_daily_rate);
      if (!Number.isFinite(baseDailyRate) || baseDailyRate < 0) {
        return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Valor de diaria invalido."));
      }
      payload.base_daily_rate = baseDailyRate;
    }

    if (!Object.keys(payload).length) {
      return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Nenhum campo informado para atualizacao."));
    }

    const updateResult = await repository.updateRoom(id, activeHotelId, payload).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!updateResult) {
      return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao atualizar quarto."));
    }

    if (updateResult.result === "not-found") {
      return reply.status(404).send(adminError(ADMIN_ERROR_CODE.NOT_FOUND, "Quarto nao encontrado neste hotel."));
    }

    if (updateResult.result === "conflict") {
      return reply.status(409).send(adminError(ADMIN_ERROR_CODE.CONFLICT, "Conflito de dados ao atualizar quarto."));
    }

    return reply.send({ item: updateResult.item });
  });

  app.delete<{ Params: HotelIdParams }>("/admin/rooms/:id", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.ROOM_DELETE);
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const id = normalizeOptionalText(request.params.id);

    if (!id) {
      return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Id do quarto e obrigatorio para exclusao."));
    }

    const result = await repository.deleteRoom(id, activeHotelId).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!result) {
      return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao excluir quarto."));
    }

    if (result === "not-found") {
      return reply.status(404).send(adminError(ADMIN_ERROR_CODE.NOT_FOUND, "Quarto nao encontrado neste hotel."));
    }

    if (result === "conflict") {
      return reply.status(409).send(adminError(ADMIN_ERROR_CODE.CONFLICT, "Quarto nao pode ser excluido: possui dependencias ativas."));
    }

    return reply.send({ ok: true });
  });
}
