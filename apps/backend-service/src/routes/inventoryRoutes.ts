import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  ADMIN_ERROR_CODE,
  PERMISSIONS,
  type AdminErrorCode,
  type AdminInventoryDocumentInput,
  type AdminInventoryLocationInput,
  type AdminInventoryPositionInput,
  type AdminInventoryPositionUpdateInput,
  type AdminInventoryTransferInput,
  type HotelIdParams,
  type InventoryMovementKind,
  type InventoryNegativeStockPolicy,
  type PermissionName,
} from "@hotel/shared";
import { ensureAuthorizedWithScope } from "../auth/authorization";
import { adminError } from "../common/adminError";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import { normalizeOptionalText } from "../common/text";
import {
  createInventoryRepository,
  type InventoryRepository,
} from "../repositories/inventoryRepository";

type ListQuery = {
  include_archived?: boolean | string;
  location_id?: string;
  product_id?: string;
  low_only?: boolean | string;
  cursor?: string;
  limit?: number | string;
  kind?: InventoryMovementKind;
};
function send(
  reply: FastifyReply,
  status: number,
  code: AdminErrorCode,
  message: string,
  details?: string,
) {
  return reply.status(status).send(adminError(code, message, details));
}
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
function bool(value: unknown) {
  return value === true || value === "true";
}
function id(request: FastifyRequest<{ Params: HotelIdParams }>) {
  return normalizeOptionalText(request.params.id);
}
function mutationError(
  reply: FastifyReply,
  result: string,
  entity = "estoque",
) {
  const notFound = result === "not_found";
  const validation =
    result.startsWith("invalid") || result.includes("ineligible");
  return send(
    reply,
    notFound ? 404 : validation ? 400 : 409,
    notFound
      ? ADMIN_ERROR_CODE.NOT_FOUND
      : validation
        ? ADMIN_ERROR_CODE.VALIDATION
        : ADMIN_ERROR_CODE.CONFLICT,
    `Não foi possível atualizar ${entity}.`,
    result,
  );
}
function locationInput(
  value: unknown,
  partial = false,
): Partial<AdminInventoryLocationInput> | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Partial<AdminInventoryLocationInput>;
  const result: Partial<AdminInventoryLocationInput> = {};
  if (!partial || body.name !== undefined) {
    const name = normalizeOptionalText(body.name);
    if (!name) return null;
    result.name = name;
  }
  if (body.internal_code !== undefined)
    result.internal_code = normalizeOptionalText(body.internal_code);
  if (body.description !== undefined)
    result.description = normalizeOptionalText(body.description);
  if (body.display_order !== undefined) {
    const order = Number(body.display_order);
    if (!Number.isInteger(order) || order < 0) return null;
    result.display_order = order;
  }
  if (body.is_active !== undefined) result.is_active = Boolean(body.is_active);
  return result;
}
function finiteInteger(value: unknown, minimum = 0) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum ? parsed : null;
}

