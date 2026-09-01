create type public.stay_folio_direction as enum ('debit', 'credit');
create type public.stay_folio_kind as enum ('lodging', 'maintenance_charge', 'payment', 'refund', 'adjustment');
create type public.maintenance_cost_kind as enum ('material', 'labor', 'external_service', 'other');
create type public.maintenance_finance_approval_status as enum ('draft', 'submitted', 'approved', 'rejected', 'canceled');
create type public.maintenance_finance_settlement_status as enum ('not_posted', 'open', 'partially_settled', 'settled', 'reversed');

create table public.stay_folio_entries (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  stay_id uuid not null references public.stays(id) on delete restrict,
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  direction public.stay_folio_direction not null,
  kind public.stay_folio_kind not null,
  amount numeric(12,2) not null,
  currency text not null,
  description text not null,
  maintenance_occurrence_id uuid references public.maintenance_occurrences(id) on delete restrict,
  financial_transaction_id uuid references public.financial_transactions(id) on delete restrict,
  reversed_entry_id uuid references public.stay_folio_entries(id) on delete restrict,
  source_key text not null,
  posted_by uuid references public.users(id) on delete restrict,
  posted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint stay_folio_entries_amount_check check (amount > 0),
  constraint stay_folio_entries_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint stay_folio_entries_description_check check (length(btrim(description)) between 1 and 1000),
  constraint stay_folio_entries_source_key_check check (length(btrim(source_key)) between 1 and 240),
  constraint stay_folio_entries_not_self_reversal_check check (reversed_entry_id is null or reversed_entry_id <> id),
  constraint stay_folio_entries_hotel_source_key unique (hotel_id, source_key),
  constraint stay_folio_entries_transaction_key unique (financial_transaction_id)
);

create table public.stay_folio_allocations (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  stay_id uuid not null references public.stays(id) on delete restrict,
  credit_entry_id uuid not null references public.stay_folio_entries(id) on delete restrict,
  debit_entry_id uuid not null references public.stay_folio_entries(id) on delete restrict,
  amount numeric(12,2) not null,
  created_by uuid references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint stay_folio_allocations_amount_check check (amount > 0),
  constraint stay_folio_allocations_distinct_entries_check check (credit_entry_id <> debit_entry_id),
  constraint stay_folio_allocations_entry_key unique (credit_entry_id, debit_entry_id)
);

create table public.maintenance_cost_items (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  occurrence_id uuid not null references public.maintenance_occurrences(id) on delete restrict,
  work_order_id uuid references public.maintenance_work_orders(id) on delete restrict,
  kind public.maintenance_cost_kind not null,
  description text not null,
  quantity numeric(12,3) not null default 1,
  estimated_amount numeric(12,2),
  actual_amount numeric(12,2),
  currency text not null,
  counterparty text,
  due_date date,
  reference_code text,
  approval_status public.maintenance_finance_approval_status not null default 'draft',
  settlement_status public.maintenance_finance_settlement_status not null default 'not_posted',
  created_by uuid not null references public.users(id) on delete restrict,
  submitted_at timestamptz,
  approved_by uuid references public.users(id) on delete restrict,
  approved_at timestamptz,
  rejected_by uuid references public.users(id) on delete restrict,
  rejected_at timestamptz,
  decision_reason text,
  canceled_by uuid references public.users(id) on delete restrict,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_cost_items_description_check check (length(btrim(description)) between 3 and 2000),
  constraint maintenance_cost_items_quantity_check check (quantity > 0),
  constraint maintenance_cost_items_estimated_check check (estimated_amount is null or estimated_amount >= 0),
  constraint maintenance_cost_items_actual_check check (actual_amount is null or actual_amount > 0),
  constraint maintenance_cost_items_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint maintenance_cost_items_submission_check check (
    approval_status in ('draft', 'canceled') or (actual_amount is not null and submitted_at is not null)
  ),
  constraint maintenance_cost_items_approval_check check (
    approval_status <> 'approved' or (approved_by is not null and approved_at is not null and approved_by <> created_by)
  ),
  constraint maintenance_cost_items_rejection_check check (
    approval_status <> 'rejected' or (rejected_by is not null and rejected_at is not null and nullif(btrim(decision_reason), '') is not null)
  )
);

create table public.maintenance_recoveries (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  occurrence_id uuid not null references public.maintenance_occurrences(id) on delete restrict,
  responsible_party public.maintenance_responsible_party not null,
  stay_id uuid references public.stays(id) on delete restrict,
  debtor_name text,
  charge_amount numeric(12,2) not null default 0,
  waived_amount numeric(12,2) not null default 0,
  currency text not null,
  justification text not null,
  due_date date,
  approval_status public.maintenance_finance_approval_status not null default 'draft',
  settlement_status public.maintenance_finance_settlement_status not null default 'not_posted',
  folio_entry_id uuid references public.stay_folio_entries(id) on delete restrict,
  created_by uuid not null references public.users(id) on delete restrict,
  submitted_at timestamptz,
  approved_by uuid references public.users(id) on delete restrict,
  approved_at timestamptz,
  rejected_by uuid references public.users(id) on delete restrict,
  rejected_at timestamptz,
  decision_reason text,
  canceled_by uuid references public.users(id) on delete restrict,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_recoveries_party_check check (responsible_party in ('guest', 'supplier')),
  constraint maintenance_recoveries_amount_check check (charge_amount >= 0 and waived_amount >= 0),
  constraint maintenance_recoveries_total_check check (charge_amount + waived_amount > 0),
  constraint maintenance_recoveries_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint maintenance_recoveries_justification_check check (length(btrim(justification)) between 3 and 2000),
  constraint maintenance_recoveries_debtor_check check (
    (responsible_party = 'guest' and stay_id is not null)
    or (responsible_party = 'supplier' and nullif(btrim(debtor_name), '') is not null)
  ),
  constraint maintenance_recoveries_submission_check check (
    approval_status in ('draft', 'canceled') or submitted_at is not null
  ),
  constraint maintenance_recoveries_approval_check check (
    approval_status <> 'approved' or (approved_by is not null and approved_at is not null and approved_by <> created_by)
  ),
  constraint maintenance_recoveries_rejection_check check (
    approval_status <> 'rejected' or (rejected_by is not null and rejected_at is not null and nullif(btrim(decision_reason), '') is not null)
  )
);

alter table public.financial_transactions
  add column maintenance_cost_item_id uuid references public.maintenance_cost_items(id) on delete restrict,
  add column maintenance_recovery_id uuid references public.maintenance_recoveries(id) on delete restrict;

