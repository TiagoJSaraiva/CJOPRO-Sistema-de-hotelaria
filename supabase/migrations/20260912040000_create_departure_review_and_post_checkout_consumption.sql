create type public.post_checkout_consumption_status as enum ('draft','submitted','approved','collection_pending','disputed','partially_paid','paid','waived','rejected','canceled');

alter table public.consumption_orders add column operational_origin text not null default 'quick_launch';
alter table public.consumption_orders add constraint consumption_orders_origin_check check(operational_origin in('quick_launch','service_order','governance_minibar','post_checkout'));

create table public.post_checkout_consumption_cases (
  id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,
  stay_id uuid not null references public.stays(id) on delete restrict,checkout_record_id uuid references public.stay_checkout_records(id) on delete restrict,
  governance_inspection_id uuid,status public.post_checkout_consumption_status not null default 'draft',occurred_at timestamptz not null,
  report text not null,version integer not null default 0,created_by uuid not null references public.users(id) on delete restrict,
  submitted_at timestamptz,decided_by uuid references public.users(id) on delete restrict,decided_at timestamptz,decision_reason text,
  consumption_order_id uuid,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  constraint post_checkout_case_id_hotel_unique unique(id,hotel_id),
  constraint post_checkout_case_order_hotel_fkey foreign key(consumption_order_id,hotel_id) references public.consumption_orders(id,hotel_id) on delete restrict,
  constraint post_checkout_case_report check(length(btrim(report)) between 3 and 2000),
  constraint post_checkout_case_segregation check(decided_by is null or decided_by<>created_by)
);
create table public.post_checkout_consumption_items (
  id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,case_id uuid not null,
  offer_id uuid,product_id uuid not null,category_id uuid not null,point_id uuid not null,quantity numeric(12,3) not null,unit_price numeric(12,2) not null,
  product_name_snapshot text not null,category_name_snapshot text not null,product_kind_snapshot public.product_kind not null,sales_unit_snapshot public.product_sales_unit not null,
  provider_type_snapshot public.product_provider_type not null,partner_id uuid,agreement_id uuid,revision_id uuid,billing_policy_snapshot jsonb not null,
  commercial_terms_snapshot jsonb,version_token text not null,inventory_controlled boolean not null default false,inventory_location_id uuid,
  constraint post_checkout_item_case_hotel_fkey foreign key(case_id,hotel_id) references public.post_checkout_consumption_cases(id,hotel_id) on delete restrict,
  constraint post_checkout_item_product_hotel_fkey foreign key(product_id,hotel_id) references public.products(id,hotel_id) on delete restrict,
  constraint post_checkout_item_category_hotel_fkey foreign key(category_id,hotel_id) references public.product_categories(id,hotel_id) on delete restrict,
  constraint post_checkout_item_point_hotel_fkey foreign key(point_id,hotel_id) references public.consumption_points(id,hotel_id) on delete restrict,
  constraint post_checkout_item_value check(quantity>0 and unit_price>=0)
);
create table public.post_checkout_consumption_evidence (
  id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,case_id uuid not null,
  private_path text not null,description text not null,uploaded_by uuid not null references public.users(id) on delete restrict,created_at timestamptz not null default now(),
  constraint post_checkout_evidence_case_hotel_fkey foreign key(case_id,hotel_id) references public.post_checkout_consumption_cases(id,hotel_id) on delete restrict,
  constraint post_checkout_evidence_text check(length(btrim(private_path)) between 1 and 500 and length(btrim(description)) between 3 and 1000)
);
create table public.post_checkout_supplemental_accounts (
  id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,case_id uuid not null unique,
  checkout_record_id uuid references public.stay_checkout_records(id) on delete restrict,amount numeric(12,2) not null,paid_amount numeric(12,2) not null default 0,
  currency text not null,version integer not null default 0,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  constraint post_checkout_supplemental_case_hotel_fkey foreign key(case_id,hotel_id) references public.post_checkout_consumption_cases(id,hotel_id) on delete restrict,
  constraint post_checkout_supplemental_amount check(amount>0 and paid_amount>=0 and paid_amount<=amount and currency~'^[A-Z]{3}$')
);
create table public.post_checkout_consumption_payments (
  id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,case_id uuid not null,
  amount numeric(12,2) not null,payment_method public.consumption_payment_method not null,reference_code text,
  idempotency_key uuid not null,request_fingerprint text not null,created_by uuid not null references public.users(id) on delete restrict,created_at timestamptz not null default now(),
  constraint post_checkout_payment_case_hotel_fkey foreign key(case_id,hotel_id) references public.post_checkout_consumption_cases(id,hotel_id) on delete restrict,
  constraint post_checkout_payment_amount check(amount>0),unique(hotel_id,idempotency_key)
);
create table public.post_checkout_consumption_events (
  id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,case_id uuid not null,
  action text not null,actor_id uuid references public.users(id) on delete restrict,details jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),
  constraint post_checkout_event_case_hotel_fkey foreign key(case_id,hotel_id) references public.post_checkout_consumption_cases(id,hotel_id) on delete restrict
);
create table public.stay_checkout_operational_snapshots (
  checkout_record_id uuid primary key references public.stay_checkout_records(id) on delete restrict,
  hotel_id uuid not null references public.hotels(id) on delete restrict,stay_id uuid not null references public.stays(id) on delete restrict,
  payer_accounts jsonb not null,benefit_grants jsonb not null,corporate_receivables jsonb not null,created_at timestamptz not null default now()
);

-- O fluxo financeiro já existente continua usando a conta consolidada. Até que
-- uma operação escolha outra subconta, seus pagamentos pertencem ao hóspede
-- principal, inclusive para estadias abertas antes desta migration.
insert into public.stay_payer_payment_batches(hotel_id,payer_account_id,payment_batch_id,amount)
select batch.hotel_id,payer.id,batch.id,batch.amount
from public.stay_payment_batches batch
join public.stay_payer_accounts payer on payer.stay_id=batch.stay_id and payer.kind='primary_guest'
on conflict(payment_batch_id) do nothing;

