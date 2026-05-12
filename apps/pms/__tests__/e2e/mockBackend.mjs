import http from "node:http";

const port = Number(process.env.PMS_E2E_BACKEND_PORT || 4334);
const permissions = [
  "read_hotel",
  "read_room",
  "read_customer",
  "access_reservations_calendar",
  "create_transactions",
  "read_transactions",
  "update_transactions",
  "delete_transactions"
];

const user = {
  id: "user-e2e",
  name: "Marina Costa",
  email: "marina@example.com",
  tenantId: "tenant-e2e",
  roles: ["Gerente"],
  permissions,
  roleAssignments: [
    {
      roleId: "role-e2e",
      roleName: "Gerente",
      roleType: "HOTEL_ROLE",
      hotelId: "hotel-e2e",
      hotelName: "Hotel Demo",
      permissions
    }
  ]
};

const customers = [
  {
    id: "customer-1",
    hotel_id: "hotel-e2e",
    full_name: "Ana Paula Ribeiro",
    document_number: "11122233344",
    document_type: "cpf",
    email: "ana@example.com",
    mobile_phone: "11999990000",
    phone: null,
    birth_date: "1990-03-10",
    nationality: "BR",
    notes: null,
    created_at: "2026-05-01T10:00:00.000Z",
    updated_at: "2026-05-01T10:00:00.000Z"
  },
  {
    id: "customer-2",
    hotel_id: "hotel-e2e",
    full_name: "Bruno Lima",
    document_number: "55566677788",
    document_type: "cpf",
    email: "bruno@example.com",
    mobile_phone: "11888880000",
    phone: null,
    birth_date: "1988-07-22",
    nationality: "BR",
    notes: null,
    created_at: "2026-05-02T10:00:00.000Z",
    updated_at: "2026-05-02T10:00:00.000Z"
  }
];

const transactions = [
  {
    id: "transaction-1",
    hotel_id: "hotel-e2e",
    type: "INCOME",
    category: "Hospedagem",
    amount: 1280,
    currency: "BRL",
    description: "Reserva RES-1001",
    status: "COMPLETED",
    stay_id: "stay-1",
    reservation_id: "reservation-1",
    payment_method: "pix",
    paid_at: "2026-05-10T12:00:00.000Z",
    due_date: "2026-05-10",
    counterparty: "Ana Paula Ribeiro",
    cost_center: "Recepcao",
    reference_code: "RES-1001",
    created_by: "user-e2e",
    created_at: "2026-05-10T10:00:00.000Z",
    updated_at: "2026-05-10T12:00:00.000Z"
  },
  {
    id: "transaction-2",
    hotel_id: "hotel-e2e",
    type: "EXPENSE",
    category: "Energia eletrica",
    amount: 640,
    currency: "BRL",
    description: "Conta mensal",
    status: "PENDING",
    stay_id: null,
    reservation_id: null,
    payment_method: "bank_transfer",
    paid_at: null,
    due_date: "2026-05-15",
    counterparty: "Companhia de Energia",
    cost_center: "Operacao",
    reference_code: "ENE-0526",
    created_by: "user-e2e",
    created_at: "2026-05-08T10:00:00.000Z",
    updated_at: "2026-05-08T10:00:00.000Z"
  },
  {
    id: "transaction-3",
    hotel_id: "hotel-e2e",
    type: "EXPENSE",
    category: "Lavanderia",
    amount: 320,
    currency: "BRL",
    description: "Enxoval",
    status: "PENDING",
    stay_id: null,
    reservation_id: null,
    payment_method: "card",
    paid_at: null,
    due_date: "2026-05-09",
    counterparty: "Lavanderia Central",
    cost_center: "Governanca",
    reference_code: "LAV-0526",
    created_by: "user-e2e",
    created_at: "2026-05-08T10:00:00.000Z",
    updated_at: "2026-05-08T10:00:00.000Z"
  }
];

