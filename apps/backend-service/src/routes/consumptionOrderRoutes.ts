import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  ADMIN_ERROR_CODE,
  PERMISSIONS,
  type AdminConsumptionOrderCreateInput,
  type AdminErrorCode,
  type HotelIdParams,
  type PermissionName,
} from "@hotel/shared";
import { ensureAuthorizedWithScope } from "../auth/authorization";
import { adminError } from "../common/adminError";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import { normalizeOptionalText } from "../common/text";
import {
  createConsumptionOrdersRepository,
  type ConsumptionOrdersRepository,
} from "../repositories/consumptionOrdersRepository";

type ContextQuery = { stay_id?: string; occurred_at?: string };
type EligibleQuery = { search?: string };
type HistoryQuery = {
  cursor?: string;
  limit?: number | string;
  from?: string;
  to?: string;
  search?: string;
  point_id?: string;
  billing_mode?: string;
  disposition?: string;
  provider_type?: string;
  operator_id?: string;
};

function sendError(
  reply: FastifyReply,
  status: number,
  code: AdminErrorCode,
  message: string,
  details?: string,
) {
  return reply.status(status).send(adminError(code, message, details));
}

function scope(
  request: FastifyRequest,
  reply: FastifyReply,
  permission: PermissionName = PERMISSIONS.CONSUMPTION_POST,
) {
  const auth = ensureAuthorizedWithScope(request, reply, permission);
  if (!auth) return null;
  const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
  return hotelId ? { auth, hotelId } : null;
}

function parseCreateInput(
  value: unknown,
): AdminConsumptionOrderCreateInput | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Partial<AdminConsumptionOrderCreateInput>;
  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (
    !normalizeOptionalText(body.stay_id) ||
    !normalizeOptionalText(body.point_id) ||
    !normalizeOptionalText(body.occurred_at) ||
    !normalizeOptionalText(body.idempotency_key) ||
    !["charged", "courtesy"].includes(String(body.disposition)) ||
    lines.length < 1 ||
    lines.length > 100 ||
    lines.some(
      (line) =>
        !normalizeOptionalText(line?.offer_id) ||
        !normalizeOptionalText(line?.version_token) ||
        !Number.isFinite(Number(line?.quantity)) ||
        Number(line.quantity) <= 0,
    )
  )
    return null;
  if (new Set(lines.map((line) => line.offer_id)).size !== lines.length)
    return null;
  return {
    stay_id: String(body.stay_id),
    point_id: String(body.point_id),
    guest_customer_id: normalizeOptionalText(body.guest_customer_id),
    occurred_at: String(body.occurred_at),
    disposition: body.disposition as "charged" | "courtesy",
    billing_mode: body.billing_mode || null,
    payment_method: body.payment_method || null,
    payment_reference: normalizeOptionalText(body.payment_reference),
    partner_receipt_confirmed: body.partner_receipt_confirmed === true,
    courtesy_reason: normalizeOptionalText(body.courtesy_reason),
    notes: normalizeOptionalText(body.notes),
    idempotency_key: String(body.idempotency_key),
    lines: lines.map((line) => ({
      offer_id: String(line.offer_id),
      quantity: Number(line.quantity),
      version_token: String(line.version_token),
    })),
  };
}

const conflictResults = new Set([
  "stay_not_checked_in",
  "occurred_before_checkin",
  "occurred_in_future",
  "point_unavailable",
  "offer_unavailable",
  "version_conflict",
  "billing_mode_not_allowed",
  "different_partners",
  "idempotency_conflict",
]);