create function public.assign_payment_batch_to_primary_payer() returns trigger language plpgsql set search_path=public as $$
declare v_payer uuid;
begin
  select id into v_payer from public.stay_payer_accounts where stay_id=new.stay_id and kind='primary_guest';
  if v_payer is not null then
    insert into public.stay_payer_payment_batches(hotel_id,payer_account_id,payment_batch_id,amount)
    values(new.hotel_id,v_payer,new.id,new.amount) on conflict(payment_batch_id) do nothing;
  end if;
  return new;
end $$;
create trigger trg_payment_batch_primary_payer after insert on public.stay_payment_batches
for each row execute function public.assign_payment_batch_to_primary_payer();

create or replace function public.allocate_new_folio_to_primary_payer() returns trigger language plpgsql set search_path=public as $$
declare v_payer uuid;v_quantity numeric;
begin
  if new.direction='debit' then
    select id into v_payer from public.stay_payer_accounts where stay_id=new.stay_id and kind='primary_guest';
    if new.consumption_order_id is not null then
      select sum(quantity) into v_quantity from public.consumption_order_items where order_id=new.consumption_order_id;
    end if;
    if v_payer is not null then
      insert into public.stay_payer_allocations(hotel_id,stay_id,folio_entry_id,payer_account_id,amount,quantity,allocated_by)
      values(new.hotel_id,new.stay_id,new.id,v_payer,new.amount,v_quantity,new.posted_by) on conflict(folio_entry_id,payer_account_id) do nothing;
    end if;
  end if;
  return new;
end $$;

create function public.allocate_existing_folio_to_new_primary_payer() returns trigger language plpgsql set search_path=public as $$
begin
  if new.kind='primary_guest' then
    insert into public.stay_payer_allocations(hotel_id,stay_id,folio_entry_id,payer_account_id,amount,quantity,allocated_by)
    select entry.hotel_id,entry.stay_id,entry.id,new.id,entry.amount,
      case when entry.consumption_order_id is null then null else (select sum(item.quantity) from public.consumption_order_items item where item.order_id=entry.consumption_order_id) end,
      entry.posted_by
    from public.stay_folio_entries entry
    where entry.stay_id=new.stay_id and entry.direction='debit'
    on conflict(folio_entry_id,payer_account_id) do nothing;
  end if;
  return new;
end $$;
create trigger trg_primary_payer_existing_folio after insert on public.stay_payer_accounts
for each row execute function public.allocate_existing_folio_to_new_primary_payer();

update public.stay_payer_allocations allocation set quantity=(
  select sum(item.quantity) from public.stay_folio_entries entry
  join public.consumption_order_items item on item.order_id=entry.consumption_order_id
  where entry.id=allocation.folio_entry_id
)
where allocation.quantity is null and exists(
  select 1 from public.stay_folio_entries entry where entry.id=allocation.folio_entry_id and entry.consumption_order_id is not null
);

create or replace function public.create_stay_payer_payment(p_hotel_id uuid,p_stay_id uuid,p_actor_id uuid,p_payer_id uuid,p_expected_version bigint,p_tenders jsonb,p_idempotency_key uuid,p_note text)
returns jsonb language plpgsql set search_path=public as $$
declare v_balance numeric;v_total numeric;v_result jsonb;v_existing uuid;
begin
  select payment_batch_id into v_existing from public.stay_payer_payment_batches payment join public.stay_payment_batches batch on batch.id=payment.payment_batch_id
    where batch.hotel_id=p_hotel_id and batch.idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('result','ok','payment_batch_id',v_existing,'created',false); end if;
  select coalesce(sum(allocation.amount),0)-coalesce((select sum(amount) from public.stay_payer_payment_batches where payer_account_id=p_payer_id),0)
    into v_balance from public.stay_payer_allocations allocation where allocation.payer_account_id=p_payer_id;
  select coalesce(sum((x->>'amount')::numeric),0) into v_total from jsonb_array_elements(p_tenders) x;
  if not exists(select 1 from public.stay_payer_accounts where id=p_payer_id and hotel_id=p_hotel_id and stay_id=p_stay_id) then return jsonb_build_object('result','payer_not_found'); end if;
  if v_total<=0 or v_total>v_balance then return jsonb_build_object('result','payment_exceeds_payer_balance','balance',v_balance); end if;
  v_result:=public.create_stay_payment_batch(p_hotel_id,p_stay_id,p_actor_id,p_tenders,p_idempotency_key,p_expected_version,'regular',p_note);
  if v_result->>'result'<>'ok' then return v_result; end if;
  delete from public.stay_payer_payment_batches where payment_batch_id=(v_result->>'batch_id')::uuid;
  insert into public.stay_payer_payment_batches(hotel_id,payer_account_id,payment_batch_id,amount)
    values(p_hotel_id,p_payer_id,(v_result->>'batch_id')::uuid,v_total);
  return v_result;
end $$;

