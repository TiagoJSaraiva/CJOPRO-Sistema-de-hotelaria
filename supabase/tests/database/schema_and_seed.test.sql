begin;

select plan(29);

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
  '{id,room_id,status,label,start_date,end_date,created_at,updated_at}',
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
  1,
  'room_blocks has one foreign key'
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
select is((select count(*)::integer from public.permissions), 45, 'seed matches all canonical application permissions');
select is((select count(*)::integer from public.roles), 3, 'seed has one global role and two hotel roles');
select is((select count(*)::integer from public.users), 3, 'seed has three local users');
select is((select count(*)::integer from public.reservations), 4, 'seed has four reservations');
select is((select count(distinct stay_status)::integer from public.stays), 3, 'seed has confirmed, checked-in and checked-out stays');
select is((select count(*)::integer from public.room_blocks), 2, 'seed has two room blocks');

select throws_ok(
  $$
    insert into public.room_blocks (room_id, status, label, start_date, end_date)
    values ('20000000-0000-4000-8000-000000000103', 'blocked', 'Conflito pgTAP', current_date + 2, current_date + 3)
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
  29,
  'Aurora manager role has every hotel permission'
);

select is(
  (select count(*)::integer from public.role_permissions where role_id = '70000000-0000-4000-8000-000000000003'),
  29,
  'Horizonte manager role has every hotel permission'
);

select ok(
  not exists (select 1 from public.users where email !~ '@hotelaria[.]local$'),
  'all seeded user accounts use the reserved local domain'
);

select * from finish();

rollback;
