begin;

select plan(132);

select ok(to_regclass('public.room_blocks') is not null, 'room_blocks exists');

select is(
  (select array_agg(enumlabel order by enumsortorder)::text
   from pg_enum
   where enumtypid = 'public.room_block_status'::regtype),
  '{blocked,maintenance}',
  'room_block_status exposes only blocked and maintenance'
);

select is(
  (select array_agg(attname order by attnum)::text
   from pg_attribute
   where attrelid = 'public.room_blocks'::regclass and attnum > 0 and not attisdropped),
  '{id,room_id,status,label,start_date,end_date,created_at,updated_at,hotel_id,maintenance_occurrence_id,created_by,released_at,released_by,release_reason,conflicts_acknowledged_at,conflicts_acknowledged_by,conflicts_acknowledgement}',
  'room_blocks has the expected columns'
);

select ok(
  (select attnotnull from pg_attribute where attrelid = 'public.room_blocks'::regclass and attname = 'status'),
  'room block status is required'
);

select is(
  (select count(*)::integer
   from pg_constraint
   where conrelid = 'public.room_blocks'::regclass and contype = 'f'),
  6,
  'room_blocks keeps all scope, audit and maintenance foreign keys'
);

select ok(
  exists (select 1 from pg_constraint where conrelid = 'public.room_blocks'::regclass and conname = 'room_blocks_dates_check'),
  'room block dates are constrained'
);

select ok(
  exists (select 1 from pg_constraint where conrelid = 'public.room_blocks'::regclass and conname = 'room_blocks_room_id_dates_excl' and contype = 'x'),
  'room blocks have an overlap exclusion constraint'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.room_blocks'::regclass),
  'RLS is enabled on room_blocks'
);

select ok(
  exists (select 1 from pg_trigger where tgrelid = 'public.room_blocks'::regclass and tgname = 'trg_room_blocks_set_updated_at' and not tgisinternal),
  'room_blocks maintains updated_at'
);

select ok(
  to_regclass('public.idx_room_blocks_room_dates') is not null,
  'room_blocks lookup index exists'
);

select ok(
  has_table_privilege('service_role', 'public.room_blocks', 'SELECT'),
  'service_role can read room_blocks'
);

select ok(
  not exists (select 1 from pg_constraint where conrelid = 'public.stay_customers'::regclass and conname = 'reservation_customers_reservation_id_fkey'),
  'legacy reservation foreign key was removed from stay_customers'
);

select is(
  (select count(*)::integer from pg_constraint where conrelid = 'public.stay_customers'::regclass and contype = 'f' and confrelid = 'public.stays'::regclass),
  1,
  'stay_customers keeps exactly one stay foreign key'
);

select is((select count(*)::integer from public.hotels), 2, 'seed has two hotels');
select is((select count(*)::integer from public.rooms), 6, 'seed has six rooms');
select is((select count(*)::integer from public.customers), 4, 'seed has four customers');
select is((select count(*)::integer from public.products), 4, 'seed has four products');
select is((select count(*)::integer from public.permissions), 68, 'seed matches all canonical application permissions');
select is((select count(*)::integer from public.roles), 3, 'seed has one global role and two hotel roles');
select is((select count(*)::integer from public.users), 3, 'seed has three local users');
select is((select count(*)::integer from public.reservations), 4, 'seed has four reservations');
select is((select count(distinct stay_status)::integer from public.stays), 3, 'seed has confirmed, checked-in and checked-out stays');
select is((select count(*)::integer from public.room_blocks), 2, 'seed has two room blocks');
select is((select count(*)::integer from public.maintenance_categories), 20, 'every seeded hotel receives the ten default maintenance categories');
select is((select count(*)::integer from public.maintenance_locations), 3, 'seed has configurable maintenance locations and equipment assets');
select is((select count(*)::integer from public.maintenance_occurrences), 2, 'seed has operational and financial maintenance occurrences');
select is((select count(*)::integer from public.maintenance_work_orders), 1, 'seed has one maintenance work order');

select ok(
  to_regclass('public.maintenance_events') is not null
    and to_regclass('public.maintenance_attachments') is not null
    and to_regclass('public.maintenance_inspections') is not null,
  'maintenance audit, evidence and inspection tables exist'
);

select ok(
  (select bool_and(relrowsecurity)
   from pg_class
   where oid in (
     'public.maintenance_locations'::regclass,
     'public.maintenance_categories'::regclass,
     'public.maintenance_occurrences'::regclass,
     'public.maintenance_work_orders'::regclass,
     'public.maintenance_inspections'::regclass,
     'public.maintenance_events'::regclass,
     'public.maintenance_attachments'::regclass,
     'public.maintenance_checkout_acknowledgements'::regclass
   )),
  'RLS is enabled on every maintenance table'
);

