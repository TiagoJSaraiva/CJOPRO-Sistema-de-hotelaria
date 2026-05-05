import type { FastifyInstance } from "fastify";
import {
  ADMIN_ERROR_CODE,
  PERMISSIONS,
  type AdminFinancialTransactionCreateInput,
  type AdminFinancialTransactionUpdateInput,
  type TransactionStatus,
  type TransactionType,
  type HotelIdParams
} from "@hotel/shared";
import { ensureAuthorizedWithScope } from "../auth/authorization";
import { adminError } from "../common/adminError";
import { normalizeOptionalText } from "../common/text";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import { createFinancialTransactionsRepository, type FinancialTransactionsRepository } from "../repositories/financialTransactionsRepository";

type FinancialTransactionCreateBody = Partial<AdminFinancialTransactionCreateInput>;
type FinancialTransactionUpdateBody = Partial<AdminFinancialTransactionUpdateInput>;

const TRANSACTION_TYPES: TransactionType[] = ["INCOME", "EXPENSE", "REFUND"];
const TRANSACTION_STATUSES: TransactionStatus[] = ["PENDING", "COMPLETED", "FAILED", "CANCELLED", "REFUNDED"];

function isTransactionType(value: string | null): value is TransactionType {
  return !!value && TRANSACTION_TYPES.includes(value as TransactionType);
}

function isTransactionStatus(value: string | null): value is TransactionStatus {
  return !!value && TRANSACTION_STATUSES.includes(value as TransactionStatus);
}

export function registerFinancialTransactionRoutes(
  app: FastifyInstance,
  repository: FinancialTransactionsRepository = createFinancialTransactionsRepository()
): void {
  app.get("/admin/financial-transactions", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.TRANSACTION_READ);
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const data = await repository.listFinancialTransactions(activeHotelId).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!data) return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao consultar transacoes."));

    return reply.send({ items: data });
  });

  app.post<{ Body: FinancialTransactionCreateBody }>("/admin/financial-transactions", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.TRANSACTION_CREATE);
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const type = normalizeOptionalText(request.body?.type) as TransactionType | null;
    const category = normalizeOptionalText(request.body?.category);
    const amount = Number(request.body?.amount);
    const currency = normalizeOptionalText(request.body?.currency) || "BRL";
    const description = normalizeOptionalText(request.body?.description);
    const status = normalizeOptionalText(request.body?.status) as TransactionStatus | null;

    if (!isTransactionType(type) || !category || !Number.isFinite(amount) || amount < 0) {
      return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Dados invalidos para criar transacao."));
    }

    if (status && !isTransactionStatus(status)) {
      return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Status de transacao invalido."));
    }

    const createResult = await repository
      .createFinancialTransaction(activeHotelId, {
        type,
        category,
        amount,
        currency,
        description,
        status: status || "COMPLETED"
      })
      .catch((error) => {
        request.log.error(error);
        return null;
      });

    if (!createResult) return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao criar transacao."));
    if (createResult.result === "conflict") return reply.status(409).send(adminError(ADMIN_ERROR_CODE.CONFLICT, "Conflito ao criar transacao."));
    if (!createResult.item) return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao criar transacao."));

    return reply.status(201).send({ item: createResult.item });
  });

  app.put<{ Params: HotelIdParams; Body: FinancialTransactionUpdateBody }>("/admin/financial-transactions/:id", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.TRANSACTION_UPDATE);
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const id = normalizeOptionalText(request.params.id);
    if (!id) return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Id da transacao e obrigatorio para atualizacao."));

    const payload: Record<string, unknown> = {};

    if (request.body?.type !== undefined) {
      const type = normalizeOptionalText(request.body.type) as TransactionType | null;
      if (!isTransactionType(type)) {
        return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Tipo de transacao invalido."));
      }
      payload.type = type;
    }

    if (request.body?.category !== undefined) {
      const category = normalizeOptionalText(request.body.category);
      if (!category) {
        return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Categoria da transacao e obrigatoria."));
      }
      payload.category = category;
    }

    if (request.body?.amount !== undefined) {
      const amount = Number(request.body.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Valor da transacao invalido."));
      }
      payload.amount = amount;
    }

    if (request.body?.currency !== undefined) {
      const currency = normalizeOptionalText(request.body.currency);
      if (!currency) {
        return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Moeda da transacao e obrigatoria."));
      }
      payload.currency = currency;
    }

    if (request.body?.description !== undefined) {
      payload.description = normalizeOptionalText(request.body.description);
    }

    if (request.body?.status !== undefined) {
      const status = normalizeOptionalText(request.body.status) as TransactionStatus | null;
      if (!isTransactionStatus(status)) {
        return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Status de transacao invalido."));
      }
      payload.status = status;
    }

    if (!Object.keys(payload).length) {
      return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Nenhum campo informado para atualizacao."));
    }

    const updateResult = await repository.updateFinancialTransaction(id, activeHotelId, payload).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!updateResult) return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao atualizar transacao."));
    if (updateResult.result === "not-found") return reply.status(404).send(adminError(ADMIN_ERROR_CODE.NOT_FOUND, "Transacao nao encontrada neste hotel."));
    if (updateResult.result === "conflict") return reply.status(409).send(adminError(ADMIN_ERROR_CODE.CONFLICT, "Conflito de dados ao atualizar transacao."));

    return reply.send({ item: updateResult.item });
  });

  app.delete<{ Params: HotelIdParams }>("/admin/financial-transactions/:id", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.TRANSACTION_DELETE);
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const id = normalizeOptionalText(request.params.id);
    if (!id) return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Id da transacao e obrigatorio para exclusao."));

    const result = await repository.deleteFinancialTransaction(id, activeHotelId).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!result) return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao excluir transacao."));
    if (result === "not-found") return reply.status(404).send(adminError(ADMIN_ERROR_CODE.NOT_FOUND, "Transacao nao encontrada neste hotel."));
    if (result === "conflict") return reply.status(409).send(adminError(ADMIN_ERROR_CODE.CONFLICT, "Transacao nao pode ser excluida: possui dependencias ativas."));

    return reply.send({ ok: true });
  });
}
