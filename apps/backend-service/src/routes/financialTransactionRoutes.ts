import type { FastifyInstance } from "fastify";
import {
  ADMIN_ERROR_CODE,
  PERMISSIONS,
  type AdminFinancialTransactionCreateInput,
  type AdminFinancialTransactionUpdateInput,
  type TransactionStatus,
  type TransactionType,
  type HotelIdParams,
  type TablesUpdate,
} from "@hotel/shared";
import { ensureAuthorizedWithScope } from "../auth/authorization";
import { adminError } from "../common/adminError";
import { normalizeOptionalText } from "../common/text";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import {
  createFinancialTransactionsRepository,
  type FinancialTransactionsRepository,
} from "../repositories/financialTransactionsRepository";

type FinancialTransactionCreateBody =
  Partial<AdminFinancialTransactionCreateInput>;
type FinancialTransactionUpdateBody =
  Partial<AdminFinancialTransactionUpdateInput>;

const TRANSACTION_TYPES: TransactionType[] = ["INCOME", "EXPENSE", "REFUND"];
const TRANSACTION_STATUSES: TransactionStatus[] = [
  "PENDING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
];
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

function isTransactionType(value: string | null): value is TransactionType {
  return !!value && TRANSACTION_TYPES.includes(value as TransactionType);
}

function isTransactionStatus(value: string | null): value is TransactionStatus {
  return !!value && TRANSACTION_STATUSES.includes(value as TransactionStatus);
}

function normalizeCurrency(value: string | null | undefined): string | null {
  const currency = (normalizeOptionalText(value) || "BRL").toUpperCase();
  return CURRENCY_PATTERN.test(currency) ? currency : null;
}

function normalizeOptionalUuid(
  value: string | null | undefined,
): string | null | undefined {
  const text = normalizeOptionalText(value);
  if (!text) return null;
  return UUID_PATTERN.test(text) ? text : undefined;
}