select is(
  (select public from storage.buckets where id = 'maintenance-evidence'),
  false,
  'maintenance evidence bucket is private'
);

select is(
  (select file_size_limit from storage.buckets where id = 'maintenance-evidence'),
  10485760::bigint,
  'maintenance evidence is limited to 10 MB per object'
);

select throws_ok(
  $$
    insert into public.maintenance_occurrences (
      hotel_id, occurrence_number, kind, category_id, priority, room_id, location_id,
      description, discovered_at, reported_by
    ) values (
      '10000000-0000-4000-8000-000000000001', 1002, 'damage',
      (select id from public.maintenance_categories where hotel_id = '10000000-0000-4000-8000-000000000001' limit 1),
      'normal', '20000000-0000-4000-8000-000000000101',
      '96000000-0000-4000-8000-000000000001', 'Alvo ambíguo', now(),
      '60000000-0000-4000-8000-000000000002'
    )
  $$,
  '23514',
  null,
  'an occurrence must have exactly one target'
);

select throws_ok(
  $$
    insert into public.maintenance_work_orders (
      hotel_id, occurrence_id, title, instructions, created_by
    ) values (
      '10000000-0000-4000-8000-000000000001',
      '97000000-0000-4000-8000-000000000001', 'Hotel divergente', 'Não deve ser aceita',
      '80000000-0000-4000-8000-000000000002'
    )
  $$,
  '23514',
  null,
  'work orders cannot cross hotel boundaries'
);

select lives_ok(
  $$ select public.transition_maintenance_work_order(
    '10000000-0000-4000-8000-000000000002',
    '98000000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000003',
    'complete', null, null, 'Reparo concluído', 'Falha corrigida'
  ) $$,
  'work-order transition persists state and audit in one database operation'
);

select is(
  (select status::text from public.maintenance_work_orders where id = '98000000-0000-4000-8000-000000000001'),
  'awaiting_inspection',
  'an inspection-required order waits for inspection after completion'
);

select throws_ok(
  $$ select public.inspect_maintenance_work_order(
    '10000000-0000-4000-8000-000000000002',
    '98000000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000003',
    'approved', 'Autoinspeção indevida'
  ) $$,
  '23514',
  null,
  'the executor cannot inspect their own order'
);

select throws_ok(
  $$
    insert into public.room_blocks (hotel_id, room_id, status, label, start_date, end_date)
    values (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000103', 'blocked', 'Conflito pgTAP',
      current_date + 2, current_date + 3
    )
  $$,
  '23P01',
  null,
  'overlapping room blocks are rejected'
);

select is(
  (select count(*)::integer
   from public.stays s
   join public.rooms ro on ro.id = s.room_id
   join public.reservations r on r.id = s.reservation_id
   where ro.hotel_id <> r.hotel_id),
  0,
  'seed stays never cross hotel boundaries'
);

select is(
  (select count(*)::integer from public.role_permissions where role_id = '70000000-0000-4000-8000-000000000001'),
  16,
  'global administrator role has every system permission'
);

select is(
  (select count(*)::integer from public.role_permissions where role_id = '70000000-0000-4000-8000-000000000002'),
  52,
  'Aurora manager role has every hotel permission'
);

select is(
  (select count(*)::integer from public.role_permissions where role_id = '70000000-0000-4000-8000-000000000003'),
  52,
  'Horizonte manager role has every hotel permission'
);

select ok(
  not exists (select 1 from public.users where email !~ '@hotelaria[.]local$'),
  'all seeded user accounts use the reserved local domain'
);

select is(
  (select count(*)::integer from public.permissions where name = any(array[
    'create_maintenance_occurrence', 'read_maintenance', 'triage_maintenance', 'execute_maintenance',
    'manage_maintenance_blocks', 'inspect_maintenance', 'confirm_damage_liability', 'manage_maintenance_catalogs'
  ])),
  8,
  'maintenance permissions are provisioned independently'
);

select ok(
  exists (
    select 1
    from public.room_blocks
    where maintenance_occurrence_id = '97000000-0000-4000-8000-000000000001'
      and released_at is null
  ),
  'seed links an active room block to its maintenance occurrence'
);

