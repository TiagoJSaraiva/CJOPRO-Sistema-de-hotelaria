import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  ADMIN_ERROR_CODE,
  PERMISSIONS,
  type GovernanceActionInput,
  type GovernanceCycleCreateInput,
  type GovernanceDefectInput,
  type GovernanceMinibarInput,
  type GovernanceTemplateCreateInput,
  type HotelIdParams,
  type StayRelocationConfirmInput,
  type PermissionName,
} from "@hotel/shared";
import { ensureAuthorizedWithScope } from "../auth/authorization";
import { adminError } from "../common/adminError";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import {
  createGovernanceRepository,
  type GovernanceRepository,
} from "../repositories/governanceRepository";

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

function failure(reply: FastifyReply, result: string) {
  const notFound = result === "not_found";
  const invalid = result === "invalid" || result === "stay_not_checked_in";
  return reply
    .status(notFound ? 404 : invalid ? 400 : 409)
    .send(
      adminError(
        notFound
          ? ADMIN_ERROR_CODE.NOT_FOUND
          : invalid
            ? ADMIN_ERROR_CODE.VALIDATION
            : ADMIN_ERROR_CODE.CONFLICT,
        notFound
          ? "Registro de governança não encontrado."
          : invalid
            ? "Dados inválidos para a operação de governança."
            : "A operação deixou de ser possível. Atualize o contexto e tente novamente.",
        result,
      ),
    );
}

export function registerGovernanceRoutes(
  app: FastifyInstance,
  repository: GovernanceRepository = createGovernanceRepository(),
): void {
  app.get("/admin/governance/board", async (request, reply) => {
    const context = scope(request, reply, PERMISSIONS.GOVERNANCE_READ);
    if (!context) return;
    return reply.send(await repository.listBoard(context.hotelId));
  });

  app.get<{ Params: HotelIdParams }>(
    "/admin/governance/cycles/:id",
    async (request, reply) => {
      const context = scope(request, reply, PERMISSIONS.GOVERNANCE_READ);
      if (!context) return;
      const item = await repository.getCycle(
        context.hotelId,
        request.params.id,
      );
      return item ? reply.send({ item }) : failure(reply, "not_found");
    },
  );

  app.post<{ Body: GovernanceCycleCreateInput }>(
    "/admin/governance/cycles",
    async (request, reply) => {
      const context = scope(request, reply, PERMISSIONS.GOVERNANCE_EXECUTE);
      if (!context) return;
      const result = await repository.createCycle(
        context.hotelId,
        context.auth.session.id,
        request.body,
      );
      return result.item
        ? reply.status(201).send({ item: result.item })
        : failure(reply, result.result);
    },
  );

  app.post<{ Params: HotelIdParams; Body: GovernanceActionInput }>(
    "/admin/governance/cycles/:id/actions",
    async (request, reply) => {
      const required =
        request.body.action === "approve" || request.body.action === "reject"
          ? PERMISSIONS.GOVERNANCE_INSPECT
          : request.body.action === "assign"
            ? PERMISSIONS.GOVERNANCE_ASSIGN
            : PERMISSIONS.GOVERNANCE_EXECUTE;
      const context = scope(request, reply, required);
      if (!context) return;
      const result = await repository.act(
        context.hotelId,
        request.params.id,
        context.auth.session.id,
        request.body,
      );
      return result.item
        ? reply.send({ item: result.item })
        : failure(reply, result.result);
    },
  );

  app.post<{ Params: HotelIdParams; Body: GovernanceMinibarInput }>(
    "/admin/governance/cycles/:id/minibar",
    async (request, reply) => {
      const context = scope(request, reply, PERMISSIONS.GOVERNANCE_EXECUTE);
      if (!context) return;
      if (
        !(
          "discrepancy_only" in request.body && request.body.discrepancy_only
        ) &&
        !context.auth.session.permissions.includes(PERMISSIONS.CONSUMPTION_POST)
      ) {
        return reply
          .status(403)
          .send(
            adminError(
              ADMIN_ERROR_CODE.FORBIDDEN,
              "Sem permissão para lançar consumo. Registre o achado para a recepção.",
            ),
          );
      }
      const result = await repository.registerMinibar(
        context.hotelId,
        request.params.id,
        context.auth.session.id,
        request.body,
      );
      return result.item
        ? reply.send({ item: result.item })
        : failure(reply, result.result);
    },
  );

  app.post<{ Params: HotelIdParams; Body: GovernanceDefectInput }>(
    "/admin/governance/cycles/:id/defects",
    async (request, reply) => {
      const context = scope(request, reply, PERMISSIONS.GOVERNANCE_EXECUTE);
      if (!context) return;
      if (request.body.blocking && !request.body.block_end_date)
        return failure(reply, "invalid");
      const result = await repository.createDefect(
        context.hotelId,
        request.params.id,
        context.auth.session.id,
        request.body,
      );
      return result.item
        ? reply.send({ item: result.item })
        : failure(reply, result.result);
    },
  );

  app.get("/admin/governance/checklist-templates", async (request, reply) => {
    const context = scope(request, reply, PERMISSIONS.GOVERNANCE_READ);
    if (!context) return;
    return reply.send({
      items: await repository.listTemplates(context.hotelId),
    });
  });

  app.post<{ Body: GovernanceTemplateCreateInput }>(
    "/admin/governance/checklist-templates",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.GOVERNANCE_TEMPLATES_MANAGE,
      );
      if (!context) return;
      const result = await repository.createTemplate(
        context.hotelId,
        context.auth.session.id,
        request.body,
      );
      return result.item
        ? reply.status(201).send({ item: result.item })
        : failure(reply, result.result);
    },
  );

  app.post<{ Params: HotelIdParams }>(
    "/admin/stays/:id/relocation/simulate",
    async (request, reply) => {
      const context = scope(request, reply, PERMISSIONS.RESERVATION_RELOCATE);
      if (!context) return;
      const result = await repository.simulateRelocation(
        context.hotelId,
        request.params.id,
      );
      return result.result === "ok"
        ? reply.send({ items: result.items, version: result.version })
        : failure(reply, result.result);
    },
  );

  app.post<{ Params: HotelIdParams; Body: StayRelocationConfirmInput }>(
    "/admin/stays/:id/relocation",
    async (request, reply) => {
      const context = scope(request, reply, PERMISSIONS.RESERVATION_RELOCATE);
      if (!context) return;
      const result = await repository.relocate(
        context.hotelId,
        request.params.id,
        context.auth.session.id,
        request.body,
      );
      return result.result === "ok"
        ? reply.send({ ok: true })
        : failure(reply, result.result);
    },
  );
}
