begin;
select no_plan();

-- QA-009: bloqueios por período precisam reduzir o estoque vendido pelo site
-- direto e pelos canais, sem depender do status global do quarto.

create function pg_temp.op_date() returns date language sql stable as $$
  select public.hotel_operational_date('10000000-0000-4000-8000-000000000001')
$$;

create function pg_temp.quote(p_offset integer, p_nights integer default 2) returns jsonb language sql as $$
  select public.quote_public_booking('hotel-aurora', jsonb_build_object(
    'checkin_date', (pg_temp.op_date() + p_offset)::text,
    'checkout_date', (pg_temp.op_date() + p_offset + p_nights)::text,
    'rooms', jsonb_build_array(jsonb_build_object('adults', 1, 'children', 0))
  ))
$$;

create function pg_temp.standard_available(p_offset integer, p_nights integer default 2) returns integer language sql as $$
  select coalesce(max((item->>'available_count')::integer), 0)
  from jsonb_array_elements(pg_temp.quote(p_offset, p_nights)->'items') item
  where item->>'room_type' = 'Standard'
$$;

create function pg_temp.block_room(p_room uuid, p_start integer, p_end integer) returns void language sql as $$
  insert into public.room_blocks (hotel_id, room_id, status, label, start_date, end_date)
  values ('10000000-0000-4000-8000-000000000001', p_room, 'blocked', 'Bloqueio pgTAP',
    pg_temp.op_date() + p_start, pg_temp.op_date() + p_end)
$$;

select is(
  (public.save_booking_configuration(
    '10000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000002',
    jsonb_build_object('published', true, 'primary_color', '#315F4D', 'introduction', 'Reserva direta de teste',
      'guarantee_instructions', 'Sinal confirmado pela equipe', 'terms', 'Termos de teste', 'consent_version', 'v1')
  )->>'result'),
  'ok', 'direct booking is published for the test'
);

select is(
  (select status::text from public.rooms where id = '20000000-0000-4000-8000-000000000103'),
  'available', 'a scheduled cleaning does not take room 103 out of operation'
);

select is(pg_temp.standard_available(30), 2, 'both Standard rooms are sold without blocks');

select pg_temp.block_room('20000000-0000-4000-8000-000000000103', 30, 31);
select is(pg_temp.standard_available(30), 1, 'a period block removes the room from the quote');
select is(pg_temp.standard_available(31, 1), 1, 'the last blocked day is still unavailable');
select is(pg_temp.standard_available(32), 2, 'the room returns to sale after the block ends');
select is(pg_temp.standard_available(28), 2, 'the room stays on sale before the block starts');

select pg_temp.block_room('20000000-0000-4000-8000-000000000101', 30, 31);
select is(pg_temp.standard_available(30), 0, 'a category with every room blocked is not offered');
select is(pg_temp.standard_available(29), 0, 'a stay crossing the blocked night is not offered');

update public.room_blocks
set released_at = now(), released_by = '80000000-0000-4000-8000-000000000002', release_reason = 'Liberado no teste'
where room_id = '20000000-0000-4000-8000-000000000101' and label = 'Bloqueio pgTAP';
select is(pg_temp.standard_available(30), 1, 'a released block returns the room to sale');

-- O status global continua valendo para quarto fora de operação por tempo indeterminado.
update public.rooms set status = 'maintenance' where id = '20000000-0000-4000-8000-000000000101';
select is(pg_temp.standard_available(50), 1, 'a room out of operation is not sold on any date');
update public.rooms set status = 'available' where id = '20000000-0000-4000-8000-000000000101';

-- Um bloqueio de outro hotel não pode alterar o estoque do Aurora.
insert into public.room_blocks (hotel_id, room_id, status, label, start_date, end_date)
select r.hotel_id, r.id, 'blocked', 'Bloqueio Horizonte', pg_temp.op_date() + 50, pg_temp.op_date() + 51
from public.rooms r
where r.hotel_id = '10000000-0000-4000-8000-000000000002' and r.status not in ('maintenance', 'blocked');
select is(pg_temp.standard_available(50), 2, 'blocks from another hotel do not change the stock');