select lives_ok(
  $$
    insert into public.maintenance_occurrences(
      id, hotel_id, category_id, room_id, kind, priority, description, reported_by, triaged_by, triaged_at
    ) values (
      '97100000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
      (select id from public.maintenance_categories where hotel_id = '10000000-0000-4000-8000-000000000001' limit 1),
      '20000000-0000-4000-8000-000000000102', 'defect', 'normal', 'Ocorrência para transições pgTAP',
      '80000000-0000-4000-8000-000000000002', '80000000-0000-4000-8000-000000000002', now()
    );
    insert into public.maintenance_work_orders(
      id, hotel_id, occurrence_id, title, instructions, created_by
    ) values (
      '98100000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
      '97100000-0000-4000-8000-000000000001', 'Ordem de transição', 'Validar todas as mudanças de estado',
      '80000000-0000-4000-8000-000000000002'
    );
  $$,
  'transition characterization records are created'
);

select lives_ok($$ select public.transition_maintenance_work_order(p_hotel_id => '10000000-0000-4000-8000-000000000001', p_work_order_id => '98100000-0000-4000-8000-000000000001', p_actor_id => '80000000-0000-4000-8000-000000000002', p_action => 'assign', p_assigned_to => '80000000-0000-4000-8000-000000000002') $$, 'pending order can be assigned');
select lives_ok($$ select public.transition_maintenance_work_order(p_hotel_id => '10000000-0000-4000-8000-000000000001', p_work_order_id => '98100000-0000-4000-8000-000000000001', p_actor_id => '80000000-0000-4000-8000-000000000002', p_action => 'start') $$, 'assigned order can start');
select lives_ok($$ select public.transition_maintenance_work_order(p_hotel_id => '10000000-0000-4000-8000-000000000001', p_work_order_id => '98100000-0000-4000-8000-000000000001', p_actor_id => '80000000-0000-4000-8000-000000000002', p_action => 'pause') $$, 'active order can pause');
select lives_ok($$ select public.transition_maintenance_work_order(p_hotel_id => '10000000-0000-4000-8000-000000000001', p_work_order_id => '98100000-0000-4000-8000-000000000001', p_actor_id => '80000000-0000-4000-8000-000000000002', p_action => 'resume') $$, 'paused order can resume');
select lives_ok($$ select public.transition_maintenance_work_order(p_hotel_id => '10000000-0000-4000-8000-000000000001', p_work_order_id => '98100000-0000-4000-8000-000000000001', p_actor_id => '80000000-0000-4000-8000-000000000002', p_action => 'wait', p_waiting_reason => 'parts', p_notes => 'Aguardando peça') $$, 'active order can wait with a reason');
select lives_ok($$ select public.transition_maintenance_work_order(p_hotel_id => '10000000-0000-4000-8000-000000000001', p_work_order_id => '98100000-0000-4000-8000-000000000001', p_actor_id => '80000000-0000-4000-8000-000000000002', p_action => 'resume') $$, 'waiting order can resume');
select lives_ok($$ select public.transition_maintenance_work_order(p_hotel_id => '10000000-0000-4000-8000-000000000001', p_work_order_id => '98100000-0000-4000-8000-000000000001', p_actor_id => '80000000-0000-4000-8000-000000000002', p_action => 'complete', p_notes => 'Concluída') $$, 'active order can complete');
select lives_ok($$ select public.transition_maintenance_work_order(p_hotel_id => '10000000-0000-4000-8000-000000000001', p_work_order_id => '98100000-0000-4000-8000-000000000001', p_actor_id => '80000000-0000-4000-8000-000000000002', p_action => 'reopen') $$, 'completed order can reopen');
select lives_ok($$ select public.transition_maintenance_work_order(p_hotel_id => '10000000-0000-4000-8000-000000000001', p_work_order_id => '98100000-0000-4000-8000-000000000001', p_actor_id => '80000000-0000-4000-8000-000000000002', p_action => 'cancel', p_notes => 'Cancelada no teste') $$, 'active order can cancel');
select throws_ok($$ select public.transition_maintenance_work_order(p_hotel_id => '10000000-0000-4000-8000-000000000001', p_work_order_id => '98100000-0000-4000-8000-000000000001', p_actor_id => '80000000-0000-4000-8000-000000000002', p_action => 'complete') $$, '23514', null, 'invalid transition is rejected');
select is((select status::text from public.maintenance_work_orders where id = '98100000-0000-4000-8000-000000000001'), 'canceled', 'invalid transition does not change the persisted state');
select throws_ok($$ update public.maintenance_events set message = 'alterado' where id = (select id from public.maintenance_events limit 1) $$, '23514', null, 'maintenance timeline cannot be edited');
select throws_ok($$ delete from public.maintenance_occurrences where id = '97100000-0000-4000-8000-000000000001' $$, '23514', null, 'maintenance records cannot be hard deleted');

