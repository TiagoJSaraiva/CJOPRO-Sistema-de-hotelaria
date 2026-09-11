import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  ADMIN_ERROR_CODE,
  PERMISSIONS,
  type CashMovementInput,
  type CashRegisterInput,
  type CashSessionAction,
  type CashSessionOpen,
  type DailyCloseAction,
  type DailyClosePrepare,
  type LotAction,
  type LotTrackingInput,
  type MinibarCompositionInput,
  type MinibarCompositionVersionInput,
  type MinibarRouteInput,
  type OrganizationAction,
  type OrganizationInput,
  type PartnerDisputeInput,
  type PaymentInput,
  type ProcurementInvoiceInput,
  type ProcurementPolicyInput,
  type PurchaseOrderInput,
  type PurchaseReceiptInput,
  type ReplenishmentAction,
  type ReplenishmentRequestInput,
  type VersionedReasonAction,
} from "@hotel/shared";
import { ensureAuthorizedWithScope } from "../auth/authorization";
import { adminError } from "../common/adminError";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import {
  createOperationsFinanceRepository,
  type OperationsFinanceRepository,
} from "../repositories/operationsFinanceRepository";

type Params = { id: string };
type DateParams = { businessDate: string };
function scoped(
  request: FastifyRequest,
  reply: FastifyReply,
  permission: string,
) {
  const auth = ensureAuthorizedWithScope(request, reply, permission as never);
  if (!auth) return null;
  const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
  return hotelId
    ? {
        hotelId,
        actorId: auth.session.id,
        permissions: auth.session.permissions,
      }
    : null;
}
function send(
  reply: FastifyReply,
  result: { result: string; context?: unknown },
  created = false,
) {
  if (result.result === "ok")
    return reply.status(created ? 201 : 200).send({ ok: true, ...result });
  const missing = result.result === "not_found";
  const invalid =
    result.result.startsWith("invalid") ||
    result.result.endsWith("required") ||
    result.result === "quotes_required";
  return reply.status(missing ? 404 : invalid ? 400 : 409).send({
    ...adminError(
      missing
        ? ADMIN_ERROR_CODE.NOT_FOUND
        : invalid
          ? ADMIN_ERROR_CODE.VALIDATION
          : ADMIN_ERROR_CODE.CONFLICT,
      missing
        ? "Registro não encontrado no hotel ativo."
        : invalid
          ? "Dados inválidos para a operação."
          : "O estado mudou ou a operação exige outra decisão.",
      result.result,
    ),
    ...(result.context ? { context: result.context } : {}),
  });
}