export function registerConsumptionOrderRoutes(
  app: FastifyInstance,
  repository: ConsumptionOrdersRepository = createConsumptionOrdersRepository(),
): void {
  app.get<{ Querystring: EligibleQuery }>(
    "/admin/consumption-orders/eligible-stays",
    async (request, reply) => {
      const context = scope(request, reply);
      if (!context) return;
      try {
        return reply.send({
          items: await repository.listEligibleStays(
            context.hotelId,
            normalizeOptionalText(request.query.search) || "",
          ),
        });
      } catch (cause) {
        request.log.error(cause);
        return sendError(
          reply,
          500,
          ADMIN_ERROR_CODE.INTERNAL,
          "Falha ao localizar estadias elegíveis.",
        );
      }
    },
  );

  app.get<{ Querystring: ContextQuery }>(
    "/admin/consumption-orders/context",
    async (request, reply) => {
      const context = scope(request, reply);
      if (!context) return;
      const stayId = normalizeOptionalText(request.query.stay_id);
      const occurredAt =
        normalizeOptionalText(request.query.occurred_at) ||
        new Date().toISOString();
      if (!stayId || Number.isNaN(Date.parse(occurredAt)))
        return sendError(
          reply,
          400,
          ADMIN_ERROR_CODE.VALIDATION,
          "Estadia ou horário inválido.",
        );
      try {
        const result = await repository.getContext(
          context.hotelId,
          stayId,
          occurredAt,
        );
        if (!("item" in result)) {
          const notFound = result.result === "not_found";
          return sendError(
            reply,
            notFound ? 404 : 409,
            notFound ? ADMIN_ERROR_CODE.NOT_FOUND : ADMIN_ERROR_CODE.CONFLICT,
            notFound
              ? "Estadia não encontrada."
              : "O contexto de consumo não está disponível.",
            result.result,
          );
        }
        const item = result.item;
        if (item.stay.stay_status !== "checked_in")
          return sendError(
            reply,
            409,
            ADMIN_ERROR_CODE.CONFLICT,
            "A estadia não está em check-in.",
            "stay_not_checked_in",
          );
        return reply.send({ item });
      } catch (cause) {
        request.log.error(cause);
        return sendError(
          reply,
          500,
          ADMIN_ERROR_CODE.INTERNAL,
          "Falha ao carregar o contexto de consumo.",
        );
      }
    },
  );

  app.post<{ Body: unknown }>(
    "/admin/consumption-orders",
    async (request, reply) => {
      const context = scope(request, reply);
      if (!context) return;
      const input = parseCreateInput(request.body);
      if (!input)
        return sendError(
          reply,
          400,
          ADMIN_ERROR_CODE.VALIDATION,
          "Dados da comanda inválidos.",
        );
      const permissions = context.auth.session.permissions;
      if (
        input.billing_mode === "hotel_immediate" &&
        !permissions.includes(PERMISSIONS.CONSUMPTION_PAYMENT_RECEIVE)
      )
        return sendError(
          reply,
          403,
          ADMIN_ERROR_CODE.FORBIDDEN,
          "Recebimento imediato não autorizado.",
          "financial_permission_required",
        );
      if (
        input.disposition === "courtesy" &&
        !permissions.includes(PERMISSIONS.CONSUMPTION_COURTESY_GRANT)
      )
        return sendError(
          reply,
          403,
          ADMIN_ERROR_CODE.FORBIDDEN,
          "Cortesia não autorizada.",
        );
      const includeTerms = permissions.includes(
        PERMISSIONS.COMMERCIAL_AGREEMENTS_MANAGE,
      );
      try {
        const result = await repository.post(
          context.hotelId,
          context.auth.session.id,
          input,
          includeTerms,
        );
        if (!("item" in result)) {
          const status = conflictResults.has(result.result)
            ? 409
            : result.result === "not_found"
              ? 404
              : 400;
          const code =
            status === 409
              ? ADMIN_ERROR_CODE.CONFLICT
              : status === 404
                ? ADMIN_ERROR_CODE.NOT_FOUND
                : ADMIN_ERROR_CODE.VALIDATION;
          return sendError(
            reply,
            status,
            code,
            "Não foi possível lançar a comanda.",
            result.result,
          );
        }
        return reply
          .status(result.created ? 201 : 200)
          .send({ item: result.item });
      } catch (cause) {
        request.log.error(cause);
        return sendError(
          reply,
          500,
          ADMIN_ERROR_CODE.INTERNAL,
          "Falha ao lançar a comanda.",
        );
      }
    },
  );

  app.get<{ Querystring: HistoryQuery }>(
    "/admin/consumption-orders",
    async (request, reply) => {
      const context = scope(request, reply, PERMISSIONS.CONSUMPTION_READ);
      if (!context) return;
      const parsedLimit = Number(request.query.limit || 50);
      const limit =
        Number.isInteger(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 100
          ? parsedLimit
          : 50;
      try {
        return reply.send(
          await repository.list(context.hotelId, {
            cursor: normalizeOptionalText(request.query.cursor) || undefined,
            limit,
            from: normalizeOptionalText(request.query.from) || undefined,
            to: normalizeOptionalText(request.query.to) || undefined,
            search: normalizeOptionalText(request.query.search) || undefined,
            pointId: normalizeOptionalText(request.query.point_id) || undefined,
            billingMode:
              normalizeOptionalText(request.query.billing_mode) || undefined,
            disposition:
              normalizeOptionalText(request.query.disposition) || undefined,
            providerType:
              normalizeOptionalText(request.query.provider_type) || undefined,
            operatorId:
              normalizeOptionalText(request.query.operator_id) || undefined,
          }),
        );
      } catch (cause) {
        request.log.error(cause);
        return sendError(
          reply,
          500,
          ADMIN_ERROR_CODE.INTERNAL,
          "Falha ao consultar o histórico de consumo.",
        );
      }
    },
  );

  app.get<{ Params: HotelIdParams }>(
    "/admin/consumption-orders/:id",
    async (request, reply) => {
      const context = scope(request, reply, PERMISSIONS.CONSUMPTION_READ);
      if (!context) return;
      const id = normalizeOptionalText(request.params.id);
      if (!id)
        return sendError(
          reply,
          400,
          ADMIN_ERROR_CODE.VALIDATION,
          "Comanda inválida.",
        );
      try {
        const item = await repository.get(
          context.hotelId,
          id,
          context.auth.session.permissions.includes(
            PERMISSIONS.COMMERCIAL_AGREEMENTS_MANAGE,
          ),
        );
        return item
          ? reply.send({ item })
          : sendError(
              reply,
              404,
              ADMIN_ERROR_CODE.NOT_FOUND,
              "Comanda não encontrada.",
            );
      } catch (cause) {
        request.log.error(cause);
        return sendError(
          reply,
          500,
          ADMIN_ERROR_CODE.INTERNAL,
          "Falha ao consultar a comanda.",
        );
      }
    },
  );
}