create function public.get_stay_departure_review(p_hotel_id uuid,p_stay_id uuid)
returns jsonb language plpgsql stable set search_path=public as $$
declare v_stay public.stays%rowtype;v_blockers jsonb:='[]'::jsonb;v_payers jsonb;v record;
begin
  select stay.* into v_stay from public.stays stay join public.reservations reservation on reservation.id=stay.reservation_id where stay.id=p_stay_id and reservation.hotel_id=p_hotel_id;
  if not found then return null;end if;
  for v in select id,status,responsible_id,updated_at from public.consumption_service_orders where stay_id=p_stay_id and status in('received','preparing','ready') loop
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('type','open_order','label','Pedido '||v.status::text||' aguardando entrega ou cancelamento','responsible_id',v.responsible_id,'updated_at',v.updated_at,'action','Abrir pedidos'));
  end loop;
  if exists(select 1 from public.consumption_corrections where stay_id=p_stay_id and status in('pending','approved','awaiting_refund','awaiting_partner_refund')) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('type','open_correction','label','Correção ou reembolso ainda aberto','responsible_id',null,'updated_at',now(),'action','Revisar ajustes'));
  end if;
  for v in select entry.id,entry.description,entry.amount,coalesce(sum(allocation.amount),0) allocated,entry.posted_at from public.stay_folio_entries entry left join public.stay_payer_allocations allocation on allocation.folio_entry_id=entry.id where entry.stay_id=p_stay_id and entry.direction='debit' group by entry.id having coalesce(sum(allocation.amount),0)<>entry.amount loop
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('type','payer_allocation','label','Lançamento sem distribuição integral: '||v.description,'responsible_id',null,'updated_at',v.posted_at,'action','Distribuir pagadores'));
  end loop;
  select public.list_stay_payer_accounts(p_hotel_id,p_stay_id) into v_payers;
  for v in select * from jsonb_to_recordset(coalesce(v_payers->'items','[]'::jsonb)) x(id uuid,kind text,display_name text,balance numeric) where balance>0 loop
    if v.kind<>'company' then v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('type','payer_balance','label','Saldo pessoal em aberto: '||v.display_name,'responsible_id',null,'updated_at',now(),'action','Receber pagamento'));
    elsif not exists(select 1 from public.stay_payer_accounts payer join public.corporate_credit_authorizations auth on auth.stay_id=payer.stay_id and auth.corporate_account_id=payer.corporate_account_id where payer.id=v.id and auth.status='approved' and auth.expires_at>now() and auth.amount_limit-auth.reserved_amount-auth.consumed_amount>=v.balance)
      then v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('type','corporate_credit','label','Crédito empresarial vencido, insuficiente ou não aprovado: '||v.display_name,'responsible_id',null,'updated_at',now(),'action','Revisar autorização'));end if;
  end loop;
  if exists(select 1 from public.governance_minibar_findings finding join public.governance_cycles cycle on cycle.id=finding.cycle_id where cycle.stay_id=p_stay_id and finding.discrepancy_only and finding.consumption_order_id is null) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('type','minibar_discrepancy','label','Divergência de frigobar sem tratamento financeiro','responsible_id',null,'updated_at',now(),'action','Abrir governança'));
  end if;
  return jsonb_build_object('stay_id',p_stay_id,'ready',jsonb_array_length(v_blockers)=0,'blockers',v_blockers,'payer_balances',coalesce(v_payers->'items','[]'::jsonb),'account_version',v_stay.account_version,'updated_at',now());
end $$;

create function public.checkout_stay_account_stage4(
  p_hotel_id uuid,p_stay_id uuid,p_actor_id uuid,p_expected_version bigint,p_tenders jsonb,p_idempotency_key uuid,
  p_occurrence_ids uuid[] default array[]::uuid[],p_maintenance_folio_entry_ids uuid[] default array[]::uuid[],p_note text default null
) returns jsonb language plpgsql set search_path=public as $$
declare v_review jsonb;v_payer record;v_auth public.corporate_credit_authorizations%rowtype;v_receivable uuid;v_credit uuid;v_entry record;v_remaining numeric;v_apply numeric;v_result jsonb;v_current bigint;v_checkout uuid;
begin
  if exists(select 1 from public.stay_checkout_records where hotel_id=p_hotel_id and idempotency_key=p_idempotency_key) then
    return jsonb_build_object('result','ok','checkout_record_id',(select id from public.stay_checkout_records where hotel_id=p_hotel_id and idempotency_key=p_idempotency_key),'created',false);end if;
  v_review:=public.get_stay_departure_review(p_hotel_id,p_stay_id);
  if v_review is null then return jsonb_build_object('result','not_found');end if;
  if (v_review->>'account_version')::bigint<>p_expected_version then return jsonb_build_object('result','version_conflict','context',v_review);end if;
  if exists(select 1 from jsonb_array_elements(v_review->'blockers') blocker where blocker->>'type' not in('corporate_credit')) then return jsonb_build_object('result','departure_blocked','context',v_review);end if;
  begin
    for v_payer in select payer.*,balances.balance from public.stay_payer_accounts payer join lateral(
      select greatest(coalesce(sum(allocation.amount),0)-coalesce((select sum(amount) from public.stay_payer_payment_batches where payer_account_id=payer.id),0)-coalesce((select sum(amount) from public.stay_payer_credits where payer_account_id=payer.id),0),0) balance
      from public.stay_payer_allocations allocation where allocation.payer_account_id=payer.id) balances on true
      where payer.stay_id=p_stay_id and payer.kind='company' and balances.balance>0
    loop
      select * into v_auth from public.corporate_credit_authorizations where stay_id=p_stay_id and corporate_account_id=v_payer.corporate_account_id and status='approved' and expires_at>now() and amount_limit-reserved_amount-consumed_amount>=v_payer.balance for update;
      if not found then raise exception 'corporate_credit_invalid' using errcode='P0001';end if;
      insert into public.corporate_receivables(hotel_id,corporate_account_id,authorization_id,stay_id,amount,currency,due_on)
        select p_hotel_id,v_payer.corporate_account_id,v_auth.id,p_stay_id,v_payer.balance,hotel.currency,(now() at time zone hotel.timezone)::date+account.payment_term_days
        from public.hotels hotel join public.corporate_accounts account on account.id=v_payer.corporate_account_id where hotel.id=p_hotel_id returning id into v_receivable;
      insert into public.stay_folio_entries(hotel_id,stay_id,reservation_id,direction,kind,amount,currency,description,source_key,posted_by,posted_at)
        select p_hotel_id,p_stay_id,stay.reservation_id,'credit','payment',v_payer.balance,hotel.currency,'Crédito de faturamento empresarial','corporate-receivable:'||v_receivable,p_actor_id,now()
        from public.stays stay join public.reservations reservation on reservation.id=stay.reservation_id join public.hotels hotel on hotel.id=reservation.hotel_id where stay.id=p_stay_id returning id into v_credit;
      v_remaining:=v_payer.balance;
      for v_entry in select allocation.folio_entry_id,allocation.amount-coalesce((select sum(folio.amount) from public.stay_folio_allocations folio where folio.debit_entry_id=allocation.folio_entry_id),0) open_amount from public.stay_payer_allocations allocation where allocation.payer_account_id=v_payer.id order by allocation.created_at loop
        v_apply:=least(v_remaining,greatest(v_entry.open_amount,0));if v_apply>0 then insert into public.stay_folio_allocations(hotel_id,stay_id,credit_entry_id,debit_entry_id,amount,created_by) values(p_hotel_id,p_stay_id,v_credit,v_entry.folio_entry_id,v_apply,p_actor_id);v_remaining:=v_remaining-v_apply;end if;exit when v_remaining<=0;
      end loop;
      insert into public.stay_payer_credits(hotel_id,stay_id,payer_account_id,folio_credit_entry_id,amount,reason) values(p_hotel_id,p_stay_id,v_payer.id,v_credit,v_payer.balance,'Faturamento empresarial');
      update public.corporate_credit_authorizations set consumed_amount=consumed_amount+v_payer.balance,version=version+1,updated_at=now() where id=v_auth.id;
    end loop;
    select account_version into v_current from public.stays where id=p_stay_id;
    v_result:=public.checkout_stay_account(p_hotel_id,p_stay_id,p_actor_id,v_current,p_tenders,p_idempotency_key,p_occurrence_ids,p_maintenance_folio_entry_ids,p_note);
    if v_result->>'result'<>'ok' then raise exception '%',v_result::text using errcode='P0001';end if;
    v_checkout:=(v_result->>'checkout_record_id')::uuid;
    update public.corporate_receivables set checkout_record_id=v_checkout where stay_id=p_stay_id and checkout_record_id is null;
    update public.stay_benefit_grants set status='expired',expired_at=now() where stay_id=p_stay_id and status='active';
    insert into public.consumption_benefit_events(hotel_id,entity_type,entity_id,action,actor_id,details)
      select p_hotel_id,'grant',id,'expired_at_checkout',p_actor_id,jsonb_build_object('unused_benefit_refunded',false) from public.stay_benefit_grants where stay_id=p_stay_id and expired_at is not null;
    insert into public.stay_checkout_operational_snapshots(checkout_record_id,hotel_id,stay_id,payer_accounts,benefit_grants,corporate_receivables)
      values(v_checkout,p_hotel_id,p_stay_id,v_review->'payer_balances',(select coalesce(jsonb_agg(to_jsonb(benefit_grant)),'[]'::jsonb) from public.stay_benefit_grants benefit_grant where stay_id=p_stay_id),(select coalesce(jsonb_agg(to_jsonb(receivable)),'[]'::jsonb) from public.corporate_receivables receivable where stay_id=p_stay_id));
    return v_result;
  exception when sqlstate 'P0001' then
    begin return sqlerrm::jsonb;exception when others then return jsonb_build_object('result',sqlerrm);end;
  end;