function addDaysIso(date, offset) {
  const current = new Date(`${date}T00:00:00.000Z`);
  current.setUTCDate(current.getUTCDate() + offset);
  return current.toISOString().slice(0, 10);
}

function buildDays(startDate, count) {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    timeZone: "UTC"
  });

  return Array.from({ length: count }, (_, index) => {
    const date = addDaysIso(startDate, index);
    return {
      date,
      day_number: Number(date.slice(-2)),
      weekday_short: formatter.format(new Date(`${date}T00:00:00.000Z`)).replace(".", "")
    };
  });
}

function buildCalendar(url) {
  const startDate = url.searchParams.get("start_date") || "2026-05-12";
  const daysCount = Number(url.searchParams.get("days") || 20);
  const days = buildDays(startDate, daysCount);
  const stayOneStart = addDaysIso(startDate, 1);
  const stayOneEnd = addDaysIso(startDate, 4);
  const stayTwoStart = addDaysIso(startDate, 3);
  const stayTwoEnd = addDaysIso(startDate, 6);

  return {
    window_start: days[0]?.date || startDate,
    window_end: days[days.length - 1]?.date || startDate,
    days,
    rooms: [
      { room_id: "room-101", room_number: "101", room_type: "Suite Luxo", max_occupancy: 2 },
      { room_id: "room-102", room_number: "102", room_type: "Standard", max_occupancy: 2 },
      { room_id: "room-201", room_number: "201", room_type: "Familia", max_occupancy: 4 }
    ],
    stays: [
      {
        id: "stay-1",
        room_id: "room-101",
        reservation_id: "reservation-1",
        reservation_code: "RES-1001",
        stay_status: "confirmed",
        total_price_estimated: 1280,
        total_paid: 640,
        stay_payment_status: "partial",
        customer_name: "Ana Paula Ribeiro",
        checkin_date_expected: stayOneStart,
        checkout_date_expected: stayOneEnd,
        start_date: stayOneStart,
        end_date: stayOneEnd,
        start_half: "right",
        end_half: "left"
      },
      {
        id: "stay-2",
        room_id: "room-102",
        reservation_id: "reservation-2",
        reservation_code: "RES-1002",
        stay_status: "checked_in",
        total_price_estimated: 960,
        total_paid: 960,
        stay_payment_status: "paid",
        customer_name: "Bruno Lima",
        checkin_date_expected: stayTwoStart,
        checkout_date_expected: stayTwoEnd,
        start_date: stayTwoStart,
        end_date: stayTwoEnd,
        start_half: "right",
        end_half: "left"
      }
    ],
    blocks: [
      {
        id: "block-1",
        room_id: "room-201",
        label: "Manutencao preventiva",
        status: "maintenance",
        start_date: addDaysIso(startDate, 5),
        end_date: addDaysIso(startDate, 6)
      }
    ],
    legend: []
  };
}