export function registerInventoryRoutes(
  app: FastifyInstance,
  repository: InventoryRepository = createInventoryRepository(),
): void {
  app.get("/admin/inventory/settings", async (request, reply) => {
    const context = scope(request, reply, PERMISSIONS.INVENTORY_READ);
    if (!context) return;
    const item = await repository.getSettings(context.hotelId);
    return item
      ? reply.send({ item })
      : send(
          reply,
          404,
          ADMIN_ERROR_CODE.NOT_FOUND,
          "Configuração de estoque não encontrada.",
        );
  });
  app.put<{ Body: { negative_stock_policy?: InventoryNegativeStockPolicy } }>(
    "/admin/inventory/settings",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.INVENTORY_SETTINGS_MANAGE,
      );
      if (!context) return;
      const policy = request.body?.negative_stock_policy;
      if (!policy || !["allow_with_warning", "block"].includes(policy))
        return send(
          reply,
          400,
          ADMIN_ERROR_CODE.VALIDATION,
          "Política de saldo inválida.",
        );
      const item = await repository.updateSettings(
        context.hotelId,
        context.auth.session.id,
        policy,
      );
      return item
        ? reply.send({ item })
        : send(
            reply,
            404,
            ADMIN_ERROR_CODE.NOT_FOUND,
            "Configuração de estoque não encontrada.",
          );
    },
  );
  app.get<{ Querystring: ListQuery }>(
    "/admin/inventory/locations",
    async (request, reply) => {
      const context = scope(request, reply, PERMISSIONS.INVENTORY_READ);
      if (!context) return;
      return reply.send({
        items: await repository.listLocations(
          context.hotelId,
          bool(request.query.include_archived),
        ),
      });
    },
  );
  app.post<{ Body: unknown }>(
    "/admin/inventory/locations",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.INVENTORY_SETTINGS_MANAGE,
      );
      if (!context) return;
      const input = locationInput(request.body);
      if (!input?.name)
        return send(
          reply,
          400,
          ADMIN_ERROR_CODE.VALIDATION,
          "Dados do local inválidos.",
        );
      const result = await repository.createLocation(
        context.hotelId,
        context.auth.session.id,
        input as AdminInventoryLocationInput,
      );
      return "item" in result
        ? reply.status(201).send({ item: result.item })
        : mutationError(reply, result.result, "o local");
    },
  );
  app.put<{ Body: { ids?: string[] } }>(
    "/admin/inventory/locations/order",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.INVENTORY_SETTINGS_MANAGE,
      );
      if (!context) return;
      const ids = request.body?.ids;
      if (
        !Array.isArray(ids) ||
        ids.length === 0 ||
        ids.some((value) => !normalizeOptionalText(value)) ||
        new Set(ids).size !== ids.length
      )
        return send(
          reply,
          400,
          ADMIN_ERROR_CODE.VALIDATION,
          "Ordenação de locais inválida.",
        );
      const result = await repository.reorderLocations(
        context.hotelId,
        context.auth.session.id,
        ids,
      );
      return result === "ok"
        ? reply.send({ ok: true })
        : mutationError(reply, result, "os locais");
    },
  );
  app.put<{ Params: HotelIdParams; Body: unknown }>(
    "/admin/inventory/locations/:id",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.INVENTORY_SETTINGS_MANAGE,
      );
      if (!context) return;
      const locationId = id(request);
      const input = locationInput(request.body, true);
      if (!locationId || !input || Object.keys(input).length === 0)
        return send(
          reply,
          400,
          ADMIN_ERROR_CODE.VALIDATION,
          "Dados do local inválidos.",
        );
      const result = await repository.updateLocation(
        locationId,
        context.hotelId,
        context.auth.session.id,
        input,
      );
      return "item" in result
        ? reply.send({ item: result.item })
        : mutationError(reply, result.result, "o local");
    },
  );
  for (const action of ["archive", "restore"] as const)
    app.post<{ Params: HotelIdParams }>(
      `/admin/inventory/locations/:id/${action}`,
      async (request, reply) => {
        const context = scope(
          request,
          reply,
          PERMISSIONS.INVENTORY_SETTINGS_MANAGE,
        );
        if (!context) return;
        const locationId = id(request);
        if (!locationId)
          return send(
            reply,
            400,
            ADMIN_ERROR_CODE.VALIDATION,
            "Local inválido.",
          );
        const result = await repository.updateLocation(
          locationId,
          context.hotelId,
          context.auth.session.id,
          {
            archived_at: action === "archive" ? new Date().toISOString() : null,
            is_active: action === "restore",
          },
        );
        return "item" in result
          ? reply.send({ item: result.item })
          : mutationError(reply, result.result, "o local");
      },
    );
  app.get<{ Querystring: ListQuery }>(
    "/admin/inventory/overview",
    async (request, reply) => {
      const context = scope(request, reply, PERMISSIONS.INVENTORY_READ);
      if (!context) return;
      const includeCosts = context.auth.session.permissions.includes(
        PERMISSIONS.INVENTORY_COSTS_READ,
      );
      const [settings, items] = await Promise.all([
        repository.getSettings(context.hotelId),
        repository.listPositions(
          context.hotelId,
          {
            locationId:
              normalizeOptionalText(request.query.location_id) || undefined,
            productId:
              normalizeOptionalText(request.query.product_id) || undefined,
            lowOnly: bool(request.query.low_only),
          },
          includeCosts,
        ),
      ]);
      if (!settings)
        return send(
          reply,
          404,
          ADMIN_ERROR_CODE.NOT_FOUND,
          "Configuração de estoque não encontrada.",
        );
      return reply.send({ settings, items });
    },
  );
  app.post<{ Body: Partial<AdminInventoryPositionInput> }>(
    "/admin/inventory/positions",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.INVENTORY_SETTINGS_MANAGE,
      );
      if (!context) return;
      const body = request.body || {};
      const initial = finiteInteger(body.initial_quantity),
        minimum = finiteInteger(body.minimum_quantity ?? 0),
        ideal = finiteInteger(body.ideal_quantity ?? 0),
        cost =
          body.average_unit_cost == null
            ? null
            : Number(body.average_unit_cost);
      if (
        !normalizeOptionalText(body.product_id) ||
        !normalizeOptionalText(body.location_id) ||
        !normalizeOptionalText(body.idempotency_key) ||
        initial == null ||
        minimum == null ||
        ideal == null ||
        ideal < minimum ||
        (cost != null && (!Number.isFinite(cost) || cost < 0))
      )
        return send(
          reply,
          400,
          ADMIN_ERROR_CODE.VALIDATION,
          "Dados da posição inválidos.",
        );
      const input = {
        ...body,
        product_id: String(body.product_id),
        location_id: String(body.location_id),
        idempotency_key: String(body.idempotency_key),
        initial_quantity: initial,
        minimum_quantity: minimum,
        ideal_quantity: ideal,
        average_unit_cost: cost,
      } as AdminInventoryPositionInput;
      const result = await repository.createPosition(
        context.hotelId,
        context.auth.session.id,
        input,
        context.auth.session.permissions.includes(
          PERMISSIONS.INVENTORY_COSTS_READ,
        ),
      );
      return "item" in result
        ? reply.status(result.created ? 201 : 200).send({ item: result.item })
        : mutationError(reply, result.result, "a posição");
    },
  );
  app.put<{ Params: HotelIdParams; Body: AdminInventoryPositionUpdateInput }>(
    "/admin/inventory/positions/:id",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.INVENTORY_SETTINGS_MANAGE,
      );
      if (!context) return;
      const positionId = id(request);
      const minimum =
        request.body.minimum_quantity === undefined
          ? undefined
          : finiteInteger(request.body.minimum_quantity);
      const ideal =
        request.body.ideal_quantity === undefined
          ? undefined
          : finiteInteger(request.body.ideal_quantity);
      if (
        !positionId ||
        minimum === null ||
        ideal === null ||
        (minimum !== undefined && ideal !== undefined && ideal < minimum)
      )
        return send(
          reply,
          400,
          ADMIN_ERROR_CODE.VALIDATION,
          "Dados da posição inválidos.",
        );
      const result = await repository.updatePosition(
        positionId,
        context.hotelId,
        context.auth.session.id,
        {
          ...(minimum === undefined ? {} : { minimum_quantity: minimum }),
          ...(ideal === undefined ? {} : { ideal_quantity: ideal }),
          ...(request.body.is_active === undefined
            ? {}
            : { is_active: Boolean(request.body.is_active) }),
        },
        context.auth.session.permissions.includes(
          PERMISSIONS.INVENTORY_COSTS_READ,
        ),
      );
      return "item" in result
        ? reply.send({ item: result.item })
        : mutationError(reply, result.result, "a posição");
    },
  );
  app.post<{ Body: AdminInventoryDocumentInput }>(
    "/admin/inventory/documents",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.INVENTORY_MOVEMENTS_POST,
      );
      if (!context) return;
      const body = request.body;
      if (
        !body ||
        !["receipt", "adjustment", "loss", "internal_use"].includes(
          body.kind,
        ) ||
        !normalizeOptionalText(body.reason) ||
        !normalizeOptionalText(body.idempotency_key) ||
        Number.isNaN(Date.parse(body.occurred_at || "")) ||
        !Array.isArray(body.lines) ||
        body.lines.length === 0 ||
        body.lines.some(
          (line) =>
            !normalizeOptionalText(line.position_id) ||
            finiteInteger(line.quantity, 1) == null ||
            (line.unit_cost != null &&
              (!Number.isFinite(Number(line.unit_cost)) ||
                Number(line.unit_cost) < 0)),
        )
      )
        return send(
          reply,
          400,
          ADMIN_ERROR_CODE.VALIDATION,
          "Documento de estoque inválido.",
        );
      const result = await repository.postDocument(
        context.hotelId,
        context.auth.session.id,
        body,
      );
      return "id" in result
        ? reply
            .status(result.created ? 201 : 200)
            .send({ item: { id: result.id } })
        : mutationError(reply, result.result, "o estoque");
    },
  );
  app.post<{ Body: AdminInventoryTransferInput }>(
    "/admin/inventory/transfers",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.INVENTORY_MOVEMENTS_POST,
      );
      if (!context) return;
      const body = request.body;
      if (
        !body ||
        body.source_location_id === body.destination_location_id ||
        finiteInteger(body.quantity, 1) == null ||
        !normalizeOptionalText(body.reason) ||
        !normalizeOptionalText(body.idempotency_key) ||
        Number.isNaN(Date.parse(body.occurred_at || ""))
      )
        return send(
          reply,
          400,
          ADMIN_ERROR_CODE.VALIDATION,
          "Transferência inválida.",
        );
      const result = await repository.transfer(
        context.hotelId,
        context.auth.session.id,
        body,
      );
      return "id" in result
        ? reply
            .status(result.created ? 201 : 200)
            .send({ item: { id: result.id } })
        : mutationError(reply, result.result, "a transferência");
    },
  );
  app.get<{ Querystring: ListQuery }>(
    "/admin/inventory/movements",
    async (request, reply) => {
      const context = scope(request, reply, PERMISSIONS.INVENTORY_READ);
      if (!context) return;
      const parsed = Number(request.query.limit || 50);
      const limit =
        Number.isInteger(parsed) && parsed >= 1 && parsed <= 100 ? parsed : 50;
      return reply.send(
        await repository.listMovements(
          context.hotelId,
          {
            cursor: normalizeOptionalText(request.query.cursor) || undefined,
            limit,
            locationId:
              normalizeOptionalText(request.query.location_id) || undefined,
            productId:
              normalizeOptionalText(request.query.product_id) || undefined,
            kind: request.query.kind,
          },
          context.auth.session.permissions.includes(
            PERMISSIONS.INVENTORY_COSTS_READ,
          ),
        ),
      );
    },
  );
  app.get<{ Querystring: ListQuery }>(
    "/admin/inventory/audit",
    async (request, reply) => {
      const context = scope(request, reply, PERMISSIONS.INVENTORY_READ);
      if (!context) return;
      const parsed = Number(request.query.limit || 50);
      const limit =
        Number.isInteger(parsed) && parsed >= 1 && parsed <= 100 ? parsed : 50;
      return reply.send(
        await repository.listAudit(context.hotelId, {
          cursor: normalizeOptionalText(request.query.cursor) || undefined,
          limit,
        }),
      );
    },
  );
  app.get("/admin/inventory/counts", async (request, reply) => {
    const context = scope(request, reply, PERMISSIONS.INVENTORY_READ);
    if (!context) return;
    return reply.send({ items: await repository.listCounts(context.hotelId) });
  });
  app.post<{
    Body: {
      location_id?: string;
      product_ids?: string[];
      notes?: string | null;
      idempotency_key?: string;
    };
  }>("/admin/inventory/counts", async (request, reply) => {
    const context = scope(request, reply, PERMISSIONS.INVENTORY_COUNTS_PERFORM);
    if (!context) return;
    const body = request.body || {};
    if (
      !normalizeOptionalText(body.location_id) ||
      !normalizeOptionalText(body.idempotency_key) ||
      (body.product_ids &&
        (!Array.isArray(body.product_ids) ||
          new Set(body.product_ids).size !== body.product_ids.length))
    )
      return send(
        reply,
        400,
        ADMIN_ERROR_CODE.VALIDATION,
        "Contagem inválida.",
      );
    const result = await repository.createCount(
      context.hotelId,
      context.auth.session.id,
      {
        location_id: String(body.location_id),
        product_ids: body.product_ids,
        notes: normalizeOptionalText(body.notes),
        idempotency_key: String(body.idempotency_key),
      },
    );
    return "item" in result
      ? reply.status(result.created ? 201 : 200).send({ item: result.item })
      : mutationError(reply, result.result, "a contagem");
  });
  app.put<{
    Params: HotelIdParams;
    Body: { items?: Array<{ item_id: string; counted_quantity: number }> };
  }>("/admin/inventory/counts/:id/items", async (request, reply) => {
    const context = scope(request, reply, PERMISSIONS.INVENTORY_COUNTS_PERFORM);
    if (!context) return;
    const countId = id(request),
      items = request.body?.items;
    if (
      !countId ||
      !Array.isArray(items) ||
      items.length === 0 ||
      items.some(
        (item) =>
          !normalizeOptionalText(item.item_id) ||
          finiteInteger(item.counted_quantity) == null,
      )
    )
      return send(
        reply,
        400,
        ADMIN_ERROR_CODE.VALIDATION,
        "Itens de contagem inválidos.",
      );
    const result = await repository.updateCount(
      context.hotelId,
      context.auth.session.id,
      countId,
      items,
    );
    return "item" in result
      ? reply.send({ item: result.item })
      : mutationError(reply, result.result, "a contagem");
  });
  for (const action of ["complete", "cancel"] as const)
    app.post<{ Params: HotelIdParams }>(
      `/admin/inventory/counts/:id/${action}`,
      async (request, reply) => {
        const context = scope(
          request,
          reply,
          PERMISSIONS.INVENTORY_COUNTS_PERFORM,
        );
        if (!context) return;
        const countId = id(request);
        if (!countId)
          return send(
            reply,
            400,
            ADMIN_ERROR_CODE.VALIDATION,
            "Contagem inválida.",
          );
        const result =
          action === "complete"
            ? await repository.completeCount(
                context.hotelId,
                context.auth.session.id,
                countId,
              )
            : await repository.cancelCount(
                context.hotelId,
                context.auth.session.id,
                countId,
              );
        return "item" in result
          ? reply.send({ item: result.item })
          : mutationError(reply, result.result, "a contagem");
      },
    );
}
