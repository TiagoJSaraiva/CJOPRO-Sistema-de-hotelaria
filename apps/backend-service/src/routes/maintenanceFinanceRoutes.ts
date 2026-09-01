import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  ADMIN_ERROR_CODE,
  PERMISSIONS,
  type AdminMaintenanceCostItemInput,
  type AdminMaintenanceRecoveryInput,
  type HotelIdParams,
  type PermissionName,
} from "@hotel/shared";
import { ensureAuthorizedWithScope } from "../auth/authorization";
import { adminError } from "../common/adminError";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import { normalizeOptionalText } from "../common/text";
import {
  createMaintenanceFinanceRepository,
  type MaintenanceFinanceRepository,
} from "../repositories/maintenanceFinanceRepository";

type Query = Record<string, string | undefined>;
type TransitionBody = { action?: string; reason?: string };
type SettlementBody = {
  amount?: number;
  method?: string;
  settled_at?: string;
  reference_code?: string;
  note?: string;
  allocations?: Array<{ debit_entry_id: string; amount: number }>;
};
type FinancialAttachmentBody = {
  target_type?: "cost_item" | "recovery";
  target_id?: string;
  files?: Array<Record<string, unknown>>;
};

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

function itemId(
  request: FastifyRequest<{ Params: HotelIdParams }>,
  reply: FastifyReply,
) {
  const id = normalizeOptionalText(request.params.id);
  if (!id) {
    reply
      .status(400)
      .send(
        adminError(ADMIN_ERROR_CODE.VALIDATION, "Identificador obrigatório."),
      );
    return null;
  }
  return id;
}

function sendWrite<T>(
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
          "Registro financeiro não encontrado no hotel ativo.",
        ),
      );
  if (result.result !== "ok" || !result.item)
    return reply
      .status(409)
      .send(
        adminError(
          ADMIN_ERROR_CODE.CONFLICT,
          "A operação financeira viola o estado atual ou as regras de segregação.",
        ),
      );
  return reply.status(created ? 201 : 200).send({ item: result.item });
}

function positiveInt(value: string | undefined, fallback: number, max: number) {
  if (!value) return fallback;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= max
    ? number
    : null;
}