select is(
  (select count(*)::integer from pg_class where oid in (
    'public.stay_folio_entries'::regclass, 'public.stay_folio_allocations'::regclass,
    'public.maintenance_cost_items'::regclass, 'public.maintenance_recoveries'::regclass,
    'public.maintenance_financial_settlements'::regclass, 'public.maintenance_financial_attachments'::regclass,
    'public.maintenance_financial_checkout_acknowledgements'::regclass
  )),
  7,
  'maintenance finance creates all ledger and workflow tables'
);

select is(
  (select count(*)::integer from pg_type where typname in (
    'stay_folio_direction', 'stay_folio_kind', 'maintenance_cost_kind',
    'maintenance_finance_approval_status', 'maintenance_finance_settlement_status'
  )),
  5,
  'maintenance finance enums exist'
);

select is(
  (select count(*)::integer from pg_class where relrowsecurity and oid in (
    'public.stay_folio_entries'::regclass, 'public.stay_folio_allocations'::regclass,
    'public.maintenance_cost_items'::regclass, 'public.maintenance_recoveries'::regclass,
    'public.maintenance_financial_settlements'::regclass, 'public.maintenance_financial_attachments'::regclass,
    'public.maintenance_financial_checkout_acknowledgements'::regclass
  )),
  7,
  'RLS is enabled on every maintenance finance table'
);

select is(
  (select count(*)::integer from public.permissions where name = any(array[
    'read_maintenance_finance', 'propose_maintenance_finance',
    'approve_maintenance_finance', 'settle_maintenance_finance'
  ])),
  4,
  'maintenance finance permissions are independent'
);

select ok(
  exists (select 1 from storage.buckets where id = 'maintenance-financial-documents' and not public
    and file_size_limit = 10485760 and 'application/pdf' = any(allowed_mime_types)),
  'financial document bucket is private and accepts PDF'
);

select is(
  (select count(*)::integer from public.stay_folio_entries where kind = 'lodging'),
  (select count(*)::integer from public.stays where total_price_estimated > 0),
  'backfill creates one lodging debit per priced stay'
);

select is(
  (select count(*)::integer from public.stay_folio_entries where financial_transaction_id in (
    '94000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000002'
  )),
  2,
  'backfill imports legacy stay payments'
);

select is(
  (select coalesce(sum(case when direction = 'credit' then amount else -amount end), 0)::numeric(12,2)
   from public.stay_folio_entries where stay_id = '91000000-0000-4000-8000-000000000002'
     and kind in ('payment', 'refund', 'adjustment')),
  400.00::numeric(12,2),
  'backfill preserves the legacy paid total'
);

select lives_ok(
  $$ insert into public.maintenance_cost_items(
    id, hotel_id, occurrence_id, work_order_id, kind, description, quantity,
    estimated_amount, actual_amount, currency, counterparty, created_by
  ) values (
    '98200000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
    '97000000-0000-4000-8000-000000000001', '98000000-0000-4000-8000-000000000001',
    'material', 'Compressor de reposição', 1, 150, 120, 'BRL', 'Fornecedor sintético',
    '80000000-0000-4000-8000-000000000003'
  ) $$,
  'a cost item can be attached to a work order'
);

select lives_ok(
  $$ select public.transition_maintenance_cost_item(
    '10000000-0000-4000-8000-000000000002', '98200000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000003', 'submit', null
  ) $$,
  'a real cost can be submitted'
);

select throws_ok(
  $$ select public.transition_maintenance_cost_item(
    '10000000-0000-4000-8000-000000000002', '98200000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000003', 'approve', null
  ) $$,
  '23514', null,
  'the cost author cannot approve their own item'
);

select lives_ok(
  $$ select public.transition_maintenance_cost_item(
    '10000000-0000-4000-8000-000000000002', '98200000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000001', 'approve', null
  ) $$,
  'a different authorized actor can approve a cost'
);

select lives_ok(
  $$ select public.settle_maintenance_cost_item(
    '10000000-0000-4000-8000-000000000002', '98200000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000003', 50, 'pix', now(), 'PGTAP-COST', 'Pagamento parcial'
  ) $$,
  'an approved cost can be paid partially'
);

select is(
  (select settlement_status::text from public.maintenance_cost_items where id = '98200000-0000-4000-8000-000000000001'),
  'partially_settled',
  'partial payment updates cost settlement state'
);

