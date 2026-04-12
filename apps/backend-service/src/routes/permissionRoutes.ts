import type { FastifyInstance } from "fastify";
import {
  PERMISSIONS,
  createServerClient,
  type AdminPermissionCreateInput,
  type AdminPermissionUpdateInput,
  type HotelIdParams
} from "@hotel/shared";
import { ensureAuthorized } from "../auth/authorization";
import { normalizeOptionalText } from "../common/text";

type PermissionCreateBody = Partial<AdminPermissionCreateInput>;
type PermissionUpdateBody = Partial<AdminPermissionUpdateInput>;

export function registerPermissionRoutes(app: FastifyInstance): void {
  app.get("/admin/permissions", async (request, reply) => {
    if (!ensureAuthorized(request, reply, PERMISSIONS.PERMISSION_READ)) {
      return;
    }

    const supabase = createServerClient();
    const { data, error } = await supabase.from("permissions").select("id,name").order("name", { ascending: true });

    if (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Falha ao consultar permissoes." });
    }

    return reply.send({ items: data ?? [] });
  });

  app.post<{ Body: PermissionCreateBody }>("/admin/permissions", async (request, reply) => {
    if (!ensureAuthorized(request, reply, PERMISSIONS.PERMISSION_CREATE)) {
      return;
    }

    const name = normalizeOptionalText(request.body?.name);

    if (!name) {
      return reply.status(400).send({ message: "Nome da permissao e obrigatorio." });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase.from("permissions").insert({ name }).select("id,name").single();

    if (error) {
      request.log.error(error);

      if (error.code === "23505") {
        return reply.status(409).send({ message: "Nome de permissao ja existente." });
      }

      return reply.status(500).send({ message: "Falha ao criar permissao." });
    }

    return reply.status(201).send({ item: data });
  });

  app.put<{ Params: HotelIdParams; Body: PermissionUpdateBody }>("/admin/permissions/:id", async (request, reply) => {
    if (!ensureAuthorized(request, reply, PERMISSIONS.PERMISSION_UPDATE)) {
      return;
    }

    const id = request.params.id;
    const name = normalizeOptionalText(request.body?.name);

    if (!id) {
      return reply.status(400).send({ message: "Id da permissao e obrigatorio para atualizacao." });
    }

    if (!name) {
      return reply.status(400).send({ message: "Nome da permissao e obrigatorio para atualizacao." });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase.from("permissions").update({ name }).eq("id", id).select("id,name").single();

    if (error) {
      request.log.error(error);

      if (error.code === "PGRST116") {
        return reply.status(404).send({ message: "Permissao nao encontrada." });
      }

      if (error.code === "23505") {
        return reply.status(409).send({ message: "Nome de permissao ja existente." });
      }

      return reply.status(500).send({ message: "Falha ao atualizar permissao." });
    }

    return reply.send({ item: data });
  });

  app.delete<{ Params: HotelIdParams }>("/admin/permissions/:id", async (request, reply) => {
    if (!ensureAuthorized(request, reply, PERMISSIONS.PERMISSION_DELETE)) {
      return;
    }

    const id = request.params.id;

    if (!id) {
      return reply.status(400).send({ message: "Id da permissao e obrigatorio para exclusao." });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase.from("permissions").delete().eq("id", id).select("id");

    if (error) {
      request.log.error(error);
      return reply.status(500).send({ message: "Falha ao excluir permissao." });
    }

    if (!data || !data.length) {
      return reply.status(404).send({ message: "Permissao nao encontrada." });
    }

    return reply.send({ ok: true });
  });
}
