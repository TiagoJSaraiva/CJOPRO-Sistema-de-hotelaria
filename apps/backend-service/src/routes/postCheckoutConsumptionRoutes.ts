import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  ADMIN_ERROR_CODE,
  PERMISSIONS,
  type CorporateReceivablePaymentInput,
  type PostCheckoutConsumptionAction,
  type PostCheckoutConsumptionCreate,
  type PostCheckoutEvidenceInput,
  type PostCheckoutPaymentInput,
} from "@hotel/shared";
import {
  ensureAuthorizedAnyWithScope,
  ensureAuthorizedWithScope,
} from "../auth/authorization";
import { adminError } from "../common/adminError";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import {
  createPostCheckoutConsumptionRepository,
  type PostCheckoutConsumptionRepository,
} from "../repositories/postCheckoutConsumptionRepository";

type Params = { id: string };
function scope(
  request: FastifyRequest,
  reply: FastifyReply,
  permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS],
) {
  const auth = ensureAuthorizedWithScope(request, reply, permission);
  if (!auth) return null;
  const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
  return hotelId ? { auth, hotelId } : null;
}
function send(
  reply: FastifyReply,
  result: { result: string; context?: unknown },
  created = false,
) {
  if (result.result === "ok")
    return reply.status(created ? 201 : 200).send({ ok: true, ...result });
  const notFound = result.result === "not_found";
  const invalid =
    result.result.startsWith("invalid") ||
    result.result.includes("required") ||
    result.result.includes("outside");
  return reply.status(notFound ? 404 : invalid ? 400 : 409).send({
    ...adminError(
      notFound
        ? ADMIN_ERROR_CODE.NOT_FOUND
        : invalid
          ? ADMIN_ERROR_CODE.VALIDATION
          : ADMIN_ERROR_CODE.CONFLICT,
      notFound
        ? "Caso não encontrado no hotel ativo."
        : invalid
          ? "Dados, evidência ou estado inválidos."
          : "O caso ou saldo mudou. Atualize antes de continuar.",
    ),
    ...(result.context ? { context: result.context } : {}),
  });
}

export function registerPostCheckoutConsumptionRoutes(
  app: FastifyInstance,
  repository: PostCheckoutConsumptionRepository = createPostCheckoutConsumptionRepository(),
) {
  app.get<{ Params: Params }>(
    "/admin/stays/:id/departure-review",
    async (request, reply) => {
      const auth = ensureAuthorizedAnyWithScope(request, reply, [
        PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS,
        PERMISSIONS.CONSUMPTION_READ,
      ]);
      if (!auth) return;
      const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
      if (!hotelId) return;
      const item = await repository.departureReview(hotelId, request.params.id);
      return item ? reply.send(item) : send(reply, { result: "not_found" });
    },
  );
  app.get<{ Querystring: { id?: string } }>(
    "/admin/post-checkout-consumption",
    async (request, reply) => {
      const auth = ensureAuthorizedAnyWithScope(request, reply, [
        PERMISSIONS.POST_CHECKOUT_CONSUMPTION_REVIEW,
        PERMISSIONS.POST_CHECKOUT_CONSUMPTION_WAIVE,
        PERMISSIONS.CONSUMPTION_PAYMENT_RECEIVE,
      ]);
      if (!auth) return;
      const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
      if (!hotelId) return;
      return reply.send(await repository.list(hotelId, request.query.id));
    },
  );
  app.get<{ Params: Params }>(
    "/admin/post-checkout-consumption/:id",
    async (request, reply) => {
      const auth = ensureAuthorizedAnyWithScope(request, reply, [
        PERMISSIONS.POST_CHECKOUT_CONSUMPTION_REVIEW,
        PERMISSIONS.POST_CHECKOUT_CONSUMPTION_WAIVE,
        PERMISSIONS.CONSUMPTION_PAYMENT_RECEIVE,
      ]);
      if (!auth) return;
      const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
      if (!hotelId) return;
      const list = (await repository.list(hotelId, request.params.id)) as {
        items?: unknown[];
      };
      const item = list.items?.[0];
      return item ? reply.send({ item }) : send(reply, { result: "not_found" });
    },
  );
  app.post<{ Body: PostCheckoutConsumptionCreate }>(
    "/admin/post-checkout-consumption",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.POST_CHECKOUT_CONSUMPTION_REVIEW,
      );
      if (!context) return;
      return send(
        reply,
        await repository.create(
          context.hotelId,
          context.auth.session.id,
          request.body,
        ),
        true,
      );
    },
  );
  app.post<{ Params: Params; Body: PostCheckoutConsumptionAction }>(
    "/admin/post-checkout-consumption/:id/actions",
    async (request, reply) => {
      const permission =
        request.body.action === "waive"
          ? PERMISSIONS.POST_CHECKOUT_CONSUMPTION_WAIVE
          : PERMISSIONS.POST_CHECKOUT_CONSUMPTION_REVIEW;
      const context = scope(request, reply, permission);
      if (!context) return;
      return send(
        reply,
        await repository.act(
          context.hotelId,
          request.params.id,
          context.auth.session.id,
          request.body,
        ),
      );
    },
  );
  app.post<{ Params: Params; Body: PostCheckoutEvidenceInput }>(
    "/admin/post-checkout-consumption/:id/evidence",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.POST_CHECKOUT_CONSUMPTION_REVIEW,
      );
      if (!context) return;
      return send(
        reply,
        await repository.addEvidence(
          context.hotelId,
          request.params.id,
          context.auth.session.id,
          request.body,
        ),
        true,
      );
    },
  );
  app.post<{ Params: Params; Body: PostCheckoutPaymentInput }>(
    "/admin/post-checkout-consumption/:id/payments",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.CONSUMPTION_PAYMENT_RECEIVE,
      );
      if (!context) return;
      return send(
        reply,
        await repository.pay(
          context.hotelId,
          request.params.id,
          context.auth.session.id,
          request.body,
        ),
      );
    },
  );
  app.post<{ Params: Params; Body: CorporateReceivablePaymentInput }>(
    "/admin/corporate-receivables/:id/payments",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.CORPORATE_RECEIVABLES_SETTLE,
      );
      if (!context) return;
      return send(
        reply,
        await repository.payCorporate(
          context.hotelId,
          request.params.id,
          context.auth.session.id,
          request.body,
        ),
      );
    },
  );
}
