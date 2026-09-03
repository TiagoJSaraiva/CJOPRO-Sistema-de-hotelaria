import type { FastifyInstance, FastifyReply } from "fastify";
import {
  ADMIN_ERROR_CODE,
  PERMISSIONS,
  type AdminErrorCode,
  type AdminProductCreateInput,
  type AdminProductCategoryInput,
  type AdminProductUpdateInput,
  type HotelIdParams,
} from "@hotel/shared";
import { ensureAuthorizedWithScope } from "../auth/authorization";
import { adminError } from "../common/adminError";
import { normalizeOptionalText } from "../common/text";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import {
  createProductsRepository,
  type ProductsRepository,
} from "../repositories/productsRepository";

type ProductBody = Partial<AdminProductCreateInput>;
type ProductCategoryBody = Partial<AdminProductCategoryInput>;
type CatalogListQuery = { include_archived?: boolean | string };

function includesArchived(query: CatalogListQuery): boolean {
  return query.include_archived === true || query.include_archived === "true";
}

function error(
  reply: FastifyReply,
  status: number,
  code: AdminErrorCode,
  message: string,
) {
  return reply.status(status).send(adminError(code, message));
}

function isProductKind(value: unknown): value is "physical" | "service" {
  return value === "physical" || value === "service";
}

function isProductSalesUnit(
  value: unknown,
): value is AdminProductCreateInput["sales_unit"] {
  return ["unit", "portion", "person", "hour", "daily", "service"].includes(
    String(value),
  );
}

function isProductStatus(
  value: unknown,
): value is NonNullable<AdminProductCreateInput["status"]> {
  return value === "active" || value === "inactive";
}

function productCreatePayload(
  body: ProductBody,
): AdminProductCreateInput | null {
  const name = normalizeOptionalText(body.name);
  const categoryId = normalizeOptionalText(body.category_id);
  const unitPrice = Number(body.unit_price);
  const code = normalizeOptionalText(body.internal_code);
  const description = normalizeOptionalText(body.description);
  if (!name || !categoryId || !Number.isFinite(unitPrice) || unitPrice < 0)
    return null;
  if (!isProductKind(body.kind) || !isProductSalesUnit(body.sales_unit))
    return null;
  if (body.status !== undefined && !isProductStatus(body.status)) return null;
  return {
    name,
    category_id: categoryId,
    unit_price: unitPrice,
    kind: body.kind,
    sales_unit: body.sales_unit,
    status: body.status || "active",
    internal_code: code,
    description,
  };
}

function productUpdatePayload(
  body: ProductBody,
): AdminProductUpdateInput | null {
  const payload: AdminProductUpdateInput = {};
  if (body.name !== undefined) {
    const name = normalizeOptionalText(body.name);
    if (!name) return null;
    payload.name = name;
  }
  if (body.category_id !== undefined) {
    const categoryId = normalizeOptionalText(body.category_id);
    if (!categoryId) return null;
    payload.category_id = categoryId;
  }
  if (body.unit_price !== undefined) {
    const unitPrice = Number(body.unit_price);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return null;
    payload.unit_price = unitPrice;
  }
  if (body.kind !== undefined) {
    if (!isProductKind(body.kind)) return null;
    payload.kind = body.kind;
  }
  if (body.sales_unit !== undefined) {
    if (!isProductSalesUnit(body.sales_unit)) return null;
    payload.sales_unit = body.sales_unit;
  }
  if (body.status !== undefined) {
    if (!isProductStatus(body.status)) return null;
    payload.status = body.status;
  }
  if (body.internal_code !== undefined)
    payload.internal_code = normalizeOptionalText(body.internal_code);
  if (body.description !== undefined)
    payload.description = normalizeOptionalText(body.description);
  return Object.keys(payload).length ? payload : null;
}

function categoryPayload(
  body: ProductCategoryBody,
  partial = false,
): Partial<AdminProductCategoryInput> | null {
  const payload: Partial<AdminProductCategoryInput> = {};
  if (!partial || body.name !== undefined) {
    const name = normalizeOptionalText(body.name);
    if (!name) return null;
    payload.name = name;
  }
  if (body.display_order !== undefined) {
    const order = Number(body.display_order);
    if (!Number.isInteger(order) || order < 0) return null;
    payload.display_order = order;
  }
  if (body.is_active !== undefined) payload.is_active = Boolean(body.is_active);
  return payload;
}

