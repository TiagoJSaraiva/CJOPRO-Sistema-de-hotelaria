import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  ADMIN_ERROR_CODE,
  OPERATIONAL_PENDING_PERMISSIONS,
  type OperationalPendingAction,
  type OperationalPendingQuery,
} from "@hotel/shared";
import { ensureAuthorizedAnyWithScope } from "../auth/authorization";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import { adminError } from "../common/adminError";
import {
  createOperationalPendingRepository,
  type OperationalPendingRepository,
} from "../repositories/operationalPendingRepository";
function scope(request: FastifyRequest, reply: FastifyReply) {
  const auth = ensureAuthorizedAnyWithScope(
    request,
    reply,
    OPERATIONAL_PENDING_PERMISSIONS,
  );
  if (!auth) return null;
  const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
  return hotelId ? { ...auth, hotelId } : null;
}
export function registerOperationalPendingRoutes(
  app: FastifyInstance,
  repository: OperationalPendingRepository = createOperationalPendingRepository(),
) {
  app.get<{ Querystring: OperationalPendingQuery }>(
    "/admin/operational-pending",
    async (request, reply) => {
      const auth = scope(request, reply);
      if (!auth) return;
      return reply.send(
        await repository.list(
          auth.hotelId,
          auth.session.id,
          auth.session.permissions,
          request.query,
        ),
      );
    },
  );
  app.post<{ Body: OperationalPendingAction }>(
    "/admin/operational-pending/actions",
    async (request, reply) => {
      const auth = scope(request, reply);
      if (!auth) return;
      const body = request.body;
      if (
        ["claim", "release"].includes(body.action) &&
        (body.ids.length !== 1 || !body.expected_version)
      )
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Informe uma pendência e sua versão.",
            ),
          );
      const result = await repository.act(
        auth.hotelId,
        auth.session.id,
        auth.session.permissions,
        body,
      );
      if (result === "not_found")
        return reply
          .status(404)
          .send(
            adminError(ADMIN_ERROR_CODE.NOT_FOUND, "Pendência não encontrada."),
          );
      if (result === "conflict")
        return reply
          .status(409)
          .send(
            adminError(
              ADMIN_ERROR_CODE.CONFLICT,
              "A pendência mudou ou já tem responsável. Atualize a lista.",
            ),
          );
      if (result !== "ok")
        return reply
          .status(400)
          .send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Ação inválida."));
      return reply.send({ ok: true });
    },
  );
  app.post("/admin/operational-pending/reconcile", async (request, reply) => {
    const auth = scope(request, reply);
    if (!auth) return;
    const result = await repository.reconcile(auth.hotelId);
    if (result !== "ok")
      return reply
        .status(503)
        .send(
          adminError(
            ADMIN_ERROR_CODE.INTERNAL,
            "Falha na sincronização; pendências anteriores preservadas.",
          ),
        );
    return reply.send({ ok: true });
  });
}
