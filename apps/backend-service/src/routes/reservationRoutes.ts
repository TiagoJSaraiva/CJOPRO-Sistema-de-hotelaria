import type { FastifyInstance } from "fastify";
import {
  ADMIN_ERROR_CODE,
  PERMISSIONS,
  type AdminReservationCreateInput,
  type AdminReservationUpdateInput,
  type HotelIdParams
} from "@hotel/shared";
import { ensureAuthorizedWithScope } from "../auth/authorization";
import { adminError } from "../common/adminError";
import { normalizeOptionalText } from "../common/text";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import { createReservationsRepository, type ReservationsRepository } from "../repositories/reservationsRepository";

type ReservationCreateBody = Partial<AdminReservationCreateInput>;
type ReservationUpdateBody = Partial<AdminReservationUpdateInput>;

export function registerReservationRoutes(
  app: FastifyInstance,
  repository: ReservationsRepository = createReservationsRepository()
): void {
  app.get("/admin/reservations", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.RESERVATION_READ);
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const data = await repository.listReservations(activeHotelId).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!data) return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao consultar reservas."));

    return reply.send({ items: data });
  });

  app.post<{ Body: ReservationCreateBody }>("/admin/reservations", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.RESERVATION_CREATE);
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const bookingCustomerId = normalizeOptionalText(request.body?.booking_customer_id);
    const reservationCode = normalizeOptionalText(request.body?.reservation_code);
    const plannedCheckinDate = normalizeOptionalText(request.body?.planned_checkin_date);
    const plannedCheckoutDate = normalizeOptionalText(request.body?.planned_checkout_date);
    const guestCount = Number(request.body?.guest_count);

    if (!bookingCustomerId || !reservationCode || !plannedCheckinDate || !plannedCheckoutDate || !Number.isFinite(guestCount) || guestCount <= 0) {
      return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Dados invalidos para criar reserva."));
    }

    const createResult = await repository
      .createReservation(activeHotelId, {
        booking_customer_id: bookingCustomerId,
        reservation_code: reservationCode,
        planned_checkin_date: plannedCheckinDate,
        planned_checkout_date: plannedCheckoutDate,
        actual_checkin_date: normalizeOptionalText(request.body?.actual_checkin_date),
        actual_checkout_date: normalizeOptionalText(request.body?.actual_checkout_date),
        guest_count: guestCount,
        reservation_status: normalizeOptionalText(request.body?.reservation_status) || "pending",
        reservation_source: normalizeOptionalText(request.body?.reservation_source),
        payment_status: normalizeOptionalText(request.body?.payment_status) || "pending",
        estimated_total_amount:
          request.body?.estimated_total_amount === undefined ? null : Number(request.body.estimated_total_amount),
        final_total_amount: request.body?.final_total_amount === undefined ? null : Number(request.body.final_total_amount),
        notes: normalizeOptionalText(request.body?.notes)
      })
      .catch((error) => {
        request.log.error(error);
        return null;
      });

    if (!createResult) return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao criar reserva."));
    if (createResult.result === "conflict") return reply.status(409).send(adminError(ADMIN_ERROR_CODE.CONFLICT, "Conflito ao criar reserva."));
    if (!createResult.item) return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao criar reserva."));

    return reply.status(201).send({ item: createResult.item });
  });

  app.put<{ Params: HotelIdParams; Body: ReservationUpdateBody }>("/admin/reservations/:id", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.RESERVATION_UPDATE);
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const id = normalizeOptionalText(request.params.id);
    if (!id) return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Id da reserva e obrigatorio para atualizacao."));

    const payload: Record<string, unknown> = {};
    if (request.body?.booking_customer_id !== undefined) payload.booking_customer_id = normalizeOptionalText(request.body.booking_customer_id);
    if (request.body?.reservation_code !== undefined) payload.reservation_code = normalizeOptionalText(request.body.reservation_code);
    if (request.body?.planned_checkin_date !== undefined) payload.planned_checkin_date = normalizeOptionalText(request.body.planned_checkin_date);
    if (request.body?.planned_checkout_date !== undefined) payload.planned_checkout_date = normalizeOptionalText(request.body.planned_checkout_date);
    if (request.body?.actual_checkin_date !== undefined) payload.actual_checkin_date = normalizeOptionalText(request.body.actual_checkin_date);
    if (request.body?.actual_checkout_date !== undefined) payload.actual_checkout_date = normalizeOptionalText(request.body.actual_checkout_date);
    if (request.body?.guest_count !== undefined) payload.guest_count = Number(request.body.guest_count);
    if (request.body?.reservation_status !== undefined) payload.reservation_status = normalizeOptionalText(request.body.reservation_status);
    if (request.body?.reservation_source !== undefined) payload.reservation_source = normalizeOptionalText(request.body.reservation_source);
    if (request.body?.payment_status !== undefined) payload.payment_status = normalizeOptionalText(request.body.payment_status);
    if (request.body?.estimated_total_amount !== undefined) payload.estimated_total_amount = Number(request.body.estimated_total_amount);
    if (request.body?.final_total_amount !== undefined) payload.final_total_amount = Number(request.body.final_total_amount);
    if (request.body?.notes !== undefined) payload.notes = normalizeOptionalText(request.body.notes);

    if (!Object.keys(payload).length) return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Nenhum campo informado para atualizacao."));

    const updateResult = await repository.updateReservation(id, activeHotelId, payload).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!updateResult) return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao atualizar reserva."));
    if (updateResult.result === "not-found") return reply.status(404).send(adminError(ADMIN_ERROR_CODE.NOT_FOUND, "Reserva nao encontrada neste hotel."));
    if (updateResult.result === "conflict") return reply.status(409).send(adminError(ADMIN_ERROR_CODE.CONFLICT, "Conflito de dados ao atualizar reserva."));

    return reply.send({ item: updateResult.item });
  });

  app.delete<{ Params: HotelIdParams }>("/admin/reservations/:id", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.RESERVATION_DELETE);
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const id = normalizeOptionalText(request.params.id);
    if (!id) return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Id da reserva e obrigatorio para exclusao."));

    const result = await repository.deleteReservation(id, activeHotelId).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!result) return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao excluir reserva."));
    if (result === "not-found") return reply.status(404).send(adminError(ADMIN_ERROR_CODE.NOT_FOUND, "Reserva nao encontrada neste hotel."));
    if (result === "conflict") return reply.status(409).send(adminError(ADMIN_ERROR_CODE.CONFLICT, "Reserva nao pode ser excluida: possui dependencias ativas."));

    return reply.send({ ok: true });
  });
}
