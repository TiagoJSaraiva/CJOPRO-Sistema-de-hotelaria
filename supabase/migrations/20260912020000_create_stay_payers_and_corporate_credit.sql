create type public.stay_payer_kind as enum ('primary_guest','companion','company');
create type public.corporate_credit_status as enum ('draft','submitted','approved','rejected','revoked','expired');
create type public.corporate_receivable_status as enum ('open','partially_paid','paid','reversed');

create table public.corporate_accounts (
  id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,
  legal_name text not null,tax_id text not null,billing_email text,billing_phone text,currency text not null,
  credit_limit numeric(12,2) not null default 0,payment_term_days integer not null default 0,
  covered_category_ids uuid[] not null default array[]::uuid[],covers_maintenance boolean not null default false,
  active boolean not null default true,version integer not null default 0,created_by uuid references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  constraint corporate_accounts_id_hotel_unique unique(id,hotel_id),
  constraint corporate_accounts_tax_unique unique(hotel_id,tax_id),
  constraint corporate_accounts_accounts_values check(credit_limit>=0 and payment_term_days between 0 and 365 and currency~'^[A-Z]{3}$'),
  constraint corporate_accounts_text check(length(btrim(legal_name)) between 2 and 200 and length(btrim(tax_id)) between 3 and 40)
);

create table public.stay_payer_accounts (
  id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,
  stay_id uuid not null references public.stays(id) on delete restrict,kind public.stay_payer_kind not null,
  customer_id uuid,corporate_account_id uuid,display_name text not null,version integer not null default 0,
  created_by uuid references public.users(id) on delete restrict,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  constraint stay_payer_accounts_id_hotel_unique unique(id,hotel_id),
  constraint stay_payer_accounts_customer_hotel_fkey foreign key(customer_id,hotel_id) references public.customers(id,hotel_id) on delete restrict,
  constraint stay_payerPayerCorporate_hotel_fkey foreign key(corporate_account_id,hotel_id) references public.corporate_accounts(id,hotel_id) on delete restrict,
  constraint stay_payer_accounts_shape check(
    (kind in ('primary_guest','companion') and customer_id is not null and corporate_account_id is null) or
    (kind='company' and customer_id is null and corporate_account_id is not null)
  ),
  constraint stay_payer_accounts_name check(length(btrim(display_name)) between 1 and 200),
  unique(stay_id,customer_id),unique(stay_id,corporate_account_id)
);
create unique index stay_payerPrimary_unique on public.stay_payer_accounts(stay_id) where kind='primary_guest';

create table public.stay_payer_allocations (
  id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,
  stay_id uuid not null references public.stays(id) on delete restrict,folio_entry_id uuid not null,payer_account_id uuid not null,
  amount numeric(12,2) not null,quantity numeric(12,3),version integer not null default 0,
  allocated_by uuid references public.users(id) on delete restrict,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  constraint stay_payer_allocations_entry_hotel_fkey foreign key(folio_entry_id,hotel_id) references public.stay_folio_entries(id,hotel_id) on delete restrict,
  constraint stay_payer_allocations_payer_hotel_fkey foreign key(payer_account_id,hotel_id) references public.stay_payer_accounts(id,hotel_id) on delete restrict,
  constraint stay_payer_allocations_amount check(amount>0 and (quantity is null or quantity>0)),
  unique(folio_entry_id,payer_account_id)
);
create index stay_payer_allocations_stay_idx on public.stay_payer_allocations(hotel_id,stay_id,payer_account_id);

create table public.stay_payer_payment_batches (
  hotel_id uuid not null references public.hotels(id) on delete restrict,payer_account_id uuid not null,
  payment_batch_id uuid not null,amount numeric(12,2) not null,created_at timestamptz not null default now(),
  primary key(payment_batch_id),
  constraint stay_payer_payments_payer_hotel_fkey foreign key(payer_account_id,hotel_id) references public.stay_payer_accounts(id,hotel_id) on delete restrict,
  constraint stay_payer_payments_batch_hotel_fkey foreign key(payment_batch_id,hotel_id) references public.stay_payment_batches(id,hotel_id) on delete restrict,
  constraint stay_payer_payments_amount check(amount>0)
);

