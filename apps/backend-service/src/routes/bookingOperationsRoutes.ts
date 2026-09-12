import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  ADMIN_ERROR_CODE,
  PERMISSIONS,
  type BookingChannelEventAction,
  type BookingChannelInput,
  type BookingChannelMappingInput,
  type BookingConfigurationInput,
  type GuestPreferenceInput,
  type PrearrivalLinkInput,
  type PrearrivalRequestAction,
  type RatePlanInput,
  type RatePlanVersionInput,
  type ReservationAmendmentInput,
  type ReservationGuaranteeInput,
  type RoomAssignmentInput,
  type VersionedBookingAction,
} from "@hotel/shared";
import { ensureAuthorizedWithScope } from "../auth/authorization";
import { adminError } from "../common/adminError";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import {
  createBookingOperationsRepository,
  type BookingOperationsRepository,
} from "../repositories/bookingOperationsRepository";

type Params = { id: string };
function context(
  request: FastifyRequest,
  reply: FastifyReply,
  permission: string,
) {
  const auth = ensureAuthorizedWithScope(request, reply, permission as never);
  if (!auth) return null;
  const hotelId = requireActiveHotelId(reply, auth.activeHotelId);
  return hotelId
    ? {
        hotelId,
        actorId: auth.session.id,
        permissions: auth.session.permissions,
      }
    : null;
}
function send(
  reply: FastifyReply,
  value: { result: string; context?: unknown },
  created = false,
) {
  if (value.result === "ok")
    return reply.status(created ? 201 : 200).send({ ok: true, ...value });
  const missing = value.result === "not_found";
  const invalid =
    value.result.startsWith("invalid") ||
    value.result === "insufficient_guarantee";
  return reply
    .status(missing ? 404 : invalid ? 400 : 409)
    .send({
      ...adminError(
        missing
          ? ADMIN_ERROR_CODE.NOT_FOUND
          : invalid
            ? ADMIN_ERROR_CODE.VALIDATION
            : ADMIN_ERROR_CODE.CONFLICT,
        missing
          ? "Reserva não encontrada no hotel ativo."
          : invalid
            ? "Dados inválidos para a operação."
            : "A reserva mudou ou exige outra decisão.",
        value.result,
      ),
      ...(value.context ? { context: value.context } : {}),
    });
}
export function registerBookingOperationsRoutes(
  app: FastifyInstance,
  repository: BookingOperationsRepository = createBookingOperationsRepository(),
) {
  app.get("/admin/booking-configuration", async (request, reply) => {
    const c = context(request, reply, PERMISSIONS.BOOKING_CONFIGURATION_MANAGE);
    if (!c) return;
    return reply.send(
      await repository.query("get_booking_configuration", {
        p_hotel_id: c.hotelId,
      }),
    );
  });
  app.put<{ Body: BookingConfigurationInput }>(
    "/admin/booking-configuration",
    async (request, reply) => {
      const c = context(
        request,
        reply,
        PERMISSIONS.BOOKING_CONFIGURATION_MANAGE,
      );
      if (!c) return;
      return send(
        reply,
        await repository.mutate("save_booking_configuration", {
          p_hotel_id: c.hotelId,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
      );
    },
  );
  app.get("/admin/rate-plans", async (request, reply) => {
    const c = context(request, reply, PERMISSIONS.RESERVATION_READ);
    if (!c) return;
    return reply.send(
      await repository.query("list_rate_plans", { p_hotel_id: c.hotelId }),
    );
  });
  app.post<{ Body: RatePlanInput }>(
    "/admin/rate-plans",
    async (request, reply) => {
      const c = context(request, reply, PERMISSIONS.RATE_PLANS_MANAGE);
      if (!c) return;
      return send(
        reply,
        await repository.mutate("save_rate_plan", {
          p_hotel_id: c.hotelId,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
        true,
      );
    },
  );
  app.post<{ Params: Params; Body: RatePlanVersionInput }>(
    "/admin/rate-plans/:id/versions",
    async (request, reply) => {
      const c = context(request, reply, PERMISSIONS.RATE_PLANS_MANAGE);
      if (!c) return;
      return send(
        reply,
        await repository.mutate("version_rate_plan", {
          p_hotel_id: c.hotelId,
          p_plan_id: request.params.id,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
        true,
      );
    },
  );
  app.post<{ Params: Params; Body: VersionedBookingAction }>(
    "/admin/rate-plan-versions/:id/actions",
    async (request, reply) => {
      const c = context(request, reply, PERMISSIONS.RATE_PLANS_MANAGE);
      if (!c) return;
      return send(
        reply,
        await repository.mutate("act_rate_plan_version", {
          p_hotel_id: c.hotelId,
          p_version_id: request.params.id,
          p_actor_id: c.actorId,
          p_action: request.body.action,
        }),
      );
    },
  );
  app.get<{ Params: Params }>(
    "/admin/reservations/:id",
    async (request, reply) => {
      const c = context(request, reply, PERMISSIONS.RESERVATION_READ);
      if (!c) return;
      const data = await repository.query("get_reservation_operations", {
        p_hotel_id: c.hotelId,
        p_reservation_id: request.params.id,
      });
      return data
        ? reply.send(data)
        : reply
            .status(404)
            .send(
              adminError(
                ADMIN_ERROR_CODE.NOT_FOUND,
                "Reserva não encontrada no hotel ativo.",
              ),
            );
    },
  );
  app.post<{ Params: Params; Body: ReservationAmendmentInput }>(
    "/admin/reservations/:id/amendments/simulate",
    async (request, reply) => {
      const c = context(
        request,
        reply,
        PERMISSIONS.RESERVATION_AMENDMENTS_MANAGE,
      );
      if (!c) return;
      return reply.send(
        await repository.query("simulate_reservation_amendment", {
          p_hotel_id: c.hotelId,
          p_reservation_id: request.params.id,
          p_input: request.body,
        }),
      );
    },
  );
  app.post<{ Params: Params; Body: ReservationAmendmentInput }>(
    "/admin/reservations/:id/amendments",
    async (request, reply) => {
      const c = context(
        request,
        reply,
        PERMISSIONS.RESERVATION_AMENDMENTS_MANAGE,
      );
      if (!c) return;
      return send(
        reply,
        await repository.mutate("apply_reservation_amendment", {
          p_hotel_id: c.hotelId,
          p_reservation_id: request.params.id,
          p_actor_id: c.actorId,
          p_input: request.body,
          p_can_override: c.permissions.includes(
            PERMISSIONS.RESERVATION_PRICING_OVERRIDE,
          ),
        }),
      );
    },
  );
  app.post<{ Params: Params; Body: ReservationGuaranteeInput }>(
    "/admin/reservations/:id/guarantees",
    async (request, reply) => {
      const c = context(
        request,
        reply,
        PERMISSIONS.RESERVATION_GUARANTEES_MANAGE,
      );
      if (!c) return;
      return send(
        reply,
        await repository.mutate("record_reservation_guarantee", {
          p_hotel_id: c.hotelId,
          p_reservation_id: request.params.id,
          p_actor_id: c.actorId,
          p_input: request.body,
          p_can_waive: c.permissions.includes(
            PERMISSIONS.RESERVATION_GUARANTEE_WAIVE,
          ),
        }),
      );
    },
  );
  app.post<{ Params: Params; Body: VersionedBookingAction }>(
    "/admin/reservations/:id/actions",
    async (request, reply) => {
      const c = context(
        request,
        reply,
        PERMISSIONS.RESERVATION_GUARANTEES_MANAGE,
      );
      if (!c) return;
      return send(
        reply,
        await repository.mutate("act_reservation", {
          p_hotel_id: c.hotelId,
          p_reservation_id: request.params.id,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
      );
    },
  );
  app.post<{ Params: Params; Body: RoomAssignmentInput }>(
    "/admin/reservations/:id/room-assignments/simulate",
    async (request, reply) => {
      const c = context(request, reply, PERMISSIONS.ROOM_ASSIGNMENTS_MANAGE);
      if (!c) return;
      return reply.send(
        await repository.query("simulate_room_assignment", {
          p_hotel_id: c.hotelId,
          p_reservation_id: request.params.id,
          p_input: request.body,
        }),
      );
    },
  );
  app.post<{ Params: Params; Body: RoomAssignmentInput }>(
    "/admin/reservations/:id/room-assignments",
    async (request, reply) => {
      const c = context(request, reply, PERMISSIONS.ROOM_ASSIGNMENTS_MANAGE);
      if (!c) return;
      return send(
        reply,
        await repository.mutate("assign_reservation_room", {
          p_hotel_id: c.hotelId,
          p_reservation_id: request.params.id,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
      );
    },
  );
  app.get("/admin/prearrival/board", async (request, reply) => {
    const c = context(request, reply, PERMISSIONS.PREARRIVAL_MANAGE);
    if (!c) return;
    return reply.send(
      await repository.query("list_prearrival_board", {
        p_hotel_id: c.hotelId,
      }),
    );
  });
  app.post<{ Params: Params; Body: PrearrivalLinkInput }>(
    "/admin/reservations/:id/prearrival-links",
    async (request, reply) => {
      const c = context(request, reply, PERMISSIONS.PREARRIVAL_MANAGE);
      if (!c) return;
      return send(
        reply,
        await repository.mutate("create_prearrival_link", {
          p_hotel_id: c.hotelId,
          p_reservation_id: request.params.id,
          p_actor_id: c.actorId,
          p_hours: request.body.expires_in_hours,
        }),
        true,
      );
    },
  );
  app.post<{ Params: Params; Body: PrearrivalRequestAction }>(
    "/admin/prearrival-requests/:id/actions",
    async (request, reply) => {
      const c = context(request, reply, PERMISSIONS.PREARRIVAL_MANAGE);
      if (!c) return;
      return send(
        reply,
        await repository.mutate("act_prearrival_request", {
          p_hotel_id: c.hotelId,
          p_id: request.params.id,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
      );
    },
  );
  app.get<{ Params: Params }>(
    "/admin/customers/:id/relationship",
    async (request, reply) => {
      const c = context(request, reply, PERMISSIONS.GUEST_RELATIONSHIP_READ);
      if (!c) return;
      const data = await repository.query("get_guest_relationship", {
        p_hotel_id: c.hotelId,
        p_customer_id: request.params.id,
        p_include_sensitive: c.permissions.includes(
          PERMISSIONS.GUEST_RELATIONSHIP_MANAGE,
        ),
      });
      return data
        ? reply.send(data)
        : reply
            .status(404)
            .send(
              adminError(
                ADMIN_ERROR_CODE.NOT_FOUND,
                "Hóspede não encontrado no hotel ativo.",
              ),
            );
    },
  );
  app.post<{ Params: Params; Body: GuestPreferenceInput }>(
    "/admin/customers/:id/preferences",
    async (request, reply) => {
      const c = context(request, reply, PERMISSIONS.GUEST_RELATIONSHIP_MANAGE);
      if (!c) return;
      return send(
        reply,
        await repository.mutate("save_guest_preference", {
          p_hotel_id: c.hotelId,
          p_customer_id: request.params.id,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
        true,
      );
    },
  );
  app.get("/admin/booking-channels", async (request, reply) => {
    const c = context(request, reply, PERMISSIONS.BOOKING_CHANNELS_MANAGE);
    if (!c) return;
    return reply.send(
      await repository.query("list_booking_channels", {
        p_hotel_id: c.hotelId,
      }),
    );
  });
  app.post<{ Body: BookingChannelInput }>(
    "/admin/booking-channels",
    async (request, reply) => {
      const c = context(request, reply, PERMISSIONS.BOOKING_CHANNELS_MANAGE);
      if (!c) return;
      return send(
        reply,
        await repository.mutate("save_booking_channel", {
          p_hotel_id: c.hotelId,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
        true,
      );
    },
  );
  app.post<{ Params: Params; Body: BookingChannelMappingInput }>(
    "/admin/booking-channels/:id/mappings",
    async (request, reply) => {
      const c = context(request, reply, PERMISSIONS.BOOKING_CHANNELS_MANAGE);
      if (!c) return;
      return send(
        reply,
        await repository.mutate("save_booking_channel_mapping", {
          p_hotel_id: c.hotelId,
          p_channel_id: request.params.id,
          p_input: request.body,
        }),
        true,
      );
    },
  );
  app.get("/admin/booking-channels/inbox", async (request, reply) => {
    const c = context(request, reply, PERMISSIONS.BOOKING_CHANNELS_MANAGE);
    if (!c) return;
    return reply.send(
      await repository.query("list_booking_channel_inbox", {
        p_hotel_id: c.hotelId,
      }),
    );
  });
  app.post<{ Params: Params; Body: BookingChannelEventAction }>(
    "/admin/booking-channel-events/:id/actions",
    async (request, reply) => {
      const c = context(request, reply, PERMISSIONS.BOOKING_CHANNELS_MANAGE);
      if (!c) return;
      return send(
        reply,
        await repository.mutate("act_booking_channel_event", {
          p_hotel_id: c.hotelId,
          p_id: request.params.id,
          p_actor_id: c.actorId,
          p_input: request.body,
        }),
      );
    },
  );
  app.get("/admin/analytics/operations", async (request, reply) => {
    const c = context(request, reply, PERMISSIONS.INTEGRATED_ANALYTICS_READ);
    if (!c) return;
    const q = request.query as { from?: string; to?: string };
    return reply.send(
      await repository.query("list_integrated_analytics", {
        p_hotel_id: c.hotelId,
        p_from: q.from,
        p_to: q.to,
        p_permissions: c.permissions,
      }),
    );
  });
  app.get("/admin/analytics/operations/drilldown", async (request, reply) => {
    const c = context(request, reply, PERMISSIONS.INTEGRATED_ANALYTICS_READ);
    if (!c) return;
    const q = request.query as { date?: string; metric?: string };
    return reply.send(
      await repository.query("drilldown_integrated_analytics", {
        p_hotel_id: c.hotelId,
        p_date: q.date,
        p_metric: q.metric,
        p_permissions: c.permissions,
      }),
    );
  });
  app.post("/admin/analytics/operations/reconcile", async (request, reply) => {
    const c = context(request, reply, PERMISSIONS.INTEGRATED_ANALYTICS_READ);
    if (!c) return;
    const b = request.body as { from?: string; to?: string };
    return send(
      reply,
      await repository.mutate("reconcile_integrated_analytics", {
        p_hotel_id: c.hotelId,
        p_from: b.from,
        p_to: b.to,
        p_now: new Date().toISOString(),
      }),
    );
  });
}
