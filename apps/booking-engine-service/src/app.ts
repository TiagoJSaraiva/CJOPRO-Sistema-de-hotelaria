import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import cors from "@fastify/cors";
import Fastify, { type FastifyRequest } from "fastify";
import {
  BookingChannelEventInputSchema,
  PublicBookingHoldInputSchema,
  PublicBookingQuoteInputSchema,
  PublicChangeRequestInputSchema,
  PublicPrearrivalInputSchema,
} from "@hotel/shared";
import type { BookingRepository } from "./repository.js";

const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:3000"];
const publicError = (code: string, message: string) => ({
  ok: false,
  error: { code, message },
});
const resultOf = (value: unknown) =>
  value && typeof value === "object" && "result" in value
    ? String((value as { result: unknown }).result)
    : "ok";
const objectOf = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

function normalizeOrigin(origin: string) {
  return origin.trim().toLowerCase().replace(/\/$/, "");
}

function requestIdentifier(request: FastifyRequest) {
  const source = `${request.ip}|${request.headers["user-agent"] || "unknown"}`;
  return createHash("sha256").update(source).digest("hex");
}

function signatureIsValid(
  secretDigest: string,
  timestamp: string,
  payload: unknown,
  signature: string,
  now: Date,
) {
  const sent = Number(timestamp);
  if (!Number.isFinite(sent) || Math.abs(now.getTime() - sent) > 300_000)
    return false;
  const expected = createHmac("sha256", secretDigest)
    .update(`${timestamp}.${JSON.stringify(payload)}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createBookingApp(options: {
  repository: BookingRepository;
  now?: () => Date;
  allowedOrigins?: string[];
}) {
  const repository = options.repository;
  const now = options.now ?? (() => new Date());
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });
  const configured =
    options.allowedOrigins ??
    (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean);
  const origins = new Set(
    (configured.length ? configured : DEFAULT_ALLOWED_ORIGINS).map(
      normalizeOrigin,
    ),
  );

  app.register(cors, {
    origin(origin, callback) {
      callback(null, !origin || origins.has(normalizeOrigin(origin)));
    },
  });

  async function rateLimit(request: FastifyRequest, scope: string) {
    const result = await repository.call("consume_public_rate_limit", {
      p_identifier: requestIdentifier(request),
      p_scope: scope,
      p_now: now().toISOString(),
    });
    return resultOf(result) === "ok";
  }

  async function tokenCall(token: string, name: string, input?: unknown) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    return repository.call(name, {
      p_token_hash: tokenHash,
      ...(input === undefined ? {} : { p_input: input }),
    });
  }

  async function authenticateChannel(
    request: FastifyRequest<{ Params: { connectionId: string } }>,
    payload: unknown,
  ) {
    const channel = (await repository.call("resolve_booking_channel", {
      p_id: request.params.connectionId,
    })) as { active?: boolean; credential_digest?: string } | null;
    const timestamp = String(request.headers["x-channel-timestamp"] || "");
    const signature = String(request.headers["x-channel-signature"] || "");
    return !!(
      channel?.active &&
      channel.credential_digest &&
      signatureIsValid(
        channel.credential_digest,
        timestamp,
        payload,
        signature,
        now(),
      )
    );
  }

  app.get("/health", async () => ({
    status: "ok",
    service: "booking-engine-service",
  }));
  app.get("/public/hotels/:slug/booking-config", async (request, reply) => {
    const value = await repository.call("get_public_booking_configuration", {
      p_slug: (request.params as { slug: string }).slug,
    });
    return value
      ? reply.send({ ok: true, ...objectOf(value) })
      : reply.status(404).send(publicError("NOT_FOUND", "Hotel indisponível."));
  });
  app.post(
    "/public/hotels/:slug/quotes",
    { schema: { body: PublicBookingQuoteInputSchema } },
    async (request, reply) => {
      if (!(await rateLimit(request, "quote")))
        return reply
          .status(429)
          .send(publicError("RATE_LIMIT", "Tente novamente mais tarde."));
      const value = await repository.call("quote_public_booking", {
        p_slug: (request.params as { slug: string }).slug,
        p_input: request.body,
      });
      const result = resultOf(value);
      return result === "ok"
        ? reply.send({ ok: true, ...objectOf(value) })
        : reply
            .status(result === "not_found" ? 404 : 409)
            .send(publicError(result, "A cotação precisa ser refeita."));
    },
  );
  app.post(
    "/public/hotels/:slug/holds",
    { schema: { body: PublicBookingHoldInputSchema } },
    async (request, reply) => {
      if (!(await rateLimit(request, "hold")))
        return reply
          .status(429)
          .send(publicError("RATE_LIMIT", "Tente novamente mais tarde."));
      const value = await repository.call("create_public_booking_hold", {
        p_slug: (request.params as { slug: string }).slug,
        p_input: request.body,
      });
      const result = resultOf(value);
      return result === "ok"
        ? reply.status(201).send({ ok: true, ...objectOf(value) })
        : reply
            .status(result === "not_found" ? 404 : 409)
            .send(publicError(result, "Inventário ou preço alterado."));
    },
  );
  app.get("/public/booking-access/:token", async (request, reply) => {
    const value = await tokenCall(
      (request.params as { token: string }).token,
      "resolve_prearrival_token",
    );
    return value
      ? reply.send({ ok: true, ...objectOf(value) })
      : reply
          .status(404)
          .send(publicError("INVALID_ACCESS", "Link inválido ou expirado."));
  });
  app.post(
    "/public/booking-access/:token/prearrival",
    { schema: { body: PublicPrearrivalInputSchema } },
    async (request, reply) => {
      const value = await tokenCall(
        (request.params as { token: string }).token,
        "submit_prearrival",
        request.body,
      );
      const result = resultOf(value);
      return result === "ok"
        ? reply.send({ ok: true, ...objectOf(value) })
        : reply
            .status(result === "conflict" ? 409 : 404)
            .send(
              publicError(
                "INVALID_ACCESS",
                "Link inválido ou reserva alterada.",
              ),
            );
    },
  );
  app.post(
    "/public/booking-access/:token/change-requests",
    { schema: { body: PublicChangeRequestInputSchema } },
    async (request, reply) => {
      const value = await tokenCall(
        (request.params as { token: string }).token,
        "create_prearrival_change_request",
        request.body,
      );
      return resultOf(value) === "ok"
        ? reply.status(201).send({ ok: true, ...objectOf(value) })
        : reply
            .status(404)
            .send(publicError("INVALID_ACCESS", "Link inválido ou expirado."));
    },
  );
  app.post(
    "/channels/:connectionId/events",
    { schema: { body: BookingChannelEventInputSchema } },
    async (request, reply) => {
      if (!(await authenticateChannel(request as never, request.body)))
        return reply
          .status(401)
          .send(publicError("INVALID_SIGNATURE", "Assinatura inválida."));
      const value = await repository.call("ingest_booking_channel_event", {
        p_channel_id: (request.params as { connectionId: string }).connectionId,
        p_input: request.body,
      });
      return resultOf(value) === "idempotency_conflict"
        ? reply
            .status(409)
            .send(publicError("IDEMPOTENCY_CONFLICT", "Evento divergente."))
        : reply.status(202).send({ ok: true, ...objectOf(value) });
    },
  );
  app.get("/channels/:connectionId/inventory", async (request, reply) => {
    if (!(await authenticateChannel(request as never, null)))
      return reply
        .status(401)
        .send(publicError("INVALID_SIGNATURE", "Assinatura inválida."));
    const value = await repository.call("get_booking_channel_inventory", {
      p_channel_id: (request.params as { connectionId: string }).connectionId,
    });
    return reply.send({ ok: true, ...objectOf(value) });
  });
  app.post(
    "/channels/:connectionId/acknowledgements",
    async (request, reply) => {
      if (!(await authenticateChannel(request as never, request.body)))
        return reply
          .status(401)
          .send(publicError("INVALID_SIGNATURE", "Assinatura inválida."));
      const value = await repository.call("acknowledge_booking_channel_feed", {
        p_channel_id: (request.params as { connectionId: string }).connectionId,
        p_feed_version: (request.body as { feed_version?: string })
          ?.feed_version,
      });
      return reply.send({ ok: true, ...objectOf(value) });
    },
  );
  return app;
}

export const bookingSecurity = {
  normalizeOrigin,
  requestIdentifier,
  signatureIsValid,
};
