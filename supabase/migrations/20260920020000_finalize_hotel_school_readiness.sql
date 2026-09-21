-- Finaliza regras descobertas durante a execução reproduzível do hotel-escola.

create or replace function public.write_catalog_audit_event()
returns trigger language plpgsql as $$
declare
  v_action text;
  v_new jsonb:=to_jsonb(new);
  v_old jsonb:=case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
begin
  if tg_op='INSERT' then
    v_action:='created';
  elsif v_new->'archived_at' is distinct from v_old->'archived_at' then
    v_action:=case when v_new->>'archived_at' is null then 'restored' else 'archived' end;
  elsif tg_table_name='product_categories'
    and v_new->'is_active' is distinct from v_old->'is_active' then
    v_action:=case when (v_new->>'is_active')::boolean then 'activated' else 'deactivated' end;
  elsif tg_table_name='products'
    and v_new->'status' is distinct from v_old->'status' then
    v_action:=case when v_new->>'status'='active' then 'activated' else 'deactivated' end;
  else
    v_action:='updated';
  end if;
  insert into public.catalog_audit_events(
    hotel_id,entity_type,entity_id,actor_id,action,changes
  ) values(
    new.hotel_id,
    case when tg_table_name='products'
      then 'product'::public.catalog_audit_entity
      else 'product_category'::public.catalog_audit_entity end,
    new.id,nullif(v_new->>'last_changed_by','')::uuid,v_action,
    jsonb_build_object(
      'before',case when tg_op='INSERT' then null else v_old-'last_changed_by' end,
      'after',v_new-'last_changed_by'
    )
  );
  return new;
end;
$$;

create or replace function public.decide_partner_settlement(
  p_hotel_id uuid,p_settlement_id uuid,p_actor_id uuid,p_expected_version bigint,p_decision text,p_reason text default null
) returns jsonb language plpgsql set search_path=public as $$
declare v_settlement public.partner_settlements%rowtype; v_timezone text; v_live text; v_snapshot jsonb; v_operational_date date;
begin
  if not public.maintenance_user_has_hotel_scope(p_actor_id,p_hotel_id) then return jsonb_build_object('result','actor_outside_hotel'); end if;
  select * into v_settlement from public.partner_settlements settlement
  where settlement.id=p_settlement_id and settlement.hotel_id=p_hotel_id for update;
  if not found then return jsonb_build_object('result','not_found'); end if;
  select timezone into v_timezone from public.hotels where id=p_hotel_id;
  v_operational_date:=public.hotel_operational_date(p_hotel_id);
  if v_settlement.status<>'in_review' then return jsonb_build_object('result','settlement_invalid_state'); end if;
  if v_settlement.version<>p_expected_version then return jsonb_build_object('result','settlement_version_conflict'); end if;
  if p_decision='reject' then
    if nullif(btrim(p_reason),'') is null then return jsonb_build_object('result','reason_required'); end if;
    update public.partner_settlements set status='draft',version=version+1,submitted_by=null,submitted_at=null where id=p_settlement_id returning * into v_settlement;
    insert into public.partner_settlement_events(hotel_id,settlement_id,action,actor_id,details)
    values(p_hotel_id,p_settlement_id,'rejected',p_actor_id,jsonb_build_object('reason',btrim(p_reason),'version',v_settlement.version));
    return jsonb_build_object('result','ok','id',p_settlement_id,'version',v_settlement.version);
  end if;
  if p_decision<>'approve' then return jsonb_build_object('result','invalid_decision'); end if;
  if v_settlement.prepared_by=p_actor_id then return jsonb_build_object('result','settlement_self_approval'); end if;
  if v_operational_date<=v_settlement.period_end then return jsonb_build_object('result','settlement_month_still_open'); end if;
  if exists (
    select 1 from public.consumption_corrections correction
    join public.consumption_order_items item on item.order_id=correction.order_id and item.commercial_partner_id=v_settlement.partner_id
    join public.consumption_orders orders on orders.id=correction.order_id
    where correction.hotel_id=p_hotel_id and correction.status in ('pending','approved','awaiting_refund','awaiting_partner_refund')
      and (orders.occurred_at at time zone v_timezone)::date<=v_settlement.period_end
  ) then return jsonb_build_object('result','settlement_pending_corrections'); end if;
  v_live:=public.partner_settlement_live_fingerprint(p_hotel_id,v_settlement.partner_id,v_settlement.period_start);
  if v_live<>v_settlement.source_fingerprint then return jsonb_build_object('result','settlement_sources_changed'); end if;
  select jsonb_build_object(
    'settlement',to_jsonb(v_settlement)-'statement_snapshot',
    'components',coalesce((select jsonb_agg(to_jsonb(component) order by component.segment_start,component.revision_version) from public.partner_settlement_components component where component.settlement_id=p_settlement_id),'[]'::jsonb),
    'sources',coalesce((select jsonb_agg(to_jsonb(source) order by source.occurred_at,source.id) from public.partner_settlement_sources source where source.settlement_id=p_settlement_id),'[]'::jsonb)
  ) into v_snapshot;
  update public.partner_settlements set
    status=case when net_settlement=0 then 'settled'::public.partner_settlement_status else 'approved'::public.partner_settlement_status end,
    version=version+1,approved_by=p_actor_id,approved_at=now(),statement_snapshot=v_snapshot,
    settled_by=case when net_settlement=0 then p_actor_id else null end,settled_at=case when net_settlement=0 then public.hotel_operational_now(p_hotel_id) else null end
  where id=p_settlement_id returning * into v_settlement;
  insert into public.partner_settlement_events(hotel_id,settlement_id,action,actor_id,details)
  values(p_hotel_id,p_settlement_id,'approved',p_actor_id,jsonb_build_object('version',v_settlement.version,'direction',v_settlement.direction,'net_settlement',v_settlement.net_settlement));
  if v_settlement.net_settlement=0 then
    insert into public.partner_settlement_events(hotel_id,settlement_id,action,actor_id,details)
    values(p_hotel_id,p_settlement_id,'settled_without_payment',p_actor_id,'{}');
  end if;
  return jsonb_build_object('result','ok','id',p_settlement_id,'version',v_settlement.version);