create table public.corporate_credit_authorizations (
  id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,
  stay_id uuid not null references public.stays(id) on delete restrict,corporate_account_id uuid not null,
  status public.corporate_credit_status not null default 'draft',amount_limit numeric(12,2) not null,
  reserved_amount numeric(12,2) not null default 0,consumed_amount numeric(12,2) not null default 0,
  covered_category_ids uuid[] not null default array[]::uuid[],covers_maintenance boolean not null default false,
  expires_at timestamptz not null,reason text not null,version integer not null default 0,
  requested_by uuid not null references public.users(id) on delete restrict,decided_by uuid references public.users(id) on delete restrict,
  decided_at timestamptz,decision_reason text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  constraint corporate_credit_auth_id_hotel_unique unique(id,hotel_id),
  constraint corporate_credit_auth_company_hotel_fkey foreign key(corporate_account_id,hotel_id) references public.corporate_accounts(id,hotel_id) on delete restrict,
  constraint corporate_credit_auth_amounts check(amount_limit>0 and reserved_amount>=0 and consumed_amount>=0 and reserved_amount+consumed_amount<=amount_limit),
  constraint corporate_credit_auth_reason check(length(btrim(reason)) between 3 and 1000),
  constraint corporate_credit_auth_decision check(decided_by is null or decided_by<>requested_by)
);
create unique index corporate_credit_active_stay_company on public.corporate_credit_authorizations(stay_id,corporate_account_id)
  where status in ('draft','submitted','approved');

create table public.corporate_receivables (
  id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,
  corporate_account_id uuid not null,authorization_id uuid not null,stay_id uuid not null references public.stays(id) on delete restrict,
  checkout_record_id uuid,amount numeric(12,2) not null,paid_amount numeric(12,2) not null default 0,currency text not null,
  due_on date not null,status public.corporate_receivable_status not null default 'open',version integer not null default 0,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  constraint corporate_receivable_id_hotel_unique unique(id,hotel_id),
  constraint corporate_receivable_company_hotel_fkey foreign key(corporate_account_id,hotel_id) references public.corporate_accounts(id,hotel_id) on delete restrict,
  constraint corporate_receivable_auth_hotel_fkey foreign key(authorization_id,hotel_id) references public.corporate_credit_authorizations(id,hotel_id) on delete restrict,
  constraint corporate_receivable_checkout_fkey foreign key(checkout_record_id) references public.stay_checkout_records(id) on delete restrict,
  constraint corporate_receivable_amount check(amount>0 and paid_amount>=0 and paid_amount<=amount and currency~'^[A-Z]{3}$')
);

create table public.corporate_receivable_payments (
  id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,
  receivable_id uuid not null,amount numeric(12,2) not null,payment_method public.consumption_payment_method not null,
  reference_code text,idempotency_key uuid not null,request_fingerprint text not null,created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),reversed_payment_id uuid,
  constraint corporate_receivable_payment_receivable_hotel_fkey foreign key(receivable_id,hotel_id) references public.corporate_receivables(id,hotel_id) on delete restrict,
  constraint corporate_receivable_payment_amount check(amount<>0),unique(hotel_id,idempotency_key)
);

create table public.corporate_credit_events (
  id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,
  entity_type text not null,entity_id uuid not null,action text not null,actor_id uuid references public.users(id) on delete restrict,
  details jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
);

alter table public.consumption_service_order_items add column payer_account_id uuid;
alter table public.consumption_service_order_items add constraint consumption_service_item_payer_hotel_fkey
  foreign key(payer_account_id,hotel_id) references public.stay_payer_accounts(id,hotel_id) on delete restrict;

