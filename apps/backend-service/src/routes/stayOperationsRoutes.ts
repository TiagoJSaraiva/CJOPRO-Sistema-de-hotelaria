import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import {
  ADMIN_ERROR_CODE,
  PERMISSIONS,
  type AdminStayOperationalPanelResponse,
  type AdminStayCheckoutInput,
  type AdminStayPayment,
  type AdminStayPaymentCreateInput,
  type AdminStayPaymentStatus,
  type HotelIdParams,
  type ReservationStatus,
} from "@hotel/shared";
import { ensureAuthorizedWithScope } from "../auth/authorization";
import { adminError } from "../common/adminError";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import { createServerClient } from "../common/supabaseServer";
import { normalizeOptionalText } from "../common/text";
import { createMaintenanceRepository } from "../repositories/maintenanceRepository";
import { createMaintenanceFinanceRepository } from "../repositories/maintenanceFinanceRepository";
import { createStayAccountsRepository } from "../repositories/stayAccountsRepository";

type StayWithRelationsRow = {
  id: string;
  reservation_id: string;
  room_id: string;
  stay_status: ReservationStatus | null;
  checkin_date_expected: string;
  checkout_date_expected: string;
  checkin_date_actual: string | null;
  checkout_date_actual: string | null;
  total_price_estimated: number | null;
  total_paid: number | null;
  account_version: number;
  reservations?: {
    id?: string;
    hotel_id?: string;
    reservation_code?: string | null;
    customers?: {
      full_name?: string | null;
    } | null;
  } | null;
  rooms?: {
    id?: string;
    hotel_id?: string;
    room_number?: string;
    room_type?: string;
    hotels?: {
      id?: string;
      timezone?: string | null;
      checkin_time_start?: string | null;
      checkin_time_limit?: string | null;
      checkout_time_start?: string | null;
      checkout_time_limit?: string | null;
    } | null;
  } | null;
};

type StayPaymentRow = {
  id: string;
  stay_id: string;
  amount: number;
  payment_method: string | null;
  description: string | null;
  paid_at: string;
  created_at: string;
  created_by: string | null;
  type: "INCOME" | "EXPENSE" | "REFUND";
  status: "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED" | "REFUNDED";
};

type CheckoutCandidateQuery = {
  room_number?: string;
};

type StayCheckoutBody = Partial<AdminStayCheckoutInput>;

function toIsoDate(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour * 60 + minute;
}

function getNowInTimezone(timezone: string): { date: string; minutes: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value || "1970";
  const month = parts.find((part) => part.type === "month")?.value || "01";
  const day = parts.find((part) => part.type === "day")?.value || "01";
  const hour = Number(parts.find((part) => part.type === "hour")?.value || "0");
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value || "0",
  );

  return {
    date: `${year}-${month}-${day}`,
    minutes: hour * 60 + minute,
  };
}

function isWithinWindow(
  minutesNow: number,
  start: number,
  end: number,
): boolean {
  if (start <= end) {
    return minutesNow >= start && minutesNow <= end;
  }
  return minutesNow >= start || minutesNow <= end;
}

function derivePaymentStatus(
  totalPaid: number,
  totalDue: number,
): AdminStayPaymentStatus {
  if (totalDue <= 0) return "paid";
  if (totalPaid <= 0) return "pending";
  if (totalPaid >= totalDue) return "paid";
  return "partial";
}

async function loadStayWithRelations(
  stayId: string,
): Promise<StayWithRelationsRow | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("stays")
    .select(
      "id,reservation_id,room_id,stay_status,account_version,checkin_date_expected,checkout_date_expected,checkin_date_actual,checkout_date_actual,total_price_estimated,total_paid,reservations:reservation_id(id,hotel_id,reservation_code,customers:booking_customer_id(full_name)),rooms:room_id(id,hotel_id,room_number,room_type,hotels:hotel_id(id,timezone,checkin_time_start,checkin_time_limit,checkout_time_start,checkout_time_limit))",
    )
    .eq("id", stayId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as StayWithRelationsRow;
}

