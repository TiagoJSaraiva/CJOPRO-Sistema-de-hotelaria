import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  ADMIN_ERROR_CODE,
  PERMISSIONS,
  type AdminMaintenancePreventivePlanInput,
  type PermissionName,
} from "@hotel/shared";
import {
  ensureAuthorizedAnyWithScope,
  ensureAuthorizedWithScope,
} from "../auth/authorization";
import { adminError } from "../common/adminError";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import { normalizeOptionalText } from "../common/text";
import {
  createMaintenanceManagementRepository,
  type MaintenanceManagementRepository,
} from "../repositories/maintenanceManagementRepository";
import {
  createMaintenanceRepository,
  type MaintenanceRepository,
} from "../repositories/maintenanceRepository";

type IdParams = { id: string };
type ChecklistParams = { id: string; itemId: string };
type Query = Record<string, string | undefined>;

const inboxPermissions: PermissionName[] = [
  PERMISSIONS.MAINTENANCE_READ,
  PERMISSIONS.MAINTENANCE_EXECUTE,
  PERMISSIONS.MAINTENANCE_TRIAGE,
  PERMISSIONS.MAINTENANCE_PLAN_MANAGE,
  PERMISSIONS.MAINTENANCE_SLA_MANAGE,
  PERMISSIONS.MAINTENANCE_SUPPLIER_MANAGE,
  PERMISSIONS.MAINTENANCE_ANALYTICS_READ,
];

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
  permissions = inboxPermissions,
) {
  const auth = ensureAuthorizedAnyWithScope(request, reply, permissions);
  if (!auth) return null;
  const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
  return hotelId ? { auth, hotelId } : null;
}

function write<T>(
  reply: FastifyReply,
  result: { result: string; item?: T },
  created = false,
) {
  if (result.result === "not-found")
    return reply
      .status(404)
      .send(
        adminError(
          ADMIN_ERROR_CODE.NOT_FOUND,
          "Registro não encontrado no hotel ativo.",
        ),
      );
  if (result.result !== "ok" || !result.item)
    return reply
      .status(409)
      .send(
        adminError(
          ADMIN_ERROR_CODE.CONFLICT,
          "A operação conflita com o estado atual ou com o escopo do hotel.",
        ),
      );
  return reply.status(created ? 201 : 200).send({ item: result.item });
}

function csv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "";
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const escape = (value: unknown) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [
    columns.map(escape).join(","),
    ...rows.map((row) =>
      columns.map((column) => escape(row[column])).join(","),
    ),
  ].join("\r\n");
}

