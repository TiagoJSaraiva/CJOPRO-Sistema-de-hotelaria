begin;
select plan(61);

-- Regras de docs/qa/rules-finance.md que ainda não tinham prova: FIN-03, 07, 16, 19, 24, 25, 28 e 31.
-- Toda alteração é revertida ao final.
create temporary table ctx on commit drop as
select
  '10000000-0000-4000-8000-000000000001'::uuid as hotel,
  '10000000-0000-4000-8000-000000000002'::uuid as other_hotel,
  '91000000-0000-4000-8000-000000000002'::uuid as stay,
  '30000000-0000-4000-8000-000000000001'::uuid as other_customer,
  '80000000-0000-4000-8000-000000000002'::uuid as manager,
  '80000000-0000-4000-8000-000000000004'::uuid as reception,
  '80000000-0000-4000-8000-000000000008'::uuid as cashier,
  '80000000-0000-4000-8000-000000000010'::uuid as finance,
  'a7000000-0000-4000-8000-000000000001'::uuid as register,
  '81000000-0000-4000-8000-000000000002'::uuid as point,
  public.hotel_operational_date('10000000-0000-4000-8000-000000000001') as today,
  (date_trunc('month',public.hotel_operational_date('10000000-0000-4000-8000-000000000001'))::date-interval '1 month')::date as period;

insert into public.cash_registers(id,hotel_id,name,code,kind,currency,difference_tolerance,created_by)
select register,hotel,'Caixa das regras','REG-01','reception','BRL',5,manager from ctx;

create function pg_temp.version() returns bigint language sql as $$
  select account_version from public.stays where id=(select stay from ctx)
$$;

-- FIN-03: cada débito é distribuído por inteiro entre pagadores da própria estadia.
insert into public.stay_payer_accounts(id,hotel_id,stay_id,kind,customer_id,display_name,created_by)
select 'a7000000-0000-4000-8000-000000000002',hotel,stay,'companion',other_customer,'Acompanhante das regras',manager from ctx;
create temporary table payers on commit drop as
select
  (select id from public.stay_payer_accounts where stay_id=ctx.stay and kind='primary_guest') as main,
  'a7000000-0000-4000-8000-000000000002'::uuid as companion
from ctx;
create function pg_temp.allocations(p_split numeric,p_payer uuid default null) returns jsonb language sql as $$
  select jsonb_agg(x) from (
    select jsonb_build_object('folio_entry_id',e.id,'payer_account_id',coalesce(p_payer,(select main from payers)),
      'amount',e.amount-p_split,'quantity',case when e.kind='consumption_charge' then 1 end) x
    from public.stay_folio_entries e where e.stay_id=(select stay from ctx) and e.direction='debit'
    union all
    select jsonb_build_object('folio_entry_id',e.id,'payer_account_id',(select companion from payers),
      'amount',p_split,'quantity',null)
    from public.stay_folio_entries e where e.stay_id=(select stay from ctx) and e.direction='debit' and p_split>0 and e.kind<>'consumption_charge'
  ) rows
