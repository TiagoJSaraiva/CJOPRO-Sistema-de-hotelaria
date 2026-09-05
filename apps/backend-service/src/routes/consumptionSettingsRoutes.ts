import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  ADMIN_ERROR_CODE,
  PERMISSIONS,
  type AdminConsumptionBillingPolicy,
  type AdminConsumptionOfferBatchInput,
  type AdminConsumptionOfferPolicyInput,
  type AdminConsumptionOfferUpdateInput,
  type AdminConsumptionPointInput,
  type AdminErrorCode,
  type ConsumptionBillingMode,
  type HotelIdParams,
  type PermissionName,
} from "@hotel/shared";
import { ensureAuthorizedWithScope } from "../auth/authorization";
import { adminError } from "../common/adminError";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import { normalizeOptionalText } from "../common/text";
import {
  createConsumptionSettingsRepository,
  type ConsumptionSettingsRepository,
} from "../repositories/consumptionSettingsRepository";

type ListQuery = {
  include_archived?: boolean | string;
  point_id?: string;
  product_id?: string;
};
type PointBody = Partial<AdminConsumptionPointInput>;
type OfferBatchBody = Partial<AdminConsumptionOfferBatchInput>;
type ReorderBody = { ids?: string[] };

function sendError(
  reply: FastifyReply,
  status: number,
  code: AdminErrorCode,
  message: string,
) {
  return reply.status(status).send(adminError(code, message));
}

function scope(
  request: FastifyRequest,
  reply: FastifyReply,
  permission: PermissionName,
) {
  const auth = ensureAuthorizedWithScope(request, reply, permission);
  if (!auth) return null;
  const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
  return hotelId ? { auth, hotelId } : null;
}

function includeArchived(query: ListQuery) {
  return query.include_archived === true || query.include_archived === "true";
}

function billingPolicy(
  value: unknown,
  allowPartnerDirect = false,
): AdminConsumptionBillingPolicy | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<AdminConsumptionBillingPolicy>;
  const modes = Array.isArray(candidate.allowed_modes)
    ? candidate.allowed_modes
    : [];
  const validModes: ConsumptionBillingMode[] = [
    "hotel_immediate",
    "stay_folio",
    ...(allowPartnerDirect ? (["partner_direct"] as const) : []),
  ];
  if (
    modes.length === 0 ||
    new Set(modes).size !== modes.length ||
    modes.some((mode) => !validModes.includes(mode)) ||
    !candidate.default_mode ||
    !modes.includes(candidate.default_mode)
  )
    return null;
  return { allowed_modes: modes, default_mode: candidate.default_mode };
}

function offerPolicy(value: unknown): AdminConsumptionOfferPolicyInput | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<AdminConsumptionOfferPolicyInput>;
  if (candidate.source === "inherit") return { source: "inherit" };
  if (candidate.source !== "override") return null;
  const parsed = billingPolicy(candidate, true);
  return parsed ? { source: "override", ...parsed } : null;
}

function pointPayload(body: PointBody, partial = false) {
  const payload: Partial<AdminConsumptionPointInput> = {};
  if (!partial || body.name !== undefined) {
    const name = normalizeOptionalText(body.name);
    if (!name) return null;
    payload.name = name;
  }
  if (body.internal_code !== undefined)
    payload.internal_code = normalizeOptionalText(body.internal_code);
  if (body.description !== undefined)
    payload.description = normalizeOptionalText(body.description);
  if (body.display_order !== undefined) {
    const order = Number(body.display_order);
    if (!Number.isInteger(order) || order < 0) return null;
    payload.display_order = order;
  }
  if (body.is_active !== undefined) payload.is_active = Boolean(body.is_active);
  if (!partial || body.default_policy !== undefined) {
    const policy = billingPolicy(body.default_policy);
    if (!policy) return null;
    payload.default_policy = policy;
  }
  if (body.default_inventory_location_id !== undefined)
    payload.default_inventory_location_id =
      normalizeOptionalText(body.default_inventory_location_id) || null;
  return payload;
}

