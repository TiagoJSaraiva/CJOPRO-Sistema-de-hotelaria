import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  ADMIN_ERROR_CODE,
  PERMISSIONS,
  type MaintenanceAffectedRoomsInput,
  type MaintenanceAvailabilityExceptionInput,
  type MaintenanceLifecycleActionInput,
  type MaintenanceLifecycleCreateInput,
  type MaintenanceRecurrenceActionInput,
  type MaintenanceRecurrencePolicyInput,
  type MaintenanceRescheduleDecisionInput,
  type MaintenanceRescheduleRequestInput,
  type MaintenanceScheduleInput,
  type MaintenanceServiceCommunicationInput,
  type MaintenanceServiceConfirmationInput,
  type MaintenanceTeamInput,
  type MaintenanceWaitingFollowupInput,
  type PermissionName,
} from "@hotel/shared";
import {
  ensureAuthorizedAnyWithScope,
  ensureAuthorizedWithScope,
} from "../auth/authorization";
import { adminError } from "../common/adminError";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import {
  createMaintenancePlanningRepository,
  type MaintenancePlanningRepository,
} from "../repositories/maintenancePlanningRepository";

type IdParams = { id: string };
type Query = { from?: string; to?: string };

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

function readScope(request: FastifyRequest, reply: FastifyReply) {
  const auth = ensureAuthorizedAnyWithScope(request, reply, [
    PERMISSIONS.MAINTENANCE_READ,
    PERMISSIONS.MAINTENANCE_EXECUTE,
    PERMISSIONS.MAINTENANCE_SCHEDULE_MANAGE,
    PERMISSIONS.MAINTENANCE_TEAMS_MANAGE,
    PERMISSIONS.MAINTENANCE_ANALYTICS_READ,
  ]);
  if (!auth) return null;
  const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
  return hotelId ? { auth, hotelId } : null;
}

function result(
  reply: FastifyReply,
  value: { result: string; context?: unknown },
  created = false,
) {
  if (value.result === "ok")
    return reply.status(created ? 201 : 200).send({ ok: true });
  const notFound = value.result === "not_found";
  const invalid =
    value.result === "invalid" || value.result === "invalid_state";
  return reply.status(notFound ? 404 : invalid ? 400 : 409).send({
    ...adminError(
      notFound
        ? ADMIN_ERROR_CODE.NOT_FOUND
        : invalid
          ? ADMIN_ERROR_CODE.VALIDATION
          : ADMIN_ERROR_CODE.CONFLICT,
      notFound
        ? "Registro de manutenção não encontrado no hotel ativo."
        : invalid
          ? "Dados ou estado inválidos para a operação."
          : "A operação conflita com o estado atual. Atualize o planejamento.",
    ),
    ...(value.context ? { context: value.context } : {}),
  });
}

