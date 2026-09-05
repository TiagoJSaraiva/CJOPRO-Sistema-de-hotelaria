import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  ADMIN_ERROR_CODE,
  PERMISSIONS,
  type AdminConsumptionManagementSettingsInput,
  type AdminErrorCode,
  type AdminPartnerSettlementCreateInput,
  type AdminPartnerSettlementDecisionInput,
  type AdminPartnerSettlementPaymentInput,
  type AdminPartnerSettlementPaymentReversalInput,
  type AdminPartnerSettlementVersionInput,
  type ConsumptionAnalyticsDimension,
  type ConsumptionBillingMode,
  type ConsumptionOrderDisposition,
  type ConsumptionPaymentMethod,
  type HotelIdParams,
  type PartnerSettlementStatus,
  type PermissionName,
  type ProductProviderType,
} from "@hotel/shared";
import {
  ensureAuthorizedAnyWithScope,
  ensureAuthorizedWithScope,
} from "../auth/authorization";
import { adminError } from "../common/adminError";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import { normalizeOptionalText } from "../common/text";
import {
  createConsumptionManagementRepository,
  type ConsumptionManagementRepository,
} from "../repositories/consumptionManagementRepository";

const SETTLEMENT_READ_PERMISSIONS: PermissionName[] = [
  PERMISSIONS.PARTNER_SETTLEMENTS_READ,
  PERMISSIONS.PARTNER_SETTLEMENTS_PREPARE,
  PERMISSIONS.PARTNER_SETTLEMENTS_APPROVE,
  PERMISSIONS.PARTNER_SETTLEMENTS_SETTLE,
];
const ALERT_PERMISSIONS: PermissionName[] = [
  PERMISSIONS.CONSUMPTION_ANALYTICS_READ,
  ...SETTLEMENT_READ_PERMISSIONS,
  PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS,
  PERMISSIONS.INVENTORY_READ,
  PERMISSIONS.COMMERCIAL_PARTNERS_READ,
];
const DIMENSIONS: ConsumptionAnalyticsDimension[] = [
  "day",
  "point",
  "category",
  "product",
  "stay",
  "billing_mode",
  "payment_method",
  "provider",
  "partner",
  "operator",
];

type AnalyticsQuery = {
  from?: string;
  to?: string;
  dimension?: ConsumptionAnalyticsDimension;
  point_id?: string;
  category_id?: string;
  product_id?: string;
  stay_search?: string;
  disposition?: ConsumptionOrderDisposition;
  billing_mode?: ConsumptionBillingMode;
  payment_method?: ConsumptionPaymentMethod;
  provider_type?: ProductProviderType;
  partner_id?: string;
  operator_id?: string;
  cursor?: string;
  limit?: number | string;
};
type SettlementQuery = {
  partner_id?: string;
  status?: PartnerSettlementStatus;
  period_start?: string;
  cursor?: string;
  limit?: number | string;
};

function send(
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
  permission: PermissionName,
) {
  const auth = ensureAuthorizedWithScope(request, reply, permission);
  if (!auth) return null;
  const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
  return hotelId ? { auth, hotelId } : null;
}
function anyScope(
  request: FastifyRequest,
  reply: FastifyReply,
  permissions: PermissionName[],
) {
  const auth = ensureAuthorizedAnyWithScope(request, reply, permissions);
  if (!auth) return null;
  const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
  return hotelId ? { auth, hotelId } : null;
}
function dateOnly(value: unknown): string | null {
  const text = normalizeOptionalText(typeof value === "string" ? value : null);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}
