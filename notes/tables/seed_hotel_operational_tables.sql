-- Seed data for hotel-scoped operational tables.
-- Target tables:
-- customers, financial_transactions, products, reservations, rooms,
-- season_room_rates, seasons, stay_consumption, stay_customers, stays.
--
-- This script is idempotent by fixed UUID primary keys.
-- It uses the first active hotel; if none is active, it uses the first hotel.
-- It does not create hotels, users, roles, or permissions.

begin;

create extension if not exists "pgcrypto";

create temporary table _hotel_seed_target on commit drop as
select
  h.id as hotel_id,
  coalesce(nullif(h.currency, ''), 'BRL') as currency
from public.hotels h
order by
  case when coalesce(h.is_active, false) then 0 else 1 end,
  h.created_at nulls last,
  h.name
limit 1;

do $$
begin
  if not exists (select 1 from _hotel_seed_target) then
    raise exception 'Seed aborted: create at least one hotel before running this script.';
  end if;
end $$;

-- =========================
-- Rooms
-- =========================

insert into public.rooms (
  id,
  hotel_id,
  room_number,
  room_type,
  max_occupancy,
  base_daily_rate,
  status,
  notes
)
select *
from (
  select
    '00000000-0000-4000-8000-000000000101'::uuid,
    t.hotel_id,
    '101',
    'Standard',
    2,
    220.00,
    'available'::public.room_status,
    'Quarto standard proximo a recepcao.'
  from _hotel_seed_target t
  union all
  select
    '00000000-0000-4000-8000-000000000102'::uuid,
    t.hotel_id,
    '102',
    'Standard',
    2,
    220.00,
    'maintenance'::public.room_status,
    'Manutencao preventiva de ar-condicionado.'
  from _hotel_seed_target t
  union all
  select
    '00000000-0000-4000-8000-000000000202'::uuid,
    t.hotel_id,
    '202',
    'Suite',
    3,
    520.00,
    'occupied'::public.room_status,
    'Suite com varanda.'
  from _hotel_seed_target t
  union all
  select
    '00000000-0000-4000-8000-000000000301'::uuid,
    t.hotel_id,
    '301',
    'Standard',
    2,
    240.00,
    'available'::public.room_status,
    'Andar alto.'
  from _hotel_seed_target t
  union all
  select
    '00000000-0000-4000-8000-000000000303'::uuid,
    t.hotel_id,
    '303',
    'Luxo',
    4,
    460.00,
    'available'::public.room_status,
    'Quarto luxo familiar.'
  from _hotel_seed_target t
) as seed (
  id,
  hotel_id,
  room_number,
  room_type,
  max_occupancy,
  base_daily_rate,
  status,
  notes
)
on conflict (id) do update
set
  hotel_id = excluded.hotel_id,
  room_number = excluded.room_number,
  room_type = excluded.room_type,
  max_occupancy = excluded.max_occupancy,
  base_daily_rate = excluded.base_daily_rate,
  status = excluded.status,
  notes = excluded.notes;

-- =========================
-- Customers
-- =========================

