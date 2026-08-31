import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  ADMIN_ERROR_CODE,
  PERMISSIONS,
  type AdminMaintenanceOccurrenceCreateInput,
  type AdminMaintenanceWorkOrderCreateInput,
  type HotelIdParams,
  type MaintenancePriority,
  type PermissionName,
  type SessionPayload,
  type AdminMaintenanceOccurrenceDetail,
} from "@hotel/shared";
import {
  ensureAuthorizedAnyWithScope,
  ensureAuthorizedWithScope,
} from "../auth/authorization";
import { adminError } from "../common/adminError";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import { normalizeOptionalText } from "../common/text";
import {
  createMaintenanceRepository,
  type MaintenanceListFilters,
  type MaintenanceRepository,
} from "../repositories/maintenanceRepository";

type ListQuery = Record<string, string | undefined>;
type ReasonBody = { reason?: string };
type DuplicateBody = { duplicate_of_id?: string; reason?: string };
type CatalogBody = {
  name?: string;
  description?: string | null;
  display_order?: number;
  is_active?: boolean;
  kind?: "area" | "equipment";
  parent_location_id?: string | null;
};
type TriageBody = {
  category_id?: string;
  priority?: MaintenancePriority;
  suspected_party?: string | null;
  liability_notes?: string | null;
};
type LiabilityBody = {
  decision?: "confirmed" | "dismissed";
  party?: string | null;
  notes?: string;
};
type TransitionBody = {
  action?: string;
  assigned_to?: string | null;
  waiting_reason?: string;
  notes?: string;
  diagnosis?: string;
};
type InspectionBody = { result?: "approved" | "rejected"; notes?: string };
type BlockBody = {
  start_date?: string;
  end_date?: string;
  status?: "blocked" | "maintenance";
  label?: string;
  conflict_acknowledgement?: string;
};
type AttachmentIntentBody = {
  files?: Array<{ filename: string; content_type: string; size_bytes: number }>;
};
type AttachmentFinalizeBody = { files?: Array<Record<string, unknown>> };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PRIORITIES = new Set(["low", "normal", "high", "critical"]);
const STATUSES = new Set([
  "reported",
  "triaged",
  "in_progress",
  "awaiting_inspection",
  "awaiting_liability",
  "resolved",
  "canceled",
]);

function permissionList(): PermissionName[] {
  return [
    PERMISSIONS.MAINTENANCE_READ,
    PERMISSIONS.MAINTENANCE_OCCURRENCE_CREATE,
    PERMISSIONS.MAINTENANCE_TRIAGE,
    PERMISSIONS.MAINTENANCE_EXECUTE,
    PERMISSIONS.MAINTENANCE_BLOCK_MANAGE,
    PERMISSIONS.MAINTENANCE_INSPECT,
    PERMISSIONS.MAINTENANCE_LIABILITY_CONFIRM,
    PERMISSIONS.MAINTENANCE_CATALOG_MANAGE,
  ];
}

function requireAnyScope(
  request: FastifyRequest,
  reply: FastifyReply,
  permissions: PermissionName[],
) {
  const auth = ensureAuthorizedAnyWithScope(request, reply, permissions);
  if (!auth) return null;
  const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
  return hotelId ? { ...auth, hotelId } : null;
}

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  max: number,
): number | null {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= max
    ? parsed
    : null;
}

