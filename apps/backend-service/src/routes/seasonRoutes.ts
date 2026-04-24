import type { FastifyInstance } from "fastify";
import { ADMIN_ERROR_CODE, PERMISSIONS, type AdminSeasonCreateInput, type AdminSeasonUpdateInput, type HotelIdParams } from "@hotel/shared";
import { ensureAuthorizedWithScope } from "../auth/authorization";
import { adminError } from "../common/adminError";
import { normalizeOptionalText } from "../common/text";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import { createSeasonsRepository, type SeasonsRepository } from "../repositories/seasonsRepository";

type SeasonCreateBody = Partial<AdminSeasonCreateInput>;
type SeasonUpdateBody = Partial<AdminSeasonUpdateInput>;

export function registerSeasonRoutes(app: FastifyInstance, repository: SeasonsRepository = createSeasonsRepository()): void {
  app.get("/admin/seasons", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.SEASON_READ);
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const data = await repository.listSeasons(activeHotelId).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!data) return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao consultar temporadas."));

    return reply.send({ items: data });
  });

  app.post<{ Body: SeasonCreateBody }>("/admin/seasons", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.SEASON_CREATE);
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const name = normalizeOptionalText(request.body?.name);
    const startDate = normalizeOptionalText(request.body?.start_date);
    const endDate = normalizeOptionalText(request.body?.end_date);

    if (!name || !startDate || !endDate) {
      return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Nome, data de inicio e data de fim sao obrigatorios."));
    }

    const createResult = await repository
      .createSeason(activeHotelId, {
        name,
        start_date: startDate,
        end_date: endDate,
        is_active: request.body?.is_active === undefined ? true : !!request.body.is_active
      })
      .catch((error) => {
        request.log.error(error);
        return null;
      });

    if (!createResult) return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao criar temporada."));
    if (createResult.result === "conflict") return reply.status(409).send(adminError(ADMIN_ERROR_CODE.CONFLICT, "Conflito ao criar temporada (sobreposicao ou duplicidade)."));
    if (!createResult.item) return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao criar temporada."));

    return reply.status(201).send({ item: createResult.item });
  });

  app.put<{ Params: HotelIdParams; Body: SeasonUpdateBody }>("/admin/seasons/:id", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.SEASON_UPDATE);
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const id = normalizeOptionalText(request.params.id);
    if (!id) return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Id da temporada e obrigatorio para atualizacao."));

    const payload: Record<string, unknown> = {};
    if (request.body?.name !== undefined) payload.name = normalizeOptionalText(request.body.name);
    if (request.body?.start_date !== undefined) payload.start_date = normalizeOptionalText(request.body.start_date);
    if (request.body?.end_date !== undefined) payload.end_date = normalizeOptionalText(request.body.end_date);
    if (request.body?.is_active !== undefined) payload.is_active = !!request.body.is_active;

    if (!Object.keys(payload).length) return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Nenhum campo informado para atualizacao."));

    const updateResult = await repository.updateSeason(id, activeHotelId, payload).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!updateResult) return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao atualizar temporada."));
    if (updateResult.result === "not-found") return reply.status(404).send(adminError(ADMIN_ERROR_CODE.NOT_FOUND, "Temporada nao encontrada neste hotel."));
    if (updateResult.result === "conflict") return reply.status(409).send(adminError(ADMIN_ERROR_CODE.CONFLICT, "Conflito de dados ao atualizar temporada."));

    return reply.send({ item: updateResult.item });
  });

  app.delete<{ Params: HotelIdParams }>("/admin/seasons/:id", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.SEASON_DELETE);
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const id = normalizeOptionalText(request.params.id);
    if (!id) return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Id da temporada e obrigatorio para exclusao."));

    const result = await repository.deleteSeason(id, activeHotelId).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!result) return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao excluir temporada."));
    if (result === "not-found") return reply.status(404).send(adminError(ADMIN_ERROR_CODE.NOT_FOUND, "Temporada nao encontrada neste hotel."));
    if (result === "conflict") return reply.status(409).send(adminError(ADMIN_ERROR_CODE.CONFLICT, "Temporada nao pode ser excluida: possui dependencias ativas."));

    return reply.send({ ok: true });
  });
}