export function registerMaintenanceManagementRoutes(
  app: FastifyInstance,
  repository: MaintenanceManagementRepository = createMaintenanceManagementRepository(),
  maintenance: MaintenanceRepository = createMaintenanceRepository(),
) {
  app.get("/admin/maintenance/preventive-plans", async (request, reply) => {
    const context = anyScope(request, reply, [
      PERMISSIONS.MAINTENANCE_PLAN_MANAGE,
      PERMISSIONS.MAINTENANCE_EXECUTE,
      PERMISSIONS.MAINTENANCE_READ,
      PERMISSIONS.MAINTENANCE_ANALYTICS_READ,
    ]);
    if (!context) return;
    return reply.send({ items: await repository.listPlans(context.hotelId) });
  });

  app.post<{ Body: AdminMaintenancePreventivePlanInput }>(
    "/admin/maintenance/preventive-plans",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_PLAN_MANAGE,
      );
      if (!context) return;
      return write(
        reply,
        await repository.savePlan(
          context.hotelId,
          context.auth.session.id,
          request.body,
        ),
        true,
      );
    },
  );

  app.get<{ Params: IdParams }>(
    "/admin/maintenance/preventive-plans/:id",
    async (request, reply) => {
      const context = anyScope(request, reply, [
        PERMISSIONS.MAINTENANCE_PLAN_MANAGE,
        PERMISSIONS.MAINTENANCE_EXECUTE,
        PERMISSIONS.MAINTENANCE_READ,
      ]);
      if (!context) return;
      const item = await repository.getPlan(context.hotelId, request.params.id);
      return item
        ? reply.send({ item })
        : reply
            .status(404)
            .send(
              adminError(ADMIN_ERROR_CODE.NOT_FOUND, "Plano não encontrado."),
            );
    },
  );

  app.put<{ Params: IdParams; Body: AdminMaintenancePreventivePlanInput }>(
    "/admin/maintenance/preventive-plans/:id",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_PLAN_MANAGE,
      );
      if (!context) return;
      return write(
        reply,
        await repository.savePlan(
          context.hotelId,
          context.auth.session.id,
          request.body,
          request.params.id,
        ),
      );
    },
  );

  for (const [path, status] of [
    ["/admin/maintenance/preventive-plans/:id/pause", "paused"],
    ["/admin/maintenance/preventive-plans/:id/resume", "active"],
    ["/admin/maintenance/preventive-plans/:id/deactivate", "inactive"],
  ] as const) {
    app.post<{ Params: IdParams }>(path, async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_PLAN_MANAGE,
      );
      if (!context) return;
      return write(
        reply,
        await repository.setPlanStatus(
          context.hotelId,
          context.auth.session.id,
          request.params.id,
          status,
        ),
      );
    });
  }

  app.get<{ Params: IdParams }>(
    "/admin/maintenance/preventive-plans/:id/runs",
    async (request, reply) => {
      const context = anyScope(request, reply, [
        PERMISSIONS.MAINTENANCE_PLAN_MANAGE,
        PERMISSIONS.MAINTENANCE_EXECUTE,
        PERMISSIONS.MAINTENANCE_READ,
      ]);
      if (!context) return;
      return reply.send({
        items: await repository.listRuns(context.hotelId, request.params.id),
      });
    },
  );

  for (const action of ["generate", "skip", "reschedule"] as const) {
    app.post<{
      Params: IdParams;
      Body: { reason?: string; scheduled_for?: string };
    }>(
      `/admin/maintenance/preventive-runs/:id/${action}`,
      async (request, reply) => {
        const context = scope(
          request,
          reply,
          PERMISSIONS.MAINTENANCE_PLAN_MANAGE,
        );
        if (!context) return;
        const reason = normalizeOptionalText(request.body?.reason);
        if (!reason)
          return reply
            .status(400)
            .send(
              adminError(
                ADMIN_ERROR_CODE.VALIDATION,
                "Justificativa obrigatória.",
              ),
            );
        return write(
          reply,
          await repository.decideRun(
            context.hotelId,
            context.auth.session.id,
            request.params.id,
            action,
            reason,
            request.body?.scheduled_for,
          ),
        );
      },
    );
  }

  app.post<{
    Params: ChecklistParams;
    Body: { completed?: boolean; notes?: string };
  }>(
    "/admin/maintenance/work-orders/:id/checklist/:itemId/complete",
    async (request, reply) => {
      const context = scope(request, reply, PERMISSIONS.MAINTENANCE_EXECUTE);
      if (!context) return;
      const orderAccess = await maintenance.getWorkOrderAccess(
        context.hotelId,
        request.params.id,
      );
      if (
        !orderAccess ||
        (orderAccess.assignedTo !== context.auth.session.id &&
          !context.auth.session.permissions.includes(
            PERMISSIONS.MAINTENANCE_TRIAGE,
          ))
      ) {
        return reply
          .status(403)
          .send(
            adminError(
              ADMIN_ERROR_CODE.FORBIDDEN,
              "Somente o executor da ordem ou a triagem pode alterar o checklist.",
            ),
          );
      }
      const occurrenceId = await repository.completeChecklist(
        context.hotelId,
        context.auth.session.id,
        request.params.id,
        request.params.itemId,
        Boolean(request.body?.completed),
        normalizeOptionalText(request.body?.notes) || undefined,
      );
      const item = occurrenceId
        ? await maintenance.getOccurrence(context.hotelId, occurrenceId)
        : null;
      return item
        ? reply.send({ item })
        : reply
            .status(409)
            .send(
              adminError(
                ADMIN_ERROR_CODE.CONFLICT,
                "Não foi possível atualizar o checklist.",
              ),
            );
    },
  );

  app.post<{ Params: IdParams; Body: Record<string, unknown> }>(
    "/admin/maintenance/work-orders/:id/supplier-transition",
    async (request, reply) => {
      const context = anyScope(request, reply, [
        PERMISSIONS.MAINTENANCE_EXECUTE,
        PERMISSIONS.MAINTENANCE_SUPPLIER_MANAGE,
      ]);
      if (!context) return;
      const orderAccess = await maintenance.getWorkOrderAccess(
        context.hotelId,
        request.params.id,
      );
      if (
        !orderAccess ||
        (orderAccess.assignedTo !== context.auth.session.id &&
          !context.auth.session.permissions.includes(
            PERMISSIONS.MAINTENANCE_SUPPLIER_MANAGE,
          ))
      ) {
        return reply
          .status(403)
          .send(
            adminError(
              ADMIN_ERROR_CODE.FORBIDDEN,
              "Somente o executor ou a gestão de fornecedores pode atualizar o atendimento externo.",
            ),
          );
      }
      const occurrenceId = await repository.transitionSupplierWork(
        context.hotelId,
        context.auth.session.id,
        request.params.id,
        request.body || {},
      );
      const item = occurrenceId
        ? await maintenance.getOccurrence(context.hotelId, occurrenceId)
        : null;
      return item
        ? reply.send({ item })
        : reply
            .status(409)
            .send(
              adminError(
                ADMIN_ERROR_CODE.CONFLICT,
                "Transição do fornecedor inválida.",
              ),
            );
    },
  );

  app.get("/admin/maintenance/sla-policies", async (request, reply) => {
    const context = anyScope(request, reply, [
      PERMISSIONS.MAINTENANCE_SLA_MANAGE,
      PERMISSIONS.MAINTENANCE_ANALYTICS_READ,
    ]);
    if (!context) return;
    return reply.send({
      items: await repository.listSlaPolicies(context.hotelId),
    });
  });
  app.post<{ Body: Record<string, unknown> }>(
    "/admin/maintenance/sla-policies",
    async (request, reply) => {
      const context = scope(request, reply, PERMISSIONS.MAINTENANCE_SLA_MANAGE);
      if (!context) return;
      return write(
        reply,
        await repository.createSlaPolicy(
          context.hotelId,
          context.auth.session.id,
          request.body,
        ),
        true,
      );
    },
  );
  app.put<{ Params: IdParams; Body: Record<string, unknown> }>(
    "/admin/maintenance/sla-policies/:id",
    async (request, reply) => {
      const context = scope(request, reply, PERMISSIONS.MAINTENANCE_SLA_MANAGE);
      if (!context) return;
      return write(
        reply,
        await repository.updateSlaPolicy(
          context.hotelId,
          request.params.id,
          request.body,
        ),
      );
    },
  );

  app.get("/admin/maintenance/suppliers", async (request, reply) => {
    const context = anyScope(request, reply, [
      PERMISSIONS.MAINTENANCE_SUPPLIER_MANAGE,
      PERMISSIONS.MAINTENANCE_FINANCE_READ,
      PERMISSIONS.MAINTENANCE_ANALYTICS_READ,
    ]);
    if (!context) return;
    const includeCommercial = context.auth.session.permissions.includes(
      PERMISSIONS.MAINTENANCE_FINANCE_READ,
    );
    const limited =
      !includeCommercial &&
      !context.auth.session.permissions.includes(
        PERMISSIONS.MAINTENANCE_SUPPLIER_MANAGE,
      );
    return reply.send({
      items: await repository.listSuppliers(
        context.hotelId,
        includeCommercial,
        limited,
      ),
    });
  });
  app.post<{ Body: Record<string, unknown> }>(
    "/admin/maintenance/suppliers",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_SUPPLIER_MANAGE,
      );
      if (!context) return;
      return write(
        reply,
        await repository.createSupplier(
          context.hotelId,
          context.auth.session.id,
          request.body,
        ),
        true,
      );
    },
  );
  app.put<{ Params: IdParams; Body: Record<string, unknown> }>(
    "/admin/maintenance/suppliers/:id",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_SUPPLIER_MANAGE,
      );
      if (!context) return;
      return write(
        reply,
        await repository.updateSupplier(
          context.hotelId,
          request.params.id,
          request.body,
        ),
      );
    },
  );
  app.post<{ Params: IdParams; Body: Record<string, unknown> }>(
    "/admin/maintenance/suppliers/:id/contacts",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_SUPPLIER_MANAGE,
      );
      if (!context) return;
      return write(
        reply,
        await repository.createContact(
          context.hotelId,
          context.auth.session.id,
          request.params.id,
          request.body,
        ),
        true,
      );
    },
  );
  app.put<{ Params: IdParams; Body: Record<string, unknown> }>(
    "/admin/maintenance/supplier-contacts/:id",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_SUPPLIER_MANAGE,
      );
      if (!context) return;
      return write(
        reply,
        await repository.updateContact(
          context.hotelId,
          request.params.id,
          request.body,
        ),
      );
    },
  );
  app.post<{ Params: IdParams; Body: Record<string, unknown> }>(
    "/admin/maintenance/suppliers/:id/contracts",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_SUPPLIER_MANAGE,
      );
      if (!context) return;
      const includeCommercial = context.auth.session.permissions.includes(
        PERMISSIONS.MAINTENANCE_FINANCE_READ,
      );
      if (
        !includeCommercial &&
        (request.body.commercial_terms !== undefined ||
          request.body.contract_amount !== undefined)
      )
        return reply
          .status(403)
          .send(
            adminError(
              ADMIN_ERROR_CODE.FORBIDDEN,
              "Termos comerciais exigem leitura financeira.",
            ),
          );
      return write(
        reply,
        await repository.createContract(
          context.hotelId,
          context.auth.session.id,
          request.params.id,
          request.body,
        ),
        true,
      );
    },
  );
  app.put<{ Params: IdParams; Body: Record<string, unknown> }>(
    "/admin/maintenance/contracts/:id",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_SUPPLIER_MANAGE,
      );
      if (!context) return;
      if (
        !context.auth.session.permissions.includes(
          PERMISSIONS.MAINTENANCE_FINANCE_READ,
        ) &&
        request.body.commercial_terms !== undefined
      )
        return reply
          .status(403)
          .send(
            adminError(
              ADMIN_ERROR_CODE.FORBIDDEN,
              "Termos comerciais exigem leitura financeira.",
            ),
          );
      return write(
        reply,
        await repository.updateContract(
          context.hotelId,
          context.auth.session.id,
          request.params.id,
          request.body,
        ),
      );
    },
  );
  app.post<{
    Body: {
      target_type: "supplier" | "contract";
      target_id: string;
      files: Array<{
        filename: string;
        content_type: string;
        size_bytes: number;
      }>;
    };
  }>(
    "/admin/maintenance/management-documents/upload-intents",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_SUPPLIER_MANAGE,
      );
      if (!context) return;
      const files = request.body?.files || [];
      const allowed = new Set([
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
      ]);
      if (
        !files.length ||
        files.length > 5 ||
        files.some(
          (file) =>
            !allowed.has(file.content_type) ||
            file.size_bytes <= 0 ||
            file.size_bytes > 10_485_760,
        )
      )
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Envie de um a cinco documentos PDF/imagem com até 10 MB.",
            ),
          );
      return reply.send({
        items: await Promise.all(
          files.map((file) =>
            repository.createDocumentUploadIntent(
              context.hotelId,
              request.body.target_type,
              request.body.target_id,
              file.filename,
            ),
          ),
        ),
      });
    },
  );
  app.post<{
    Body: {
      target_type: "supplier" | "contract";
      target_id: string;
      files: Array<Record<string, unknown>>;
    };
  }>(
    "/admin/maintenance/management-documents/finalize",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_SUPPLIER_MANAGE,
      );
      if (!context) return;
      const ok = await repository.finalizeDocuments(
        context.hotelId,
        context.auth.session.id,
        request.body.target_type,
        request.body.target_id,
        request.body.files || [],
      );
      return ok
        ? reply.send({ ok })
        : reply
            .status(409)
            .send(
              adminError(
                ADMIN_ERROR_CODE.CONFLICT,
                "Não foi possível confirmar os documentos.",
              ),
            );
    },
  );
  app.post<{ Params: IdParams }>(
    "/admin/maintenance/management-documents/:id/access",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_SUPPLIER_MANAGE,
      );
      if (!context) return;
      const item = await repository.accessDocument(
        context.hotelId,
        request.params.id,
      );
      return item
        ? reply.send(item)
        : reply
            .status(404)
            .send(
              adminError(
                ADMIN_ERROR_CODE.NOT_FOUND,
                "Documento não encontrado.",
              ),
            );
    },
  );
  app.post<{ Params: IdParams; Body: { reason?: string } }>(
    "/admin/maintenance/management-documents/:id/remove",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_SUPPLIER_MANAGE,
      );
      if (!context) return;
      const reason = normalizeOptionalText(request.body?.reason);
      if (!reason)
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Justificativa obrigatória.",
            ),
          );
      return reply.send({
        ok: await repository.removeDocument(
          context.hotelId,
          context.auth.session.id,
          request.params.id,
          reason,
        ),
      });
    },
  );

  app.get<{ Querystring: Query }>(
    "/admin/maintenance/notifications",
    async (request, reply) => {
      const context = anyScope(request, reply);
      if (!context) return;
      return reply.send({
        items: await repository.listNotifications(
          context.hotelId,
          context.auth.session.id,
          request.query,
        ),
      });
    },
  );
  app.get(
    "/admin/maintenance/notifications/summary",
    async (request, reply) => {
      const context = anyScope(request, reply);
      if (!context) return;
      return reply.send({
        unread: await repository.notificationSummary(
          context.hotelId,
          context.auth.session.id,
        ),
      });
    },
  );
  app.post<{
    Params: IdParams;
    Body: { status: "unread" | "read" | "dismissed" };
  }>("/admin/maintenance/notifications/:id/status", async (request, reply) => {
    const context = anyScope(request, reply);
    if (!context) return;
    return reply.send({
      ok: await repository.setNotificationStatus(
        context.hotelId,
        context.auth.session.id,
        request.params.id,
        request.body.status,
      ),
    });
  });
  app.post(
    "/admin/maintenance/notifications/read-all",
    async (request, reply) => {
      const context = anyScope(request, reply);
      if (!context) return;
      return reply.send({
        updated: await repository.readAllNotifications(
          context.hotelId,
          context.auth.session.id,
        ),
      });
    },
  );

  app.get<{ Querystring: Query }>(
    "/admin/maintenance/analytics",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_ANALYTICS_READ,
      );
      if (!context) return;
      return reply.send(
        await repository.analytics(
          context.hotelId,
          request.query,
          context.auth.session.permissions.includes(
            PERMISSIONS.MAINTENANCE_FINANCE_READ,
          ),
        ),
      );
    },
  );
  app.get<{ Querystring: Query }>(
    "/admin/maintenance/analytics/export-data",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_ANALYTICS_READ,
      );
      if (!context) return;
      const rows = await repository.exportRows(
        context.hotelId,
        request.query,
        context.auth.session.permissions.includes(
          PERMISSIONS.MAINTENANCE_FINANCE_READ,
        ),
      );
      if (request.query.format === "csv") {
        return reply
          .header("content-type", "text/csv; charset=utf-8")
          .header(
            "content-disposition",
            'attachment; filename="maintenance-analytics.csv"',
          )
          .send(`\uFEFF${csv(rows)}`);
      }
      return reply.send({ items: rows });
    },
  );

  app.get("/admin/maintenance/automation-runs", async (request, reply) => {
    const context = anyScope(request, reply, [
      PERMISSIONS.MAINTENANCE_PLAN_MANAGE,
      PERMISSIONS.MAINTENANCE_SLA_MANAGE,
    ]);
    if (!context) return;
    return reply.send({
      items: await repository.listAutomationRuns(context.hotelId),
    });
  });
  app.post("/admin/maintenance/automation/run", async (request, reply) => {
    const context = anyScope(request, reply, [
      PERMISSIONS.MAINTENANCE_PLAN_MANAGE,
      PERMISSIONS.MAINTENANCE_SLA_MANAGE,
    ]);
    if (!context) return;
    return reply.send({
      result: await repository.runAutomation(context.hotelId),
    });
  });
}
