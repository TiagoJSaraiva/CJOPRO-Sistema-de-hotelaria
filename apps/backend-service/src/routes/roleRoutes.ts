import type { FastifyInstance } from "fastify";
import {
  PERMISSIONS,
  type AdminRoleCreateInput,
  type AdminRoleUpdateInput,
  type HotelIdParams
} from "@hotel/shared";
import { mapAdminRole, normalizePermissionIds } from "../admin/mappers";
import { ensureAuthorized, ensureAuthorizedAny } from "../auth/authorization";
import { normalizeOptionalText } from "../common/text";
import { createRolesRepository, type RolesRepository } from "../repositories/rolesRepository";

type RoleCreateBody = Partial<AdminRoleCreateInput>;
type RoleUpdateBody = Partial<AdminRoleUpdateInput>;

export function registerRoleRoutes(app: FastifyInstance, repository: RolesRepository = createRolesRepository()): void {
  app.get("/admin/roles/reference-data", async (request, reply) => {
    if (!ensureAuthorizedAny(request, reply, [PERMISSIONS.ROLE_READ, PERMISSIONS.ROLE_CREATE, PERMISSIONS.ROLE_UPDATE])) {
      return;
    }

    try {
      const [hotels, permissions] = await Promise.all([repository.listReferenceHotels(), repository.listReferencePermissions()]);

      return reply.send({
        hotels: hotels.map((item) => ({ id: item.id, name: item.name })),
        permissions: permissions.map((item) => ({ id: item.id, name: item.name }))
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Falha ao consultar dados auxiliares de roles." });
    }
  });

  app.get("/admin/roles", async (request, reply) => {
    if (!ensureAuthorized(request, reply, PERMISSIONS.ROLE_READ)) {
      return;
    }

    try {
      const data = await repository.listRolesWithRelations();

      return reply.send({ items: data.map(mapAdminRole) });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Falha ao consultar roles." });
    }
  });

  app.post<{ Body: RoleCreateBody }>("/admin/roles", async (request, reply) => {
    if (!ensureAuthorized(request, reply, PERMISSIONS.ROLE_CREATE)) {
      return;
    }

    const name = normalizeOptionalText(request.body?.name);
    const hotelId = normalizeOptionalText(request.body?.hotel_id || null);
    const permissionIds = normalizePermissionIds(request.body?.permission_ids || []);

    if (!name) {
      return reply.status(400).send({ message: "Nome da role e obrigatorio." });
    }

    if (hotelId) {
      const exists = await repository.hotelExists(hotelId).catch((error) => {
        request.log.error(error);
        return null;
      });

      if (exists === null) {
        return reply.status(500).send({ message: "Falha ao validar hotel da role." });
      }

      if (!exists) {
        return reply.status(400).send({ message: "Hotel selecionado nao existe." });
      }
    }

    if (permissionIds.length) {
      const total = await repository.countPermissionsByIds(permissionIds).catch((error) => {
        request.log.error(error);
        return null;
      });

      if (total === null) {
        return reply.status(500).send({ message: "Falha ao validar permissoes da role." });
      }

      if (total !== permissionIds.length) {
        return reply.status(400).send({ message: "Uma ou mais permissoes selecionadas nao existem." });
      }
    }

    const createRoleResult = await repository.createRoleWithPermissions({ name, hotel_id: hotelId }, permissionIds).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!createRoleResult) {
      return reply.status(500).send({ message: "Falha ao criar role." });
    }

    if (createRoleResult.result === "conflict") {
      return reply.status(409).send({ message: "Nome de role ja existente." });
    }

    if (!createRoleResult.id) {
      return reply.status(500).send({ message: "Falha ao criar role." });
    }

    const roleWithRelations = await repository.getRoleWithRelationsById(createRoleResult.id).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!roleWithRelations) {
      return reply.status(500).send({ message: "Falha ao consultar role criada." });
    }

    return reply.status(201).send({ item: mapAdminRole(roleWithRelations) });
  });

  app.put<{ Params: HotelIdParams; Body: RoleUpdateBody }>("/admin/roles/:id", async (request, reply) => {
    if (!ensureAuthorized(request, reply, PERMISSIONS.ROLE_UPDATE)) {
      return;
    }

    const id = request.params.id;

    if (!id) {
      return reply.status(400).send({ message: "Id da role e obrigatorio para atualizacao." });
    }

    const payload: Record<string, unknown> = {};

    if (request.body?.name !== undefined) {
      const parsedName = normalizeOptionalText(request.body.name);

      if (!parsedName) {
        return reply.status(400).send({ message: "Nome da role nao pode ficar vazio." });
      }

      payload.name = parsedName;
    }

    if (request.body?.hotel_id !== undefined) {
      payload.hotel_id = normalizeOptionalText(request.body.hotel_id || null);
    }

    const hasPermissionsPayload = request.body?.permission_ids !== undefined;
    const permissionIds = hasPermissionsPayload ? normalizePermissionIds(request.body?.permission_ids) : [];

    if (!Object.keys(payload).length && !hasPermissionsPayload) {
      return reply.status(400).send({ message: "Nenhum campo informado para atualizacao." });
    }

    if (payload.hotel_id) {
      const exists = await repository.hotelExists(payload.hotel_id as string).catch((error) => {
        request.log.error(error);
        return null;
      });

      if (exists === null) {
        return reply.status(500).send({ message: "Falha ao validar hotel da role." });
      }

      if (!exists) {
        return reply.status(400).send({ message: "Hotel selecionado nao existe." });
      }
    }

    if (hasPermissionsPayload && permissionIds.length) {
      const total = await repository.countPermissionsByIds(permissionIds).catch((error) => {
        request.log.error(error);
        return null;
      });

      if (total === null) {
        return reply.status(500).send({ message: "Falha ao validar permissoes da role." });
      }

      if (total !== permissionIds.length) {
        return reply.status(400).send({ message: "Uma ou mais permissoes selecionadas nao existem." });
      }
    }

    const updateResult = await repository
      .updateRoleWithPermissions(id, payload, hasPermissionsPayload ? permissionIds : undefined)
      .catch((error) => {
        request.log.error(error);
        return null;
      });

    if (!updateResult) {
      return reply.status(500).send({ message: "Falha ao atualizar role." });
    }

    if (updateResult === "conflict") {
      return reply.status(409).send({ message: "Nome de role ja existente." });
    }

    if (updateResult === "not-found") {
      return reply.status(404).send({ message: "Role nao encontrada." });
    }

    const updatedRole = await repository.getRoleWithRelationsById(id).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!updatedRole) {
      return reply.status(500).send({ message: "Falha ao consultar role atualizada." });
    }

    return reply.send({ item: mapAdminRole(updatedRole) });
  });

  app.delete<{ Params: HotelIdParams }>("/admin/roles/:id", async (request, reply) => {
    if (!ensureAuthorized(request, reply, PERMISSIONS.ROLE_DELETE)) {
      return;
    }

    const id = request.params.id;

    if (!id) {
      return reply.status(400).send({ message: "Id da role e obrigatorio para exclusao." });
    }

    const deleteResult = await repository.deleteRole(id).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!deleteResult) {
      return reply.status(500).send({ message: "Falha ao excluir role." });
    }

    if (deleteResult === "not-found") {
      return reply.status(404).send({ message: "Role nao encontrada." });
    }

    return reply.send({ ok: true });
  });
}