$$;
select is(
  (select public.assign_stay_payer_allocations(hotel,stay,manager,pg_temp.version(),jsonb_set(pg_temp.allocations(0),'{0,amount}',to_jsonb((pg_temp.allocations(0)->0->>'amount')::numeric-1)),false)->>'result' from ctx),
  'incomplete_allocation','débito sem distribuição completa é recusado'
);
select is(
  (select public.assign_stay_payer_allocations(hotel,stay,manager,pg_temp.version(),pg_temp.allocations(0),true)->>'result' from ctx),
  'ok','a simulação com tudo distribuído é aceita'
);
create temporary table simulated on commit drop as select pg_temp.version() as version;
select is(pg_temp.version(),(select version from simulated),'a simulação não altera a versão da conta');
select is(
  (select public.assign_stay_payer_allocations(hotel,stay,manager,pg_temp.version()-1,pg_temp.allocations(0),false)->>'result' from ctx),
  'version_conflict','versão antiga da conta é recusada'
);
create temporary table other_payer on commit drop as
select id from public.stay_payer_accounts where stay_id='91000000-0000-4000-8000-000000000001' limit 1;
select is(
  (select public.assign_stay_payer_allocations(hotel,stay,manager,pg_temp.version(),
    pg_temp.allocations(0,(select id from other_payer)),false)->>'result' from ctx),
  'invalid_allocation','pagador de outra estadia é recusado'
);
select is(
  (select public.assign_stay_payer_allocations(hotel,stay,manager,pg_temp.version(),
    jsonb_set(pg_temp.allocations(1),'{0,amount}',to_jsonb(0)),false)->>'result' from ctx),
  'invalid_allocation','valor zerado é recusado'
);
select is(
  (select public.assign_stay_payer_allocations(hotel,stay,manager,(select version from simulated),pg_temp.allocations(1),false)->>'result' from ctx),
  'ok','a distribuição entre dois pagadores é aceita'
);
select is(pg_temp.version(),(select version+1 from simulated),'distribuir incrementa a versão da conta');
select is(
  (select sum(a.amount) from public.stay_payer_allocations a where a.stay_id=(select stay from ctx)),
  (select sum(e.amount) from public.stay_folio_entries e where e.stay_id=(select stay from ctx) and e.direction='debit'),
  'a soma distribuída é igual à soma dos débitos'
);

-- FIN-16: aprovar a diferença encerra a sessão e não gera ajuste financeiro.
select is(
  (select public.open_cash_session(hotel,register,cashier,jsonb_build_object(
    'opening_float',10,'idempotency_key','a7000000-0000-4000-8000-000000000010'))->>'result' from ctx),
  'ok','o caixa abre a sessão'
);
create function pg_temp.session() returns public.cash_sessions language sql as $$
  select s.* from public.cash_sessions s where s.cash_register_id=(select register from ctx) order by s.opened_at desc limit 1
$$;
select is(
  (select public.act_cash_session(hotel,(pg_temp.session()).id,cashier,jsonb_build_object(
    'action','count','expected_version',(pg_temp.session()).version,'counted_amount',30,'reason','Sobra na contagem'))->>'result' from ctx),
  'ok','o caixa conta valor acima da tolerância'
);
select is((pg_temp.session()).status::text,'difference_pending','a diferença fica pendente de decisão');
create temporary table before_decision on commit drop as select
  (select count(*) from public.financial_transactions where hotel_id=(select hotel from ctx)) as transactions,
  (select count(*) from public.cash_movements where cash_session_id=(pg_temp.session()).id) as movements;
select is(
  (select public.act_cash_session(hotel,(pg_temp.session()).id,manager,jsonb_build_object(
    'action','approve_difference','expected_version',(pg_temp.session()).version,'reason','Diferença conferida'))->>'result' from ctx),
  'ok','outra pessoa aprova a diferença'
);
select is((pg_temp.session()).status::text,'closed','a aprovação encerra a sessão');
select is((pg_temp.session()).difference_amount,20.00,'a diferença continua registrada');
select is(
  (select count(*) from public.financial_transactions where hotel_id=(select hotel from ctx)),
  (select transactions from before_decision),'aprovar a diferença não cria transação financeira'
);
select is(
  (select count(*) from public.cash_movements where cash_session_id=(pg_temp.session()).id),
  (select movements from before_decision),'aprovar a diferença não cria movimento de caixa'
);

