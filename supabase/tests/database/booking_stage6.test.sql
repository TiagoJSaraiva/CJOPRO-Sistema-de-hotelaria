begin;
select plan(38);

select has_table('public','rate_plans','rate plans exist');
select has_table('public','rate_plan_versions','immutable rate versions exist');
select has_table('public','reservation_accommodations','category accommodations exist');
select has_table('public','reservation_nightly_prices','nightly price snapshots exist');
select has_table('public','reservation_account_entries','reservation account exists');
select has_table('public','customer_preferences','guest preferences exist');
select has_table('public','reservation_guests','pre-stay guests exist');
select has_table('public','prearrival_access_tokens','hashed prearrival access exists');
select has_table('public','prearrival_requests','guest requests exist');
select has_table('public','booking_configurations','public booking configuration exists');
select has_table('public','booking_quotes','materialized quotes exist');
select has_table('public','booking_channels','neutral channel connections exist');
select has_table('public','booking_channel_events','channel inbox exists');
select has_table('public','integrated_operation_facts','integrated facts exist');

select has_function('public','quote_public_booking',array['text','jsonb'],'public quote function exists');
select has_function('public','create_public_booking_hold',array['text','jsonb'],'atomic hold function exists');
select has_function('public','resolve_prearrival_token',array['text'],'prearrival token resolver exists');
select has_function('public','reconcile_integrated_analytics',array['uuid','date','date','timestamp with time zone'],'analytics reconciliation exists');

select ok((select relrowsecurity from pg_class where oid='public.reservation_accommodations'::regclass),'reservation accommodation uses RLS');
select ok((select relrowsecurity from pg_class where oid='public.prearrival_access_tokens'::regclass),'prearrival tokens use RLS');
select ok((select relrowsecurity from pg_class where oid='public.booking_channel_events'::regclass),'channel inbox uses RLS');
select ok((select relrowsecurity from pg_class where oid='public.integrated_operation_facts'::regclass),'analytics facts use RLS');

select ok(not exists(select 1 from public.prearrival_access_tokens where token_hash !~ '^[0-9a-f]{64}$'),'only token hashes are persisted');
select ok(not exists(select 1 from public.reservation_accommodations where hotel_id<>(select hotel_id from public.reservations where id=reservation_id)),'reservation accommodation remains in hotel scope');
select ok(not exists(select 1 from public.reservation_nightly_prices n join public.reservation_accommodations a on a.id=n.accommodation_id where n.hotel_id<>a.hotel_id),'nightly snapshots remain in hotel scope');

select is((public.save_booking_configuration('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',jsonb_build_object('published',true,'primary_color','#315F4D','introduction','Reserva direta de teste','guarantee_instructions','Sinal confirmado pela equipe','terms','Termos de teste','consent_version','v1'))->>'result'),'ok','direct booking can be published explicitly');

insert into public.hotel_training_environments(hotel_id,clock_mode,frozen_at)
values('10000000-0000-4000-8000-000000000001','frozen','2035-01-10T15:00:00Z')
on conflict(hotel_id) do update set clock_mode='frozen',frozen_at=excluded.frozen_at,version=public.hotel_training_environments.version+1;
select is((public.quote_public_booking('hotel-aurora',jsonb_build_object('checkin_date',(current_date+10)::text,'checkout_date',(current_date+12)::text,'rooms',jsonb_build_array(jsonb_build_object('adults',1,'children',0))))->>'result'),'invalid_dates','public quote validates dates against hotel operational time');

create temporary table stage6_quote as
select public.quote_public_booking('hotel-aurora',jsonb_build_object('checkin_date',(public.hotel_operational_date('10000000-0000-4000-8000-000000000001')+10)::text,'checkout_date',(public.hotel_operational_date('10000000-0000-4000-8000-000000000001')+12)::text,'rooms',jsonb_build_array(jsonb_build_object('adults',1,'children',0)))) value;
select is((select value->>'result' from stage6_quote),'ok','published hotel returns a quote');
select ok(jsonb_array_length((select value->'items' from stage6_quote))>0,'quote exposes category and plan choices');
select is((select (value->>'expires_at')::timestamptz from stage6_quote),public.hotel_operational_now('10000000-0000-4000-8000-000000000001')+interval '15 minutes','quote expiration follows hotel operational time');

do $$declare i integer;v jsonb;begin for i in 1..30 loop v:=public.consume_public_rate_limit('stage6-test','quote',now());end loop;end$$;
select is((public.consume_public_rate_limit('stage6-test','quote',now())->>'result'),'limited','persistent public rate limit rejects excess requests');

select is((public.reconcile_integrated_analytics('10000000-0000-4000-8000-000000000001',current_date,current_date,now())->>'result'),'ok','forecast and actual reconcile for the hotel day');

create temporary table stage6_channel as
select public.save_booking_channel('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',jsonb_build_object('code','TEST-HUB','name','Canal de teste','active',true)) value;
select is((select value->>'result' from stage6_channel),'ok','neutral channel is created with an isolated credential');

create temporary table stage6_mapping as
select public.save_booking_channel_mapping(
 '10000000-0000-4000-8000-000000000001',
 (select (value->>'id')::uuid from stage6_channel),
 jsonb_build_object('external_room_code','STD','room_type',(select room_type from public.rooms where hotel_id='10000000-0000-4000-8000-000000000001' limit 1),'external_rate_code','FLEX','rate_plan_id',(select id from public.rate_plans where hotel_id='10000000-0000-4000-8000-000000000001' and code='FLEX'))
) value;
select is((select value->>'result' from stage6_mapping),'ok','external category and rate map to the hotel catalog');

create temporary table stage6_channel_event as
select public.ingest_booking_channel_event(
 (select (value->>'id')::uuid from stage6_channel),
 jsonb_build_object('event_id','stage6-create-1','event_type','create','external_reservation_id','external-1','occurred_at',now(),'reservation',jsonb_build_object('room_code','STD','rate_code','FLEX','checkin_date',(current_date+20)::text,'checkout_date',(current_date+22)::text,'adults',1,'children',0,'currency','BRL','total',420,'guest_name','Hóspede do canal'))
) value;
select is((select value->>'status' from stage6_channel_event),'received','mapped channel event enters the neutral inbox');

create temporary table stage6_channel_action as
select public.act_booking_channel_event(
 '10000000-0000-4000-8000-000000000001',
 (select (value->>'id')::uuid from stage6_channel_event),
 '80000000-0000-4000-8000-000000000002',
 jsonb_build_object('action','apply','expected_version',1,'reason','Reserva externa revisada')
) value;
select is((select value->>'result' from stage6_channel_action),'ok','reviewed channel event materializes atomically');
select ok(exists(select 1 from public.reservations where id=(select (value->>'reservation_id')::uuid from stage6_channel_action) and reservation_source='agency' and notes like 'Importada pelo hub neutro:%' and final_total_price=420),'channel reservation preserves the provider price and origin');

select is((public.import_booking_channel_events(
 '10000000-0000-4000-8000-000000000001',
 (select (value->>'id')::uuid from stage6_channel),
 jsonb_build_array(jsonb_build_object('event_id','stage6-create-1','event_type','create','external_reservation_id','external-1','occurred_at',now(),'reservation',jsonb_build_object('room_code','STD','rate_code','FLEX','checkin_date',(current_date+20)::text,'checkout_date',(current_date+22)::text,'adults',1,'children',0,'currency','BRL','total',420,'guest_name','Hóspede do canal')))
)->>'result'),'ok','CSV pipeline keeps row-level idempotency');

select * from finish();
rollback;