create table public.maintenance_financial_settlements (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  cost_item_id uuid references public.maintenance_cost_items(id) on delete restrict,
  recovery_id uuid references public.maintenance_recoveries(id) on delete restrict,
  financial_transaction_id uuid not null references public.financial_transactions(id) on delete restrict,
  amount numeric(12,2) not null,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  reversal_of_id uuid references public.maintenance_financial_settlements(id) on delete restrict,
  constraint maintenance_financial_settlements_target_check check ((cost_item_id is null) <> (recovery_id is null)),
  constraint maintenance_financial_settlements_amount_check check (amount > 0),
  constraint maintenance_financial_settlements_transaction_key unique (financial_transaction_id),
  constraint maintenance_financial_settlements_reversal_key unique (reversal_of_id),
  constraint maintenance_financial_settlements_not_self_reversal_check check (reversal_of_id is null or reversal_of_id <> id)
);

create table public.maintenance_financial_attachments (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  occurrence_id uuid not null references public.maintenance_occurrences(id) on delete restrict,
  cost_item_id uuid references public.maintenance_cost_items(id) on delete restrict,
  recovery_id uuid references public.maintenance_recoveries(id) on delete restrict,
  storage_path text not null unique,
  original_filename text not null,
  content_type text not null,
  size_bytes bigint not null,
  uploaded_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references public.users(id) on delete restrict,
  removal_reason text,
  constraint maintenance_financial_attachments_target_check check ((cost_item_id is null) <> (recovery_id is null)),
  constraint maintenance_financial_attachments_type_check check (content_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  constraint maintenance_financial_attachments_size_check check (size_bytes > 0 and size_bytes <= 10485760),
  constraint maintenance_financial_attachments_removal_check check (
    (removed_at is null and removed_by is null and removal_reason is null)
    or (removed_at is not null and removed_by is not null and nullif(btrim(removal_reason), '') is not null)
  )
);

create table public.maintenance_financial_checkout_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  stay_id uuid not null references public.stays(id) on delete restrict,
  folio_entry_id uuid not null references public.stay_folio_entries(id) on delete restrict,
  acknowledged_by uuid not null references public.users(id) on delete restrict,
  acknowledged_at timestamptz not null default now(),
  note text,
  constraint maintenance_financial_checkout_ack_key unique (stay_id, folio_entry_id)
);

create index idx_stay_folio_entries_stay on public.stay_folio_entries(hotel_id, stay_id, posted_at, id);
create index idx_stay_folio_entries_maintenance on public.stay_folio_entries(maintenance_occurrence_id) where maintenance_occurrence_id is not null;
create index idx_stay_folio_allocations_stay on public.stay_folio_allocations(hotel_id, stay_id);
create index idx_maintenance_cost_items_queue on public.maintenance_cost_items(hotel_id, approval_status, settlement_status, due_date);
create index idx_maintenance_cost_items_occurrence on public.maintenance_cost_items(occurrence_id, created_at);
create index idx_maintenance_recoveries_queue on public.maintenance_recoveries(hotel_id, approval_status, settlement_status, due_date);
create index idx_maintenance_recoveries_occurrence on public.maintenance_recoveries(occurrence_id, created_at);
create index idx_maintenance_financial_attachments_occurrence on public.maintenance_financial_attachments(occurrence_id, created_at) where removed_at is null;

create trigger trg_maintenance_cost_items_set_updated_at before update on public.maintenance_cost_items
  for each row execute function public.set_updated_at();
create trigger trg_maintenance_recoveries_set_updated_at before update on public.maintenance_recoveries
  for each row execute function public.set_updated_at();

create or replace function public.validate_maintenance_finance_scope()
returns trigger language plpgsql as $$
declare
  v_hotel_id uuid;
  v_occurrence_id uuid;
  v_stay_id uuid;
  v_direction public.stay_folio_direction;
  v_currency text;
begin
  if tg_table_name = 'stay_folio_entries' then
    select r.hotel_id, s.reservation_id into v_hotel_id, v_occurrence_id
    from public.stays s join public.reservations r on r.id = s.reservation_id where s.id = new.stay_id;
    if v_hotel_id is distinct from new.hotel_id or v_occurrence_id is distinct from new.reservation_id then
      raise exception 'folio entry crosses stay scope' using errcode = '23514';
    end if;
    select currency into v_currency from public.hotels where id = new.hotel_id;
    if v_currency is distinct from new.currency then raise exception 'folio entry must use hotel currency' using errcode = '23514'; end if;
  elsif tg_table_name = 'stay_folio_allocations' then
    select hotel_id, stay_id, direction into v_hotel_id, v_stay_id, v_direction from public.stay_folio_entries where id = new.credit_entry_id;
    if v_hotel_id is distinct from new.hotel_id or v_stay_id is distinct from new.stay_id or v_direction <> 'credit' then
      raise exception 'folio credit allocation crosses scope' using errcode = '23514';
    end if;
    select hotel_id, stay_id, direction into v_hotel_id, v_stay_id, v_direction from public.stay_folio_entries where id = new.debit_entry_id;
    if v_hotel_id is distinct from new.hotel_id or v_stay_id is distinct from new.stay_id or v_direction <> 'debit' then
      raise exception 'folio debit allocation crosses scope' using errcode = '23514';
    end if;
    if (select coalesce(sum(amount), 0) from public.stay_folio_allocations where credit_entry_id = new.credit_entry_id and id <> new.id) + new.amount
      > (select amount from public.stay_folio_entries where id = new.credit_entry_id) then
      raise exception 'folio credit overallocated' using errcode = '23514';
    end if;
    if (select coalesce(sum(amount), 0) from public.stay_folio_allocations where debit_entry_id = new.debit_entry_id and id <> new.id) + new.amount
      > (select amount from public.stay_folio_entries where id = new.debit_entry_id) then
      raise exception 'folio debit overallocated' using errcode = '23514';
    end if;
  elsif tg_table_name = 'maintenance_cost_items' then
    select hotel_id into v_hotel_id from public.maintenance_occurrences where id = new.occurrence_id;
    if v_hotel_id is distinct from new.hotel_id then raise exception 'maintenance cost crosses occurrence scope' using errcode = '23514'; end if;
    if new.work_order_id is not null then
      select occurrence_id into v_occurrence_id from public.maintenance_work_orders where id = new.work_order_id and hotel_id = new.hotel_id;
      if v_occurrence_id is distinct from new.occurrence_id then raise exception 'maintenance cost crosses work order scope' using errcode = '23514'; end if;
    end if;
  elsif tg_table_name = 'maintenance_recoveries' then
    select hotel_id, stay_id into v_hotel_id, v_stay_id from public.maintenance_occurrences where id = new.occurrence_id;
    if v_hotel_id is distinct from new.hotel_id or (new.responsible_party = 'guest' and v_stay_id is distinct from new.stay_id) then
      raise exception 'maintenance recovery crosses occurrence scope' using errcode = '23514';
    end if;
  elsif tg_table_name = 'maintenance_financial_settlements' then
    if new.cost_item_id is not null then
      select hotel_id into v_hotel_id from public.maintenance_cost_items where id = new.cost_item_id;
    else
      select hotel_id into v_hotel_id from public.maintenance_recoveries where id = new.recovery_id;
    end if;
    if v_hotel_id is distinct from new.hotel_id then raise exception 'maintenance settlement crosses target scope' using errcode = '23514'; end if;
    select hotel_id into v_hotel_id from public.financial_transactions where id = new.financial_transaction_id;
    if v_hotel_id is distinct from new.hotel_id then raise exception 'maintenance settlement crosses transaction scope' using errcode = '23514'; end if;
  elsif tg_table_name = 'maintenance_financial_attachments' then
    select hotel_id into v_hotel_id from public.maintenance_occurrences where id = new.occurrence_id;
    if v_hotel_id is distinct from new.hotel_id then raise exception 'financial attachment crosses occurrence scope' using errcode = '23514'; end if;
    if new.cost_item_id is not null then
      select occurrence_id into v_occurrence_id from public.maintenance_cost_items where id = new.cost_item_id and hotel_id = new.hotel_id;
    else
      select occurrence_id into v_occurrence_id from public.maintenance_recoveries where id = new.recovery_id and hotel_id = new.hotel_id;
    end if;
    if v_occurrence_id is distinct from new.occurrence_id then raise exception 'financial attachment crosses target scope' using errcode = '23514'; end if;
  elsif tg_table_name = 'maintenance_financial_checkout_acknowledgements' then
    select hotel_id, stay_id into v_hotel_id, v_stay_id from public.stay_folio_entries where id = new.folio_entry_id;
    if v_hotel_id is distinct from new.hotel_id or v_stay_id is distinct from new.stay_id then
      raise exception 'financial checkout acknowledgement crosses folio scope' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_stay_folio_entries_validate_scope before insert or update on public.stay_folio_entries
  for each row execute function public.validate_maintenance_finance_scope();