select throws_ok(
  $$ update public.financial_transactions set amount = 51 where maintenance_cost_item_id = '98200000-0000-4000-8000-000000000001' $$,
  '23514', null,
  'generated transactions cannot be edited'
);

select lives_ok(
  $$ select public.reverse_maintenance_financial_settlement(
    '10000000-0000-4000-8000-000000000002',
    (select id from public.maintenance_financial_settlements
      where cost_item_id = '98200000-0000-4000-8000-000000000001'
        and reversal_of_id is null limit 1),
    '80000000-0000-4000-8000-000000000001',
    'Estorno de caracterização', now()
  ) $$,
  'a settlement can be reversed with a compensating transaction'
);

select is(
  (select settlement_status::text from public.maintenance_cost_items
    where id = '98200000-0000-4000-8000-000000000001'),
  'open',
  'reversing the only payment reopens the payable item'
);

select is(
  (select count(*)::integer from public.financial_transactions
    where maintenance_cost_item_id = '98200000-0000-4000-8000-000000000001'
      and type = 'REFUND' and category = 'MAINTENANCE_REVERSAL'),
  1,
  'reversal preserves the original cash record and creates one refund'
);

select lives_ok(
  $$
    insert into public.maintenance_occurrences(
      id, hotel_id, category_id, room_id, stay_id, kind, priority, description, reported_by,
      liability_status, confirmed_party, liability_notes, liability_decided_by, liability_decided_at
    ) values (
      '97200000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
      (select id from public.maintenance_categories where hotel_id = '10000000-0000-4000-8000-000000000001' limit 1),
      '20000000-0000-4000-8000-000000000102', '91000000-0000-4000-8000-000000000002',
      'damage', 'normal', 'Dano com recuperação financeira', '80000000-0000-4000-8000-000000000002',
      'confirmed', 'guest', 'Responsabilidade confirmada no teste', '80000000-0000-4000-8000-000000000001', now()
    );
    insert into public.maintenance_cost_items(
      id, hotel_id, occurrence_id, kind, description, actual_amount, currency, approval_status,
      settlement_status, created_by, submitted_at, approved_by, approved_at
    ) values (
      '98200000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
      '97200000-0000-4000-8000-000000000001', 'other', 'Custo aprovado da recuperação', 100, 'BRL',
      'approved', 'open', '80000000-0000-4000-8000-000000000002', now(),
      '80000000-0000-4000-8000-000000000001', now()
    );
    insert into public.maintenance_recoveries(
      id, hotel_id, occurrence_id, responsible_party, stay_id, charge_amount, waived_amount,
      currency, justification, created_by
    ) values (
      '98300000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
      '97200000-0000-4000-8000-000000000001', 'guest', '91000000-0000-4000-8000-000000000002',
      101, 0, 'BRL', 'Cobrança inicialmente acima do custo', '80000000-0000-4000-8000-000000000002'
    );
  $$,
  'recovery characterization records are created'
);

select lives_ok(
  $$ select public.transition_maintenance_recovery(
    '10000000-0000-4000-8000-000000000001', '98300000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000002', 'submit', null
  ) $$,
  'a recovery matching confirmed liability can be submitted'
);

select throws_ok(
  $$ select public.transition_maintenance_recovery(
    '10000000-0000-4000-8000-000000000001', '98300000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000001', 'approve', null
  ) $$,
  '23514', null,
  'recovery above approved actual costs is rejected'
);

select lives_ok(
  $$
    update public.maintenance_recoveries set charge_amount = 80, waived_amount = 20
    where id = '98300000-0000-4000-8000-000000000001';
    select public.transition_maintenance_recovery(
      '10000000-0000-4000-8000-000000000001', '98300000-0000-4000-8000-000000000001',
      '80000000-0000-4000-8000-000000000001', 'approve', null
    );
  $$,
  'recovery at the approved cost cap can be approved'
);

select ok(
  exists (select 1 from public.stay_folio_entries where maintenance_occurrence_id = '97200000-0000-4000-8000-000000000001'
    and kind = 'maintenance_charge' and amount = 80),
  'approved guest recovery posts a folio debit'
);

select throws_ok(
  $$ select public.checkout_stay_with_financial_acknowledgements(
    '10000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002',
    '80000000-0000-4000-8000-000000000002', array['97200000-0000-4000-8000-000000000001']::uuid[],
    array[]::uuid[], 'Ciência incompleta'
  ) $$,
  '23514', null,
  'checkout rejects an unacknowledged maintenance charge'
);

