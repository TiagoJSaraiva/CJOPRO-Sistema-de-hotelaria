import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { bookingSecurity, createBookingApp } from "../../src/app";
import type { BookingRepository } from "../../src/repository";

const now = new Date("2026-09-12T12:00:00.000Z");
const quoteBody = {
  checkin_date: "2026-10-10",
  checkout_date: "2026-10-12",
  rooms: [{ adults: 2, children: 0 }],
};
const holdBody = {
  quote_id: "11111111-1111-4111-8111-111111111111",
  quote_fingerprint: "a".repeat(32),
  idempotency_key: "22222222-2222-4222-8222-222222222222",
  contact_name: "Maria",
  email: "maria@example.com",
  consent_version: "v1",
  selections: [
    {
      quote_item_id: "33333333-3333-4333-8333-333333333333",
      room_type: "Standard",
      rate_plan_version_id: "44444444-4444-4444-8444-444444444444",
    },
  ],
};

function repository(overrides: Record<string, string> = {}) {
  const calls: Array<[string, Record<string, unknown>]> = [];
  const repo: BookingRepository = {
    async call(name, params) {
      calls.push([name, params]);
      if (name === "consume_public_rate_limit")
        return { result: overrides[name] || "ok" };
      if (name === "resolve_booking_channel") {
        if (overrides[name] === "missing") return null;
        return {
          active: overrides[name] !== "inactive",
          credential_digest:
            overrides[name] === "no_digest"
              ? undefined
              : createHash("sha256").update("secret").digest("hex"),
        };
      }
      if (name === "resolve_prearrival_token")
        return overrides[name] === "missing"
          ? null
          : { reservation: { id: "r" } };
      if (name === "get_public_booking_configuration")
        return overrides[name] === "missing"
          ? null
          : { result: "ok", hotel: { name: "Hotel" } };
      return { result: overrides[name] || "ok", id: "id" };
    },
  };
  return { repo, calls };
}

function sign(payload: unknown, timestamp = String(now.getTime())) {
  const digest = createHash("sha256").update("secret").digest("hex");
  return {
    "x-channel-timestamp": timestamp,
    "x-channel-signature": createHmac("sha256", digest)
      .update(`${timestamp}.${JSON.stringify(payload)}`)
      .digest("hex"),
  };
}