create trigger trg_stay_folio_allocations_validate_scope before insert or update on public.stay_folio_allocations
  for each row execute function public.validate_maintenance_finance_scope();
create trigger trg_maintenance_cost_items_validate_scope before insert or update on public.maintenance_cost_items
  for each row execute function public.validate_maintenance_finance_scope();
create trigger trg_maintenance_recoveries_validate_scope before insert or update on public.maintenance_recoveries
  for each row execute function public.validate_maintenance_finance_scope();
create trigger trg_maintenance_financial_settlements_validate_scope before insert or update on public.maintenance_financial_settlements
  for each row execute function public.validate_maintenance_finance_scope();
create trigger trg_maintenance_financial_attachments_validate_scope before insert or update on public.maintenance_financial_attachments
  for each row execute function public.validate_maintenance_finance_scope();
create trigger trg_maintenance_financial_checkout_ack_validate_scope before insert or update on public.maintenance_financial_checkout_acknowledgements
  for each row execute function public.validate_maintenance_finance_scope();

create or replace function public.validate_generated_financial_transaction_scope()
returns trigger language plpgsql as $$
declare v_hotel_id uuid;
begin
  if new.maintenance_cost_item_id is not null then
    select hotel_id into v_hotel_id from public.maintenance_cost_items where id = new.maintenance_cost_item_id;
    if v_hotel_id is distinct from new.hotel_id then raise exception 'financial transaction crosses maintenance cost scope' using errcode = '23514'; end if;
  end if;
  if new.maintenance_recovery_id is not null then
    select hotel_id into v_hotel_id from public.maintenance_recoveries where id = new.maintenance_recovery_id;
    if v_hotel_id is distinct from new.hotel_id then raise exception 'financial transaction crosses maintenance recovery scope' using errcode = '23514'; end if;
  end if;
  return new;
end;
$$;

create trigger trg_financial_transactions_validate_maintenance_scope before insert or update on public.financial_transactions
  for each row execute function public.validate_generated_financial_transaction_scope();

create or replace function public.prevent_financial_ledger_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'posted financial ledger records are immutable' using errcode = '23514';
end;
$$;

create trigger trg_stay_folio_entries_immutable before update or delete on public.stay_folio_entries
  for each row execute function public.prevent_financial_ledger_mutation();
create trigger trg_stay_folio_allocations_immutable before update or delete on public.stay_folio_allocations
  for each row execute function public.prevent_financial_ledger_mutation();
create trigger trg_maintenance_financial_settlements_immutable before update or delete on public.maintenance_financial_settlements
  for each row execute function public.prevent_financial_ledger_mutation();

create or replace function public.protect_generated_financial_transaction()
returns trigger language plpgsql as $$
begin
  if old.maintenance_cost_item_id is not null or old.maintenance_recovery_id is not null
    or exists (select 1 from public.stay_folio_entries where financial_transaction_id = old.id) then
    raise exception 'generated financial transactions require compensating operations' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger trg_financial_transactions_protect_generated before update or delete on public.financial_transactions
  for each row execute function public.protect_generated_financial_transaction();

create or replace function public.allocate_stay_folio_credit(
  p_hotel_id uuid, p_stay_id uuid, p_credit_entry_id uuid, p_actor_id uuid, p_allocations jsonb default null
)
returns numeric language plpgsql set search_path = public as $$
declare
  v_credit numeric(12,2);
  v_allocated numeric(12,2) := 0;
  v_item jsonb;
  v_debit record;
  v_amount numeric(12,2);
  v_open numeric(12,2);
begin
  select amount into v_credit from public.stay_folio_entries
  where id = p_credit_entry_id and hotel_id = p_hotel_id and stay_id = p_stay_id and direction = 'credit';
  if v_credit is null then raise exception 'folio credit not found' using errcode = 'P0002'; end if;

  if p_allocations is not null and jsonb_array_length(p_allocations) > 0 then
    for v_item in select value from jsonb_array_elements(p_allocations) loop
      v_amount := (v_item->>'amount')::numeric;
      select entry.amount - coalesce(sum(allocation.amount), 0) into v_open
      from public.stay_folio_entries entry
      left join public.stay_folio_allocations allocation on allocation.debit_entry_id = entry.id
      where entry.id = (v_item->>'debit_entry_id')::uuid and entry.hotel_id = p_hotel_id
        and entry.stay_id = p_stay_id and entry.direction = 'debit'
      group by entry.amount;
      if v_amount <= 0 or v_open is null or v_amount > v_open or v_allocated + v_amount > v_credit then
        raise exception 'invalid folio allocation' using errcode = '23514';
      end if;
      insert into public.stay_folio_allocations(hotel_id, stay_id, credit_entry_id, debit_entry_id, amount, created_by)
      values (p_hotel_id, p_stay_id, p_credit_entry_id, (v_item->>'debit_entry_id')::uuid, v_amount, p_actor_id);
      v_allocated := v_allocated + v_amount;
    end loop;
  else
    for v_debit in
      select entry.id, entry.amount - coalesce(sum(allocation.amount), 0) as open_amount
      from public.stay_folio_entries entry
      left join public.stay_folio_allocations allocation on allocation.debit_entry_id = entry.id
      where entry.hotel_id = p_hotel_id and entry.stay_id = p_stay_id and entry.direction = 'debit'
      group by entry.id, entry.amount, entry.posted_at
      having entry.amount - coalesce(sum(allocation.amount), 0) > 0
      order by entry.posted_at, entry.id
    loop
      exit when v_allocated >= v_credit;
      v_amount := least(v_debit.open_amount, v_credit - v_allocated);
      insert into public.stay_folio_allocations(hotel_id, stay_id, credit_entry_id, debit_entry_id, amount, created_by)
      values (p_hotel_id, p_stay_id, p_credit_entry_id, v_debit.id, v_amount, p_actor_id);
      v_allocated := v_allocated + v_amount;
    end loop;
  end if;
  return v_allocated;