-- FIN-24: a obrigação começa no primeiro caixa ativo e inclui as datas faltantes.
delete from public.daily_closes where hotel_id=(select other_hotel from ctx);
delete from public.cash_management_settings where hotel_id=(select other_hotel from ctx);
insert into public.cash_registers(id,hotel_id,name,code,kind,currency,difference_tolerance,created_by,active)
select 'a7000000-0000-4000-8000-000000000020',other_hotel,'Caixa inativo','REG-20','reception','BRL',5,manager,false from ctx;
select is(
  (select count(*)::integer from public.cash_management_settings where hotel_id=(select other_hotel from ctx)),
  0,'caixa inativo não inicia a obrigação'
);
insert into public.cash_registers(id,hotel_id,name,code,kind,currency,difference_tolerance,created_by)
select 'a7000000-0000-4000-8000-000000000021',other_hotel,'Primeiro caixa ativo','REG-21','reception','BRL',5,manager from ctx;
select is(
  (select daily_close_started_on from public.cash_management_settings where hotel_id=(select other_hotel from ctx)),
  public.hotel_operational_date('10000000-0000-4000-8000-000000000002'),
  'o primeiro caixa ativo inicia a obrigação na data do hotel'
);
insert into public.hotel_training_environments(hotel_id,clock_mode,frozen_at)
select other_hotel,'frozen',now()+interval '3 days' from ctx
on conflict(hotel_id) do update set clock_mode='frozen',frozen_at=excluded.frozen_at,version=public.hotel_training_environments.version+1;
insert into public.cash_registers(id,hotel_id,name,code,kind,currency,difference_tolerance,created_by)
select 'a7000000-0000-4000-8000-000000000022',other_hotel,'Segundo caixa','REG-22','reception','BRL',5,manager from ctx;
select is(
  (select daily_close_started_on from public.cash_management_settings where hotel_id=(select other_hotel from ctx)),
  public.hotel_operational_date('10000000-0000-4000-8000-000000000002')-3,
  'o segundo caixa não muda o início da obrigação'
);
select public.reconcile_operational_pending((select other_hotel from ctx),public.hotel_operational_now((select other_hotel from ctx)));
select is(
  (select count(*)::integer from public.daily_closes c cross join ctx
    where c.hotel_id=ctx.other_hotel
      and c.business_date between public.hotel_operational_date(ctx.other_hotel)-3 and public.hotel_operational_date(ctx.other_hotel)-1),
  3,'cada data faltante vira um fechamento a fazer'
);

-- FIN-25: lançamento tardio fica na data atual e aponta para a data e o fechamento originais.
create function pg_temp.close_day(p_day date) returns text language sql as $$
  select public.prepare_daily_close(hotel,p_day,finance,jsonb_build_object(
    'expected_version',coalesce((select version from public.daily_closes c where c.hotel_id=ctx.hotel and c.business_date=p_day),0),
    'accepted_pending','[]'::jsonb))->>'result' from ctx;
  select public.act_daily_close(hotel,p_day,manager,jsonb_build_object(
    'action','approve',
    'expected_version',(select version from public.daily_closes c where c.hotel_id=ctx.hotel and c.business_date=p_day),
    'expected_fingerprint',(select fingerprint from public.daily_closes c where c.hotel_id=ctx.hotel and c.business_date=p_day),
    'reason','Conferido'))->>'result' from ctx
$$;
create function pg_temp.post(p_id uuid,p_paid_at timestamptz,p_method text default 'pix') returns void language sql as $$
  insert into public.financial_transactions(id,hotel_id,type,category,amount,currency,description,status,payment_method,paid_at,created_by)
  select p_id,hotel,'INCOME','OTHER_INCOME',50,'BRL','Lançamento das regras','COMPLETED',p_method,p_paid_at,manager from ctx