insert into public.customers (
  id,
  hotel_id,
  full_name,
  document_number,
  document_type,
  email,
  mobile_phone,
  phone,
  birth_date,
  nationality,
  notes
)
select *
from (
  select
    '00000000-0000-4000-8000-000000001001'::uuid,
    t.hotel_id,
    'Marina Costa',
    '12345678901',
    'CPF',
    'marina.costa@example.com',
    '+55119911110001',
    null,
    '1989-03-14'::date,
    'Brasileira',
    'Hospede corporativa recorrente.'
  from _hotel_seed_target t
  union all
  select
    '00000000-0000-4000-8000-000000001002'::uuid,
    t.hotel_id,
    'Roberto Almeida',
    '23456789012',
    'CPF',
    'roberto.almeida@example.com',
    '+55119911110002',
    null,
    '1978-07-22'::date,
    'Brasileira',
    'Preferencia por andar alto.'
  from _hotel_seed_target t
  union all
  select
    '00000000-0000-4000-8000-000000001003'::uuid,
    t.hotel_id,
    'Carla Menezes',
    '34567890123',
    'CPF',
    'carla.menezes@example.com',
    '+55119911110003',
    null,
    '1992-11-08'::date,
    'Brasileira',
    null
  from _hotel_seed_target t
  union all
  select
    '00000000-0000-4000-8000-000000001004'::uuid,
    t.hotel_id,
    'Daniel Rocha',
    'AB123456',
    'PASSPORT',
    'daniel.rocha@example.com',
    '+55119911110004',
    null,
    '1985-01-19'::date,
    'Portuguesa',
    'Reserva via agencia.'
  from _hotel_seed_target t
) as seed (
  id,
  hotel_id,
  full_name,
  document_number,
  document_type,
  email,
  mobile_phone,
  phone,
  birth_date,
  nationality,
  notes
)
on conflict (id) do update
set
  hotel_id = excluded.hotel_id,
  full_name = excluded.full_name,
  document_number = excluded.document_number,
  document_type = excluded.document_type,
  email = excluded.email,
  mobile_phone = excluded.mobile_phone,
  phone = excluded.phone,
  birth_date = excluded.birth_date,
  nationality = excluded.nationality,
  notes = excluded.notes;

-- =========================
-- Products
-- =========================

insert into public.products (
  id,
  hotel_id,
  name,
  category,
  unit_price,
  status
)
select *
from (
  select '00000000-0000-4000-8000-000000002001'::uuid, t.hotel_id, 'Agua mineral 500ml', 'Frigobar', 7.50, 'active'::public.product_status from _hotel_seed_target t
  union all
  select '00000000-0000-4000-8000-000000002002'::uuid, t.hotel_id, 'Cafe da manha extra', 'Restaurante', 45.00, 'active'::public.product_status from _hotel_seed_target t
  union all
  select '00000000-0000-4000-8000-000000002003'::uuid, t.hotel_id, 'Jantar executivo', 'Restaurante', 89.90, 'active'::public.product_status from _hotel_seed_target t
  union all
  select '00000000-0000-4000-8000-000000002004'::uuid, t.hotel_id, 'Lavanderia expressa', 'Servicos', 65.00, 'active'::public.product_status from _hotel_seed_target t
  union all
  select '00000000-0000-4000-8000-000000002005'::uuid, t.hotel_id, 'Estacionamento diario', 'Servicos', 35.00, 'active'::public.product_status from _hotel_seed_target t
) as seed (
  id,
  hotel_id,
  name,
  category,
  unit_price,
  status
)
on conflict (id) do update
set
  hotel_id = excluded.hotel_id,
  name = excluded.name,
  category = excluded.category,
  unit_price = excluded.unit_price,
  status = excluded.status;

-- =========================
-- Seasons and season room rates
-- is_active=false avoids overlap errors in databases that enforce one active
-- season per date range, while still giving data to test the PMS screens.
-- =========================

insert into public.seasons (
  id,
  hotel_id,
  name,
  start_date,
  end_date,
  is_active
)
select *
from (
  select
    '00000000-0000-4000-8000-000000003001'::uuid,
    t.hotel_id,
    'Seed - Baixa temporada 2026',
    '2026-05-01'::date,
    '2026-06-30'::date,
    false
  from _hotel_seed_target t
  union all
  select
    '00000000-0000-4000-8000-000000003002'::uuid,
    t.hotel_id,
    'Seed - Alta temporada 2026',
    '2026-12-01'::date,
    '2027-01-31'::date,
    false
  from _hotel_seed_target t
) as seed (
  id,
  hotel_id,
  name,
  start_date,
  end_date,
  is_active
)
on conflict (id) do update
set
  hotel_id = excluded.hotel_id,
  name = excluded.name,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  is_active = excluded.is_active;