end;
$$;

create or replace function public.pay_partner_settlement(
  p_hotel_id uuid,p_settlement_id uuid,p_actor_id uuid,p_expected_version bigint,p_amount numeric,
  p_payment_method public.consumption_payment_method,p_paid_at timestamptz,p_reference_code text,p_notes text,
  p_idempotency_key uuid
) returns jsonb language plpgsql set search_path=public as $$
declare v_settlement public.partner_settlements%rowtype; v_partner_name text; v_existing public.partner_settlement_payments%rowtype;
  v_fingerprint text; v_transaction_id uuid; v_payment_id uuid; v_expected numeric(14,2); v_operational_now timestamptz;
begin
  if not public.maintenance_user_has_hotel_scope(p_actor_id,p_hotel_id) then return jsonb_build_object('result','actor_outside_hotel'); end if;
  v_operational_now:=public.hotel_operational_now(p_hotel_id);
  v_fingerprint:=md5(jsonb_build_object('settlement',p_settlement_id,'amount',round(p_amount,2),'method',p_payment_method,'paid_at',p_paid_at,
    'reference',nullif(btrim(p_reference_code),''),'notes',nullif(btrim(p_notes),''))::text);
  select * into v_existing from public.partner_settlement_payments where hotel_id=p_hotel_id and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.request_fingerprint<>v_fingerprint then return jsonb_build_object('result','settlement_idempotency_conflict'); end if;
    return jsonb_build_object('result','ok','id',v_existing.id,'created',false);
  end if;
  select * into v_settlement from public.partner_settlements where id=p_settlement_id and hotel_id=p_hotel_id for update;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if v_settlement.status<>'approved' then return jsonb_build_object('result','settlement_invalid_state'); end if;
  if v_settlement.version<>p_expected_version then return jsonb_build_object('result','settlement_version_conflict'); end if;
  v_expected:=abs(v_settlement.net_settlement);
  if round(p_amount,2)<>v_expected or p_amount<=0 then return jsonb_build_object('result','settlement_payment_mismatch'); end if;
  if p_paid_at>v_operational_now then return jsonb_build_object('result','paid_at_in_future'); end if;
  select trade_name into v_partner_name from public.commercial_partners where id=v_settlement.partner_id;
  insert into public.financial_transactions(hotel_id,type,category,amount,currency,description,status,payment_method,paid_at,due_date,counterparty,reference_code,created_by,partner_settlement_id)
  values(p_hotel_id,case when v_settlement.direction='hotel_to_partner' then 'EXPENSE'::public.transaction_type else 'INCOME'::public.transaction_type end,
    case when v_settlement.direction='hotel_to_partner' then 'PARTNER_SETTLEMENT_PAYOUT' else 'PARTNER_SETTLEMENT_COLLECTION' end,
    v_expected,v_settlement.currency,coalesce(nullif(btrim(p_notes),''),'Apuração comercial '||to_char(v_settlement.period_start,'MM/YYYY')),
    'COMPLETED',p_payment_method::text,p_paid_at,v_settlement.due_on,v_partner_name,nullif(btrim(p_reference_code),''),p_actor_id,p_settlement_id)
  returning id into v_transaction_id;
  insert into public.partner_settlement_payments(hotel_id,settlement_id,financial_transaction_id,amount,direction,payment_method,paid_at,reference_code,notes,idempotency_key,request_fingerprint,created_by)
  values(p_hotel_id,p_settlement_id,v_transaction_id,v_expected,v_settlement.direction,p_payment_method,p_paid_at,nullif(btrim(p_reference_code),''),nullif(btrim(p_notes),''),p_idempotency_key,v_fingerprint,p_actor_id)
  returning id into v_payment_id;
  update public.partner_settlements set status='settled',version=version+1,settled_by=p_actor_id,settled_at=p_paid_at where id=p_settlement_id;
  insert into public.partner_settlement_events(hotel_id,settlement_id,action,actor_id,details)
  values(p_hotel_id,p_settlement_id,'payment_recorded',p_actor_id,jsonb_build_object('payment_id',v_payment_id,'transaction_id',v_transaction_id,'amount',v_expected));
  return jsonb_build_object('result','ok','id',v_payment_id,'created',true);