end $$;

create or replace function public.block_invalid_stay_checkout() returns trigger language plpgsql set search_path=public as $$
begin
  if new.stay_status='checked_out' and old.stay_status<>'checked_out' then
    if exists(select 1 from public.consumption_service_orders where stay_id=new.id and status in('received','preparing','ready')) then raise exception 'open service order blocks checkout' using errcode='23514';end if;
    if exists(select 1 from public.stay_folio_entries entry left join public.stay_payer_allocations allocation on allocation.folio_entry_id=entry.id where entry.stay_id=new.id and entry.direction='debit' group by entry.id having sum(allocation.amount) is distinct from entry.amount) then raise exception 'incomplete payer allocation blocks checkout' using errcode='23514';end if;
    if exists(select 1 from public.stay_folio_entries entry left join lateral(select sum(amount) amount from public.stay_folio_allocations where debit_entry_id=entry.id) allocated on true where entry.stay_id=new.id and entry.direction='debit' and entry.amount>coalesce(allocated.amount,0) and(entry.kind<>'maintenance_charge' or not exists(select 1 from public.maintenance_financial_checkout_acknowledgements acknowledgement where acknowledgement.stay_id=new.id and acknowledgement.folio_entry_id=entry.id)))
      or exists(select 1 from public.stay_folio_entries entry left join lateral(select sum(amount) amount from public.stay_folio_allocations where credit_entry_id=entry.id) allocated on true where entry.stay_id=new.id and entry.direction='credit' and entry.amount>coalesce(allocated.amount,0))
      or exists(select 1 from public.consumption_corrections correction where correction.stay_id=new.id and correction.status in('pending','approved','awaiting_refund','awaiting_partner_refund')) then raise exception 'open stay account blocks checkout' using errcode='23514';end if;
  end if;return new;
end $$;

