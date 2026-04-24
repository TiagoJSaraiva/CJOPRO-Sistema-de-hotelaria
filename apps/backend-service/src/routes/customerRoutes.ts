import type { FastifyInstance } from "fastify";
import { ADMIN_ERROR_CODE, PERMISSIONS, type AdminCustomerCreateInput, type AdminCustomerUpdateInput, type HotelIdParams } from "@hotel/shared";
import { ensureAuthorizedWithScope } from "../auth/authorization";
import { adminError } from "../common/adminError";
import { normalizeOptionalText } from "../common/text";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import { createCustomersRepository, type CustomersRepository } from "../repositories/customersRepository";

type CustomerCreateBody = Partial<AdminCustomerCreateInput>;
type CustomerUpdateBody = Partial<AdminCustomerUpdateInput>;

export function registerCustomerRoutes(app: FastifyInstance, repository: CustomersRepository = createCustomersRepository()): void {
  app.get("/admin/customers", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.CUSTOMER_READ);
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const data = await repository.listCustomers(activeHotelId).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!data) return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao consultar clientes."));

    return reply.send({ items: data });
  });

  app.post<{ Body: CustomerCreateBody }>("/admin/customers", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.CUSTOMER_CREATE);
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const fullName = normalizeOptionalText(request.body?.full_name);
    const documentNumber = normalizeOptionalText(request.body?.document_number);
    const documentType = normalizeOptionalText(request.body?.document_type);
    const birthDate = normalizeOptionalText(request.body?.birth_date);

    if (!fullName || !documentNumber || !documentType || !birthDate) {
      return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Nome, documento, tipo de documento e data de nascimento sao obrigatorios."));
    }

    const createResult = await repository
      .createCustomer(activeHotelId, {
        full_name: fullName,
        document_number: documentNumber,
        document_type: documentType,
        birth_date: birthDate,
        email: normalizeOptionalText(request.body?.email),
        mobile_phone: normalizeOptionalText(request.body?.mobile_phone),
        phone: normalizeOptionalText(request.body?.phone),
        nationality: normalizeOptionalText(request.body?.nationality),
        notes: normalizeOptionalText(request.body?.notes)
      })
      .catch((error) => {
        request.log.error(error);
        return null;
      });

    if (!createResult) return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao criar cliente."));
    if (createResult.result === "conflict") return reply.status(409).send(adminError(ADMIN_ERROR_CODE.CONFLICT, "Cliente ja cadastrado com esse documento."));
    if (!createResult.item) return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao criar cliente."));

    return reply.status(201).send({ item: createResult.item });
  });

  app.put<{ Params: HotelIdParams; Body: CustomerUpdateBody }>("/admin/customers/:id", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.CUSTOMER_UPDATE);
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const id = normalizeOptionalText(request.params.id);
    if (!id) return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Id do cliente e obrigatorio para atualizacao."));

    const payload: Record<string, unknown> = {};
    if (request.body?.full_name !== undefined) payload.full_name = normalizeOptionalText(request.body.full_name);
    if (request.body?.document_number !== undefined) payload.document_number = normalizeOptionalText(request.body.document_number);
    if (request.body?.document_type !== undefined) payload.document_type = normalizeOptionalText(request.body.document_type);
    if (request.body?.email !== undefined) payload.email = normalizeOptionalText(request.body.email);
    if (request.body?.mobile_phone !== undefined) payload.mobile_phone = normalizeOptionalText(request.body.mobile_phone);
    if (request.body?.phone !== undefined) payload.phone = normalizeOptionalText(request.body.phone);
    if (request.body?.birth_date !== undefined) payload.birth_date = normalizeOptionalText(request.body.birth_date);
    if (request.body?.nationality !== undefined) payload.nationality = normalizeOptionalText(request.body.nationality);
    if (request.body?.notes !== undefined) payload.notes = normalizeOptionalText(request.body.notes);

    if (!Object.keys(payload).length) return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Nenhum campo informado para atualizacao."));

    const updateResult = await repository.updateCustomer(id, activeHotelId, payload).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!updateResult) return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao atualizar cliente."));
    if (updateResult.result === "not-found") return reply.status(404).send(adminError(ADMIN_ERROR_CODE.NOT_FOUND, "Cliente nao encontrado neste hotel."));
    if (updateResult.result === "conflict") return reply.status(409).send(adminError(ADMIN_ERROR_CODE.CONFLICT, "Conflito de dados ao atualizar cliente."));

    return reply.send({ item: updateResult.item });
  });

  app.delete<{ Params: HotelIdParams }>("/admin/customers/:id", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.CUSTOMER_DELETE);
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const id = normalizeOptionalText(request.params.id);
    if (!id) return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Id do cliente e obrigatorio para exclusao."));

    const result = await repository.deleteCustomer(id, activeHotelId).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!result) return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao excluir cliente."));
    if (result === "not-found") return reply.status(404).send(adminError(ADMIN_ERROR_CODE.NOT_FOUND, "Cliente nao encontrado neste hotel."));
    if (result === "conflict") return reply.status(409).send(adminError(ADMIN_ERROR_CODE.CONFLICT, "Cliente nao pode ser excluido: possui dependencias ativas."));

    return reply.send({ ok: true });
  });
}