end;
$$;

create or replace function public.reverse_partner_settlement_payment(
  p_hotel_id uuid,p_payment_id uuid,p_actor_id uuid,p_reason text,p_reversed_at timestamptz,p_idempotency_key uuid
) returns jsonb language plpgsql set search_path=public as $$
declare v_payment public.partner_settlement_payments%rowtype; v_settlement public.partner_settlements%rowtype; v_original public.financial_transactions%rowtype;
  v_transaction_id uuid; v_reversal_id uuid; v_fingerprint text; v_existing public.partner_settlement_payments%rowtype;
begin
  if not public.maintenance_user_has_hotel_scope(p_actor_id,p_hotel_id) then return jsonb_build_object('result','actor_outside_hotel'); end if;
  if nullif(btrim(p_reason),'') is null then return jsonb_build_object('result','reason_required'); end if;
  v_fingerprint:=md5(jsonb_build_object('payment',p_payment_id,'reason',btrim(p_reason),'at',p_reversed_at)::text);
  select * into v_existing from public.partner_settlement_payments where hotel_id=p_hotel_id and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.request_fingerprint<>v_fingerprint then return jsonb_build_object('result','settlement_idempotency_conflict'); end if;
    return jsonb_build_object('result','ok','id',v_existing.id,'created',false);
  end if;
  select * into v_payment from public.partner_settlement_payments where id=p_payment_id and hotel_id=p_hotel_id for update;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if v_payment.reversal_of_id is not null or exists(select 1 from public.partner_settlement_payments where reversal_of_id=p_payment_id) then return jsonb_build_object('result','payment_already_reversed'); end if;
  select * into v_settlement from public.partner_settlements where id=v_payment.settlement_id for update;
  if v_settlement.status<>'settled' or v_settlement.net_settlement=0 then return jsonb_build_object('result','settlement_invalid_state'); end if;
  if p_reversed_at>public.hotel_operational_now(p_hotel_id) then return jsonb_build_object('result','paid_at_in_future'); end if;
  select * into v_original from public.financial_transactions where id=v_payment.financial_transaction_id;
  insert into public.financial_transactions(hotel_id,type,category,amount,currency,description,status,payment_method,paid_at,due_date,counterparty,reference_code,created_by,partner_settlement_id)
  values(p_hotel_id,case when v_original.type='EXPENSE' then 'INCOME'::public.transaction_type else 'REFUND'::public.transaction_type end,
    'PARTNER_SETTLEMENT_REVERSAL',v_payment.amount,v_original.currency,btrim(p_reason),'COMPLETED',v_payment.payment_method::text,p_reversed_at,
    v_settlement.due_on,v_original.counterparty,'REV-'||v_original.id::text,p_actor_id,v_settlement.id) returning id into v_transaction_id;
  insert into public.partner_settlement_payments(hotel_id,settlement_id,financial_transaction_id,amount,direction,payment_method,paid_at,notes,idempotency_key,request_fingerprint,created_by,reversal_of_id)
  values(p_hotel_id,v_settlement.id,v_transaction_id,v_payment.amount,
    case when v_payment.direction='hotel_to_partner' then 'partner_to_hotel'::public.partner_settlement_direction else 'hotel_to_partner'::public.partner_settlement_direction end,
    v_payment.payment_method,p_reversed_at,btrim(p_reason),p_idempotency_key,v_fingerprint,p_actor_id,p_payment_id) returning id into v_reversal_id;
  update public.partner_settlements set status='approved',version=version+1,settled_by=null,settled_at=null where id=v_settlement.id;
  insert into public.partner_settlement_events(hotel_id,settlement_id,action,actor_id,details)
  values(p_hotel_id,v_settlement.id,'payment_reversed',p_actor_id,jsonb_build_object('payment_id',p_payment_id,'reversal_id',v_reversal_id,'reason',btrim(p_reason)));
  return jsonb_build_object('result','ok','id',v_reversal_id,'created',true);