end;
$$;

create or replace function public.create_stay_folio_payment(
  p_hotel_id uuid, p_stay_id uuid, p_actor_id uuid, p_amount numeric, p_method text,
  p_note text default null, p_paid_at timestamptz default now(), p_allocations jsonb default null,
  p_maintenance_recovery_id uuid default null
)
returns uuid language plpgsql set search_path = public as $$
declare
  v_reservation_id uuid;
  v_currency text;
  v_transaction_id uuid;
  v_entry_id uuid;
begin
  select s.reservation_id, h.currency into v_reservation_id, v_currency
  from public.stays s join public.reservations r on r.id = s.reservation_id
  join public.hotels h on h.id = r.hotel_id
  where s.id = p_stay_id and r.hotel_id = p_hotel_id for update of s;
  if not found then return null; end if;
  if p_amount <= 0 or nullif(btrim(p_method), '') is null then raise exception 'invalid payment' using errcode = '23514'; end if;
  insert into public.financial_transactions(
    hotel_id, type, category, amount, currency, description, status, stay_id, reservation_id,
    payment_method, paid_at, created_by, maintenance_recovery_id
  ) values (
    p_hotel_id, 'INCOME', case when p_maintenance_recovery_id is null then 'STAY_PAYMENT' else 'DAMAGE_RECOVERY' end,
    p_amount, v_currency, nullif(btrim(p_note), ''), 'COMPLETED', p_stay_id, v_reservation_id,
    btrim(p_method), coalesce(p_paid_at, now()), p_actor_id, p_maintenance_recovery_id
  ) returning id into v_transaction_id;
  insert into public.stay_folio_entries(
    hotel_id, stay_id, reservation_id, direction, kind, amount, currency, description,
    financial_transaction_id, source_key, posted_by, posted_at
  ) values (
    p_hotel_id, p_stay_id, v_reservation_id, 'credit', 'payment', p_amount, v_currency,
    coalesce(nullif(btrim(p_note), ''), 'Pagamento da estadia'), v_transaction_id,
    'payment:' || v_transaction_id::text, p_actor_id, coalesce(p_paid_at, now())
  ) returning id into v_entry_id;
  perform public.allocate_stay_folio_credit(p_hotel_id, p_stay_id, v_entry_id, p_actor_id, p_allocations);
  update public.stays set total_paid = (
    select coalesce(sum(case when direction = 'credit' then amount else -amount end), 0)
    from public.stay_folio_entries where stay_id = p_stay_id and kind in ('payment', 'refund', 'adjustment')
  ) where id = p_stay_id;
  return v_transaction_id;
end;
$$;

create or replace function public.transition_maintenance_cost_item(
  p_hotel_id uuid, p_cost_item_id uuid, p_actor_id uuid, p_action text, p_reason text default null
)
returns uuid language plpgsql set search_path = public as $$
declare v_item public.maintenance_cost_items%rowtype;
begin
  select * into v_item from public.maintenance_cost_items where id = p_cost_item_id and hotel_id = p_hotel_id for update;
  if not found then return null; end if;
  if p_action = 'submit' and v_item.approval_status in ('draft', 'rejected') and v_item.actual_amount is not null then
    update public.maintenance_cost_items set approval_status = 'submitted', submitted_at = now(),
      rejected_by = null, rejected_at = null, decision_reason = null where id = p_cost_item_id;
  elsif p_action = 'approve' and v_item.approval_status = 'submitted' and v_item.created_by <> p_actor_id then
    update public.maintenance_cost_items set approval_status = 'approved', settlement_status = 'open',
      approved_by = p_actor_id, approved_at = now(), decision_reason = null where id = p_cost_item_id;
  elsif p_action = 'reject' and v_item.approval_status = 'submitted' and nullif(btrim(p_reason), '') is not null then
    update public.maintenance_cost_items set approval_status = 'rejected', rejected_by = p_actor_id,
      rejected_at = now(), decision_reason = btrim(p_reason) where id = p_cost_item_id;
  elsif p_action = 'cancel' and v_item.approval_status in ('draft', 'submitted', 'rejected', 'approved')
    and v_item.settlement_status in ('not_posted', 'open')
    and not exists (select 1 from public.maintenance_financial_settlements where cost_item_id = p_cost_item_id) then
    update public.maintenance_cost_items set approval_status = 'canceled', settlement_status = 'not_posted',
      canceled_by = p_actor_id, canceled_at = now(), decision_reason = nullif(btrim(p_reason), '') where id = p_cost_item_id;
  else raise exception 'invalid maintenance cost transition' using errcode = '23514'; end if;
  insert into public.maintenance_events(hotel_id, occurrence_id, work_order_id, actor_id, event_type, message, metadata)
  values (p_hotel_id, v_item.occurrence_id, v_item.work_order_id, p_actor_id, 'finance_cost_' || p_action,
    nullif(btrim(p_reason), ''), jsonb_build_object('cost_item_id', p_cost_item_id));
  return v_item.occurrence_id;
end;
$$;

create or replace function public.settle_maintenance_cost_item(
  p_hotel_id uuid, p_cost_item_id uuid, p_actor_id uuid, p_amount numeric,
  p_method text, p_paid_at timestamptz default now(), p_reference_code text default null, p_note text default null
)
returns uuid language plpgsql set search_path = public as $$
declare
  v_item public.maintenance_cost_items%rowtype;
  v_paid numeric(12,2);
  v_transaction_id uuid;