$$;
select is(pg_temp.close_day((select today-2 from ctx)),'ok','o dia anterior é fechado');
create temporary table closed_snapshot on commit drop as
select c.id,c.fingerprint,c.version from public.daily_closes c join ctx on c.hotel_id=ctx.hotel and c.business_date=ctx.today-2;
select pg_temp.post('a7000000-0000-4000-8000-000000000030',((select today-2 from ctx)+time '15:00') at time zone 'America/Sao_Paulo');
select is(
  (select business_date from public.financial_transactions where id='a7000000-0000-4000-8000-000000000030'),
  (select today from ctx),'o lançamento em dia fechado fica na data atual'
);
select is(
  (select original_business_date from public.financial_transactions where id='a7000000-0000-4000-8000-000000000030'),
  (select today-2 from ctx),'o lançamento guarda a data original'
);
select is(
  (select origin_daily_close_id from public.financial_transactions where id='a7000000-0000-4000-8000-000000000030'),
  (select id from closed_snapshot),'o lançamento aponta para o fechamento original'
);
select pg_temp.post('a7000000-0000-4000-8000-000000000031',((select today-1 from ctx)+time '15:00') at time zone 'America/Sao_Paulo');
select is(
  (select business_date::text||'|'||coalesce(original_business_date::text,'sem origem') from public.financial_transactions where id='a7000000-0000-4000-8000-000000000031'),
  (select (today-1)::text||'|sem origem' from ctx),'lançamento em dia aberto fica na própria data'
);
select is(
  (select fingerprint from public.daily_closes where id=(select id from closed_snapshot)),
  (select fingerprint from closed_snapshot),'o fechamento original continua igual'
);
insert into public.financial_transactions(id,hotel_id,type,category,amount,currency,description,status,payment_method,business_date,created_by)
select 'a7000000-0000-4000-8000-000000000033',hotel,'INCOME','OTHER_INCOME',70,'BRL','Previsto para o dia','PENDING','pix',today-1,manager from ctx;
-- A data do dia fechado não recebe valor nem por alteração posterior.
select is(pg_temp.close_day((select today-1 from ctx)),'ok','o dia do lançamento aberto é fechado');
update public.financial_transactions set status='COMPLETED',paid_at=public.hotel_operational_now(hotel_id) where id='a7000000-0000-4000-8000-000000000033';
select is(
  (select business_date::text||'|'||original_business_date::text from public.financial_transactions where id='a7000000-0000-4000-8000-000000000033'),
  (select today::text||'|'||(today-1)::text from ctx),'pendente concluído depois do fechamento vai para a data atual'
);
select is(
  (select origin_daily_close_id from public.financial_transactions where id='a7000000-0000-4000-8000-000000000033'),
  (select c.id from public.daily_closes c join ctx on c.hotel_id=ctx.hotel and c.business_date=ctx.today-1),
  'pendente concluído aponta para o fechamento original'
);
select throws_ok(
  $$update public.financial_transactions set amount=60 where id='a7000000-0000-4000-8000-000000000031'$$,
  'P0001','closed_day_immutable','valor de lançamento em dia fechado não muda'
);
select throws_ok(
  $$delete from public.financial_transactions where id='a7000000-0000-4000-8000-000000000031'$$,
  'P0001','closed_day_immutable','lançamento em dia fechado não é apagado'
);
select lives_ok(
  $$update public.financial_transactions set description='Descrição corrigida' where id='a7000000-0000-4000-8000-000000000031'$$,
  'a descrição pode ser corrigida'
);
-- Fechado o dia de hoje, o que entra depois fica na próxima data aberta.
select is(pg_temp.close_day((select today from ctx)),'ok','o dia atual é fechado');
select pg_temp.post('a7000000-0000-4000-8000-000000000032',public.hotel_operational_now((select hotel from ctx)));
select is(
  (select business_date::text||'|'||original_business_date::text from public.financial_transactions where id='a7000000-0000-4000-8000-000000000032'),
  (select (today+1)::text||'|'||today::text from ctx),'depois de fechar o dia, o lançamento vai para a próxima data'
);

