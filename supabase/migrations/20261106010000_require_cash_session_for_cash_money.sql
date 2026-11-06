-- Dinheiro só existe dentro da sessão de caixa de quem o recebe. Sem isso, um pagamento em dinheiro
-- ficava sem sessão e o fechamento do dia recusava a preparação, sem caminho de saída.

create or replace function public.assign_financial_business_context()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$ declare v_session uuid;
begin
 -- Pagamento concluído sem data informada acontece no instante operacional do hotel.
 if new.paid_at is null and new.status in ('COMPLETED','REFUNDED') then new.paid_at:=public.hotel_operational_now(new.hotel_id);end if;
 if new.business_date is null then
  if new.paid_at is not null then
   select (new.paid_at at time zone h.timezone)::date into new.business_date from public.hotels h where h.id=new.hotel_id;
  else
   new.business_date:=public.hotel_operational_date(new.hotel_id);
  end if;
 end if;
 if new.cash_session_id is null and new.created_by is not null and new.status in ('COMPLETED','REFUNDED') then select id into v_session from public.cash_sessions where hotel_id=new.hotel_id and operator_id=new.created_by and status='open' order by opened_at desc limit 1;new.cash_session_id:=v_session;end if;
 if new.cash_session_id is null and lower(coalesce(new.payment_method,''))='cash' and new.status in ('COMPLETED','REFUNDED') then raise exception 'cash_session_required';end if;
 if new.original_business_date is not null and new.original_business_date<>new.business_date and new.origin_daily_close_id is null then raise exception 'origin_close_required';end if;
 return new;end $function$;

-- O movimento nasce quando o dinheiro passa a estar concluído e na sessão, uma única vez.
create or replace function public.mirror_financial_cash_movement()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$ declare v_kind public.cash_movement_kind;v_delta numeric;v_key uuid;
begin if new.cash_session_id is null then return new;end if;
 if lower(coalesce(new.payment_method,''))<>'cash' or new.status not in ('COMPLETED','REFUNDED') then return new;end if;
 if exists(select 1 from public.cash_movements where financial_transaction_id=new.id) then return new;end if;
 v_kind:=case when new.type='REFUND' then 'refund'::public.cash_movement_kind when new.type='EXPENSE' then 'cash_out'::public.cash_movement_kind else 'receipt'::public.cash_movement_kind end;
 v_delta:=case when v_kind in('refund','cash_out') then -new.amount else new.amount end;v_key:=gen_random_uuid();
 insert into public.cash_movements(hotel_id,cash_session_id,kind,amount,cash_delta,reason,financial_transaction_id,idempotency_key,request_fingerprint,actor_id,occurred_at)
 values(new.hotel_id,new.cash_session_id,v_kind,new.amount,v_delta,coalesce(nullif(new.description,''),'Movimento financeiro'),new.id,v_key,md5(new.id::text),coalesce(new.created_by,(select operator_id from public.cash_sessions where id=new.cash_session_id)),coalesce(new.paid_at,new.created_at));
 update public.cash_sessions set expected_cash=expected_cash+v_delta,version=version+1,updated_at=now() where id=new.cash_session_id and status='open';
 if not found then raise exception 'cash_session_not_open';end if;return new;end $function$;

drop trigger if exists financial_cash_movement on public.financial_transactions;
create trigger financial_cash_movement after insert or update of cash_session_id,status on public.financial_transactions
for each row execute function public.mirror_financial_cash_movement();

-- Depois de entrar no caixa, o movimento só se corrige por operação compensatória.
create or replace function public.guard_financial_cash_changes()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
declare v_was_cash boolean:=lower(coalesce(old.payment_method,''))='cash' and old.status in ('COMPLETED','REFUNDED');
begin
 if tg_op='DELETE' then
  if v_was_cash and old.cash_session_id is not null then raise exception 'cash_transaction_immutable';end if;
  return old;
 end if;
 if v_was_cash and old.cash_session_id is not null and (
   new.amount<>old.amount or new.type<>old.type or new.status<>old.status
   or lower(coalesce(new.payment_method,''))<>'cash' or new.cash_session_id is distinct from old.cash_session_id
 ) then raise exception 'cash_transaction_immutable';end if;
 if not v_was_cash and lower(coalesce(new.payment_method,''))='cash' and new.status in ('COMPLETED','REFUNDED') and new.cash_session_id is null then
  raise exception 'cash_session_required';
 end if;
 return new;
end $function$;

create trigger financial_cash_guard before update or delete on public.financial_transactions
for each row execute function public.guard_financial_cash_changes();

