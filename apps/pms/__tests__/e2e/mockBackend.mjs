import http from "node:http";

const port = Number(process.env.PMS_E2E_BACKEND_PORT || 4334);
const consumptionOccurredAt = "2026-09-04T17:32:00.000Z";
const consumptionPostedAt = "2026-09-04T17:32:49.000Z";
const permissions = [
  "read_hotel",
  "read_room",
  "read_customer",
  "access_reservations_calendar",
  "create_transactions",
  "read_transactions",
  "update_transactions",
  "delete_transactions",
  "create_product",
  "read_product",
  "update_product",
  "delete_product",
];
const consumptionPermissions = [
  ...permissions,
  "read_consumption",
  "manage_consumption_settings",
  "post_consumption",
  "receive_consumption_payment",
  "grant_consumption_courtesy",
  "void_consumption",
  "approve_consumption_adjustment",
  "read_commercial_partners",
  "manage_commercial_partners",
  "manage_commercial_agreements",
];
const inventoryPermissions = [
  ...consumptionPermissions,
  "read_inventory",
  "read_inventory_costs",
  "manage_inventory_settings",
  "post_inventory_movements",
  "perform_inventory_counts",
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
const consumptionUser = {
  ...user,
  permissions: consumptionPermissions,
  roleAssignments: user.roleAssignments.map((assignment) => ({
    ...assignment,
    permissions: consumptionPermissions,
  })),
};
const inventoryUser = {
  ...user,
  permissions: inventoryPermissions,
  roleAssignments: user.roleAssignments.map((assignment) => ({
    ...assignment,
    permissions: inventoryPermissions,
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

const productCategories = [
  {
    id: "category-frigobar",
    hotel_id: "hotel-e2e",
    name: "Frigobar",
    display_order: 1,
    is_active: true,
    archived_at: null,
    created_at: "2026-05-01T10:00:00.000Z",
    updated_at: "2026-05-01T10:00:00.000Z",
  },
  {
    id: "category-wellness",
    hotel_id: "hotel-e2e",
    name: "Bem-estar",
    display_order: 2,
    is_active: true,
    archived_at: null,
    created_at: "2026-05-01T10:00:00.000Z",
    updated_at: "2026-05-01T10:00:00.000Z",
  },
];

const products = [
  {
    id: "product-coffee",
    hotel_id: "hotel-e2e",
    name: "Café espresso",
    category: productCategories[0],
    description: "Café preparado na hora.",
    internal_code: "CAF-001",
    kind: "physical",
    sales_unit: "unit",
    provider: { type: "hotel", partner: null },
    unit_price: 8,
    status: "active",
    archived_at: null,
    created_at: "2026-05-01T10:00:00.000Z",
    updated_at: "2026-05-02T10:00:00.000Z",
  },
  {
    id: "product-massage",
    hotel_id: "hotel-e2e",
    name: "Massagem relaxante",
    category: productCategories[1],
    description: "Sessão de cinquenta minutos fornecida pelo hotel.",
    internal_code: "SPA-050",
    kind: "service",
    sales_unit: "service",
    provider: { type: "hotel", partner: null },
    unit_price: 180,
    status: "active",
    archived_at: null,
    created_at: "2026-05-01T10:00:00.000Z",
    updated_at: "2026-05-01T10:00:00.000Z",
  },
];

const inventorySettings = {
  hotel_id: "hotel-e2e",
  negative_stock_policy: "allow_with_warning",
  updated_at: "2026-05-12T15:00:00.000Z",
};
const inventoryLocations = [
  {
    id: "inventory-central",
    hotel_id: "hotel-e2e",
    name: "Estoque central",
    internal_code: "CENTRAL",
    description: "Local principal do hotel.",
    display_order: 0,
    is_active: true,
    archived_at: null,
    position_count: 0,
    total_quantity: 0,
    created_at: "2026-05-12T15:00:00.000Z",
    updated_at: "2026-05-12T15:00:00.000Z",
  },
];
const inventoryPositions = [];
const inventoryMovements = [];
const inventoryCounts = [];

const productHistory = [
  {
    id: "history-product-coffee",
    hotel_id: "hotel-e2e",
    entity_type: "product",
    entity_id: "product-coffee",
    actor_id: "user-e2e",
    actor_name: "Marina Costa",
    action: "updated",
    changes: { before: { unit_price: 7 }, after: { unit_price: 8 } },
    created_at: "2026-05-02T10:00:00.000Z",
  },
];

const commercialPartners = [];
const commercialAgreements = [];
const commercialHistory = [];

const consumptionPoints = [
  {
    id: "point-reception",
    hotel_id: "hotel-e2e",
    name: "Recepção",
    internal_code: "REC",
    description: "Atendimento e vendas no balcão principal.",
    display_order: 10,
    is_active: true,
    default_policy: {
      allowed_modes: ["hotel_immediate", "stay_folio"],
      default_mode: "stay_folio",
    },
    inherited_offers_count: 1,
    offers_count: 1,
    archived_at: null,
    created_at: "2026-05-01T10:00:00.000Z",
    updated_at: "2026-05-01T10:00:00.000Z",
  },
  {
    id: "point-pool",
    hotel_id: "hotel-e2e",
    name: "Piscina",
    internal_code: "PISC",
    description: "Consumos da área externa.",
    display_order: 20,
    is_active: true,
    default_policy: {
      allowed_modes: ["hotel_immediate"],
      default_mode: "hotel_immediate",
    },
    inherited_offers_count: 0,
    offers_count: 1,
    archived_at: null,
    created_at: "2026-05-01T10:00:00.000Z",
    updated_at: "2026-05-01T10:00:00.000Z",
  },
];

const consumptionOffers = [
  {
    id: "offer-coffee-reception",
    hotel_id: "hotel-e2e",
    point: {
      id: "point-reception",
      name: "Recepção",
      internal_code: "REC",
      is_active: true,
      archived_at: null,
    },
    product: products[0],
    display_order: 10,
    is_active: true,
    policy: { source: "inherit" },
    resolved_policy: {
      source: "inherit",
      allowed_modes: ["hotel_immediate", "stay_folio"],
      default_mode: "stay_folio",
    },
    effective_available: true,
    unavailable_reasons: [],
    commercial_agreement: null,
    current_agreement_revision: null,
    archived_at: null,
    created_at: "2026-05-01T10:00:00.000Z",
    updated_at: "2026-05-01T10:00:00.000Z",
  },
  {
    id: "offer-massage-pool",
    hotel_id: "hotel-e2e",
    point: {
      id: "point-pool",
      name: "Piscina",
      internal_code: "PISC",
      is_active: true,
      archived_at: null,
    },
    product: products[1],
    display_order: 10,
    is_active: false,
    policy: {
      source: "override",
      allowed_modes: ["hotel_immediate"],
      default_mode: "hotel_immediate",
    },
    resolved_policy: {
      source: "override",
      allowed_modes: ["hotel_immediate"],
      default_mode: "hotel_immediate",
    },
    effective_available: false,
    unavailable_reasons: ["offer_inactive"],
    commercial_agreement: null,
    current_agreement_revision: null,
    archived_at: null,
    created_at: "2026-05-01T10:00:00.000Z",
    updated_at: "2026-05-01T10:00:00.000Z",
  },
];
const consumptionOrders = [];
let stayTwoPaid = 600;
let stayTwoCheckedOut = false;

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

function buildStayAccount(stayId = "stay-2") {
  const panel = buildPanel(stayId, {
    paid: stayTwoPaid,
    status: stayTwoCheckedOut ? "checked_out" : "checked_in",
  });
  const balance = Math.max(panel.stay.total_price_estimated - stayTwoPaid, 0);
  return {
    stay_id: stayId,
    reservation_id: panel.stay.reservation_id,
    reservation_code: panel.stay.reservation_code,
    room_number: panel.stay.room_number,
    guest_name: panel.stay.customer_name,
    stay_status: panel.stay.stay_status,
    currency: "BRL",
    version: stayTwoPaid === 600 ? 7 : 8,
    status: stayTwoCheckedOut
      ? "closed"
      : balance === 0
        ? "ready_to_checkout"
        : "open",
    folio: {
      stay_id: stayId,
      currency: "BRL",
      entries: [
        {
          id: "folio-lodging-2",
          stay_id: stayId,
          reservation_id: panel.stay.reservation_id,
          direction: "debit",
          kind: "lodging",
          amount: 960,
          currency: "BRL",
          description: "Hospedagem",
          maintenance_occurrence_id: null,
          consumption_order_id: null,
          financial_transaction_id: null,
          reversed_entry_id: null,
          allocated_amount: stayTwoPaid,
          open_amount: balance,
          posted_at: "2026-05-15T14:30:00.000Z",
        },
      ],
      allocations: [],
      total_debits: 960,
      total_credits: stayTwoPaid,
      balance,
      payment_status: balance === 0 ? "paid" : "partial",
      pending_maintenance_entry_ids: [],
      lodging_total: 960,
      consumption_total: 0,
      maintenance_total: 0,
      available_credit: 0,
      checkout_balance: balance,
      refundable_credit: 0,
    },
    consumption_orders: [],
    corrections: [],
    payment_batches: [],
    refunds: [],
    checkout_record: stayTwoCheckedOut
      ? {
          id: "checkout-record-2",
          kind: "operational",
          account_version: 9,
          currency: "BRL",
          lodging_total: 960,
          consumption_total: 0,
          maintenance_total: 0,
          payment_total: 960,
          partner_direct_total: 0,
          courtesy_total: 0,
          discount_total: 0,
          voided_total: 0,
          exception_folio_entry_ids: [],
          statement_snapshot: {},
          checked_out_by: "user-e2e",
          checked_out_at: "2026-05-18T11:20:00.000Z",
        }
      : null,
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

  if (method === "POST" && url.pathname === "/test/reset-state") {
    products.splice(2);
    consumptionPoints.splice(2);
    consumptionOffers.splice(2);
    consumptionOrders.splice(0);
    commercialPartners.splice(0);
    commercialAgreements.splice(0);
    commercialHistory.splice(0);
    inventorySettings.negative_stock_policy = "allow_with_warning";
    inventoryPositions.splice(0);
    inventoryMovements.splice(0);
    inventoryCounts.splice(0);
    inventoryLocations.splice(1);
    inventoryLocations[0].position_count = 0;
    inventoryLocations[0].total_quantity = 0;
    stayTwoPaid = 600;
    stayTwoCheckedOut = false;
    sendJson(response, 200, { ok: true });
    return;
  }

  if (method === "POST" && url.pathname === "/test/reset-commercial") {
    for (let index = consumptionOffers.length - 1; index >= 0; index -= 1) {
      if (consumptionOffers[index].product?.provider?.type === "partner")
        consumptionOffers.splice(index, 1);
    }
    products.splice(2);
    commercialPartners.splice(0);
    commercialAgreements.splice(0);
    commercialHistory.splice(0);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (method === "POST" && url.pathname === "/test/reset-stay-account") {
    stayTwoPaid = 600;
    stayTwoCheckedOut = false;
    sendJson(response, 200, { ok: true });
    return;
  }

  if (method === "POST" && url.pathname === "/test/reset-inventory") {
    inventorySettings.negative_stock_policy = "allow_with_warning";
    inventoryPositions.splice(0);
    inventoryMovements.splice(0);
    inventoryCounts.splice(0);
    inventoryLocations.splice(1);
    inventoryLocations[0].position_count = 0;
    inventoryLocations[0].total_quantity = 0;
    sendJson(response, 200, { ok: true });
    return;
  }

  if (method === "GET" && url.pathname === "/auth/me") {
    const authorization = request.headers.authorization;
    sendJson(response, 200, {
      user:
        authorization === "Bearer maintenance-e2e-token"
          ? maintenanceUser
          : authorization === "Bearer inventory-e2e-token"
            ? inventoryUser
            : authorization === "Bearer consumption-e2e-token"
              ? consumptionUser
              : user,
    });
    return;
  }

  if (method === "GET" && url.pathname === "/admin/inventory/overview") {
    sendJson(response, 200, {
      settings: inventorySettings,
      items: inventoryPositions,
    });
    return;
  }

  if (method === "GET" && url.pathname === "/admin/inventory/settings") {
    sendJson(response, 200, { item: inventorySettings });
    return;
  }

  if (method === "PUT" && url.pathname === "/admin/inventory/settings") {
    const body = await parseBody(request);
    inventorySettings.negative_stock_policy = body.negative_stock_policy;
    sendJson(response, 200, { item: inventorySettings });
    return;
  }

  if (method === "GET" && url.pathname === "/admin/inventory/locations") {
    sendJson(response, 200, { items: inventoryLocations });
    return;
  }

  if (method === "POST" && url.pathname === "/admin/inventory/locations") {
    const body = await parseBody(request);
    const created = {
      id: `inventory-location-${inventoryLocations.length + 1}`,
      hotel_id: "hotel-e2e",
      name: body.name,
      internal_code: body.internal_code || null,
      description: body.description || null,
      display_order: inventoryLocations.length * 10,
      is_active: true,
      archived_at: null,
      position_count: 0,
      total_quantity: 0,
      created_at: "2026-05-12T15:00:00.000Z",
      updated_at: "2026-05-12T15:00:00.000Z",
    };
    inventoryLocations.push(created);
    sendJson(response, 201, { item: created });
    return;
  }

  if (method === "PUT" && url.pathname === "/admin/inventory/locations/order") {
    const body = await parseBody(request);
    const ordered = body.ids
      .map((id) => inventoryLocations.find((item) => item.id === id))
      .filter(Boolean);
    ordered.forEach((item, index) => {
      item.display_order = (index + 1) * 10;
    });
    inventoryLocations.sort(
      (left, right) => left.display_order - right.display_order,
    );
    sendJson(response, 200, { ok: true });
    return;
  }

  if (method === "POST" && url.pathname === "/admin/inventory/positions") {
    const body = await parseBody(request);
    const product = products.find((item) => item.id === body.product_id);
    const location = inventoryLocations.find(
      (item) => item.id === body.location_id,
    );
    const created = {
      id: `inventory-position-${inventoryPositions.length + 1}`,
      hotel_id: "hotel-e2e",
      product,
      location: {
        id: location.id,
        name: location.name,
        internal_code: location.internal_code,
        is_active: true,
        archived_at: null,
      },
      quantity: body.initial_quantity,
      version: body.initial_quantity > 0 ? 1 : 0,
      minimum_quantity: body.minimum_quantity,
      ideal_quantity: body.ideal_quantity,
      suggested_replenishment: Math.max(
        0,
        body.ideal_quantity - body.initial_quantity,
      ),
      average_unit_cost: body.average_unit_cost,
      inventory_value:
        body.average_unit_cost == null
          ? null
          : body.initial_quantity * body.average_unit_cost,
      status:
        body.initial_quantity < body.minimum_quantity ? "low" : "available",
      is_active: true,
      archived_at: null,
      updated_at: "2026-05-12T15:00:00.000Z",
    };
    inventoryPositions.push(created);
    location.position_count += 1;
    location.total_quantity += body.initial_quantity;
    sendJson(response, 201, { item: created });
    return;
  }

  if (method === "POST" && url.pathname === "/admin/inventory/documents") {
    const body = await parseBody(request);
    for (const line of body.lines) {
      const position = inventoryPositions.find(
        (item) => item.id === line.position_id,
      );
      const before = position.quantity;
      const direction =
        body.kind === "receipt" ||
        (body.kind === "adjustment" && body.direction === "in")
          ? 1
          : -1;
      position.quantity += direction * line.quantity;
      position.version += 1;
      position.suggested_replenishment = Math.max(
        0,
        position.ideal_quantity - position.quantity,
      );
      position.status =
        position.quantity < 0
          ? "negative"
          : position.quantity < position.minimum_quantity
            ? "low"
            : "available";
      inventoryMovements.unshift({
        id: `inventory-movement-${inventoryMovements.length + 1}`,
        hotel_id: "hotel-e2e",
        position_id: position.id,
        product_id: position.product.id,
        product_name: position.product.name,
        location_id: position.location.id,
        location_name: position.location.name,
        kind: body.kind,
        quantity_delta: direction * line.quantity,
        quantity_before: before,
        quantity_after: position.quantity,
        average_unit_cost: line.unit_cost,
        total_cost:
          line.unit_cost == null ? null : line.quantity * line.unit_cost,
        reason: body.reason,
        reference_code: body.reference_code || null,
        occurred_at: "2026-05-12T15:00:00.000Z",
        posted_at: "2026-05-12T15:00:00.000Z",
        actor_id: "user-e2e",
        actor_name: "Marina Costa",
        consumption_order_id: null,
        consumption_order_item_id: null,
        consumption_correction_id: null,
        document_id: "inventory-document-1",
        count_session_id: null,
      });
    }
    sendJson(response, 201, { item: { id: "inventory-document-1" } });
    return;
  }

  if (method === "GET" && url.pathname === "/admin/inventory/movements") {
    sendJson(response, 200, { items: inventoryMovements, next_cursor: null });
    return;
  }

  if (method === "GET" && url.pathname === "/admin/inventory/audit") {
    sendJson(response, 200, { items: [], next_cursor: null });
    return;
  }

  if (method === "GET" && url.pathname === "/admin/inventory/counts") {
    sendJson(response, 200, { items: inventoryCounts });
    return;
  }

  if (method === "GET" && url.pathname === "/admin/customers") {
    sendJson(response, 200, { items: customers });
    return;
  }

  if (method === "GET" && url.pathname === "/admin/products") {
    sendJson(response, 200, { items: products });
    return;
  }

  if (method === "POST" && url.pathname === "/admin/products") {
    const body = await parseBody(request);
    const category = productCategories.find(
      (item) => item.id === body.category_id,
    );
    const partner = commercialPartners.find(
      (item) => item.id === body.commercial_partner_id,
    );
    const created = {
      id: `product-${products.length + 1}`,
      hotel_id: "hotel-e2e",
      name: body.name,
      category,
      description: body.description || null,
      internal_code: body.internal_code || null,
      kind: body.kind,
      sales_unit: body.sales_unit,
      unit_price: body.unit_price,
      status: body.status,
      provider:
        body.provider_type === "partner"
          ? {
              type: "partner",
              partner: { id: partner.id, trade_name: partner.trade_name },
            }
          : { type: "hotel", partner: null },
      archived_at: null,
      created_at: "2026-05-12T15:00:00.000Z",
      updated_at: "2026-05-12T15:00:00.000Z",
    };
    products.push(created);
    sendJson(response, 201, { item: created });
    return;
  }

  if (method === "GET" && url.pathname === "/admin/product-categories") {
    sendJson(response, 200, { items: productCategories });
    return;
  }

  if (
    method === "GET" &&
    url.pathname === "/admin/products/product-coffee/history"
  ) {
    sendJson(response, 200, { items: productHistory });
    return;
  }

  if (method === "GET" && url.pathname === "/admin/commercial-partners") {
    sendJson(response, 200, { items: commercialPartners });
    return;
  }

  if (method === "POST" && url.pathname === "/admin/commercial-partners") {
    const body = await parseBody(request);
    const created = {
      id: `partner-${commercialPartners.length + 1}`,
      hotel_id: "hotel-e2e",
      trade_name: body.trade_name,
      legal_name: body.legal_name,
      tax_id: body.tax_id || null,
      email: body.email || null,
      phone: body.phone || null,
      notes: body.notes || null,
      is_active: body.is_active !== false,
      archived_at: null,
      contacts: [],
      created_at: "2026-05-12T15:00:00.000Z",
      updated_at: "2026-05-12T15:00:00.000Z",
    };
    commercialPartners.push(created);
    commercialHistory.push({
      id: `commercial-history-${commercialHistory.length + 1}`,
      hotel_id: "hotel-e2e",
      entity_type: "partner",
      entity_id: created.id,
      actor_id: "user-e2e",
      actor_name: "Marina Costa",
      action: "created",
      changes: {},
      created_at: created.created_at,
    });
    sendJson(response, 201, { item: created });
    return;
  }

  const partnerContactMatch = url.pathname.match(
    /^\/admin\/commercial-partners\/([^/]+)\/contacts$/,
  );
  if (method === "POST" && partnerContactMatch) {
    const partner = commercialPartners.find(
      (item) => item.id === partnerContactMatch[1],
    );
    const body = await parseBody(request);
    const contact = {
      id: `contact-${partner.contacts.length + 1}`,
      hotel_id: "hotel-e2e",
      partner_id: partner.id,
      name: body.name,
      role: body.role || null,
      purpose: body.purpose,
      email: body.email || null,
      phone: body.phone || null,
      is_primary: Boolean(body.is_primary),
      is_active: body.is_active !== false,
      archived_at: null,
      created_at: "2026-05-12T15:00:00.000Z",
      updated_at: "2026-05-12T15:00:00.000Z",
    };
    partner.contacts.push(contact);
    sendJson(response, 201, { item: contact });
    return;
  }

  const partnerHistoryMatch = url.pathname.match(
    /^\/admin\/commercial-partners\/([^/]+)\/history$/,
  );
  if (method === "GET" && partnerHistoryMatch) {
    sendJson(response, 200, {
      items: commercialHistory.filter(
        (event) => event.entity_id === partnerHistoryMatch[1],
      ),
    });
    return;
  }

  if (method === "GET" && url.pathname === "/admin/commercial-agreements") {
    sendJson(response, 200, { items: commercialAgreements });
    return;
  }

  if (method === "POST" && url.pathname === "/admin/commercial-agreements") {
    const body = await parseBody(request);
    const partner = commercialPartners.find(
      (item) => item.id === body.partner_id,
    );
    const agreementId = `agreement-${commercialAgreements.length + 1}`;
    const revision = {
      id: `revision-${commercialAgreements.length + 1}-1`,
      hotel_id: "hotel-e2e",
      agreement_id: agreementId,
      version: 1,
      ...body.revision,
      status: "draft",
      effective_status: "draft",
      currency: "BRL",
      activated_at: null,
      terminated_at: null,
      created_at: "2026-05-12T15:00:00.000Z",
      updated_at: "2026-05-12T15:00:00.000Z",
    };
    const created = {
      id: agreementId,
      hotel_id: "hotel-e2e",
      partner: {
        id: partner.id,
        trade_name: partner.trade_name,
        is_active: partner.is_active,
        archived_at: partner.archived_at,
      },
      internal_number: body.internal_number,
      archived_at: null,
      revisions: [revision],
      current_revision: null,
      created_at: revision.created_at,
      updated_at: revision.updated_at,
    };
    commercialAgreements.push(created);
    sendJson(response, 201, { item: created });
    return;
  }

  const revisionActivateMatch = url.pathname.match(
    /^\/admin\/commercial-agreement-revisions\/([^/]+)\/activate$/,
  );
  if (method === "POST" && revisionActivateMatch) {
    const agreement = commercialAgreements.find((item) =>
      item.revisions.some(
        (revision) => revision.id === revisionActivateMatch[1],
      ),
    );
    const revision = agreement.revisions.find(
      (item) => item.id === revisionActivateMatch[1],
    );
    revision.status = "activated";
    revision.effective_status = "current";
    revision.activated_at = "2026-05-12T15:00:00.000Z";
    agreement.current_revision = revision;
    sendJson(response, 200, { item: revision });
    return;
  }

  const agreementHistoryMatch = url.pathname.match(
    /^\/admin\/commercial-agreements\/([^/]+)\/history$/,
  );
  if (method === "GET" && agreementHistoryMatch) {
    sendJson(response, 200, { items: [] });
    return;
  }

  if (
    method === "GET" &&
    url.pathname === "/admin/consumption-orders/eligible-stays"
  ) {
    sendJson(response, 200, {
      items: [
        {
          id: "stay-2",
          reservation_id: "reservation-2",
          reservation_code: "RES-1002",
          room_number: "102",
          room_type: "Standard",
          primary_guest_name: "Bruno Lima",
          checkin_date_actual: "2026-05-11T14:00:00.000Z",
        },
      ],
    });
    return;
  }

  if (
    method === "GET" &&
    url.pathname === "/admin/consumption-orders/context"
  ) {
    sendJson(response, 200, {
      item: {
        stay: {
          id: "stay-2",
          reservation_id: "reservation-2",
          reservation_code: "RES-1002",
          room_id: "room-102",
          room_number: "102",
          room_type: "Standard",
          primary_guest_name: "Bruno Lima",
          checkin_date_actual: "2026-05-11T14:00:00.000Z",
          checkout_date_expected: "2026-09-05T11:00:00.000Z",
          stay_status: "checked_in",
        },
        guests: [{ id: "customer-2", full_name: "Bruno Lima" }],
        occurred_at: consumptionOccurredAt,
        offers: consumptionOffers.map((offer) => ({
          id: offer.id,
          point_id: offer.point.id,
          point_name: offer.point.name,
          product_id: offer.product.id,
          product_name: offer.product.name,
          product_code: offer.product.internal_code,
          product_kind: offer.product.kind,
          sales_unit: offer.product.sales_unit,
          category_id: offer.product.category.id,
          category_name: offer.product.category.name,
          unit_price: offer.product.unit_price,
          currency: "BRL",
          provider_type: offer.product.provider.type,
          partner_id: offer.product.provider.partner?.id || null,
          partner_name: offer.product.provider.partner?.trade_name || null,
          agreement_id: offer.commercial_agreement?.id || null,
          agreement_number: offer.commercial_agreement?.internal_number || null,
          revision: null,
          allowed_modes: offer.resolved_policy.allowed_modes,
          default_mode: offer.resolved_policy.default_mode,
          policy_source: offer.resolved_policy.source,
          available: offer.effective_available,
          reasons: offer.unavailable_reasons,
          version_token: `version-${offer.id}`,
        })),
      },
    });
    return;
  }

  if (method === "POST" && url.pathname === "/admin/consumption-orders") {
    const body = await parseBody(request);
    const selectedOffers = body.lines.map((line) => ({
      line,
      offer: consumptionOffers.find((item) => item.id === line.offer_id),
    }));
    const gross = selectedOffers.reduce(
      (sum, item) => sum + item.offer.product.unit_price * item.line.quantity,
      0,
    );
    const courtesy = body.disposition === "courtesy";
    const created = {
      id: `consumption-order-${consumptionOrders.length + 1}`,
      hotel_id: "hotel-e2e",
      stay_id: "stay-2",
      reservation_id: "reservation-2",
      point_id: body.point_id,
      guest_customer_id: body.guest_customer_id || null,
      disposition: body.disposition,
      billing_mode: body.billing_mode || null,
      payment_method: body.payment_method || null,
      payment_reference: body.payment_reference || null,
      partner_receipt_confirmed: body.partner_receipt_confirmed || false,
      currency: "BRL",
      gross_amount: gross,
      discount_amount: courtesy ? gross : 0,
      net_amount: courtesy ? 0 : gross,
      reservation_code: "RES-1002",
      room_number: "102",
      guest_name: "Bruno Lima",
      point_name:
        consumptionPoints.find((point) => point.id === body.point_id)?.name ||
        "Recepção",
      notes: body.notes || null,
      courtesy_reason: body.courtesy_reason || null,
      occurred_at: body.occurred_at,
      posted_at: consumptionPostedAt,
      posted_by: "user-e2e",
      operator_name: "Marina Costa",
      is_legacy: false,
      items: selectedOffers.map(({ line, offer }, index) => ({
        id: `consumption-item-${index + 1}`,
        offer_id: offer.id,
        product_id: offer.product.id,
        quantity: line.quantity,
        charged_unit_price: offer.product.unit_price,
        gross_amount: offer.product.unit_price * line.quantity,
        discount_amount: courtesy
          ? offer.product.unit_price * line.quantity
          : 0,
        net_amount: courtesy ? 0 : offer.product.unit_price * line.quantity,
        product_name: offer.product.name,
        product_code: offer.product.internal_code,
        category_name: offer.product.category.name,
        product_kind: offer.product.kind,
        sales_unit: offer.product.sales_unit,
        provider_type: offer.product.provider.type,
        partner_id: null,
        partner_name: null,
        agreement_id: null,
        agreement_number: null,
        commercial_revision_id: null,
        commercial_revision_version: null,
        billing_policy: {},
        version_token: line.version_token,
        notes: null,
      })),
    };
    consumptionOrders.unshift(created);
    sendJson(response, 201, { item: created });
    return;
  }

  if (method === "GET" && url.pathname === "/admin/consumption-orders") {
    sendJson(response, 200, { items: consumptionOrders, next_cursor: null });
    return;
  }

  const consumptionOrderMatch = url.pathname.match(
    /^\/admin\/consumption-orders\/([^/]+)$/,
  );
  if (method === "GET" && consumptionOrderMatch) {
    const order = consumptionOrders.find(
      (item) => item.id === consumptionOrderMatch[1],
    );
    sendJson(
      response,
      order ? 200 : 404,
      order ? { item: order } : { message: "Comanda não encontrada" },
    );
    return;
  }

  if (method === "GET" && url.pathname === "/admin/consumption-points") {
    sendJson(response, 200, { items: consumptionPoints });
    return;
  }

  if (method === "GET" && url.pathname === "/admin/consumption-offers") {
    const pointId = url.searchParams.get("point_id");
    const productId = url.searchParams.get("product_id");
    sendJson(response, 200, {
      items: consumptionOffers.filter(
        (offer) =>
          (!pointId || offer.point.id === pointId) &&
          (!productId || offer.product.id === productId),
      ),
    });
    return;
  }

  if (method === "POST" && url.pathname === "/admin/consumption-points") {
    const body = await parseBody(request);
    const created = {
      id: `point-${consumptionPoints.length + 1}`,
      hotel_id: "hotel-e2e",
      name: body.name,
      internal_code: body.internal_code || null,
      description: body.description || null,
      display_order: (consumptionPoints.length + 1) * 10,
      is_active: body.is_active !== false,
      default_policy: body.default_policy,
      inherited_offers_count: 0,
      offers_count: 0,
      archived_at: null,
      created_at: "2026-05-12T15:00:00.000Z",
      updated_at: "2026-05-12T15:00:00.000Z",
    };
    consumptionPoints.push(created);
    sendJson(response, 201, { item: created });
    return;
  }

  const pointLifecycleMatch = url.pathname.match(
    /^\/admin\/consumption-points\/([^/]+)\/(archive|restore)$/,
  );
  if (method === "POST" && pointLifecycleMatch) {
    const point = consumptionPoints.find(
      (item) => item.id === pointLifecycleMatch[1],
    );
    if (point)
      point.archived_at =
        pointLifecycleMatch[2] === "archive"
          ? "2026-05-12T15:00:00.000Z"
          : null;
    sendJson(
      response,
      point ? 200 : 404,
      point ? { item: point } : { message: "Ponto não encontrado" },
    );
    return;
  }

  const pointUpdateMatch = url.pathname.match(
    /^\/admin\/consumption-points\/([^/]+)$/,
  );
  if (method === "PUT" && pointUpdateMatch) {
    const body = await parseBody(request);
    const point = consumptionPoints.find(
      (item) => item.id === pointUpdateMatch[1],
    );
    if (point)
      Object.assign(point, body, { updated_at: "2026-05-12T15:00:00.000Z" });
    sendJson(
      response,
      point ? 200 : 404,
      point ? { item: point } : { message: "Ponto não encontrado" },
    );
    return;
  }

  if (method === "PUT" && url.pathname === "/admin/consumption-points/order") {
    await parseBody(request);
    sendJson(response, 200, { ok: true });
    return;
  }

  const offerBatchMatch = url.pathname.match(
    /^\/admin\/consumption-points\/([^/]+)\/offers$/,
  );
  if (method === "POST" && offerBatchMatch) {
    const body = await parseBody(request);
    const point = consumptionPoints.find(
      (item) => item.id === offerBatchMatch[1],
    );
    const created = (body.product_ids || []).map((productId) => {
      const product = products.find((item) => item.id === productId);
      const inherited = body.policy?.source !== "override";
      const agreement = commercialAgreements.find(
        (item) => item.id === body.commercial_agreement_id,
      );
      const item = {
        id: `offer-${consumptionOffers.length + 1}-${productId}`,
        hotel_id: "hotel-e2e",
        point: {
          id: point.id,
          name: point.name,
          internal_code: point.internal_code,
          is_active: point.is_active,
          archived_at: point.archived_at,
        },
        product,
        display_order: (consumptionOffers.length + 1) * 10,
        is_active: true,
        policy: body.policy,
        commercial_agreement: agreement
          ? {
              id: agreement.id,
              internal_number: agreement.internal_number,
              partner: agreement.partner,
            }
          : null,
        current_agreement_revision: agreement?.current_revision || null,
        resolved_policy: inherited
          ? { source: "inherit", ...point.default_policy }
          : {
              source: "override",
              allowed_modes: body.policy.allowed_modes,
              default_mode: body.policy.default_mode,
            },
        effective_available: true,
        unavailable_reasons: [],
        archived_at: null,
        created_at: "2026-05-12T15:00:00.000Z",
        updated_at: "2026-05-12T15:00:00.000Z",
      };
      consumptionOffers.push(item);
      return item;
    });
    sendJson(response, 201, { items: created });
    return;
  }

  if (
    method === "PUT" &&
    /^\/admin\/consumption-points\/[^/]+\/offers\/order$/.test(url.pathname)
  ) {
    await parseBody(request);
    sendJson(response, 200, { ok: true });
    return;
  }

  const offerLifecycleMatch = url.pathname.match(
    /^\/admin\/consumption-offers\/([^/]+)\/(archive|restore)$/,
  );
  if (method === "POST" && offerLifecycleMatch) {
    const offer = consumptionOffers.find(
      (item) => item.id === offerLifecycleMatch[1],
    );
    if (offer) {
      offer.archived_at =
        offerLifecycleMatch[2] === "archive"
          ? "2026-05-12T15:00:00.000Z"
          : null;
      offer.effective_available = !offer.archived_at && offer.is_active;
      offer.unavailable_reasons = offer.archived_at
        ? ["offer_archived"]
        : offer.is_active
          ? []
          : ["offer_inactive"];
    }
    sendJson(
      response,
      offer ? 200 : 404,
      offer ? { item: offer } : { message: "Oferta não encontrada" },
    );
    return;
  }

  const offerUpdateMatch = url.pathname.match(
    /^\/admin\/consumption-offers\/([^/]+)$/,
  );
  if (method === "PUT" && offerUpdateMatch) {
    const body = await parseBody(request);
    const offer = consumptionOffers.find(
      (item) => item.id === offerUpdateMatch[1],
    );
    if (offer) {
      Object.assign(offer, body);
      offer.effective_available = !offer.archived_at && offer.is_active;
      offer.unavailable_reasons = offer.effective_available
        ? []
        : ["offer_inactive"];
    }
    sendJson(
      response,
      offer ? 200 : 404,
      offer ? { item: offer } : { message: "Oferta não encontrada" },
    );
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
      stays: [
        {
          id: "stay-2",
          room_id: "room-101",
          reservation_code: "RES-1002",
          customer_name: "Bruno Lima",
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

  if (method === "GET" && url.pathname === "/admin/maintenance/sla-policies") {
    sendJson(response, 200, {
      items: [
        {
          id: "sla-e2e",
          hotel_id: "hotel-e2e",
          category_id: null,
          category_name: null,
          priority: "critical",
          name: "Crítica padrão",
          response_hours: 1,
          resolution_hours: 8,
          is_active: true,
          created_at: "2026-01-01T10:00:00.000Z",
          updated_at: "2026-01-01T10:00:00.000Z",
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

  const maintenanceOccurrenceFinanceMatch = url.pathname.match(
    /^\/admin\/maintenance\/occurrences\/([^/]+)\/finance$/,
  );
  if (method === "GET" && maintenanceOccurrenceFinanceMatch) {
    sendJson(response, 200, {
      item: {
        occurrence_id: maintenanceOccurrenceFinanceMatch[1],
        currency: "BRL",
        estimated_cost: 1980,
        approved_cost: 1980,
        settled_cost: 0,
        approved_recovery: 100,
        received_recovery: 0,
        net_result: -1880,
        cost_items: [],
        recoveries: [],
      },
    });
    return;
  }

  const maintenanceOccurrenceMatch = url.pathname.match(
    /^\/admin\/maintenance\/occurrences\/([^/]+)$/,
  );
  if (method === "GET" && maintenanceOccurrenceMatch) {
    sendJson(response, 200, {
      item: {
        id: maintenanceOccurrenceMatch[1],
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
        open_work_orders: 0,
        created_at: "2026-05-12T10:00:00.000Z",
        updated_at: "2026-05-12T11:00:00.000Z",
        discovered_at: "2026-05-12T10:00:00.000Z",
        triaged_by: "user-e2e",
        triaged_at: "2026-05-12T10:30:00.000Z",
        suspected_party: "guest",
        confirmed_party: null,
        liability_notes: "Aguardando apuração.",
        duplicate_of_id: null,
        canceled_reason: null,
        resolved_at: null,
        sla_response_due_at: "2026-05-12T11:00:00.000Z",
        sla_resolution_due_at: "2026-05-13T10:00:00.000Z",
        preventive_plan_id: null,
        work_orders: [],
        inspections: [],
        events: [],
        attachments: [],
        room_blocks: [],
      },
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

  const stayAccountMatch = url.pathname.match(
    /^\/admin\/stays\/([^/]+)\/account$/,
  );
  if (method === "GET" && stayAccountMatch) {
    sendJson(response, 200, { item: buildStayAccount(stayAccountMatch[1]) });
    return;
  }

  const stayPaymentBatchMatch = url.pathname.match(
    /^\/admin\/stays\/([^/]+)\/payment-batches$/,
  );
  if (method === "POST" && stayPaymentBatchMatch) {
    const body = await parseBody(request);
    stayTwoPaid = Math.min(
      960,
      stayTwoPaid +
        (body.tenders || []).reduce(
          (sum, tender) => sum + Number(tender.amount || 0),
          0,
        ),
    );
    sendJson(response, 201, {
      item: buildStayAccount(stayPaymentBatchMatch[1]),
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
      stayTwoCheckedOut = true;
      stayTwoPaid = total;
      sendJson(response, 200, {
        item: buildStayAccount(stayId),
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