describe("booking public API", () => {
  it("serves health, configuration, quote and hold", async () => {
    const { repo, calls } = repository();
    const app = createBookingApp({ repository: repo, now: () => now });
    expect((await app.inject({ url: "/health" })).statusCode).toBe(200);
    expect(
      (await app.inject({ url: "/public/hotels/demo/booking-config" }))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/public/hotels/demo/quotes",
          payload: quoteBody,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/public/hotels/demo/holds",
          payload: holdBody,
        })
      ).statusCode,
    ).toBe(201);
    expect(calls.some(([name]) => name === "create_public_booking_hold")).toBe(
      true,
    );
    await app.close();
  });

  it("returns generic conflicts and rate limits", async () => {
    const cases = [
      ["consume_public_rate_limit", 429, "quote"],
      ["quote_public_booking", 409, "quote"],
      ["create_public_booking_hold", 409, "hold"],
      ["get_public_booking_configuration", 404, "config"],
    ] as const;
    for (const [name, status, endpoint] of cases) {
      const { repo } = repository({
        [name]:
          name === "get_public_booking_configuration"
            ? "missing"
            : name === "consume_public_rate_limit"
              ? "limited"
              : "conflict",
      });
      const app = createBookingApp({ repository: repo, now: () => now });
      const response =
        endpoint === "hold"
          ? await app.inject({
              method: "POST",
              url: "/public/hotels/demo/holds",
              payload: holdBody,
            })
          : endpoint === "quote"
            ? await app.inject({
                method: "POST",
                url: "/public/hotels/demo/quotes",
                payload: quoteBody,
              })
            : await app.inject({ url: "/public/hotels/demo/booking-config" });
      expect(response.statusCode).toBe(status);
      await app.close();
    }
  });

  it("covers not-found and access failure responses", async () => {
    const holdLimited = repository({ consume_public_rate_limit: "limited" });
    const app = createBookingApp({
      repository: holdLimited.repo,
      now: () => now,
    });
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/public/hotels/demo/holds",
          payload: holdBody,
        })
      ).statusCode,
    ).toBe(429);
    await app.close();
    for (const [operation, endpoint, payload] of [
      ["quote_public_booking", "/public/hotels/demo/quotes", quoteBody],
      ["create_public_booking_hold", "/public/hotels/demo/holds", holdBody],
    ] as const) {
      const current = repository({ [operation]: "not_found" });
      const instance = createBookingApp({
        repository: current.repo,
        now: () => now,
      });
      expect(
        (await instance.inject({ method: "POST", url: endpoint, payload }))
          .statusCode,
      ).toBe(404);
      await instance.close();
    }
    const invalid = repository({ submit_prearrival: "invalid" });
    const prearrival = createBookingApp({
      repository: invalid.repo,
      now: () => now,
    });
    expect(
      (
        await prearrival.inject({
          method: "POST",
          url: "/public/booking-access/token/prearrival",
          payload: { expected_version: 1 },
        })
      ).statusCode,
    ).toBe(404);
    await prearrival.close();
  });

  it("handles secure prearrival without exposing existence", async () => {
    const { repo } = repository();
    const app = createBookingApp({ repository: repo, now: () => now });
    expect(
      (await app.inject({ url: "/public/booking-access/token" })).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/public/booking-access/token/prearrival",
          payload: { expected_version: 1, arrival_time: "14:30" },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/public/booking-access/token/change-requests",
          payload: { type: "amendment", description: "Chegar um dia depois" },
        })
      ).statusCode,
    ).toBe(201);
    await app.close();

    const missing = repository({
      resolve_prearrival_token: "missing",
      submit_prearrival: "conflict",
      create_prearrival_change_request: "invalid",
    });
    const unavailable = createBookingApp({
      repository: missing.repo,
      now: () => now,
    });
    expect(
      (await unavailable.inject({ url: "/public/booking-access/token" }))
        .statusCode,
    ).toBe(404);
    expect(
      (
        await unavailable.inject({
          method: "POST",
          url: "/public/booking-access/token/prearrival",
          payload: { expected_version: 1 },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await unavailable.inject({
          method: "POST",
          url: "/public/booking-access/token/change-requests",
          payload: { type: "cancellation", description: "Mudança de planos" },
        })
      ).statusCode,
    ).toBe(404);
    await unavailable.close();
  });

  it("authenticates channel events, inventory and acknowledgements", async () => {
    const { repo } = repository();
    const app = createBookingApp({ repository: repo, now: () => now });
    const event = {
      event_id: "evt-1",
      event_type: "create",
      external_reservation_id: "ext-1",
      occurred_at: now.toISOString(),
      reservation: {
        room_code: "STD",
        rate_code: "FLEX",
        checkin_date: "2026-10-10",
        checkout_date: "2026-10-12",
        adults: 2,
        children: 0,
        currency: "BRL",
        total: 500,
        guest_name: "Maria Silva",
      },
    };
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/channels/channel/events",
          headers: sign(event),
          payload: event,
        })
      ).statusCode,
    ).toBe(202);
    const conflicting = repository({
      ingest_booking_channel_event: "idempotency_conflict",
    });
    const conflictApp = createBookingApp({
      repository: conflicting.repo,
      now: () => now,
    });
    expect(
      (
        await conflictApp.inject({
          method: "POST",
          url: "/channels/channel/events",
          headers: sign(event),
          payload: event,
        })
      ).statusCode,
    ).toBe(409);
    await conflictApp.close();
    expect(
      (
        await app.inject({
          url: "/channels/channel/inventory",
          headers: sign(null),
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          url: "/channels/channel/inventory",
          headers: {
            "x-channel-timestamp": String(now.getTime()),
            "x-channel-signature": "bad",
          },
        })
      ).statusCode,
    ).toBe(401);
    const ack = { feed_version: "1" };
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/channels/channel/acknowledgements",
          headers: sign(ack),
          payload: ack,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/channels/channel/acknowledgements",
          headers: {
            "x-channel-timestamp": String(now.getTime()),
            "x-channel-signature": "bad",
          },
          payload: ack,
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/channels/channel/events",
          headers: sign(event, "0"),
          payload: event,
        })
      ).statusCode,
    ).toBe(401);
    await app.close();
  });

  it("validates security helpers", () => {
    expect(bookingSecurity.normalizeOrigin(" HTTPS://EXAMPLE.COM/ ")).toBe(
      "https://example.com",
    );
    expect(
      bookingSecurity.signatureIsValid(
        "x",
        String(now.getTime()),
        {},
        "bad",
        now,
      ),
    ).toBe(false);
    expect(
      bookingSecurity.requestIdentifier({
        ip: "127.0.0.1",
        headers: {},
      } as never),
    ).toHaveLength(64);
    expect(
      bookingSecurity.signatureIsValid("x", "invalid", {}, "bad", now),
    ).toBe(false);
    const timestamp = String(now.getTime());
    const signature = createHmac("sha256", "digest")
      .update(`${timestamp}.${JSON.stringify(null)}`)
      .digest("hex");
    expect(
      bookingSecurity.signatureIsValid(
        "digest",
        timestamp,
        null,
        signature,
        now,
      ),
    ).toBe(true);
    expect(
      bookingSecurity.signatureIsValid(
        "digest",
        String(now.getTime() - 600_000),
        null,
        signature,
        now,
      ),
    ).toBe(false);
  });

  it("restricts browser origins", async () => {
    const { repo } = repository();
    const app = createBookingApp({
      repository: repo,
      now: () => now,
      allowedOrigins: ["HTTPS://SITE.EXAMPLE/"],
    });
    const allowed = await app.inject({
      url: "/health",
      headers: { origin: "https://site.example" },
    });
    expect(allowed.headers["access-control-allow-origin"]).toBe(
      "https://site.example",
    );
    const denied = await app.inject({
      url: "/health",
      headers: { origin: "https://other.example" },
    });
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
    await app.close();
  });

  it("uses safe defaults for time, origins and non-object results", async () => {
    process.env.ALLOWED_ORIGINS = "http://one.example,http://two.example";
    const repo: BookingRepository = {
      async call(name) {
        if (name === "consume_public_rate_limit") return { result: "ok" };
        if (name === "quote_public_booking") return {};
        return null;
      },
    };
    const app = createBookingApp({ repository: repo });
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/public/hotels/demo/quotes",
          payload: quoteBody,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          url: "/health",
          headers: { origin: "http://one.example" },
        })
      ).headers["access-control-allow-origin"],
    ).toBe("http://one.example");
    await app.close();
    delete process.env.ALLOWED_ORIGINS;
    const primitive = createBookingApp({
      repository: {
        async call(name) {
          return name === "consume_public_rate_limit" ? { result: "ok" } : "ok";
        },
      },
      now: () => now,
    });
    expect(
      (
        await primitive.inject({
          method: "POST",
          url: "/public/hotels/demo/quotes",
          payload: quoteBody,
        })
      ).statusCode,
    ).toBe(200);
    await primitive.close();
    const fallback = createBookingApp({
      repository: repository().repo,
      allowedOrigins: [],
    });
    expect(
      (
        await fallback.inject({
          url: "/health",
          headers: { origin: "http://localhost:3000" },
        })
      ).headers["access-control-allow-origin"],
    ).toBe("http://localhost:3000");
    await fallback.close();
  });

  it("rejects inactive, missing and incomplete channel credentials", async () => {
    const event = {
      event_id: "evt-1",
      event_type: "cancel",
      external_reservation_id: "external",
      occurred_at: now.toISOString(),
      reservation: {
        room_code: "STD",
        rate_code: "FLEX",
        checkin_date: "2026-10-10",
        checkout_date: "2026-10-12",
        adults: 1,
        children: 0,
        currency: "BRL",
        total: 10,
        guest_name: "Maria",
      },
    };
    for (const state of ["inactive", "missing", "no_digest"] as const) {
      const app = createBookingApp({
        repository: repository({ resolve_booking_channel: state }).repo,
        now: () => now,
      });
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/channels/channel/events",
            headers: sign(event),
            payload: event,
          })
        ).statusCode,
      ).toBe(401);
      await app.close();
    }
    const app = createBookingApp({
      repository: repository().repo,
      now: () => now,
    });
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/channels/channel/events",
          payload: event,
        })
      ).statusCode,
    ).toBe(401);
    await app.close();
  });
});
