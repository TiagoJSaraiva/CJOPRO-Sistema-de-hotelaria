import type { FastifyInstance } from "fastify";
import {
  ADMIN_PERMISSION_TYPES,
  PERMISSIONS,
  type AdminPermissionCreateInput,
  type AdminPermissionType,
  type AdminPermissionUpdateInput,
  type HotelIdParams
} from "@hotel/shared";
import { ensureAuthorized } from "../auth/authorization";
import { normalizeOptionalText } from "../common/text";
import { createPermissionsRepository, type PermissionsRepository } from "../repositories/permissionsRepository";

type PermissionCreateBody = Partial<AdminPermissionCreateInput>;
type PermissionUpdateBody = Partial<AdminPermissionUpdateInput>;

function parsePermissionType(value: unknown): AdminPermissionType | null {
  if (value === ADMIN_PERMISSION_TYPES.SYSTEM || value === ADMIN_PERMISSION_TYPES.HOTEL) {
    return value;
  }

  return null;
}

export function registerPermissionRoutes(
  app: FastifyInstance,
  repository: PermissionsRepository = createPermissionsRepository()
): void {
  app.get("/admin/permissions", async (request, reply) => {
    if (!ensureAuthorized(request, reply, PERMISSIONS.PERMISSION_READ)) {
      return;
    }

    try {
      const data = await repository.listPermissions();

      return reply.send({ items: data ?? [] });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Falha ao consultar permissoes." });
    }
  });

  app.post<{ Body: PermissionCreateBody }>("/admin/permissions", async (request, reply) => {
    if (!ensureAuthorized(request, reply, PERMISSIONS.PERMISSION_CREATE)) {
      return;
    }

    const name = normalizeOptionalText(request.body?.name);
    const type = parsePermissionType(request.body?.type);

    if (!name) {
      return reply.status(400).send({ message: "Nome da permissao e obrigatorio." });
    }

    if (!type) {
      return reply.status(400).send({ message: "Tipo da permissao e obrigatorio." });
    }

    const createResult = await repository.createPermission({ name, type }).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!createResult) {
      return reply.status(500).send({ message: "Falha ao criar permissao." });
    }

    if (createResult.result === "conflict") {
      return reply.status(409).send({ message: "Nome de permissao ja existente." });
    }

    if (!createResult.item) {
      return reply.status(500).send({ message: "Falha ao criar permissao." });
    }

    return reply.status(201).send({ item: createResult.item });
  });

  app.put<{ Params: HotelIdParams; Body: PermissionUpdateBody }>("/admin/permissions/:id", async (request, reply) => {
    if (!ensureAuthorized(request, reply, PERMISSIONS.PERMISSION_UPDATE)) {
      return;
    }

    const id = request.params.id;
    const name = request.body?.name !== undefined ? normalizeOptionalText(request.body?.name) : undefined;
    const type = request.body?.type !== undefined ? parsePermissionType(request.body?.type) : undefined;

    if (!id) {
      return reply.status(400).send({ message: "Id da permissao e obrigatorio para atualizacao." });
    }

    if (request.body?.name !== undefined && !name) {
      return reply.status(400).send({ message: "Nome da permissao e obrigatorio para atualizacao." });
    }

    if (request.body?.type !== undefined && !type) {
      return reply.status(400).send({ message: "Tipo da permissao invalido para atualizacao." });
    }

    const payload: { name?: string; type?: AdminPermissionType } = {};

    if (name !== undefined && name !== null) {
      payload.name = name;
    }

    if (type !== undefined && type !== null) {
      payload.type = type;
    }

    if (!Object.keys(payload).length) {
      return reply.status(400).send({ message: "Nenhum campo informado para atualizacao." });
    }

    const updateResult = await repository.updatePermission(id, payload).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!updateResult) {
      return reply.status(500).send({ message: "Falha ao atualizar permissao." });
    }

    if (updateResult.result === "not-found") {
      return reply.status(404).send({ message: "Permissao nao encontrada." });
    }

    if (updateResult.result === "conflict") {
      return reply.status(409).send({ message: "Nome de permissao ja existente." });
    }

    if (!updateResult.item) {
      return reply.status(500).send({ message: "Falha ao atualizar permissao." });
    }

    return reply.send({ item: updateResult.item });
  });

  app.delete<{ Params: HotelIdParams }>("/admin/permissions/:id", async (request, reply) => {
    if (!ensureAuthorized(request, reply, PERMISSIONS.PERMISSION_DELETE)) {
      return;
    }

    const id = request.params.id;

    if (!id) {
      return reply.status(400).send({ message: "Id da permissao e obrigatorio para exclusao." });
    }

    const deleteResult = await repository.deletePermission(id).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!deleteResult) {
      return reply.status(500).send({ message: "Falha ao excluir permissao." });
    }

    if (deleteResult === "not-found") {
      return reply.status(404).send({ message: "Permissao nao encontrada." });
    }

    if (deleteResult === "conflict") {
      return reply.status(409).send({ message: "Permissao nao pode ser excluida: possui dependencias ativas." });
    }

    return reply.send({ ok: true });
  });
}