-- FIN-19: a data vem do fuso do hotel, mesmo com sessão que cruza a meia-noite.
create temporary table midnight on commit drop as select (select today+5 from ctx) as day;
create function pg_temp.freeze(p_at timestamptz) returns void language sql as $$
  insert into public.hotel_training_environments(hotel_id,clock_mode,frozen_at)
  select hotel,'frozen',p_at from ctx
  on conflict(hotel_id) do update set clock_mode='frozen',frozen_at=excluded.frozen_at,version=public.hotel_training_environments.version+1
$$;
select pg_temp.freeze(((select day from midnight)+time '23:30') at time zone 'America/Sao_Paulo');
select is(
  (select public.open_cash_session(hotel,register,cashier,jsonb_build_object(
    'opening_float',30,'idempotency_key','a7000000-0000-4000-8000-000000000040'))->>'result' from ctx),
  'ok','a sessão abre às 23h30'
);
select is((pg_temp.session()).business_date,(select day from midnight),'a sessão fica na data do hotel');
insert into public.financial_transactions(id,hotel_id,type,category,amount,currency,description,status,payment_method,created_by)
select 'a7000000-0000-4000-8000-000000000041',hotel,'INCOME','OTHER_INCOME',11,'BRL','Antes da meia-noite','COMPLETED','cash',cashier from ctx;
select pg_temp.freeze(((select day+1 from midnight)+time '00:30') at time zone 'America/Sao_Paulo');
insert into public.financial_transactions(id,hotel_id,type,category,amount,currency,description,status,payment_method,created_by)
select 'a7000000-0000-4000-8000-000000000042',hotel,'INCOME','OTHER_INCOME',13,'BRL','Depois da meia-noite','COMPLETED','cash',cashier from ctx;
select is(
  (select business_date from public.financial_transactions where id='a7000000-0000-4000-8000-000000000041'),
  (select day from midnight),'às 23h30 vale o dia do hotel, embora em UTC já seja o dia seguinte'
);
select is(
  (select business_date from public.financial_transactions where id='a7000000-0000-4000-8000-000000000042'),
  (select day+1 from midnight),'depois da meia-noite vale o novo dia do hotel'
);
select is(
  (select cash_session_id from public.financial_transactions where id='a7000000-0000-4000-8000-000000000042'),
  (pg_temp.session()).id,'o dinheiro continua na sessão aberta antes da meia-noite'
);
select is(
  (public.daily_close_projection((select hotel from ctx),(select day from midnight))->'totals'->>'income')::numeric,
  11.00,'cada dia soma só o que entrou nele: antes da meia-noite'
);
select is(
  (public.daily_close_projection((select hotel from ctx),(select day+1 from midnight))->'totals'->>'income')::numeric,
  13.00,'cada dia soma só o que entrou nele: depois da meia-noite'
);
select ok(
  (select bool_or(item->>'kind'='cash_session_open') from jsonb_array_elements(public.daily_close_projection((select hotel from ctx),(select day from midnight))->'blockers') item),
  'a sessão aberta bloqueia o fechamento do dia em que abriu'
);