select lives_ok(
  $$ select public.checkout_stay_with_financial_acknowledgements(
    '10000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002',
    '80000000-0000-4000-8000-000000000002', array['97200000-0000-4000-8000-000000000001']::uuid[],
    array[(select folio_entry_id from public.maintenance_recoveries where id = '98300000-0000-4000-8000-000000000001')]::uuid[],
    'Ciência operacional e financeira'
  ) $$,
  'checkout accepts explicit financial acknowledgement'
);

select throws_ok(
  $$ insert into public.stay_folio_allocations(hotel_id, stay_id, credit_entry_id, debit_entry_id, amount)
     select entry.hotel_id, entry.stay_id, entry.id,
       (select id from public.stay_folio_entries where stay_id = entry.stay_id and direction = 'debit' order by created_at limit 1),
       entry.amount + 1
     from public.stay_folio_entries entry where entry.direction = 'credit' limit 1 $$,
  '23514', null,
  'folio credits cannot be overallocated'
);

select throws_ok(
  $$ insert into public.maintenance_cost_items(
    hotel_id, occurrence_id, kind, description, actual_amount, currency, created_by
  ) values (
    '10000000-0000-4000-8000-000000000002', '97200000-0000-4000-8000-000000000001',
    'other', 'Custo cruzando hotel', 10, 'BRL', '80000000-0000-4000-8000-000000000003'
  ) $$,
  '23514', null,
  'maintenance finance rejects cross-hotel records'
);

select ok(
  to_regclass('public.maintenance_preventive_plans') is not null
    and to_regclass('public.maintenance_sla_policies') is not null
    and to_regclass('public.maintenance_suppliers') is not null
    and to_regclass('public.maintenance_notifications') is not null
    and to_regclass('public.maintenance_automation_runs') is not null,
  'advanced maintenance creates preventive, SLA, supplier, notification and automation tables'
);

select ok(
  (select bool_and(relrowsecurity) from pg_class where oid = any(array[
    'public.maintenance_sla_policies'::regclass, 'public.maintenance_preventive_plans'::regclass,
    'public.maintenance_preventive_plan_tasks'::regclass, 'public.maintenance_preventive_runs'::regclass,
    'public.maintenance_work_order_checklist_items'::regclass, 'public.maintenance_suppliers'::regclass,
    'public.maintenance_supplier_contacts'::regclass, 'public.maintenance_contracts'::regclass,
    'public.maintenance_notifications'::regclass, 'public.maintenance_automation_runs'::regclass
  ])),
  'RLS is enabled on advanced maintenance tables'
);

select is(
  (select count(*)::integer from public.permissions where name in (
    'manage_maintenance_plans', 'manage_maintenance_sla',
    'manage_maintenance_suppliers', 'read_maintenance_analytics'
  )), 4, 'advanced maintenance permissions are independent'
);

select ok(
  exists (select 1 from storage.buckets where id = 'maintenance-management-documents' and not public and file_size_limit = 10485760),
  'management documents use a private 10 MB bucket'
);

select is((select count(*)::integer from public.maintenance_sla_policies), 8, 'four default SLA policies are provisioned for every hotel');
select is((select count(*)::integer from public.maintenance_suppliers), 1, 'seed has one synthetic supplier');
select is((select count(*)::integer from public.maintenance_contracts), 1, 'seed has one synthetic contract');
select is((select count(*)::integer from public.maintenance_preventive_plans), 1, 'seed has one preventive plan');

select is(
  public.next_maintenance_preventive_date('2027-01-31', 'monthly', 1, 31),
  '2027-02-28'::date,
  'monthly recurrence clamps nonexistent dates to the last day'
);

select is(
  public.next_maintenance_preventive_date('2024-02-29', 'yearly', 1, 29),
  '2025-02-28'::date,
  'yearly recurrence clamps leap day in non-leap years'
);

select throws_ok(
  $$ update public.maintenance_preventive_plans
     set assigned_to = '80000000-0000-4000-8000-000000000003'
     where id = '99600000-0000-4000-8000-000000000001' $$,
  '23514', null,
  'preventive plans reject cross-hotel assignees'
);

select lives_ok(
  $$ select public.process_maintenance_management_cycle(now(), '10000000-0000-4000-8000-000000000001', true) $$,
  'manual automation cycle is reprocessable'
);

select is(
  (select count(*)::integer from public.maintenance_preventive_runs where plan_id = '99600000-0000-4000-8000-000000000001' and status = 'generated'),
  1, 'automation generates exactly one run for the due competence'
);

select is(
  (select count(*)::integer from public.maintenance_occurrences where preventive_plan_id = '99600000-0000-4000-8000-000000000001' and kind = 'preventive'),
  1, 'a preventive run creates one preventive occurrence'
);

