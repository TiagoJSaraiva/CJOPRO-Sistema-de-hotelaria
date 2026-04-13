import type { FastifyInstance } from "fastify";
import {
  PERMISSIONS,
  isValidEmail,
  normalizeEmail,
  type AdminUserCreateInput,
  type AdminUserUpdateInput,
  type HotelIdParams
} from "@hotel/shared";
import { mapAdminUser, mapRoleOption, normalizeRoleAssignments } from "../admin/mappers";
import { ensureAuthorized, ensureAuthorizedAny } from "../auth/authorization";
import { hashTemporaryPassword } from "../auth/session";
import { normalizeOptionalText } from "../common/text";
import { createUsersRepository, type UsersRepository } from "../repositories/usersRepository";

type UserCreateBody = Partial<AdminUserCreateInput>;
type UserUpdateBody = Partial<AdminUserUpdateInput>;

export function registerUserRoutes(app: FastifyInstance, repository: UsersRepository = createUsersRepository()): void {
  app.get("/admin/users/reference-data", async (request, reply) => {
    if (!ensureAuthorizedAny(request, reply, [PERMISSIONS.USER_READ, PERMISSIONS.USER_CREATE, PERMISSIONS.USER_UPDATE])) {
      return;
    }

    try {
      const [hotels, roles] = await Promise.all([repository.listReferenceHotels(), repository.listReferenceRoles()]);

      return reply.send({
        hotels: hotels.map((item) => ({ id: item.id, name: item.name })),
        roles: roles.map(mapRoleOption)
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Falha ao consultar dados auxiliares de usuarios." });
    }
  });

  app.get("/admin/users", async (request, reply) => {
    if (!ensureAuthorized(request, reply, PERMISSIONS.USER_READ)) {
      return;
    }

    try {
      const data = await repository.listUsersWithRelations();

      return reply.send({ items: data.map(mapAdminUser) });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Falha ao consultar usuarios." });
    }
  });

  app.post<{ Body: UserCreateBody }>("/admin/users", async (request, reply) => {
    if (!ensureAuthorized(request, reply, PERMISSIONS.USER_CREATE)) {
      return;
    }

    const name = normalizeOptionalText(request.body?.name);
    const email = normalizeOptionalText(normalizeEmail(request.body?.email || ""));
    const tempPassword = normalizeOptionalText(request.body?.password_hash);
    const roleAssignments = normalizeRoleAssignments(request.body?.role_assignments || []);

    if (!name || !email || !tempPassword) {
      return reply.status(400).send({ message: "Nome, email e senha temporaria sao obrigatorios." });
    }

    if (!isValidEmail(email)) {
      return reply.status(400).send({ message: "Email invalido." });
    }

    const roleIds = roleAssignments.map((item) => item.role_id);

    if (roleAssignments.length) {
      let roleRows: Awaited<ReturnType<UsersRepository["findRolesByIds"]>>;

      try {
        roleRows = await repository.findRolesByIds(roleIds);
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ message: "Falha ao validar papeis para o usuario." });
      }

      const roleMap = new Map(roleRows.map((item) => [item.id, item]));

      if (roleMap.size !== roleIds.length) {
        return reply.status(400).send({ message: "Uma ou mais roles selecionadas nao existem." });
      }

      for (const assignment of roleAssignments) {
        const role = roleMap.get(assignment.role_id);

        if (!role) {
          return reply.status(400).send({ message: "Role selecionada nao existe." });
        }

        if (role.hotel_id && assignment.hotel_id && role.hotel_id !== assignment.hotel_id) {
          return reply.status(400).send({ message: "A role selecionada nao pertence ao hotel escolhido." });
        }
      }
    }

    const passwordHash = await hashTemporaryPassword(tempPassword).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!passwordHash) {
      return reply.status(500).send({ message: "Falha ao criar usuario." });
    }

    const createResult = await repository
      .createUserWithRoles(
        {
          name,
          email,
          password_hash: passwordHash,
          is_active: true
        },
        roleIds
      )
      .catch((error) => {
        request.log.error(error);
        return null;
      });

    if (!createResult) {
      return reply.status(500).send({ message: "Falha ao criar usuario." });
    }

    if (createResult.result === "conflict") {
      return reply.status(409).send({ message: "Email ja utilizado por outro usuario." });
    }

    if (!createResult.id) {
      return reply.status(500).send({ message: "Falha ao criar usuario." });
    }

    const userWithRelations = await repository.getUserWithRelationsById(createResult.id).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!userWithRelations) {
      return reply.status(500).send({ message: "Falha ao consultar usuario criado." });
    }

    return reply.status(201).send({ item: mapAdminUser(userWithRelations) });
  });

  app.put<{ Params: HotelIdParams; Body: UserUpdateBody }>("/admin/users/:id", async (request, reply) => {
    if (!ensureAuthorized(request, reply, PERMISSIONS.USER_UPDATE)) {
      return;
    }

    const id = request.params.id;

    if (!id) {
      return reply.status(400).send({ message: "Id do usuario e obrigatorio para atualizacao." });
    }

    const payload: Record<string, unknown> = {};

    if (request.body?.name !== undefined) {
      const parsedName = normalizeOptionalText(request.body.name);

      if (!parsedName) {
        return reply.status(400).send({ message: "Nome nao pode ficar vazio." });
      }

      payload.name = parsedName;
    }

    if (request.body?.email !== undefined) {
      const parsedEmail = normalizeOptionalText(normalizeEmail(request.body.email || ""));

      if (!parsedEmail) {
        return reply.status(400).send({ message: "Email nao pode ficar vazio." });
      }

      if (!isValidEmail(parsedEmail)) {
        return reply.status(400).send({ message: "Email invalido." });
      }

      payload.email = parsedEmail;
    }

    if (request.body?.password_hash !== undefined) {
      const parsedPassword = normalizeOptionalText(request.body.password_hash);

      if (!parsedPassword) {
        return reply.status(400).send({ message: "Senha temporaria nao pode ficar vazia." });
      }

      const passwordHash = await hashTemporaryPassword(parsedPassword).catch((error) => {
        request.log.error(error);
        return null;
      });

      if (!passwordHash) {
        return reply.status(500).send({ message: "Falha ao atualizar usuario." });
      }

      payload.password_hash = passwordHash;
    }

    if (request.body?.is_active !== undefined) {
      payload.is_active = !!request.body.is_active;
    }

    const hasRoleAssignments = request.body?.role_assignments !== undefined;
    const roleAssignments = hasRoleAssignments ? normalizeRoleAssignments(request.body?.role_assignments) : [];

    if (!Object.keys(payload).length && !hasRoleAssignments) {
      return reply.status(400).send({ message: "Nenhum campo informado para atualizacao." });
    }

    if (hasRoleAssignments && roleAssignments.length) {
      const roleIds = roleAssignments.map((item) => item.role_id);

      let roleRows: Awaited<ReturnType<UsersRepository["findRolesByIds"]>>;

      try {
        roleRows = await repository.findRolesByIds(roleIds);
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ message: "Falha ao validar papeis para o usuario." });
      }

      const roleMap = new Map(roleRows.map((item) => [item.id, item]));

      if (roleMap.size !== roleIds.length) {
        return reply.status(400).send({ message: "Uma ou mais roles selecionadas nao existem." });
      }

      for (const assignment of roleAssignments) {
        const role = roleMap.get(assignment.role_id);

        if (!role) {
          return reply.status(400).send({ message: "Role selecionada nao existe." });
        }

        if (role.hotel_id && assignment.hotel_id && role.hotel_id !== assignment.hotel_id) {
          return reply.status(400).send({ message: "A role selecionada nao pertence ao hotel escolhido." });
        }
      }
    }

    const updateResult = await repository
      .updateUserWithRoles(
        id,
        payload,
        hasRoleAssignments ? roleAssignments.map((item) => item.role_id) : undefined
      )
      .catch((error) => {
        request.log.error(error);
        return null;
      });

    if (!updateResult) {
      return reply.status(500).send({ message: "Falha ao atualizar usuario." });
    }

    if (updateResult === "conflict") {
      return reply.status(409).send({ message: "Email ja utilizado por outro usuario." });
    }

    if (updateResult === "not-found") {
      return reply.status(404).send({ message: "Usuario nao encontrado." });
    }

    const updatedUser = await repository.getUserWithRelationsById(id).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!updatedUser) {
      return reply.status(500).send({ message: "Falha ao consultar usuario atualizado." });
    }

    return reply.send({ item: mapAdminUser(updatedUser) });
  });

  app.delete<{ Params: HotelIdParams }>("/admin/users/:id", async (request, reply) => {
    if (!ensureAuthorized(request, reply, PERMISSIONS.USER_DELETE)) {
      return;
    }

    const id = request.params.id;

    if (!id) {
      return reply.status(400).send({ message: "Id do usuario e obrigatorio para exclusao." });
    }

    const deleteResult = await repository.deleteUser(id).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!deleteResult) {
      return reply.status(500).send({ message: "Falha ao excluir usuario." });
    }

    if (deleteResult === "not-found") {
      return reply.status(404).send({ message: "Usuario nao encontrado." });
    }

    return reply.send({ ok: true });
  });
}
