-- Dados sinteticos e deterministas para desenvolvimento e testes locais.
-- A senha de todas as contas abaixo e: Hotelaria123!

insert into public.hotels (
  id, name, legal_name, tax_id, email, phone, address_line, address_number,
  district, city, state, country, zip_code, checkin_time_start,
  checkout_time_start, timezone, currency, is_active, subscription_plan,
  subscription_status, max_users, max_rooms, slug, checkin_time_limit,
  checkout_time_limit
) values
  (
    '10000000-0000-4000-8000-000000000001', 'Hotel Aurora', 'Hotel Aurora Desenvolvimento Ltda.',
    '04252011000110', 'aurora@hotelaria.local', '+5511999990001', 'Rua das Flores', '100',
    'Centro', 'Sao Paulo', 'SP', 'Brasil', '01001000', '14:00', '11:00',
    'America/Sao_Paulo', 'BRL', true, 'development', 'active', 20, 50,
    'hotel-aurora', '22:00', '12:00'
  ),
  (
    '10000000-0000-4000-8000-000000000002', 'Hotel Horizonte', 'Hotel Horizonte Desenvolvimento Ltda.',
    '11222333000181', 'horizonte@hotelaria.local', '+5511999990002', 'Avenida do Mar', '200',
    'Praia', 'Santos', 'SP', 'Brasil', '11010000', '15:00', '12:00',
    'America/Sao_Paulo', 'BRL', true, 'development', 'active', 20, 50,
    'hotel-horizonte', '23:00', '13:00'
  );

insert into public.rooms (
  id, hotel_id, room_number, room_type, max_occupancy, base_daily_rate, status, notes
) values
  ('20000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000001', '101', 'Standard', 2, 220.00, 'available', 'Quarto sintetico'),
  ('20000000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000001', '102', 'Luxo', 3, 340.00, 'occupied', 'Quarto sintetico'),
  ('20000000-0000-4000-8000-000000000103', '10000000-0000-4000-8000-000000000001', '103', 'Standard', 2, 220.00, 'blocked', 'Quarto sintetico'),
  ('20000000-0000-4000-8000-000000000201', '10000000-0000-4000-8000-000000000002', '201', 'Standard', 2, 190.00, 'available', 'Quarto sintetico'),
  ('20000000-0000-4000-8000-000000000202', '10000000-0000-4000-8000-000000000002', '202', 'Familia', 4, 310.00, 'available', 'Quarto sintetico'),
  ('20000000-0000-4000-8000-000000000203', '10000000-0000-4000-8000-000000000002', '203', 'Standard', 2, 190.00, 'maintenance', 'Quarto sintetico');