function normalizeOptionalDateOnly(
  value: string | null | undefined,
): string | null | undefined {
  const text = normalizeOptionalText(value);
  if (!text) return null;

  if (!DATE_ONLY_PATTERN.test(text)) {
    return undefined;
  }

  const date = new Date(`${text}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== text
  ) {
    return undefined;
  }

  return text;
}

function normalizeOptionalDateTime(
  value: string | null | undefined,
): string | null | undefined {
  const text = normalizeOptionalText(value);
  if (!text) return null;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

function shouldStampPaidAt(status: TransactionStatus): boolean {
  return status === "COMPLETED" || status === "REFUNDED";
}

export function registerFinancialTransactionRoutes(
  app: FastifyInstance,
  repository: FinancialTransactionsRepository = createFinancialTransactionsRepository(),
): void {
  app.get("/admin/financial-transactions", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(
      request,
      reply,
      PERMISSIONS.TRANSACTION_READ,
    );
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const data = await repository
      .listFinancialTransactions(activeHotelId)
      .catch((error) => {
        request.log.error(error);
        return null;
      });

    if (!data)
      return reply
        .status(500)
        .send(
          adminError(
            ADMIN_ERROR_CODE.INTERNAL,
            "Falha ao consultar transacoes.",
          ),
        );

    return reply.send({ items: data });
  });

  app.post<{ Body: FinancialTransactionCreateBody }>(
    "/admin/financial-transactions",
    async (request, reply) => {
      const auth = ensureAuthorizedWithScope(
        request,
        reply,
        PERMISSIONS.TRANSACTION_CREATE,
      );
      if (!auth) return;

      const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
      if (!activeHotelId) return;

      const type = normalizeOptionalText(
        request.body?.type,
      ) as TransactionType | null;
      const category = normalizeOptionalText(request.body?.category);
      const amount = Number(request.body?.amount);
      const currency = normalizeCurrency(request.body?.currency);
      const description = normalizeOptionalText(request.body?.description);
      const status = normalizeOptionalText(
        request.body?.status,
      ) as TransactionStatus | null;
      const paymentMethod = normalizeOptionalText(request.body?.payment_method);
      const paidAt = normalizeOptionalDateTime(request.body?.paid_at);
      const dueDate = normalizeOptionalDateOnly(request.body?.due_date);
      const counterparty = normalizeOptionalText(request.body?.counterparty);
      const costCenter = normalizeOptionalText(request.body?.cost_center);
      const referenceCode = normalizeOptionalText(request.body?.reference_code);
      const stayId = normalizeOptionalUuid(request.body?.stay_id);
      const reservationId = normalizeOptionalUuid(request.body?.reservation_id);

      if (
        !isTransactionType(type) ||
        !category ||
        !Number.isFinite(amount) ||
        amount < 0 ||
        !currency
      ) {
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Dados invalidos para criar transacao.",
            ),
          );
      }

      if (status && !isTransactionStatus(status)) {
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Status de transacao invalido.",
            ),
          );
      }

      if (
        paidAt === undefined ||
        dueDate === undefined ||
        stayId === undefined ||
        reservationId === undefined
      ) {
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Datas ou vinculos da transacao invalidos.",
            ),
          );
      }

      const resolvedStatus = status || "COMPLETED";

      const createResult = await repository
        .createFinancialTransaction(activeHotelId, {
          type,
          category,
          amount,
          currency,
          description,
          status: resolvedStatus,
          payment_method: paymentMethod,
          paid_at: shouldStampPaidAt(resolvedStatus)
            ? paidAt || new Date().toISOString()
            : null,
          due_date: dueDate,
          counterparty,
          cost_center: costCenter,
          reference_code: referenceCode,
          stay_id: stayId,
          reservation_id: reservationId,
          created_by: auth.session.id,
        })
        .catch((error) => {
          request.log.error(error);
          return null;
        });

      if (!createResult)
        return reply
          .status(500)
          .send(
            adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao criar transacao."),
          );
      if (createResult.result === "conflict")
        return reply
          .status(409)
          .send(
            adminError(
              ADMIN_ERROR_CODE.CONFLICT,
              "Conflito ao criar transacao.",
            ),
          );
      if (!createResult.item)
        return reply
          .status(500)
          .send(
            adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao criar transacao."),
          );

      return reply.status(201).send({ item: createResult.item });
    },
  );

  app.put<{ Params: HotelIdParams; Body: FinancialTransactionUpdateBody }>(
    "/admin/financial-transactions/:id",
    async (request, reply) => {
      const auth = ensureAuthorizedWithScope(
        request,
        reply,
        PERMISSIONS.TRANSACTION_UPDATE,
      );
      if (!auth) return;

      const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
      if (!activeHotelId) return;

      const id = normalizeOptionalText(request.params.id);
      if (!id)
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Id da transacao e obrigatorio para atualizacao.",
            ),
          );

      const payload: TablesUpdate<"financial_transactions"> = {};

      if (request.body?.type !== undefined) {
        const type = normalizeOptionalText(
          request.body.type,
        ) as TransactionType | null;
        if (!isTransactionType(type)) {
          return reply
            .status(400)
            .send(
              adminError(
                ADMIN_ERROR_CODE.VALIDATION,
                "Tipo de transacao invalido.",
              ),
            );
        }
        payload.type = type;
      }

      if (request.body?.category !== undefined) {
        const category = normalizeOptionalText(request.body.category);
        if (!category) {
          return reply
            .status(400)
            .send(
              adminError(
                ADMIN_ERROR_CODE.VALIDATION,
                "Categoria da transacao e obrigatoria.",
              ),
            );
        }
        payload.category = category;
      }

      if (request.body?.amount !== undefined) {
        const amount = Number(request.body.amount);
        if (!Number.isFinite(amount) || amount < 0) {
          return reply
            .status(400)
            .send(
              adminError(
                ADMIN_ERROR_CODE.VALIDATION,
                "Valor da transacao invalido.",
              ),
            );
        }
        payload.amount = amount;
      }

      if (request.body?.currency !== undefined) {
        const currency = normalizeCurrency(request.body.currency);
        if (!currency) {
          return reply
            .status(400)
            .send(
              adminError(
                ADMIN_ERROR_CODE.VALIDATION,
                "Moeda da transacao e obrigatoria.",
              ),
            );
        }
        payload.currency = currency;
      }

      if (request.body?.description !== undefined) {
        payload.description = normalizeOptionalText(request.body.description);
      }

      if (request.body?.status !== undefined) {
        const status = normalizeOptionalText(
          request.body.status,
        ) as TransactionStatus | null;
        if (!isTransactionStatus(status)) {
          return reply
            .status(400)
            .send(
              adminError(
                ADMIN_ERROR_CODE.VALIDATION,
                "Status de transacao invalido.",
              ),
            );
        }
        payload.status = status;
      }

      if (request.body?.payment_method !== undefined) {
        payload.payment_method = normalizeOptionalText(
          request.body.payment_method,
        );
      }

      if (request.body?.paid_at !== undefined) {
        const paidAt = normalizeOptionalDateTime(request.body.paid_at);
        if (paidAt === undefined) {
          return reply
            .status(400)
            .send(
              adminError(
                ADMIN_ERROR_CODE.VALIDATION,
                "Data de pagamento invalida.",
              ),
            );
        }
        payload.paid_at = paidAt;
      }

      if (request.body?.due_date !== undefined) {
        const dueDate = normalizeOptionalDateOnly(request.body.due_date);
        if (dueDate === undefined) {
          return reply
            .status(400)
            .send(
              adminError(
                ADMIN_ERROR_CODE.VALIDATION,
                "Data de vencimento invalida.",
              ),
            );
        }
        payload.due_date = dueDate;
      }

      if (request.body?.counterparty !== undefined) {
        payload.counterparty = normalizeOptionalText(request.body.counterparty);
      }

      if (request.body?.cost_center !== undefined) {
        payload.cost_center = normalizeOptionalText(request.body.cost_center);
      }

      if (request.body?.reference_code !== undefined) {
        payload.reference_code = normalizeOptionalText(
          request.body.reference_code,
        );
      }

      if (request.body?.stay_id !== undefined) {
        const stayId = normalizeOptionalUuid(request.body.stay_id);
        if (stayId === undefined) {
          return reply
            .status(400)
            .send(
              adminError(
                ADMIN_ERROR_CODE.VALIDATION,
                "Id da estadia invalido.",
              ),
            );
        }
        payload.stay_id = stayId;
      }

      if (request.body?.reservation_id !== undefined) {
        const reservationId = normalizeOptionalUuid(
          request.body.reservation_id,
        );
        if (reservationId === undefined) {
          return reply
            .status(400)
            .send(
              adminError(
                ADMIN_ERROR_CODE.VALIDATION,
                "Id da reserva invalido.",
              ),
            );
        }
        payload.reservation_id = reservationId;
      }

      if (payload.status) {
        const nextStatus = payload.status as TransactionStatus;
        payload.paid_at = shouldStampPaidAt(nextStatus)
          ? payload.paid_at || new Date().toISOString()
          : null;
      }

      if (!Object.keys(payload).length) {
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Nenhum campo informado para atualizacao.",
            ),
          );
      }

      const updateResult = await repository
        .updateFinancialTransaction(id, activeHotelId, payload)
        .catch((error) => {
          request.log.error(error);
          return null;
        });

      if (!updateResult)
        return reply
          .status(500)
          .send(
            adminError(
              ADMIN_ERROR_CODE.INTERNAL,
              "Falha ao atualizar transacao.",
            ),
          );
      if (updateResult.result === "not-found")
        return reply
          .status(404)
          .send(
            adminError(
              ADMIN_ERROR_CODE.NOT_FOUND,
              "Transacao nao encontrada neste hotel.",
            ),
          );
      if (updateResult.result === "conflict")
        return reply
          .status(409)
          .send(
            adminError(
              ADMIN_ERROR_CODE.CONFLICT,
              "Conflito de dados ao atualizar transacao.",
            ),
          );

      return reply.send({ item: updateResult.item });
    },
  );

  app.delete<{ Params: HotelIdParams }>(
    "/admin/financial-transactions/:id",
    async (request, reply) => {
      const auth = ensureAuthorizedWithScope(
        request,
        reply,
        PERMISSIONS.TRANSACTION_DELETE,
      );
      if (!auth) return;

      const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
      if (!activeHotelId) return;

      const id = normalizeOptionalText(request.params.id);
      if (!id)
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Id da transacao e obrigatorio para exclusao.",
            ),
          );

      const result = await repository
        .deleteFinancialTransaction(id, activeHotelId)
        .catch((error) => {
          request.log.error(error);
          return null;
        });

      if (!result)
        return reply
          .status(500)
          .send(
            adminError(
              ADMIN_ERROR_CODE.INTERNAL,
              "Falha ao excluir transacao.",
            ),
          );
      if (result === "not-found")
        return reply
          .status(404)
          .send(
            adminError(
              ADMIN_ERROR_CODE.NOT_FOUND,
              "Transacao nao encontrada neste hotel.",
            ),
          );
      if (result === "conflict")
        return reply
          .status(409)
          .send(
            adminError(
              ADMIN_ERROR_CODE.CONFLICT,
              "Transacao nao pode ser excluida: possui dependencias ativas.",
            ),
          );

      return reply.send({ ok: true });
    },
  );
}