create function public.create_post_checkout_consumption_case(p_hotel_id uuid,p_actor_id uuid,p_input jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare v_stay record;v_checkout uuid;v_case uuid:=gen_random_uuid();v_item jsonb;v_snapshot jsonb;
begin
  select stay.*,reservation.hotel_id into v_stay from public.stays stay join public.reservations reservation on reservation.id=stay.reservation_id where stay.id=(p_input->>'stay_id')::uuid and reservation.hotel_id=p_hotel_id;
  if not found or v_stay.stay_status<>'checked_out' then return jsonb_build_object('result','stay_not_checked_out');end if;
  if (p_input->>'occurred_at')::timestamptz<v_stay.checkin_date_actual or (p_input->>'occurred_at')::timestamptz>v_stay.checkout_date_actual then return jsonb_build_object('result','occurred_outside_stay');end if;
  select id into v_checkout from public.stay_checkout_records where stay_id=v_stay.id order by checked_out_at desc limit 1;
  insert into public.post_checkout_consumption_cases(id,hotel_id,stay_id,checkout_record_id,governance_inspection_id,occurred_at,report,created_by)
    values(v_case,p_hotel_id,v_stay.id,v_checkout,nullif(p_input->>'governance_inspection_id','')::uuid,(p_input->>'occurred_at')::timestamptz,btrim(p_input->>'report'),p_actor_id);
  for v_item in select value from jsonb_array_elements(p_input->'items') loop
    v_snapshot:=public.resolve_consumption_offer_snapshot(p_hotel_id,(v_item->>'offer_id')::uuid,now());if not coalesce((v_snapshot->>'found')::boolean,false) then raise exception 'offer_not_found' using errcode='P0001';end if;
    insert into public.post_checkout_consumption_items(hotel_id,case_id,offer_id,product_id,category_id,point_id,quantity,unit_price,product_name_snapshot,category_name_snapshot,product_kind_snapshot,sales_unit_snapshot,provider_type_snapshot,partner_id,agreement_id,revision_id,billing_policy_snapshot,commercial_terms_snapshot,version_token,inventory_controlled,inventory_location_id)
    values(p_hotel_id,v_case,(v_item->>'offer_id')::uuid,(v_snapshot->>'product_id')::uuid,(v_snapshot->>'category_id')::uuid,(v_snapshot->>'point_id')::uuid,(v_item->>'quantity')::numeric,(v_snapshot->>'unit_price')::numeric,v_snapshot->>'product_name',v_snapshot->>'category_name',(v_snapshot->>'product_kind')::public.product_kind,(v_snapshot->>'sales_unit')::public.product_sales_unit,(v_snapshot->>'provider_type')::public.product_provider_type,nullif(v_snapshot->>'partner_id','')::uuid,nullif(v_snapshot->>'agreement_id','')::uuid,nullif(v_snapshot->'revision'->>'id','')::uuid,v_snapshot->'billing_policy',v_snapshot->'revision',v_snapshot->>'version_token',coalesce((v_snapshot->>'inventory_controlled')::boolean,false),nullif(v_snapshot->>'inventory_location_id','')::uuid);
  end loop;
  if (select count(distinct point_id) from public.post_checkout_consumption_items where case_id=v_case)>1 then raise exception 'different_points' using errcode='P0001';end if;
  insert into public.post_checkout_consumption_events(hotel_id,case_id,action,actor_id,details) values(p_hotel_id,v_case,'created',p_actor_id,jsonb_build_object('original_checkout_unchanged',true));
  return jsonb_build_object('result','ok','case_id',v_case);
exception when sqlstate 'P0001' then return jsonb_build_object('result',sqlerrm);end $$;

create function public.act_post_checkout_consumption_case(p_hotel_id uuid,p_case_id uuid,p_actor_id uuid,p_action text,p_expected_version integer,p_reason text,p_result text,p_promised_at timestamptz)
returns jsonb language plpgsql set search_path=public as $$
declare v_case public.post_checkout_consumption_cases%rowtype;v_status public.post_checkout_consumption_status;v_order uuid:=gen_random_uuid();v_amount numeric;v_stay record;v_item record;
begin
  select * into v_case from public.post_checkout_consumption_cases where id=p_case_id and hotel_id=p_hotel_id for update;if not found then return jsonb_build_object('result','not_found');end if;
  if v_case.version<>p_expected_version then return jsonb_build_object('result','version_conflict');end if;
  if length(coalesce(btrim(p_reason),''))<3 then return jsonb_build_object('result','invalid');end if;
  v_status:=case when p_action='submit' and v_case.status='draft' then 'submitted' when p_action='approve' and v_case.status='submitted' then 'collection_pending' when p_action='reject' and v_case.status='submitted' then 'rejected' when p_action='record_contact' and v_case.status in('collection_pending','partially_paid') then v_case.status when p_action='dispute' and v_case.status in('collection_pending','partially_paid') then 'disputed' when p_action='resume_collection' and v_case.status='disputed' then 'collection_pending' when p_action='waive' and v_case.status='disputed' then 'waived' when p_action='cancel' and v_case.status in('draft','submitted') then 'canceled' else null end;
  if v_status is null then return jsonb_build_object('result','invalid_state');end if;
  if p_action in('approve','reject','waive') and v_case.created_by=p_actor_id then return jsonb_build_object('result','segregation_required');end if;
  if p_action='approve' then
    if v_case.governance_inspection_id is null and not exists(select 1 from public.post_checkout_consumption_evidence where case_id=p_case_id) then return jsonb_build_object('result','evidence_required');end if;
    select stay.reservation_id,reservation.reservation_code,room.room_number,customer.full_name,hotel.currency into v_stay from public.stays stay join public.reservations reservation on reservation.id=stay.reservation_id join public.rooms room on room.id=stay.room_id join public.customers customer on customer.id=reservation.booking_customer_id join public.hotels hotel on hotel.id=reservation.hotel_id where stay.id=v_case.stay_id;
    select sum(quantity*unit_price) into v_amount from public.post_checkout_consumption_items where case_id=p_case_id;
    insert into public.consumption_orders(id,hotel_id,stay_id,reservation_id,point_id,disposition,billing_mode,currency,gross_amount,net_amount,reservation_code_snapshot,room_number_snapshot,guest_name_snapshot,point_name_snapshot,notes,occurred_at,posted_by,idempotency_key,request_fingerprint,operational_origin)
      select v_order,p_hotel_id,v_case.stay_id,v_stay.reservation_id,(array_agg(point_id order by point_id))[1],'charged','stay_folio',v_stay.currency,v_amount,v_amount,v_stay.reservation_code,v_stay.room_number,v_stay.full_name,'Consumo pós-saída','Conta complementar '||p_case_id,v_case.occurred_at,p_actor_id,gen_random_uuid(),md5(p_case_id::text),'post_checkout' from public.post_checkout_consumption_items where case_id=p_case_id;
    for v_item in select * from public.post_checkout_consumption_items where case_id=p_case_id loop
      insert into public.consumption_order_items(hotel_id,order_id,offer_id,product_id,category_id,commercial_partner_id,commercial_agreement_id,commercial_revision_id,quantity,charged_unit_price,product_name_snapshot,product_kind_snapshot,sales_unit_snapshot,category_name_snapshot,provider_type_snapshot,partner_name_snapshot,agreement_number_snapshot,commercial_terms_snapshot,billing_policy_snapshot,version_token,inventory_controlled_snapshot,inventory_location_id_snapshot)
      values(p_hotel_id,v_order,v_item.offer_id,v_item.product_id,v_item.category_id,v_item.partner_id,v_item.agreement_id,v_item.revision_id,v_item.quantity,v_item.unit_price,v_item.product_name_snapshot,v_item.product_kind_snapshot,v_item.sales_unit_snapshot,v_item.category_name_snapshot,v_item.provider_type_snapshot,(select legal_name from public.commercial_partners where id=v_item.partner_id),(select internal_number from public.commercial_agreements where id=v_item.agreement_id),v_item.commercial_terms_snapshot,v_item.billing_policy_snapshot,v_item.version_token,v_item.inventory_controlled,v_item.inventory_location_id);
    end loop;
    insert into public.consumption_order_events(hotel_id,order_id,action,actor_id,details) values(p_hotel_id,v_order,'post_checkout_approved',p_actor_id,jsonb_build_object('case_id',p_case_id));
    insert into public.post_checkout_supplemental_accounts(hotel_id,case_id,checkout_record_id,amount,currency) values(p_hotel_id,p_case_id,v_case.checkout_record_id,v_amount,v_stay.currency);
  end if;
  update public.post_checkout_consumption_cases set status=v_status,version=version+1,updated_at=now(),consumption_order_id=case when p_action='approve' then v_order else consumption_order_id end,submitted_at=case when p_action='submit' then now() else submitted_at end,decided_by=case when p_action in('approve','reject','waive') then p_actor_id else decided_by end,decided_at=case when p_action in('approve','reject','waive') then now() else decided_at end,decision_reason=case when p_action in('approve','reject','waive') then btrim(p_reason) else decision_reason end where id=p_case_id;
  insert into public.post_checkout_consumption_events(hotel_id,case_id,action,actor_id,details) values(p_hotel_id,p_case_id,p_action,p_actor_id,jsonb_strip_nulls(jsonb_build_object('reason',btrim(p_reason),'result',nullif(btrim(p_result),''),'promised_at',p_promised_at)));
  return jsonb_build_object('result','ok','status',v_status,'version',v_case.version+1);
end $$;

create function public.pay_post_checkout_consumption_case(p_hotel_id uuid,p_case_id uuid,p_actor_id uuid,p_expected_version integer,p_tenders jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql set search_path=public as $$
declare v_case public.post_checkout_consumption_cases%rowtype;v_account public.post_checkout_supplemental_accounts%rowtype;v_tender jsonb;v_total numeric:=0;v_fingerprint text;v_existing record;
begin
  v_fingerprint:=md5(jsonb_build_object('case',p_case_id,'tenders',p_tenders)::text);select id,request_fingerprint into v_existing from public.post_checkout_consumption_payments where hotel_id=p_hotel_id and idempotency_key=p_idempotency_key;if found then return case when v_existing.request_fingerprint=v_fingerprint then jsonb_build_object('result','ok','created',false) else jsonb_build_object('result','idempotency_conflict') end;end if;
  select * into v_case from public.post_checkout_consumption_cases where id=p_case_id and hotel_id=p_hotel_id for update;if not found then return jsonb_build_object('result','not_found');end if;if v_case.version<>p_expected_version then return jsonb_build_object('result','version_conflict');end if;
  select * into v_account from public.post_checkout_supplemental_accounts where case_id=p_case_id for update;if not found or v_case.status not in('collection_pending','partially_paid') then return jsonb_build_object('result','invalid_state');end if;
  for v_tender in select value from jsonb_array_elements(p_tenders) loop v_total:=v_total+(v_tender->>'amount')::numeric;end loop;if v_total<=0 or v_account.paid_amount+v_total>v_account.amount then return jsonb_build_object('result','payment_exceeds_balance');end if;
  for v_tender in select value from jsonb_array_elements(p_tenders) loop insert into public.post_checkout_consumption_payments(hotel_id,case_id,amount,payment_method,reference_code,idempotency_key,request_fingerprint,created_by) values(p_hotel_id,p_case_id,(v_tender->>'amount')::numeric,(v_tender->>'payment_method')::public.consumption_payment_method,nullif(btrim(v_tender->>'reference_code'),''),case when v_total=(v_tender->>'amount')::numeric then p_idempotency_key else md5(p_idempotency_key::text||v_tender::text)::uuid end,v_fingerprint,p_actor_id);end loop;
  update public.post_checkout_supplemental_accounts set paid_amount=paid_amount+v_total,version=version+1,updated_at=now() where id=v_account.id;
  update public.post_checkout_consumption_cases set status=case when v_account.paid_amount+v_total=v_account.amount then 'paid' else 'partially_paid' end,version=version+1,updated_at=now() where id=p_case_id;
  insert into public.post_checkout_consumption_events(hotel_id,case_id,action,actor_id,details) values(p_hotel_id,p_case_id,'payment_received',p_actor_id,jsonb_build_object('amount',v_total,'multi_tender',jsonb_array_length(p_tenders)>1));return jsonb_build_object('result','ok','created',true);
end $$;

create function public.list_post_checkout_consumption(p_hotel_id uuid,p_case_id uuid default null) returns jsonb language sql stable set search_path=public as $$
select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('supplemental_account',to_jsonb(a),'items',(select coalesce(jsonb_agg(to_jsonb(i)),'[]'::jsonb) from public.post_checkout_consumption_items i where i.case_id=c.id),'events',(select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at),'[]'::jsonb) from public.post_checkout_consumption_events e where e.case_id=c.id)) order by c.updated_at desc),'[]'::jsonb)) from public.post_checkout_consumption_cases c left join public.post_checkout_supplemental_accounts a on a.case_id=c.id where c.hotel_id=p_hotel_id and(p_case_id is null or c.id=p_case_id);$$;