async function loadStayPanel(
  activeHotelId: string,
  stayId: string,
  includeMaintenanceFinance = false,
): Promise<AdminStayOperationalPanelResponse | null> {
  const stay = await loadStayWithRelations(stayId);
  if (!stay) {
    return null;
  }

  const roomHotelId = String(stay.rooms?.hotel_id || "");
  const reservationHotelId = String(stay.reservations?.hotel_id || "");
  if (roomHotelId !== activeHotelId || reservationHotelId !== activeHotelId) {
    return null;
  }

  const timezone = stay.rooms?.hotels?.timezone || "UTC";
  const checkinStart = stay.rooms?.hotels?.checkin_time_start || null;
  const checkinLimit = stay.rooms?.hotels?.checkin_time_limit || null;
  const checkoutStart = stay.rooms?.hotels?.checkout_time_start || null;
  const checkoutLimit = stay.rooms?.hotels?.checkout_time_limit || null;

  const checkinStartMinutes = parseTimeToMinutes(checkinStart);
  const checkinLimitMinutes = parseTimeToMinutes(checkinLimit);
  const checkoutStartMinutes = parseTimeToMinutes(checkoutStart);
  const checkoutLimitMinutes = parseTimeToMinutes(checkoutLimit);

  const nowInHotelTz = getNowInTimezone(timezone);
  const expectedCheckinDate = toIsoDate(stay.checkin_date_expected);
  const expectedCheckoutDate = toIsoDate(stay.checkout_date_expected);
  const stayStatus = (stay.stay_status || "confirmed") as ReservationStatus;

  let canCheckin = false;
  let checkinBlockReason: string | null = null;
  if (stayStatus !== "confirmed") {
    checkinBlockReason = "A estadia nao esta em status confirmado.";
  } else if (checkinStartMinutes === null || checkinLimitMinutes === null) {
    checkinBlockReason = "Janela de check-in nao configurada no hotel.";
  } else if (nowInHotelTz.date !== expectedCheckinDate) {
    checkinBlockReason = "Check-in permitido apenas na data esperada.";
  } else if (
    !isWithinWindow(
      nowInHotelTz.minutes,
      checkinStartMinutes,
      checkinLimitMinutes,
    )
  ) {
    checkinBlockReason = "Horario fora da janela de check-in do hotel.";
  } else {
    canCheckin = true;
  }

  let canCheckout = false;
  let checkoutBlockReason: string | null = null;
  if (stayStatus !== "checked_in") {
    checkoutBlockReason =
      "A estadia precisa estar em checked_in para checkout.";
  } else if (checkoutStartMinutes === null || checkoutLimitMinutes === null) {
    checkoutBlockReason = "Janela de checkout nao configurada no hotel.";
  } else if (nowInHotelTz.date !== expectedCheckoutDate) {
    checkoutBlockReason = "Checkout permitido apenas na data esperada.";
  } else if (
    !isWithinWindow(
      nowInHotelTz.minutes,
      checkoutStartMinutes,
      checkoutLimitMinutes,
    )
  ) {
    checkoutBlockReason = "Horario fora da janela de checkout do hotel.";
  } else {
    canCheckout = true;
  }

  let canNoShow = false;
  let noShowBlockReason: string | null = null;
  if (stayStatus !== "confirmed") {
    noShowBlockReason = "No-show so pode ser aplicado em estadia confirmada.";
  } else if (checkinLimitMinutes === null) {
    noShowBlockReason = "Janela de check-in nao configurada no hotel.";
  } else if (
    nowInHotelTz.date > expectedCheckinDate ||
    (nowInHotelTz.date === expectedCheckinDate &&
      nowInHotelTz.minutes > checkinLimitMinutes)
  ) {
    canNoShow = true;
  } else {
    noShowBlockReason = "No-show disponivel somente apos o limite de check-in.";
  }

  const canCancel = stayStatus === "confirmed";
  const cancelBlockReason = canCancel
    ? null
    : "Cancelamento permitido apenas para estadia confirmada.";

  const supabase = createServerClient();
  const reservationId = stay.reservation_id;
  const financeRepository = createMaintenanceFinanceRepository();
  const [reservationStaysResult, paymentsResult, maintenanceResult, folio] =
    await Promise.all([
      supabase
        .from("stays")
        .select("id,total_price_estimated,total_paid")
        .eq("reservation_id", reservationId),
      supabase
        .from("financial_transactions")
        .select(
          "id,stay_id,amount,payment_method,description,paid_at,created_at,created_by,type,status",
        )
        .eq("hotel_id", activeHotelId)
        .eq("stay_id", stay.id)
        .eq("category", "STAY_PAYMENT")
        .in("status", ["COMPLETED", "REFUNDED"])
        .order("paid_at", { ascending: false })
        .order("created_at", { ascending: false }),
      createMaintenanceRepository().getStayMaintenance(activeHotelId, stay.id),
      financeRepository.getStayFolio(activeHotelId, stay.id),
    ]);

  if (reservationStaysResult.error || paymentsResult.error) {
    return null;
  }

  const reservationRows = (reservationStaysResult.data || []) as Array<{
    id: string;
    total_price_estimated: number | null;
    total_paid: number | null;
  }>;
  const reservationFolios = includeMaintenanceFinance
    ? await Promise.all(
        reservationRows.map((row) =>
          financeRepository.getStayFolio(activeHotelId, row.id),
        ),
      )
    : [];
  const reservationTotalDue = includeMaintenanceFinance
    ? reservationFolios.reduce(
        (sum, item) => sum + Number(item?.total_debits || 0),
        0,
      )
    : reservationRows.reduce(
        (sum, row) => sum + Number(row.total_price_estimated || 0),
        0,
      );
  const reservationTotalPaid = includeMaintenanceFinance
    ? reservationFolios.reduce(
        (sum, item) => sum + Number(item?.total_credits || 0),
        0,
      )
    : reservationRows.reduce(
        (sum, row) => sum + Number(row.total_paid || 0),
        0,
      );
  const reservationPaymentStatus = derivePaymentStatus(
    reservationTotalPaid,
    reservationTotalDue,
  );

  const stayTotalDue = Number(stay.total_price_estimated || 0);
  const stayTotalPaid = Number(stay.total_paid || 0);
  const effectiveStayDue =
    includeMaintenanceFinance && folio ? folio.total_debits : stayTotalDue;
  const effectiveStayPaid =
    includeMaintenanceFinance && folio ? folio.total_credits : stayTotalPaid;
  const stayPaymentStatus = derivePaymentStatus(
    effectiveStayPaid,
    effectiveStayDue,
  );

  const payments = ((paymentsResult.data || []) as StayPaymentRow[]).map(
    (payment) =>
      ({
        id: String(payment.id),
        stay_id: String(payment.stay_id),
        amount: Number(payment.amount || 0),
        method: String(payment.payment_method || "unknown"),
        note: payment.description ? String(payment.description) : null,
        paid_at: String(payment.paid_at),
        created_at: String(payment.created_at),
        created_by: payment.created_by ? String(payment.created_by) : null,
      }) satisfies AdminStayPayment,
  );
  const pendingConsumptionEntries =
    folio?.entries.filter(
      (entry) =>
        entry.kind === "consumption_charge" &&
        entry.direction === "debit" &&
        entry.open_amount > 0,
    ) || [];
  const pendingConsumptionBalance = Number(
    pendingConsumptionEntries
      .reduce((sum, entry) => sum + entry.open_amount, 0)
      .toFixed(2),
  );
  return {
    stay: {
      id: String(stay.id),
      reservation_id: String(stay.reservation_id),
      reservation_code: stay.reservations?.reservation_code || null,
      room_id: String(stay.room_id),
      room_number: String(stay.rooms?.room_number || ""),
      room_type: String(stay.rooms?.room_type || ""),
      customer_name: stay.reservations?.customers?.full_name || null,
      stay_status: stayStatus,
      checkin_date_expected: expectedCheckinDate,
      checkout_date_expected: expectedCheckoutDate,
      checkin_date_actual: stay.checkin_date_actual
        ? String(stay.checkin_date_actual)
        : null,
      checkout_date_actual: stay.checkout_date_actual
        ? String(stay.checkout_date_actual)
        : null,
      total_price_estimated: effectiveStayDue,
      total_paid: effectiveStayPaid,
      stay_payment_status: stayPaymentStatus,
      account_version: Number(stay.account_version),
    },
    reservation: {
      id: String(reservationId),
      code: stay.reservations?.reservation_code || null,
      total_due: Number(reservationTotalDue.toFixed(2)),
      total_paid: Number(reservationTotalPaid.toFixed(2)),
      payment_status: reservationPaymentStatus,
    },
    hotel: {
      id: activeHotelId,
      timezone,
      checkin_time_start: checkinStart,
      checkin_time_limit: checkinLimit,
      checkout_time_start: checkoutStart,
      checkout_time_limit: checkoutLimit,
    },
    eligibility: {
      can_checkin: canCheckin,
      checkin_block_reason: checkinBlockReason,
      can_checkout: canCheckout,
      checkout_block_reason: checkoutBlockReason,
      can_no_show: canNoShow,
      no_show_block_reason: noShowBlockReason,
      can_cancel: canCancel,
      cancel_block_reason: cancelBlockReason,
    },
    payments,
    folio: includeMaintenanceFinance ? folio || undefined : undefined,
    maintenance_occurrences: maintenanceResult.occurrences,
    maintenance_acknowledgement_required:
      maintenanceResult.acknowledgementRequired,
    maintenance_financial_acknowledgement_required: Boolean(
      folio?.pending_maintenance_entry_ids.length,
    ),
    maintenance_pending_folio_entry_ids:
      folio?.pending_maintenance_entry_ids || [],
    pending_consumption_count: pendingConsumptionEntries.length,
    pending_consumption_balance: pendingConsumptionBalance,
    pending_consumption_folio_entry_ids: pendingConsumptionEntries.map(
      (entry) => entry.id,
    ),
  };
}