insert into public.season_room_rates (
  id,
  season_id,
  hotel_id,
  room_type,
  daily_rate
)
select *
from (
  select '00000000-0000-4000-8000-000000003101'::uuid, '00000000-0000-4000-8000-000000003001'::uuid, t.hotel_id, 'Standard', 20.00 from _hotel_seed_target t
  union all
  select '00000000-0000-4000-8000-000000003102'::uuid, '00000000-0000-4000-8000-000000003001'::uuid, t.hotel_id, 'Suite', 60.00 from _hotel_seed_target t
  union all
  select '00000000-0000-4000-8000-000000003103'::uuid, '00000000-0000-4000-8000-000000003001'::uuid, t.hotel_id, 'Luxo', 45.00 from _hotel_seed_target t
  union all
  select '00000000-0000-4000-8000-000000003201'::uuid, '00000000-0000-4000-8000-000000003002'::uuid, t.hotel_id, 'Standard', 95.00 from _hotel_seed_target t
  union all
  select '00000000-0000-4000-8000-000000003202'::uuid, '00000000-0000-4000-8000-000000003002'::uuid, t.hotel_id, 'Suite', 180.00 from _hotel_seed_target t
  union all
  select '00000000-0000-4000-8000-000000003203'::uuid, '00000000-0000-4000-8000-000000003002'::uuid, t.hotel_id, 'Luxo', 140.00 from _hotel_seed_target t
) as seed (
  id,
  season_id,
  hotel_id,
  room_type,
  daily_rate
)
on conflict (id) do update
set
  season_id = excluded.season_id,
  hotel_id = excluded.hotel_id,
  room_type = excluded.room_type,
  daily_rate = excluded.daily_rate;

-- =========================
-- Reservations
-- =========================

insert into public.reservations (
  id,
  hotel_id,
  booking_customer_id,
  reservation_code,
  guest_count,
  reservation_source,
  estimated_total_price,
  final_total_price,
  notes,
  total_paid
)
select *
from (
  select
    '00000000-0000-4000-8000-000000004001'::uuid,
    t.hotel_id,
    '00000000-0000-4000-8000-000000001001'::uuid,
    'RSV-SEED-2026-0001',
    2,
    'front_desk'::public.reservation_source,
    1740.00,
    1740.00,
    'Reserva seed em andamento para Suite 202.',
    900.00
  from _hotel_seed_target t
  union all
  select
    '00000000-0000-4000-8000-000000004002'::uuid,
    t.hotel_id,
    '00000000-0000-4000-8000-000000001002'::uuid,
    'RSV-SEED-2026-0002',
    1,
    'website'::public.reservation_source,
    660.00,
    null,
    'Reserva seed futura para Standard 101.',
    0.00
  from _hotel_seed_target t
  union all
  select
    '00000000-0000-4000-8000-000000004003'::uuid,
    t.hotel_id,
    '00000000-0000-4000-8000-000000001003'::uuid,
    'RSV-SEED-2026-0003',
    2,
    'phone'::public.reservation_source,
    720.00,
    720.00,
    'Reserva seed finalizada.',
    720.00
  from _hotel_seed_target t
  union all
  select
    '00000000-0000-4000-8000-000000004004'::uuid,
    t.hotel_id,
    '00000000-0000-4000-8000-000000001004'::uuid,
    'RSV-SEED-2026-0004',
    3,
    'agency'::public.reservation_source,
    920.00,
    null,
    'Reserva seed marcada como no-show na estadia.',
    0.00
  from _hotel_seed_target t
) as seed (
  id,
  hotel_id,
  booking_customer_id,
  reservation_code,
  guest_count,
  reservation_source,
  estimated_total_price,
  final_total_price,
  notes,
  total_paid
)
on conflict (id) do update
set
  hotel_id = excluded.hotel_id,
  booking_customer_id = excluded.booking_customer_id,
  reservation_code = excluded.reservation_code,
  guest_count = excluded.guest_count,
  reservation_source = excluded.reservation_source,
  estimated_total_price = excluded.estimated_total_price,
  final_total_price = excluded.final_total_price,
  notes = excluded.notes,
  total_paid = excluded.total_paid;