-- FIN-28: o aluguel vira valor mensal e a vigência parcial conta os dias civis do mês.
update public.consumption_management_settings
set settlement_tracking_starts_on=(select period from ctx),last_changed_by=(select finance from ctx)
where hotel_id=(select hotel from ctx);
create function pg_temp.rent_partner(p_code text,p_frequency public.commercial_rent_frequency,p_rent numeric,p_start date,p_end date default null)
returns numeric language plpgsql as $$
declare v_partner uuid:=gen_random_uuid();v_agreement uuid:=gen_random_uuid();v_revision uuid:=gen_random_uuid();v ctx;v_result jsonb;v_rent numeric;
begin
  select * into v from ctx;
  insert into public.commercial_partners(id,hotel_id,trade_name,legal_name,is_active,last_changed_by)
  values(v_partner,v.hotel,'Parceiro '||p_code,'Parceiro '||p_code||' Ltda.',true,v.manager);
  insert into public.commercial_agreements(id,hotel_id,partner_id,internal_number,last_changed_by)
  values(v_agreement,v.hotel,v_partner,p_code,v.manager);
  insert into public.commercial_agreement_revisions(id,hotel_id,agreement_id,version,starts_on,ends_on,status,commercial_model,fixed_rent,rent_frequency,payment_recipient,currency,last_changed_by)
  values(v_revision,v.hotel,v_agreement,1,p_start,p_end,'draft','fixed_rent',p_rent,p_frequency,'hotel','BRL',v.manager);
  insert into public.commercial_agreement_revision_points(id,hotel_id,revision_id,point_id,last_changed_by)
  values(gen_random_uuid(),v.hotel,v_revision,v.point,v.manager);
  if public.activate_commercial_agreement_revision(v.hotel,v_revision,v.manager)<>'ok' then raise exception 'acordo não ativado'; end if;
  v_result:=public.refresh_partner_settlement(v.hotel,v_partner,v.period,v.finance,null);
  if v_result->>'result'<>'ok' then raise exception 'apuração recusada: %',v_result; end if;
  select component.prorated_rent into v_rent from public.partner_settlement_components component
  join public.partner_settlements settlement on settlement.id=component.settlement_id
  where settlement.partner_id=v_partner and settlement.period_start=v.period;
  return v_rent;
end $$;
select is(pg_temp.rent_partner('RENT-Q','quarterly',900,(select period from ctx)),300.00,'aluguel trimestral divide por três');
select is(pg_temp.rent_partner('RENT-Y','yearly',1200,(select period from ctx)),100.00,'aluguel anual divide por doze');
select is(pg_temp.rent_partner('RENT-M','monthly',500,(select period from ctx)),500.00,'aluguel mensal fica inteiro no mês completo');
select is(
  pg_temp.rent_partner('RENT-S','monthly',310,(select period+16 from ctx)),
  (select round(310.0*((period+interval '1 month - 1 day')::date-(period+16)+1)/extract(day from (period+interval '1 month - 1 day')::date),2) from ctx),
  'início no meio do mês conta só os dias vigentes'
);
select is(
  pg_temp.rent_partner('RENT-E','monthly',310,(select period from ctx),(select period+9 from ctx)),
  (select round(310.0*10/extract(day from (period+interval '1 month - 1 day')::date),2) from ctx),
  'fim no meio do mês conta só os dias vigentes'
);

-- FIN-31: correção pendente impede aprovar a apuração, e decidi-la libera.
insert into public.commercial_partners(id,hotel_id,trade_name,legal_name,is_active,last_changed_by)
select 'a7000000-0000-4000-8000-000000000050',hotel,'Parceiro correção','Parceiro correção Ltda.',true,manager from ctx;
insert into public.commercial_agreements(id,hotel_id,partner_id,internal_number,last_changed_by)
select 'a7000000-0000-4000-8000-000000000051',hotel,'a7000000-0000-4000-8000-000000000050','COR-001',manager from ctx;
insert into public.commercial_agreement_revisions(id,hotel_id,agreement_id,version,starts_on,status,commercial_model,commission_percentage,payment_recipient,currency,last_changed_by)
select 'a7000000-0000-4000-8000-000000000052',hotel,'a7000000-0000-4000-8000-000000000051',1,period,'draft','revenue_share',20,'both','BRL',manager from ctx;
insert into public.commercial_agreement_revision_points(id,hotel_id,revision_id,point_id,last_changed_by)
select 'a7000000-0000-4000-8000-000000000053',hotel,'a7000000-0000-4000-8000-000000000052',point,manager from ctx;
select is(
  (select public.activate_commercial_agreement_revision(hotel,'a7000000-0000-4000-8000-000000000052',manager) from ctx),
  'ok','o acordo do parceiro é ativado'
);
insert into public.products(id,hotel_id,name,category_id,description,internal_code,kind,sales_unit,unit_price,status,provider_type,commercial_partner_id)
select 'a7000000-0000-4000-8000-000000000054',hotel,'Serviço do parceiro','41000000-0000-4000-8000-000000000002','Serviço das regras','COR-SERV','service','unit',100,'active','partner','a7000000-0000-4000-8000-000000000050' from ctx;
insert into public.consumption_offers(id,hotel_id,point_id,product_id,display_order,is_active,policy_source,commercial_agreement_id,last_changed_by)
select 'a7000000-0000-4000-8000-000000000055',hotel,point,'a7000000-0000-4000-8000-000000000054',30,true,'inherit','a7000000-0000-4000-8000-000000000051',manager from ctx;
insert into public.consumption_orders(id,hotel_id,stay_id,reservation_id,point_id,guest_customer_id,disposition,billing_mode,payment_method,payment_reference,currency,gross_amount,discount_amount,net_amount,reservation_code_snapshot,room_number_snapshot,guest_name_snapshot,point_name_snapshot,occurred_at,posted_at,posted_by,idempotency_key,request_fingerprint,is_legacy)
select 'a7000000-0000-4000-8000-000000000056',hotel,stay,(select reservation_id from public.stays where id=ctx.stay),point,'30000000-0000-4000-8000-000000000002','charged','hotel_immediate','pix','PIX-REGRAS','BRL',100,0,100,'LOCAL-AUR-002','102','Bruno Exemplo','Café Aurora',
  ((period+14)+time '15:00') at time zone 'America/Sao_Paulo',public.hotel_operational_now(hotel),reception,'a7000000-0000-4000-8000-000000000057','regras:parceiro',false from ctx;