begin
  select * into v_item from public.maintenance_cost_items where id = p_cost_item_id and hotel_id = p_hotel_id for update;
  if not found then return null; end if;
  select coalesce(sum(case when reversal_of_id is null then amount else -amount end), 0)
    into v_paid from public.maintenance_financial_settlements where cost_item_id = p_cost_item_id;
  if v_item.approval_status <> 'approved' or p_amount <= 0 or v_paid + p_amount > v_item.actual_amount
    or nullif(btrim(p_method), '') is null then raise exception 'invalid maintenance cost settlement' using errcode = '23514'; end if;
  insert into public.financial_transactions(
    hotel_id, type, category, amount, currency, description, status, payment_method, paid_at,
    due_date, counterparty, reference_code, created_by, maintenance_cost_item_id
  ) values (
    p_hotel_id, 'EXPENSE', 'MAINTENANCE', p_amount, v_item.currency, coalesce(nullif(btrim(p_note), ''), v_item.description),
    'COMPLETED', btrim(p_method), coalesce(p_paid_at, now()), v_item.due_date, v_item.counterparty,
    coalesce(nullif(btrim(p_reference_code), ''), v_item.reference_code), p_actor_id, p_cost_item_id
  ) returning id into v_transaction_id;
  insert into public.maintenance_financial_settlements(hotel_id, cost_item_id, financial_transaction_id, amount, created_by)
  values (p_hotel_id, p_cost_item_id, v_transaction_id, p_amount, p_actor_id);
  update public.maintenance_cost_items set settlement_status = case
    when v_paid + p_amount = actual_amount then 'settled'::public.maintenance_finance_settlement_status
    else 'partially_settled'::public.maintenance_finance_settlement_status end
  where id = p_cost_item_id;
  insert into public.maintenance_events(hotel_id, occurrence_id, work_order_id, actor_id, event_type, message, metadata)
  values (p_hotel_id, v_item.occurrence_id, v_item.work_order_id, p_actor_id, 'finance_cost_settled', nullif(btrim(p_note), ''),
    jsonb_build_object('cost_item_id', p_cost_item_id, 'transaction_id', v_transaction_id, 'amount', p_amount));
  return v_item.occurrence_id;
end;
$$;

create or replace function public.transition_maintenance_recovery(
  p_hotel_id uuid, p_recovery_id uuid, p_actor_id uuid, p_action text, p_reason text default null
)
returns uuid language plpgsql set search_path = public as $$
declare
  v_item public.maintenance_recoveries%rowtype;
  v_occurrence public.maintenance_occurrences%rowtype;
  v_cost_total numeric(12,2);
  v_recovery_total numeric(12,2);
  v_reservation_id uuid;
  v_entry_id uuid;
begin
  select * into v_item from public.maintenance_recoveries where id = p_recovery_id and hotel_id = p_hotel_id for update;
  if not found then return null; end if;
  select * into v_occurrence from public.maintenance_occurrences where id = v_item.occurrence_id for update;
  if p_action = 'submit' and v_item.approval_status in ('draft', 'rejected') then
    if v_occurrence.liability_status <> 'confirmed' or v_occurrence.confirmed_party is distinct from v_item.responsible_party then
      raise exception 'recovery requires matching confirmed liability' using errcode = '23514';
    end if;
    update public.maintenance_recoveries set approval_status = 'submitted', submitted_at = now(),
      rejected_by = null, rejected_at = null, decision_reason = null where id = p_recovery_id;
  elsif p_action = 'approve' and v_item.approval_status = 'submitted' and v_item.created_by <> p_actor_id then
    select coalesce(sum(actual_amount), 0) into v_cost_total from public.maintenance_cost_items
    where occurrence_id = v_item.occurrence_id and approval_status = 'approved';
    select coalesce(sum(charge_amount + waived_amount), 0) into v_recovery_total from public.maintenance_recoveries
    where occurrence_id = v_item.occurrence_id and approval_status = 'approved' and id <> p_recovery_id;
    if v_recovery_total + v_item.charge_amount + v_item.waived_amount > v_cost_total then
      raise exception 'recovery exceeds approved actual cost' using errcode = '23514';
    end if;
    if v_item.charge_amount > 0 and v_item.responsible_party = 'guest' then
      select reservation_id into v_reservation_id from public.stays where id = v_item.stay_id;
      insert into public.stay_folio_entries(
        hotel_id, stay_id, reservation_id, direction, kind, amount, currency, description,
        maintenance_occurrence_id, source_key, posted_by
      ) values (
        p_hotel_id, v_item.stay_id, v_reservation_id, 'debit', 'maintenance_charge', v_item.charge_amount,
        v_item.currency, v_item.justification, v_item.occurrence_id, 'maintenance-recovery:' || v_item.id::text, p_actor_id
      ) returning id into v_entry_id;
    end if;
    update public.maintenance_recoveries set approval_status = 'approved',
      settlement_status = case when charge_amount > 0 then 'open'::public.maintenance_finance_settlement_status else 'settled'::public.maintenance_finance_settlement_status end,
      approved_by = p_actor_id, approved_at = now(), folio_entry_id = v_entry_id, decision_reason = null
    where id = p_recovery_id;
  elsif p_action = 'reject' and v_item.approval_status = 'submitted' and nullif(btrim(p_reason), '') is not null then
    update public.maintenance_recoveries set approval_status = 'rejected', rejected_by = p_actor_id,
      rejected_at = now(), decision_reason = btrim(p_reason) where id = p_recovery_id;
  elsif p_action = 'cancel' and v_item.approval_status in ('draft', 'submitted', 'rejected') then
    update public.maintenance_recoveries set approval_status = 'canceled', canceled_by = p_actor_id,
      canceled_at = now(), decision_reason = nullif(btrim(p_reason), '') where id = p_recovery_id;
  else raise exception 'invalid maintenance recovery transition' using errcode = '23514'; end if;
  insert into public.maintenance_events(hotel_id, occurrence_id, actor_id, event_type, message, metadata)
  values (p_hotel_id, v_item.occurrence_id, p_actor_id, 'finance_recovery_' || p_action,
    nullif(btrim(p_reason), ''), jsonb_build_object('recovery_id', p_recovery_id));
  return v_item.occurrence_id;
end;
$$;

create or replace function public.settle_maintenance_recovery(
  p_hotel_id uuid, p_recovery_id uuid, p_actor_id uuid, p_amount numeric,
  p_method text, p_paid_at timestamptz default now(), p_reference_code text default null,
  p_note text default null, p_allocations jsonb default null
)
returns uuid language plpgsql set search_path = public as $$
declare
  v_item public.maintenance_recoveries%rowtype;
  v_received numeric(12,2);
  v_transaction_id uuid;
