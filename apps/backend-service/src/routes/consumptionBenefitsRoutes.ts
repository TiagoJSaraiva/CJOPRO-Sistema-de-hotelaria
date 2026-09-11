import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  ADMIN_ERROR_CODE,
  PERMISSIONS,
  type BenefitGrantInput,
  type BenefitPlanInput,
  type BenefitPlanVersionInput,
  type ConsumptionTransferInput,
} from "@hotel/shared";
import { ensureAuthorizedWithScope } from "../auth/authorization";
import { adminError } from "../common/adminError";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import {
  createConsumptionBenefitsRepository,
  type ConsumptionBenefitsRepository,
} from "../repositories/consumptionBenefitsRepository";
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
    result.result.startsWith("invalid") || result.result === "reason_required";
  return reply
    .status(notFound ? 404 : invalid ? 400 : 409)
    .send({
      ...adminError(
        notFound
          ? ADMIN_ERROR_CODE.NOT_FOUND
          : invalid
            ? ADMIN_ERROR_CODE.VALIDATION
            : ADMIN_ERROR_CODE.CONFLICT,
        notFound
          ? "Registro não encontrado no hotel ativo."
          : invalid
            ? "Dados inválidos para benefícios ou transferência."
            : "A conta mudou. Atualize a simulação antes de confirmar.",
      ),
      ...(result.context ? { context: result.context } : {}),
    });
}
export function registerConsumptionBenefitsRoutes(
  app: FastifyInstance,
  repository: ConsumptionBenefitsRepository = createConsumptionBenefitsRepository(),
) {
  app.get("/admin/consumption-benefit-plans", async (request, reply) => {
    const context = scope(request, reply, PERMISSIONS.CONSUMPTION_READ);
    if (!context) return;
    return reply.send(await repository.list(context.hotelId));
  });
  app.post<{ Body: BenefitPlanInput }>(
    "/admin/consumption-benefit-plans",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.CONSUMPTION_BENEFITS_MANAGE,
      );
      if (!context) return;
      return send(
        reply,
        await repository.createPlan(
          context.hotelId,
          context.auth.session.id,
          request.body,
        ),
        true,
      );
    },
  );
  app.post<{ Params: Params; Body: BenefitPlanVersionInput }>(
    "/admin/consumption-benefit-plans/:id/versions",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.CONSUMPTION_BENEFITS_MANAGE,
      );
      if (!context) return;
      return send(
        reply,
        await repository.createVersion(
          context.hotelId,
          request.params.id,
          context.auth.session.id,
          request.body,
        ),
        true,
      );
    },
  );
  app.post<{ Params: Params; Body: BenefitGrantInput }>(
    "/admin/stays/:id/benefit-grants",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.CONSUMPTION_BENEFITS_MANAGE,
      );
      if (!context) return;
      return send(
        reply,
        await repository.grant(
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
    app.post<{ Params: Params; Body: ConsumptionTransferInput }>(
      `/admin/consumption-orders/:id/transfer${simulate ? "/simulate" : ""}`,
      async (request, reply) => {
        const context = scope(request, reply, PERMISSIONS.CONSUMPTION_TRANSFER);
        if (!context) return;
        return send(
          reply,
          await repository.transfer(
            context.hotelId,
            request.params.id,
            context.auth.session.id,
            request.body,
            simulate,
          ),
        );
      },
    );
}