insert into public.customers (
  id, hotel_id, full_name, document_number, document_type, email, mobile_phone,
  birth_date, nationality, notes
) values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Ana Exemplo', '11111111111', 'CPF', 'ana@guest.local', '+5511988880001', '1990-01-10', 'Brasileira', 'Cliente sintetico'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Bruno Exemplo', '22222222222', 'CPF', 'bruno@guest.local', '+5511988880002', '1985-05-20', 'Brasileira', 'Cliente sintetico'),
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'Carla Exemplo', '33333333333', 'CPF', 'carla@guest.local', '+5511988880003', '1992-08-15', 'Brasileira', 'Cliente sintetico'),
  ('30000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'Diego Exemplo', '44444444444', 'CPF', 'diego@guest.local', '+5511988880004', '1978-12-03', 'Brasileira', 'Cliente sintetico');

insert into public.product_categories (id, hotel_id, name, display_order, is_active) values
  ('41000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Frigobar', 1, true),
  ('41000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Alimentacao', 2, true),
  ('41000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'Frigobar', 1, true),
  ('41000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'Servico', 2, true);

insert into public.products (id, hotel_id, name, category_id, description, internal_code, kind, sales_unit, unit_price, status) values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Agua mineral', '41000000-0000-4000-8000-000000000001', null, 'AGUA-001', 'physical', 'unit', 8.00, 'active'),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Cafe da manha', '41000000-0000-4000-8000-000000000002', null, 'CAFE-001', 'service', 'person', 45.00, 'active'),
  ('40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'Agua de coco', '41000000-0000-4000-8000-000000000003', null, 'COCO-001', 'physical', 'unit', 12.00, 'active'),
  ('40000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'Estacionamento', '41000000-0000-4000-8000-000000000004', null, 'ESTAC-001', 'service', 'daily', 35.00, 'active');

insert into public.seasons (id, hotel_id, name, start_date, end_date, is_active) values
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Temporada local Aurora', current_date - 30, current_date + 90, true),
  ('50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Temporada local Horizonte', current_date - 30, current_date + 90, true);

insert into public.season_room_rates (id, season_id, hotel_id, room_type, daily_rate) values
  ('51000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Standard', 250.00),
  ('51000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Luxo', 390.00),
  ('51000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Standard', 210.00),
  ('51000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Familia', 350.00);

with permission_seed(name, type, ordinal) as (
  values
    ('create_hotel', 'SYSTEM_PERMISSION', 1), ('read_hotel', 'SYSTEM_PERMISSION', 2),
    ('update_hotel', 'SYSTEM_PERMISSION', 3), ('delete_hotel', 'SYSTEM_PERMISSION', 4),
    ('create_user', 'SYSTEM_PERMISSION', 5), ('read_user', 'SYSTEM_PERMISSION', 6),
    ('update_user', 'SYSTEM_PERMISSION', 7), ('delete_user', 'SYSTEM_PERMISSION', 8),
    ('create_role', 'SYSTEM_PERMISSION', 9), ('read_role', 'SYSTEM_PERMISSION', 10),
    ('update_role', 'SYSTEM_PERMISSION', 11), ('delete_role', 'SYSTEM_PERMISSION', 12),
    ('create_permission', 'SYSTEM_PERMISSION', 13), ('read_permission', 'SYSTEM_PERMISSION', 14),
    ('update_permission', 'SYSTEM_PERMISSION', 15), ('delete_permission', 'SYSTEM_PERMISSION', 16),
    ('create_room', 'HOTEL_PERMISSION', 17), ('read_room', 'HOTEL_PERMISSION', 18),
    ('update_room', 'HOTEL_PERMISSION', 19), ('delete_room', 'HOTEL_PERMISSION', 20),
    ('create_customer', 'HOTEL_PERMISSION', 21), ('read_customer', 'HOTEL_PERMISSION', 22),
    ('update_customer', 'HOTEL_PERMISSION', 23), ('delete_customer', 'HOTEL_PERMISSION', 24),
    ('create_reservation', 'HOTEL_PERMISSION', 25), ('read_reservation', 'HOTEL_PERMISSION', 26),
    ('update_reservation', 'HOTEL_PERMISSION', 27), ('delete_reservation', 'HOTEL_PERMISSION', 28),
    ('access_reservations_calendar', 'HOTEL_PERMISSION', 29),
    ('create_transactions', 'HOTEL_PERMISSION', 30), ('read_transactions', 'HOTEL_PERMISSION', 31),
    ('update_transactions', 'HOTEL_PERMISSION', 32), ('delete_transactions', 'HOTEL_PERMISSION', 33),
    ('create_product', 'HOTEL_PERMISSION', 34), ('read_product', 'HOTEL_PERMISSION', 35),
    ('update_product', 'HOTEL_PERMISSION', 36), ('delete_product', 'HOTEL_PERMISSION', 37),
    ('create_season', 'HOTEL_PERMISSION', 38), ('read_season', 'HOTEL_PERMISSION', 39),
    ('update_season', 'HOTEL_PERMISSION', 40), ('delete_season', 'HOTEL_PERMISSION', 41),
    ('create_season_room_rate', 'HOTEL_PERMISSION', 42), ('read_season_room_rate', 'HOTEL_PERMISSION', 43),
    ('update_season_room_rate', 'HOTEL_PERMISSION', 44), ('delete_season_room_rate', 'HOTEL_PERMISSION', 45)
)
insert into public.permissions (id, name, type)
select ('60000000-0000-4000-8000-' || lpad(ordinal::text, 12, '0'))::uuid, name, type
from permission_seed;

insert into public.roles (id, name, hotel_id, role_type) values
  ('70000000-0000-4000-8000-000000000001', 'Administrador global local', null, 'SYSTEM_ROLE'),
  ('70000000-0000-4000-8000-000000000002', 'Gerente local Aurora', '10000000-0000-4000-8000-000000000001', 'HOTEL_ROLE'),
  ('70000000-0000-4000-8000-000000000003', 'Gerente local Horizonte', '10000000-0000-4000-8000-000000000002', 'HOTEL_ROLE');

insert into public.role_permissions (role_id, permission_id)
select '70000000-0000-4000-8000-000000000001', id
from public.permissions
where type = 'SYSTEM_PERMISSION';

insert into public.role_permissions (role_id, permission_id)
select role_id, permission_id
from (
  select '70000000-0000-4000-8000-000000000002'::uuid as role_id, id as permission_id
  from public.permissions where type = 'HOTEL_PERMISSION'
  union all
  select '70000000-0000-4000-8000-000000000003'::uuid as role_id, id as permission_id
  from public.permissions where type = 'HOTEL_PERMISSION'
) assignments;

insert into public.users (id, name, email, password_hash, is_active) values
  ('80000000-0000-4000-8000-000000000001', 'Administrador Local', 'admin@hotelaria.local', '$argon2id$v=19$m=19456,p=1,t=2$onjiG86/AqT6bedYpgHzZQ$PUjNUfz0DrhpzUSgSN92SSFDvl4W2TOW2slMH5Bhc9k', true),
  ('80000000-0000-4000-8000-000000000002', 'Gerente Aurora', 'gerente.aurora@hotelaria.local', '$argon2id$v=19$m=19456,p=1,t=2$onjiG86/AqT6bedYpgHzZQ$PUjNUfz0DrhpzUSgSN92SSFDvl4W2TOW2slMH5Bhc9k', true),
  ('80000000-0000-4000-8000-000000000003', 'Gerente Horizonte', 'gerente.horizonte@hotelaria.local', '$argon2id$v=19$m=19456,p=1,t=2$onjiG86/AqT6bedYpgHzZQ$PUjNUfz0DrhpzUSgSN92SSFDvl4W2TOW2slMH5Bhc9k', true);

insert into public.user_roles (user_id, role_id, hotel_id) values
  ('80000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', null),
  ('80000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001'),
  ('80000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002');

insert into public.reservations (
  id, hotel_id, booking_customer_id, reservation_code, guest_count,
  estimated_total_price, final_total_price, total_paid, reservation_source, notes
) values
  ('90000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'LOCAL-AUR-001', 2, 500.00, 500.00, 0, 'front_desk', 'Reserva confirmada sintetica'),
  ('90000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 'LOCAL-AUR-002', 2, 780.00, 780.00, 400.00, 'website', 'Hospedagem ativa sintetica'),
  ('90000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'LOCAL-AUR-003', 1, 440.00, 456.00, 456.00, 'phone', 'Hospedagem encerrada sintetica'),
  ('90000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', 'LOCAL-HOR-001', 3, 1050.00, 1050.00, 0, 'agency', 'Reserva confirmada sintetica');

insert into public.stays (
  id, reservation_id, room_id, applied_daily_rate, total_price_estimated,
  checkin_date_expected, checkout_date_expected, checkin_date_actual,
  checkout_date_actual, total_paid, stay_status
) values
  ('91000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000101', 250.00, 500.00, current_date + 5 + time '14:00', current_date + 7 + time '11:00', null, null, 0, 'confirmed'),
  ('91000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000102', 390.00, 780.00, current_date - 1 + time '14:00', current_date + 1 + time '11:00', now() - interval '1 day', null, 400.00, 'checked_in'),
  ('91000000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000101', 220.00, 440.00, current_date - 10 + time '14:00', current_date - 8 + time '11:00', now() - interval '10 days', now() - interval '8 days', 456.00, 'checked_out'),
  ('91000000-0000-4000-8000-000000000004', '90000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000202', 350.00, 1050.00, current_date + 3 + time '15:00', current_date + 6 + time '12:00', null, null, 0, 'confirmed');

insert into public.stay_customers (id, stay_id, customer_id) values
  ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001'),
  ('92000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002'),
  ('92000000-0000-4000-8000-000000000003', '91000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001'),
  ('92000000-0000-4000-8000-000000000004', '91000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000003'),
  ('92000000-0000-4000-8000-000000000005', '91000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000004');

insert into public.stay_consumption (
  id, stay_id, product_id, quantity, charged_unit_price, consumption_date, notes
) values
  ('93000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 2, 8.00, now(), 'Consumo sintetico'),
  ('93000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000001', 2, 8.00, now() - interval '9 days', 'Consumo sintetico');

insert into public.financial_transactions (
  id, hotel_id, type, category, amount, currency, description, status, stay_id,
  reservation_id, payment_method, paid_at, created_by, reference_code
) values
  ('94000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'INCOME', 'STAY_PAYMENT', 400.00, 'BRL', 'Pagamento parcial sintetico', 'COMPLETED', '91000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000002', 'credit_card', now(), '80000000-0000-4000-8000-000000000002', 'LOCAL-PAY-001'),
  ('94000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'INCOME', 'STAY_PAYMENT', 456.00, 'BRL', 'Pagamento encerrado sintetico', 'COMPLETED', '91000000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000003', 'pix', now() - interval '8 days', '80000000-0000-4000-8000-000000000002', 'LOCAL-PAY-002'),
  ('94000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'EXPENSE', 'MAINTENANCE', 120.00, 'BRL', 'Manutencao sintetica', 'COMPLETED', null, null, 'bank_transfer', now(), '80000000-0000-4000-8000-000000000003', 'LOCAL-EXP-001');

insert into public.room_blocks (id, hotel_id, room_id, status, label, start_date, end_date) values
  ('95000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000103', 'blocked', 'Limpeza programada', current_date + 1, current_date + 2),
  ('95000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000203', 'maintenance', 'Manutencao preventiva', current_date - 2, current_date + 1);

insert into public.maintenance_locations (
  id, hotel_id, kind, name, description, display_order
) values
  ('96000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'area', 'Recepção', 'Área de atendimento principal', 10),
  ('96000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'area', 'Piscina', 'Área externa da piscina', 10);

insert into public.maintenance_occurrences (
  id, occurrence_number, hotel_id, category_id, room_id, kind, priority, status,
  description, discovered_at, reported_by, blocking_recommended, triaged_by, triaged_at
)
select
  '97000000-0000-4000-8000-000000000001', 1001, '10000000-0000-4000-8000-000000000002', c.id,
  '20000000-0000-4000-8000-000000000203', 'defect', 'high', 'in_progress',
  'Ar-condicionado não refrigera adequadamente.', now() - interval '2 days',
  '80000000-0000-4000-8000-000000000003', true,
  '80000000-0000-4000-8000-000000000003', now() - interval '2 days'
from public.maintenance_categories c
where c.hotel_id = '10000000-0000-4000-8000-000000000002' and c.name = 'Climatização';

select setval('public.maintenance_occurrence_number_seq', (select max(occurrence_number) from public.maintenance_occurrences), true);

insert into public.maintenance_work_orders (
  id, hotel_id, occurrence_id, title, instructions, priority, status, assigned_to,
  due_at, requires_inspection, created_by
) values (
  '98000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
  '97000000-0000-4000-8000-000000000001', 'Revisar ar-condicionado',
  'Verificar alimentação, filtros e unidade condensadora.', 'high', 'in_progress',
  '80000000-0000-4000-8000-000000000003', now() + interval '1 day', true,
  '80000000-0000-4000-8000-000000000003'
);

update public.room_blocks
set maintenance_occurrence_id = '97000000-0000-4000-8000-000000000001',
    created_by = '80000000-0000-4000-8000-000000000003'
where id = '95000000-0000-4000-8000-000000000002';

insert into public.maintenance_events (
  hotel_id, occurrence_id, work_order_id, actor_id, event_type, message
) values
  ('10000000-0000-4000-8000-000000000002', '97000000-0000-4000-8000-000000000001', null, '80000000-0000-4000-8000-000000000003', 'occurrence_reported', 'Ocorrência sintética'),
  ('10000000-0000-4000-8000-000000000002', '97000000-0000-4000-8000-000000000001', '98000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000003', 'work_order_started', 'Ordem sintética em execução');

select public.backfill_stay_folio();

insert into public.maintenance_occurrences (
  id, occurrence_number, hotel_id, category_id, room_id, stay_id, kind, priority,
  status, description, discovered_at, reported_by, blocking_recommended,
  liability_status, suspected_party, confirmed_party, liability_notes,
  liability_decided_by, liability_decided_at, resolved_at
)
select
  '97000000-0000-4000-8000-000000000002', 1002,
  '10000000-0000-4000-8000-000000000001', c.id,
  '20000000-0000-4000-8000-000000000102',
  '91000000-0000-4000-8000-000000000002', 'damage', 'normal',
  'resolved', 'Abajur danificado durante a hospedagem.',
  now() - interval '1 day', '80000000-0000-4000-8000-000000000002', false,
  'confirmed', 'guest', 'guest', 'Responsabilidade confirmada após vistoria.',
  '80000000-0000-4000-8000-000000000001', now(), now()
from public.maintenance_categories c
where c.hotel_id = '10000000-0000-4000-8000-000000000001'
  and c.name = 'Eletrônicos';

insert into public.maintenance_cost_items (
  id, hotel_id, occurrence_id, kind, description, quantity, estimated_amount,
  actual_amount, currency, counterparty, due_date, approval_status,
  settlement_status, created_by, submitted_at
) values (
  '99000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '97000000-0000-4000-8000-000000000002', 'material',
  'Substituição do abajur danificado', 1, 200.00, 180.00, 'BRL',
  'Fornecedor sintético', current_date + 7, 'submitted', 'not_posted',
  '80000000-0000-4000-8000-000000000002', now()
);

insert into public.maintenance_recoveries (
  id, hotel_id, occurrence_id, responsible_party, stay_id, charge_amount,
  waived_amount, currency, justification, due_date, created_by
) values (
  '99100000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '97000000-0000-4000-8000-000000000002', 'guest',
  '91000000-0000-4000-8000-000000000002', 100.00, 20.00, 'BRL',
  'Recuperação parcial com dispensa justificada.', current_date + 10,
  '80000000-0000-4000-8000-000000000002'
);

insert into public.maintenance_events (
  hotel_id, occurrence_id, actor_id, event_type, message, metadata
) values (
  '10000000-0000-4000-8000-000000000001',
  '97000000-0000-4000-8000-000000000002',
  '80000000-0000-4000-8000-000000000002',
  'finance_cost_submitted', 'Custo sintético aguardando aprovação.',
  jsonb_build_object('cost_item_id', '99000000-0000-4000-8000-000000000001')
);

select setval(
  'public.maintenance_occurrence_number_seq',
  (select max(occurrence_number) from public.maintenance_occurrences),
  true
);

insert into public.maintenance_suppliers (
  id, hotel_id, name, legal_name, tax_document, email, phone, specialties,
  notes, created_by
) values (
  '99200000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Clima Local Serviços', 'Clima Local Serviços Técnicos Ltda.',
  '00.000.000/0001-00', 'contato@climalocal.example', '(11) 3000-0000',
  array['Climatização', 'Elétrica'], 'Fornecedor exclusivamente sintético.',
  '80000000-0000-4000-8000-000000000002'
);

insert into public.maintenance_supplier_contacts (
  id, hotel_id, supplier_id, name, role, email, phone, is_primary, created_by
) values (
  '99300000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '99200000-0000-4000-8000-000000000001', 'Contato Técnico Sintético',
  'Coordenação técnica', 'tecnico@climalocal.example', '(11) 3000-0001', true,
  '80000000-0000-4000-8000-000000000002'
);

insert into public.maintenance_contracts (
  id, hotel_id, supplier_id, contract_number, kind, status, starts_on, ends_on,
  renewal_notice_on, scope_notes, response_hours, resolution_hours,
  commercial_terms, contract_amount, currency, created_by
) values (
  '99400000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '99200000-0000-4000-8000-000000000001', 'LOCAL-CLIMA-001', 'fixed', 'active',
  current_date - 30, current_date + 30, current_date + 20,
  'Atendimento sintético dos equipamentos de climatização.', 4, 24,
  'Termos comerciais sintéticos para validação de redação por permissão.',
  1200.00, 'BRL', '80000000-0000-4000-8000-000000000002'
);

insert into public.maintenance_locations (
  id, hotel_id, parent_location_id, kind, name, description, display_order,
  asset_tag, manufacturer, model, serial_number, installed_on, warranty_ends_on,
  supplier_id, contract_id, lifecycle_status
) values (
  '99500000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '96000000-0000-4000-8000-000000000001', 'equipment',
  'Ar-condicionado da recepção', 'Equipamento patrimonial sintético.', 20,
  'PAT-LOCAL-001', 'Fabricante Sintético', 'Modelo Local', 'SERIE-LOCAL-001',
  current_date - 365, current_date + 30,
  '99200000-0000-4000-8000-000000000001',
  '99400000-0000-4000-8000-000000000001', 'active'
);

insert into public.maintenance_preventive_plans (
  id, hotel_id, name, category_id, location_id, assigned_to, supplier_id,
  contract_id, priority, instructions, requires_inspection,
  blocking_recommended, recurrence_unit, recurrence_interval, recurrence_day,
  starts_on, local_time, generation_lead_days, completion_due_hours,
  next_due_date, created_by
)
select
  '99600000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Revisão mensal do ar-condicionado da recepção', category.id,
  '99500000-0000-4000-8000-000000000001',
  '80000000-0000-4000-8000-000000000002',
  '99200000-0000-4000-8000-000000000001',
  '99400000-0000-4000-8000-000000000001', 'normal',
  'Inspecionar filtros, alimentação e rendimento do equipamento.', true,
  false, 'monthly', 1, extract(day from current_date)::integer,
  current_date, '09:00', 1, 24, current_date,
  '80000000-0000-4000-8000-000000000002'
from public.maintenance_categories category
where category.hotel_id = '10000000-0000-4000-8000-000000000001'
  and category.name = 'Climatização';

insert into public.maintenance_preventive_plan_tasks (
  id, hotel_id, plan_id, position, description, is_required
) values
  ('99700000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '99600000-0000-4000-8000-000000000001', 10, 'Verificar e higienizar filtros.', true),
  ('99700000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '99600000-0000-4000-8000-000000000001', 20, 'Registrar condição da unidade externa.', true);