create function public.add_post_checkout_consumption_evidence(p_hotel_id uuid,p_case_id uuid,p_actor_id uuid,p_private_path text,p_description text)
returns jsonb language plpgsql set search_path=public as $$
declare v_id uuid;
begin
  if not exists(select 1 from public.post_checkout_consumption_cases where id=p_case_id and hotel_id=p_hotel_id and status in('draft','submitted','disputed')) then return jsonb_build_object('result','invalid_state');end if;
  insert into public.post_checkout_consumption_evidence(hotel_id,case_id,private_path,description,uploaded_by) values(p_hotel_id,p_case_id,btrim(p_private_path),btrim(p_description),p_actor_id) returning id into v_id;
  insert into public.post_checkout_consumption_events(hotel_id,case_id,action,actor_id,details) values(p_hotel_id,p_case_id,'evidence_added',p_actor_id,jsonb_build_object('evidence_id',v_id));
  return jsonb_build_object('result','ok','evidence_id',v_id);
end $$;

create function public.pay_corporate_receivable(p_hotel_id uuid,p_receivable_id uuid,p_actor_id uuid,p_expected_version integer,p_tenders jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql set search_path=public as $$
declare v_receivable public.corporate_receivables%rowtype;v_tender jsonb;v_total numeric:=0;v_fingerprint text;v_existing record;v_index integer:=0;
begin
  v_fingerprint:=md5(jsonb_build_object('receivable',p_receivable_id,'tenders',p_tenders)::text);
  select id,request_fingerprint into v_existing from public.corporate_receivable_payments where hotel_id=p_hotel_id and idempotency_key=p_idempotency_key;
  if found then return case when v_existing.request_fingerprint=v_fingerprint then jsonb_build_object('result','ok','created',false) else jsonb_build_object('result','idempotency_conflict') end;end if;
  select * into v_receivable from public.corporate_receivables where id=p_receivable_id and hotel_id=p_hotel_id for update;
  if not found then return jsonb_build_object('result','not_found');end if;if v_receivable.version<>p_expected_version then return jsonb_build_object('result','version_conflict');end if;
  for v_tender in select value from jsonb_array_elements(p_tenders) loop v_total:=v_total+(v_tender->>'amount')::numeric;end loop;
  if v_total<=0 or v_receivable.paid_amount+v_total>v_receivable.amount then return jsonb_build_object('result','payment_exceeds_balance');end if;
  for v_tender in select value from jsonb_array_elements(p_tenders) loop
    insert into public.corporate_receivable_payments(hotel_id,receivable_id,amount,payment_method,reference_code,idempotency_key,request_fingerprint,created_by)
    values(p_hotel_id,p_receivable_id,(v_tender->>'amount')::numeric,(v_tender->>'payment_method')::public.consumption_payment_method,nullif(btrim(v_tender->>'reference_code'),''),case when v_index=0 then p_idempotency_key else md5(p_idempotency_key::text||v_index::text)::uuid end,v_fingerprint,p_actor_id);v_index:=v_index+1;
  end loop;
  update public.corporate_receivables set paid_amount=paid_amount+v_total,status=case when paid_amount+v_total=amount then 'paid' else 'partially_paid' end,version=version+1,updated_at=now() where id=p_receivable_id;
  insert into public.corporate_credit_events(hotel_id,entity_type,entity_id,action,actor_id,details) values(p_hotel_id,'receivable',p_receivable_id,'payment_received',p_actor_id,jsonb_build_object('amount',v_total,'multi_tender',jsonb_array_length(p_tenders)>1));
  return jsonb_build_object('result','ok','created',true);
end $$;

create function public.protect_post_checkout_history() returns trigger language plpgsql as $$ begin raise exception 'post checkout history is immutable' using errcode='23514';end $$;
create trigger trg_post_checkout_items_immutable before update or delete on public.post_checkout_consumption_items for each row execute function public.protect_post_checkout_history();
create trigger trg_post_checkout_evidence_immutable before update or delete on public.post_checkout_consumption_evidence for each row execute function public.protect_post_checkout_history();
create trigger trg_post_checkout_payments_immutable before update or delete on public.post_checkout_consumption_payments for each row execute function public.protect_post_checkout_history();
create trigger trg_post_checkout_events_immutable before update or delete on public.post_checkout_consumption_events for each row execute function public.protect_post_checkout_history();
create trigger trg_checkout_operational_snapshot_immutable before update or delete on public.stay_checkout_operational_snapshots for each row execute function public.protect_post_checkout_history();

create or replace function public.apply_consumption_benefits_from_event() returns trigger language plpgsql set search_path=public as $$
begin
  if new.action in('posted','courtesy_posted') and exists(select 1 from public.consumption_orders where id=new.order_id and operational_origin<>'post_checkout') then
    perform public.apply_consumption_benefits(new.hotel_id,new.order_id,new.actor_id,false,null);
  end if;return new;
end $$;

insert into public.permissions(name,type) select name,'HOTEL_PERMISSION' from unnest(array['review_post_checkout_consumption','waive_post_checkout_consumption']) name on conflict(name) do nothing;
do $$ declare t text;begin foreach t in array array['post_checkout_consumption_cases','post_checkout_consumption_items','post_checkout_consumption_evidence','post_checkout_supplemental_accounts','post_checkout_consumption_payments','post_checkout_consumption_events','stay_checkout_operational_snapshots'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end $$;
grant usage on type public.post_checkout_consumption_status to service_role;
create or replace function public.assign_stay_payer_allocations(p_hotel_id uuid,p_stay_id uuid,p_actor_id uuid,p_expected_version bigint,p_allocations jsonb,p_simulate boolean default false)
returns jsonb language plpgsql set search_path=public as $$
declare v_stay public.stays%rowtype;v_entry record;v_invalid boolean;v_expected_quantity numeric;
begin
  if jsonb_typeof(p_allocations)<>'array' or jsonb_array_length(p_allocations)<1 then return jsonb_build_object('result','invalid');end if;
  select stay.* into v_stay from public.stays stay join public.reservations reservation on reservation.id=stay.reservation_id where stay.id=p_stay_id and reservation.hotel_id=p_hotel_id for update of stay;
  if not found then return jsonb_build_object('result','not_found');end if;
  if v_stay.stay_status<>'checked_in' then return jsonb_build_object('result','invalid_state');end if;
  if v_stay.account_version<>p_expected_version then return jsonb_build_object('result','version_conflict','context',public.list_stay_payer_accounts(p_hotel_id,p_stay_id));end if;
  select exists(select 1 from jsonb_to_recordset(p_allocations) x(folio_entry_id uuid,payer_account_id uuid,amount numeric,quantity numeric)
    left join public.stay_folio_entries entry on entry.id=x.folio_entry_id and entry.hotel_id=p_hotel_id and entry.stay_id=p_stay_id and entry.direction='debit'
    where entry.id is null or not exists(select 1 from public.stay_payer_accounts payer where payer.id=x.payer_account_id and payer.hotel_id=p_hotel_id and payer.stay_id=p_stay_id) or x.amount<=0
      or (entry.kind='consumption_charge' and x.quantity is null) or (entry.kind<>'consumption_charge' and x.quantity is not null) or coalesce(x.quantity,1)<=0) into v_invalid;
  if v_invalid then return jsonb_build_object('result','invalid_allocation');end if;
  for v_entry in select entry.id,entry.amount,entry.kind,entry.consumption_order_id from public.stay_folio_entries entry where entry.hotel_id=p_hotel_id and entry.stay_id=p_stay_id and entry.direction='debit' loop
    if (select coalesce(sum(x.amount),0) from jsonb_to_recordset(p_allocations) x(folio_entry_id uuid,payer_account_id uuid,amount numeric,quantity numeric) where x.folio_entry_id=v_entry.id)<>v_entry.amount then return jsonb_build_object('result','incomplete_allocation','folio_entry_id',v_entry.id);end if;
    if v_entry.kind='consumption_charge' then
      select coalesce(sum(item.effective_quantity),0) into v_expected_quantity from public.consumption_order_item_effective item where item.order_id=v_entry.consumption_order_id;
      if (select coalesce(sum(x.quantity),0) from jsonb_to_recordset(p_allocations) x(folio_entry_id uuid,payer_account_id uuid,amount numeric,quantity numeric) where x.folio_entry_id=v_entry.id)<>v_expected_quantity then return jsonb_build_object('result','incomplete_quantity_allocation','folio_entry_id',v_entry.id,'expected_quantity',v_expected_quantity);end if;
    end if;
  end loop;
  if p_simulate then return jsonb_build_object('result','ok','account_version',v_stay.account_version,'allocations',p_allocations);end if;
  delete from public.stay_payer_allocations where stay_id=p_stay_id;
  insert into public.stay_payer_allocations(hotel_id,stay_id,folio_entry_id,payer_account_id,amount,quantity,allocated_by)
    select p_hotel_id,p_stay_id,x.folio_entry_id,x.payer_account_id,x.amount,x.quantity,p_actor_id from jsonb_to_recordset(p_allocations) x(folio_entry_id uuid,payer_account_id uuid,amount numeric,quantity numeric);
  update public.stays set account_version=account_version+1 where id=p_stay_id;
  return jsonb_build_object('result','ok','account_version',v_stay.account_version+1);
end $$;
create or replace function public.list_corporate_accounts(p_hotel_id uuid) returns jsonb language sql stable set search_path=public as $$
  select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(account)||jsonb_build_object(
    'authorizations',(select coalesce(jsonb_agg(to_jsonb(auth) order by auth.updated_at desc),'[]'::jsonb) from public.corporate_credit_authorizations auth where auth.corporate_account_id=account.id),
    'receivables',(select coalesce(jsonb_agg(to_jsonb(receivable) order by receivable.due_on,receivable.created_at),'[]'::jsonb) from public.corporate_receivables receivable where receivable.corporate_account_id=account.id)
  ) order by account.legal_name),'[]'::jsonb))
  from public.corporate_accounts account where account.hotel_id=p_hotel_id;
