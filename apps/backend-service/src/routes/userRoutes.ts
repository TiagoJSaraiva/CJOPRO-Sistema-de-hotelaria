import type { FastifyInstance } from "fastify";
import {
  PERMISSIONS,
  createServerClient,
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

type UserCreateBody = Partial<AdminUserCreateInput>;
type UserUpdateBody = Partial<AdminUserUpdateInput>;

export function registerUserRoutes(app: FastifyInstance): void {
  app.get("/admin/users/reference-data", async (request, reply) => {
    if (!ensureAuthorizedAny(request, reply, [PERMISSIONS.USER_READ, PERMISSIONS.USER_CREATE, PERMISSIONS.USER_UPDATE])) {
      return;
    }

    const supabase = createServerClient();
    const [{ data: hotels, error: hotelsError }, { data: roles, error: rolesError }] = await Promise.all([
      supabase.from("hotels").select("id,name").order("name", { ascending: true }),
      supabase.from("roles").select("id,name,hotel_id,hotels(name)").order("name", { ascending: true })
    ]);

    if (hotelsError || rolesError) {
      request.log.error(hotelsError || rolesError);
      return reply.status(500).send({ message: "Falha ao consultar dados auxiliares de usuarios." });
    }

    return reply.send({
      hotels: (hotels || []).map((item: any) => ({ id: item.id, name: item.name })),
      roles: (roles || []).map(mapRoleOption)
    });
  });

  app.get("/admin/users", async (request, reply) => {
    if (!ensureAuthorized(request, reply, PERMISSIONS.USER_READ)) {
      return;
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("users")
      .select("id,name,email,is_active,last_login_at,created_at,user_roles(role_id,roles(id,name,hotel_id,hotels(name)))")
      .order("created_at", { ascending: false });

    if (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Falha ao consultar usuarios." });
    }

    return reply.send({ items: (data || []).map(mapAdminUser) });
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

    const supabase = createServerClient();

    if (roleAssignments.length) {
      const roleIds = roleAssignments.map((item) => item.role_id);
      const { data: roleRows, error: roleError } = await supabase
        .from("roles")
        .select("id,name,hotel_id,hotels(name)")
        .in("id", roleIds);

      if (roleError) {
        request.log.error(roleError);
        return reply.status(500).send({ message: "Falha ao validar papeis para o usuario." });
      }

      const roleMap = new Map((roleRows || []).map((item: any) => [item.id, item]));

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

    const { data: createdUser, error: createError } = await supabase
      .from("users")
      .insert({
        name,
        email,
        password_hash: hashTemporaryPassword(tempPassword),
        is_active: true
      })
      .select("id")
      .single();

    if (createError) {
      request.log.error(createError);

      if (createError.code === "23505") {
        return reply.status(409).send({ message: "Email ja utilizado por outro usuario." });
      }

      return reply.status(500).send({ message: "Falha ao criar usuario." });
    }

    if (roleAssignments.length) {
      const { error: userRolesError } = await supabase
        .from("user_roles")
        .insert(roleAssignments.map((item) => ({ user_id: createdUser.id, role_id: item.role_id })));

      if (userRolesError) {
        request.log.error(userRolesError);
        return reply.status(500).send({ message: "Usuario criado, mas falhou ao vincular papeis." });
      }
    }

    const { data: userWithRelations, error: userWithRelationsError } = await supabase
      .from("users")
      .select("id,name,email,is_active,last_login_at,created_at,user_roles(role_id,roles(id,name,hotel_id,hotels(name)))")
      .eq("id", createdUser.id)
      .single();

    if (userWithRelationsError) {
      request.log.error(userWithRelationsError);
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

      payload.password_hash = hashTemporaryPassword(parsedPassword);
    }

    if (request.body?.is_active !== undefined) {
      payload.is_active = !!request.body.is_active;
    }

    const hasRoleAssignments = request.body?.role_assignments !== undefined;
    const roleAssignments = hasRoleAssignments ? normalizeRoleAssignments(request.body?.role_assignments) : [];

    if (!Object.keys(payload).length && !hasRoleAssignments) {
      return reply.status(400).send({ message: "Nenhum campo informado para atualizacao." });
    }

    const supabase = createServerClient();

    if (hasRoleAssignments && roleAssignments.length) {
      const roleIds = roleAssignments.map((item) => item.role_id);
      const { data: roleRows, error: roleError } = await supabase
        .from("roles")
        .select("id,name,hotel_id,hotels(name)")
        .in("id", roleIds);

      if (roleError) {
        request.log.error(roleError);
        return reply.status(500).send({ message: "Falha ao validar papeis para o usuario." });
      }

      const roleMap = new Map((roleRows || []).map((item: any) => [item.id, item]));

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

    if (Object.keys(payload).length) {
      const { error: updateError } = await supabase.from("users").update(payload).eq("id", id);

      if (updateError) {
        request.log.error(updateError);

        if (updateError.code === "23505") {
          return reply.status(409).send({ message: "Email ja utilizado por outro usuario." });
        }

        if (updateError.code === "PGRST116") {
          return reply.status(404).send({ message: "Usuario nao encontrado." });
        }

        return reply.status(500).send({ message: "Falha ao atualizar usuario." });
      }
    } else {
      const { data: userExists, error: userExistsError } = await supabase.from("users").select("id").eq("id", id).single();

      if (userExistsError || !userExists) {
        return reply.status(404).send({ message: "Usuario nao encontrado." });
      }
    }

    if (hasRoleAssignments) {
      const { error: deleteError } = await supabase.from("user_roles").delete().eq("user_id", id);

      if (deleteError) {
        request.log.error(deleteError);
        return reply.status(500).send({ message: "Falha ao atualizar papeis do usuario." });
      }

      if (roleAssignments.length) {
        const { error: insertError } = await supabase
          .from("user_roles")
          .insert(roleAssignments.map((item) => ({ user_id: id, role_id: item.role_id })));

        if (insertError) {
          request.log.error(insertError);
          return reply.status(500).send({ message: "Falha ao atualizar papeis do usuario." });
        }
      }
    }

    const { data: updatedUser, error: updatedUserError } = await supabase
      .from("users")
      .select("id,name,email,is_active,last_login_at,created_at,user_roles(role_id,roles(id,name,hotel_id,hotels(name)))")
      .eq("id", id)
      .single();

    if (updatedUserError || !updatedUser) {
      request.log.error(updatedUserError);
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

    const supabase = createServerClient();
    const { data, error } = await supabase.from("users").delete().eq("id", id).select("id");

    if (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Falha ao excluir usuario." });
    }

    if (!data || !data.length) {
      return reply.status(404).send({ message: "Usuario nao encontrado." });
    }

    return reply.send({ ok: true });
  });
}
