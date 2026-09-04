import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  ADMIN_ERROR_CODE,
  PERMISSIONS,
  type AdminCommercialAgreementCreateInput,
  type AdminCommercialAgreementRevisionInput,
  type AdminCommercialPartnerContactInput,
  type AdminCommercialPartnerInput,
  type HotelIdParams,
  type PermissionName,
} from "@hotel/shared";
import { ensureAuthorizedWithScope } from "../auth/authorization";
import { adminError } from "../common/adminError";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import { normalizeOptionalText } from "../common/text";
import {
  createCommercialPartnersRepository,
  type CommercialPartnersRepository,
  type CommercialWriteResult,
} from "../repositories/commercialPartnersRepository";

type ListQuery = { include_archived?: boolean | string };
type EligibilityQuery = { product_id?: string; point_id?: string };
type AuthContext = { hotelId: string; actorId: string };

function sendError(reply: FastifyReply, status: number, message: string) {
  return reply
    .status(status)
    .send(
      adminError(
        status === 404
          ? ADMIN_ERROR_CODE.NOT_FOUND
          : status === 409
            ? ADMIN_ERROR_CODE.CONFLICT
            : ADMIN_ERROR_CODE.VALIDATION,
        message,
      ),
    );
}

function scope(
  request: FastifyRequest,
  reply: FastifyReply,
  permission: PermissionName,
): AuthContext | null {
  const auth = ensureAuthorizedWithScope(request, reply, permission);
  if (!auth) return null;
  const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
  return hotelId ? { hotelId, actorId: auth.session.id } : null;
}

function handleResult(
  reply: FastifyReply,
  result: CommercialWriteResult,
  item: unknown,
  created = false,
) {
  if (result === "not-found")
    return sendError(reply, 404, "Registro não encontrado no hotel ativo.");
  if (result === "overlap")
    return sendError(
      reply,
      409,
      "A vigência se sobrepõe a outro acordo do parceiro no mesmo ponto.",
    );
  if (result === "conflict")
    return sendError(
      reply,
      409,
      "Os dados conflitam com a configuração comercial existente.",
    );
  return reply.status(created ? 201 : 200).send({ item });
}

function validTerms(input: AdminCommercialAgreementRevisionInput): boolean {
  if (!input.point_ids?.length || !input.starts_on) return false;
  if (input.ends_on && input.ends_on < input.starts_on) return false;
  if (input.commercial_model === "fixed_rent")
    return (
      input.fixed_rent != null &&
      Boolean(input.rent_frequency) &&
      input.commission_percentage == null &&
      input.minimum_guarantee == null
    );
  if (input.commercial_model === "revenue_share")
    return (
      input.commission_percentage != null &&
      input.fixed_rent == null &&
      input.rent_frequency == null &&
      input.minimum_guarantee == null
    );
  return (
    input.commercial_model === "hybrid" &&
    input.fixed_rent != null &&
    Boolean(input.rent_frequency) &&
    input.commission_percentage != null
  );
}

