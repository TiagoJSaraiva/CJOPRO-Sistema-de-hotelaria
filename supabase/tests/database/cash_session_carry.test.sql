begin;
select plan(14);

-- A sessão seguinte parte do valor contado na anterior. Abrir com outro valor exige justificativa;
-- sem isso, a diferença entre um turno e outro passaria sem controle.
create temporary table ctx on commit drop as
select
  '10000000-0000-4000-8000-000000000001'::uuid as hotel,
  '81200000-0000-4000-8000-000000000001'::uuid as register,
  '80000000-0000-4000-8000-000000000008'::uuid as cashier,
  '80000000-0000-4000-8000-000000000004'::uuid as reception,
  '80000000-0000-4000-8000-000000000002'::uuid as manager,
  '80000000-0000-4000-8000-000000000003'::uuid as other_hotel_manager,
  '80000000-0000-4000-8000-000000000010'::uuid as finance;

create function pg_temp.last_counted() returns numeric language sql as $$
  select (item->>'last_counted_cash')::numeric
  from ctx, jsonb_array_elements(public.list_cash_registers_for_actor(hotel,cashier,false)->'registers') item
  where (item->>'id')::uuid=ctx.register
$$;
create function pg_temp.open_session() returns public.cash_sessions language sql as $$
  select s.* from public.cash_sessions s join ctx on s.cash_register_id=ctx.register and s.status='open'
$$;
create function pg_temp.open_with(amount numeric, reason text default null) returns text language sql as $$
  select public.open_cash_session(hotel,register,cashier,jsonb_strip_nulls(jsonb_build_object(
    'opening_float',amount,'idempotency_key',gen_random_uuid(),'opening_reason',reason)))->>'result' from ctx
$$;
create function pg_temp.count_cash(amount numeric) returns text language sql as $$
  select public.act_cash_session(hotel,(pg_temp.open_session()).id,cashier,jsonb_build_object(
    'action','count','expected_version',(pg_temp.open_session()).version,'counted_amount',amount))->>'result' from ctx
$$;

select is(pg_temp.last_counted(),null,'um caixa sem histórico não tem contagem anterior');
select is(pg_temp.open_with(100),'ok','a primeira sessão abre com o valor informado');
select is(pg_temp.count_cash(100),'ok','a sessão fecha pela contagem');
select is(pg_temp.last_counted(),100::numeric,'o cadastro do caixa mostra a última contagem');

select is(pg_temp.open_with(80),'opening_reason_required','abrir com outro valor sem justificativa é recusado');
select is(pg_temp.open_with(80,'Retirada da tesouraria antes do turno'),'ok','com justificativa, abre');
select ok(
  exists(select 1 from public.cash_movements m where m.cash_session_id=(pg_temp.open_session()).id and m.kind='opening_float'
    and m.reason like '%Retirada da tesouraria antes do turno%'),
  'a justificativa fica no movimento de abertura'
);
select is(
  (select public.act_cash_session(hotel,(pg_temp.open_session()).id,cashier,jsonb_build_object(
    'action','cancel','expected_version',(pg_temp.open_session()).version,'reason','Aberta por engano'))->>'result' from ctx),
  'ok','a sessão sem movimentos é cancelada'
);
select is(pg_temp.open_with(100),'ok','sessão cancelada não muda a última contagem');

-- Contagem com diferença: vale o valor contado, depois da decisão de outra pessoa.
-- O teste roda em uma só transação, em que now() não anda: envelhece o encerramento anterior.
update public.cash_sessions set closed_at=closed_at-interval '1 hour' where status='closed';
select is(pg_temp.count_cash(90),'ok','a contagem com diferença fica pendente');
select is(
  (select public.act_cash_session(hotel,s.id,manager,jsonb_build_object(
    'action','approve_difference','expected_version',s.version,'reason','Diferença conferida'))->>'result'
   from ctx join public.cash_sessions s on s.cash_register_id=ctx.register and s.status='difference_pending'),
  'ok','o gerente aprova a diferença'
);
select is(pg_temp.open_with(90),'ok','a sessão seguinte parte do valor contado, não do esperado');

-- Troca direta de operador.
select is(
  (select public.act_cash_session(hotel,(pg_temp.open_session()).id,cashier,jsonb_build_object(
    'action','handoff','expected_version',(pg_temp.open_session()).version,'counted_amount',90,
    'next_operator_id',other_hotel_manager,'idempotency_key',gen_random_uuid()))->>'result' from ctx),
  'invalid_operator','a troca recusa quem não opera caixa neste hotel'
);
select is(
  (select public.act_cash_session(hotel,(pg_temp.open_session()).id,cashier,jsonb_build_object(
    'action','handoff','expected_version',(pg_temp.open_session()).version,'counted_amount',90,
    'next_operator_id',reception,'idempotency_key',gen_random_uuid()))->>'result' from ctx),
  'ok','a troca aceita quem opera caixa neste hotel'
);

select * from finish();
rollback;
