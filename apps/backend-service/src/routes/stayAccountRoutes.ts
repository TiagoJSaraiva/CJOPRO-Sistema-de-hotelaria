import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  ADMIN_ERROR_CODE,
  PERMISSIONS,
  type AdminConsumptionCorrectionCreateInput,
  type AdminConsumptionCorrectionDecisionInput,
  type AdminPartnerRefundConfirmationInput,
  type AdminStayPaymentBatchInput,
  type AdminStayRefundInput,
  type HotelIdParams,
  type PermissionName,
} from "@hotel/shared";
import { ensureAuthorizedWithScope } from "../auth/authorization";
import { adminError } from "../common/adminError";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import { normalizeOptionalText } from "../common/text";
import {
  createStayAccountsRepository,
  type StayAccountsRepository,
} from "../repositories/stayAccountsRepository";

type CorrectionsQuery = { status?: string; stay_id?: string };

function access(
  request: FastifyRequest,
  reply: FastifyReply,
  permission: PermissionName,
) {
  const auth = ensureAuthorizedWithScope(request, reply, permission);
  if (!auth) return null;
  const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
  return hotelId ? { auth, hotelId } : null;
}

function fail(
  reply: FastifyReply,
  status: number,
  message: string,
  details?: string,
) {
  return reply
    .status(status)
    .send(
      adminError(
        status === 404
          ? ADMIN_ERROR_CODE.NOT_FOUND
          : status === 403
            ? ADMIN_ERROR_CODE.FORBIDDEN
            : status === 400
              ? ADMIN_ERROR_CODE.VALIDATION
              : ADMIN_ERROR_CODE.CONFLICT,
        message,
        details,
      ),
    );
}

const validationResults = new Set([
  "invalid_tenders",
  "invalid_tender",
  "invalid_payment_method",
  "invalid_refund",
  "invalid_decision",
  "invalid_correction",
  "reason_required",
  "decision_reason_required",
  "method_override_reason_required",
  "invalid_restock",
  "return_location_unavailable",
]);

function resultError(reply: FastifyReply, result: string) {
  const status =
    result === "not_found" || result === "tender_not_found"
      ? 404
      : validationResults.has(result)
        ? 400
        : 409;
  return fail(
    reply,
    status,
    "A operação não pôde ser concluída na versão atual da conta.",
    result,
  );
}

function validBatch(input: AdminStayPaymentBatchInput): boolean {
  if (!Array.isArray(input.tenders) || input.tenders.length < 1) return false;
  const keys = input.tenders.map(
    (item) => `${item.payment_method}:${item.reference_code || ""}`,
  );
  return (
    new Set(keys).size === keys.length &&
    input.tenders.every(
      (item) => Number.isFinite(item.amount) && item.amount > 0,
    )
  );
}