-- =========================
-- Stays
-- Note: stay IDs intentionally match reservation IDs. This keeps the seed
-- compatible with older exports where stay_customers.stay_id also referenced
-- reservations(id).
-- =========================

insert into public.stays (
  id,
  reservation_id,
  room_id,
  applied_daily_rate,
  total_price_estimated,
  checkin_date_expected,
  checkout_date_expected,
  checkin_date_actual,
  checkout_date_actual,
  total_paid,
  stay_status
)
values
  (
    '00000000-0000-4000-8000-000000004001'::uuid,
    '00000000-0000-4000-8000-000000004001'::uuid,
    '00000000-0000-4000-8000-000000000202'::uuid,
    580.00,
    1740.00,
    '2026-05-11 14:00:00-03'::timestamptz,
    '2026-05-14 12:00:00-03'::timestamptz,
    '2026-05-11 15:12:00-03'::timestamptz,
    null,
    900.00,
    'checked_in'
  ),
  (
    '00000000-0000-4000-8000-000000004002'::uuid,
    '00000000-0000-4000-8000-000000004002'::uuid,
    '00000000-0000-4000-8000-000000000101'::uuid,
    220.00,
    660.00,
    '2026-05-18 14:00:00-03'::timestamptz,
    '2026-05-21 12:00:00-03'::timestamptz,
    null,
    null,
    0.00,
    'confirmed'
  ),
  (
    '00000000-0000-4000-8000-000000004003'::uuid,
    '00000000-0000-4000-8000-000000004003'::uuid,
    '00000000-0000-4000-8000-000000000301'::uuid,
    240.00,
    720.00,
    '2026-05-02 14:00:00-03'::timestamptz,
    '2026-05-05 12:00:00-03'::timestamptz,
    '2026-05-02 14:40:00-03'::timestamptz,
    '2026-05-05 10:25:00-03'::timestamptz,
    720.00,
    'checked_out'
  ),
  (
    '00000000-0000-4000-8000-000000004004'::uuid,
    '00000000-0000-4000-8000-000000004004'::uuid,
    '00000000-0000-4000-8000-000000000303'::uuid,
    460.00,
    920.00,
    '2026-05-06 14:00:00-03'::timestamptz,
    '2026-05-08 12:00:00-03'::timestamptz,
    null,
    null,
    0.00,
    'no_show'
  )
on conflict (id) do update
set
  reservation_id = excluded.reservation_id,
  room_id = excluded.room_id,
  applied_daily_rate = excluded.applied_daily_rate,
  total_price_estimated = excluded.total_price_estimated,
  checkin_date_expected = excluded.checkin_date_expected,
  checkout_date_expected = excluded.checkout_date_expected,
  checkin_date_actual = excluded.checkin_date_actual,
  checkout_date_actual = excluded.checkout_date_actual,
  total_paid = excluded.total_paid,
  stay_status = excluded.stay_status;

-- =========================
-- Stay guests
-- =========================

insert into public.stay_customers (
  id,
  stay_id,
  customer_id
)
values
  ('00000000-0000-4000-8000-000000005001'::uuid, '00000000-0000-4000-8000-000000004001'::uuid, '00000000-0000-4000-8000-000000001001'::uuid),
  ('00000000-0000-4000-8000-000000005002'::uuid, '00000000-0000-4000-8000-000000004001'::uuid, '00000000-0000-4000-8000-000000001003'::uuid),
  ('00000000-0000-4000-8000-000000005003'::uuid, '00000000-0000-4000-8000-000000004002'::uuid, '00000000-0000-4000-8000-000000001002'::uuid),
  ('00000000-0000-4000-8000-000000005004'::uuid, '00000000-0000-4000-8000-000000004003'::uuid, '00000000-0000-4000-8000-000000001003'::uuid),
  ('00000000-0000-4000-8000-000000005005'::uuid, '00000000-0000-4000-8000-000000004004'::uuid, '00000000-0000-4000-8000-000000001004'::uuid)
