begin;
select plan(11);

-- Fechamento diário: mudar a projeção depois de preparar não pode travar o dia, e um dia fechado
-- não volta a ser preparado. Toda alteração é revertida ao final.
create temporary table ctx on commit drop as
select
  '10000000-0000-4000-8000-000000000001'::uuid as hotel,
  '80000000-0000-4000-8000-000000000002'::uuid as manager,
  '80000000-0000-4000-8000-000000000010'::uuid as finance,
  '80000000-0000-4000-8000-000000000008'::uuid as cashier,
  public.hotel_operational_date('10000000-0000-4000-8000-000000000001') as day;

insert into public.cash_registers(id,hotel_id,name,code,kind,currency,difference_tolerance,created_by)
select 'a5200000-0000-4000-8000-000000000001',hotel,'Caixa do fechamento','FEC-01','reception','BRL',5,manager from ctx;

select is(
  (select public.prepare_daily_close(hotel,day,finance,jsonb_build_object('expected_version',0,'accepted_pending','[]'::jsonb))->>'result' from ctx),
  'ok',
  'o financeiro prepara o dia'
);
select is(
  (select public.act_daily_close(hotel,day,finance,jsonb_build_object(
    'action','reject','expected_version',(select version from public.daily_closes c where c.hotel_id=ctx.hotel and c.business_date=ctx.day),
    'expected_fingerprint',(select fingerprint from public.daily_closes c where c.hotel_id=ctx.hotel and c.business_date=ctx.day),'reason','Própria preparação'))->>'result' from ctx),
  'segregation_required',
  'quem preparou não decide nem para devolver'
);

-- Uma sessão aberta depois da preparação muda a projeção.
select is(
  (select public.open_cash_session(hotel,'a5200000-0000-4000-8000-000000000001',cashier,jsonb_build_object(
    'opening_float',10,'idempotency_key','a5200000-0000-4000-8000-000000000002'))->>'result' from ctx),
  'ok',
  'o caixa abre uma sessão depois da preparação'
);
select is(
  (select public.act_daily_close(hotel,day,manager,jsonb_build_object(
    'action','approve','expected_version',(select version from public.daily_closes c where c.hotel_id=ctx.hotel and c.business_date=ctx.day),
    'expected_fingerprint',(select fingerprint from public.daily_closes c where c.hotel_id=ctx.hotel and c.business_date=ctx.day),'reason','Aprovação antiga'))->>'result' from ctx),
  'projection_changed',
  'aprovar uma projeção que mudou é recusado'
);
select is(
  (select public.act_daily_close(hotel,day,manager,jsonb_build_object(
    'action','reject','expected_version',(select version from public.daily_closes c where c.hotel_id=ctx.hotel and c.business_date=ctx.day),
    'expected_fingerprint',(select fingerprint from public.daily_closes c where c.hotel_id=ctx.hotel and c.business_date=ctx.day),'reason','A projeção mudou'))->>'result' from ctx),
  'ok',
  'devolver continua possível depois de a projeção mudar: sem isso, o dia trava'
);
select is(
  (select status::text from public.daily_closes c join ctx on c.hotel_id=ctx.hotel and c.business_date=ctx.day),
  'rejected',
  'a devolução deixa o dia pronto para nova preparação'
);

select is(
  (select public.act_cash_session(ctx.hotel,s.id,ctx.cashier,jsonb_build_object(
    'action','cancel','expected_version',s.version,'reason','Aberta por engano'))->>'result'
   from public.cash_sessions s cross join ctx where s.cash_register_id='a5200000-0000-4000-8000-000000000001'),
  'ok',
  'a sessão sem movimentos pode ser cancelada'
);
select is(
  (select public.prepare_daily_close(hotel,day,finance,jsonb_build_object(
    'expected_version',(select version from public.daily_closes c where c.hotel_id=ctx.hotel and c.business_date=ctx.day),
    'accepted_pending','[]'::jsonb))->>'result' from ctx),
  'ok',
  'o financeiro prepara de novo'
);
select is(
  (select public.act_daily_close(hotel,day,manager,jsonb_build_object(
    'action','approve','expected_version',(select version from public.daily_closes c where c.hotel_id=ctx.hotel and c.business_date=ctx.day),
    'expected_fingerprint',(select fingerprint from public.daily_closes c where c.hotel_id=ctx.hotel and c.business_date=ctx.day),'reason','Conferido'))->>'result' from ctx),
  'ok',
  'o gerente aprova a projeção atual'
);

select is(
  (select public.prepare_daily_close(hotel,day,finance,jsonb_build_object(
    'expected_version',(select version from public.daily_closes c where c.hotel_id=ctx.hotel and c.business_date=ctx.day),
    'accepted_pending','[]'::jsonb))->>'result' from ctx),
  'invalid_transition',
  'um dia fechado não volta a ser preparado'
);
select results_eq(
  $$select status::text, approved_by from public.daily_closes c join ctx on c.hotel_id=ctx.hotel and c.business_date=ctx.day$$,
  $$select 'closed'::text, manager from ctx$$,
  'o fechamento e o aprovador continuam intactos'
);

select * from finish();
rollback;