end;
$$;

create or replace function public.pay_partner_settlement_partial(
  p_hotel_id uuid,p_settlement_id uuid,p_actor_id uuid,p_input jsonb
) returns jsonb language plpgsql set search_path=public as $$
declare
  v_set public.partner_settlements%rowtype;
  v_disputed numeric; v_paid numeric; v_available numeric; v_total numeric;
  x jsonb; v_tx uuid; v_pay uuid; v_batch uuid; v_fp text:=md5(p_input::text);
  v_paid_at timestamptz:=coalesce((p_input->>'paid_at')::timestamptz,public.hotel_operational_now(p_hotel_id));
begin
  select * into v_set from public.partner_settlements where id=p_settlement_id and hotel_id=p_hotel_id for update;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if v_set.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict'); end if;
  if v_set.status not in('approved','settled') then return jsonb_build_object('result','invalid_status'); end if;
  if v_paid_at>public.hotel_operational_now(p_hotel_id) then return jsonb_build_object('result','paid_at_in_future'); end if;
  select coalesce(sum(disputed_amount),0) into v_disputed from public.partner_settlement_disputes where settlement_id=p_settlement_id and status in('open','accepted');
  select coalesce(sum(case when reversal_of_id is null then amount else -amount end),0) into v_paid from public.partner_settlement_payments where settlement_id=p_settlement_id;
  select sum((tender->>'amount')::numeric) into v_total from jsonb_array_elements(p_input->'tenders') tender;
  v_available:=greatest(0,abs(v_set.net_settlement)-v_disputed-v_paid);
  if v_total<=0 or v_total>v_available then return jsonb_build_object('result','invalid_amount','context',jsonb_build_object('available',v_available)); end if;
  if exists(select 1 from jsonb_array_elements(p_input->'tenders') tender where tender->>'payment_method'='cash') and nullif(p_input->>'cash_session_id','') is null then return jsonb_build_object('result','cash_session_required'); end if;
  select id into v_batch from public.partner_settlement_payment_batches where hotel_id=p_hotel_id and idempotency_key=(p_input->>'idempotency_key')::uuid and request_fingerprint=v_fp;
  if found then return jsonb_build_object('result','ok','id',v_batch); end if;
  if exists(select 1 from public.partner_settlement_payment_batches where hotel_id=p_hotel_id and idempotency_key=(p_input->>'idempotency_key')::uuid) then return jsonb_build_object('result','idempotency_conflict'); end if;
  insert into public.partner_settlement_payment_batches(hotel_id,settlement_id,idempotency_key,request_fingerprint,total_amount,created_by)
  values(p_hotel_id,p_settlement_id,(p_input->>'idempotency_key')::uuid,v_fp,v_total,p_actor_id) returning id into v_batch;
  for x in select value from jsonb_array_elements(p_input->'tenders') loop
    insert into public.financial_transactions(hotel_id,type,category,amount,currency,description,status,payment_method,paid_at,due_date,counterparty,reference_code,created_by,partner_settlement_id,cash_session_id)
    values(p_hotel_id,case when v_set.direction='hotel_to_partner' then 'EXPENSE'::public.transaction_type else 'INCOME'::public.transaction_type end,'PARTNER_SETTLEMENT',(x->>'amount')::numeric,v_set.currency,'Liquidação parcial de parceiro','COMPLETED',x->>'payment_method',v_paid_at,v_set.due_on,(select trade_name from public.commercial_partners where id=v_set.partner_id),x->>'reference_code',p_actor_id,p_settlement_id,(p_input->>'cash_session_id')::uuid) returning id into v_tx;
    insert into public.partner_settlement_payments(hotel_id,settlement_id,payment_batch_id,financial_transaction_id,amount,direction,payment_method,paid_at,reference_code,notes,idempotency_key,request_fingerprint,created_by,cash_session_id)
    values(p_hotel_id,p_settlement_id,v_batch,v_tx,(x->>'amount')::numeric,v_set.direction,x->>'payment_method',v_paid_at,x->>'reference_code',p_input->>'notes',gen_random_uuid(),v_fp,p_actor_id,(p_input->>'cash_session_id')::uuid) returning id into v_pay;
  end loop;
  update public.partner_settlements set
    payment_state=case when v_paid+v_total>=abs(net_settlement)-v_disputed then 'settled' else 'partially_settled' end,
    status=case when v_paid+v_total>=abs(net_settlement)-v_disputed then 'settled'::public.partner_settlement_status else 'approved' end,
    settled_by=case when v_paid+v_total>=abs(net_settlement)-v_disputed then p_actor_id end,
    settled_at=case when v_paid+v_total>=abs(net_settlement)-v_disputed then v_paid_at end,
    version=version+1,updated_at=now()
  where id=p_settlement_id;
  insert into public.partner_settlement_events(hotel_id,settlement_id,action,actor_id,details)
  values(p_hotel_id,p_settlement_id,'partial_payment',p_actor_id,jsonb_build_object('amount',v_total,'remaining',v_available-v_total));
  return jsonb_build_object('result','ok','id',v_batch);