-- Assumir o dinheiro na sessão é a única alteração aceita em uma transação gerada.
create or replace function public.protect_generated_financial_transaction()
 returns trigger
 language plpgsql
as $function$
begin
  if tg_op='UPDATE' and old.cash_session_id is null and new.cash_session_id is not null
    and to_jsonb(new)-'cash_session_id'-'updated_at'=to_jsonb(old)-'cash_session_id'-'updated_at' then
    return new;
  end if;
  if (old.reservation_id is not null and old.category='RESERVATION_GUARANTEE') or old.maintenance_cost_item_id is not null or old.maintenance_recovery_id is not null
    or old.partner_settlement_id is not null
    or exists (select 1 from public.stay_folio_entries where financial_transaction_id = old.id) then
    raise exception 'generated financial transactions require compensating operations' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

-- Saída para os dias que já travaram: quem está com o dinheiro o assume na própria sessão, com
-- justificativa. A transação mantém a data original, e o movimento entra na sessão atual.
create or replace function public.adopt_cash_transaction(p_hotel_id uuid,p_id uuid,p_actor_id uuid,p_input jsonb)
 returns jsonb
 language plpgsql
 set search_path to 'public'
as $function$
declare v_tx public.financial_transactions%rowtype;v_session public.cash_sessions%rowtype;v_reason text:=nullif(btrim(p_input->>'reason'),'');v_kind public.cash_movement_kind;v_delta numeric;
begin
 select * into v_tx from public.financial_transactions where id=p_id and hotel_id=p_hotel_id for update;
 if not found then return jsonb_build_object('result','not_found');end if;
 if lower(coalesce(v_tx.payment_method,''))<>'cash' or v_tx.status not in ('COMPLETED','REFUNDED') or v_tx.cash_session_id is not null then return jsonb_build_object('result','invalid_transition');end if;
 if v_reason is null then return jsonb_build_object('result','reason_required');end if;
 select * into v_session from public.cash_sessions where hotel_id=p_hotel_id and operator_id=p_actor_id and status='open' order by opened_at desc limit 1 for update;
 if not found then return jsonb_build_object('result','cash_session_required');end if;
 v_kind:=case when v_tx.type='REFUND' then 'refund'::public.cash_movement_kind when v_tx.type='EXPENSE' then 'cash_out'::public.cash_movement_kind else 'receipt'::public.cash_movement_kind end;
 v_delta:=case when v_kind in('refund','cash_out') then -v_tx.amount else v_tx.amount end;
 if v_session.expected_cash+v_delta<0 then return jsonb_build_object('result','insufficient_cash');end if;
 insert into public.cash_movements(hotel_id,cash_session_id,kind,amount,cash_delta,reason,financial_transaction_id,idempotency_key,request_fingerprint,actor_id,occurred_at)
 values(p_hotel_id,v_session.id,v_kind,v_tx.amount,v_delta,'Regularização: '||v_reason,v_tx.id,md5(v_tx.id::text||'adopt')::uuid,md5(v_tx.id::text),p_actor_id,public.hotel_operational_now(p_hotel_id));
 update public.cash_sessions set expected_cash=expected_cash+v_delta,version=version+1,updated_at=now() where id=v_session.id;
 update public.financial_transactions set cash_session_id=v_session.id where id=v_tx.id;
 return jsonb_build_object('result','ok','id',v_tx.id);
end $function$;