insert into public.stay_payer_accounts(hotel_id,stay_id,kind,customer_id,display_name)
select reservation.hotel_id,stay.id,'primary_guest',customer.id,customer.full_name
from public.stays stay join public.reservations reservation on reservation.id=stay.reservation_id
join public.customers customer on customer.id=reservation.booking_customer_id
on conflict do nothing;

insert into public.stay_payer_allocations(hotel_id,stay_id,folio_entry_id,payer_account_id,amount)
select entry.hotel_id,entry.stay_id,entry.id,payer.id,entry.amount
from public.stay_folio_entries entry join public.stay_payer_accounts payer on payer.stay_id=entry.stay_id and payer.kind='primary_guest'
where entry.direction='debit' and not exists(select 1 from public.stay_payer_allocations allocation where allocation.folio_entry_id=entry.id);

create function public.ensure_primary_stay_payer() returns trigger language plpgsql set search_path=public as $$
declare v_reservation record;
begin
  select reservation.hotel_id,reservation.booking_customer_id,customer.full_name into v_reservation
  from public.reservations reservation join public.customers customer on customer.id=reservation.booking_customer_id
  where reservation.id=new.reservation_id;
  insert into public.stay_payer_accounts(hotel_id,stay_id,kind,customer_id,display_name)
  values(v_reservation.hotel_id,new.id,'primary_guest',v_reservation.booking_customer_id,v_reservation.full_name) on conflict do nothing;
  return new;
end $$;
create trigger trg_stays_primary_payer after insert on public.stays for each row execute function public.ensure_primary_stay_payer();

create function public.allocate_new_folio_to_primary_payer() returns trigger language plpgsql set search_path=public as $$
declare v_payer uuid;
begin
  if new.direction='debit' then
    select id into v_payer from public.stay_payer_accounts where stay_id=new.stay_id and kind='primary_guest';
    if v_payer is not null then insert into public.stay_payer_allocations(hotel_id,stay_id,folio_entry_id,payer_account_id,amount,allocated_by)
      values(new.hotel_id,new.stay_id,new.id,v_payer,new.amount,new.posted_by); end if;
  end if;
  return new;
end $$;
create trigger trg_folio_primary_payer after insert on public.stay_folio_entries for each row execute function public.allocate_new_folio_to_primary_payer();

create or replace function public.list_stay_payer_accounts(p_hotel_id uuid,p_stay_id uuid)
returns jsonb language sql stable set search_path=public as $$
  select jsonb_build_object('stay_id',p_stay_id,'account_version',stay.account_version,
    'items',coalesce(jsonb_agg(jsonb_build_object('id',payer.id,'stay_id',payer.stay_id,'kind',payer.kind,'customer_id',payer.customer_id,
      'corporate_account_id',payer.corporate_account_id,'display_name',payer.display_name,'version',payer.version,
      'debit_total',coalesce(debit.total,0),'credit_total',coalesce(credit.total,0),'balance',coalesce(debit.total,0)-coalesce(credit.total,0)) order by payer.kind,payer.created_at),'[]'::jsonb))
  from public.stays stay join public.reservations reservation on reservation.id=stay.reservation_id and reservation.hotel_id=p_hotel_id
  left join public.stay_payer_accounts payer on payer.stay_id=stay.id
  left join lateral(select sum(amount) total from public.stay_payer_allocations where payer_account_id=payer.id) debit on true
  left join lateral(select sum(amount) total from public.stay_payer_payment_batches where payer_account_id=payer.id) credit on true
  where stay.id=p_stay_id group by stay.id;
$$;