export function registerMaintenancePlanningRoutes(
  app: FastifyInstance,
  repository: MaintenancePlanningRepository = createMaintenancePlanningRepository(),
) {
  app.get<{ Querystring: Query }>(
    "/admin/maintenance/planning/board",
    async (request, reply) => {
      const context = readScope(request, reply);
      if (!context) return;
      return reply.send(
        await repository.board(
          context.hotelId,
          request.query.from,
          request.query.to,
        ),
      );
    },
  );

  app.post<{ Body: MaintenanceTeamInput }>(
    "/admin/maintenance/teams",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_TEAMS_MANAGE,
      );
      if (!context) return;
      return result(
        reply,
        await repository.saveTeam(
          context.hotelId,
          context.auth.session.id,
          request.body,
        ),
        true,
      );
    },
  );
  app.put<{ Params: IdParams; Body: MaintenanceTeamInput }>(
    "/admin/maintenance/teams/:id",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_TEAMS_MANAGE,
      );
      if (!context) return;
      return result(
        reply,
        await repository.saveTeam(
          context.hotelId,
          context.auth.session.id,
          request.body,
          request.params.id,
        ),
      );
    },
  );
  app.post<{ Body: MaintenanceAvailabilityExceptionInput }>(
    "/admin/maintenance/availability-exceptions",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_TEAMS_MANAGE,
      );
      if (!context) return;
      return result(
        reply,
        await repository.addAvailabilityException(
          context.hotelId,
          context.auth.session.id,
          request.body,
        ),
        true,
      );
    },
  );

  app.post<{ Params: IdParams; Body: MaintenanceScheduleInput }>(
    "/admin/maintenance/work-orders/:id/schedule/simulate",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_SCHEDULE_MANAGE,
      );
      if (!context) return;
      const value = await repository.simulate(
        context.hotelId,
        request.params.id,
        request.body,
      );
      return value.item
        ? reply.send({ item: value.item })
        : result(reply, value);
    },
  );
  app.post<{ Params: IdParams; Body: MaintenanceScheduleInput }>(
    "/admin/maintenance/work-orders/:id/schedule",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_SCHEDULE_MANAGE,
      );
      if (!context) return;
      const wantsOverride = Boolean(request.body.override_conflicts);
      const canOverride = context.auth.session.permissions.includes(
        PERMISSIONS.MAINTENANCE_SCHEDULE_OVERRIDE,
      );
      if (wantsOverride && !canOverride)
        return reply
          .status(403)
          .send(
            adminError(
              ADMIN_ERROR_CODE.FORBIDDEN,
              "Sem permissão para abrir exceção de agenda.",
            ),
          );
      return result(
        reply,
        await repository.schedule(
          context.hotelId,
          request.params.id,
          context.auth.session.id,
          request.body,
          canOverride,
        ),
      );
    },
  );

  app.post<{ Params: IdParams; Body: MaintenanceRescheduleRequestInput }>(
    "/admin/maintenance/work-orders/:id/reschedule-requests",
    async (request, reply) => {
      const context = scope(request, reply, PERMISSIONS.MAINTENANCE_EXECUTE);
      if (!context) return;
      return result(
        reply,
        await repository.requestReschedule(
          context.hotelId,
          request.params.id,
          context.auth.session.id,
          request.body.requested_start,
          request.body.reason,
        ),
        true,
      );
    },
  );
  app.post<{ Params: IdParams; Body: MaintenanceRescheduleDecisionInput }>(
    "/admin/maintenance/reschedule-requests/:id/decision",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_SCHEDULE_MANAGE,
      );
      if (!context) return;
      return result(
        reply,
        await repository.decideReschedule(
          context.hotelId,
          request.params.id,
          context.auth.session.id,
          request.body.approved,
          request.body.reason,
        ),
      );
    },
  );
  app.post<{ Params: IdParams; Body: MaintenanceWaitingFollowupInput }>(
    "/admin/maintenance/work-orders/:id/waiting-follow-ups",
    async (request, reply) => {
      const context = scope(request, reply, PERMISSIONS.MAINTENANCE_EXECUTE);
      if (!context) return;
      return result(
        reply,
        await repository.followUp(
          context.hotelId,
          request.params.id,
          context.auth.session.id,
          request.body,
        ),
        true,
      );
    },
  );
  app.put<{ Params: IdParams; Body: MaintenanceAffectedRoomsInput }>(
    "/admin/maintenance/occurrences/:id/affected-rooms",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_SCHEDULE_MANAGE,
      );
      if (!context) return;
      return result(
        reply,
        await repository.updateAffectedRooms(
          context.hotelId,
          request.params.id,
          context.auth.session.id,
          request.body,
        ),
      );
    },
  );
  app.get<{ Params: IdParams }>(
    "/admin/maintenance/occurrences/:id/recurrence",
    async (request, reply) => {
      const context = readScope(request, reply);
      if (!context) return;
      return reply.send(
        await repository.recurrence(context.hotelId, request.params.id),
      );
    },
  );
  app.put<{ Body: MaintenanceRecurrencePolicyInput }>(
    "/admin/maintenance/recurrence-policy",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_SCHEDULE_MANAGE,
      );
      if (!context) return;
      return result(
        reply,
        await repository.saveRecurrencePolicy(
          context.hotelId,
          context.auth.session.id,
          request.body,
        ),
      );
    },
  );
  app.post<{ Params: IdParams; Body: MaintenanceRecurrenceActionInput }>(
    "/admin/maintenance/recurrence-groups/:id/actions",
    async (request, reply) => {
      const context = scope(request, reply, PERMISSIONS.MAINTENANCE_TRIAGE);
      if (!context) return;
      return result(
        reply,
        await repository.actRecurrence(
          context.hotelId,
          request.params.id,
          context.auth.session.id,
          request.body,
        ),
      );
    },
  );
  app.post<{ Params: IdParams; Body: MaintenanceLifecycleCreateInput }>(
    "/admin/maintenance/occurrences/:id/lifecycle-decisions",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_LIFECYCLE_PROPOSE,
      );
      if (!context) return;
      return result(
        reply,
        await repository.createLifecycle(
          context.hotelId,
          request.params.id,
          context.auth.session.id,
          request.body,
        ),
        true,
      );
    },
  );
  app.post<{ Params: IdParams; Body: MaintenanceLifecycleActionInput }>(
    "/admin/maintenance/lifecycle-decisions/:id/actions",
    async (request, reply) => {
      const permission =
        request.body.action === "approve" || request.body.action === "reject"
          ? PERMISSIONS.MAINTENANCE_LIFECYCLE_APPROVE
          : PERMISSIONS.MAINTENANCE_LIFECYCLE_PROPOSE;
      const context = scope(request, reply, permission);
      if (!context) return;
      return result(
        reply,
        await repository.actLifecycle(
          context.hotelId,
          request.params.id,
          context.auth.session.id,
          request.body,
        ),
      );
    },
  );
  app.post<{ Params: IdParams; Body: MaintenanceServiceConfirmationInput }>(
    "/admin/maintenance/work-orders/:id/service-confirmations",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_SERVICE_CONFIRM,
      );
      if (!context) return;
      return result(
        reply,
        await repository.confirmService(
          context.hotelId,
          request.params.id,
          context.auth.session.id,
          request.body,
        ),
        true,
      );
    },
  );
  app.post<{ Params: IdParams; Body: MaintenanceServiceCommunicationInput }>(
    "/admin/maintenance/work-orders/:id/service-communications",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_SCHEDULE_MANAGE,
      );
      if (!context) return;
      return result(
        reply,
        await repository.recordCommunication(
          context.hotelId,
          request.params.id,
          context.auth.session.id,
          request.body,
        ),
        true,
      );
    },
  );
  app.post("/admin/maintenance/planning/reconcile", async (request, reply) => {
    const context = scope(
      request,
      reply,
      PERMISSIONS.MAINTENANCE_SCHEDULE_MANAGE,
    );
    if (!context) return;
    return result(reply, await repository.reconcile(context.hotelId));
  });
}