export function registerStayOperationsRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: CheckoutCandidateQuery }>(
    "/admin/stays/checkout-candidate",
    async (request, reply) => {
      const auth = ensureAuthorizedWithScope(
        request,
        reply,
        PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS,
      );
      if (!auth) return;
      const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
      if (!activeHotelId) return;

      const roomNumber = normalizeOptionalText(request.query.room_number);
      if (!roomNumber) {
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Numero do quarto obrigatorio.",
            ),
          );
      }

      const supabase = createServerClient();
      const roomsResult = await supabase
        .from("rooms")
        .select("id")
        .eq("hotel_id", activeHotelId)
        .eq("room_number", roomNumber)
        .limit(2);

      if (roomsResult.error) {
        request.log.error(roomsResult.error);
        return reply
          .status(500)
          .send(
            adminError(
              ADMIN_ERROR_CODE.INTERNAL,
              "Falha ao localizar quarto para checkout.",
            ),
          );
      }

      const rooms = (roomsResult.data || []) as Array<{ id: string }>;
      if (!rooms.length) {
        return reply
          .status(404)
          .send(
            adminError(
              ADMIN_ERROR_CODE.NOT_FOUND,
              "Quarto nao encontrado para o hotel ativo.",
            ),
          );
      }
      if (rooms.length > 1) {
        return reply
          .status(409)
          .send(
            adminError(
              ADMIN_ERROR_CODE.CONFLICT,
              "Mais de um quarto encontrado com este numero no hotel ativo.",
            ),
          );
      }

      const staysResult = await supabase
        .from("stays")
        .select("id")
        .eq("room_id", String(rooms[0]!.id))
        .eq("stay_status", "checked_in")
        .order("checkout_date_expected", { ascending: true })
        .limit(2);

      if (staysResult.error) {
        request.log.error(staysResult.error);
        return reply
          .status(500)
          .send(
            adminError(
              ADMIN_ERROR_CODE.INTERNAL,
              "Falha ao localizar estadia para checkout.",
            ),
          );
      }

      const stays = (staysResult.data || []) as Array<{ id: string }>;
      if (!stays.length) {
        return reply
          .status(404)
          .send(
            adminError(
              ADMIN_ERROR_CODE.NOT_FOUND,
              "Nenhuma estadia em check-in encontrada para este quarto.",
            ),
          );
      }
      if (stays.length > 1) {
        return reply
          .status(409)
          .send(
            adminError(
              ADMIN_ERROR_CODE.CONFLICT,
              "Mais de uma estadia em check-in encontrada para este quarto. Use o calendario de reservas.",
            ),
          );
      }

      const panel = await loadStayPanel(
        activeHotelId,
        String(stays[0]!.id),
        auth.session.permissions.includes(PERMISSIONS.MAINTENANCE_FINANCE_READ),
      ).catch((error) => {
        request.log.error(error);
        return null;
      });

      if (!panel) {
        return reply
          .status(404)
          .send(
            adminError(
              ADMIN_ERROR_CODE.NOT_FOUND,
              "Estadia nao encontrada para o hotel ativo.",
            ),
          );
      }

      return reply.send({ item: panel });
    },
  );

  app.get<{ Params: HotelIdParams }>(
    "/admin/stays/:id/panel",
    async (request, reply) => {
      const auth = ensureAuthorizedWithScope(
        request,
        reply,
        PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS,
      );
      if (!auth) return;
      const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
      if (!activeHotelId) return;

      const stayId = normalizeOptionalText(request.params.id);
      if (!stayId) {
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Id da estadia obrigatorio.",
            ),
          );
      }

      const panel = await loadStayPanel(
        activeHotelId,
        stayId,
        auth.session.permissions.includes(PERMISSIONS.MAINTENANCE_FINANCE_READ),
      ).catch((error) => {
        request.log.error(error);
        return null;
      });

      if (!panel) {
        return reply
          .status(404)
          .send(
            adminError(
              ADMIN_ERROR_CODE.NOT_FOUND,
              "Estadia nao encontrada para o hotel ativo.",
            ),
          );
      }

      return reply.send({ item: panel });
    },
  );

  app.post<{
    Params: HotelIdParams;
    Body: Partial<AdminStayPaymentCreateInput>;
  }>("/admin/stays/:id/payments", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(
      request,
      reply,
      PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS,
    );
    if (!auth) return;
    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const stayId = normalizeOptionalText(request.params.id);
    if (!stayId) {
      return reply
        .status(400)
        .send(
          adminError(ADMIN_ERROR_CODE.VALIDATION, "Id da estadia obrigatorio."),
        );
    }

    const amount = Number(request.body?.amount || 0);
    const method = normalizeOptionalText(request.body?.method);
    const note = normalizeOptionalText(request.body?.note);
    const paidAt = normalizeOptionalText(request.body?.paid_at);

    if (!Number.isFinite(amount) || amount <= 0) {
      return reply
        .status(400)
        .send(
          adminError(
            ADMIN_ERROR_CODE.VALIDATION,
            "Valor de pagamento invalido.",
          ),
        );
    }
    if (!method) {
      return reply
        .status(400)
        .send(
          adminError(
            ADMIN_ERROR_CODE.VALIDATION,
            "Metodo de pagamento obrigatorio.",
          ),
        );
    }

    const supportedMethods = [
      "cash",
      "pix",
      "credit_card",
      "debit_card",
      "bank_transfer",
    ] as const;
    if (!supportedMethods.includes(method as (typeof supportedMethods)[number]))
      return reply
        .status(400)
        .send(
          adminError(
            ADMIN_ERROR_CODE.VALIDATION,
            "Método de pagamento não suportado.",
          ),
        );
    const accountRepository = createStayAccountsRepository();
    const account = await accountRepository.getAccount(
      activeHotelId,
      stayId,
      false,
    );
    const paymentResult = account
      ? await accountRepository.createPaymentBatch(
          activeHotelId,
          stayId,
          auth.session.id,
          {
            tenders: [
              {
                payment_method: method as (typeof supportedMethods)[number],
                amount,
              },
            ],
            expected_version: account.version,
            idempotency_key: randomUUID(),
            note: note || (paidAt ? `Pagamento informado em ${paidAt}` : null),
          },
          false,
        )
      : { result: "not_found" as const };
    if (paymentResult.result !== "ok") {
      return reply
        .status(paymentResult.result === "not_found" ? 404 : 409)
        .send(
          adminError(
            paymentResult.result === "not_found"
              ? ADMIN_ERROR_CODE.NOT_FOUND
              : ADMIN_ERROR_CODE.CONFLICT,
            paymentResult.result === "not_found"
              ? "Estadia nao encontrada para o hotel ativo."
              : "Falha ao registrar ou alocar o pagamento.",
          ),
        );
    }

    const panel = await loadStayPanel(
      activeHotelId,
      stayId,
      auth.session.permissions.includes(PERMISSIONS.MAINTENANCE_FINANCE_READ),
    ).catch((error) => {
      request.log.error(error);
      return null;
    });
    if (!panel) {
      return reply
        .status(500)
        .send(
          adminError(
            ADMIN_ERROR_CODE.INTERNAL,
            "Falha ao recarregar painel da estadia.",
          ),
        );
    }

    return reply.send({ item: panel });
  });

  app.post<{ Params: HotelIdParams }>(
    "/admin/stays/:id/checkin",
    async (request, reply) => {
      const auth = ensureAuthorizedWithScope(
        request,
        reply,
        PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS,
      );
      if (!auth) return;
      const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
      if (!activeHotelId) return;

      const stayId = normalizeOptionalText(request.params.id);
      if (!stayId) {
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Id da estadia obrigatorio.",
            ),
          );
      }

      const panel = await loadStayPanel(
        activeHotelId,
        stayId,
        auth.session.permissions.includes(PERMISSIONS.MAINTENANCE_FINANCE_READ),
      );
      if (!panel) {
        return reply
          .status(404)
          .send(
            adminError(
              ADMIN_ERROR_CODE.NOT_FOUND,
              "Estadia nao encontrada para o hotel ativo.",
            ),
          );
      }
      if (!panel.eligibility.can_checkin) {
        return reply
          .status(409)
          .send(
            adminError(
              ADMIN_ERROR_CODE.CONFLICT,
              panel.eligibility.checkin_block_reason ||
                "Check-in nao permitido.",
            ),
          );
      }

      const supabase = createServerClient();
      const { error } = await supabase
        .from("stays")
        .update({
          stay_status: "checked_in",
          checkin_date_actual: new Date().toISOString(),
        })
        .eq("id", stayId);
      if (error) {
        request.log.error(error);
        return reply
          .status(409)
          .send(
            adminError(
              ADMIN_ERROR_CODE.CONFLICT,
              "Falha ao executar check-in.",
            ),
          );
      }

      const refreshed = await loadStayPanel(
        activeHotelId,
        stayId,
        auth.session.permissions.includes(PERMISSIONS.MAINTENANCE_FINANCE_READ),
      );
      if (!refreshed) {
        return reply
          .status(500)
          .send(
            adminError(
              ADMIN_ERROR_CODE.INTERNAL,
              "Falha ao recarregar painel da estadia.",
            ),
          );
      }
      return reply.send({ item: refreshed });
    },
  );

  app.post<{ Params: HotelIdParams; Body: StayCheckoutBody }>(
    "/admin/stays/:id/checkout",
    {
      preValidation: async (request) => {
        if (request.body == null) request.body = {};
      },
    },
    async (request, reply) => {
      const auth = ensureAuthorizedWithScope(
        request,
        reply,
        PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS,
      );
      if (!auth) return;
      const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
      if (!activeHotelId) return;

      const stayId = normalizeOptionalText(request.params.id);
      if (!stayId) {
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Id da estadia obrigatorio.",
            ),
          );
      }

      const panel = await loadStayPanel(
        activeHotelId,
        stayId,
        auth.session.permissions.includes(PERMISSIONS.MAINTENANCE_FINANCE_READ),
      );
      if (!panel) {
        return reply
          .status(404)
          .send(
            adminError(
              ADMIN_ERROR_CODE.NOT_FOUND,
              "Estadia nao encontrada para o hotel ativo.",
            ),
          );
      }
      if (!panel.eligibility.can_checkout) {
        return reply
          .status(409)
          .send(
            adminError(
              ADMIN_ERROR_CODE.CONFLICT,
              panel.eligibility.checkout_block_reason ||
                "Checkout nao permitido.",
            ),
          );
      }

      const acknowledgedIds = Array.from(
        new Set(request.body?.maintenance_acknowledged_occurrence_ids || []),
      );
      const acknowledgedFolioEntryIds = Array.from(
        new Set(request.body?.maintenance_acknowledged_folio_entry_ids || []),
      );
      const folio = await createMaintenanceFinanceRepository().getStayFolio(
        activeHotelId,
        stayId,
      );
      const pendingFolioEntryIds = folio?.pending_maintenance_entry_ids || [];
      const pendingOccurrenceIds = (panel.maintenance_occurrences || [])
        .filter(
          (occurrence) =>
            occurrence.status !== "resolved" &&
            occurrence.status !== "canceled",
        )
        .map((occurrence) => occurrence.id);
      if (
        panel.maintenance_acknowledgement_required &&
        pendingOccurrenceIds.some((id) => !acknowledgedIds.includes(id))
      ) {
        return reply
          .status(409)
          .send(
            adminError(
              ADMIN_ERROR_CODE.CONFLICT,
              "Registre ciência de todas as ocorrências abertas antes do checkout.",
            ),
          );
      }
      if (
        pendingFolioEntryIds.some(
          (id) => !acknowledgedFolioEntryIds.includes(id),
        )
      ) {
        return reply
          .status(409)
          .send(
            adminError(
              ADMIN_ERROR_CODE.CONFLICT,
              "Registre ciência de todas as cobranças de dano pendentes antes do checkout.",
            ),
          );
      }

      const accountRepository = createStayAccountsRepository();
      const account = await accountRepository.getAccount(
        activeHotelId,
        stayId,
        auth.session.permissions.includes(
          PERMISSIONS.COMMERCIAL_AGREEMENTS_MANAGE,
        ),
      );
      if (!account)
        return reply
          .status(404)
          .send(
            adminError(
              ADMIN_ERROR_CODE.NOT_FOUND,
              "Conta da estadia não encontrada.",
            ),
          );
      const tenders = request.body?.tenders || [];
      const result = await accountRepository.checkout(
        activeHotelId,
        stayId,
        auth.session.id,
        {
          expected_version: request.body?.expected_version ?? account.version,
          idempotency_key: request.body?.idempotency_key || randomUUID(),
          tenders,
          maintenance_acknowledged_occurrence_ids: acknowledgedIds,
          maintenance_acknowledged_folio_entry_ids: acknowledgedFolioEntryIds,
          maintenance_acknowledgement_note:
            normalizeOptionalText(
              request.body?.maintenance_acknowledgement_note,
            ) || null,
        },
        auth.session.permissions.includes(
          PERMISSIONS.COMMERCIAL_AGREEMENTS_MANAGE,
        ),
      );
      if (!("item" in result))
        return reply
          .status(409)
          .send(
            adminError(
              ADMIN_ERROR_CODE.CONFLICT,
              "A conta mudou ou ainda possui pendências para checkout.",
              result.result,
            ),
          );
      return reply.send({ item: result.item });
    },
  );

  app.post<{ Params: HotelIdParams }>(
    "/admin/stays/:id/no-show",
    async (request, reply) => {
      const auth = ensureAuthorizedWithScope(
        request,
        reply,
        PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS,
      );
      if (!auth) return;
      const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
      if (!activeHotelId) return;

      const stayId = normalizeOptionalText(request.params.id);
      if (!stayId) {
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Id da estadia obrigatorio.",
            ),
          );
      }

      const panel = await loadStayPanel(
        activeHotelId,
        stayId,
        auth.session.permissions.includes(PERMISSIONS.MAINTENANCE_FINANCE_READ),
      );
      if (!panel) {
        return reply
          .status(404)
          .send(
            adminError(
              ADMIN_ERROR_CODE.NOT_FOUND,
              "Estadia nao encontrada para o hotel ativo.",
            ),
          );
      }
      if (!panel.eligibility.can_no_show) {
        return reply
          .status(409)
          .send(
            adminError(
              ADMIN_ERROR_CODE.CONFLICT,
              panel.eligibility.no_show_block_reason ||
                "No-show nao permitido.",
            ),
          );
      }

      const supabase = createServerClient();
      const { error } = await supabase
        .from("stays")
        .update({ stay_status: "no_show" })
        .eq("id", stayId);
      if (error) {
        request.log.error(error);
        return reply
          .status(409)
          .send(
            adminError(ADMIN_ERROR_CODE.CONFLICT, "Falha ao aplicar no-show."),
          );
      }

      const refreshed = await loadStayPanel(
        activeHotelId,
        stayId,
        auth.session.permissions.includes(PERMISSIONS.MAINTENANCE_FINANCE_READ),
      );
      if (!refreshed) {
        return reply
          .status(500)
          .send(
            adminError(
              ADMIN_ERROR_CODE.INTERNAL,
              "Falha ao recarregar painel da estadia.",
            ),
          );
      }
      return reply.send({ item: refreshed });
    },
  );

  app.post<{ Params: HotelIdParams }>(
    "/admin/stays/:id/cancel",
    async (request, reply) => {
      const auth = ensureAuthorizedWithScope(
        request,
        reply,
        PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS,
      );
      if (!auth) return;
      const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
      if (!activeHotelId) return;

      const stayId = normalizeOptionalText(request.params.id);
      if (!stayId) {
        return reply
          .status(400)
          .send(
            adminError(
              ADMIN_ERROR_CODE.VALIDATION,
              "Id da estadia obrigatorio.",
            ),
          );
      }

      const panel = await loadStayPanel(
        activeHotelId,
        stayId,
        auth.session.permissions.includes(PERMISSIONS.MAINTENANCE_FINANCE_READ),
      );
      if (!panel) {
        return reply
          .status(404)
          .send(
            adminError(
              ADMIN_ERROR_CODE.NOT_FOUND,
              "Estadia nao encontrada para o hotel ativo.",
            ),
          );
      }
      if (!panel.eligibility.can_cancel) {
        return reply
          .status(409)
          .send(
            adminError(
              ADMIN_ERROR_CODE.CONFLICT,
              panel.eligibility.cancel_block_reason ||
                "Cancelamento nao permitido.",
            ),
          );
      }

      const supabase = createServerClient();
      const { error } = await supabase
        .from("stays")
        .update({ stay_status: "canceled" })
        .eq("id", stayId);
      if (error) {
        request.log.error(error);
        return reply
          .status(409)
          .send(
            adminError(ADMIN_ERROR_CODE.CONFLICT, "Falha ao cancelar estadia."),
          );
      }

      const refreshed = await loadStayPanel(
        activeHotelId,
        stayId,
        auth.session.permissions.includes(PERMISSIONS.MAINTENANCE_FINANCE_READ),
      );
      if (!refreshed) {
        return reply
          .status(500)
          .send(
            adminError(
              ADMIN_ERROR_CODE.INTERNAL,
              "Falha ao recarregar painel da estadia.",
            ),
          );
      }
      return reply.send({ item: refreshed });
    },
  );
}
