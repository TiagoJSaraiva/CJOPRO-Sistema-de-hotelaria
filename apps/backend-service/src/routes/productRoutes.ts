import type { FastifyInstance } from "fastify";
import { ADMIN_ERROR_CODE, PERMISSIONS, type AdminProductCreateInput, type AdminProductUpdateInput, type HotelIdParams } from "@hotel/shared";
import { ensureAuthorizedWithScope } from "../auth/authorization";
import { adminError } from "../common/adminError";
import { normalizeOptionalText } from "../common/text";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import { createProductsRepository, type ProductsRepository } from "../repositories/productsRepository";

type ProductCreateBody = Partial<AdminProductCreateInput>;
type ProductUpdateBody = Partial<AdminProductUpdateInput>;

export function registerProductRoutes(app: FastifyInstance, repository: ProductsRepository = createProductsRepository()): void {
  app.get("/admin/products", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.PRODUCT_READ);
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const data = await repository.listProducts(activeHotelId).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!data) return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao consultar produtos."));

    return reply.send({ items: data });
  });

  app.post<{ Body: ProductCreateBody }>("/admin/products", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.PRODUCT_CREATE);
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const name = normalizeOptionalText(request.body?.name);
    const unitPrice = Number(request.body?.unit_price);

    if (!name || !Number.isFinite(unitPrice) || unitPrice < 0) {
      return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Nome e preco unitario valido sao obrigatorios."));
    }

    const createResult = await repository
      .createProduct(activeHotelId, {
        name,
        category: normalizeOptionalText(request.body?.category),
        unit_price: unitPrice,
        status: normalizeOptionalText(request.body?.status) || "active"
      })
      .catch((error) => {
        request.log.error(error);
        return null;
      });

    if (!createResult) return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao criar produto."));
    if (createResult.result === "conflict") return reply.status(409).send(adminError(ADMIN_ERROR_CODE.CONFLICT, "Conflito ao criar produto."));
    if (!createResult.item) return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao criar produto."));

    return reply.status(201).send({ item: createResult.item });
  });

  app.put<{ Params: HotelIdParams; Body: ProductUpdateBody }>("/admin/products/:id", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.PRODUCT_UPDATE);
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const id = normalizeOptionalText(request.params.id);
    if (!id) return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Id do produto e obrigatorio para atualizacao."));

    const payload: Record<string, unknown> = {};
    if (request.body?.name !== undefined) payload.name = normalizeOptionalText(request.body.name);
    if (request.body?.category !== undefined) payload.category = normalizeOptionalText(request.body.category);
    if (request.body?.status !== undefined) payload.status = normalizeOptionalText(request.body.status);
    if (request.body?.unit_price !== undefined) payload.unit_price = Number(request.body.unit_price);

    if (!Object.keys(payload).length) return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Nenhum campo informado para atualizacao."));

    const updateResult = await repository.updateProduct(id, activeHotelId, payload).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!updateResult) return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao atualizar produto."));
    if (updateResult.result === "not-found") return reply.status(404).send(adminError(ADMIN_ERROR_CODE.NOT_FOUND, "Produto nao encontrado neste hotel."));
    if (updateResult.result === "conflict") return reply.status(409).send(adminError(ADMIN_ERROR_CODE.CONFLICT, "Conflito de dados ao atualizar produto."));

    return reply.send({ item: updateResult.item });
  });

  app.delete<{ Params: HotelIdParams }>("/admin/products/:id", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.PRODUCT_DELETE);
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const id = normalizeOptionalText(request.params.id);
    if (!id) return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Id do produto e obrigatorio para exclusao."));

    const result = await repository.deleteProduct(id, activeHotelId).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!result) return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao excluir produto."));
    if (result === "not-found") return reply.status(404).send(adminError(ADMIN_ERROR_CODE.NOT_FOUND, "Produto nao encontrado neste hotel."));
    if (result === "conflict") return reply.status(409).send(adminError(ADMIN_ERROR_CODE.CONFLICT, "Produto nao pode ser excluido: possui dependencias ativas."));

    return reply.send({ ok: true });
  });
}