begin
  select * into v_item from public.maintenance_recoveries where id = p_recovery_id and hotel_id = p_hotel_id for update;
  if not found then return null; end if;
  select coalesce(sum(case when reversal_of_id is null then amount else -amount end), 0)
    into v_received from public.maintenance_financial_settlements where recovery_id = p_recovery_id;
  if v_item.approval_status <> 'approved' or p_amount <= 0 or v_received + p_amount > v_item.charge_amount
    or nullif(btrim(p_method), '') is null then raise exception 'invalid maintenance recovery settlement' using errcode = '23514'; end if;
  if v_item.responsible_party = 'guest' then
    v_transaction_id := public.create_stay_folio_payment(p_hotel_id, v_item.stay_id, p_actor_id, p_amount, p_method,
      p_note, p_paid_at, coalesce(p_allocations, jsonb_build_array(jsonb_build_object('debit_entry_id', v_item.folio_entry_id, 'amount', p_amount))), p_recovery_id);
  else
    insert into public.financial_transactions(
      hotel_id, type, category, amount, currency, description, status, payment_method, paid_at,
      counterparty, reference_code, created_by, maintenance_recovery_id
    ) values (
      p_hotel_id, 'INCOME', 'DAMAGE_RECOVERY', p_amount, v_item.currency, coalesce(nullif(btrim(p_note), ''), v_item.justification),
      'COMPLETED', btrim(p_method), coalesce(p_paid_at, now()), v_item.debtor_name,
      nullif(btrim(p_reference_code), ''), p_actor_id, p_recovery_id
    ) returning id into v_transaction_id;
  end if;
  insert into public.maintenance_financial_settlements(hotel_id, recovery_id, financial_transaction_id, amount, created_by)
  values (p_hotel_id, p_recovery_id, v_transaction_id, p_amount, p_actor_id);
  update public.maintenance_recoveries set settlement_status = case
    when v_received + p_amount = charge_amount then 'settled'::public.maintenance_finance_settlement_status
    else 'partially_settled'::public.maintenance_finance_settlement_status end
  where id = p_recovery_id;
  insert into public.maintenance_events(hotel_id, occurrence_id, actor_id, event_type, message, metadata)
  values (p_hotel_id, v_item.occurrence_id, p_actor_id, 'finance_recovery_settled', nullif(btrim(p_note), ''),
    jsonb_build_object('recovery_id', p_recovery_id, 'transaction_id', v_transaction_id, 'amount', p_amount));
  return v_item.occurrence_id;
end;
$$;

create or replace function public.reverse_maintenance_financial_settlement(
  p_hotel_id uuid, p_settlement_id uuid, p_actor_id uuid, p_reason text,
  p_reversed_at timestamptz default now()
)
returns uuid language plpgsql set search_path = public as $$
declare
  v_settlement public.maintenance_financial_settlements%rowtype;
  v_original public.financial_transactions%rowtype;
  v_occurrence_id uuid;
  v_work_order_id uuid;
  v_transaction_id uuid;
  v_stay_id uuid;
  v_reservation_id uuid;
  v_original_entry_id uuid;
  v_net numeric(12,2);
  v_target_amount numeric(12,2);
begin
  if nullif(btrim(p_reason), '') is null then
    raise exception 'settlement reversal requires reason' using errcode = '23514';
  end if;
  select * into v_settlement from public.maintenance_financial_settlements
  where id = p_settlement_id and hotel_id = p_hotel_id for update;
  if not found then return null; end if;
  if v_settlement.reversal_of_id is not null or exists (
    select 1 from public.maintenance_financial_settlements where reversal_of_id = p_settlement_id
  ) then raise exception 'settlement already reversed' using errcode = '23514'; end if;
  select * into v_original from public.financial_transactions
  where id = v_settlement.financial_transaction_id for update;

  if v_settlement.cost_item_id is not null then
    select occurrence_id, work_order_id, actual_amount into v_occurrence_id, v_work_order_id, v_target_amount
    from public.maintenance_cost_items where id = v_settlement.cost_item_id;
  else
    select occurrence_id, stay_id, charge_amount into v_occurrence_id, v_stay_id, v_target_amount
    from public.maintenance_recoveries where id = v_settlement.recovery_id;
  end if;

  insert into public.financial_transactions(
    hotel_id, type, category, amount, currency, description, status, stay_id,
    reservation_id, payment_method, paid_at, counterparty, reference_code,
    created_by, maintenance_cost_item_id, maintenance_recovery_id
  ) values (
    p_hotel_id, 'REFUND', 'MAINTENANCE_REVERSAL', v_settlement.amount,
    v_original.currency, btrim(p_reason), 'COMPLETED', v_original.stay_id,
    v_original.reservation_id, v_original.payment_method, coalesce(p_reversed_at, now()),
    v_original.counterparty, 'REV-' || v_original.id::text, p_actor_id,
    v_settlement.cost_item_id, v_settlement.recovery_id
  ) returning id into v_transaction_id;

  insert into public.maintenance_financial_settlements(
    hotel_id, cost_item_id, recovery_id, financial_transaction_id, amount,
    created_by, reversal_of_id
  ) values (
    p_hotel_id, v_settlement.cost_item_id, v_settlement.recovery_id,
    v_transaction_id, v_settlement.amount, p_actor_id, p_settlement_id
  );

  if v_stay_id is not null then
    select reservation_id into v_reservation_id from public.stays where id = v_stay_id;
    select id into v_original_entry_id from public.stay_folio_entries
    where financial_transaction_id = v_original.id;
    insert into public.stay_folio_entries(
      hotel_id, stay_id, reservation_id, direction, kind, amount, currency,
      description, maintenance_occurrence_id, financial_transaction_id,
      reversed_entry_id, source_key, posted_by
    ) values (
      p_hotel_id, v_stay_id, v_reservation_id, 'debit', 'refund',
      v_settlement.amount, v_original.currency, btrim(p_reason), v_occurrence_id,
      v_transaction_id, v_original_entry_id,
      'maintenance-settlement-reversal:' || p_settlement_id::text, p_actor_id
    );
    update public.stays set total_paid = greatest(total_paid - v_settlement.amount, 0)
    where id = v_stay_id;
  end if;

  select coalesce(sum(case when reversal_of_id is null then amount else -amount end), 0)
    into v_net from public.maintenance_financial_settlements
    where (v_settlement.cost_item_id is not null and cost_item_id = v_settlement.cost_item_id)
       or (v_settlement.recovery_id is not null and recovery_id = v_settlement.recovery_id);
  if v_settlement.cost_item_id is not null then
    update public.maintenance_cost_items set settlement_status = case
      when v_net <= 0 then 'open'::public.maintenance_finance_settlement_status
      when v_net < v_target_amount then 'partially_settled'::public.maintenance_finance_settlement_status
      else 'settled'::public.maintenance_finance_settlement_status end
    where id = v_settlement.cost_item_id;
  else
    update public.maintenance_recoveries set settlement_status = case
      when v_net <= 0 then 'open'::public.maintenance_finance_settlement_status
      when v_net < v_target_amount then 'partially_settled'::public.maintenance_finance_settlement_status
      else 'settled'::public.maintenance_finance_settlement_status end
    where id = v_settlement.recovery_id;
  end if;
  insert into public.maintenance_events(
    hotel_id, occurrence_id, work_order_id, actor_id, event_type, message, metadata
  ) values (
    p_hotel_id, v_occurrence_id, v_work_order_id, p_actor_id,
    'finance_settlement_reversed', btrim(p_reason),
    jsonb_build_object('settlement_id', p_settlement_id, 'transaction_id', v_transaction_id, 'amount', v_settlement.amount)
  );
  return v_occurrence_id;
end;
$$;