on conflict (id) do update
set
  stay_id = excluded.stay_id,
  customer_id = excluded.customer_id;

-- =========================
-- Stay consumption
-- item_total_amount is omitted because some schemas define it as generated.
-- =========================

insert into public.stay_consumption (
  id,
  stay_id,
  product_id,
  quantity,
  charged_unit_price,
  consumption_date,
  notes
)
values
  (
    '00000000-0000-4000-8000-000000006001'::uuid,
    '00000000-0000-4000-8000-000000004001'::uuid,
    '00000000-0000-4000-8000-000000002001'::uuid,
    4,
    7.50,
    '2026-05-11 20:10:00-03'::timestamptz,
    'Consumo de frigobar.'
  ),
  (
    '00000000-0000-4000-8000-000000006002'::uuid,
    '00000000-0000-4000-8000-000000004001'::uuid,
    '00000000-0000-4000-8000-000000002003'::uuid,
    2,
    89.90,
    '2026-05-12 21:00:00-03'::timestamptz,
    'Jantar debitado na estadia.'
  ),
  (
    '00000000-0000-4000-8000-000000006003'::uuid,
    '00000000-0000-4000-8000-000000004003'::uuid,
    '00000000-0000-4000-8000-000000002005'::uuid,
    3,
    35.00,
    '2026-05-04 09:30:00-03'::timestamptz,
    'Estacionamento durante hospedagem.'
  )
on conflict (id) do update
set
  stay_id = excluded.stay_id,
  product_id = excluded.product_id,
  quantity = excluded.quantity,
  charged_unit_price = excluded.charged_unit_price,
  consumption_date = excluded.consumption_date,
  notes = excluded.notes;

-- =========================
-- Financial transactions
-- =========================