$$;
grant execute on function public.get_stay_departure_review(uuid,uuid),public.checkout_stay_account_stage4(uuid,uuid,uuid,bigint,jsonb,uuid,uuid[],uuid[],text),public.create_post_checkout_consumption_case(uuid,uuid,jsonb),public.act_post_checkout_consumption_case(uuid,uuid,uuid,text,integer,text,text,timestamptz),public.pay_post_checkout_consumption_case(uuid,uuid,uuid,integer,jsonb,uuid),public.list_post_checkout_consumption(uuid,uuid),public.add_post_checkout_consumption_evidence(uuid,uuid,uuid,text,text),public.pay_corporate_receivable(uuid,uuid,uuid,integer,jsonb,uuid) to service_role;

alter function public.operational_pending_candidates(uuid,timestamptz) rename to operational_pending_candidates_stage4_base;
create function public.operational_pending_candidates(p_hotel_id uuid,p_now timestamptz default now()) returns jsonb language plpgsql set search_path=public as $$
declare v_result jsonb;v record;
begin
  v_result:=public.operational_pending_candidates_stage4_base(p_hotel_id,p_now);
  for v in select id,stay_id,status,expected_at,responsible_id from public.consumption_service_orders where hotel_id=p_hotel_id and status in('received','preparing','ready') and expected_at<p_now loop v_result:=v_result||jsonb_build_array(jsonb_build_object('source','consumption','source_key','consumption:service:'||v.id,'kind','consumption_service_overdue','entity_type','service_order','entity_id',v.id,'title','Pedido atrasado aguardando '||case when v.status='ready' then 'entrega' else 'preparo' end,'href','/dashboard/consumption/service','severity','warning','responsible_id',v.responsible_id,'due_on',v.expected_at::date));end loop;
  for v in select auth.id,auth.stay_id from public.corporate_credit_authorizations auth where auth.hotel_id=p_hotel_id and auth.status='submitted' loop v_result:=v_result||jsonb_build_array(jsonb_build_object('source','consumption','source_key','consumption:corporate-auth:'||v.id,'kind','corporate_credit_approval','entity_type','corporate_credit_authorization','entity_id',v.id,'title','Crédito empresarial aguardando aprovação','href','/dashboard/consumption/companies','severity','warning'));end loop;
  for v in select id,due_on from public.corporate_receivables where hotel_id=p_hotel_id and status in('open','partially_paid') and due_on<(p_now at time zone 'UTC')::date loop v_result:=v_result||jsonb_build_array(jsonb_build_object('source','consumption','source_key','consumption:corporate-receivable:'||v.id,'kind','corporate_receivable_overdue','entity_type','corporate_receivable','entity_id',v.id,'title','Recebível empresarial vencido','href','/dashboard/consumption/companies','severity','critical','due_on',v.due_on));end loop;
  for v in select id,status from public.post_checkout_consumption_cases where hotel_id=p_hotel_id and status in('submitted','collection_pending','disputed','partially_paid') loop v_result:=v_result||jsonb_build_array(jsonb_build_object('source','consumption','source_key','consumption:post-checkout:'||v.id,'kind','post_checkout_consumption','entity_type','post_checkout_case','entity_id',v.id,'title','Consumo pós-saída aguardando '||case when v.status='submitted' then 'revisão' when v.status='disputed' then 'decisão da contestação' else 'recebimento' end,'href','/dashboard/consumption/post-checkout?id='||v.id,'severity',case when v.status='disputed' then 'critical' else 'warning' end));end loop;
  return v_result;
end $$;
grant execute on function public.operational_pending_candidates(uuid,timestamptz) to service_role;