select is(
  (select count(*)::integer from public.maintenance_work_order_checklist_items checklist
    join public.maintenance_preventive_runs run on run.work_order_id = checklist.work_order_id
    where run.plan_id = '99600000-0000-4000-8000-000000000001'),
  2, 'generated checklist is an independent snapshot of the plan tasks'
);

select ok(
  (select work_order.assigned_to is not null from public.maintenance_work_orders work_order
    join public.maintenance_preventive_runs run on run.work_order_id = work_order.id
    where run.plan_id = '99600000-0000-4000-8000-000000000001'),
  'supplier linkage never replaces the required internal assignee'
);

select lives_ok(
  $$ select public.transition_maintenance_work_order(
    '10000000-0000-4000-8000-000000000001',
    (select work_order_id from public.maintenance_preventive_runs where plan_id = '99600000-0000-4000-8000-000000000001'),
    '80000000-0000-4000-8000-000000000002', 'start'
  ) $$,
  'generated preventive work can start'
);

select throws_ok(
  $$ select public.transition_maintenance_work_order(
    '10000000-0000-4000-8000-000000000001',
    (select work_order_id from public.maintenance_preventive_runs where plan_id = '99600000-0000-4000-8000-000000000001'),
    '80000000-0000-4000-8000-000000000002', 'complete'
  ) $$,
  '23514', null,
  'required checklist items block premature completion'
);

select lives_ok(
  $$ select public.complete_maintenance_checklist_item(
      checklist.hotel_id, checklist.work_order_id, checklist.id,
      '80000000-0000-4000-8000-000000000002', true, 'Conferido no pgTAP'
    ) from public.maintenance_work_order_checklist_items checklist
    join public.maintenance_preventive_runs run on run.work_order_id = checklist.work_order_id
    where run.plan_id = '99600000-0000-4000-8000-000000000001' $$,
  'all checklist items can be completed atomically with audit events'
);

select lives_ok(
  $$ select public.transition_maintenance_work_order(
    '10000000-0000-4000-8000-000000000001',
    (select work_order_id from public.maintenance_preventive_runs where plan_id = '99600000-0000-4000-8000-000000000001'),
    '80000000-0000-4000-8000-000000000002', 'complete', null, null,
    'Preventiva concluída com checklist', 'Equipamento revisado'
  ) $$,
  'preventive work completes after its required checklist'
);

select lives_ok(
  $$ select public.process_maintenance_sla_alerts(
    '10000000-0000-4000-8000-000000000002',
    (select sla_resolution_due_at from public.maintenance_occurrences where id = '97000000-0000-4000-8000-000000000001')
  ) $$,
  'SLA emits the initial breach alert at the exact due time'
);

select ok(
  exists (select 1 from public.maintenance_notifications
    where entity_id = '97000000-0000-4000-8000-000000000001'
      and kind = 'sla_resolution' and threshold = 'resolution-breach:0'),
  'initial SLA breach uses the zero-day threshold'
);

select lives_ok(
  $$ select public.process_maintenance_sla_alerts(
    '10000000-0000-4000-8000-000000000002',
    (select sla_resolution_due_at + interval '23 hours' from public.maintenance_occurrences where id = '97000000-0000-4000-8000-000000000001')
  ) $$,
  'SLA processing remains idempotent before the next 24-hour threshold'
);

select lives_ok(
  $$ select public.process_maintenance_sla_alerts(
    '10000000-0000-4000-8000-000000000002',
    (select sla_resolution_due_at + interval '24 hours' from public.maintenance_occurrences where id = '97000000-0000-4000-8000-000000000001')
  ) $$,
  'SLA emits another alert after each complete 24 hours of violation'
);

select ok(
  exists (select 1 from public.maintenance_notifications
    where entity_id = '97000000-0000-4000-8000-000000000001'
      and kind = 'sla_resolution' and threshold = 'resolution-breach:1'),
  'repeated SLA breach advances exactly at the 24-hour threshold'
);

select ok(to_regclass('public.product_categories') is not null and to_regclass('public.catalog_audit_events') is not null, 'catalog tables exist');
select is((select count(*)::integer from public.products where category_id is null), 0, 'every product has a controlled category');
select throws_ok(
  $$ insert into public.product_categories(hotel_id, name) values ('10000000-0000-4000-8000-000000000001', 'frigobar') $$,
  '23505', null, 'categories are unique without case sensitivity per hotel'
);
select throws_ok(
  $$ update public.products set category_id = '41000000-0000-4000-8000-000000000003' where id = '40000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'products reject a category from another hotel'
);
select throws_ok(
  $$ delete from public.products where id = '40000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'products cannot be hard deleted'
);
select ok(exists(select 1 from public.catalog_audit_events where entity_type = 'product' and entity_id = '40000000-0000-4000-8000-000000000001'), 'seed product has an immutable audit event');
select throws_ok(
  $$ update public.catalog_audit_events set action = 'altered' where id = (select id from public.catalog_audit_events limit 1) $$,
  '23514', null, 'catalog audit events are immutable'
);