create function public.create_stay_payer_account(p_hotel_id uuid,p_stay_id uuid,p_actor_id uuid,p_kind public.stay_payer_kind,p_customer_id uuid,p_corporate_id uuid)
returns jsonb language plpgsql set search_path=public as $$
declare v_stay record;v_name text;v_id uuid;
begin
  if not public.maintenance_user_has_hotel_scope(p_actor_id,p_hotel_id) then return jsonb_build_object('result','actor_outside_hotel'); end if;
  select stay.* into v_stay from public.stays stay join public.reservations reservation on reservation.id=stay.reservation_id
    where stay.id=p_stay_id and reservation.hotel_id=p_hotel_id for update of stay;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if v_stay.stay_status<>'checked_in' or p_kind not in ('companion','company') then return jsonb_build_object('result','invalid_state'); end if;
  if p_kind='companion' then
    select full_name into v_name from public.customers where id=p_customer_id and hotel_id=p_hotel_id;
    if not found then return jsonb_build_object('result','customer_not_found'); end if;
    insert into public.stay_customers(stay_id,customer_id) values(p_stay_id,p_customer_id) on conflict do nothing;
  else select legal_name into v_name from public.corporate_accounts where id=p_corporate_id and hotel_id=p_hotel_id and active;
    if not found then return jsonb_build_object('result','company_not_found'); end if;
  end if;
  insert into public.stay_payer_accounts(hotel_id,stay_id,kind,customer_id,corporate_account_id,display_name,created_by)
    values(p_hotel_id,p_stay_id,p_kind,p_customer_id,p_corporate_id,v_name,p_actor_id) returning id into v_id;
  return jsonb_build_object('result','ok','payer_account_id',v_id);
exception when unique_violation then return jsonb_build_object('result','already_exists'); end $$;

create function public.assign_stay_payer_allocations(p_hotel_id uuid,p_stay_id uuid,p_actor_id uuid,p_expected_version bigint,p_allocations jsonb,p_simulate boolean default false)
returns jsonb language plpgsql set search_path=public as $$
declare v_stay public.stays%rowtype;v_entry record;v_invalid boolean;
begin
  if jsonb_typeof(p_allocations)<>'array' or jsonb_array_length(p_allocations)<1 then return jsonb_build_object('result','invalid'); end if;
  select stay.* into v_stay from public.stays stay join public.reservations reservation on reservation.id=stay.reservation_id
    where stay.id=p_stay_id and reservation.hotel_id=p_hotel_id for update of stay;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if v_stay.stay_status<>'checked_in' then return jsonb_build_object('result','invalid_state'); end if;
  if v_stay.account_version<>p_expected_version then return jsonb_build_object('result','version_conflict','context',public.list_stay_payer_accounts(p_hotel_id,p_stay_id)); end if;
  select exists(
    select 1 from jsonb_to_recordset(p_allocations) x(folio_entry_id uuid,payer_account_id uuid,amount numeric,quantity numeric)
    where not exists(select 1 from public.stay_folio_entries e where e.id=x.folio_entry_id and e.hotel_id=p_hotel_id and e.stay_id=p_stay_id and e.direction='debit')
      or not exists(select 1 from public.stay_payer_accounts p where p.id=x.payer_account_id and p.hotel_id=p_hotel_id and p.stay_id=p_stay_id)
      or x.amount<=0
  ) into v_invalid;
  if v_invalid then return jsonb_build_object('result','invalid_allocation'); end if;
  for v_entry in select entry.id,entry.amount from public.stay_folio_entries entry where entry.hotel_id=p_hotel_id and entry.stay_id=p_stay_id and entry.direction='debit' loop
    if (select coalesce(sum(x.amount),0) from jsonb_to_recordset(p_allocations) x(folio_entry_id uuid,payer_account_id uuid,amount numeric,quantity numeric) where x.folio_entry_id=v_entry.id)<>v_entry.amount
      then return jsonb_build_object('result','incomplete_allocation','folio_entry_id',v_entry.id); end if;
  end loop;
  if p_simulate then return jsonb_build_object('result','ok','account_version',v_stay.account_version,'allocations',p_allocations); end if;
  delete from public.stay_payer_allocations where stay_id=p_stay_id;
  insert into public.stay_payer_allocations(hotel_id,stay_id,folio_entry_id,payer_account_id,amount,quantity,allocated_by)
    select p_hotel_id,p_stay_id,x.folio_entry_id,x.payer_account_id,x.amount,x.quantity,p_actor_id
    from jsonb_to_recordset(p_allocations) x(folio_entry_id uuid,payer_account_id uuid,amount numeric,quantity numeric);
  update public.stays set account_version=account_version+1 where id=p_stay_id;
  return jsonb_build_object('result','ok','account_version',v_stay.account_version+1);