-- Recebimentos de empresa e de pós-checkout também são dinheiro do hotel: entram nas transações e no caixa.
CREATE OR REPLACE FUNCTION public.pay_corporate_receivable(p_hotel_id uuid, p_receivable_id uuid, p_actor_id uuid, p_expected_version integer, p_tenders jsonb, p_idempotency_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_receivable public.corporate_receivables%rowtype;v_tender jsonb;v_total numeric:=0;v_fingerprint text;v_existing record;v_index integer:=0;v_session uuid;
begin
  v_fingerprint:=md5(jsonb_build_object('receivable',p_receivable_id,'tenders',p_tenders)::text);
  select id,request_fingerprint into v_existing from public.corporate_receivable_payments where hotel_id=p_hotel_id and idempotency_key=p_idempotency_key;
  if found then return case when v_existing.request_fingerprint=v_fingerprint then jsonb_build_object('result','ok','created',false) else jsonb_build_object('result','idempotency_conflict') end;end if;
  select * into v_receivable from public.corporate_receivables where id=p_receivable_id and hotel_id=p_hotel_id for update;
  if not found then return jsonb_build_object('result','not_found');end if;if v_receivable.version<>p_expected_version then return jsonb_build_object('result','version_conflict');end if;
  for v_tender in select value from jsonb_array_elements(p_tenders) loop v_total:=v_total+(v_tender->>'amount')::numeric;end loop;
  if v_total<=0 or v_receivable.paid_amount+v_total>v_receivable.amount then return jsonb_build_object('result','payment_exceeds_balance');end if;
  select id into v_session from public.cash_sessions where hotel_id=p_hotel_id and operator_id=p_actor_id and status='open' order by opened_at desc limit 1;
  if v_session is null and exists(select 1 from jsonb_array_elements(p_tenders) tender where tender->>'payment_method'='cash') then return jsonb_build_object('result','cash_session_required');end if;
  for v_tender in select value from jsonb_array_elements(p_tenders) loop
    insert into public.corporate_receivable_payments(hotel_id,receivable_id,amount,payment_method,reference_code,idempotency_key,request_fingerprint,created_by)
    values(p_hotel_id,p_receivable_id,(v_tender->>'amount')::numeric,(v_tender->>'payment_method')::public.consumption_payment_method,nullif(btrim(v_tender->>'reference_code'),''),case when v_index=0 then p_idempotency_key else md5(p_idempotency_key::text||v_index::text)::uuid end,v_fingerprint,p_actor_id);v_index:=v_index+1;
    insert into public.financial_transactions(hotel_id,type,category,amount,currency,description,status,payment_method,paid_at,created_by,reference_code,cash_session_id) values(p_hotel_id,'INCOME','CORPORATE_RECEIVABLE',(v_tender->>'amount')::numeric,v_receivable.currency,'Recebimento de empresa','COMPLETED',v_tender->>'payment_method',public.hotel_operational_now(p_hotel_id),p_actor_id,nullif(btrim(v_tender->>'reference_code'),''),v_session);
  end loop;
  update public.corporate_receivables set paid_amount=paid_amount+v_total,status=case when paid_amount+v_total=amount then 'paid'::public.corporate_receivable_status else 'partially_paid'::public.corporate_receivable_status end,version=version+1,updated_at=now() where id=p_receivable_id;
  insert into public.corporate_credit_events(hotel_id,entity_type,entity_id,action,actor_id,details) values(p_hotel_id,'receivable',p_receivable_id,'payment_received',p_actor_id,jsonb_build_object('amount',v_total,'multi_tender',jsonb_array_length(p_tenders)>1));
  return jsonb_build_object('result','ok','created',true);
end $function$;

CREATE OR REPLACE FUNCTION public.pay_post_checkout_consumption_case(p_hotel_id uuid, p_case_id uuid, p_actor_id uuid, p_expected_version integer, p_tenders jsonb, p_idempotency_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_case public.post_checkout_consumption_cases%rowtype;v_account public.post_checkout_supplemental_accounts%rowtype;v_tender jsonb;v_total numeric:=0;v_fingerprint text;v_existing record;v_session uuid;
begin
  v_fingerprint:=md5(jsonb_build_object('case',p_case_id,'tenders',p_tenders)::text);select id,request_fingerprint into v_existing from public.post_checkout_consumption_payments where hotel_id=p_hotel_id and idempotency_key=p_idempotency_key;if found then return case when v_existing.request_fingerprint=v_fingerprint then jsonb_build_object('result','ok','created',false) else jsonb_build_object('result','idempotency_conflict') end;end if;
  select * into v_case from public.post_checkout_consumption_cases where id=p_case_id and hotel_id=p_hotel_id for update;if not found then return jsonb_build_object('result','not_found');end if;if v_case.version<>p_expected_version then return jsonb_build_object('result','version_conflict');end if;
  select * into v_account from public.post_checkout_supplemental_accounts where case_id=p_case_id for update;if not found or v_case.status not in('collection_pending','partially_paid') then return jsonb_build_object('result','invalid_state');end if;
  for v_tender in select value from jsonb_array_elements(p_tenders) loop v_total:=v_total+(v_tender->>'amount')::numeric;end loop;if v_total<=0 or v_account.paid_amount+v_total>v_account.amount then return jsonb_build_object('result','payment_exceeds_balance');end if;
  select id into v_session from public.cash_sessions where hotel_id=p_hotel_id and operator_id=p_actor_id and status='open' order by opened_at desc limit 1;
  if v_session is null and exists(select 1 from jsonb_array_elements(p_tenders) tender where tender->>'payment_method'='cash') then return jsonb_build_object('result','cash_session_required');end if;
  for v_tender in select value from jsonb_array_elements(p_tenders) loop insert into public.post_checkout_consumption_payments(hotel_id,case_id,amount,payment_method,reference_code,idempotency_key,request_fingerprint,created_by) values(p_hotel_id,p_case_id,(v_tender->>'amount')::numeric,(v_tender->>'payment_method')::public.consumption_payment_method,nullif(btrim(v_tender->>'reference_code'),''),case when v_total=(v_tender->>'amount')::numeric then p_idempotency_key else md5(p_idempotency_key::text||v_tender::text)::uuid end,v_fingerprint,p_actor_id);
    insert into public.financial_transactions(hotel_id,type,category,amount,currency,description,status,payment_method,paid_at,created_by,reference_code,cash_session_id) values(p_hotel_id,'INCOME','POST_CHECKOUT_CONSUMPTION',(v_tender->>'amount')::numeric,v_account.currency,'Recebimento de consumo pós-checkout','COMPLETED',v_tender->>'payment_method',public.hotel_operational_now(p_hotel_id),p_actor_id,nullif(btrim(v_tender->>'reference_code'),''),v_session);
  end loop;
  update public.post_checkout_supplemental_accounts set paid_amount=paid_amount+v_total,version=version+1,updated_at=now() where id=v_account.id;
  update public.post_checkout_consumption_cases set status=case when v_account.paid_amount+v_total=v_account.amount then 'paid'::public.post_checkout_consumption_status else 'partially_paid'::public.post_checkout_consumption_status end,version=version+1,updated_at=now() where id=p_case_id;
  insert into public.post_checkout_consumption_events(hotel_id,case_id,action,actor_id,details) values(p_hotel_id,p_case_id,'payment_received',p_actor_id,jsonb_build_object('amount',v_total,'multi_tender',jsonb_array_length(p_tenders)>1));return jsonb_build_object('result','ok','created',true);
end $function$;

-- Lançamento pendente ainda não é dinheiro: não impede o fechamento.
CREATE OR REPLACE FUNCTION public.daily_close_projection(p_hotel_id uuid, p_business_date date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
with tx as(
  select type,coalesce(nullif(lower(payment_method),''),'other') payment_method,sum(amount) amount,count(*) count
  from public.financial_transactions where hotel_id=p_hotel_id and business_date=p_business_date and status='COMPLETED'
  group by type,coalesce(nullif(lower(payment_method),''),'other')
), blockers as(
  select 'cash_session_open' kind,id entity_id,'Feche ou cancele a sessão de caixa antes de preparar o dia.' title,null::numeric amount
  from public.cash_sessions where hotel_id=p_hotel_id and business_date=p_business_date and status in('open','counting','difference_pending')
  union all
  select 'cash_without_session',id,'Dinheiro recebido sem sessão de caixa. Quem tem o valor deve assumi-lo na própria sessão.',amount
  from public.financial_transactions where hotel_id=p_hotel_id and business_date=p_business_date and lower(coalesce(payment_method,''))='cash' and cash_session_id is null and status in('COMPLETED','REFUNDED')
), totals as(
  select coalesce(sum(amount) filter(where type='INCOME'),0) income,
    coalesce(sum(amount) filter(where type='EXPENSE'),0) expense,
    coalesce(sum(amount) filter(where type='REFUND'),0) refund
  from public.financial_transactions where hotel_id=p_hotel_id and business_date=p_business_date and status='COMPLETED'
)
select jsonb_build_object(
  'business_date',p_business_date,
  'transactions',coalesce((select jsonb_agg(to_jsonb(tx) order by type,payment_method) from tx),'[]'::jsonb),
  'totals',jsonb_build_object('income',totals.income,'expense',totals.expense,'refund',totals.refund),
  'is_zero_activity',(totals.income=0 and totals.expense=0 and totals.refund=0),
  'cash_sessions',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object(
      'operator_name',u.name,'closed_by_name',cu.name,'register_name',r.name,'currency',r.currency) order by s.opened_at)
    from public.cash_sessions s join public.cash_registers r on r.id=s.cash_register_id
    left join public.users u on u.id=s.operator_id left join public.users cu on cu.id=s.closed_by
    where s.hotel_id=p_hotel_id and s.business_date=p_business_date),'[]'::jsonb),
  'blockers',coalesce((select jsonb_agg(to_jsonb(blockers)) from blockers),'[]'::jsonb)
) from totals
$function$;
