import http from "node:http";

const port = Number(process.env.PUBLIC_E2E_API_PORT || 4333);
function json(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "http://127.0.0.1:3000",
  });
  response.end(JSON.stringify(body));
}
const server = http.createServer((request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "access-control-allow-origin": "http://127.0.0.1:3000",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    });
    response.end();
    return;
  }
  if (request.url === "/health") return json(response, 200, { status: "ok" });
  if (request.url === "/public/hotels/hotel-aurora/booking-config")
    return json(response, 200, {
      hotel: { name: "Hotel Aurora", city: "São Paulo", currency: "BRL" },
      configuration: {
        introduction: "Reserve diretamente com o hotel.",
        terms: "Termos da reserva direta.",
        consent_version: "v1",
        guarantee_instructions: "O sinal será conferido pela recepção.",
      },
    });
  if (request.url === "/public/hotels/hotel-aurora/quotes")
    return json(response, 200, {
      quote_id: "quote",
      fingerprint: "fingerprint",
      expires_at: "2026-10-10T18:00:00Z",
      currency: "BRL",
      items: [
        {
          id: "item",
          room_index: 1,
          room_type: "Standard",
          plan_name: "Flexível",
          rate_plan_version_id: "rate",
          available_count: 2,
          total: 420,
          nightly: [],
          guarantee: { type: "first_night", value: 0 },
          cancellation: { type: "percentage", value: 50, cutoff_hours: 24 },
        },
      ],
    });
  if (request.url === "/public/hotels/hotel-aurora/holds")
    return json(response, 201, {
      reservation_code: "WEB-123",
      expires_at: "2026-10-10T18:00:00Z",
      access_token: "access",
    });
  if (request.url === "/public/booking-access/access")
    return json(response, 200, {
      reservation: {
        reservation_code: "WEB-123",
        version: 1,
        lifecycle_status: "hold",
      },
      accommodations: [
        {
          id: "accommodation",
          room_type: "Standard",
          check_date: "2026-10-10",
          checkin_date: "2026-10-10",
          checkout_date: "2026-10-12",
        },
      ],
      requests: [],
    });
  if (request.url?.startsWith("/public/booking-access/access/"))
    return json(response, 200, { result: "ok" });
  return json(response, 404, { error: "not_found" });
});
server.listen(port, "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close(() => process.exit(0)));