select ok(
  to_regclass('public.consumption_points') is not null
    and to_regclass('public.consumption_offers') is not null
    and to_regclass('public.consumption_configuration_audit_events') is not null,
  'consumption configuration tables exist'
);
select is(
  (select array_agg(enumlabel order by enumsortorder)::text from pg_enum
    where enumtypid = 'public.consumption_billing_mode'::regtype),
  '{hotel_immediate,stay_folio,partner_direct}',
  'billing modes reserve the future partner mode'
);
select ok(
  (select bool_and(relrowsecurity) from pg_class
    where oid in ('public.consumption_points'::regclass, 'public.consumption_offers'::regclass,
      'public.consumption_configuration_audit_events'::regclass)),
  'RLS is enabled on consumption configuration'
);
select is(
  (select count(*)::integer from public.permissions where name in (
    'read_consumption', 'manage_consumption_settings', 'post_consumption',
    'receive_consumption_payment', 'grant_consumption_courtesy',
    'void_consumption', 'approve_consumption_adjustment'
  )),
  7,
  'all consumption permissions are registered'
);
select lives_ok(
  $$ insert into public.consumption_points(
      id, hotel_id, name, internal_code, default_allowed_billing_modes,
      default_billing_mode, last_changed_by
    ) values (
      'a1000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
      'Recepção', 'REC', array['hotel_immediate', 'stay_folio']::public.consumption_billing_mode[],
      'stay_folio', '80000000-0000-4000-8000-000000000002'
    ) $$,
  'a scoped consumption point can be created'
);
select lives_ok(
  $$ insert into public.consumption_offers(
      id, hotel_id, point_id, product_id, policy_source, last_changed_by
    ) values (
      'a2000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
      'a1000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001',
      'inherit', '80000000-0000-4000-8000-000000000002'
    ) $$,
  'a product can inherit its point billing policy'
);
select throws_ok(
  $$ insert into public.consumption_points(
      hotel_id, name, default_allowed_billing_modes, default_billing_mode
    ) values (
      '10000000-0000-4000-8000-000000000001', 'recepção',
      array['stay_folio']::public.consumption_billing_mode[], 'stay_folio'
    ) $$,
  '23505', null, 'point names are unique without case sensitivity per hotel'
);
select throws_ok(
  $$ insert into public.consumption_offers(
      hotel_id, point_id, product_id, policy_source
    ) values (
      '10000000-0000-4000-8000-000000000001',
      'a1000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003', 'inherit'
    ) $$,
  '23514', null, 'offers reject products from another hotel'
);
select throws_ok(
  $$ insert into public.consumption_points(
      hotel_id, name, default_allowed_billing_modes, default_billing_mode
    ) values (
      '10000000-0000-4000-8000-000000000001', 'Parceiro futuro',
      array['partner_direct']::public.consumption_billing_mode[], 'partner_direct'
    ) $$,
  '23514', null, 'partner direct payment remains unavailable before stage three'
);
select throws_ok(
  $$ update public.consumption_points
    set default_allowed_billing_modes = array['hotel_immediate']::public.consumption_billing_mode[],
      default_billing_mode = 'stay_folio'
    where id = 'a1000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'point default mode must be allowed'
);
select throws_ok(
  $$ delete from public.consumption_points where id = 'a1000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'consumption points cannot be hard deleted'
);
select throws_ok(
  $$ delete from public.consumption_offers where id = 'a2000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'consumption offers cannot be hard deleted'
);
select ok(
  exists(select 1 from public.consumption_configuration_audit_events
    where entity_id in ('a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001')),
  'consumption configuration writes create audit events'
);
select throws_ok(
  $$ update public.consumption_configuration_audit_events set action = 'altered'
    where entity_id = 'a1000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'consumption configuration audit is immutable'
);
select is(
  public.reorder_consumption_points(
    '10000000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000002',
    array['a1000000-0000-4000-8000-000000000001']::uuid[]
  ),
  'ok',
  'point ordering validates the complete non-archived list'
);

select * from finish();

rollback;