end;
$$;

create or replace function public.get_management_alerts(p_hotel_id uuid)
returns jsonb language plpgsql stable set search_path=public as $$
declare
  v_hotel record; v_settings public.consumption_management_settings%rowtype;
  v_guest jsonb; v_stock jsonb; v_agreements jsonb; v_settlements jsonb;
  v_operational_date date:=public.hotel_operational_date(p_hotel_id);
begin
  select id,timezone into v_hotel from public.hotels where id=p_hotel_id and is_active;
  if not found then return jsonb_build_object('result','hotel_not_found'); end if;
  select * into v_settings from public.consumption_management_settings where hotel_id=p_hotel_id;
  with balances as (
    select stay.id,reservation.reservation_code,room.room_number,customer.full_name guest_name,stay.checkout_date_expected,
      greatest(coalesce(sum(case when entry.direction='debit' then entry.amount else -entry.amount end),0),0) balance,
      hotel.currency
    from public.stays stay join public.reservations reservation on reservation.id=stay.reservation_id and reservation.hotel_id=p_hotel_id
    join public.rooms room on room.id=stay.room_id join public.customers customer on customer.id=reservation.booking_customer_id
    left join public.stay_folio_entries entry on entry.stay_id=stay.id and entry.hotel_id=p_hotel_id
    join public.hotels hotel on hotel.id=p_hotel_id where stay.stay_status='checked_in'
    group by stay.id,reservation.reservation_code,room.room_number,customer.full_name,stay.checkout_date_expected,hotel.currency
  ) select coalesce(jsonb_agg(jsonb_build_object('id','guest-balance-'||id,'kind','guest_balance','severity',case when (checkout_date_expected at time zone v_hotel.timezone)::date<v_operational_date then 'critical' else 'warning' end,
    'title','Saldo pendente no quarto '||room_number,'description',reservation_code||' · '||currency||' '||to_char(balance,'FM999999990.00'),
    'href','/dashboard/reservations/account?stay_id='||id,'entity_id',id,'amount',balance,'guest_name',guest_name) order by checkout_date_expected),'[]'::jsonb)
  into v_guest from balances where balance>0 and (checkout_date_expected at time zone v_hotel.timezone)::date<=v_operational_date+v_settings.guest_balance_alert_days;
  select coalesce(jsonb_agg(jsonb_build_object('id','stock-'||position.id,'kind','critical_stock','severity',case when position.quantity<0 then 'critical' else 'warning' end,
    'title','Estoque baixo: '||product.name,'description',location.name||' · saldo '||position.quantity||' · mínimo '||position.minimum_quantity,
    'href','/dashboard/inventory/overview?product_id='||position.product_id||'&location_id='||position.location_id,'entity_id',position.id,'quantity',position.quantity) order by position.quantity),'[]'::jsonb)
  into v_stock from public.inventory_positions position join public.products product on product.id=position.product_id
  join public.inventory_locations location on location.id=position.location_id
  where position.hotel_id=p_hotel_id and position.is_active and position.archived_at is null and position.quantity<position.minimum_quantity;
  select coalesce(jsonb_agg(jsonb_build_object('id','agreement-'||revision.id,'kind','agreement_expiry','severity','warning','title','Acordo vencendo: '||partner.trade_name,
    'description',agreement.internal_number||' · término '||to_char(revision.ends_on,'DD/MM/YYYY'),'href','/dashboard/consumption/agreements?history='||agreement.id,
    'entity_id',revision.id,'due_on',revision.ends_on) order by revision.ends_on),'[]'::jsonb)
  into v_agreements from public.commercial_agreement_revisions revision join public.commercial_agreements agreement on agreement.id=revision.agreement_id
  join public.commercial_partners partner on partner.id=agreement.partner_id
  where revision.hotel_id=p_hotel_id and revision.status='activated' and revision.ends_on between v_operational_date
    and v_operational_date+v_settings.agreement_expiry_alert_days;
  with closed_months as (
    select partner.id partner_id,partner.trade_name,month_start::date period_start,(month_start+interval '1 month - 1 day')::date period_end
    from public.commercial_partners partner
    cross join lateral generate_series(v_settings.settlement_tracking_starts_on::timestamp,date_trunc('month',v_operational_date)-interval '1 month',interval '1 month') month_start
    where partner.hotel_id=p_hotel_id and exists (
      select 1 from public.commercial_agreements agreement join public.commercial_agreement_revisions revision on revision.agreement_id=agreement.id
      where agreement.partner_id=partner.id and revision.status in ('activated','terminated') and revision.starts_on<=(month_start+interval '1 month - 1 day')::date and coalesce(revision.ends_on,'infinity'::date)>=month_start::date
    )
  ), missing as (
    select month.*,null::uuid settlement_id,null::date due_on,'missing' state from closed_months month
    where not exists(select 1 from public.partner_settlements settlement where settlement.hotel_id=p_hotel_id and settlement.partner_id=month.partner_id and settlement.period_start=month.period_start and settlement.status in ('approved','settled'))
    union all
    select settlement.partner_id,partner.trade_name,settlement.period_start,settlement.period_end,settlement.id,settlement.due_on,'unpaid'
    from public.partner_settlements settlement join public.commercial_partners partner on partner.id=settlement.partner_id
    where settlement.hotel_id=p_hotel_id and settlement.status='approved'
  ) select coalesce(jsonb_agg(jsonb_build_object('id','settlement-'||coalesce(settlement_id::text,partner_id::text||'-'||period_start::text),'kind','pending_settlement',
    'severity',case when state='unpaid' and due_on<v_operational_date then 'critical' else 'warning' end,
    'title',case when state='missing' then 'Apuração pendente: ' else 'Pagamento pendente: ' end||trade_name,
    'description',to_char(period_start,'MM/YYYY'),'href',case when settlement_id is null then '/dashboard/consumption/settlements?partner_id='||partner_id||'&period='||to_char(period_start,'YYYY-MM') else '/dashboard/consumption/settlements?id='||settlement_id end,
    'entity_id',coalesce(settlement_id,partner_id),'due_on',due_on) order by period_start),'[]'::jsonb) into v_settlements from missing;
  return jsonb_build_object('result','ok','guest_balances',v_guest,'critical_stock',v_stock,'expiring_agreements',v_agreements,'pending_settlements',v_settlements);
end;
$$;