function firstOfMonth(value: unknown): string | null {
  const date = dateOnly(value);
  return date?.endsWith("-01") ? date : null;
}
function positiveInteger(value: unknown, fallback: number, maximum: number) {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= maximum
    ? parsed
    : fallback;
}
function mutationError(reply: FastifyReply, result: string) {
  const notFound = result.endsWith("not_found") || result === "not_found";
  const invalid =
    result.startsWith("invalid") ||
    result === "reason_required" ||
    result === "paid_at_in_future" ||
    result === "period_before_tracking";
  return send(
    reply,
    notFound ? 404 : invalid ? 400 : 409,
    notFound
      ? ADMIN_ERROR_CODE.NOT_FOUND
      : invalid
        ? ADMIN_ERROR_CODE.VALIDATION
        : ADMIN_ERROR_CODE.CONFLICT,
    "Não foi possível concluir a operação de apuração.",
    result,
  );
}

export function registerConsumptionManagementRoutes(
  app: FastifyInstance,
  repository: ConsumptionManagementRepository = createConsumptionManagementRepository(),
): void {
  app.get("/admin/consumption-management/settings", async (request, reply) => {
    const context = anyScope(request, reply, [
      PERMISSIONS.CONSUMPTION_ANALYTICS_READ,
      ...SETTLEMENT_READ_PERMISSIONS,
    ]);
    if (!context) return;
    const item = await repository.getSettings(context.hotelId);
    return item
      ? reply.send({ item })
      : send(
          reply,
          404,
          ADMIN_ERROR_CODE.NOT_FOUND,
          "Configuração gerencial não encontrada.",
        );
  });

  app.patch<{ Body: AdminConsumptionManagementSettingsInput }>(
    "/admin/consumption-management/settings",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.PARTNER_SETTLEMENTS_PREPARE,
      );
      if (!context) return;
      const start = firstOfMonth(request.body?.settlement_tracking_starts_on);
      const due = Number(request.body?.payment_due_days);
      const expiry = Number(request.body?.agreement_expiry_alert_days);
      const guest = Number(request.body?.guest_balance_alert_days);
      if (
        !start ||
        !Number.isInteger(due) ||
        due < 0 ||
        due > 90 ||
        !Number.isInteger(expiry) ||
        expiry < 1 ||
        expiry > 365 ||
        !Number.isInteger(guest) ||
        guest < 0 ||
        guest > 30
      )
        return send(
          reply,
          400,
          ADMIN_ERROR_CODE.VALIDATION,
          "Configuração gerencial inválida.",
        );
      const item = await repository.updateSettings(
        context.hotelId,
        context.auth.session.id,
        { ...request.body, settlement_tracking_starts_on: start },
      );
      return item
        ? reply.send({ item })
        : send(
            reply,
            404,
            ADMIN_ERROR_CODE.NOT_FOUND,
            "Configuração gerencial não encontrada.",
          );
    },
  );

  app.get<{ Querystring: AnalyticsQuery }>(
    "/admin/consumption-analytics",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.CONSUMPTION_ANALYTICS_READ,
      );
      if (!context) return;
      const from = dateOnly(request.query.from);
      const to = dateOnly(request.query.to);
      const dimension = request.query.dimension || "day";
      if (!from || !to || !DIMENSIONS.includes(dimension))
        return send(
          reply,
          400,
          ADMIN_ERROR_CODE.VALIDATION,
          "Filtros analíticos inválidos.",
        );
      const result = await repository.getAnalytics(context.hotelId, {
        from,
        to,
        dimension,
        pointId: normalizeOptionalText(request.query.point_id) || undefined,
        categoryId:
          normalizeOptionalText(request.query.category_id) || undefined,
        productId: normalizeOptionalText(request.query.product_id) || undefined,
        staySearch:
          normalizeOptionalText(request.query.stay_search) || undefined,
        disposition: request.query.disposition,
        billingMode: request.query.billing_mode,
        paymentMethod: request.query.payment_method,
        providerType: request.query.provider_type,
        partnerId: normalizeOptionalText(request.query.partner_id) || undefined,
        operatorId:
          normalizeOptionalText(request.query.operator_id) || undefined,
        cursor: normalizeOptionalText(request.query.cursor) || undefined,
        limit: positiveInteger(request.query.limit, 50, 100),
      });
      return result.item
        ? reply.send({ item: result.item })
        : mutationError(reply, result.result);
    },
  );

  app.get("/admin/management-alerts", async (request, reply) => {
    const context = anyScope(request, reply, ALERT_PERMISSIONS);
    if (!context) return;
    const result = await repository.getAlerts(context.hotelId);
    if (!result.item) return mutationError(reply, result.result);
    const permissions = context.auth.session.permissions;
    const analytics = permissions.includes(
      PERMISSIONS.CONSUMPTION_ANALYTICS_READ,
    );
    const canCalendar = permissions.includes(
      PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS,
    );
    const canInventory = permissions.includes(PERMISSIONS.INVENTORY_READ);
    const canCommercial = permissions.includes(
      PERMISSIONS.COMMERCIAL_PARTNERS_READ,
    );
    const canSettlements = SETTLEMENT_READ_PERMISSIONS.some((permission) =>
      permissions.includes(permission),
    );
    return reply.send({
      item: {
        guest_balances:
          analytics || canCalendar
            ? result.item.guest_balances.map((alert) =>
                canCalendar ? alert : { ...alert, guest_name: null },
              )
            : [],
        critical_stock:
          analytics || canInventory ? result.item.critical_stock : [],
        expiring_agreements:
          analytics || canCommercial ? result.item.expiring_agreements : [],
        pending_settlements: canSettlements
          ? result.item.pending_settlements
          : [],
      },
    });
  });

  app.get<{ Querystring: { period_start?: string; partner_id?: string } }>(
    "/admin/partner-settlements/candidates",
    async (request, reply) => {
      const context = anyScope(request, reply, SETTLEMENT_READ_PERMISSIONS);
      if (!context) return;
      const now = new Date();
      const previous = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
      )
        .toISOString()
        .slice(0, 10);
      const periodStart = request.query.period_start
        ? firstOfMonth(request.query.period_start)
        : previous;
      if (!periodStart)
        return send(
          reply,
          400,
          ADMIN_ERROR_CODE.VALIDATION,
          "Período mensal inválido.",
        );
      const items = await repository.listCandidates(
        context.hotelId,
        periodStart,
        normalizeOptionalText(request.query.partner_id) || undefined,
      );
      return reply.send({ items });
    },
  );

  app.get<{ Querystring: SettlementQuery }>(
    "/admin/partner-settlements",
    async (request, reply) => {
      const context = anyScope(request, reply, SETTLEMENT_READ_PERMISSIONS);
      if (!context) return;
      const result = await repository.listSettlements(context.hotelId, {
        partnerId: normalizeOptionalText(request.query.partner_id) || undefined,
        status: request.query.status,
        periodStart:
          normalizeOptionalText(request.query.period_start) || undefined,
        cursor: normalizeOptionalText(request.query.cursor) || undefined,
        limit: positiveInteger(request.query.limit, 50, 100),
      });
      return reply.send({
        items: result.items,
        next_cursor: result.nextCursor,
      });
    },
  );

  app.post<{ Body: AdminPartnerSettlementCreateInput }>(
    "/admin/partner-settlements",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.PARTNER_SETTLEMENTS_PREPARE,
      );
      if (!context) return;
      const periodStart = firstOfMonth(request.body?.period_start);
      const partnerId = normalizeOptionalText(request.body?.partner_id);
      if (!periodStart || !partnerId)
        return send(
          reply,
          400,
          ADMIN_ERROR_CODE.VALIDATION,
          "Parceiro ou período inválido.",
        );
      const result = await repository.refreshSettlement(
        context.hotelId,
        partnerId,
        periodStart,
        context.auth.session.id,
      );
      if (result.result !== "ok" || !result.id)
        return mutationError(reply, result.result);
      const item = await repository.getSettlement(result.id, context.hotelId);
      return item
        ? reply.status(201).send({ item })
        : send(
            reply,
            500,
            ADMIN_ERROR_CODE.INTERNAL,
            "Apuração criada, mas não pôde ser consultada.",
          );
    },
  );

  app.get<{ Params: HotelIdParams }>(
    "/admin/partner-settlements/:id",
    async (request, reply) => {
      const context = anyScope(request, reply, SETTLEMENT_READ_PERMISSIONS);
      if (!context) return;
      const item = await repository.getSettlement(
        request.params.id,
        context.hotelId,
      );
      return item
        ? reply.send({ item })
        : send(
            reply,
            404,
            ADMIN_ERROR_CODE.NOT_FOUND,
            "Apuração não encontrada.",
          );
    },
  );

  app.post<{
    Params: HotelIdParams;
    Body: AdminPartnerSettlementVersionInput;
  }>("/admin/partner-settlements/:id/recalculate", async (request, reply) => {
    const context = scope(
      request,
      reply,
      PERMISSIONS.PARTNER_SETTLEMENTS_PREPARE,
    );
    if (!context) return;
    const current = await repository.getSettlement(
      request.params.id,
      context.hotelId,
    );
    if (!current)
      return send(
        reply,
        404,
        ADMIN_ERROR_CODE.NOT_FOUND,
        "Apuração não encontrada.",
      );
    const result = await repository.refreshSettlement(
      context.hotelId,
      current.partner.id,
      current.period_start,
      context.auth.session.id,
      request.body.expected_version,
    );
    if (result.result !== "ok") return mutationError(reply, result.result);
    const item = await repository.getSettlement(
      request.params.id,
      context.hotelId,
    );
    return reply.send({ item });
  });

  app.post<{
    Params: HotelIdParams;
    Body: AdminPartnerSettlementVersionInput;
  }>("/admin/partner-settlements/:id/submit", async (request, reply) => {
    const context = scope(
      request,
      reply,
      PERMISSIONS.PARTNER_SETTLEMENTS_PREPARE,
    );
    if (!context) return;
    const result = await repository.submitSettlement(
      context.hotelId,
      request.params.id,
      context.auth.session.id,
      request.body.expected_version,
    );
    if (result.result !== "ok") return mutationError(reply, result.result);
    return reply.send({
      item: await repository.getSettlement(request.params.id, context.hotelId),
    });
  });

  app.post<{
    Params: HotelIdParams;
    Body: AdminPartnerSettlementDecisionInput;
  }>("/admin/partner-settlements/:id/decision", async (request, reply) => {
    const context = scope(
      request,
      reply,
      PERMISSIONS.PARTNER_SETTLEMENTS_APPROVE,
    );
    if (!context) return;
    const result = await repository.decideSettlement(
      context.hotelId,
      request.params.id,
      context.auth.session.id,
      request.body,
    );
    if (result.result !== "ok") return mutationError(reply, result.result);
    return reply.send({
      item: await repository.getSettlement(request.params.id, context.hotelId),
    });
  });

  app.post<{
    Params: HotelIdParams;
    Body: AdminPartnerSettlementPaymentInput;
  }>("/admin/partner-settlements/:id/payment", async (request, reply) => {
    const context = scope(
      request,
      reply,
      PERMISSIONS.PARTNER_SETTLEMENTS_SETTLE,
    );
    if (!context) return;
    const result = await repository.paySettlement(
      context.hotelId,
      request.params.id,
      context.auth.session.id,
      request.body,
    );
    if (result.result !== "ok") return mutationError(reply, result.result);
    return reply.send({
      item: await repository.getSettlement(request.params.id, context.hotelId),
    });
  });

  app.post<{
    Params: HotelIdParams;
    Body: AdminPartnerSettlementPaymentReversalInput;
  }>(
    "/admin/partner-settlement-payments/:id/reversal",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.PARTNER_SETTLEMENTS_SETTLE,
      );
      if (!context) return;
      const result = await repository.reversePayment(
        context.hotelId,
        request.params.id,
        context.auth.session.id,
        request.body,
      );
      if (result.result !== "ok" || !result.settlementId)
        return mutationError(reply, result.result);
      return reply.send({
        item: await repository.getSettlement(
          result.settlementId,
          context.hotelId,
        ),
      });
    },
  );
}