insert into public.financial_transactions (
  id,
  hotel_id,
  type,
  category,
  amount,
  currency,
  description,
  status,
  created_at,
  stay_id,
  reservation_id,
  payment_method,
  paid_at,
  due_date,
  counterparty,
  cost_center,
  reference_code,
  created_by
)
select *
from (
  select
    '00000000-0000-4000-8000-000000007001'::uuid,
    t.hotel_id,
    'INCOME'::public.transaction_type,
    'STAY_PAYMENT',
    900.00,
    t.currency,
    'Pagamento parcial da reserva RSV-SEED-2026-0001.',
    'COMPLETED'::public.transaction_status,
    '2026-05-11 15:20:00-03'::timestamptz,
    '00000000-0000-4000-8000-000000004001'::uuid,
    '00000000-0000-4000-8000-000000004001'::uuid,
    'PIX',
    '2026-05-11 15:20:00-03'::timestamptz,
    '2026-05-11'::date,
    'Marina Costa',
    'Recepcao',
    'PAY-SEED-0001',
    null::uuid
  from _hotel_seed_target t
  union all
  select
    '00000000-0000-4000-8000-000000007002'::uuid,
    t.hotel_id,
    'INCOME'::public.transaction_type,
    'STAY_PAYMENT',
    720.00,
    t.currency,
    'Quitacao da reserva RSV-SEED-2026-0003.',
    'COMPLETED'::public.transaction_status,
    '2026-05-05 10:40:00-03'::timestamptz,
    '00000000-0000-4000-8000-000000004003'::uuid,
    '00000000-0000-4000-8000-000000004003'::uuid,
    'CREDIT_CARD',
    '2026-05-05 10:40:00-03'::timestamptz,
    '2026-05-05'::date,
    'Carla Menezes',
    'Recepcao',
    'PAY-SEED-0002',
    null::uuid
  from _hotel_seed_target t
  union all
  select
    '00000000-0000-4000-8000-000000007003'::uuid,
    t.hotel_id,
    'EXPENSE'::public.transaction_type,
    'Lavanderia',
    380.00,
    t.currency,
    'Fatura semanal de lavanderia terceirizada.',
    'PENDING'::public.transaction_status,
    '2026-05-09 09:00:00-03'::timestamptz,
    null::uuid,
    null::uuid,
    null,
    null::timestamptz,
    '2026-05-10'::date,
    'Lavanderia Central',
    'Governanca',
    'NF-SEED-1001',
    null::uuid
  from _hotel_seed_target t
  union all
  select
    '00000000-0000-4000-8000-000000007004'::uuid,
    t.hotel_id,
    'EXPENSE'::public.transaction_type,
    'Manutencao',
    1250.00,
    t.currency,
    'Troca de compressor do ar-condicionado.',
    'COMPLETED'::public.transaction_status,
    '2026-05-08 11:00:00-03'::timestamptz,
    null::uuid,
    null::uuid,
    'BANK_TRANSFER',
    '2026-05-08 16:30:00-03'::timestamptz,
    '2026-05-08'::date,
    'Clima Forte Manutencoes',
    'Manutencao',
    'NF-SEED-1002',
    null::uuid
  from _hotel_seed_target t
  union all
  select
    '00000000-0000-4000-8000-000000007005'::uuid,
    t.hotel_id,
    'EXPENSE'::public.transaction_type,
    'Energia eletrica',
    980.00,
    t.currency,
    'Conta de energia com vencimento proximo.',
    'PENDING'::public.transaction_status,
    '2026-05-12 08:00:00-03'::timestamptz,
    null::uuid,
    null::uuid,
    null,
    null::timestamptz,
    '2026-05-17'::date,
    'Distribuidora de Energia',
    'Operacao',
    'BOL-SEED-2001',
    null::uuid
  from _hotel_seed_target t
  union all
  select
    '00000000-0000-4000-8000-000000007006'::uuid,
    t.hotel_id,
    'REFUND'::public.transaction_type,
    'Estorno',
    120.00,
    t.currency,
    'Estorno parcial por ajuste de diaria.',
    'REFUNDED'::public.transaction_status,
    '2026-05-06 14:30:00-03'::timestamptz,
    '00000000-0000-4000-8000-000000004003'::uuid,
    '00000000-0000-4000-8000-000000004003'::uuid,
    'PIX',
    '2026-05-06 14:30:00-03'::timestamptz,
    '2026-05-06'::date,
    'Carla Menezes',
    'Recepcao',
    'REF-SEED-0001',
    null::uuid
  from _hotel_seed_target t
) as seed (
  id,
  hotel_id,
  type,
  category,
  amount,
  currency,
  description,
  status,
  created_at,
  stay_id,
  reservation_id,
  payment_method,
  paid_at,
  due_date,
  counterparty,
  cost_center,
  reference_code,
  created_by
)
on conflict (id) do update
set
  hotel_id = excluded.hotel_id,
  type = excluded.type,
  category = excluded.category,
  amount = excluded.amount,
  currency = excluded.currency,
  description = excluded.description,
  status = excluded.status,
  created_at = excluded.created_at,
  stay_id = excluded.stay_id,
  reservation_id = excluded.reservation_id,
  payment_method = excluded.payment_method,
  paid_at = excluded.paid_at,
  due_date = excluded.due_date,
  counterparty = excluded.counterparty,
  cost_center = excluded.cost_center,
  reference_code = excluded.reference_code,
  created_by = excluded.created_by;

commit;

-- Sanity checks
-- select count(*) from public.customers where id between '00000000-0000-4000-8000-000000001000' and '00000000-0000-4000-8000-000000001999';
-- select count(*) from public.reservations where reservation_code like 'RSV-SEED-%';
-- select count(*) from public.financial_transactions where reference_code like '%-SEED-%';
