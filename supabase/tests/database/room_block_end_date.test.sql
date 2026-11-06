begin;
select plan(12);

-- O bloqueio vale até end_date, inclusive. A estadia termina em checkout_date, que é exclusivo: a noite
-- da saída é de quem chega. Comparar os dois do mesmo jeito deixa o último dia do bloqueio descoberto.
create temporary table ctx on commit drop as
select
  '10000000-0000-4000-8000-000000000001'::uuid as hotel,
  'a9700000-0000-4000-8000-000000000004'::uuid as reservation,
  '20000000-0000-4000-8000-000000000103'::uuid as room,
  '20000000-0000-4000-8000-000000000101'::uuid as other_room,
  '80000000-0000-4000-8000-000000000002'::uuid as actor,
  public.hotel_operational_date('10000000-0000-4000-8000-000000000001')+40 as day;

insert into public.reservations(id,hotel_id,booking_customer_id,reservation_code,guest_count)
select reservation,hotel,(select id from public.customers c where c.hotel_id=ctx.hotel limit 1),'BLOQUEIO-TESTE',1 from ctx;
insert into public.reservation_accommodations(id,hotel_id,reservation_id,room_type,checkin_date,checkout_date,status)
select 'a9700000-0000-4000-8000-000000000001',hotel,reservation,'Standard',day,day+2,'confirmed' from ctx;
insert into public.room_blocks(id,hotel_id,room_id,status,label,start_date,end_date)
select 'a9700000-0000-4000-8000-000000000002',hotel,room,'blocked','Bloqueio até a chegada',day-2,day from ctx;

create function pg_temp.offered() returns boolean language sql as $$
  select exists(
    select 1 from jsonb_array_elements(public.simulate_room_assignment(hotel,reservation,
      jsonb_build_object('accommodation_id','a9700000-0000-4000-8000-000000000001'))->'candidates') c
    where c->>'room_id'=room::text
  ) from ctx
$$;
create function pg_temp.assign() returns text language sql as $$
  select public.assign_reservation_room(hotel,reservation,actor,jsonb_build_object(
    'accommodation_id','a9700000-0000-4000-8000-000000000001','room_id',room,'reason','Teste de bloqueio',
    'expected_version',(select version from public.reservation_accommodations where id='a9700000-0000-4000-8000-000000000001')))->>'result'
  from ctx
$$;

-- Alocação.
select ok(not pg_temp.offered(),'quarto bloqueado no dia da chegada não é oferecido');
select is(pg_temp.assign(),'conflict','quarto bloqueado no dia da chegada é recusado');

savepoint antes;
update public.room_blocks set start_date=(select day+2 from ctx),end_date=(select day+3 from ctx)
  where id='a9700000-0000-4000-8000-000000000002';
select ok(pg_temp.offered(),'bloqueio que começa no dia da saída não atrapalha');
rollback to antes;

update public.room_blocks set end_date=(select day-1 from ctx) where id='a9700000-0000-4000-8000-000000000002';
select ok(pg_temp.offered(),'bloqueio que termina na véspera libera o quarto');
select is(pg_temp.assign(),'ok','bloqueio que termina na véspera permite a alocação');

-- Indicadores: um bloqueio de um único dia.
create function pg_temp.fact(p_key text) returns integer language sql as $$
  select (f.forecast->>p_key)::integer from public.integrated_operation_facts f join ctx on f.hotel_id=ctx.hotel and f.business_date=ctx.day+10
$$;
select is(
  (select public.reconcile_integrated_analytics(hotel,day+10,day+10,now())->>'result' from ctx),
  'ok','a apuração roda sem bloqueio'
);
create temporary table base on commit drop as
select pg_temp.fact('sellable_rooms') as sellable,pg_temp.fact('unavailable_rooms') as unavailable;

insert into public.room_blocks(id,hotel_id,room_id,status,label,start_date,end_date)
select 'a9700000-0000-4000-8000-000000000003',hotel,other_room,'blocked','Bloqueio de um dia',day+10,day+10 from ctx;
select is(
  (select public.reconcile_integrated_analytics(hotel,day+10,day+10,now())->>'result' from ctx),
  'ok','a apuração roda com o bloqueio'
);
select is(pg_temp.fact('unavailable_rooms'),(select unavailable+1 from base),'o último dia do bloqueio conta como indisponível');
select is(pg_temp.fact('sellable_rooms'),(select sellable-1 from base),'o último dia do bloqueio sai da oferta');
select is(
  (select jsonb_array_length(public.drilldown_integrated_analytics(hotel,day+10,'unavailable_rooms',array['read_integrated_analytics'])->'items') from ctx),
  1,'o detalhe do indicador mostra o bloqueio do último dia'
);

-- Quarto em manutenção e bloqueado no mesmo dia sai da oferta uma vez só.
update public.rooms set status='maintenance' where id=(select other_room from ctx);
select is(
  (select public.reconcile_integrated_analytics(hotel,day+10,day+10,now())->>'result' from ctx),
  'ok','a apuração roda com o quarto em manutenção'
);
select is(pg_temp.fact('sellable_rooms'),(select sellable-1 from base),'quarto em manutenção e bloqueado não é descontado duas vezes');

select * from finish();
rollback;