function buildPanel(stayId) {
  const isSecondStay = stayId === "stay-2";
  const total = isSecondStay ? 960 : 1280;
  const paid = isSecondStay ? 960 : 640;

  return {
    stay: {
      id: stayId,
      reservation_id: isSecondStay ? "reservation-2" : "reservation-1",
      reservation_code: isSecondStay ? "RES-1002" : "RES-1001",
      room_id: isSecondStay ? "room-102" : "room-101",
      room_number: isSecondStay ? "102" : "101",
      room_type: isSecondStay ? "Standard" : "Suite Luxo",
      customer_name: isSecondStay ? "Bruno Lima" : "Ana Paula Ribeiro",
      stay_status: isSecondStay ? "checked_in" : "confirmed",
      checkin_date_expected: isSecondStay ? "2026-05-15" : "2026-05-13",
      checkout_date_expected: isSecondStay ? "2026-05-18" : "2026-05-16",
      checkin_date_actual: isSecondStay ? "2026-05-15T14:30:00.000Z" : null,
      checkout_date_actual: null,
      total_price_estimated: total,
      total_paid: paid,
      stay_payment_status: paid >= total ? "paid" : "partial"
    },
    reservation: {
      id: isSecondStay ? "reservation-2" : "reservation-1",
      code: isSecondStay ? "RES-1002" : "RES-1001",
      total_due: total,
      total_paid: paid,
      payment_status: paid >= total ? "paid" : "partial"
    },
    hotel: {
      id: "hotel-e2e",
      timezone: "America/Sao_Paulo",
      checkin_time_start: "14:00",
      checkin_time_limit: "22:00",
      checkout_time_start: "08:00",
      checkout_time_limit: "12:00"
    },
    eligibility: {
      can_checkin: !isSecondStay,
      checkin_block_reason: isSecondStay ? "Estadia ja em check-in." : null,
      can_checkout: isSecondStay,
      checkout_block_reason: isSecondStay ? null : "Check-in ainda nao realizado.",
      can_no_show: !isSecondStay,
      no_show_block_reason: null,
      can_cancel: true,
      cancel_block_reason: null
    },
    payments: [
      {
        id: "payment-1",
        stay_id: stayId,
        amount: paid,
        method: isSecondStay ? "pix" : "card",
        note: null,
        paid_at: "2026-05-12T12:00:00.000Z",
        created_at: "2026-05-12T12:00:00.000Z",
        created_by: "user-e2e"
      }
    ]
  };
}

async function parseBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || `127.0.0.1:${port}`}`);
  const method = request.method || "GET";

  if (method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (method === "GET" && url.pathname === "/auth/me") {
    sendJson(response, 200, { user });
    return;
  }

  if (method === "GET" && url.pathname === "/admin/customers") {
    sendJson(response, 200, { items: customers });
    return;
  }

  if (method === "GET" && url.pathname === "/admin/financial-transactions") {
    sendJson(response, 200, { items: transactions });
    return;
  }

  if (method === "GET" && url.pathname === "/admin/reservations/calendar") {
    sendJson(response, 200, buildCalendar(url));
    return;
  }

  if (method === "POST" && url.pathname === "/admin/reservations/calendar/booking/simulate") {
    const body = await parseBody(request);
    const selectedCount = Array.isArray(body.selected_cells) ? body.selected_cells.length : 0;
    sendJson(response, 200, {
      item: {
        reservation_id: "reservation-preview",
        reservation_code: "PREVIEW",
        customer_id: "customer-1",
        stay_ids: [],
        total_price: selectedCount * 180,
        nights_count: selectedCount,
        rooms_count: new Set((body.selected_cells || []).map((cell) => cell.room_id)).size,
        breakdown: []
      }
    });
    return;
  }

  if (method === "POST" && url.pathname === "/admin/reservations/calendar/booking") {
    const body = await parseBody(request);
    const selectedCount = Array.isArray(body.selected_cells) ? body.selected_cells.length : 0;
    sendJson(response, 200, {
      item: {
        reservation_id: "reservation-created",
        reservation_code: "RES-NEW",
        customer_id: "customer-1",
        stay_ids: ["stay-created"],
        total_price: selectedCount * 180,
        nights_count: selectedCount,
        rooms_count: new Set((body.selected_cells || []).map((cell) => cell.room_id)).size,
        breakdown: []
      }
    });
    return;
  }

  const stayPanelMatch = url.pathname.match(/^\/admin\/stays\/([^/]+)\/panel$/);
  if (method === "GET" && stayPanelMatch) {
    sendJson(response, 200, { item: buildPanel(stayPanelMatch[1]) });
    return;
  }

  const stayActionMatch = url.pathname.match(/^\/admin\/stays\/([^/]+)\/(payments|checkin|checkout|no-show|cancel)$/);
  if (method === "POST" && stayActionMatch) {
    await parseBody(request);
    sendJson(response, 200, { item: buildPanel(stayActionMatch[1]) });
    return;
  }

  sendJson(response, 404, { message: `No mock route for ${method} ${url.pathname}` });
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`PMS e2e mock backend running at http://127.0.0.1:${port}\n`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