-- QA-010: a pré-reserva do site direto precisa funcionar e consumir estoque.
create temporary table happy_quote as select pg_temp.quote(70) as value;
create temporary table happy_hold as
select public.create_public_booking_hold('hotel-aurora', jsonb_build_object(
  'idempotency_key', 'b0000000-0000-4000-8000-000000000001',
  'quote_id', value->>'quote_id',
  'quote_fingerprint', value->>'fingerprint',
  'contact_name', 'Hóspede pgTAP',
  'consent_version', 'v1',
  'selections', jsonb_build_array((
    select jsonb_build_object('quote_item_id', item->>'id', 'room_type', item->>'room_type',
      'rate_plan_version_id', item->>'rate_plan_version_id')
    from jsonb_array_elements(value->'items') item
    where item->>'room_type' = 'Standard' limit 1
  ))
)) as value from happy_quote;
select is((select value->>'result' from happy_hold), 'ok', 'a direct booking hold is created');
select ok((select value->>'reservation_code' from happy_hold) like 'WEB-%', 'the hold returns a direct booking code');
select ok((select length(value->>'access_token') > 0 from happy_hold), 'the hold returns the guest access token');
select is(
  (select lifecycle_status::text from public.reservations where id = (select (value->>'reservation_id')::uuid from happy_hold)),
  'hold', 'the reservation stays on hold until the guarantee is confirmed'
);
select is(pg_temp.standard_available(70), 1, 'an active hold consumes the category stock');

-- A pré-reserva revalida o estoque: a cotação pode ser anterior ao bloqueio.
create temporary table block_quote as select pg_temp.quote(60) as value;
select pg_temp.block_room('20000000-0000-4000-8000-000000000101', 60, 61);
select pg_temp.block_room('20000000-0000-4000-8000-000000000103', 60, 61);
select is(
  (select public.create_public_booking_hold('hotel-aurora', jsonb_build_object(
    'idempotency_key', gen_random_uuid(),
    'quote_id', value->>'quote_id',
    'quote_fingerprint', value->>'fingerprint',
    'contact_name', 'Hóspede pgTAP',
    'consent_version', 'v1',
    'selections', jsonb_build_array((
      select jsonb_build_object('quote_item_id', item->>'id', 'room_type', item->>'room_type',
        'rate_plan_version_id', item->>'rate_plan_version_id')
      from jsonb_array_elements(value->'items') item
      where item->>'room_type' = 'Standard' limit 1
    ))
  ))->>'result' from block_quote),
  'availability_conflict', 'a hold is refused when the quoted rooms were blocked afterwards'
);

-- Evento de canal aplicado sobre um período bloqueado vai para revisão.
create temporary table block_channel as
select public.save_booking_channel(
  '10000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000002',
  jsonb_build_object('code', 'BLOCK-HUB', 'name', 'Canal pgTAP', 'active', true)
) as value;
create temporary table block_mapping as
select public.save_booking_channel_mapping(
  '10000000-0000-4000-8000-000000000001',
  (select (value->>'id')::uuid from block_channel),
  jsonb_build_object('external_room_code', 'STD', 'room_type', 'Standard', 'external_rate_code', 'FLEX',
    'rate_plan_id', (select id from public.rate_plans
      where hotel_id = '10000000-0000-4000-8000-000000000001' and code = 'FLEX'))
) as value;
create temporary table block_event as
select public.ingest_booking_channel_event(
  (select (value->>'id')::uuid from block_channel),
  jsonb_build_object('event_id', 'block-create-1', 'event_type', 'create', 'external_reservation_id', 'block-1',
    'occurred_at', now(), 'reservation', jsonb_build_object(
      'room_code', 'STD', 'rate_code', 'FLEX', 'adults', 1, 'children', 0, 'currency', 'BRL', 'total', 420,
      'checkin_date', (pg_temp.op_date() + 60)::text, 'checkout_date', (pg_temp.op_date() + 62)::text,
      'guest_name', 'Hóspede do canal'))
) as value;
select is(
  (public.act_booking_channel_event(
    '10000000-0000-4000-8000-000000000001',
    (select (value->>'id')::uuid from block_event),
    '80000000-0000-4000-8000-000000000002',
    jsonb_build_object('action', 'apply', 'expected_version', 1, 'reason', 'Reserva externa revisada')
  )->>'result'),
  'inventory_conflict', 'a channel reservation over blocked rooms is not applied'
);

-- O feed de disponibilidade reflete os bloqueios vigentes no dia operacional.
select pg_temp.block_room('20000000-0000-4000-8000-000000000103', 0, 0);
select is(
  (select coalesce(max((room->>'available')::integer), 0)
   from jsonb_array_elements(public.get_booking_channel_inventory((select (value->>'id')::uuid from block_channel))->'rooms') room
   where room->>'room_type' = 'Standard'),
  1, 'the channel feed discounts a block active today'
);

-- Bloqueio vencido e não liberado continua segurando o quarto, como no calendário.
select pg_temp.block_room('20000000-0000-4000-8000-000000000103', -5, -2);
select is(pg_temp.standard_available(80), 1, 'an overdue block keeps the room off sale until released');

select * from finish();
rollback;
