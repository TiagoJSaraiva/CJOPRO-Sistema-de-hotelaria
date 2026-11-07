begin;
select plan(20);

-- Reserva de canal ou do site nasce sem cliente e sem quarto. A recepção identifica o hóspede e aloca.
-- Toda alteração é revertida ao final.
create temporary table ctx on commit drop as
select
  '10000000-0000-4000-8000-000000000001'::uuid as hotel,
  '10000000-0000-4000-8000-000000000002'::uuid as other_hotel,
  '80000000-0000-4000-8000-000000000004'::uuid as reception,
  'c1000000-0000-4000-8000-000000000001'::uuid as reservation,
  'c2000000-0000-4000-8000-000000000001'::uuid as accommodation,
  '20000000-0000-4000-8000-000000000103'::uuid as room,
  (select id from public.customers c where c.hotel_id='10000000-0000-4000-8000-000000000001' limit 1) as customer,
  (select id from public.customers c where c.hotel_id='10000000-0000-4000-8000-000000000002' limit 1) as foreign_customer,
  public.hotel_operational_date('10000000-0000-4000-8000-000000000001')+60 as day;

insert into public.reservations(id,hotel_id,booking_customer_id,reservation_code,guest_count,reservation_source,lifecycle_status)
select reservation,hotel,null,'CH-SEMQUARTO',2,'agency','confirmed' from ctx;
insert into public.reservation_contacts(reservation_id,hotel_id,full_name,email,consent_version)
select reservation,hotel,'Hóspede do Canal','canal@example.invalid','channel' from ctx;
insert into public.reservation_accommodations(id,hotel_id,reservation_id,room_type,checkin_date,checkout_date,adults,children,status,total_price)
select accommodation,hotel,reservation,'Standard',day,day+2,2,0,'confirmed',400 from ctx;

create function pg_temp.item() returns jsonb language sql as $$
  select i from ctx,jsonb_array_elements(public.list_unassigned_reservations(hotel)->'items') i where i->>'id'=reservation::text
$$;
create function pg_temp.version() returns integer language sql as $$
  select version from public.reservations where id=(select reservation from ctx)
$$;
create function pg_temp.assign() returns text language sql as $$
  select public.assign_reservation_room(hotel,reservation,reception,jsonb_build_object(
    'accommodation_id',accommodation,'room_id',room,'reason','Alocação da recepção',
    'expected_version',(select version from public.reservation_accommodations where id=accommodation)))->>'result' from ctx
$$;
create function pg_temp.link(p_customer uuid,p_version integer default null) returns text language sql as $$
  select public.link_reservation_customer(hotel,reservation,reception,p_customer,coalesce(p_version,pg_temp.version()))->>'result' from ctx
$$;

select is(pg_temp.item()->>'code','CH-SEMQUARTO','a reserva aparece na fila');
select is(pg_temp.item()#>>'{contact,full_name}','Hóspede do Canal','a fila mostra o contato vindo do canal');
select is(pg_temp.item()->>'customer_id',null,'a fila mostra que falta identificar o hóspede');
select is(jsonb_array_length(pg_temp.item()->'accommodations'),1,'a fila mostra a acomodação sem quarto');
select is(
  (select count(*)::integer from ctx,jsonb_array_elements(public.list_unassigned_reservations(other_hotel)->'items') i where i->>'id'=reservation::text),
  0,'a fila de outro hotel não mostra a reserva'
);

-- Sem cliente a alocação é recusada com clareza, não por erro de banco.
select is(pg_temp.assign(),'customer_required','sem cliente a alocação é recusada');
select is((select count(*)::integer from public.stays where reservation_id=(select reservation from ctx)),0,'a recusa não cria estadia');

-- Vincular cliente.
select is(pg_temp.link((select foreign_customer from ctx)),'invalid_customer','cliente de outro hotel é recusado');
select is(pg_temp.link((select customer from ctx),pg_temp.version()+1),'conflict','versão antiga é recusada');
select is(pg_temp.link((select customer from ctx)),'ok','a recepção vincula o cliente');
select is((select booking_customer_id from public.reservations where id=(select reservation from ctx)),(select customer from ctx),'o cliente fica na reserva');
select is(
  (select actor_id from public.reservation_events where reservation_id=(select reservation from ctx) and action='customer_linked'),
  (select reception from ctx),'o vínculo fica registrado com quem fez'
);

-- Alocar.
select is(pg_temp.assign(),'ok','com cliente a alocação é aceita');
select is(
  (select display_name from public.stay_payer_accounts where stay_id=(select stay_id from public.reservation_accommodations where id=(select accommodation from ctx)) and kind='primary_guest'),
  (select full_name from public.customers where id=(select customer from ctx)),'o pagador principal nasce do cliente vinculado'
);
select is(pg_temp.item(),null,'a reserva alocada sai da fila');
select is(pg_temp.link((select customer from ctx)),'invalid_status','depois da alocação o cliente não muda por aqui');

-- Pré-reserva: precisa do adiantamento antes do quarto, para não sobrar estadia quando ela vence.
insert into public.reservations(id,hotel_id,booking_customer_id,reservation_code,guest_count,reservation_source,lifecycle_status,hold_expires_at)
select 'c1000000-0000-4000-8000-000000000002',hotel,customer,'SITE-HOLD',1,'website','hold',now()+interval '1 day' from ctx;
insert into public.reservation_accommodations(id,hotel_id,reservation_id,room_type,checkin_date,checkout_date,adults,children,status,total_price)
select 'c2000000-0000-4000-8000-000000000002',hotel,'c1000000-0000-4000-8000-000000000002','Standard',day+10,day+12,1,0,'held',200 from ctx;
select is(
  (select public.assign_reservation_room(hotel,'c1000000-0000-4000-8000-000000000002',reception,jsonb_build_object(
    'accommodation_id','c2000000-0000-4000-8000-000000000002','room_id',room,'reason','Alocação da recepção','expected_version',0))->>'result' from ctx),
  'hold_not_confirmed','pré-reserva não recebe quarto antes de confirmar'
);
select ok(
  exists(select 1 from ctx,jsonb_array_elements(public.list_unassigned_reservations(hotel)->'items') i where i->>'id'='c1000000-0000-4000-8000-000000000002' and i->>'lifecycle_status'='hold'),
  'a pré-reserva aparece na fila para confirmar'
);

-- Reserva encerrada sem quarto que ainda deve devolução continua na fila, para o acerto.
insert into public.reservation_account_entries(hotel_id,reservation_id,direction,kind,amount,currency,payment_method,actor_id)
select hotel,'c1000000-0000-4000-8000-000000000002','credit','guarantee',80,'BRL','pix',reception from ctx;
select is(
  (select public.act_reservation(hotel,'c1000000-0000-4000-8000-000000000002',reception,jsonb_build_object('action','cancel','reason','Pedido do hóspede','expected_version',(select version from public.reservations where id='c1000000-0000-4000-8000-000000000002')))->>'refundable_credit' from ctx)::numeric,
  80::numeric,'o cancelamento sem quarto também gera o crédito'
);
select is(
  (select (i->>'closure_balance')::numeric from ctx,jsonb_array_elements(public.list_unassigned_reservations(hotel)->'items') i where i->>'id'='c1000000-0000-4000-8000-000000000002'),
  80::numeric,'a reserva encerrada com saldo fica na fila para o acerto'
);

select * from finish();
rollback;
