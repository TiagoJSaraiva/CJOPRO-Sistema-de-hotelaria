import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  ADMIN_ERROR_CODE,
  PERMISSIONS,
  type ConsumptionServiceAction,
  type ConsumptionServiceOrderCreate,
} from "@hotel/shared";
import { ensureAuthorizedWithScope } from "../auth/authorization";
import { adminError } from "../common/adminError";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import {
  createConsumptionJourneyRepository,
  type ConsumptionJourneyRepository,
} from "../repositories/consumptionJourneyRepository";

type Params = { id: string };
type Query = { status?: string; point_id?: string; search?: string };

function authorized(
  request: FastifyRequest,
  reply: FastifyReply,
  permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS],
) {
  const auth = ensureAuthorizedWithScope(request, reply, permission);
  if (!auth) return null;
  const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
  return hotelId ? { auth, hotelId } : null;
}

function failure(reply: FastifyReply, result: string, context?: unknown) {
  const notFound = result === "not_found";
  const invalid =
    result.startsWith("invalid") || result === "guest_outside_stay";
  return reply.status(notFound ? 404 : invalid ? 400 : 409).send({
    ...adminError(
      notFound
        ? ADMIN_ERROR_CODE.NOT_FOUND
        : invalid
          ? ADMIN_ERROR_CODE.VALIDATION
          : ADMIN_ERROR_CODE.CONFLICT,
      notFound
        ? "Pedido não encontrado no hotel ativo."
        : invalid
          ? "Dados ou estado inválidos para o pedido."
          : "O pedido mudou ou uma reserva deixou de estar disponível. Atualize o contexto.",
      result,
    ),
    ...(context ? { context } : {}),
  });
}

export function registerConsumptionJourneyRoutes(
  app: FastifyInstance,
  repository: ConsumptionJourneyRepository = createConsumptionJourneyRepository(),
) {
  app.get<{ Querystring: Query }>(
    "/admin/consumption-service/board",
    async (request, reply) => {
      const context = authorized(request, reply, PERMISSIONS.CONSUMPTION_READ);
      if (!context) return;
      return reply.send(await repository.board(context.hotelId, request.query));
    },
  );

  app.get<{ Params: Params }>(
    "/admin/consumption-service/orders/:id",
    async (request, reply) => {
      const context = authorized(request, reply, PERMISSIONS.CONSUMPTION_READ);
      if (!context) return;
      const item = await repository.serviceOrder(
        context.hotelId,
        request.params.id,
      );
      return item ? reply.send({ item }) : failure(reply, "not_found");
    },
  );

  app.post<{ Body: ConsumptionServiceOrderCreate }>(
    "/admin/consumption-service/orders",
    async (request, reply) => {
      const context = authorized(
        request,
        reply,
        PERMISSIONS.CONSUMPTION_SERVICE_MANAGE,
      );
      if (!context) return;
      const result = await repository.createServiceOrder(
        context.hotelId,
        context.auth.session.id,
        request.body,
      );
      if (result.result !== "ok")
        return failure(reply, result.result, result.context);
      const item = result.order_id
        ? await repository.serviceOrder(context.hotelId, result.order_id)
        : null;
      return reply.status(201).send({ item });
    },
  );

  app.post<{ Params: Params; Body: ConsumptionServiceAction }>(
    "/admin/consumption-service/orders/:id/actions",
    async (request, reply) => {
      const permission =
        request.body.action === "cancel"
          ? PERMISSIONS.CONSUMPTION_SERVICE_CANCEL
          : PERMISSIONS.CONSUMPTION_SERVICE_MANAGE;
      const context = authorized(request, reply, permission);
      if (!context) return;
      if (
        request.body.action === "deliver" &&
        !context.auth.session.permissions.includes(PERMISSIONS.CONSUMPTION_POST)
      )
        return reply
          .status(403)
          .send(
            adminError(
              ADMIN_ERROR_CODE.FORBIDDEN,
              "A entrega exige permissão para materializar o consumo.",
            ),
          );
      const result = await repository.actOnServiceOrder(
        context.hotelId,
        context.auth.session.id,
        request.params.id,
        request.body,
      );
      if (result.result !== "ok")
        return failure(reply, result.result, result.context);
      return reply.send({
        item: await repository.serviceOrder(context.hotelId, request.params.id),
      });
    },
  );
}