export function registerOperationsFinanceRoutes(
  app: FastifyInstance,
  repository: OperationsFinanceRepository = createOperationsFinanceRepository(),
) {
  const get = (
    path: string,
    permission: string,
    rpcName: string,
    args?: (request: FastifyRequest) => Record<string, unknown>,
  ) =>
    app.get(path, async (request, reply) => {
      const ctx = scoped(request, reply, permission);
      if (!ctx) return;
      return reply.send(
        await repository.rpc(rpcName, {
          p_hotel_id: ctx.hotelId,
          ...(args?.(request) ?? {}),
        }),
      );
    });
  get(
    "/admin/business-organizations",
    PERMISSIONS.BUSINESS_ORGANIZATIONS_READ,
    "list_business_organizations",
  );
  app.get<{ Params: Params }>(
    "/admin/business-organizations/:id/overview",
    async (request, reply) => {
      const c = scoped(request, reply, PERMISSIONS.BUSINESS_ORGANIZATIONS_READ);
      if (!c) return;
      const data = await repository.rpc("get_business_organization_overview", {
        p_hotel_id: c.hotelId,
        p_id: request.params.id,
        p_permissions: c.permissions,
      });
      if (!data)
        return reply
          .status(404)
          .send(
            adminError(
              ADMIN_ERROR_CODE.NOT_FOUND,
              "Organização não encontrada no hotel ativo.",
            ),
          );
      return reply.send(data);
    },
  );
  app.post<{ Body: OrganizationInput }>(
    "/admin/business-organizations",
    async (request, reply) => {
      const c = scoped(
        request,
        reply,
        PERMISSIONS.BUSINESS_ORGANIZATIONS_MANAGE,
      );
      if (!c) return;
      return send(
        reply,
        await repository.mutation("save_business_organization", {
          p_hotel_id: c.hotelId,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
        true,
      );
    },
  );
  app.post<{ Params: Params; Body: OrganizationAction }>(
    "/admin/business-organizations/:id/actions",
    async (request, reply) => {
      const c = scoped(
        request,
        reply,
        PERMISSIONS.BUSINESS_ORGANIZATIONS_MANAGE,
      );
      if (!c) return;
      return send(
        reply,
        await repository.mutation("act_business_organization", {
          p_hotel_id: c.hotelId,
          p_id: request.params.id,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
      );
    },
  );

  get(
    "/admin/procurement/board",
    PERMISSIONS.PROCUREMENT_READ,
    "list_procurement_board",
  );
  app.put<{ Body: ProcurementPolicyInput }>(
    "/admin/procurement/policy",
    async (request, reply) => {
      const c = scoped(request, reply, PERMISSIONS.PROCUREMENT_APPROVE);
      if (!c) return;
      return send(
        reply,
        await repository.mutation("save_procurement_policy", {
          p_hotel_id: c.hotelId,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
      );
    },
  );
  app.post<{ Body: ReplenishmentRequestInput }>(
    "/admin/procurement/replenishment-requests",
    async (request, reply) => {
      const c = scoped(request, reply, PERMISSIONS.PROCUREMENT_REQUEST);
      if (!c) return;
      return send(
        reply,
        await repository.mutation("create_replenishment_request", {
          p_hotel_id: c.hotelId,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
        true,
      );
    },
  );
  app.post<{ Params: Params; Body: ReplenishmentAction }>(
    "/admin/procurement/replenishment-requests/:id/actions",
    async (request, reply) => {
      const permission =
        request.body.action === "approve"
          ? PERMISSIONS.PROCUREMENT_APPROVE
          : PERMISSIONS.PROCUREMENT_REQUEST;
      const c = scoped(request, reply, permission);
      if (!c) return;
      return send(
        reply,
        await repository.mutation("act_replenishment_request", {
          p_hotel_id: c.hotelId,
          p_id: request.params.id,
          p_actor_id: c.actorId,
          p_action: request.body.action,
          p_expected_version: request.body.expected_version,
          p_reason: request.body.reason,
        }),
      );
    },
  );
  app.post("/admin/procurement/reconcile", async (request, reply) => {
    const c = scoped(request, reply, PERMISSIONS.PROCUREMENT_READ);
    if (!c) return;
    return send(
      reply,
      await repository.mutation("reconcile_replenishment_requests", {
        p_hotel_id: c.hotelId,
        p_actor_id: c.actorId,
      }),
    );
  });
  app.post<{ Body: PurchaseOrderInput }>(
    "/admin/procurement/purchase-orders",
    async (request, reply) => {
      const c = scoped(request, reply, PERMISSIONS.PROCUREMENT_REQUEST);
      if (!c) return;
      return send(
        reply,
        await repository.mutation("create_purchase_order", {
          p_hotel_id: c.hotelId,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
        true,
      );
    },
  );
  app.post<{ Params: Params; Body: VersionedReasonAction }>(
    "/admin/procurement/purchase-orders/:id/actions",
    async (request, reply) => {
      const permission =
        request.body.action === "approve" || request.body.action === "reject"
          ? PERMISSIONS.PROCUREMENT_APPROVE
          : PERMISSIONS.PROCUREMENT_REQUEST;
      const c = scoped(request, reply, permission);
      if (!c) return;
      return send(
        reply,
        await repository.mutation("act_purchase_order", {
          p_hotel_id: c.hotelId,
          p_id: request.params.id,
          p_actor_id: c.actorId,
          p_action: request.body.action,
          p_expected_version: request.body.expected_version,
          p_reason: request.body.reason,
        }),
      );
    },
  );
  app.post<{ Params: Params; Body: PurchaseReceiptInput }>(
    "/admin/procurement/purchase-orders/:id/receipts",
    async (request, reply) => {
      const c = scoped(request, reply, PERMISSIONS.PROCUREMENT_RECEIVE);
      if (!c) return;
      return send(
        reply,
        await repository.mutation("receive_purchase_order", {
          p_hotel_id: c.hotelId,
          p_id: request.params.id,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
        true,
      );
    },
  );
  app.post<{ Body: ProcurementInvoiceInput }>(
    "/admin/procurement/invoices",
    async (request, reply) => {
      const c = scoped(request, reply, PERMISSIONS.PROCUREMENT_INVOICES_REVIEW);
      if (!c) return;
      return send(
        reply,
        await repository.mutation("create_procurement_invoice", {
          p_hotel_id: c.hotelId,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
        true,
      );
    },
  );
  app.post<{ Params: Params; Body: VersionedReasonAction }>(
    "/admin/procurement/invoices/:id/actions",
    async (request, reply) => {
      const c = scoped(request, reply, PERMISSIONS.PROCUREMENT_INVOICES_REVIEW);
      if (!c) return;
      return send(
        reply,
        await repository.mutation("act_procurement_invoice", {
          p_hotel_id: c.hotelId,
          p_id: request.params.id,
          p_actor_id: c.actorId,
          p_action: request.body.action,
          p_expected_version: request.body.expected_version,
          p_reason: request.body.reason,
        }),
      );
    },
  );
  app.post<{ Params: Params; Body: PaymentInput }>(
    "/admin/procurement/payables/:id/payments",
    async (request, reply) => {
      const c = scoped(request, reply, PERMISSIONS.SUPPLIER_PAYABLES_SETTLE);
      if (!c) return;
      return send(
        reply,
        await repository.mutation("pay_procurement_installment", {
          p_hotel_id: c.hotelId,
          p_id: request.params.id,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
      );
    },
  );

  get(
    "/admin/inventory/lots",
    PERMISSIONS.INVENTORY_READ,
    "list_inventory_lots",
  );
  app.post<{ Params: Params; Body: LotTrackingInput }>(
    "/admin/inventory/products/:id/lot-tracking",
    async (request, reply) => {
      const c = scoped(request, reply, PERMISSIONS.INVENTORY_LOTS_MANAGE);
      if (!c) return;
      return send(
        reply,
        await repository.mutation("configure_product_lot_tracking", {
          p_hotel_id: c.hotelId,
          p_product_id: request.params.id,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
      );
    },
  );
  app.post<{ Params: Params; Body: LotAction }>(
    "/admin/inventory/lots/:id/actions",
    async (request, reply) => {
      const c = scoped(request, reply, PERMISSIONS.INVENTORY_LOTS_MANAGE);
      if (!c) return;
      return send(
        reply,
        await repository.mutation("act_inventory_lot", {
          p_hotel_id: c.hotelId,
          p_lot_id: request.params.id,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
      );
    },
  );
  get(
    "/admin/minibar/compositions",
    PERMISSIONS.INVENTORY_READ,
    "list_minibar_compositions",
  );
  app.post<{ Body: MinibarCompositionInput }>(
    "/admin/minibar/compositions",
    async (request, reply) => {
      const c = scoped(request, reply, PERMISSIONS.MINIBAR_COMPOSITIONS_MANAGE);
      if (!c) return;
      return send(
        reply,
        await repository.mutation("create_minibar_composition", {
          p_hotel_id: c.hotelId,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
        true,
      );
    },
  );
  app.post<{ Params: Params; Body: MinibarCompositionVersionInput }>(
    "/admin/minibar/compositions/:id/versions",
    async (request, reply) => {
      const c = scoped(request, reply, PERMISSIONS.MINIBAR_COMPOSITIONS_MANAGE);
      if (!c) return;
      return send(
        reply,
        await repository.mutation("version_minibar_composition", {
          p_hotel_id: c.hotelId,
          p_id: request.params.id,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
        true,
      );
    },
  );
  get(
    "/admin/minibar/replenishment-board",
    PERMISSIONS.GOVERNANCE_READ,
    "get_minibar_replenishment_board",
  );
  app.post<{ Body: MinibarRouteInput }>(
    "/admin/minibar/replenishment-routes",
    async (request, reply) => {
      const c = scoped(
        request,
        reply,
        PERMISSIONS.MINIBAR_REPLENISHMENT_EXECUTE,
      );
      if (!c) return;
      return send(
        reply,
        await repository.mutation("create_minibar_replenishment_route", {
          p_hotel_id: c.hotelId,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
        true,
      );
    },
  );
  app.post<{ Params: Params; Body: VersionedReasonAction }>(
    "/admin/minibar/replenishment-routes/:id/actions",
    async (request, reply) => {
      const c = scoped(
        request,
        reply,
        PERMISSIONS.MINIBAR_REPLENISHMENT_EXECUTE,
      );
      if (!c) return;
      return send(
        reply,
        await repository.mutation("act_minibar_replenishment_route", {
          p_hotel_id: c.hotelId,
          p_id: request.params.id,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
      );
    },
  );

  get(
    "/admin/cash-registers",
    PERMISSIONS.CASH_MANAGEMENT_READ,
    "list_cash_registers",
  );
  app.post<{ Body: CashRegisterInput }>(
    "/admin/cash-registers",
    async (request, reply) => {
      const c = scoped(request, reply, PERMISSIONS.CASH_DIFFERENCES_APPROVE);
      if (!c) return;
      return send(
        reply,
        await repository.mutation("save_cash_register", {
          p_hotel_id: c.hotelId,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
        true,
      );
    },
  );
  app.post<{ Params: Params; Body: CashSessionOpen }>(
    "/admin/cash-registers/:id/sessions",
    async (request, reply) => {
      const c = scoped(request, reply, PERMISSIONS.CASH_REGISTER_OPERATE);
      if (!c) return;
      return send(
        reply,
        await repository.mutation("open_cash_session", {
          p_hotel_id: c.hotelId,
          p_register_id: request.params.id,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
        true,
      );
    },
  );
  get(
    "/admin/cash-sessions/:id",
    PERMISSIONS.CASH_MANAGEMENT_READ,
    "get_cash_session",
    (request) => ({ p_id: (request.params as Params).id }),
  );
  app.post<{ Params: Params; Body: CashSessionAction }>(
    "/admin/cash-sessions/:id/actions",
    async (request, reply) => {
      const permission =
        request.body.action === "approve_difference" ||
        request.body.action === "request_recount"
          ? PERMISSIONS.CASH_DIFFERENCES_APPROVE
          : PERMISSIONS.CASH_REGISTER_OPERATE;
      const c = scoped(request, reply, permission);
      if (!c) return;
      return send(
        reply,
        await repository.mutation("act_cash_session", {
          p_hotel_id: c.hotelId,
          p_id: request.params.id,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
      );
    },
  );
  app.post<{ Params: Params; Body: CashMovementInput }>(
    "/admin/cash-sessions/:id/movements",
    async (request, reply) => {
      const c = scoped(
        request,
        reply,
        request.body.kind === "adjustment"
          ? PERMISSIONS.CASH_DIFFERENCES_APPROVE
          : PERMISSIONS.CASH_REGISTER_OPERATE,
      );
      if (!c) return;
      return send(
        reply,
        await repository.mutation("post_cash_movement", {
          p_hotel_id: c.hotelId,
          p_id: request.params.id,
          p_actor_id: c.actorId,
          p_can_override: request.body.kind === "adjustment",
          p_input: request.body,
        }),
        true,
      );
    },
  );
  get(
    "/admin/daily-close/:businessDate",
    PERMISSIONS.CASH_MANAGEMENT_READ,
    "get_daily_close",
    (request) => ({
      p_business_date: (request.params as DateParams).businessDate,
    }),
  );
  app.post<{ Params: DateParams; Body: DailyClosePrepare }>(
    "/admin/daily-close/:businessDate/prepare",
    async (request, reply) => {
      const c = scoped(request, reply, PERMISSIONS.DAILY_CLOSE_PREPARE);
      if (!c) return;
      return send(
        reply,
        await repository.mutation("prepare_daily_close", {
          p_hotel_id: c.hotelId,
          p_business_date: request.params.businessDate,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
      );
    },
  );
  app.post<{ Params: DateParams; Body: DailyCloseAction }>(
    "/admin/daily-close/:businessDate/actions",
    async (request, reply) => {
      const c = scoped(request, reply, PERMISSIONS.DAILY_CLOSE_APPROVE);
      if (!c) return;
      return send(
        reply,
        await repository.mutation("act_daily_close", {
          p_hotel_id: c.hotelId,
          p_business_date: request.params.businessDate,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
      );
    },
  );

  app.post<{ Params: Params; Body: PartnerDisputeInput }>(
    "/admin/consumption/partner-settlements/:id/disputes",
    async (request, reply) => {
      const c = scoped(request, reply, PERMISSIONS.PARTNER_DISPUTES_MANAGE);
      if (!c) return;
      return send(
        reply,
        await repository.mutation("create_partner_settlement_dispute", {
          p_hotel_id: c.hotelId,
          p_settlement_id: request.params.id,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
        true,
      );
    },
  );
  app.post<{ Params: Params; Body: PaymentInput }>(
    "/admin/consumption/partner-settlements/:id/payments",
    async (request, reply) => {
      const c = scoped(request, reply, PERMISSIONS.PARTNER_SETTLEMENTS_SETTLE);
      if (!c) return;
      return send(
        reply,
        await repository.mutation("pay_partner_settlement_partial", {
          p_hotel_id: c.hotelId,
          p_settlement_id: request.params.id,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
      );
    },
  );
  app.post<{ Params: Params; Body: VersionedReasonAction }>(
    "/admin/consumption/partner-disputes/:id/actions",
    async (request, reply) => {
      const c = scoped(request, reply, PERMISSIONS.PARTNER_DISPUTES_MANAGE);
      if (!c) return;
      return send(
        reply,
        await repository.mutation("act_partner_settlement_dispute", {
          p_hotel_id: c.hotelId,
          p_id: request.params.id,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
      );
    },
  );
}