create or replace function public.checkout_stay_with_financial_acknowledgements(
  p_hotel_id uuid, p_stay_id uuid, p_actor_id uuid,
  p_occurrence_ids uuid[] default array[]::uuid[], p_folio_entry_ids uuid[] default array[]::uuid[], p_note text default null
)
returns boolean language plpgsql set search_path = public as $$
declare v_checked_out boolean;
begin
  if exists (
    select 1 from public.stay_folio_entries entry
    where entry.hotel_id = p_hotel_id and entry.stay_id = p_stay_id
      and entry.kind = 'maintenance_charge' and entry.direction = 'debit'
      and entry.amount > coalesce((select sum(amount) from public.stay_folio_allocations where debit_entry_id = entry.id), 0)
      and entry.id <> all(coalesce(p_folio_entry_ids, array[]::uuid[]))
      and not exists (select 1 from public.maintenance_financial_checkout_acknowledgements acknowledgement
        where acknowledgement.stay_id = p_stay_id and acknowledgement.folio_entry_id = entry.id)
  ) then raise exception 'Há cobranças de manutenção pendentes sem ciência.' using errcode = '23514'; end if;
  if exists (
    select 1 from unnest(coalesce(p_folio_entry_ids, array[]::uuid[])) entry_id
    where not exists (select 1 from public.stay_folio_entries entry
      where entry.id = entry_id and entry.hotel_id = p_hotel_id and entry.stay_id = p_stay_id
        and entry.kind = 'maintenance_charge' and entry.direction = 'debit')
  ) then raise exception 'A ciência financeira contém uma cobrança inválida.' using errcode = '23514'; end if;
  insert into public.maintenance_financial_checkout_acknowledgements(hotel_id, stay_id, folio_entry_id, acknowledged_by, note)
  select p_hotel_id, p_stay_id, entry.id, p_actor_id, nullif(btrim(p_note), '')
  from public.stay_folio_entries entry where entry.id = any(coalesce(p_folio_entry_ids, array[]::uuid[]))
  on conflict (stay_id, folio_entry_id) do nothing;
  select public.checkout_stay_with_maintenance_acknowledgements(
    p_hotel_id, p_stay_id, p_actor_id, p_occurrence_ids, p_note
  ) into v_checked_out;
  return v_checked_out;
end;
$$;

-- Backfill the operational ledger without changing legacy visible balances.
insert into public.stay_folio_entries(
  hotel_id, stay_id, reservation_id, direction, kind, amount, currency, description, source_key, posted_at
)
select reservation.hotel_id, stay.id, stay.reservation_id, 'debit', 'lodging', stay.total_price_estimated,
  hotel.currency, 'Hospedagem ' || coalesce(reservation.reservation_code, reservation.id::text),
  'legacy-lodging:' || stay.id::text, stay.created_at
from public.stays stay
join public.reservations reservation on reservation.id = stay.reservation_id
join public.hotels hotel on hotel.id = reservation.hotel_id
where stay.total_price_estimated > 0
on conflict (hotel_id, source_key) do nothing;

insert into public.stay_folio_entries(
  hotel_id, stay_id, reservation_id, direction, kind, amount, currency, description,
  financial_transaction_id, source_key, posted_by, posted_at
)
select transaction.hotel_id, transaction.stay_id, transaction.reservation_id,
  case when transaction.type = 'REFUND' then 'debit'::public.stay_folio_direction else 'credit'::public.stay_folio_direction end,
  case when transaction.type = 'REFUND' then 'refund'::public.stay_folio_kind else 'payment'::public.stay_folio_kind end,
  transaction.amount, transaction.currency, coalesce(transaction.description, 'Pagamento legado'), transaction.id,
  'legacy-payment:' || transaction.id::text, transaction.created_by, coalesce(transaction.paid_at, transaction.created_at)
from public.financial_transactions transaction
where transaction.stay_id is not null and transaction.reservation_id is not null
  and transaction.category = 'STAY_PAYMENT' and transaction.status in ('COMPLETED', 'REFUNDED')
  and transaction.type in ('INCOME', 'REFUND')
on conflict (hotel_id, source_key) do nothing;

with payment_totals as (
  select stay.id as stay_id, reservation.id as reservation_id, reservation.hotel_id, hotel.currency,
    stay.total_paid,
    coalesce(sum(case when transaction.type = 'REFUND' then -transaction.amount else transaction.amount end), 0) as transaction_total
  from public.stays stay
  join public.reservations reservation on reservation.id = stay.reservation_id
  join public.hotels hotel on hotel.id = reservation.hotel_id
  left join public.financial_transactions transaction on transaction.stay_id = stay.id
    and transaction.category = 'STAY_PAYMENT' and transaction.status in ('COMPLETED', 'REFUNDED')
    and transaction.type in ('INCOME', 'REFUND')
  group by stay.id, reservation.id, reservation.hotel_id, hotel.currency, stay.total_paid
)
insert into public.stay_folio_entries(
  hotel_id, stay_id, reservation_id, direction, kind, amount, currency, description, source_key
)
select hotel_id, stay_id, reservation_id,
  case when total_paid > transaction_total then 'credit'::public.stay_folio_direction else 'debit'::public.stay_folio_direction end,
  'adjustment', abs(total_paid - transaction_total), currency, 'Ajuste técnico de migração do saldo legado',
  'legacy-balance-adjustment:' || stay_id::text
from payment_totals where total_paid <> transaction_total
on conflict (hotel_id, source_key) do nothing;

with ranked_credits as (
  select credit.*,
    coalesce(sum(credit.amount) over (
      partition by credit.stay_id order by credit.posted_at, credit.id rows between unbounded preceding and 1 preceding
    ), 0) as previously_credited
  from public.stay_folio_entries credit
  where credit.kind = 'payment' and credit.direction = 'credit'
), allocations as (
  select credit.hotel_id, credit.stay_id, credit.id as credit_entry_id, debit.id as debit_entry_id,
    least(credit.amount, greatest(debit.amount - credit.previously_credited, 0)) as amount
  from ranked_credits credit
  join public.stay_folio_entries debit on debit.stay_id = credit.stay_id and debit.kind = 'lodging' and debit.direction = 'debit'
)
insert into public.stay_folio_allocations(hotel_id, stay_id, credit_entry_id, debit_entry_id, amount)
select hotel_id, stay_id, credit_entry_id, debit_entry_id, amount from allocations where amount > 0
on conflict (credit_entry_id, debit_entry_id) do nothing;

create or replace function public.create_stay_lodging_folio_entry()
returns trigger language plpgsql set search_path = public as $$
declare
  v_hotel_id uuid;
  v_currency text;
  v_difference numeric(12,2);