end $$;

create function public.create_stay_payer_payment(p_hotel_id uuid,p_stay_id uuid,p_actor_id uuid,p_payer_id uuid,p_expected_version bigint,p_tenders jsonb,p_idempotency_key uuid,p_note text)
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
  insert into public.stay_payer_payment_batches(hotel_id,payer_account_id,payment_batch_id,amount)
    values(p_hotel_id,p_payer_id,(v_result->>'payment_batch_id')::uuid,v_total);
  return v_result;
end $$;

create function public.save_corporate_account(p_hotel_id uuid,p_actor_id uuid,p_id uuid,p_input jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare v_id uuid:=coalesce(p_id,gen_random_uuid());
begin
  if not public.maintenance_user_has_hotel_scope(p_actor_id,p_hotel_id) then return jsonb_build_object('result','actor_outside_hotel'); end if;
  insert into public.corporate_accounts(id,hotel_id,legal_name,tax_id,billing_email,billing_phone,currency,credit_limit,payment_term_days,covered_category_ids,covers_maintenance,active,created_by)
  values(v_id,p_hotel_id,btrim(p_input->>'legal_name'),btrim(p_input->>'tax_id'),nullif(btrim(p_input->>'billing_email'),''),nullif(btrim(p_input->>'billing_phone'),''),upper(p_input->>'currency'),
    (p_input->>'credit_limit')::numeric,(p_input->>'payment_term_days')::integer,array(select jsonb_array_elements_text(p_input->'covered_category_ids')::uuid),coalesce((p_input->>'covers_maintenance')::boolean,false),coalesce((p_input->>'active')::boolean,true),p_actor_id)
  on conflict(id) do update set legal_name=excluded.legal_name,tax_id=excluded.tax_id,billing_email=excluded.billing_email,billing_phone=excluded.billing_phone,currency=excluded.currency,
    credit_limit=excluded.credit_limit,payment_term_days=excluded.payment_term_days,covered_category_ids=excluded.covered_category_ids,covers_maintenance=excluded.covers_maintenance,active=excluded.active,version=corporate_accounts.version+1,updated_at=now()
    where corporate_accounts.hotel_id=p_hotel_id;
  return jsonb_build_object('result','ok','corporate_account_id',v_id);
exception when unique_violation then return jsonb_build_object('result','tax_id_exists'); end $$;

create function public.list_corporate_accounts(p_hotel_id uuid) returns jsonb language sql stable set search_path=public as $$
  select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(account) order by account.legal_name),'[]'::jsonb))
  from public.corporate_accounts account where account.hotel_id=p_hotel_id;
$$;