export function registerMaintenanceFinanceRoutes(
  app: FastifyInstance,
  repository: MaintenanceFinanceRepository = createMaintenanceFinanceRepository(),
) {
  app.get<{ Params: HotelIdParams }>(
    "/admin/stays/:id/folio",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_FINANCE_READ,
      );
      if (!context) return;
      const id = itemId(request, reply);
      if (!id) return;
      const item = await repository.getStayFolio(context.hotelId, id);
      return item
        ? reply.send({ item })
        : reply
            .status(404)
            .send(
              adminError(
                ADMIN_ERROR_CODE.NOT_FOUND,
                "Estadia não encontrada no hotel ativo.",
              ),
            );
    },
  );

  app.post<{ Params: HotelIdParams; Body: { amount?: number } }>(
    "/admin/stays/:id/payments/allocation-preview",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_FINANCE_READ,
      );
      if (!context) return;
      const id = itemId(request, reply);
      if (!id) return;
      const amount = Number(request.body?.amount || 0);
      if (!Number.isFinite(amount) || amount <= 0)
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Valor de pagamento inválido.",
            ),
          );
      const item = await repository.previewStayAllocation(
        context.hotelId,
        id,
        amount,
      );
      return item
        ? reply.send({ item })
        : reply
            .status(404)
            .send(
              adminError(
                ADMIN_ERROR_CODE.NOT_FOUND,
                "Estadia não encontrada no hotel ativo.",
              ),
            );
    },
  );

  app.get("/admin/maintenance/finance/summary", async (request, reply) => {
    const context = scope(request, reply, PERMISSIONS.MAINTENANCE_FINANCE_READ);
    if (!context) return;
    return reply.send(await repository.getSummary(context.hotelId));
  });

  app.get<{ Querystring: Query }>(
    "/admin/maintenance/finance/items",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_FINANCE_READ,
      );
      if (!context) return;
      const page = positiveInt(request.query.page, 1, 100000);
      const pageSize = positiveInt(request.query.page_size, 25, 100);
      if (!page || !pageSize)
        return reply
          .status(400)
          .send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Paginação inválida."));
      return reply.send(
        await repository.listItems(context.hotelId, {
          page,
          pageSize,
          queue: normalizeOptionalText(request.query.queue) || undefined,
          kind: normalizeOptionalText(request.query.kind) || undefined,
          occurrenceId:
            normalizeOptionalText(request.query.occurrence_id) || undefined,
        }),
      );
    },
  );

  app.get<{ Params: HotelIdParams }>(
    "/admin/maintenance/occurrences/:id/finance",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_FINANCE_READ,
      );
      if (!context) return;
      const id = itemId(request, reply);
      if (!id) return;
      const item = await repository.getOccurrenceFinance(context.hotelId, id);
      return item
        ? reply.send({ item })
        : reply
            .status(404)
            .send(
              adminError(
                ADMIN_ERROR_CODE.NOT_FOUND,
                "Ocorrência não encontrada no hotel ativo.",
              ),
            );
    },
  );

  app.post<{ Params: HotelIdParams; Body: AdminMaintenanceCostItemInput }>(
    "/admin/maintenance/occurrences/:id/cost-items",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_FINANCE_PROPOSE,
      );
      if (!context) return;
      const id = itemId(request, reply);
      if (!id) return;
      return sendWrite(
        reply,
        await repository.createCostItem(
          context.hotelId,
          id,
          context.auth.session.id,
          request.body,
        ),
        true,
      );
    },
  );

  app.put<{ Params: HotelIdParams; Body: AdminMaintenanceCostItemInput }>(
    "/admin/maintenance/cost-items/:id",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_FINANCE_PROPOSE,
      );
      if (!context) return;
      const id = itemId(request, reply);
      if (!id) return;
      return sendWrite(
        reply,
        await repository.updateCostItem(
          context.hotelId,
          id,
          context.auth.session.id,
          request.body,
        ),
      );
    },
  );

  app.post<{ Params: HotelIdParams; Body: TransitionBody }>(
    "/admin/maintenance/cost-items/:id/transition",
    async (request, reply) => {
      const action = normalizeOptionalText(request.body?.action);
      const permission =
        action === "approve" || action === "reject"
          ? PERMISSIONS.MAINTENANCE_FINANCE_APPROVE
          : PERMISSIONS.MAINTENANCE_FINANCE_PROPOSE;
      const context = scope(request, reply, permission);
      if (!context) return;
      const id = itemId(request, reply);
      if (!id) return;
      return sendWrite(
        reply,
        await repository.transitionCostItem(
          context.hotelId,
          id,
          context.auth.session.id,
          action || "",
          normalizeOptionalText(request.body?.reason) || undefined,
        ),
      );
    },
  );

  app.post<{ Params: HotelIdParams; Body: SettlementBody }>(
    "/admin/maintenance/cost-items/:id/settlements",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_FINANCE_SETTLE,
      );
      if (!context) return;
      const id = itemId(request, reply);
      if (!id) return;
      return sendWrite(
        reply,
        await repository.settleCostItem(
          context.hotelId,
          id,
          context.auth.session.id,
          {
            amount: Number(request.body.amount),
            method: String(request.body.method || ""),
            settled_at: request.body.settled_at,
            reference_code: request.body.reference_code,
            note: request.body.note,
          },
        ),
      );
    },
  );

  app.post<{ Params: HotelIdParams; Body: AdminMaintenanceRecoveryInput }>(
    "/admin/maintenance/occurrences/:id/recoveries",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_FINANCE_PROPOSE,
      );
      if (!context) return;
      const id = itemId(request, reply);
      if (!id) return;
      return sendWrite(
        reply,
        await repository.createRecovery(
          context.hotelId,
          id,
          context.auth.session.id,
          request.body,
        ),
        true,
      );
    },
  );

  app.put<{ Params: HotelIdParams; Body: AdminMaintenanceRecoveryInput }>(
    "/admin/maintenance/recoveries/:id",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_FINANCE_PROPOSE,
      );
      if (!context) return;
      const id = itemId(request, reply);
      if (!id) return;
      return sendWrite(
        reply,
        await repository.updateRecovery(
          context.hotelId,
          id,
          context.auth.session.id,
          request.body,
        ),
      );
    },
  );

  app.post<{ Params: HotelIdParams; Body: TransitionBody }>(
    "/admin/maintenance/recoveries/:id/transition",
    async (request, reply) => {
      const action = normalizeOptionalText(request.body?.action);
      const permission =
        action === "approve" || action === "reject"
          ? PERMISSIONS.MAINTENANCE_FINANCE_APPROVE
          : PERMISSIONS.MAINTENANCE_FINANCE_PROPOSE;
      const context = scope(request, reply, permission);
      if (!context) return;
      const id = itemId(request, reply);
      if (!id) return;
      return sendWrite(
        reply,
        await repository.transitionRecovery(
          context.hotelId,
          id,
          context.auth.session.id,
          action || "",
          normalizeOptionalText(request.body?.reason) || undefined,
        ),
      );
    },
  );

  app.post<{ Params: HotelIdParams; Body: SettlementBody }>(
    "/admin/maintenance/recoveries/:id/settlements",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_FINANCE_SETTLE,
      );
      if (!context) return;
      const id = itemId(request, reply);
      if (!id) return;
      return sendWrite(
        reply,
        await repository.settleRecovery(
          context.hotelId,
          id,
          context.auth.session.id,
          {
            amount: Number(request.body.amount),
            method: String(request.body.method || ""),
            settled_at: request.body.settled_at,
            reference_code: request.body.reference_code,
            note: request.body.note,
            allocations: request.body.allocations,
          },
        ),
      );
    },
  );

  app.post<{ Params: HotelIdParams; Body: FinancialAttachmentBody }>(
    "/admin/maintenance/occurrences/:id/financial-attachments/upload-intents",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_FINANCE_PROPOSE,
      );
      if (!context) return;
      const occurrenceId = itemId(request, reply);
      if (!occurrenceId) return;
      const finance = await repository.getOccurrenceFinance(
        context.hotelId,
        occurrenceId,
      );
      const files = request.body.files || [];
      if (
        !finance ||
        files.length < 1 ||
        files.length > 5 ||
        (await repository.countAttachments(context.hotelId, occurrenceId)) +
          files.length >
          20
      )
        return reply
          .status(finance ? 409 : 404)
          .send(
            adminError(
              finance ? ADMIN_ERROR_CODE.CONFLICT : ADMIN_ERROR_CODE.NOT_FOUND,
              finance
                ? "Limite de documentos excedido."
                : "Ocorrência não encontrada.",
            ),
          );
      return reply.send({
        items: await Promise.all(
          files.map((file) =>
            repository.createUploadIntent(
              context.hotelId,
              occurrenceId,
              String(file.filename),
            ),
          ),
        ),
      });
    },
  );

  app.post<{ Params: HotelIdParams; Body: FinancialAttachmentBody }>(
    "/admin/maintenance/occurrences/:id/financial-attachments/finalize",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_FINANCE_PROPOSE,
      );
      if (!context) return;
      const occurrenceId = itemId(request, reply);
      if (!occurrenceId) return;
      return sendWrite(
        reply,
        await repository.finalizeAttachments(
          context.hotelId,
          occurrenceId,
          context.auth.session.id,
          request.body.target_type || "cost_item",
          request.body.target_id || "",
          request.body.files || [],
        ),
      );
    },
  );

  app.post<{ Params: HotelIdParams; Body: { reason?: string } }>(
    "/admin/maintenance/finance/settlements/:id/reverse",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_FINANCE_SETTLE,
      );
      if (!context) return;
      const id = itemId(request, reply);
      if (!id) return;
      return sendWrite(
        reply,
        await repository.reverseSettlement(
          context.hotelId,
          id,
          context.auth.session.id,
          String(request.body.reason || ""),
        ),
      );
    },
  );

  app.post<{ Params: HotelIdParams }>(
    "/admin/maintenance/financial-attachments/:id/access",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_FINANCE_READ,
      );
      if (!context) return;
      const id = itemId(request, reply);
      if (!id) return;
      const item = await repository.createAttachmentAccess(context.hotelId, id);
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

  app.post<{ Params: HotelIdParams; Body: { reason?: string } }>(
    "/admin/maintenance/financial-attachments/:id/remove",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.MAINTENANCE_FINANCE_PROPOSE,
      );
      if (!context) return;
      const id = itemId(request, reply);
      if (!id) return;
      const reason = normalizeOptionalText(request.body.reason);
      if (!reason)
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Motivo da remoção obrigatório.",
            ),
          );
      return sendWrite(
        reply,
        await repository.removeAttachment(
          context.hotelId,
          id,
          context.auth.session.id,
          reason,
        ),
      );
    },
  );
}