begin
  select reservation.hotel_id, hotel.currency into v_hotel_id, v_currency
  from public.reservations reservation join public.hotels hotel on hotel.id = reservation.hotel_id
  where reservation.id = new.reservation_id;
  if tg_op = 'INSERT' and new.total_price_estimated > 0 then
    insert into public.stay_folio_entries(
      hotel_id, stay_id, reservation_id, direction, kind, amount, currency, description, source_key
    ) values (
      v_hotel_id, new.id, new.reservation_id, 'debit', 'lodging', new.total_price_estimated, v_currency,
      'Hospedagem da estadia', 'lodging:' || new.id::text
    ) on conflict (hotel_id, source_key) do nothing;
  elsif tg_op = 'UPDATE' and new.total_price_estimated is distinct from old.total_price_estimated then
    v_difference := new.total_price_estimated - old.total_price_estimated;
    if v_difference <> 0 then
      insert into public.stay_folio_entries(
        hotel_id, stay_id, reservation_id, direction, kind, amount, currency, description, source_key
      ) values (
        v_hotel_id, new.id, new.reservation_id,
        case when v_difference > 0 then 'debit'::public.stay_folio_direction else 'credit'::public.stay_folio_direction end,
        'adjustment', abs(v_difference), v_currency, 'Ajuste do valor da hospedagem',
        'lodging-adjustment:' || new.id::text || ':' || gen_random_uuid()::text
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_stays_create_lodging_folio after insert or update of total_price_estimated on public.stays
  for each row execute function public.create_stay_lodging_folio_entry();

create or replace function public.backfill_stay_folio()
returns void language plpgsql set search_path = public as $$
begin
  insert into public.stay_folio_entries(
    hotel_id, stay_id, reservation_id, direction, kind, amount, currency, description,
    financial_transaction_id, source_key, posted_by, posted_at
  )
  select transaction.hotel_id, transaction.stay_id, transaction.reservation_id,
    case when transaction.type = 'REFUND' then 'debit'::public.stay_folio_direction else 'credit'::public.stay_folio_direction end,
    case when transaction.type = 'REFUND' then 'refund'::public.stay_folio_kind else 'payment'::public.stay_folio_kind end,
    transaction.amount, transaction.currency, coalesce(transaction.description, 'Pagamento legado'), transaction.id,
    'legacy-payment:' || transaction.id::text, transaction.created_by, coalesce(transaction.paid_at, transaction.created_at)
  from public.financial_transactions transaction
  where transaction.stay_id is not null and transaction.reservation_id is not null
    and transaction.category = 'STAY_PAYMENT' and transaction.status in ('COMPLETED', 'REFUNDED')
    and transaction.type in ('INCOME', 'REFUND')
  on conflict (hotel_id, source_key) do nothing;

  with payment_totals as (
    select stay.id as stay_id, reservation.id as reservation_id, reservation.hotel_id, hotel.currency,
      stay.total_paid,
      coalesce(sum(case when transaction.type = 'REFUND' then -transaction.amount else transaction.amount end), 0) as transaction_total
    from public.stays stay
    join public.reservations reservation on reservation.id = stay.reservation_id
    join public.hotels hotel on hotel.id = reservation.hotel_id
    left join public.financial_transactions transaction on transaction.stay_id = stay.id
      and transaction.category = 'STAY_PAYMENT' and transaction.status in ('COMPLETED', 'REFUNDED')
      and transaction.type in ('INCOME', 'REFUND')
    group by stay.id, reservation.id, reservation.hotel_id, hotel.currency, stay.total_paid
  )
  insert into public.stay_folio_entries(
    hotel_id, stay_id, reservation_id, direction, kind, amount, currency, description, source_key
  )
  select hotel_id, stay_id, reservation_id,
    case when total_paid > transaction_total then 'credit'::public.stay_folio_direction else 'debit'::public.stay_folio_direction end,
    'adjustment', abs(total_paid - transaction_total), currency, 'Ajuste técnico de migração do saldo legado',
    'legacy-balance-adjustment:' || stay_id::text
  from payment_totals where total_paid <> transaction_total
  on conflict (hotel_id, source_key) do nothing;

  with ranked_credits as (
    select credit.*,
      coalesce(sum(credit.amount) over (
        partition by credit.stay_id order by credit.posted_at, credit.id rows between unbounded preceding and 1 preceding
      ), 0) as previously_credited
    from public.stay_folio_entries credit
    where credit.kind = 'payment' and credit.direction = 'credit'
  ), allocations as (
    select credit.hotel_id, credit.stay_id, credit.id as credit_entry_id, debit.id as debit_entry_id,
      least(credit.amount, greatest(debit.amount - credit.previously_credited, 0)) as amount
    from ranked_credits credit
    join public.stay_folio_entries debit on debit.stay_id = credit.stay_id and debit.kind = 'lodging' and debit.direction = 'debit'
  )
  insert into public.stay_folio_allocations(hotel_id, stay_id, credit_entry_id, debit_entry_id, amount)
  select hotel_id, stay_id, credit_entry_id, debit_entry_id, amount from allocations where amount > 0
  on conflict (credit_entry_id, debit_entry_id) do nothing;
end;
$$;

select public.backfill_stay_folio();

alter table public.stay_folio_entries enable row level security;
alter table public.stay_folio_allocations enable row level security;
alter table public.maintenance_cost_items enable row level security;
alter table public.maintenance_recoveries enable row level security;
alter table public.maintenance_financial_settlements enable row level security;
alter table public.maintenance_financial_attachments enable row level security;
alter table public.maintenance_financial_checkout_acknowledgements enable row level security;

grant usage on type public.stay_folio_direction, public.stay_folio_kind, public.maintenance_cost_kind,
  public.maintenance_finance_approval_status, public.maintenance_finance_settlement_status to postgres, service_role;
grant select, insert, update on public.maintenance_cost_items, public.maintenance_recoveries,
  public.maintenance_financial_attachments to postgres, service_role;
grant select, insert on public.stay_folio_entries, public.stay_folio_allocations,
  public.maintenance_financial_settlements, public.maintenance_financial_checkout_acknowledgements to postgres, service_role;
grant execute on function public.allocate_stay_folio_credit(uuid, uuid, uuid, uuid, jsonb),
  public.backfill_stay_folio(),
  public.create_stay_folio_payment(uuid, uuid, uuid, numeric, text, text, timestamptz, jsonb, uuid),
  public.transition_maintenance_cost_item(uuid, uuid, uuid, text, text),
  public.settle_maintenance_cost_item(uuid, uuid, uuid, numeric, text, timestamptz, text, text),
  public.transition_maintenance_recovery(uuid, uuid, uuid, text, text),
  public.settle_maintenance_recovery(uuid, uuid, uuid, numeric, text, timestamptz, text, text, jsonb),
  public.reverse_maintenance_financial_settlement(uuid, uuid, uuid, text, timestamptz),
  public.checkout_stay_with_financial_acknowledgements(uuid, uuid, uuid, uuid[], uuid[], text)
  to postgres, service_role;

insert into public.permissions(name, type)
select name, 'HOTEL_PERMISSION'
from unnest(array[
  'read_maintenance_finance', 'propose_maintenance_finance',
  'approve_maintenance_finance', 'settle_maintenance_finance'
]) as name
on conflict (name) do nothing;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'maintenance-financial-documents', 'maintenance-financial-documents', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
