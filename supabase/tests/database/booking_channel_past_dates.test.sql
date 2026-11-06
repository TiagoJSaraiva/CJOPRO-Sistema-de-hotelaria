begin;
select plan(9);

-- Uma reserva de canal não pode nascer no passado: sem esta regra, um evento atrasado criava uma
-- reserva confirmada para uma data que já passou, sem quarto nem chegada possível.
create temporary table ctx on commit drop as
select
  '10000000-0000-4000-8000-000000000001'::uuid as hotel,
  '80000000-0000-4000-8000-000000000002'::uuid as manager,
  public.hotel_operational_date('10000000-0000-4000-8000-000000000001') as today,
  (public.save_booking_channel(
    '10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',
    jsonb_build_object('name','Canal de teste','code','TESTE-PASSADO','active',true)
  )->>'id')::uuid as channel;

select is(
  (select public.save_booking_channel_mapping(hotel,channel,jsonb_build_object(
    'external_room_code','STD','external_rate_code','FLEX',
    'room_type',(select room_type from public.rooms r where r.hotel_id=hotel limit 1),
    'rate_plan_id',(select id from public.rate_plans p where p.hotel_id=hotel and p.active_version_id is not null limit 1)
  ))->>'result' from ctx),
  'ok','o mapeamento é salvo'
);

create function pg_temp.ingest(p_id text, p_type text, p_reservation text, p_checkin date, p_checkout date)
returns uuid language sql as $$
  select (public.import_booking_channel_events(hotel,channel,jsonb_build_array(jsonb_build_object(
    'event_id',p_id,'event_type',p_type,'external_reservation_id',p_reservation,'occurred_at',now(),
    'reservation',jsonb_build_object('room_code','STD','rate_code','FLEX','checkin_date',p_checkin,
      'checkout_date',p_checkout,'adults',2,'children',0,'currency','BRL','total',500,'guest_name','Hóspede Exemplo')
  )))->'items'->0->'result'->>'id')::uuid from ctx
$$;
create function pg_temp.apply(p_event uuid) returns text language sql as $$
  select public.act_booking_channel_event(hotel,p_event,manager,jsonb_build_object(
    'action','apply','reason','Revisão do evento',
    'expected_version',(select version from public.booking_channel_events where id=p_event)
  ))->>'result' from ctx
$$;

create temporary table events on commit drop as
select
  pg_temp.ingest('P-1','create','R-P',(select today-10 from ctx),(select today-8 from ctx)) as past_create,
  pg_temp.ingest('H-1','create','R-H',(select today from ctx),(select today+2 from ctx)) as today_create;

select is((select pg_temp.apply(past_create) from events),'past_dates','evento com chegada no passado não é aplicado');
select is(
  (select status||'|'||reason||'|'||(reservation_id is null) from public.booking_channel_events e join events on e.id=past_create),
  'needs_review|past_dates|true','o evento fica em revisão, sem reserva'
);
select is((select pg_temp.apply(today_create) from events),'ok','chegada na data operacional é aplicada');

-- Hóspede já na casa: a alteração mantém a chegada antiga, mas a saída ainda é futura.
update public.reservation_accommodations a set checkin_date=c.today-1, checkout_date=c.today+1
from ctx c, public.booking_channel_events e
where e.external_event_id='H-1' and a.reservation_id=e.reservation_id;
select is(
  pg_temp.apply(pg_temp.ingest('H-2','amend','R-H',(select today-1 from ctx),(select today+3 from ctx))),
  'ok','alterar uma estadia em curso continua possível'
);
select is(
  pg_temp.apply(pg_temp.ingest('H-3','amend','R-H',(select today-5 from ctx),(select today-1 from ctx))),
  'past_dates','alterar para um período inteiro no passado é recusado'
);
select is(
  pg_temp.apply(pg_temp.ingest('H-4','cancel','R-H',(select today-5 from ctx),(select today-1 from ctx))),
  'ok','cancelar não depende das datas do evento'
);

select is(
  (select public.act_booking_channel_event('10000000-0000-4000-8000-000000000002',past_create,'80000000-0000-4000-8000-000000000003',
    jsonb_build_object('action','apply','reason','Outro hotel','expected_version',1))->>'result' from events),
  'not_found','outro hotel não alcança o evento'
);

-- A caixa de entrada traz o que a pessoa precisa para decidir.
select is(
  (select item->'normalized_payload'->'reservation'->>'guest_name'
   from ctx, jsonb_array_elements(public.list_booking_channel_inbox(hotel)->'items') item
   where item->>'external_event_id'='P-1'),
  'Hóspede Exemplo','a caixa de entrada mostra os dados da reserva externa'
);

select * from finish();
rollback;