function booleanQuery(value: string | undefined): boolean | undefined | null {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function resultError(
  reply: FastifyReply,
  result: "not-found" | "conflict",
  notFound: string,
  conflict: string,
) {
  return result === "not-found"
    ? reply.status(404).send(adminError(ADMIN_ERROR_CODE.NOT_FOUND, notFound))
    : reply.status(409).send(adminError(ADMIN_ERROR_CODE.CONFLICT, conflict));
}

function canReadOccurrence(
  session: SessionPayload,
  item: AdminMaintenanceOccurrenceDetail,
): boolean {
  const broadContext = [
    PERMISSIONS.MAINTENANCE_READ,
    PERMISSIONS.MAINTENANCE_TRIAGE,
    PERMISSIONS.MAINTENANCE_BLOCK_MANAGE,
    PERMISSIONS.MAINTENANCE_INSPECT,
    PERMISSIONS.MAINTENANCE_LIABILITY_CONFIRM,
  ].some((permission) => session.permissions.includes(permission));
  return (
    broadContext ||
    item.reported_by === session.id ||
    item.work_orders.some((order) => order.assigned_to === session.id)
  );
}

export function registerMaintenanceRoutes(
  app: FastifyInstance,
  repository: MaintenanceRepository = createMaintenanceRepository(),
): void {
  app.get<{ Querystring: ListQuery }>(
    "/admin/maintenance/occurrences",
    async (request, reply) => {
      const auth = requireAnyScope(request, reply, permissionList());
      if (!auth) return;
      const page = parsePositiveInt(request.query.page, 1, 100000);
      const pageSize = parsePositiveInt(request.query.page_size, 20, 100);
      const overdue = booleanQuery(request.query.overdue);
      const blocked = booleanQuery(request.query.blocked);
      if (
        !page ||
        !pageSize ||
        overdue === null ||
        blocked === null ||
        (request.query.status && !STATUSES.has(request.query.status)) ||
        (request.query.priority && !PRIORITIES.has(request.query.priority))
      ) {
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Filtros de manutenção inválidos.",
            ),
          );
      }
      const filters: MaintenanceListFilters = {
        page,
        pageSize,
        status: request.query.status,
        priority: request.query.priority,
        categoryId: request.query.category_id,
        roomId: request.query.room_id,
        locationId: request.query.location_id,
        assignedTo:
          request.query.assigned_to === "me"
            ? auth.session.id
            : request.query.assigned_to === "unassigned"
              ? undefined
              : request.query.assigned_to,
        unassigned: request.query.assigned_to === "unassigned" || undefined,
        overdue: overdue || undefined,
        blocked: blocked === undefined ? undefined : blocked,
        search: normalizeOptionalText(request.query.search) || undefined,
      };
      const canReadAll = [
        PERMISSIONS.MAINTENANCE_READ,
        PERMISSIONS.MAINTENANCE_TRIAGE,
        PERMISSIONS.MAINTENANCE_BLOCK_MANAGE,
        PERMISSIONS.MAINTENANCE_INSPECT,
        PERMISSIONS.MAINTENANCE_LIABILITY_CONFIRM,
      ].some((permission) => auth.session.permissions.includes(permission));
      const data = await repository
        .listOccurrences(
          auth.hotelId,
          filters,
          canReadAll ? undefined : auth.session.id,
        )
        .catch((error) => {
          request.log.error(error);
          return null;
        });
      if (!data)
        return reply
          .status(500)
          .send(
            adminError(
              ADMIN_ERROR_CODE.INTERNAL,
              "Falha ao consultar ocorrências de manutenção.",
            ),
          );
      return reply.send(data);
    },
  );

  app.post<{ Body: Partial<AdminMaintenanceOccurrenceCreateInput> }>(
    "/admin/maintenance/occurrences",
    async (request, reply) => {
      const auth = ensureAuthorizedWithScope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_OCCURRENCE_CREATE,
      );
      if (!auth) return;
      const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
      if (!hotelId) return;
      const body = request.body || {};
      const description = normalizeOptionalText(body.description);
      const hasRoom = validUuid(body.room_id);
      const hasLocation = validUuid(body.location_id);
      if (
        !validUuid(body.category_id) ||
        !description ||
        hasRoom === hasLocation ||
        (body.stay_id && !validUuid(body.stay_id))
      ) {
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Dados inválidos para registrar ocorrência.",
            ),
          );
      }
      const item = await repository
        .createOccurrence(hotelId, auth.session.id, {
          ...body,
          description,
        } as AdminMaintenanceOccurrenceCreateInput)
        .catch((error) => {
          request.log.error(error);
          return null;
        });
      if (!item)
        return reply
          .status(409)
          .send(
            adminError(
              ADMIN_ERROR_CODE.CONFLICT,
              "Os vínculos da ocorrência não pertencem ao hotel ativo.",
            ),
          );
      return reply.status(201).send({ item });
    },
  );

  app.get<{ Params: HotelIdParams }>(
    "/admin/maintenance/occurrences/:id",
    async (request, reply) => {
      const auth = requireAnyScope(request, reply, permissionList());
      if (!auth) return;
      const item = await repository
        .getOccurrence(auth.hotelId, request.params.id)
        .catch((error) => {
          request.log.error(error);
          return null;
        });
      if (!item)
        return reply
          .status(404)
          .send(
            adminError(
              ADMIN_ERROR_CODE.NOT_FOUND,
              "Ocorrência não encontrada neste hotel.",
            ),
          );
      if (!canReadOccurrence(auth.session, item))
        return reply
          .status(403)
          .send(
            adminError(
              ADMIN_ERROR_CODE.FORBIDDEN,
              "Sem permissão para consultar esta ocorrência.",
            ),
          );
      return reply.send({ item });
    },
  );

  app.post<{ Params: HotelIdParams; Body: TriageBody }>(
    "/admin/maintenance/occurrences/:id/triage",
    async (request, reply) => {
      const auth = ensureAuthorizedWithScope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_TRIAGE,
      );
      if (!auth) return;
      const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
      if (!hotelId) return;
      const payload: Record<string, unknown> = {
        triaged_by: auth.session.id,
        triaged_at: new Date().toISOString(),
        status: "triaged",
      };
      if (request.body.category_id)
        payload.category_id = request.body.category_id;
      if (request.body.priority) payload.priority = request.body.priority;
      if (request.body.suspected_party) {
        payload.liability_status = "suspected";
        payload.suspected_party = request.body.suspected_party;
        payload.liability_notes = normalizeOptionalText(
          request.body.liability_notes,
        );
      }
      const result = await repository.updateOccurrence(
        hotelId,
        request.params.id,
        payload,
        auth.session.id,
        "occurrence_triaged",
      );
      if (result.result !== "ok")
        return resultError(
          reply,
          result.result,
          "Ocorrência não encontrada.",
          "Falha ao triar ocorrência.",
        );
      return reply.send({ item: result.item });
    },
  );

  app.post<{ Params: HotelIdParams; Body: ReasonBody }>(
    "/admin/maintenance/occurrences/:id/comments",
    async (request, reply) => {
      const auth = requireAnyScope(request, reply, permissionList());
      if (!auth) return;
      const reason = normalizeOptionalText(request.body.reason);
      if (!reason || reason.length < 3)
        return reply
          .status(400)
          .send(
            adminError(ADMIN_ERROR_CODE.VALIDATION, "Comentário obrigatório."),
          );
      const result = await repository.addComment(
        auth.hotelId,
        request.params.id,
        auth.session.id,
        reason,
      );
      if (result.result !== "ok")
        return resultError(
          reply,
          result.result,
          "Ocorrência não encontrada.",
          "Falha ao comentar ocorrência.",
        );
      return reply.send({ item: result.item });
    },
  );

  app.post<{ Params: HotelIdParams; Body: ReasonBody }>(
    "/admin/maintenance/occurrences/:id/cancel",
    async (request, reply) => {
      const auth = ensureAuthorizedWithScope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_TRIAGE,
      );
      if (!auth) return;
      const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
      if (!hotelId) return;
      const reason = normalizeOptionalText(request.body.reason);
      if (!reason)
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Justificativa obrigatória.",
            ),
          );
      const existing = await repository.getOccurrence(
        hotelId,
        request.params.id,
      );
      if (!existing)
        return reply
          .status(404)
          .send(
            adminError(
              ADMIN_ERROR_CODE.NOT_FOUND,
              "Ocorrência não encontrada.",
            ),
          );
      if (
        existing.active_block ||
        existing.work_orders.some(
          (order) => !["completed", "canceled"].includes(order.status),
        )
      )
        return reply
          .status(409)
          .send(
            adminError(
              ADMIN_ERROR_CODE.CONFLICT,
              "Libere bloqueios e encerre ordens antes de cancelar.",
            ),
          );
      const result = await repository.updateOccurrence(
        hotelId,
        request.params.id,
        { status: "canceled", canceled_reason: reason, resolved_at: null },
        auth.session.id,
        "occurrence_canceled",
        reason,
      );
      return result.result === "ok"
        ? reply.send({ item: result.item })
        : resultError(
            reply,
            result.result,
            "Ocorrência não encontrada.",
            "Falha ao cancelar.",
          );
    },
  );

  app.post<{ Params: HotelIdParams; Body: DuplicateBody }>(
    "/admin/maintenance/occurrences/:id/duplicate",
    async (request, reply) => {
      const auth = ensureAuthorizedWithScope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_TRIAGE,
      );
      if (!auth) return;
      const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
      if (!hotelId) return;
      const reason = normalizeOptionalText(request.body.reason);
      if (
        !validUuid(request.body.duplicate_of_id) ||
        request.body.duplicate_of_id === request.params.id ||
        !reason
      )
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Ocorrência canônica e justificativa são obrigatórias.",
            ),
          );
      const [existing, canonical] = await Promise.all([
        repository.getOccurrence(hotelId, request.params.id),
        repository.getOccurrence(hotelId, request.body.duplicate_of_id),
      ]);
      if (!existing || !canonical)
        return reply
          .status(404)
          .send(
            adminError(
              ADMIN_ERROR_CODE.NOT_FOUND,
              "Ocorrência não encontrada.",
            ),
          );
      if (
        existing.active_block ||
        existing.work_orders.some(
          (order) => !["completed", "canceled"].includes(order.status),
        )
      )
        return reply
          .status(409)
          .send(
            adminError(
              ADMIN_ERROR_CODE.CONFLICT,
              "Libere bloqueios e encerre ordens antes de marcar duplicidade.",
            ),
          );
      const result = await repository.updateOccurrence(
        hotelId,
        request.params.id,
        {
          status: "canceled",
          duplicate_of_id: canonical.id,
          canceled_reason: reason,
          resolved_at: null,
        },
        auth.session.id,
        "occurrence_marked_duplicate",
        reason,
      );
      return result.result === "ok"
        ? reply.send({ item: result.item })
        : resultError(
            reply,
            result.result,
            "Ocorrência não encontrada.",
            "Falha ao marcar duplicidade.",
          );
    },
  );

  app.post<{ Params: HotelIdParams; Body: ReasonBody }>(
    "/admin/maintenance/occurrences/:id/reopen",
    async (request, reply) => {
      const auth = ensureAuthorizedWithScope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_TRIAGE,
      );
      if (!auth) return;
      const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
      if (!hotelId) return;
      const reason = normalizeOptionalText(request.body.reason);
      if (!reason)
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Justificativa obrigatória.",
            ),
          );
      const existing = await repository.getOccurrence(
        hotelId,
        request.params.id,
      );
      if (!existing)
        return reply
          .status(404)
          .send(
            adminError(
              ADMIN_ERROR_CODE.NOT_FOUND,
              "Ocorrência não encontrada.",
            ),
          );
      if (!["resolved", "canceled"].includes(existing.status))
        return reply
          .status(409)
          .send(
            adminError(
              ADMIN_ERROR_CODE.CONFLICT,
              "Somente ocorrências encerradas podem ser reabertas.",
            ),
          );
      const result = await repository.updateOccurrence(
        hotelId,
        request.params.id,
        {
          status: "triaged",
          canceled_reason: null,
          resolved_at: null,
          triaged_at: new Date().toISOString(),
          triaged_by: auth.session.id,
        },
        auth.session.id,
        "occurrence_reopened",
        reason,
      );
      return result.result === "ok"
        ? reply.send({ item: result.item })
        : resultError(
            reply,
            result.result,
            "Ocorrência não encontrada.",
            "Falha ao reabrir.",
          );
    },
  );

  app.post<{ Params: HotelIdParams; Body: { party?: string; notes?: string } }>(
    "/admin/maintenance/occurrences/:id/liability/suspect",
    async (request, reply) => {
      const auth = ensureAuthorizedWithScope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_TRIAGE,
      );
      if (!auth) return;
      const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
      if (!hotelId) return;
      const notes = normalizeOptionalText(request.body.notes);
      if (!request.body.party || !notes)
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Responsável provável e justificativa são obrigatórios.",
            ),
          );
      const result = await repository.updateOccurrence(
        hotelId,
        request.params.id,
        {
          liability_status: "suspected",
          suspected_party: request.body.party,
          confirmed_party: null,
          liability_notes: notes,
          liability_decided_by: null,
          liability_decided_at: null,
        },
        auth.session.id,
        "liability_suspected",
        notes,
      );
      return result.result === "ok"
        ? reply.send({ item: result.item })
        : resultError(
            reply,
            result.result,
            "Ocorrência não encontrada.",
            "Falha ao registrar suspeita.",
          );
    },
  );

  app.post<{ Params: HotelIdParams; Body: LiabilityBody }>(
    "/admin/maintenance/occurrences/:id/liability/decide",
    async (request, reply) => {
      const auth = ensureAuthorizedWithScope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_LIABILITY_CONFIRM,
      );
      if (!auth) return;
      const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
      if (!hotelId) return;
      const notes = normalizeOptionalText(request.body.notes);
      if (
        !notes ||
        !request.body.decision ||
        (request.body.decision === "confirmed" && !request.body.party)
      )
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Decisão, responsável e justificativa inválidos.",
            ),
          );
      const payload =
        request.body.decision === "confirmed"
          ? {
              liability_status: "confirmed",
              confirmed_party: request.body.party,
              liability_notes: notes,
              liability_decided_by: auth.session.id,
              liability_decided_at: new Date().toISOString(),
            }
          : {
              liability_status: "dismissed",
              confirmed_party: null,
              liability_notes: notes,
              liability_decided_by: auth.session.id,
              liability_decided_at: new Date().toISOString(),
            };
      const result = await repository.updateOccurrence(
        hotelId,
        request.params.id,
        payload,
        auth.session.id,
        `liability_${request.body.decision}`,
        notes,
      );
      return result.result === "ok"
        ? reply.send({ item: result.item })
        : resultError(
            reply,
            result.result,
            "Ocorrência não encontrada.",
            "Falha ao decidir responsabilidade.",
          );
    },
  );

  app.post<{
    Params: HotelIdParams;
    Body: Partial<AdminMaintenanceWorkOrderCreateInput>;
  }>(
    "/admin/maintenance/occurrences/:id/work-orders",
    async (request, reply) => {
      const auth = ensureAuthorizedWithScope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_TRIAGE,
      );
      if (!auth) return;
      const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
      if (!hotelId) return;
      if (
        !normalizeOptionalText(request.body.title) ||
        !normalizeOptionalText(request.body.instructions)
      )
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Título e instruções são obrigatórios.",
            ),
          );
      const result = await repository.createWorkOrder(
        hotelId,
        request.params.id,
        auth.session.id,
        request.body as Record<string, unknown>,
      );
      if (result.result !== "ok")
        return resultError(
          reply,
          result.result,
          "Ocorrência não encontrada.",
          "Dados da ordem conflitam com o hotel ativo.",
        );
      return reply.status(201).send({ item: result.item });
    },
  );

  app.post<{ Params: HotelIdParams; Body: TransitionBody }>(
    "/admin/maintenance/work-orders/:id/transition",
    async (request, reply) => {
      const auth = requireAnyScope(request, reply, [
        PERMISSIONS.MAINTENANCE_EXECUTE,
        PERMISSIONS.MAINTENANCE_TRIAGE,
      ]);
      if (!auth) return;
      if (!request.body.action)
        return reply
          .status(400)
          .send(
            adminError(ADMIN_ERROR_CODE.VALIDATION, "Transição obrigatória."),
          );
      if (!auth.session.permissions.includes(PERMISSIONS.MAINTENANCE_TRIAGE)) {
        const order = await repository.getWorkOrderAccess(
          auth.hotelId,
          request.params.id,
        );
        if (!order)
          return reply
            .status(404)
            .send(
              adminError(ADMIN_ERROR_CODE.NOT_FOUND, "Ordem não encontrada."),
            );
        if (order.assignedTo !== auth.session.id)
          return reply
            .status(403)
            .send(
              adminError(
                ADMIN_ERROR_CODE.FORBIDDEN,
                "O executor acessa somente ordens atribuídas a ele.",
              ),
            );
      }
      const result = await repository.transitionWorkOrder(
        auth.hotelId,
        request.params.id,
        auth.session.id,
        request.body as Record<string, unknown>,
      );
      if (result.result !== "ok")
        return resultError(
          reply,
          result.result,
          "Ordem não encontrada.",
          "Transição não permitida para o estado atual.",
        );
      return reply.send({ item: result.item });
    },
  );

  app.post<{ Params: HotelIdParams; Body: InspectionBody }>(
    "/admin/maintenance/work-orders/:id/inspect",
    async (request, reply) => {
      const auth = ensureAuthorizedWithScope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_INSPECT,
      );
      if (!auth) return;
      const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
      if (!hotelId) return;
      const notes = normalizeOptionalText(request.body.notes);
      if (!request.body.result || !notes)
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Resultado e observação são obrigatórios.",
            ),
          );
      const result = await repository.inspectWorkOrder(
        hotelId,
        request.params.id,
        auth.session.id,
        request.body.result,
        notes,
      );
      if (result.result !== "ok")
        return resultError(
          reply,
          result.result,
          "Ordem não encontrada.",
          "Inspeção não permitida, inclusive pelo próprio executor.",
        );
      return reply.send({ item: result.item });
    },
  );

  app.post<{ Params: HotelIdParams; Body: BlockBody }>(
    "/admin/maintenance/occurrences/:id/room-blocks",
    async (request, reply) => {
      const auth = ensureAuthorizedWithScope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_BLOCK_MANAGE,
      );
      if (!auth) return;
      const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
      if (!hotelId) return;
      if (
        !request.body.start_date ||
        !request.body.end_date ||
        !DATE_PATTERN.test(request.body.start_date) ||
        !DATE_PATTERN.test(request.body.end_date) ||
        request.body.end_date < request.body.start_date
      )
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Período de bloqueio inválido.",
            ),
          );
      const result = await repository.createRoomBlock(
        hotelId,
        request.params.id,
        auth.session.id,
        {
          start_date: request.body.start_date,
          end_date: request.body.end_date,
          status: request.body.status || "maintenance",
          label: normalizeOptionalText(request.body.label),
          conflict_acknowledgement: normalizeOptionalText(
            request.body.conflict_acknowledgement,
          ),
        },
      );
      if (result.result === "not-found")
        return reply
          .status(404)
          .send(
            adminError(
              ADMIN_ERROR_CODE.NOT_FOUND,
              "Ocorrência de quarto não encontrada.",
            ),
          );
      if (result.result === "conflict")
        return reply
          .status(409)
          .send(
            adminError(
              ADMIN_ERROR_CODE.CONFLICT,
              result.conflicts?.length
                ? "Existem estadias conflitantes; confirme ciência e justifique."
                : "Período conflita com outro bloqueio.",
              result.conflicts ? JSON.stringify(result.conflicts) : undefined,
            ),
          );
      return reply.status(201).send({ item: result.item });
    },
  );

  app.post<{ Params: HotelIdParams; Body: ReasonBody }>(
    "/admin/maintenance/room-blocks/:id/release",
    async (request, reply) => {
      const auth = ensureAuthorizedWithScope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_BLOCK_MANAGE,
      );
      if (!auth) return;
      const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
      if (!hotelId) return;
      const reason = normalizeOptionalText(request.body.reason);
      if (!reason)
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Justificativa obrigatória.",
            ),
          );
      const result = await repository.releaseRoomBlock(
        hotelId,
        request.params.id,
        auth.session.id,
        reason,
      );
      if (result.result !== "ok")
        return resultError(
          reply,
          result.result,
          "Bloqueio não encontrado.",
          "Inspeções obrigatórias ainda estão pendentes.",
        );
      return reply.send({ item: result.item });
    },
  );

  app.get("/admin/maintenance/categories", async (request, reply) => {
    const auth = requireAnyScope(request, reply, permissionList());
    if (!auth) return;
    return reply.send({ items: await repository.listCategories(auth.hotelId) });
  });
  app.post<{ Body: CatalogBody }>(
    "/admin/maintenance/categories",
    async (request, reply) => {
      const auth = ensureAuthorizedWithScope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_CATALOG_MANAGE,
      );
      if (!auth) return;
      const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
      if (!hotelId) return;
      const name = normalizeOptionalText(request.body.name);
      if (!name)
        return reply
          .status(400)
          .send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Nome obrigatório."));
      const result = await repository.writeCategory(hotelId, null, {
        name,
        description: normalizeOptionalText(request.body.description),
        display_order: request.body.display_order || 0,
        is_active: request.body.is_active ?? true,
      });
      if (result.result !== "ok")
        return resultError(
          reply,
          result.result,
          "Categoria não encontrada.",
          "Categoria já cadastrada.",
        );
      return reply.status(201).send({ item: result.item });
    },
  );
  app.put<{ Params: HotelIdParams; Body: CatalogBody }>(
    "/admin/maintenance/categories/:id",
    async (request, reply) => {
      const auth = ensureAuthorizedWithScope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_CATALOG_MANAGE,
      );
      if (!auth) return;
      const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
      if (!hotelId) return;
      const payload: Record<string, unknown> = {};
      if (request.body.name !== undefined)
        payload.name = normalizeOptionalText(request.body.name);
      if (request.body.description !== undefined)
        payload.description = normalizeOptionalText(request.body.description);
      if (request.body.display_order !== undefined)
        payload.display_order = request.body.display_order;
      if (request.body.is_active !== undefined)
        payload.is_active = request.body.is_active;
      const result = await repository.writeCategory(
        hotelId,
        request.params.id,
        payload,
      );
      if (result.result !== "ok")
        return resultError(
          reply,
          result.result,
          "Categoria não encontrada.",
          "Categoria duplicada.",
        );
      return reply.send({ item: result.item });
    },
  );
  app.get("/admin/maintenance/locations", async (request, reply) => {
    const auth = requireAnyScope(request, reply, permissionList());
    if (!auth) return;
    return reply.send({ items: await repository.listLocations(auth.hotelId) });
  });
  app.post<{ Body: CatalogBody }>(
    "/admin/maintenance/locations",
    async (request, reply) => {
      const auth = ensureAuthorizedWithScope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_CATALOG_MANAGE,
      );
      if (!auth) return;
      const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
      if (!hotelId) return;
      const name = normalizeOptionalText(request.body.name);
      if (!name || !request.body.kind)
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Nome e tipo são obrigatórios.",
            ),
          );
      const result = await repository.writeLocation(hotelId, null, {
        name,
        kind: request.body.kind,
        parent_location_id:
          request.body.kind === "equipment"
            ? request.body.parent_location_id || null
            : null,
        description: normalizeOptionalText(request.body.description),
        display_order: request.body.display_order || 0,
        is_active: request.body.is_active ?? true,
      });
      if (result.result !== "ok")
        return resultError(
          reply,
          result.result,
          "Local não encontrado.",
          "Local duplicado ou inválido.",
        );
      return reply.status(201).send({ item: result.item });
    },
  );
  app.put<{ Params: HotelIdParams; Body: CatalogBody }>(
    "/admin/maintenance/locations/:id",
    async (request, reply) => {
      const auth = ensureAuthorizedWithScope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_CATALOG_MANAGE,
      );
      if (!auth) return;
      const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
      if (!hotelId) return;
      const payload = {
        ...request.body,
        name:
          request.body.name === undefined
            ? undefined
            : normalizeOptionalText(request.body.name),
        description:
          request.body.description === undefined
            ? undefined
            : normalizeOptionalText(request.body.description),
      };
      Object.keys(payload).forEach(
        (key) =>
          payload[key as keyof typeof payload] === undefined &&
          delete payload[key as keyof typeof payload],
      );
      const result = await repository.writeLocation(
        hotelId,
        request.params.id,
        payload,
      );
      if (result.result !== "ok")
        return resultError(
          reply,
          result.result,
          "Local não encontrado.",
          "Local duplicado ou inválido.",
        );
      return reply.send({ item: result.item });
    },
  );

  app.get("/admin/maintenance/reference-data", async (request, reply) => {
    const auth = requireAnyScope(request, reply, permissionList());
    if (!auth) return;
    return reply.send(await repository.getReferenceData(auth.hotelId));
  });
  app.get("/admin/maintenance/summary", async (request, reply) => {
    const auth = requireAnyScope(request, reply, permissionList());
    if (!auth) return;
    return reply.send(
      await repository.getSummary(auth.hotelId, auth.session.id),
    );
  });

  app.post<{ Params: HotelIdParams; Body: AttachmentIntentBody }>(
    "/admin/maintenance/occurrences/:id/attachments/upload-intents",
    async (request, reply) => {
      const auth = requireAnyScope(request, reply, [
        PERMISSIONS.MAINTENANCE_OCCURRENCE_CREATE,
        PERMISSIONS.MAINTENANCE_TRIAGE,
        PERMISSIONS.MAINTENANCE_EXECUTE,
      ]);
      if (!auth) return;
      const occurrence = await repository.getOccurrence(
        auth.hotelId,
        request.params.id,
      );
      if (!occurrence)
        return reply
          .status(404)
          .send(
            adminError(
              ADMIN_ERROR_CODE.NOT_FOUND,
              "Ocorrência não encontrada.",
            ),
          );
      const canAttach =
        auth.session.permissions.includes(PERMISSIONS.MAINTENANCE_TRIAGE) ||
        occurrence.reported_by === auth.session.id ||
        (auth.session.permissions.includes(PERMISSIONS.MAINTENANCE_EXECUTE) &&
          occurrence.work_orders.some(
            (order) => order.assigned_to === auth.session.id,
          ));
      if (!canAttach)
        return reply
          .status(403)
          .send(
            adminError(
              ADMIN_ERROR_CODE.FORBIDDEN,
              "Sem permissão para anexar fotos a esta ocorrência.",
            ),
          );
      const files = request.body.files || [];
      if (
        !files.length ||
        files.length > 5 ||
        files.some(
          (file) =>
            !["image/jpeg", "image/png", "image/webp"].includes(
              file.content_type,
            ) ||
            file.size_bytes <= 0 ||
            file.size_bytes > 10485760,
        )
      )
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Seleção de fotos inválida.",
            ),
          );
      const count = await repository.countAttachments(
        auth.hotelId,
        occurrence.id,
      );
      if (count + files.length > 20)
        return reply
          .status(409)
          .send(
            adminError(
              ADMIN_ERROR_CODE.CONFLICT,
              "Limite de vinte fotos por ocorrência excedido.",
            ),
          );
      const items = await Promise.all(
        files.map((file) =>
          repository.createUploadIntent(
            auth.hotelId,
            occurrence.id,
            file.filename,
          ),
        ),
      );
      return reply.send({ items });
    },
  );
  app.post<{ Params: HotelIdParams; Body: AttachmentFinalizeBody }>(
    "/admin/maintenance/occurrences/:id/attachments/finalize",
    async (request, reply) => {
      const auth = requireAnyScope(request, reply, [
        PERMISSIONS.MAINTENANCE_OCCURRENCE_CREATE,
        PERMISSIONS.MAINTENANCE_TRIAGE,
        PERMISSIONS.MAINTENANCE_EXECUTE,
      ]);
      if (!auth) return;
      const occurrence = await repository.getOccurrence(
        auth.hotelId,
        request.params.id,
      );
      if (!occurrence)
        return reply
          .status(404)
          .send(
            adminError(
              ADMIN_ERROR_CODE.NOT_FOUND,
              "Ocorrência não encontrada.",
            ),
          );
      const canAttach =
        auth.session.permissions.includes(PERMISSIONS.MAINTENANCE_TRIAGE) ||
        occurrence.reported_by === auth.session.id ||
        (auth.session.permissions.includes(PERMISSIONS.MAINTENANCE_EXECUTE) &&
          occurrence.work_orders.some(
            (order) => order.assigned_to === auth.session.id,
          ));
      if (!canAttach)
        return reply
          .status(403)
          .send(
            adminError(
              ADMIN_ERROR_CODE.FORBIDDEN,
              "Sem permissão para confirmar fotos desta ocorrência.",
            ),
          );
      const files = request.body.files || [];
      if (!files.length || files.length > 5)
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Fotos obrigatórias para confirmação.",
            ),
          );
      const result = await repository.finalizeAttachments(
        auth.hotelId,
        request.params.id,
        auth.session.id,
        files,
      );
      if (result.result !== "ok")
        return resultError(
          reply,
          result.result,
          "Ocorrência não encontrada.",
          "Fotos inválidas ou já confirmadas.",
        );
      return reply.send({ item: result.item });
    },
  );
  app.post<{ Params: HotelIdParams }>(
    "/admin/maintenance/attachments/:id/access",
    async (request, reply) => {
      const auth = requireAnyScope(request, reply, permissionList());
      if (!auth) return;
      const occurrenceId = await repository.getAttachmentOccurrenceId(
        auth.hotelId,
        request.params.id,
      );
      const occurrence = occurrenceId
        ? await repository.getOccurrence(auth.hotelId, occurrenceId)
        : null;
      if (!occurrence)
        return reply
          .status(404)
          .send(adminError(ADMIN_ERROR_CODE.NOT_FOUND, "Foto não encontrada."));
      if (!canReadOccurrence(auth.session, occurrence))
        return reply
          .status(403)
          .send(
            adminError(
              ADMIN_ERROR_CODE.FORBIDDEN,
              "Sem permissão para consultar esta foto.",
            ),
          );
      const result = await repository.createAttachmentAccess(
        auth.hotelId,
        request.params.id,
      );
      return result
        ? reply.send(result)
        : reply
            .status(404)
            .send(
              adminError(ADMIN_ERROR_CODE.NOT_FOUND, "Foto não encontrada."),
            );
    },
  );
  app.post<{ Params: HotelIdParams; Body: ReasonBody }>(
    "/admin/maintenance/attachments/:id/remove",
    async (request, reply) => {
      const auth = requireAnyScope(request, reply, [
        PERMISSIONS.MAINTENANCE_OCCURRENCE_CREATE,
        PERMISSIONS.MAINTENANCE_TRIAGE,
      ]);
      if (!auth) return;
      const reason = normalizeOptionalText(request.body.reason);
      if (!reason)
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Justificativa obrigatória.",
            ),
          );
      const result = await repository.removeAttachment(
        auth.hotelId,
        request.params.id,
        auth.session.id,
        reason,
      );
      if (result.result !== "ok")
        return resultError(
          reply,
          result.result,
          "Foto não encontrada.",
          "Falha ao remover foto.",
        );
      return reply.send({ item: result.item });
    },
  );
}