export function registerProductRoutes(
  app: FastifyInstance,
  repository: ProductsRepository = createProductsRepository(),
): void {
  app.get("/admin/products", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(
      request,
      reply,
      PERMISSIONS.PRODUCT_READ,
    );
    if (!auth) return;
    const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!hotelId) return;
    const includeArchived = includesArchived(request.query as CatalogListQuery);
    try {
      return reply.send({
        items: await repository.listProducts(hotelId, includeArchived),
      });
    } catch (cause) {
      request.log.error(cause);
      return error(
        reply,
        500,
        ADMIN_ERROR_CODE.INTERNAL,
        "Falha ao consultar produtos.",
      );
    }
  });

  app.post<{ Body: ProductBody }>("/admin/products", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(
      request,
      reply,
      PERMISSIONS.PRODUCT_CREATE,
    );
    if (!auth) return;
    const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!hotelId) return;
    const payload = productCreatePayload(request.body || {});
    if (!payload)
      return error(
        reply,
        400,
        ADMIN_ERROR_CODE.VALIDATION,
        "Dados do produto invalidos.",
      );
    try {
      const result = await repository.createProduct(
        hotelId,
        auth.session.id,
        payload,
      );
      if (result.result === "conflict")
        return error(
          reply,
          409,
          ADMIN_ERROR_CODE.CONFLICT,
          "Codigo interno em uso ou conflito de dados.",
        );
      return reply.status(201).send({ item: result.item });
    } catch (cause) {
      request.log.error(cause);
      return error(
        reply,
        500,
        ADMIN_ERROR_CODE.INTERNAL,
        "Falha ao criar produto.",
      );
    }
  });

  app.put<{ Params: HotelIdParams; Body: ProductBody }>(
    "/admin/products/:id",
    async (request, reply) => {
      const auth = ensureAuthorizedWithScope(
        request,
        reply,
        PERMISSIONS.PRODUCT_UPDATE,
      );
      if (!auth) return;
      const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
      if (!hotelId) return;
      const id = normalizeOptionalText(request.params.id);
      const payload = productUpdatePayload(request.body || {});
      if (!id || !payload)
        return error(
          reply,
          400,
          ADMIN_ERROR_CODE.VALIDATION,
          "Dados do produto invalidos.",
        );
      try {
        const result = await repository.updateProduct(
          id,
          hotelId,
          auth.session.id,
          payload,
        );
        if (result.result === "not-found")
          return error(
            reply,
            404,
            ADMIN_ERROR_CODE.NOT_FOUND,
            "Produto nao encontrado neste hotel.",
          );
        if (result.result === "conflict")
          return error(
            reply,
            409,
            ADMIN_ERROR_CODE.CONFLICT,
            "Codigo interno em uso ou conflito de dados.",
          );
        return reply.send({ item: result.item });
      } catch (cause) {
        request.log.error(cause);
        return error(
          reply,
          500,
          ADMIN_ERROR_CODE.INTERNAL,
          "Falha ao atualizar produto.",
        );
      }
    },
  );

  for (const [action, archived] of [
    ["archive", true],
    ["restore", false],
  ] as const)
    app.post<{ Params: HotelIdParams }>(
      `/admin/products/:id/${action}`,
      async (request, reply) => {
        const auth = ensureAuthorizedWithScope(
          request,
          reply,
          PERMISSIONS.PRODUCT_DELETE,
        );
        if (!auth) return;
        const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
        const id = normalizeOptionalText(request.params.id);
        if (!hotelId || !id) return;
        try {
          const result = await repository.setProductArchived(
            id,
            hotelId,
            auth.session.id,
            archived,
          );
          if (result.result === "not-found")
            return error(
              reply,
              404,
              ADMIN_ERROR_CODE.NOT_FOUND,
              "Produto nao encontrado neste hotel.",
            );
          return reply.send({ item: result.item });
        } catch (cause) {
          request.log.error(cause);
          return error(
            reply,
            500,
            ADMIN_ERROR_CODE.INTERNAL,
            "Falha ao atualizar produto.",
          );
        }
      },
    );

  app.get<{ Params: HotelIdParams }>(
    "/admin/products/:id/history",
    async (request, reply) => {
      const auth = ensureAuthorizedWithScope(
        request,
        reply,
        PERMISSIONS.PRODUCT_READ,
      );
      if (!auth) return;
      const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
      const id = normalizeOptionalText(request.params.id);
      if (!hotelId || !id) return;
      try {
        const items = await repository.listProductHistory(id, hotelId);
        return reply.send({ items: items || [] });
      } catch (cause) {
        request.log.error(cause);
        return error(
          reply,
          500,
          ADMIN_ERROR_CODE.INTERNAL,
          "Falha ao consultar historico.",
        );
      }
    },
  );

  app.get("/admin/product-categories", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(
      request,
      reply,
      PERMISSIONS.PRODUCT_READ,
    );
    if (!auth) return;
    const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!hotelId) return;
    try {
      return reply.send({
        items: await repository.listCategories(
          hotelId,
          includesArchived(request.query as CatalogListQuery),
        ),
      });
    } catch (cause) {
      request.log.error(cause);
      return error(
        reply,
        500,
        ADMIN_ERROR_CODE.INTERNAL,
        "Falha ao consultar categorias.",
      );
    }
  });
  app.post<{ Body: ProductCategoryBody }>(
    "/admin/product-categories",
    async (request, reply) => {
      const auth = ensureAuthorizedWithScope(
        request,
        reply,
        PERMISSIONS.PRODUCT_CREATE,
      );
      if (!auth) return;
      const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
      const payload = categoryPayload(request.body || {});
      if (!hotelId || !payload?.name)
        return error(
          reply,
          400,
          ADMIN_ERROR_CODE.VALIDATION,
          "Categoria invalida.",
        );
      try {
        const result = await repository.createCategory(
          hotelId,
          auth.session.id,
          {
            name: payload.name,
            display_order: payload.display_order,
            is_active: payload.is_active,
          },
        );
        if (result.result === "conflict")
          return error(
            reply,
            409,
            ADMIN_ERROR_CODE.CONFLICT,
            "Categoria ja existe neste hotel.",
          );
        return reply.status(201).send({ item: result.item });
      } catch (cause) {
        request.log.error(cause);
        return error(
          reply,
          500,
          ADMIN_ERROR_CODE.INTERNAL,
          "Falha ao criar categoria.",
        );
      }
    },
  );
  app.put<{ Params: HotelIdParams; Body: ProductCategoryBody }>(
    "/admin/product-categories/:id",
    async (request, reply) => {
      const auth = ensureAuthorizedWithScope(
        request,
        reply,
        PERMISSIONS.PRODUCT_UPDATE,
      );
      if (!auth) return;
      const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
      const id = normalizeOptionalText(request.params.id);
      const payload = categoryPayload(request.body || {}, true);
      if (!hotelId || !id || !payload || !Object.keys(payload).length)
        return error(
          reply,
          400,
          ADMIN_ERROR_CODE.VALIDATION,
          "Categoria invalida.",
        );
      try {
        const result = await repository.updateCategory(
          id,
          hotelId,
          auth.session.id,
          payload,
        );
        if (result.result === "not-found")
          return error(
            reply,
            404,
            ADMIN_ERROR_CODE.NOT_FOUND,
            "Categoria nao encontrada neste hotel.",
          );
        if (result.result === "conflict")
          return error(
            reply,
            409,
            ADMIN_ERROR_CODE.CONFLICT,
            "Categoria ja existe neste hotel.",
          );
        return reply.send({ item: result.item });
      } catch (cause) {
        request.log.error(cause);
        return error(
          reply,
          500,
          ADMIN_ERROR_CODE.INTERNAL,
          "Falha ao atualizar categoria.",
        );
      }
    },
  );
  for (const [action, archived] of [
    ["archive", true],
    ["restore", false],
  ] as const)
    app.post<{ Params: HotelIdParams }>(
      `/admin/product-categories/:id/${action}`,
      async (request, reply) => {
        const auth = ensureAuthorizedWithScope(
          request,
          reply,
          PERMISSIONS.PRODUCT_DELETE,
        );
        if (!auth) return;
        const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
        const id = normalizeOptionalText(request.params.id);
        if (!hotelId || !id) return;
        try {
          const result = await repository.setCategoryArchived(
            id,
            hotelId,
            auth.session.id,
            archived,
          );
          if (result.result === "not-found")
            return error(
              reply,
              404,
              ADMIN_ERROR_CODE.NOT_FOUND,
              "Categoria nao encontrada neste hotel.",
            );
          return reply.send({ item: result.item });
        } catch (cause) {
          request.log.error(cause);
          return error(
            reply,
            500,
            ADMIN_ERROR_CODE.INTERNAL,
            "Falha ao atualizar categoria.",
          );
        }
      },
    );
}
