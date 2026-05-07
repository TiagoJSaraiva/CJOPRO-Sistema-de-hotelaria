import type { FastifyInstance } from "fastify";
import { ADMIN_ERROR_CODE, PERMISSIONS } from "@hotel/shared";
import { ensureAuthorizedWithScope } from "../auth/authorization";
import { adminError } from "../common/adminError";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import { createReservationsCalendarRepository, type ReservationsCalendarRepository } from "../repositories/reservationsCalendarRepository";

const DEFAULT_DAYS = 20;
const MAX_DAYS = 60;

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDays(date: string, days: number): string {
  const [yearRaw = "1970", monthRaw = "01", dayRaw = "01"] = date.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

type CalendarQuery = {
  start_date?: string;
  days?: string;
};

export function registerReservationsCalendarRoutes(
  app: FastifyInstance,
  repository: ReservationsCalendarRepository = createReservationsCalendarRepository()
): void {
  app.get<{ Querystring: CalendarQuery }>("/admin/reservations/calendar", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS);
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const today = new Date().toISOString().slice(0, 10);
    const startDate = String(request.query?.start_date || today).trim();

    if (!isValidIsoDate(startDate)) {
      return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "start_date invalido. Use o formato YYYY-MM-DD."));
    }

    const requestedDays = Number(String(request.query?.days || DEFAULT_DAYS));
    if (!Number.isFinite(requestedDays) || requestedDays < 1 || requestedDays > MAX_DAYS) {
      return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, `days invalido. Informe um valor entre 1 e ${MAX_DAYS}.`));
    }

    const days = Math.floor(requestedDays);
    const endDate = addDays(startDate, days - 1);

    const timeline = await repository.getTimeline(activeHotelId, startDate, endDate).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!timeline) {
      return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao consultar calendario de reservas."));
    }

    return reply.send(timeline);
  });
}