create function public.create_corporate_credit_authorization(p_hotel_id uuid,p_actor_id uuid,p_input jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare v_id uuid;
begin
  if not exists(select 1 from public.stays stay join public.reservations reservation on reservation.id=stay.reservation_id where stay.id=(p_input->>'stay_id')::uuid and reservation.hotel_id=p_hotel_id)
    or not exists(select 1 from public.corporate_accounts where id=(p_input->>'corporate_account_id')::uuid and hotel_id=p_hotel_id and active)
    then return jsonb_build_object('result','not_found'); end if;
  insert into public.corporate_credit_authorizations(hotel_id,stay_id,corporate_account_id,amount_limit,covered_category_ids,covers_maintenance,expires_at,reason,requested_by)
  values(p_hotel_id,(p_input->>'stay_id')::uuid,(p_input->>'corporate_account_id')::uuid,(p_input->>'amount_limit')::numeric,
    array(select jsonb_array_elements_text(p_input->'covered_category_ids')::uuid),coalesce((p_input->>'covers_maintenance')::boolean,false),(p_input->>'expires_at')::timestamptz,btrim(p_input->>'reason'),p_actor_id) returning id into v_id;
  return jsonb_build_object('result','ok','authorization_id',v_id);
end $$;

create function public.act_corporate_credit_authorization(p_hotel_id uuid,p_id uuid,p_actor_id uuid,p_action text,p_expected_version integer,p_reason text)
returns jsonb language plpgsql set search_path=public as $$
declare v_auth public.corporate_credit_authorizations%rowtype;v_status public.corporate_credit_status;
begin
  select * into v_auth from public.corporate_credit_authorizations where id=p_id and hotel_id=p_hotel_id for update;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if v_auth.version<>p_expected_version then return jsonb_build_object('result','version_conflict'); end if;
  if length(coalesce(btrim(p_reason),''))<3 then return jsonb_build_object('result','invalid'); end if;
  v_status:=case when p_action='submit' and v_auth.status='draft' then 'submitted'
    when p_action='approve' and v_auth.status='submitted' then 'approved'
    when p_action='reject' and v_auth.status='submitted' then 'rejected'
    when p_action='revoke' and v_auth.status='approved' then 'revoked' else null end;
  if v_status is null then return jsonb_build_object('result','invalid_state'); end if;
  if p_action in ('approve','reject') and v_auth.requested_by=p_actor_id then return jsonb_build_object('result','segregation_required'); end if;
  update public.corporate_credit_authorizations set status=v_status,version=version+1,updated_at=now(),
    decided_by=case when p_action in ('approve','reject') then p_actor_id else decided_by end,
    decided_at=case when p_action in ('approve','reject') then now() else decided_at end,
    decision_reason=case when p_action in ('approve','reject') then btrim(p_reason) else decision_reason end where id=p_id;
  insert into public.corporate_credit_events(hotel_id,entity_type,entity_id,action,actor_id,details) values(p_hotel_id,'authorization',p_id,p_action,p_actor_id,jsonb_build_object('reason',btrim(p_reason)));
  return jsonb_build_object('result','ok','status',v_status,'version',v_auth.version+1);
end $$;

create function public.protect_corporate_credit_history() returns trigger language plpgsql as $$ begin raise exception 'corporate credit history is immutable' using errcode='23514'; end $$;
create trigger trg_corporate_credit_events_immutable before update or delete on public.corporate_credit_events for each row execute function public.protect_corporate_credit_history();
create trigger trg_receivable_payments_immutable before update or delete on public.corporate_receivable_payments for each row execute function public.protect_corporate_credit_history();

insert into public.permissions(name,type) select name,'HOTEL_PERMISSION' from unnest(array[
  'manage_stay_payers','manage_corporate_accounts','request_corporate_credit','approve_corporate_credit','settle_corporate_receivables'
]) name on conflict(name) do nothing;

do $$ declare t text; begin foreach t in array array['corporate_accounts','stay_payer_accounts','stay_payer_allocations','stay_payer_payment_batches','corporate_credit_authorizations','corporate_receivables','corporate_receivable_payments','corporate_credit_events'] loop
  execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end $$;
grant usage on type public.stay_payer_kind,public.corporate_credit_status,public.corporate_receivable_status to service_role;
grant execute on function public.list_stay_payer_accounts(uuid,uuid),public.create_stay_payer_account(uuid,uuid,uuid,public.stay_payer_kind,uuid,uuid),
  public.assign_stay_payer_allocations(uuid,uuid,uuid,bigint,jsonb,boolean),public.create_stay_payer_payment(uuid,uuid,uuid,uuid,bigint,jsonb,uuid,text),
  public.save_corporate_account(uuid,uuid,uuid,jsonb),public.create_corporate_credit_authorization(uuid,uuid,jsonb),
  public.act_corporate_credit_authorization(uuid,uuid,uuid,text,integer,text),public.list_corporate_accounts(uuid) to service_role;
