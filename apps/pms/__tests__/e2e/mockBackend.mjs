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
  "delete_transactions",
];
const maintenancePermissions = [
  ...permissions,
  "create_maintenance_occurrence",
  "read_maintenance",
  "triage_maintenance",
  "execute_maintenance",
  "manage_maintenance_blocks",
  "inspect_maintenance",
  "confirm_damage_liability",
  "manage_maintenance_catalogs",
  "read_maintenance_finance",
  "propose_maintenance_finance",
  "approve_maintenance_finance",
  "settle_maintenance_finance",
  "manage_maintenance_plans",
  "manage_maintenance_sla",
  "manage_maintenance_suppliers",
  "read_maintenance_analytics",
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
      permissions,
    },
  ],
};
const maintenanceUser = {
  ...user,
  permissions: maintenancePermissions,
  roleAssignments: user.roleAssignments.map((assignment) => ({
    ...assignment,
    permissions: maintenancePermissions,
  })),
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
    updated_at: "2026-05-01T10:00:00.000Z",
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
    updated_at: "2026-05-02T10:00:00.000Z",
  },
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
    cost_center: "Recepção",
    reference_code: "RES-1001",
    created_by: "user-e2e",
    created_at: "2026-05-10T10:00:00.000Z",
    updated_at: "2026-05-10T12:00:00.000Z",
  },
  {
    id: "transaction-2",
    hotel_id: "hotel-e2e",
    type: "EXPENSE",
    category: "Energia elétrica",
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
    cost_center: "Operação",
    reference_code: "ENE-0526",
    created_by: "user-e2e",
    created_at: "2026-05-08T10:00:00.000Z",
    updated_at: "2026-05-08T10:00:00.000Z",
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
    cost_center: "Governança",
    reference_code: "LAV-0526",
    created_by: "user-e2e",
    created_at: "2026-05-08T10:00:00.000Z",
    updated_at: "2026-05-08T10:00:00.000Z",
  },
];

function addDaysIso(date, offset) {
  const current = new Date(`${date}T00:00:00.000Z`);
  current.setUTCDate(current.getUTCDate() + offset);
  return current.toISOString().slice(0, 10);
}

function buildDays(startDate, count) {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    timeZone: "UTC",
  });

  return Array.from({ length: count }, (_, index) => {
    const date = addDaysIso(startDate, index);
    return {
      date,
      day_number: Number(date.slice(-2)),
      weekday_short: formatter
        .format(new Date(`${date}T00:00:00.000Z`))
        .replace(".", ""),
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
      {
        room_id: "room-101",
        room_number: "101",
        room_type: "Suite Luxo",
        max_occupancy: 2,
      },
      {
        room_id: "room-102",
        room_number: "102",
        room_type: "Standard",
        max_occupancy: 2,
      },
      {
        room_id: "room-201",
        room_number: "201",
        room_type: "Familia",
        max_occupancy: 4,
      },
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
        end_half: "left",
      },
      {
        id: "stay-2",
        room_id: "room-102",
        reservation_id: "reservation-2",
        reservation_code: "RES-1002",
        stay_status: "checked_in",
        total_price_estimated: 960,
        total_paid: 600,
        stay_payment_status: "partial",
        customer_name: "Bruno Lima",
        checkin_date_expected: stayTwoStart,
        checkout_date_expected: stayTwoEnd,
        start_date: stayTwoStart,
        end_date: stayTwoEnd,
        start_half: "right",
        end_half: "left",
      },
    ],
    blocks: [
      {
        id: "block-1",
        room_id: "room-201",
        label: "Manutenção preventiva",
        status: "maintenance",
        start_date: addDaysIso(startDate, 5),
        end_date: addDaysIso(startDate, 6),
      },
    ],
    legend: [],
  };
}