insert into public.consumption_order_items(id,hotel_id,order_id,offer_id,product_id,category_id,commercial_partner_id,commercial_agreement_id,commercial_revision_id,quantity,charged_unit_price,discount_amount,product_name_snapshot,product_internal_code_snapshot,product_kind_snapshot,sales_unit_snapshot,category_name_snapshot,provider_type_snapshot,partner_name_snapshot,agreement_number_snapshot,commercial_revision_version_snapshot,commercial_terms_snapshot,billing_policy_snapshot,version_token)
select 'a7000000-0000-4000-8000-000000000058',hotel,'a7000000-0000-4000-8000-000000000056','a7000000-0000-4000-8000-000000000055','a7000000-0000-4000-8000-000000000054','41000000-0000-4000-8000-000000000002','a7000000-0000-4000-8000-000000000050','a7000000-0000-4000-8000-000000000051','a7000000-0000-4000-8000-000000000052',1,100,0,'Serviço do parceiro','COR-SERV','service','unit','Alimentacao','partner','Parceiro correção','COR-001',1,'{"commission_percentage":20}'::jsonb,'{"source":"agreement"}'::jsonb,'regras:item' from ctx;
create function pg_temp.settlement() returns public.partner_settlements language sql as $$
  select s.* from public.partner_settlements s where s.partner_id='a7000000-0000-4000-8000-000000000050'
$$;
select is(
  (select public.refresh_partner_settlement(hotel,'a7000000-0000-4000-8000-000000000050',period,finance,null)->>'result' from ctx),
  'ok','o financeiro apura o mês'
);
select is(
  (select public.submit_partner_settlement(hotel,(pg_temp.settlement()).id,finance,(pg_temp.settlement()).version)->>'result' from ctx),
  'ok','o financeiro envia para aprovação'
);
insert into public.consumption_corrections(id,hotel_id,stay_id,order_id,kind,status,reason,account_version,gross_reduction,discount_increase,net_reduction,requested_by,requested_at)
select 'a7000000-0000-4000-8000-000000000059',hotel,stay,'a7000000-0000-4000-8000-000000000056','partial_adjustment','pending','Item devolvido',pg_temp.version(),10,0,10,reception,public.hotel_operational_now(hotel) from ctx;
select is(
  (select public.decide_partner_settlement(hotel,(pg_temp.settlement()).id,manager,(pg_temp.settlement()).version,'approve')->>'result' from ctx),
  'settlement_pending_corrections','correção pendente impede a aprovação'
);
select is((pg_temp.settlement()).status::text,'in_review','a apuração continua em revisão');
select is(
  (select public.decide_consumption_correction(hotel,'a7000000-0000-4000-8000-000000000059',manager,'reject','Sem devolução') from ctx)->>'result',
  'ok','a correção é recusada'
);
select is(
  (select public.decide_partner_settlement(hotel,(pg_temp.settlement()).id,manager,(pg_temp.settlement()).version,'approve')->>'result' from ctx),
  'ok','sem correção pendente, a apuração é aprovada'
);