export function registerStayAccountRoutes(
  app: FastifyInstance,
  repository: StayAccountsRepository = createStayAccountsRepository(),
): void {
  app.get<{ Params: HotelIdParams }>(
    "/admin/stays/:id/account",
    async (request, reply) => {
      const context = access(
        request,
        reply,
        PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS,
      );
      if (!context) return;
      const item = await repository.getAccount(
        context.hotelId,
        request.params.id,
        context.auth.session.permissions.includes(
          PERMISSIONS.COMMERCIAL_AGREEMENTS_MANAGE,
        ),
      );
      return item
        ? reply.send({ item })
        : fail(reply, 404, "Conta da estadia não encontrada.");
    },
  );

  app.post<{
    Params: HotelIdParams;
    Body: AdminStayPaymentBatchInput;
  }>("/admin/stays/:id/payment-batches/preview", async (request, reply) => {
    const context = access(
      request,
      reply,
      PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS,
    );
    if (!context) return;
    if (!validBatch(request.body))
      return fail(reply, 400, "Parcelas de pagamento inválidas.");
    const item = await repository.previewPaymentBatch(
      context.hotelId,
      request.params.id,
      request.body,
    );
    if (!item) return fail(reply, 404, "Conta da estadia não encontrada.");
    if (item.total > item.balance)
      return fail(
        reply,
        409,
        "O pagamento excede o saldo da conta.",
        "payment_exceeds_balance",
      );
    return reply.send({ item });
  });

  app.post<{
    Params: HotelIdParams;
    Body: AdminStayPaymentBatchInput;
  }>("/admin/stays/:id/payment-batches", async (request, reply) => {
    const context = access(
      request,
      reply,
      PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS,
    );
    if (!context) return;
    if (!validBatch(request.body))
      return fail(reply, 400, "Parcelas de pagamento inválidas.");
    const result = await repository.createPaymentBatch(
      context.hotelId,
      request.params.id,
      context.auth.session.id,
      request.body,
      context.auth.session.permissions.includes(
        PERMISSIONS.COMMERCIAL_AGREEMENTS_MANAGE,
      ),
    );
    return "item" in result
      ? reply
          .status(result.created === false ? 200 : 201)
          .send({ item: result.item })
      : resultError(reply, result.result);
  });

  app.post<{ Params: HotelIdParams; Body: AdminStayRefundInput }>(
    "/admin/stays/:id/refunds",
    async (request, reply) => {
      const context = access(
        request,
        reply,
        PERMISSIONS.CONSUMPTION_PAYMENT_RECEIVE,
      );
      if (!context) return;
      const result = await repository.createRefund(
        context.hotelId,
        request.params.id,
        context.auth.session.id,
        request.body,
        context.auth.session.permissions.includes(
          PERMISSIONS.COMMERCIAL_AGREEMENTS_MANAGE,
        ),
      );
      return "item" in result
        ? reply
            .status(result.created === false ? 200 : 201)
            .send({ item: result.item })
        : resultError(reply, result.result);
    },
  );

  app.get<{ Params: HotelIdParams }>(
    "/admin/stays/:id/checkout-record",
    async (request, reply) => {
      const context = access(
        request,
        reply,
        PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS,
      );
      if (!context) return;
      const item = await repository.getCheckoutRecord(
        context.hotelId,
        request.params.id,
      );
      return item
        ? reply.send({ item })
        : fail(reply, 404, "Fechamento da estadia não encontrado.");
    },
  );

  app.post<{
    Params: HotelIdParams;
    Body: AdminConsumptionCorrectionCreateInput;
  }>("/admin/consumption-orders/:id/corrections", async (request, reply) => {
    const required =
      request.body.kind === "full_void"
        ? PERMISSIONS.CONSUMPTION_VOID
        : PERMISSIONS.CONSUMPTION_POST;
    const context = access(request, reply, required);
    if (!context) return;
    if (
      request.body.kind === "partial_adjustment" &&
      (!request.body.items?.length ||
        new Set(request.body.items.map((item) => item.order_item_id)).size !==
          request.body.items.length)
    )
      return fail(reply, 400, "Itens do ajuste inválidos.");
    if (
      request.body.items?.some(
        (item) =>
          (item.restock_quantity ?? 0) < 0 ||
          !Number.isInteger(item.restock_quantity ?? 0) ||
          ((item.restock_quantity ?? 0) > 0 && !item.restock_location_id) ||
          ((item.restock_quantity ?? 0) === 0 &&
            Boolean(item.restock_location_id)),
      )
    )
      return fail(reply, 400, "Dados de devolução ao estoque inválidos.");
    const result = await repository.requestCorrection(
      context.hotelId,
      request.params.id,
      context.auth.session.id,
      request.body,
    );
    return "item" in result
      ? reply.status(201).send({ item: result.item })
      : resultError(reply, result.result);
  });

  app.get<{ Querystring: CorrectionsQuery }>(
    "/admin/consumption-corrections",
    async (request, reply) => {
      const context = access(
        request,
        reply,
        PERMISSIONS.CONSUMPTION_ADJUSTMENT_APPROVE,
      );
      if (!context) return;
      const items = await repository.listCorrections(context.hotelId, {
        status: normalizeOptionalText(request.query.status) || undefined,
        stayId: normalizeOptionalText(request.query.stay_id) || undefined,
      });
      return reply.send({ items });
    },
  );

  app.post<{
    Params: HotelIdParams;
    Body: AdminConsumptionCorrectionDecisionInput;
  }>("/admin/consumption-corrections/:id/decision", async (request, reply) => {
    const context = access(
      request,
      reply,
      PERMISSIONS.CONSUMPTION_ADJUSTMENT_APPROVE,
    );
    if (!context) return;
    const result = await repository.decideCorrection(
      context.hotelId,
      request.params.id,
      context.auth.session.id,
      request.body,
    );
    return "item" in result
      ? reply.send({ item: result.item })
      : resultError(reply, result.result);
  });

  app.post<{ Params: HotelIdParams; Body: AdminStayRefundInput }>(
    "/admin/consumption-corrections/:id/refund",
    async (request, reply) => {
      const context = access(
        request,
        reply,
        PERMISSIONS.CONSUMPTION_PAYMENT_RECEIVE,
      );
      if (!context) return;
      const correction = await repository.getCorrection(
        context.hotelId,
        request.params.id,
      );
      if (!correction?.stay_id)
        return fail(reply, 404, "Correção não encontrada.");
      const result = await repository.createRefund(
        context.hotelId,
        correction.stay_id,
        context.auth.session.id,
        { ...request.body, correction_id: correction.id },
        context.auth.session.permissions.includes(
          PERMISSIONS.COMMERCIAL_AGREEMENTS_MANAGE,
        ),
      );
      if (result.result !== "ok") return resultError(reply, result.result);
      const item = await repository.getCorrection(
        context.hotelId,
        correction.id,
      );
      return item
        ? reply.send({ item })
        : fail(reply, 404, "Correção não encontrada.");
    },
  );

  app.post<{
    Params: HotelIdParams;
    Body: AdminPartnerRefundConfirmationInput;
  }>(
    "/admin/consumption-corrections/:id/partner-refund-confirmation",
    async (request, reply) => {
      const context = access(
        request,
        reply,
        PERMISSIONS.CONSUMPTION_ADJUSTMENT_APPROVE,
      );
      if (!context) return;
      const result = await repository.confirmPartnerRefund(
        context.hotelId,
        request.params.id,
        context.auth.session.id,
        request.body,
      );
      return "item" in result
        ? reply.send({ item: result.item })
        : resultError(reply, result.result);
    },
  );
}