function buildPanel(stayId, options = {}) {
  const isSecondStay = stayId === "stay-2";
  const total = isSecondStay ? 960 : 1280;
  const paid = options.paid ?? (isSecondStay ? 600 : 640);
  const stayStatus =
    options.status || (isSecondStay ? "checked_in" : "confirmed");

  return {
    stay: {
      id: stayId,
      reservation_id: isSecondStay ? "reservation-2" : "reservation-1",
      reservation_code: isSecondStay ? "RES-1002" : "RES-1001",
      room_id: isSecondStay ? "room-102" : "room-101",
      room_number: isSecondStay ? "102" : "101",
      room_type: isSecondStay ? "Standard" : "Suite Luxo",
      customer_name: isSecondStay ? "Bruno Lima" : "Ana Paula Ribeiro",
      stay_status: stayStatus,
      checkin_date_expected: isSecondStay ? "2026-05-15" : "2026-05-13",
      checkout_date_expected: isSecondStay ? "2026-05-18" : "2026-05-16",
      checkin_date_actual: isSecondStay ? "2026-05-15T14:30:00.000Z" : null,
      checkout_date_actual:
        stayStatus === "checked_out" ? "2026-05-18T11:20:00.000Z" : null,
      total_price_estimated: total,
      total_paid: paid,
      stay_payment_status: paid >= total ? "paid" : "partial",
    },
    reservation: {
      id: isSecondStay ? "reservation-2" : "reservation-1",
      code: isSecondStay ? "RES-1002" : "RES-1001",
      total_due: total,
      total_paid: paid,
      payment_status: paid >= total ? "paid" : "partial",
    },
    hotel: {
      id: "hotel-e2e",
      timezone: "America/Sao_Paulo",
      checkin_time_start: "14:00",
      checkin_time_limit: "22:00",
      checkout_time_start: "08:00",
      checkout_time_limit: "12:00",
    },
    eligibility: {
      can_checkin: !isSecondStay && stayStatus === "confirmed",
      checkin_block_reason: isSecondStay ? "Estadia ja em check-in." : null,
      can_checkout: isSecondStay && stayStatus === "checked_in",
      checkout_block_reason:
        isSecondStay && stayStatus === "checked_in"
          ? null
          : "A estadia precisa estar em checked_in para checkout.",
      can_no_show: !isSecondStay && stayStatus === "confirmed",
      no_show_block_reason: null,
      can_cancel: stayStatus === "confirmed",
      cancel_block_reason:
        stayStatus === "confirmed"
          ? null
          : "Cancelamento permitido apenas para estadia confirmada.",
    },
    payments:
      paid > 0
        ? [
            {
              id: "payment-1",
              stay_id: stayId,
              amount: paid,
              method: isSecondStay ? "pix" : "card",
              note: null,
              paid_at: "2026-05-12T12:00:00.000Z",
              created_at: "2026-05-12T12:00:00.000Z",
              created_by: "user-e2e",
            },
          ]
        : [],
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
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

const server = http.createServer(async (request, response) => {
  const url = new URL(
    request.url || "/",
    `http://${request.headers.host || `127.0.0.1:${port}`}`,
  );
  const method = request.method || "GET";

  if (method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (method === "GET" && url.pathname === "/auth/me") {
    sendJson(response, 200, {
      user:
        request.headers.authorization === "Bearer maintenance-e2e-token"
          ? maintenanceUser
          : user,
    });
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

  if (method === "GET" && url.pathname === "/admin/maintenance/summary") {
    sendJson(response, 200, {
      open: 3,
      assigned_to_me: 1,
      unassigned: 1,
      overdue: 1,
      awaiting_inspection: 1,
      blocked_rooms: 1,
    });
    return;
  }

  if (
    method === "GET" &&
    url.pathname === "/admin/maintenance/reference-data"
  ) {
    sendJson(response, 200, {
      rooms: [{ id: "room-101", room_number: "101", status: "available" }],
      locations: [
        {
          id: "location-equipment",
          name: "Gerador principal",
          kind: "equipment",
          parent_location_id: null,
          is_active: true,
          asset_tag: "AT-001",
          manufacturer: "Demo",
          model: "GX",
          serial_number: "SN-1",
          installed_on: "2025-01-01",
          warranty_ends_on: "2026-09-30",
          supplier_id: "supplier-e2e",
          contract_id: "contract-e2e",
          lifecycle_status: "active",
        },
      ],
      categories: [
        {
          id: "category-1",
          name: "Elétrica",
          description: null,
          display_order: 1,
          is_active: true,
        },
      ],
      assignable_users: [
        { id: "user-e2e", name: "Marina Costa", email: "marina@example.com" },
      ],
    });
    return;
  }

  if (
    method === "GET" &&
    url.pathname === "/admin/maintenance/preventive-plans"
  ) {
    sendJson(response, 200, {
      items: [
        {
          id: "plan-e2e",
          hotel_id: "hotel-e2e",
          name: "Revisão mensal do gerador",
          category_id: "category-1",
          room_id: null,
          location_id: "location-equipment",
          assigned_to: "user-e2e",
          supplier_id: "supplier-e2e",
          contract_id: "contract-e2e",
          priority: "high",
          instructions: "Verificar alimentação e partida.",
          requires_inspection: true,
          blocking_recommended: false,
          recurrence_unit: "monthly",
          recurrence_interval: 1,
          starts_on: "2026-05-01",
          ends_on: null,
          local_time: "09:00:00",
          generation_lead_days: 2,
          completion_due_hours: 24,
          tasks: [
            {
              id: "task-e2e",
              position: 0,
              description: "Testar partida",
              is_required: true,
            },
          ],
          recurrence_day: 1,
          next_due_date: "2026-06-01",
          status: "active",
          category_name: "Elétrica",
          target_name: "Gerador principal",
          assignee_name: "Marina Costa",
          supplier_name: "Manutenção Demo",
          contract_number: "CT-001",
          created_at: "2026-05-01T10:00:00.000Z",
          updated_at: "2026-05-01T10:00:00.000Z",
        },
      ],
    });
    return;
  }

  if (
    method === "GET" &&
    url.pathname === "/admin/maintenance/preventive-plans/plan-e2e/runs"
  ) {
    sendJson(response, 200, {
      items: [
        {
          id: "run-e2e",
          plan_id: "plan-e2e",
          scheduled_for: "2026-05-01T12:00:00.000Z",
          scheduled_local_date: "2026-05-01",
          status: "deferred",
          occurrence_id: null,
          work_order_id: null,
          snapshot: {},
          decision_reason: null,
          rescheduled_for: null,
          created_at: "2026-05-01T07:00:00.000Z",
        },
      ],
    });
    return;
  }

  if (method === "GET" && url.pathname === "/admin/maintenance/suppliers") {
    sendJson(response, 200, {
      items: [
        {
          id: "supplier-e2e",
          hotel_id: "hotel-e2e",
          name: "Manutenção Demo",
          legal_name: null,
          tax_document: null,
          email: "contato@example.com",
          phone: null,
          specialties: ["Elétrica"],
          notes: null,
          status: "active",
          contacts: [],
          contracts: [
            {
              id: "contract-e2e",
              supplier_id: "supplier-e2e",
              contract_number: "CT-001",
              kind: "fixed",
              status: "active",
              starts_on: "2026-01-01",
              ends_on: "2026-12-31",
              renewal_notice_on: null,
              scope_notes: "Gerador",
              response_hours: 4,
              resolution_hours: 24,
              commercial_terms: "Mensal",
              contract_amount: 500,
              currency: "BRL",
              category_ids: ["category-1"],
              location_ids: ["location-equipment"],
              documents: [],
              created_at: "2026-01-01T10:00:00.000Z",
              updated_at: "2026-01-01T10:00:00.000Z",
            },
          ],
          documents: [],
          created_at: "2026-01-01T10:00:00.000Z",
          updated_at: "2026-01-01T10:00:00.000Z",
        },
      ],
    });
    return;
  }

  if (method === "GET" && url.pathname === "/admin/maintenance/analytics") {
    sendJson(response, 200, {
      filters: Object.fromEntries(url.searchParams),
      backlog: 3,
      critical_open: 1,
      average_triage_hours: 1.5,
      average_resolution_hours: 18,
      sla_compliance_rate: 80,
      preventive_compliance_rate: 90,
      recurring_occurrences: 1,
      blocked_room_days: 2.5,
      supplier_completion_rate: 75,
      aging: [
        { bucket: "0-1 dia", count: 2 },
        { bucket: "2-7 dias", count: 1 },
      ],
      series: [{ date: "2026-05-12", opened: 2, resolved: 1 }],
      financial: {
        approved_cost: 1980,
        approved_recovery: 100,
        net_result: -1880,
        currency: "BRL",
      },
    });
    return;
  }

  if (
    method === "GET" &&
    url.pathname === "/admin/maintenance/analytics/export-data"
  ) {
    sendJson(response, 200, {
      items: [
        {
          code: "OCO-001001",
          kind: "preventive",
          priority: "high",
          status: "in_progress",
          category: "Elétrica",
          target: "Gerador principal",
        },
      ],
    });
    return;
  }

  if (
    method === "GET" &&
    url.pathname === "/admin/maintenance/notifications/summary"
  ) {
    sendJson(response, 200, { unread: 2 });
    return;
  }

  if (method === "GET" && url.pathname === "/admin/maintenance/notifications") {
    sendJson(response, 200, {
      items: [
        {
          id: "notification-e2e",
          kind: "sla_resolution",
          severity: "critical",
          title: "SLA de resolução violado",
          message: "A ocorrência OCO-001001 ultrapassou o prazo.",
          href: "/dashboard/maintenance/occurrences/97000000-0000-4000-8000-000000000001",
          entity_type: "occurrence",
          entity_id: "97000000-0000-4000-8000-000000000001",
          status: "unread",
          created_at: "2026-05-12T14:00:00.000Z",
        },
      ],
    });
    return;
  }

  if (
    method === "POST" &&
    (url.pathname.includes("/admin/maintenance/preventive-runs/") ||
      url.pathname.includes("/admin/maintenance/notifications/"))
  ) {
    sendJson(response, 200, { item: {}, ok: true, updated: 1 });
    return;
  }

  if (
    method === "GET" &&
    url.pathname === "/admin/maintenance/finance/summary"
  ) {
    sendJson(response, 200, {
      currency: "BRL",
      awaiting_approval: 1,
      payable: 1,
      receivable: 1,
      overdue: 0,
      settled: 2,
      payable_amount: 1980,
      receivable_amount: 100,
    });
    return;
  }

  if (method === "GET" && url.pathname === "/admin/maintenance/finance/items") {
    sendJson(response, 200, {
      page: 1,
      page_size: 25,
      total: 1,
      items: [
        {
          id: "99000000-0000-4000-8000-000000000001",
          occurrence_id: "97000000-0000-4000-8000-000000000001",
          occurrence_code: "OCO-001001",
          work_order_id: null,
          kind: "material",
          description: "Substituição do televisor danificado",
          quantity: 1,
          estimated_amount: 2200,
          actual_amount: 1980,
          currency: "BRL",
          counterparty: "Fornecedor Demo",
          due_date: "2026-09-10",
          reference_code: "ORC-001",
          approval_status: "submitted",
          settlement_status: "not_posted",
          created_by: "technician-e2e",
          proposer_name: "Técnico Demo",
          submitted_at: "2026-05-12T12:00:00.000Z",
          approved_by: null,
          approved_at: null,
          decision_reason: null,
          settled_amount: 0,
          outstanding_amount: 1980,
          settlements: [],
          attachments: [],
          created_at: "2026-05-12T10:00:00.000Z",
          updated_at: "2026-05-12T12:00:00.000Z",
        },
      ],
    });
    return;
  }

  if (method === "GET" && url.pathname === "/admin/maintenance/occurrences") {
    sendJson(response, 200, {
      page: 1,
      page_size: 20,
      total: 2,
      items: [
        {
          id: "97000000-0000-4000-8000-000000000001",
          occurrence_number: 1001,
          code: "OCO-001001",
          kind: "damage",
          priority: "critical",
          status: "awaiting_inspection",
          description: "Televisor com a tela danificada",
          category_id: "category-1",
          category_name: "Eletrônicos",
          room_id: "room-102",
          room_number: "102",
          location_id: null,
          location_name: null,
          stay_id: "stay-2",
          reported_by: "user-e2e",
          reporter_name: "Marina Costa",
          blocking_recommended: true,
          liability_status: "suspected",
          active_block: true,
          open_work_orders: 1,
          created_at: "2026-05-12T10:00:00.000Z",
          updated_at: "2026-05-12T11:00:00.000Z",
        },
        {
          id: "97000000-0000-4000-8000-000000000002",
          occurrence_number: 1002,
          code: "OCO-001002",
          kind: "defect",
          priority: "normal",
          status: "triaged",
          description: "Torneira com vazamento",
          category_id: "category-2",
          category_name: "Hidráulica",
          room_id: "room-101",
          room_number: "101",
          location_id: null,
          location_name: null,
          stay_id: null,
          reported_by: "user-e2e",
          reporter_name: "Marina Costa",
          blocking_recommended: false,
          liability_status: "not_applicable",
          active_block: false,
          open_work_orders: 0,
          created_at: "2026-05-12T09:00:00.000Z",
          updated_at: "2026-05-12T09:00:00.000Z",
        },
      ],
    });
    return;
  }

  if (method === "GET" && url.pathname === "/admin/reservations/calendar") {
    sendJson(response, 200, buildCalendar(url));
    return;
  }

  if (method === "GET" && url.pathname === "/admin/stays/checkout-candidate") {
    const roomNumber = (url.searchParams.get("room_number") || "").trim();
    if (roomNumber === "102") {
      sendJson(response, 200, { item: buildPanel("stay-2") });
      return;
    }
    sendJson(response, 404, {
      code: "ADMIN_NOT_FOUND",
      message: "Nenhuma estadia em check-in encontrada para este quarto.",
    });
    return;
  }

  if (
    method === "POST" &&
    url.pathname === "/admin/reservations/calendar/booking/simulate"
  ) {
    const body = await parseBody(request);
    const selectedCount = Array.isArray(body.selected_cells)
      ? body.selected_cells.length
      : 0;
    sendJson(response, 200, {
      item: {
        reservation_id: "reservation-preview",
        reservation_code: "PREVIEW",
        customer_id: "customer-1",
        stay_ids: [],
        total_price: selectedCount * 180,
        nights_count: selectedCount,
        rooms_count: new Set(
          (body.selected_cells || []).map((cell) => cell.room_id),
        ).size,
        breakdown: [],
      },
    });
    return;
  }

  if (
    method === "POST" &&
    url.pathname === "/admin/reservations/calendar/booking"
  ) {
    const body = await parseBody(request);
    const selectedCount = Array.isArray(body.selected_cells)
      ? body.selected_cells.length
      : 0;
    sendJson(response, 200, {
      item: {
        reservation_id: "reservation-created",
        reservation_code: "RES-NEW",
        customer_id: "customer-1",
        stay_ids: ["stay-created"],
        total_price: selectedCount * 180,
        nights_count: selectedCount,
        rooms_count: new Set(
          (body.selected_cells || []).map((cell) => cell.room_id),
        ).size,
        breakdown: [],
      },
    });
    return;
  }

  const stayPanelMatch = url.pathname.match(/^\/admin\/stays\/([^/]+)\/panel$/);
  if (method === "GET" && stayPanelMatch) {
    sendJson(response, 200, { item: buildPanel(stayPanelMatch[1]) });
    return;
  }

  const stayActionMatch = url.pathname.match(
    /^\/admin\/stays\/([^/]+)\/(payments|checkin|checkout|no-show|cancel)$/,
  );
  if (method === "POST" && stayActionMatch) {
    await parseBody(request);
    const stayId = stayActionMatch[1];
    const action = stayActionMatch[2];
    const total = stayId === "stay-2" ? 960 : 1280;
    if (action === "payments") {
      sendJson(response, 200, { item: buildPanel(stayId, { paid: total }) });
      return;
    }
    if (action === "checkout") {
      sendJson(response, 200, {
        item: buildPanel(stayId, { paid: total, status: "checked_out" }),
      });
      return;
    }
    sendJson(response, 200, { item: buildPanel(stayId) });
    return;
  }

  sendJson(response, 404, {
    message: `No mock route for ${method} ${url.pathname}`,
  });
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(
    `PMS e2e mock backend running at http://127.0.0.1:${port}\n`,
  );
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
