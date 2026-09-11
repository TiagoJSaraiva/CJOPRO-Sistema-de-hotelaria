import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  ADMIN_ERROR_CODE,
  PERMISSIONS,
  type CorporateAccountInput,
  type CorporateCreditAction,
  type CorporateCreditAuthorizationInput,
  type StayPayerAccountCreate,
  type StayPayerAllocationInput,
  type StayPayerPaymentInput,
} from "@hotel/shared";
import { ensureAuthorizedWithScope } from "../auth/authorization";
import { adminError } from "../common/adminError";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import {
  createStayPayersRepository,
  type StayPayersRepository,
} from "../repositories/stayPayersRepository";

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
    result.result === "incomplete_allocation";
  return reply.status(notFound ? 404 : invalid ? 400 : 409).send({
    ...adminError(
      notFound
        ? ADMIN_ERROR_CODE.NOT_FOUND
        : invalid
          ? ADMIN_ERROR_CODE.VALIDATION
          : ADMIN_ERROR_CODE.CONFLICT,
      notFound
        ? "Registro não encontrado no hotel ativo."
        : invalid
          ? "Distribuição ou dados incompletos."
          : "O estado financeiro mudou. Atualize a conta.",
    ),
    ...(result.context ? { context: result.context } : {}),
  });
}

export function registerStayPayersRoutes(
  app: FastifyInstance,
  repository: StayPayersRepository = createStayPayersRepository(),
) {
  app.get<{ Params: Params }>(
    "/admin/stays/:id/payer-accounts",
    async (request, reply) => {
      const context = scope(request, reply, PERMISSIONS.CONSUMPTION_READ);
      if (!context) return;
      return reply.send(
        await repository.list(context.hotelId, request.params.id),
      );
    },
  );
  app.post<{ Params: Params; Body: StayPayerAccountCreate }>(
    "/admin/stays/:id/payer-accounts",
    async (request, reply) => {
      const context = scope(request, reply, PERMISSIONS.STAY_PAYERS_MANAGE);
      if (!context) return;
      return send(
        reply,
        await repository.create(
          context.hotelId,
          request.params.id,
          context.auth.session.id,
          request.body,
        ),
        true,
      );
    },
  );
  for (const simulate of [true, false])
    app.post<{ Params: Params; Body: StayPayerAllocationInput }>(
      `/admin/stays/:id/payer-allocations${simulate ? "/simulate" : ""}`,
      async (request, reply) => {
        const context = scope(request, reply, PERMISSIONS.STAY_PAYERS_MANAGE);
        if (!context) return;
        return send(
          reply,
          await repository.allocate(
            context.hotelId,
            request.params.id,
            context.auth.session.id,
            request.body,
            simulate,
          ),
        );
      },
    );
  app.post<{ Params: Params; Body: StayPayerPaymentInput }>(
    "/admin/stays/:id/payer-payments",
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
  app.get("/admin/corporate-accounts", async (request, reply) => {
    const context = scope(
      request,
      reply,
      PERMISSIONS.CORPORATE_ACCOUNTS_MANAGE,
    );
    if (!context) return;
    return reply.send(await repository.listCompanies(context.hotelId));
  });
  app.post<{ Body: CorporateAccountInput }>(
    "/admin/corporate-accounts",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.CORPORATE_ACCOUNTS_MANAGE,
      );
      if (!context) return;
      return send(
        reply,
        await repository.saveCompany(
          context.hotelId,
          context.auth.session.id,
          request.body,
        ),
        true,
      );
    },
  );
  app.post<{ Body: CorporateCreditAuthorizationInput }>(
    "/admin/corporate-credit-authorizations",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.CORPORATE_CREDIT_REQUEST,
      );
      if (!context) return;
      return send(
        reply,
        await repository.requestCredit(
          context.hotelId,
          context.auth.session.id,
          request.body,
        ),
        true,
      );
    },
  );
  app.post<{ Params: Params; Body: CorporateCreditAction }>(
    "/admin/corporate-credit-authorizations/:id/actions",
    async (request, reply) => {
      const permission =
        request.body.action === "approve" || request.body.action === "reject"
          ? PERMISSIONS.CORPORATE_CREDIT_APPROVE
          : PERMISSIONS.CORPORATE_CREDIT_REQUEST;
      const context = scope(request, reply, permission);
      if (!context) return;
      return send(
        reply,
        await repository.actCredit(
          context.hotelId,
          request.params.id,
          context.auth.session.id,
          request.body,
        ),
      );
    },
  );
}