export function registerCommercialPartnerRoutes(
  app: FastifyInstance,
  repository: CommercialPartnersRepository = createCommercialPartnersRepository(),
): void {
  app.get<{ Querystring: ListQuery }>(
    "/admin/commercial-partners",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.COMMERCIAL_PARTNERS_READ,
      );
      if (!context) return;
      return reply.send({
        items: await repository.listPartners(
          context.hotelId,
          request.query.include_archived === true ||
            request.query.include_archived === "true",
        ),
      });
    },
  );

  app.post<{ Body: AdminCommercialPartnerInput }>(
    "/admin/commercial-partners",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.COMMERCIAL_PARTNERS_MANAGE,
      );
      if (!context) return;
      const tradeName = normalizeOptionalText(request.body.trade_name);
      const legalName = normalizeOptionalText(request.body.legal_name);
      if (!tradeName || !legalName)
        return sendError(reply, 400, "Dados do parceiro inválidos.");
      const result = await repository.createPartner(
        context.hotelId,
        context.actorId,
        { ...request.body, trade_name: tradeName, legal_name: legalName },
      );
      return handleResult(reply, result.result, result.item, true);
    },
  );

  app.put<{
    Params: HotelIdParams;
    Body: Partial<AdminCommercialPartnerInput>;
  }>("/admin/commercial-partners/:id", async (request, reply) => {
    const context = scope(
      request,
      reply,
      PERMISSIONS.COMMERCIAL_PARTNERS_MANAGE,
    );
    if (!context) return;
    const id = normalizeOptionalText(request.params.id);
    if (!id || !Object.keys(request.body || {}).length)
      return sendError(reply, 400, "Dados do parceiro inválidos.");
    const result = await repository.updatePartner(
      id,
      context.hotelId,
      context.actorId,
      request.body,
    );
    return handleResult(reply, result.result, result.item);
  });

  for (const [action, archived] of [
    ["archive", true],
    ["restore", false],
  ] as const) {
    app.post<{ Params: HotelIdParams }>(
      `/admin/commercial-partners/:id/${action}`,
      async (request, reply) => {
        const context = scope(
          request,
          reply,
          PERMISSIONS.COMMERCIAL_PARTNERS_MANAGE,
        );
        if (!context) return;
        const id = normalizeOptionalText(request.params.id);
        if (!id) return sendError(reply, 400, "Identificador inválido.");
        const result = await repository.updatePartner(
          id,
          context.hotelId,
          context.actorId,
          { archived_at: archived ? new Date().toISOString() : null },
        );
        return handleResult(reply, result.result, result.item);
      },
    );
  }

  app.post<{ Params: HotelIdParams; Body: AdminCommercialPartnerContactInput }>(
    "/admin/commercial-partners/:id/contacts",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.COMMERCIAL_PARTNERS_MANAGE,
      );
      if (!context) return;
      const partnerId = normalizeOptionalText(request.params.id);
      if (
        !partnerId ||
        !normalizeOptionalText(request.body.name) ||
        (!normalizeOptionalText(request.body.email) &&
          !normalizeOptionalText(request.body.phone))
      )
        return sendError(
          reply,
          400,
          "Informe nome e ao menos um canal de contato.",
        );
      const result = await repository.createContact(
        partnerId,
        context.hotelId,
        context.actorId,
        request.body,
      );
      return handleResult(reply, result.result, result.item, true);
    },
  );

  app.put<{
    Params: HotelIdParams;
    Body: Partial<AdminCommercialPartnerContactInput>;
  }>("/admin/commercial-partner-contacts/:id", async (request, reply) => {
    const context = scope(
      request,
      reply,
      PERMISSIONS.COMMERCIAL_PARTNERS_MANAGE,
    );
    if (!context) return;
    const id = normalizeOptionalText(request.params.id);
    if (!id || !Object.keys(request.body || {}).length)
      return sendError(reply, 400, "Dados do contato inválidos.");
    const result = await repository.updateContact(
      id,
      context.hotelId,
      context.actorId,
      request.body,
    );
    return handleResult(reply, result.result, result.item);
  });

  for (const [action, archived] of [
    ["archive", true],
    ["restore", false],
  ] as const) {
    app.post<{ Params: HotelIdParams }>(
      `/admin/commercial-partner-contacts/:id/${action}`,
      async (request, reply) => {
        const context = scope(
          request,
          reply,
          PERMISSIONS.COMMERCIAL_PARTNERS_MANAGE,
        );
        if (!context) return;
        const id = normalizeOptionalText(request.params.id);
        if (!id) return sendError(reply, 400, "Identificador inválido.");
        const result = await repository.updateContact(
          id,
          context.hotelId,
          context.actorId,
          { archived_at: archived ? new Date().toISOString() : null },
        );
        return handleResult(reply, result.result, result.item);
      },
    );
  }

  app.get<{ Params: HotelIdParams }>(
    "/admin/commercial-partners/:id/history",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.COMMERCIAL_PARTNERS_READ,
      );
      if (!context) return;
      return reply.send({
        items: await repository.listHistory(context.hotelId, request.params.id),
      });
    },
  );

  app.get<{ Querystring: ListQuery }>(
    "/admin/commercial-agreements",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.COMMERCIAL_PARTNERS_READ,
      );
      if (!context) return;
      return reply.send({
        items: await repository.listAgreements(
          context.hotelId,
          request.query.include_archived === true ||
            request.query.include_archived === "true",
        ),
      });
    },
  );

  for (const [action, archived] of [
    ["archive", true],
    ["restore", false],
  ] as const) {
    app.post<{ Params: HotelIdParams }>(
      `/admin/commercial-agreements/:id/${action}`,
      async (request, reply) => {
        const context = scope(
          request,
          reply,
          PERMISSIONS.COMMERCIAL_AGREEMENTS_MANAGE,
        );
        if (!context) return;
        const id = normalizeOptionalText(request.params.id);
        if (!id) return sendError(reply, 400, "Identificador inválido.");
        const result = await repository.setAgreementArchived(
          id,
          context.hotelId,
          context.actorId,
          archived,
        );
        return handleResult(reply, result.result, result.item);
      },
    );
  }

  app.post<{ Body: AdminCommercialAgreementCreateInput }>(
    "/admin/commercial-agreements",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.COMMERCIAL_AGREEMENTS_MANAGE,
      );
      if (!context) return;
      if (!validTerms(request.body.revision))
        return sendError(
          reply,
          400,
          "Termos comerciais inválidos ou incompletos.",
        );
      const result = await repository.createAgreement(
        context.hotelId,
        context.actorId,
        request.body,
      );
      return handleResult(reply, result.result, result.item, true);
    },
  );

  app.get<{ Querystring: EligibilityQuery }>(
    "/admin/commercial-agreement-eligibility",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.COMMERCIAL_PARTNERS_READ,
      );
      if (!context) return;
      const productId = normalizeOptionalText(request.query.product_id);
      const pointId = normalizeOptionalText(request.query.point_id);
      if (!productId || !pointId)
        return sendError(reply, 400, "Produto e ponto são obrigatórios.");
      return reply.send({
        items: await repository.listEligibility(
          context.hotelId,
          productId,
          pointId,
        ),
      });
    },
  );

  app.get<{ Params: HotelIdParams }>(
    "/admin/commercial-agreements/:id",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.COMMERCIAL_PARTNERS_READ,
      );
      if (!context) return;
      const item = await repository.getAgreement(
        request.params.id,
        context.hotelId,
      );
      return item
        ? reply.send({ item })
        : sendError(reply, 404, "Acordo não encontrado no hotel ativo.");
    },
  );

  app.post<{
    Params: HotelIdParams;
    Body: AdminCommercialAgreementRevisionInput;
  }>("/admin/commercial-agreements/:id/revisions", async (request, reply) => {
    const context = scope(
      request,
      reply,
      PERMISSIONS.COMMERCIAL_AGREEMENTS_MANAGE,
    );
    if (!context) return;
    if (!validTerms(request.body))
      return sendError(
        reply,
        400,
        "Termos comerciais inválidos ou incompletos.",
      );
    const result = await repository.createRevision(
      request.params.id,
      context.hotelId,
      context.actorId,
      request.body,
    );
    return handleResult(reply, result.result, result.item, true);
  });

  app.put<{
    Params: HotelIdParams;
    Body: Partial<AdminCommercialAgreementRevisionInput>;
  }>("/admin/commercial-agreement-revisions/:id", async (request, reply) => {
    const context = scope(
      request,
      reply,
      PERMISSIONS.COMMERCIAL_AGREEMENTS_MANAGE,
    );
    if (!context) return;
    const result = await repository.updateRevision(
      request.params.id,
      context.hotelId,
      context.actorId,
      request.body,
    );
    return handleResult(reply, result.result, result.item);
  });

  app.put<{ Params: HotelIdParams; Body: { point_ids: string[] } }>(
    "/admin/commercial-agreement-revisions/:id/points",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.COMMERCIAL_AGREEMENTS_MANAGE,
      );
      if (!context) return;
      const result = await repository.setRevisionPoints(
        request.params.id,
        context.hotelId,
        context.actorId,
        request.body.point_ids,
      );
      return handleResult(reply, result.result, result.item);
    },
  );

  app.post<{ Params: HotelIdParams }>(
    "/admin/commercial-agreement-revisions/:id/activate",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.COMMERCIAL_AGREEMENTS_MANAGE,
      );
      if (!context) return;
      const result = await repository.activateRevision(
        request.params.id,
        context.hotelId,
        context.actorId,
      );
      return handleResult(reply, result.result, result.item);
    },
  );

  app.post<{ Params: HotelIdParams; Body: { ends_on: string } }>(
    "/admin/commercial-agreement-revisions/:id/terminate",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.COMMERCIAL_AGREEMENTS_MANAGE,
      );
      if (!context) return;
      const result = await repository.terminateRevision(
        request.params.id,
        context.hotelId,
        context.actorId,
        request.body.ends_on,
      );
      return handleResult(reply, result.result, result.item);
    },
  );

  app.get<{ Params: HotelIdParams }>(
    "/admin/commercial-agreements/:id/history",
    async (request, reply) => {
      const context = scope(
        request,
        reply,
        PERMISSIONS.COMMERCIAL_PARTNERS_READ,
      );
      if (!context) return;
      return reply.send({
        items: await repository.listHistory(
          context.hotelId,
          request.params.id,
          true,
        ),
      });
    },
  );
}
