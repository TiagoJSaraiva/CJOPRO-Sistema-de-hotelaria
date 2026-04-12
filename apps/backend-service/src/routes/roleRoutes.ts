import type { FastifyInstance } from "fastify";
import {
  PERMISSIONS,
  createServerClient,
  type AdminRoleCreateInput,
  type AdminRoleUpdateInput,
  type HotelIdParams
} from "@hotel/shared";
import { mapAdminRole, normalizePermissionIds } from "../admin/mappers";
import { ensureAuthorized, ensureAuthorizedAny } from "../auth/authorization";
import { normalizeOptionalText } from "../common/text";

type RoleCreateBody = Partial<AdminRoleCreateInput>;
type RoleUpdateBody = Partial<AdminRoleUpdateInput>;

export function registerRoleRoutes(app: FastifyInstance): void {
  app.get("/admin/roles/reference-data", async (request, reply) => {
    if (!ensureAuthorizedAny(request, reply, [PERMISSIONS.ROLE_READ, PERMISSIONS.ROLE_CREATE, PERMISSIONS.ROLE_UPDATE])) {
      return;
    }

    const supabase = createServerClient();
    const [{ data: hotels, error: hotelsError }, { data: permissions, error: permissionsError }] = await Promise.all([
      supabase.from("hotels").select("id,name").order("name", { ascending: true }),
      supabase.from("permissions").select("id,name").order("name", { ascending: true })
    ]);

    if (hotelsError || permissionsError) {
      request.log.error(hotelsError || permissionsError);
      return reply.status(500).send({ message: "Falha ao consultar dados auxiliares de roles." });
    }

    return reply.send({
      hotels: (hotels || []).map((item: any) => ({ id: item.id, name: item.name })),
      permissions: (permissions || []).map((item: any) => ({ id: item.id, name: item.name }))
    });
  });

  app.get("/admin/roles", async (request, reply) => {
    if (!ensureAuthorized(request, reply, PERMISSIONS.ROLE_READ)) {
      return;
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("roles")
      .select("id,name,hotel_id,hotels(name),role_permissions(permission_id,permissions(id,name))")
      .order("name", { ascending: true });

    if (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Falha ao consultar roles." });
    }

    return reply.send({ items: (data || []).map(mapAdminRole) });
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

    const supabase = createServerClient();

    if (hotelId) {
      const { data: hotelExists, error: hotelError } = await supabase.from("hotels").select("id").eq("id", hotelId).single();

      if (hotelError || !hotelExists) {
        return reply.status(400).send({ message: "Hotel selecionado nao existe." });
      }
    }

    if (permissionIds.length) {
      const { data: permissionRows, error: permissionError } = await supabase.from("permissions").select("id").in("id", permissionIds);

      if (permissionError) {
        request.log.error(permissionError);
        return reply.status(500).send({ message: "Falha ao validar permissoes da role." });
      }

      if ((permissionRows || []).length !== permissionIds.length) {
        return reply.status(400).send({ message: "Uma ou mais permissoes selecionadas nao existem." });
      }
    }

    const { data: createdRole, error: createRoleError } = await supabase
      .from("roles")
      .insert({ name, hotel_id: hotelId })
      .select("id")
      .single();

    if (createRoleError) {
      request.log.error(createRoleError);

      if (createRoleError.code === "23505") {
        return reply.status(409).send({ message: "Nome de role ja existente." });
      }

      return reply.status(500).send({ message: "Falha ao criar role." });
    }

    if (permissionIds.length) {
      const { error: rolePermissionError } = await supabase
        .from("role_permissions")
        .insert(permissionIds.map((permissionId) => ({ role_id: createdRole.id, permission_id: permissionId })));

      if (rolePermissionError) {
        request.log.error(rolePermissionError);
        return reply.status(500).send({ message: "Role criada, mas falhou ao vincular permissoes." });
      }
    }

    const { data: roleWithRelations, error: roleWithRelationsError } = await supabase
      .from("roles")
      .select("id,name,hotel_id,hotels(name),role_permissions(permission_id,permissions(id,name))")
      .eq("id", createdRole.id)
      .single();

    if (roleWithRelationsError || !roleWithRelations) {
      request.log.error(roleWithRelationsError);
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

    const supabase = createServerClient();

    if (payload.hotel_id) {
      const { data: hotelExists, error: hotelError } = await supabase.from("hotels").select("id").eq("id", payload.hotel_id).single();

      if (hotelError || !hotelExists) {
        return reply.status(400).send({ message: "Hotel selecionado nao existe." });
      }
    }

    if (hasPermissionsPayload && permissionIds.length) {
      const { data: permissionRows, error: permissionError } = await supabase.from("permissions").select("id").in("id", permissionIds);

      if (permissionError) {
        request.log.error(permissionError);
        return reply.status(500).send({ message: "Falha ao validar permissoes da role." });
      }

      if ((permissionRows || []).length !== permissionIds.length) {
        return reply.status(400).send({ message: "Uma ou mais permissoes selecionadas nao existem." });
      }
    }

    if (Object.keys(payload).length) {
      const { error: updateRoleError } = await supabase.from("roles").update(payload).eq("id", id);

      if (updateRoleError) {
        request.log.error(updateRoleError);

        if (updateRoleError.code === "23505") {
          return reply.status(409).send({ message: "Nome de role ja existente." });
        }

        if (updateRoleError.code === "PGRST116") {
          return reply.status(404).send({ message: "Role nao encontrada." });
        }

        return reply.status(500).send({ message: "Falha ao atualizar role." });
      }
    } else {
      const { data: roleExists, error: roleExistsError } = await supabase.from("roles").select("id").eq("id", id).single();

      if (roleExistsError || !roleExists) {
        return reply.status(404).send({ message: "Role nao encontrada." });
      }
    }

    if (hasPermissionsPayload) {
      const { error: deletePermissionsError } = await supabase.from("role_permissions").delete().eq("role_id", id);

      if (deletePermissionsError) {
        request.log.error(deletePermissionsError);
        return reply.status(500).send({ message: "Falha ao atualizar permissoes da role." });
      }

      if (permissionIds.length) {
        const { error: insertPermissionsError } = await supabase
          .from("role_permissions")
          .insert(permissionIds.map((permissionId) => ({ role_id: id, permission_id: permissionId })));

        if (insertPermissionsError) {
          request.log.error(insertPermissionsError);
          return reply.status(500).send({ message: "Falha ao atualizar permissoes da role." });
        }
      }
    }

    const { data: updatedRole, error: updatedRoleError } = await supabase
      .from("roles")
      .select("id,name,hotel_id,hotels(name),role_permissions(permission_id,permissions(id,name))")
      .eq("id", id)
      .single();

    if (updatedRoleError || !updatedRole) {
      request.log.error(updatedRoleError);
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

    const supabase = createServerClient();
    const { data, error } = await supabase.from("roles").delete().eq("id", id).select("id");

    if (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Falha ao excluir role." });
    }

    if (!data || !data.length) {
      return reply.status(404).send({ message: "Role nao encontrada." });
    }

    return reply.send({ ok: true });
  });
}