function ids(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const normalized = value
    .map((item) => normalizeOptionalText(item))
    .filter((item): item is string => Boolean(item));
  return normalized.length === value.length &&
    new Set(normalized).size === normalized.length
    ? normalized
    : null;
}

function idParam(request: FastifyRequest<{ Params: HotelIdParams }>) {
  return normalizeOptionalText(request.params.id);
}

export function registerConsumptionSettingsRoutes(
  app: FastifyInstance,
  repository: ConsumptionSettingsRepository = createConsumptionSettingsRepository(),
): void {
  app.get<{ Querystring: ListQuery }>(
    "/admin/consumption-points",
    async (request, reply) => {
      const context = scope(request, reply, PERMISSIONS.CONSUMPTION_READ);
      if (!context) return;
      try {
        return reply.send({
          items: await repository.listPoints(
            context.hotelId,
            includeArchived(request.query),
          ),
        });
      } catch (cause) {
        request.log.error(cause);
        return sendError(
          reply,
          500,
          ADMIN_ERROR_CODE.INTERNAL,
          "Falha ao consultar pontos de consumo.",
        );
      }
    },
  );

  app.post<{ Body: PointBody }>(
    "/admin/consumption-points",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.CONSUMPTION_SETTINGS_MANAGE,
      );
      if (!context) return;
      const payload = pointPayload(request.body || {});
      if (!payload?.name || !payload.default_policy)
        return sendError(
          reply,
          400,
          ADMIN_ERROR_CODE.VALIDATION,
          "Dados do ponto de consumo inválidos.",
        );
      try {
        const result = await repository.createPoint(
          context.hotelId,
          context.auth.session.id,
          payload as AdminConsumptionPointInput,
        );
        if (result.result === "conflict")
          return sendError(
            reply,
            409,
            ADMIN_ERROR_CODE.CONFLICT,
            "Nome ou código já está em uso neste hotel.",
          );
        return reply.status(201).send({ item: result.item });
      } catch (cause) {
        request.log.error(cause);
        return sendError(
          reply,
          500,
          ADMIN_ERROR_CODE.INTERNAL,
          "Falha ao criar ponto de consumo.",
        );
      }
    },
  );

  app.put<{ Body: ReorderBody }>(
    "/admin/consumption-points/order",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.CONSUMPTION_SETTINGS_MANAGE,
      );
      if (!context) return;
      const orderedIds = ids(request.body?.ids);
      if (!orderedIds)
        return sendError(
          reply,
          400,
          ADMIN_ERROR_CODE.VALIDATION,
          "Ordem de pontos inválida.",
        );
      const result = await repository.reorderPoints(
        context.hotelId,
        context.auth.session.id,
        orderedIds,
      );
      return result === "ok"
        ? reply.send({ ok: true })
        : sendError(
            reply,
            409,
            ADMIN_ERROR_CODE.CONFLICT,
            "A lista deve conter todos os pontos não arquivados uma única vez.",
          );
    },
  );

  app.put<{ Params: HotelIdParams; Body: PointBody }>(
    "/admin/consumption-points/:id",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.CONSUMPTION_SETTINGS_MANAGE,
      );
      if (!context) return;
      const id = idParam(request);
      const payload = pointPayload(request.body || {}, true);
      if (!id || !payload || Object.keys(payload).length === 0)
        return sendError(
          reply,
          400,
          ADMIN_ERROR_CODE.VALIDATION,
          "Dados do ponto de consumo inválidos.",
        );
      const result = await repository.updatePoint(
        id,
        context.hotelId,
        context.auth.session.id,
        payload,
      );
      if (result.result === "not-found")
        return sendError(
          reply,
          404,
          ADMIN_ERROR_CODE.NOT_FOUND,
          "Ponto não encontrado no hotel ativo.",
        );
      if (result.result === "conflict")
        return sendError(
          reply,
          409,
          ADMIN_ERROR_CODE.CONFLICT,
          "Nome, código ou política em conflito.",
        );
      return reply.send({ item: result.item });
    },
  );

  for (const [action, archived] of [
    ["archive", true],
    ["restore", false],
  ] as const) {
    app.post<{ Params: HotelIdParams }>(
      `/admin/consumption-points/:id/${action}`,
      async (request, reply) => {
        const context = scope(
          request,
          reply,
          PERMISSIONS.CONSUMPTION_SETTINGS_MANAGE,
        );
        if (!context) return;
        const id = idParam(request);
        if (!id)
          return sendError(
            reply,
            400,
            ADMIN_ERROR_CODE.VALIDATION,
            "Identificador inválido.",
          );
        const result = await repository.setPointArchived(
          id,
          context.hotelId,
          context.auth.session.id,
          archived,
        );
        if (result.result === "not-found")
          return sendError(
            reply,
            404,
            ADMIN_ERROR_CODE.NOT_FOUND,
            "Ponto não encontrado no hotel ativo.",
          );
        return reply.send({ item: result.item });
      },
    );
  }

  app.get<{ Params: HotelIdParams }>(
    "/admin/consumption-points/:id/history",
    async (request, reply) => {
      const context = scope(request, reply, PERMISSIONS.CONSUMPTION_READ);
      if (!context) return;
      const id = idParam(request);
      if (!id)
        return sendError(
          reply,
          400,
          ADMIN_ERROR_CODE.VALIDATION,
          "Identificador inválido.",
        );
      return reply.send({
        items: await repository.listHistory(
          "consumption_point",
          id,
          context.hotelId,
        ),
      });
    },
  );

  app.get<{ Querystring: ListQuery }>(
    "/admin/consumption-offers",
    async (request, reply) => {
      const context = scope(request, reply, PERMISSIONS.CONSUMPTION_READ);
      if (!context) return;
      return reply.send({
        items: await repository.listOffers(context.hotelId, {
          includeArchived: includeArchived(request.query),
          pointId: normalizeOptionalText(request.query.point_id) || undefined,
          productId:
            normalizeOptionalText(request.query.product_id) || undefined,
        }),
      });
    },
  );

  app.post<{ Params: HotelIdParams; Body: OfferBatchBody }>(
    "/admin/consumption-points/:id/offers",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.CONSUMPTION_SETTINGS_MANAGE,
      );
      if (!context) return;
      const pointId = idParam(request);
      const productIds = ids(request.body?.product_ids);
      const policy = offerPolicy(request.body?.policy);
      if (!pointId || !productIds?.length || !policy)
        return sendError(
          reply,
          400,
          ADMIN_ERROR_CODE.VALIDATION,
          "Dados das ofertas inválidos.",
        );
      const result = await repository.createOffers(
        pointId,
        context.hotelId,
        context.auth.session.id,
        {
          product_ids: productIds,
          policy,
          commercial_agreement_id:
            normalizeOptionalText(request.body?.commercial_agreement_id) ||
            null,
          inventory_location_id:
            normalizeOptionalText(request.body?.inventory_location_id) || null,
        },
      );
      if (result.result === "not-found")
        return sendError(
          reply,
          404,
          ADMIN_ERROR_CODE.NOT_FOUND,
          "Ponto não encontrado no hotel ativo.",
        );
      if (result.result === "conflict")
        return sendError(
          reply,
          409,
          ADMIN_ERROR_CODE.CONFLICT,
          "Produto duplicado, arquivado ou fora do hotel ativo.",
        );
      return reply.status(201).send({ items: result.items });
    },
  );

  app.put<{ Params: HotelIdParams; Body: ReorderBody }>(
    "/admin/consumption-points/:id/offers/order",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.CONSUMPTION_SETTINGS_MANAGE,
      );
      if (!context) return;
      const pointId = idParam(request);
      const orderedIds = ids(request.body?.ids);
      if (!pointId || !orderedIds)
        return sendError(
          reply,
          400,
          ADMIN_ERROR_CODE.VALIDATION,
          "Ordem de ofertas inválida.",
        );
      const result = await repository.reorderOffers(
        pointId,
        context.hotelId,
        context.auth.session.id,
        orderedIds,
      );
      return result === "ok"
        ? reply.send({ ok: true })
        : sendError(
            reply,
            409,
            ADMIN_ERROR_CODE.CONFLICT,
            "A lista deve conter todas as ofertas não arquivadas do ponto.",
          );
    },
  );

  app.put<{
    Params: HotelIdParams;
    Body: Partial<AdminConsumptionOfferUpdateInput>;
  }>("/admin/consumption-offers/:id", async (request, reply) => {
    const context = scope(
      request,
      reply,
      PERMISSIONS.CONSUMPTION_SETTINGS_MANAGE,
    );
    if (!context) return;
    const id = idParam(request);
    const payload: AdminConsumptionOfferUpdateInput = {};
    if (request.body?.display_order !== undefined) {
      const order = Number(request.body.display_order);
      if (!Number.isInteger(order) || order < 0)
        return sendError(
          reply,
          400,
          ADMIN_ERROR_CODE.VALIDATION,
          "Ordem inválida.",
        );
      payload.display_order = order;
    }
    if (request.body?.is_active !== undefined)
      payload.is_active = Boolean(request.body.is_active);
    if (request.body?.policy !== undefined) {
      const policy = offerPolicy(request.body.policy);
      if (!policy)
        return sendError(
          reply,
          400,
          ADMIN_ERROR_CODE.VALIDATION,
          "Política de cobrança inválida.",
        );
      payload.policy = policy;
    }
    if (request.body?.commercial_agreement_id !== undefined)
      payload.commercial_agreement_id =
        normalizeOptionalText(request.body.commercial_agreement_id) || null;
    if (request.body?.inventory_location_id !== undefined)
      payload.inventory_location_id =
        normalizeOptionalText(request.body.inventory_location_id) || null;
    if (!id || Object.keys(payload).length === 0)
      return sendError(
        reply,
        400,
        ADMIN_ERROR_CODE.VALIDATION,
        "Dados da oferta inválidos.",
      );
    const result = await repository.updateOffer(
      id,
      context.hotelId,
      context.auth.session.id,
      payload,
    );
    if (result.result === "not-found")
      return sendError(
        reply,
        404,
        ADMIN_ERROR_CODE.NOT_FOUND,
        "Oferta não encontrada no hotel ativo.",
      );
    if (result.result === "conflict")
      return sendError(
        reply,
        409,
        ADMIN_ERROR_CODE.CONFLICT,
        "Política ou estado da oferta em conflito.",
      );
    return reply.send({ item: result.item });
  });

  for (const [action, archived] of [
    ["archive", true],
    ["restore", false],
  ] as const) {
    app.post<{ Params: HotelIdParams }>(
      `/admin/consumption-offers/:id/${action}`,
      async (request, reply) => {
        const context = scope(
          request,
          reply,
          PERMISSIONS.CONSUMPTION_SETTINGS_MANAGE,
        );
        if (!context) return;
        const id = idParam(request);
        if (!id)
          return sendError(
            reply,
            400,
            ADMIN_ERROR_CODE.VALIDATION,
            "Identificador inválido.",
          );
        const result = await repository.setOfferArchived(
          id,
          context.hotelId,
          context.auth.session.id,
          archived,
        );
        if (result.result === "not-found")
          return sendError(
            reply,
            404,
            ADMIN_ERROR_CODE.NOT_FOUND,
            "Oferta não encontrada no hotel ativo.",
          );
        return reply.send({ item: result.item });
      },
    );
  }

  app.get<{ Params: HotelIdParams }>(
    "/admin/consumption-offers/:id/history",
    async (request, reply) => {
      const context = scope(request, reply, PERMISSIONS.CONSUMPTION_READ);
      if (!context) return;
      const id = idParam(request);
      if (!id)
        return sendError(
          reply,
          400,
          ADMIN_ERROR_CODE.VALIDATION,
          "Identificador inválido.",
        );
      return reply.send({
        items: await repository.listHistory(
          "consumption_offer",
          id,
          context.hotelId,
        ),
      });
    },
  );
}