-- FIN-07: cobrança de manutenção em aberto só sai com ciência explícita.
insert into public.stay_folio_entries(hotel_id,stay_id,reservation_id,direction,kind,amount,currency,description,source_key,posted_at)
select hotel,stay,(select reservation_id from public.stays where id=ctx.stay),'debit','maintenance_charge',100,'BRL','Dano aceito como exceção','regras:dano',public.hotel_operational_now(hotel) from ctx;
select is(
  (select public.assign_stay_payer_allocations(hotel,stay,manager,pg_temp.version(),pg_temp.allocations(0),false)->>'result' from ctx),
  'ok','toda a conta volta para o hóspede principal'
);
create temporary table departure on commit drop as select (select today+20 from ctx) as day;
select pg_temp.freeze(((select day from departure)+time '11:30') at time zone 'America/Sao_Paulo');
update public.stays set checkin_date_expected=(select day-2 from departure),checkout_date_expected=(select day from departure)
where id=(select stay from ctx);
create function pg_temp.open_debit(p_maintenance boolean) returns numeric language sql as $$
  select coalesce(sum(e.amount-coalesce((select sum(a.amount) from public.stay_folio_allocations a where a.debit_entry_id=e.id),0)),0)
  from public.stay_folio_entries e
  where e.stay_id=(select stay from ctx) and e.direction='debit' and (e.kind='maintenance_charge')=p_maintenance
$$;
select is(
  (select public.create_stay_payment_batch(hotel,stay,manager,jsonb_build_array(jsonb_build_object('payment_method','pix','amount',pg_temp.open_debit(false))),
    'a7000000-0000-4000-8000-000000000060',pg_temp.version(),'regular','Saldo da hospedagem')->>'result' from ctx),
  'ok','o hóspede quita a hospedagem e o consumo'
);
select ok(pg_temp.open_debit(true)>0,'a cobrança de manutenção continua em aberto');
create function pg_temp.checkout(p_key uuid,p_entries uuid[]) returns jsonb language sql as $$
  select public.checkout_stay_account_stage4(hotel,stay,manager,pg_temp.version(),'[]'::jsonb,p_key,
    coalesce((select array_agg(o.id) from public.maintenance_occurrences o where o.stay_id=ctx.stay and o.status not in ('resolved','canceled')),array[]::uuid[]),
    p_entries,'Hóspede ciente') from ctx
$$;
select is(
  (pg_temp.checkout('a7000000-0000-4000-8000-000000000061',array[]::uuid[]))->>'result',
  'maintenance_acknowledgement_required','sem ciência da cobrança a saída é recusada'
);
select is(
  (pg_temp.checkout('a7000000-0000-4000-8000-000000000062',
    (select array_agg(e.id) from public.stay_folio_entries e where e.stay_id=(select stay from ctx) and e.kind='maintenance_charge' and e.direction='debit')))->>'result',
  'ok','com a ciência a saída é aceita'
);
select is(
  (select count(*)::integer from public.maintenance_financial_checkout_acknowledgements a
    where a.stay_id=(select stay from ctx) and a.acknowledged_by=(select manager from ctx)),
  1,'a ciência registra quem a deu'
);

select * from finish();
rollback;
