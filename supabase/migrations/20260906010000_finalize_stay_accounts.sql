create type public.stay_payment_batch_kind as enum ('regular', 'checkout', 'legacy');
create type public.consumption_correction_kind as enum ('partial_adjustment', 'full_void');
create type public.consumption_correction_status as enum (
  'pending', 'approved', 'rejected', 'awaiting_refund', 'awaiting_partner_refund', 'completed'
);
create type public.stay_checkout_record_kind as enum ('operational', 'legacy');

alter table public.stays add column account_version bigint not null default 0;
alter table public.stays add constraint stays_account_version_check check (account_version >= 0);
alter table public.stays add constraint stays_id_unique unique (id);
alter table public.stay_folio_entries add constraint stay_folio_entries_id_hotel_unique unique (id, hotel_id);
alter table public.financial_transactions add constraint financial_transactions_id_hotel_unique unique (id, hotel_id);
alter table public.consumption_order_items add constraint consumption_order_items_id_hotel_unique unique (id, hotel_id);

create table public.stay_payment_batches (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  stay_id uuid not null references public.stays(id) on delete restrict,
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  kind public.stay_payment_batch_kind not null default 'regular',
  amount numeric(12,2) not null,
  currency text not null,
  note text,
  idempotency_key uuid,
  request_fingerprint text,
  created_by uuid references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint stay_payment_batches_id_hotel_unique unique (id, hotel_id),
  constraint stay_payment_batches_amount_check check (amount > 0),
  constraint stay_payment_batches_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint stay_payment_batches_note_check check (note is null or length(btrim(note)) between 1 and 1000),
  constraint stay_payment_batches_idempotency_shape_check check (
    (idempotency_key is null and request_fingerprint is null) or
    (idempotency_key is not null and request_fingerprint is not null)
  ),
  constraint stay_payment_batches_stay_reservation_fkey foreign key (stay_id, reservation_id)
    references public.stays(id, reservation_id) on delete restrict,
  constraint stay_payment_batches_reservation_hotel_fkey foreign key (reservation_id, hotel_id)
    references public.reservations(id, hotel_id) on delete restrict
);
create unique index stay_payment_batches_hotel_idempotency_unique
  on public.stay_payment_batches(hotel_id, idempotency_key) where idempotency_key is not null;
create index stay_payment_batches_stay_idx on public.stay_payment_batches(hotel_id, stay_id, created_at desc);

create table public.stay_payment_batch_tenders (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  batch_id uuid not null,
  payment_method public.consumption_payment_method not null,
  amount numeric(12,2) not null,
  reference_code text,
  financial_transaction_id uuid not null,
  folio_credit_entry_id uuid not null,
  display_order integer not null,
  created_at timestamptz not null default now(),
  constraint stay_payment_batch_tenders_batch_hotel_fkey foreign key (batch_id, hotel_id)
    references public.stay_payment_batches(id, hotel_id) on delete restrict,
  constraint stay_payment_batch_tenders_transaction_hotel_fkey foreign key (financial_transaction_id, hotel_id)
    references public.financial_transactions(id, hotel_id) on delete restrict,
  constraint stay_payment_batch_tenders_folio_hotel_fkey foreign key (folio_credit_entry_id, hotel_id)
    references public.stay_folio_entries(id, hotel_id) on delete restrict,
  constraint stay_payment_batch_tenders_amount_check check (amount > 0),
  constraint stay_payment_batch_tenders_reference_check check (
    reference_code is null or length(btrim(reference_code)) between 1 and 200
  ),
  constraint stay_payment_batch_tenders_order_check check (display_order >= 0),
  constraint stay_payment_batch_tenders_batch_order_unique unique (batch_id, display_order),
  constraint stay_payment_batch_tenders_transaction_unique unique (financial_transaction_id),
  constraint stay_payment_batch_tenders_folio_unique unique (folio_credit_entry_id)
);

create table public.consumption_corrections (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  order_id uuid not null,
  stay_id uuid,
  kind public.consumption_correction_kind not null,
  status public.consumption_correction_status not null,
  reason text not null,
  account_version bigint not null,
  gross_reduction numeric(12,2) not null,
  discount_increase numeric(12,2) not null,
  net_reduction numeric(12,2) not null,
  requested_by uuid not null references public.users(id) on delete restrict,
  requested_at timestamptz not null default now(),
  decided_by uuid references public.users(id) on delete restrict,
  decided_at timestamptz,
  decision_reason text,
  completed_by uuid references public.users(id) on delete restrict,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint consumption_corrections_id_hotel_unique unique (id, hotel_id),
  constraint consumption_corrections_order_hotel_fkey foreign key (order_id, hotel_id)
    references public.consumption_orders(id, hotel_id) on delete restrict,
  constraint consumption_corrections_amounts_check check (
    gross_reduction >= 0 and discount_increase >= 0 and net_reduction > 0
  ),
  constraint consumption_corrections_reason_check check (length(btrim(reason)) between 3 and 1000),
  constraint consumption_corrections_version_check check (account_version >= 0),
  constraint consumption_corrections_decision_check check (
    (status = 'pending' and decided_by is null and decided_at is null) or
    (status = 'completed' and decided_by = requested_by and decided_at is not null) or
    (status <> 'pending' and decided_by is not null and decided_at is not null and decided_by <> requested_by)
  ),
  constraint consumption_corrections_rejection_check check (
    status <> 'rejected' or length(btrim(decision_reason)) between 3 and 1000
  ),
  constraint consumption_corrections_completion_check check (
    status <> 'completed' or (completed_by is not null and completed_at is not null)
  )
);
create unique index consumption_corrections_one_open_per_order
  on public.consumption_corrections(order_id)
  where status in ('pending', 'approved', 'awaiting_refund', 'awaiting_partner_refund');
create index consumption_corrections_queue_idx
  on public.consumption_corrections(hotel_id, status, requested_at desc);

create table public.consumption_correction_items (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  correction_id uuid not null,
  order_item_id uuid not null,
  previous_quantity numeric(12,3) not null,
  resulting_quantity numeric(12,3) not null,
  previous_discount numeric(12,2) not null,
  additional_discount numeric(12,2) not null,
  previous_net numeric(12,2) not null,
  resulting_net numeric(12,2) not null,
  created_at timestamptz not null default now(),
  constraint consumption_correction_items_correction_hotel_fkey foreign key (correction_id, hotel_id)
    references public.consumption_corrections(id, hotel_id) on delete restrict,
  constraint consumption_correction_items_order_item_hotel_fkey foreign key (order_item_id, hotel_id)
    references public.consumption_order_items(id, hotel_id) on delete restrict,
  constraint consumption_correction_items_values_check check (
    previous_quantity > 0 and resulting_quantity >= 0 and resulting_quantity <= previous_quantity and
    previous_discount >= 0 and additional_discount >= 0 and previous_net >= 0 and
    resulting_net >= 0 and resulting_net <= previous_net
  ),
  constraint consumption_correction_items_item_unique unique (correction_id, order_item_id)
);

create table public.stay_refunds (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  stay_id uuid not null references public.stays(id) on delete restrict,
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  correction_id uuid,
  original_tender_id uuid references public.stay_payment_batch_tenders(id) on delete restrict,
  amount numeric(12,2) not null,
  currency text not null,
  payment_method public.consumption_payment_method not null,
  original_payment_method public.consumption_payment_method,
  method_override_reason text,
  reference_code text,
  reason text not null,
  financial_transaction_id uuid not null,
  folio_debit_entry_id uuid not null,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint stay_refunds_id_hotel_unique unique (id, hotel_id),
  constraint stay_refunds_correction_hotel_fkey foreign key (correction_id, hotel_id)
    references public.consumption_corrections(id, hotel_id) on delete restrict,
  constraint stay_refunds_transaction_hotel_fkey foreign key (financial_transaction_id, hotel_id)
    references public.financial_transactions(id, hotel_id) on delete restrict deferrable initially deferred,
  constraint stay_refunds_folio_hotel_fkey foreign key (folio_debit_entry_id, hotel_id)
    references public.stay_folio_entries(id, hotel_id) on delete restrict deferrable initially deferred,
  constraint stay_refunds_stay_reservation_fkey foreign key (stay_id, reservation_id)
    references public.stays(id, reservation_id) on delete restrict,
  constraint stay_refunds_reservation_hotel_fkey foreign key (reservation_id, hotel_id)
    references public.reservations(id, hotel_id) on delete restrict,
  constraint stay_refunds_amount_check check (amount > 0),
  constraint stay_refunds_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint stay_refunds_reason_check check (length(btrim(reason)) between 3 and 1000),
  constraint stay_refunds_method_override_check check (
    original_payment_method is null or payment_method = original_payment_method or
    length(btrim(method_override_reason)) between 3 and 1000
  ),
  constraint stay_refunds_hotel_idempotency_unique unique (hotel_id, idempotency_key),
  constraint stay_refunds_transaction_unique unique (financial_transaction_id),
  constraint stay_refunds_folio_unique unique (folio_debit_entry_id)
);

create table public.stay_checkout_records (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  stay_id uuid not null unique references public.stays(id) on delete restrict,
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  kind public.stay_checkout_record_kind not null,
  account_version bigint not null,
  currency text not null,
  lodging_total numeric(12,2) not null default 0,
  consumption_total numeric(12,2) not null default 0,
  maintenance_total numeric(12,2) not null default 0,
  payment_total numeric(12,2) not null default 0,
  partner_direct_total numeric(12,2) not null default 0,
  courtesy_total numeric(12,2) not null default 0,
  discount_total numeric(12,2) not null default 0,
  voided_total numeric(12,2) not null default 0,
  exception_folio_entry_ids uuid[] not null default array[]::uuid[],
  statement_snapshot jsonb not null,
  idempotency_key uuid,
  request_fingerprint text,
  checked_out_by uuid references public.users(id) on delete restrict,
  checked_out_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint stay_checkout_records_stay_reservation_fkey foreign key (stay_id, reservation_id)
    references public.stays(id, reservation_id) on delete restrict,
  constraint stay_checkout_records_reservation_hotel_fkey foreign key (reservation_id, hotel_id)
    references public.reservations(id, hotel_id) on delete restrict,
  constraint stay_checkout_records_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint stay_checkout_records_totals_check check (
    lodging_total >= 0 and consumption_total >= 0 and maintenance_total >= 0 and payment_total >= 0 and
    partner_direct_total >= 0 and courtesy_total >= 0 and discount_total >= 0 and voided_total >= 0
  ),
  constraint stay_checkout_records_idempotency_shape_check check (
    (kind = 'legacy' and idempotency_key is null and request_fingerprint is null) or
    (kind = 'operational' and idempotency_key is not null and request_fingerprint is not null)
  )
);
create unique index stay_checkout_records_hotel_idempotency_unique
  on public.stay_checkout_records(hotel_id, idempotency_key) where idempotency_key is not null;

create table public.stay_account_events (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  stay_id uuid not null references public.stays(id) on delete restrict,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  actor_id uuid references public.users(id) on delete restrict,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint stay_account_events_entity_check check (length(btrim(entity_type)) between 1 and 80),
  constraint stay_account_events_action_check check (length(btrim(action)) between 1 and 80)
);
create index stay_account_events_stay_idx on public.stay_account_events(hotel_id, stay_id, created_at desc);

create or replace function public.validate_stay_account_scope()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (
    select 1 from public.stays stay
    join public.reservations reservation on reservation.id = stay.reservation_id
    where stay.id = new.stay_id and reservation.hotel_id = new.hotel_id
  ) then raise exception 'stay account record crosses hotel scope' using errcode = '23514'; end if;
  if tg_table_name = 'consumption_corrections' and not exists (
    select 1 from public.consumption_orders orders
    where orders.id = (to_jsonb(new)->>'order_id')::uuid and orders.hotel_id = new.hotel_id and orders.stay_id = new.stay_id
  ) then raise exception 'correction order crosses stay scope' using errcode = '23514'; end if;
  return new;
end;
$$;
create trigger trg_corrections_validate_scope before insert on public.consumption_corrections
  for each row execute function public.validate_stay_account_scope();
create trigger trg_account_events_validate_scope before insert on public.stay_account_events
  for each row execute function public.validate_stay_account_scope();

alter table public.stay_folio_entries add column consumption_correction_id uuid;
alter table public.stay_folio_entries add constraint stay_folio_entries_correction_hotel_fkey
  foreign key (consumption_correction_id, hotel_id)
  references public.consumption_corrections(id, hotel_id) on delete restrict;
alter table public.financial_transactions add column stay_refund_id uuid;
alter table public.financial_transactions add constraint financial_transactions_refund_hotel_fkey
  foreign key (stay_refund_id, hotel_id) references public.stay_refunds(id, hotel_id) on delete restrict
  deferrable initially deferred;

create or replace function public.bump_stay_account_version()
returns trigger language plpgsql set search_path = public as $$
declare v_stay_id uuid; v_hotel_id uuid;
begin
  v_stay_id := new.stay_id; v_hotel_id := new.hotel_id;
  if not exists (
    select 1 from public.stays stay join public.reservations reservation on reservation.id = stay.reservation_id
    where stay.id = v_stay_id and reservation.hotel_id = v_hotel_id
  ) then raise exception 'stay account mutation crosses hotel scope' using errcode = '23514'; end if;
  update public.stays set account_version = account_version + 1 where id = v_stay_id;
  return new;
end;
$$;
create trigger trg_stay_folio_entries_bump_account after insert on public.stay_folio_entries
  for each row execute function public.bump_stay_account_version();
create trigger trg_stay_folio_allocations_bump_account after insert on public.stay_folio_allocations
  for each row execute function public.bump_stay_account_version();

update public.stays stay set account_version = 1 where exists (
  select 1 from public.stay_folio_entries entry where entry.stay_id = stay.id
);

create or replace view public.consumption_order_item_effective as
select item.*,
  coalesce(latest.resulting_quantity, item.quantity) as effective_quantity,
  coalesce(latest.previous_discount + latest.additional_discount, item.discount_amount) as effective_discount,
  coalesce(latest.resulting_net, item.net_amount) as effective_net_amount
from public.consumption_order_items item
left join lateral (
  select correction_item.* from public.consumption_correction_items correction_item
  join public.consumption_corrections correction on correction.id = correction_item.correction_id
  where correction_item.order_item_id = item.id and correction.status = 'completed'
  order by correction.completed_at desc, correction.id desc limit 1
) latest on true;

create or replace view public.consumption_order_effective as
select orders.id, orders.hotel_id, orders.stay_id, orders.billing_mode, orders.disposition,
  orders.gross_amount as original_gross_amount, orders.discount_amount as original_discount_amount,
  orders.net_amount as original_net_amount,
  coalesce(sum(items.effective_quantity * items.charged_unit_price), 0)::numeric(12,2) as effective_gross_amount,
  coalesce(sum(items.effective_discount), 0)::numeric(12,2) as effective_discount_amount,
  coalesce(sum(items.effective_net_amount), 0)::numeric(12,2) as effective_net_amount,
  case
    when orders.is_legacy then 'legacy'
    when coalesce(sum(items.effective_net_amount), 0) = 0 and exists (
      select 1 from public.consumption_corrections correction where correction.order_id = orders.id and correction.status = 'completed'
    ) then 'voided'
    when coalesce(sum(items.effective_net_amount), 0) < orders.net_amount then 'adjusted'
    when exists (select 1 from public.consumption_corrections correction where correction.order_id = orders.id and correction.status in ('pending', 'approved')) then 'correction_pending'
    when exists (select 1 from public.consumption_corrections correction where correction.order_id = orders.id and correction.status = 'awaiting_refund') then 'refund_pending'
    when exists (select 1 from public.consumption_corrections correction where correction.order_id = orders.id and correction.status = 'awaiting_partner_refund') then 'partner_refund_pending'
    else 'active'
  end as effective_status
from public.consumption_orders orders
left join public.consumption_order_item_effective items on items.order_id = orders.id
group by orders.id;

create or replace function public.allocate_stay_account_credit(
  p_hotel_id uuid, p_stay_id uuid, p_credit_entry_id uuid, p_actor_id uuid
) returns numeric language plpgsql set search_path = public as $$
declare v_credit numeric(12,2); v_credit_order_id uuid; v_allocated numeric(12,2) := 0; v_debit record; v_amount numeric(12,2);
begin
  select amount, consumption_order_id into v_credit, v_credit_order_id from public.stay_folio_entries
  where id = p_credit_entry_id and hotel_id = p_hotel_id and stay_id = p_stay_id and direction = 'credit';
  if v_credit is null then raise exception 'folio credit not found' using errcode = 'P0002'; end if;
  for v_debit in
    select entry.id, entry.amount - coalesce(sum(allocation.amount), 0) open_amount
    from public.stay_folio_entries entry
    left join public.stay_folio_allocations allocation on allocation.debit_entry_id = entry.id
    where entry.hotel_id = p_hotel_id and entry.stay_id = p_stay_id and entry.direction = 'debit'
      and entry.kind <> 'maintenance_charge'
    group by entry.id, entry.amount, entry.posted_at
    having entry.amount - coalesce(sum(allocation.amount), 0) > 0
    order by case
      when v_credit_order_id is not null and entry.consumption_order_id = v_credit_order_id then 0
      when entry.consumption_order_id is not null then 1
      else 2
    end, entry.posted_at, entry.id
  loop
    exit when v_allocated >= v_credit;
    v_amount := least(v_debit.open_amount, v_credit - v_allocated);
    insert into public.stay_folio_allocations(hotel_id, stay_id, credit_entry_id, debit_entry_id, amount, created_by)
    values (p_hotel_id, p_stay_id, p_credit_entry_id, v_debit.id, v_amount, p_actor_id);
    v_allocated := v_allocated + v_amount;
  end loop;
  return v_allocated;
end;
$$;

create or replace function public.create_stay_payment_batch(
  p_hotel_id uuid, p_stay_id uuid, p_actor_id uuid, p_tenders jsonb, p_idempotency_key uuid,
  p_expected_version bigint, p_kind public.stay_payment_batch_kind default 'regular', p_note text default null
) returns jsonb language plpgsql set search_path = public as $$
declare
  v_stay record; v_existing record; v_fingerprint text; v_total numeric(12,2) := 0; v_due numeric(12,2) := 0;
  v_open_credit numeric(12,2) := 0;
  v_tender jsonb; v_batch_id uuid := gen_random_uuid(); v_transaction_id uuid; v_credit_id uuid; v_index integer := 0;
  v_method public.consumption_payment_method; v_amount numeric(12,2); v_reference text;
begin
  if jsonb_typeof(p_tenders) <> 'array' or jsonb_array_length(p_tenders) < 1 or jsonb_array_length(p_tenders) > 10
    then return jsonb_build_object('result', 'invalid_tenders'); end if;
  v_fingerprint := md5(jsonb_build_object('stay', p_stay_id, 'tenders', p_tenders, 'kind', p_kind,
    'note', nullif(btrim(p_note), ''))::text);
  select id, request_fingerprint into v_existing from public.stay_payment_batches
    where hotel_id = p_hotel_id and idempotency_key = p_idempotency_key for update;
  if found then
    if v_existing.request_fingerprint = v_fingerprint then return jsonb_build_object('result', 'ok', 'batch_id', v_existing.id, 'created', false); end if;
    return jsonb_build_object('result', 'idempotency_conflict');
  end if;
  if not public.maintenance_user_has_hotel_scope(p_actor_id, p_hotel_id) then return jsonb_build_object('result', 'actor_outside_hotel'); end if;
  select stay.id, stay.reservation_id, stay.stay_status, stay.account_version, hotel.currency into v_stay
  from public.stays stay join public.reservations reservation on reservation.id = stay.reservation_id
  join public.hotels hotel on hotel.id = reservation.hotel_id
  where stay.id = p_stay_id and reservation.hotel_id = p_hotel_id for update of stay;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if v_stay.account_version <> p_expected_version then return jsonb_build_object('result', 'version_conflict'); end if;
  if v_stay.stay_status not in ('confirmed', 'checked_in') then return jsonb_build_object('result', 'stay_closed'); end if;
  select coalesce(sum(entry.amount - coalesce(allocated.amount, 0)), 0) into v_due
  from public.stay_folio_entries entry
  left join lateral (select sum(amount) amount from public.stay_folio_allocations where debit_entry_id = entry.id) allocated on true
  where entry.hotel_id = p_hotel_id and entry.stay_id = p_stay_id and entry.direction = 'debit'
    and entry.kind <> 'maintenance_charge' and entry.amount > coalesce(allocated.amount, 0);
  select coalesce(sum(entry.amount - coalesce(allocated.amount, 0)), 0) into v_open_credit
  from public.stay_folio_entries entry
  left join lateral (select sum(amount) amount from public.stay_folio_allocations where credit_entry_id = entry.id) allocated on true
  where entry.hotel_id = p_hotel_id and entry.stay_id = p_stay_id and entry.direction = 'credit'
    and entry.amount > coalesce(allocated.amount, 0);
  if v_open_credit > 0 then return jsonb_build_object('result', 'refundable_credit', 'amount', v_open_credit); end if;
  for v_tender in select value from jsonb_array_elements(p_tenders) loop
    begin v_method := (v_tender->>'payment_method')::public.consumption_payment_method;
    exception when invalid_text_representation then return jsonb_build_object('result', 'invalid_payment_method'); end;
    v_amount := round((v_tender->>'amount')::numeric, 2); v_reference := nullif(btrim(v_tender->>'reference_code'), '');
    if v_amount <= 0 or (v_reference is not null and length(v_reference) > 200) then return jsonb_build_object('result', 'invalid_tender'); end if;
    v_total := v_total + v_amount;
  end loop;
  if v_total > v_due then return jsonb_build_object('result', 'payment_exceeds_balance', 'balance', v_due); end if;
  if p_kind = 'checkout' and v_total <> v_due then return jsonb_build_object('result', 'checkout_payment_mismatch', 'balance', v_due); end if;
  insert into public.stay_payment_batches(id, hotel_id, stay_id, reservation_id, kind, amount, currency, note,
    idempotency_key, request_fingerprint, created_by)
  values (v_batch_id, p_hotel_id, p_stay_id, v_stay.reservation_id, p_kind, v_total, v_stay.currency,
    nullif(btrim(p_note), ''), p_idempotency_key, v_fingerprint, p_actor_id);
  for v_tender in select value from jsonb_array_elements(p_tenders) loop
    v_method := (v_tender->>'payment_method')::public.consumption_payment_method;
    v_amount := round((v_tender->>'amount')::numeric, 2); v_reference := nullif(btrim(v_tender->>'reference_code'), '');
    insert into public.financial_transactions(hotel_id, type, category, amount, currency, description, status,
      stay_id, reservation_id, payment_method, paid_at, created_by, reference_code)
    values (p_hotel_id, 'INCOME', 'STAY_PAYMENT', v_amount, v_stay.currency,
      coalesce(nullif(btrim(p_note), ''), 'Pagamento da conta da estadia'), 'COMPLETED', p_stay_id,
      v_stay.reservation_id, v_method::text, now(), p_actor_id, v_reference) returning id into v_transaction_id;
    insert into public.stay_folio_entries(hotel_id, stay_id, reservation_id, direction, kind, amount, currency,
      description, financial_transaction_id, source_key, posted_by)
    values (p_hotel_id, p_stay_id, v_stay.reservation_id, 'credit', 'payment', v_amount, v_stay.currency,
      'Pagamento da conta da estadia', v_transaction_id, 'payment-batch:' || v_batch_id::text || ':' || v_index::text, p_actor_id)
    returning id into v_credit_id;
    insert into public.stay_payment_batch_tenders(hotel_id, batch_id, payment_method, amount, reference_code,
      financial_transaction_id, folio_credit_entry_id, display_order)
    values (p_hotel_id, v_batch_id, v_method, v_amount, v_reference, v_transaction_id, v_credit_id, v_index);
    perform public.allocate_stay_account_credit(p_hotel_id, p_stay_id, v_credit_id, p_actor_id);
    v_index := v_index + 1;
  end loop;
  update public.stays set total_paid = (
    select coalesce(sum(case when direction = 'credit' then amount else -amount end), 0)
    from public.stay_folio_entries where stay_id = p_stay_id and kind in ('payment', 'refund', 'adjustment')
  ) where id = p_stay_id;
  insert into public.stay_account_events(hotel_id, stay_id, entity_type, entity_id, action, actor_id, details)
  values (p_hotel_id, p_stay_id, 'payment_batch', v_batch_id, 'payment_batch_posted', p_actor_id,
    jsonb_build_object('amount', v_total, 'tender_count', jsonb_array_length(p_tenders), 'kind', p_kind));
  return jsonb_build_object('result', 'ok', 'batch_id', v_batch_id, 'created', true);
end;
$$;

create or replace function public.request_consumption_correction(
  p_hotel_id uuid, p_order_id uuid, p_actor_id uuid, p_kind public.consumption_correction_kind,
  p_reason text, p_items jsonb, p_expected_version bigint
) returns jsonb language plpgsql set search_path = public as $$
declare
  v_order record; v_item jsonb; v_effective record; v_id uuid := gen_random_uuid(); v_paid boolean := false;
  v_gross numeric(12,2) := 0; v_discount numeric(12,2) := 0; v_net numeric(12,2) := 0;
  v_new_quantity numeric(12,3); v_additional_discount numeric(12,2); v_new_gross numeric(12,2); v_new_net numeric(12,2);
  v_status public.consumption_correction_status := 'pending';
begin
  if not public.maintenance_user_has_hotel_scope(p_actor_id, p_hotel_id) then return jsonb_build_object('result', 'actor_outside_hotel'); end if;
  if length(coalesce(btrim(p_reason), '')) < 3 then return jsonb_build_object('result', 'reason_required'); end if;
  select orders.*, stay.account_version into v_order from public.consumption_orders orders
  left join public.stays stay on stay.id = orders.stay_id
  where orders.id = p_order_id and orders.hotel_id = p_hotel_id for update of orders;
  if not found or v_order.is_legacy or v_order.stay_id is null then return jsonb_build_object('result', 'not_found'); end if;
  if v_order.account_version <> p_expected_version then return jsonb_build_object('result', 'version_conflict'); end if;
  if exists (select 1 from public.consumption_corrections where order_id = p_order_id and status in ('pending','approved','awaiting_refund','awaiting_partner_refund'))
    then return jsonb_build_object('result', 'correction_already_open'); end if;
  v_paid := v_order.billing_mode in ('hotel_immediate', 'partner_direct') or exists (
    select 1 from public.stay_folio_entries entry join public.stay_folio_allocations allocation on allocation.debit_entry_id = entry.id
    where entry.consumption_order_id = p_order_id and entry.direction = 'debit'
  );
  insert into public.consumption_corrections(id, hotel_id, order_id, stay_id, kind, status, reason, account_version,
    gross_reduction, discount_increase, net_reduction, requested_by)
  values (v_id, p_hotel_id, p_order_id, v_order.stay_id, p_kind, 'pending', btrim(p_reason), p_expected_version,
    0, 0, 0.01, p_actor_id);
  if p_kind = 'full_void' then
    for v_effective in select * from public.consumption_order_item_effective where order_id = p_order_id loop
      insert into public.consumption_correction_items(hotel_id, correction_id, order_item_id, previous_quantity,
        resulting_quantity, previous_discount, additional_discount, previous_net, resulting_net)
      values (p_hotel_id, v_id, v_effective.id, v_effective.effective_quantity, 0, v_effective.effective_discount,
        0, v_effective.effective_net_amount, 0);
      v_gross := v_gross + round(v_effective.effective_quantity * v_effective.charged_unit_price, 2);
      v_net := v_net + v_effective.effective_net_amount;
    end loop;
  else
    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 then raise exception 'invalid correction items' using errcode = '23514'; end if;
    for v_item in select value from jsonb_array_elements(p_items) loop
      select * into v_effective from public.consumption_order_item_effective
        where id = (v_item->>'order_item_id')::uuid and order_id = p_order_id;
      if not found then raise exception 'correction item not found' using errcode = '23514'; end if;
      v_new_quantity := (v_item->>'resulting_quantity')::numeric;
      v_additional_discount := round(coalesce((v_item->>'additional_discount')::numeric, 0), 2);
      v_new_gross := round(v_new_quantity * v_effective.charged_unit_price, 2);
      if v_new_quantity < 0 or v_new_quantity > v_effective.effective_quantity or
        (v_effective.sales_unit_snapshot <> 'hour' and v_new_quantity <> trunc(v_new_quantity)) or
        v_additional_discount < 0 or v_effective.effective_discount + v_additional_discount > v_new_gross
      then raise exception 'invalid correction values' using errcode = '23514'; end if;
      v_new_net := v_new_gross - v_effective.effective_discount - v_additional_discount;
      if v_new_net >= v_effective.effective_net_amount then raise exception 'correction must reduce amount' using errcode = '23514'; end if;
      insert into public.consumption_correction_items(hotel_id, correction_id, order_item_id, previous_quantity,
        resulting_quantity, previous_discount, additional_discount, previous_net, resulting_net)
      values (p_hotel_id, v_id, v_effective.id, v_effective.effective_quantity, v_new_quantity,
        v_effective.effective_discount, v_additional_discount, v_effective.effective_net_amount, v_new_net);
      v_gross := v_gross + round((v_effective.effective_quantity - v_new_quantity) * v_effective.charged_unit_price, 2);
      v_discount := v_discount + v_additional_discount; v_net := v_net + v_effective.effective_net_amount - v_new_net;
    end loop;
    if v_net >= (select effective_net_amount from public.consumption_order_effective where id = p_order_id)
      then raise exception 'full reduction requires void' using errcode = '23514'; end if;
  end if;
  perform set_config('app.consumption_correction_write', 'on', true);
  update public.consumption_corrections set gross_reduction = v_gross, discount_increase = v_discount,
    net_reduction = v_net where id = v_id;
  if p_kind = 'full_void' and not v_paid and v_order.billing_mode is distinct from 'partner_direct' then
    update public.consumption_corrections set status = 'completed', decided_by = p_actor_id,
      decided_at = now(), completed_by = p_actor_id, completed_at = now() where id = v_id;
    if v_order.billing_mode = 'stay_folio' then
      insert into public.stay_folio_entries(hotel_id, stay_id, reservation_id, direction, kind, amount, currency,
        description, consumption_order_id, consumption_correction_id, source_key, posted_by)
      values (p_hotel_id, v_order.stay_id, v_order.reservation_id, 'credit', 'adjustment', v_net, v_order.currency,
        'Anulação de consumo', p_order_id, v_id, 'consumption-correction:' || v_id::text, p_actor_id);
      perform public.allocate_stay_account_credit(p_hotel_id, v_order.stay_id,
        (select id from public.stay_folio_entries where consumption_correction_id = v_id), p_actor_id);
    else update public.stays set account_version = account_version + 1 where id = v_order.stay_id; end if;
    v_status := 'completed';
  end if;
  insert into public.consumption_order_events(hotel_id, order_id, action, actor_id, details)
  values (p_hotel_id, p_order_id, case when v_status = 'completed' then 'voided' else 'correction_requested' end,
    p_actor_id, jsonb_build_object('correction_id', v_id, 'kind', p_kind, 'net_reduction', v_net));
  insert into public.stay_account_events(hotel_id, stay_id, entity_type, entity_id, action, actor_id, details)
  values (p_hotel_id, v_order.stay_id, 'consumption_correction', v_id,
    case when v_status = 'completed' then 'consumption_voided' else 'correction_requested' end,
    p_actor_id, jsonb_build_object('order_id', p_order_id, 'net_reduction', v_net));
  return jsonb_build_object('result', 'ok', 'correction_id', v_id, 'status', v_status);
end;
$$;

create or replace function public.decide_consumption_correction(
  p_hotel_id uuid, p_correction_id uuid, p_actor_id uuid, p_decision text, p_reason text default null
) returns jsonb language plpgsql set search_path = public as $$
declare v_correction record; v_order record; v_credit_id uuid; v_next public.consumption_correction_status;
  v_open_credit numeric(12,2);
begin
  if not public.maintenance_user_has_hotel_scope(p_actor_id, p_hotel_id) then return jsonb_build_object('result', 'actor_outside_hotel'); end if;
  select * into v_correction from public.consumption_corrections where id = p_correction_id and hotel_id = p_hotel_id for update;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if v_correction.status <> 'pending' then return jsonb_build_object('result', 'invalid_status'); end if;
  if v_correction.requested_by = p_actor_id then return jsonb_build_object('result', 'self_approval'); end if;
  if (select account_version from public.stays where id = v_correction.stay_id) <> v_correction.account_version
    then return jsonb_build_object('result', 'version_conflict'); end if;
  perform set_config('app.consumption_correction_write', 'on', true);
  if p_decision = 'reject' then
    if length(coalesce(btrim(p_reason), '')) < 3 then return jsonb_build_object('result', 'decision_reason_required'); end if;
    update public.consumption_corrections set status = 'rejected', decided_by = p_actor_id,
      decided_at = now(), decision_reason = btrim(p_reason) where id = p_correction_id;
    v_next := 'rejected';
  elsif p_decision = 'approve' then
    select * into v_order from public.consumption_orders where id = v_correction.order_id;
    if v_order.billing_mode = 'hotel_immediate' then v_next := 'awaiting_refund';
    elsif v_order.billing_mode = 'partner_direct' then v_next := 'awaiting_partner_refund';
    else
      v_next := 'completed';
      if v_order.billing_mode = 'stay_folio' then
        insert into public.stay_folio_entries(hotel_id, stay_id, reservation_id, direction, kind, amount, currency,
          description, consumption_order_id, consumption_correction_id, source_key, posted_by)
        values (p_hotel_id, v_order.stay_id, v_order.reservation_id, 'credit', 'adjustment', v_correction.net_reduction,
          v_order.currency, 'Ajuste de consumo aprovado', v_order.id, v_correction.id,
          'consumption-correction:' || v_correction.id::text, p_actor_id) returning id into v_credit_id;
        perform public.allocate_stay_account_credit(p_hotel_id, v_order.stay_id, v_credit_id, p_actor_id);
        select entry.amount - coalesce(sum(allocation.amount), 0) into v_open_credit
        from public.stay_folio_entries entry
        left join public.stay_folio_allocations allocation on allocation.credit_entry_id = entry.id
        where entry.id = v_credit_id group by entry.id, entry.amount;
        if v_open_credit > 0 then v_next := 'awaiting_refund'; end if;
      else update public.stays set account_version = account_version + 1 where id = v_order.stay_id; end if;
    end if;
    update public.consumption_corrections set status = v_next, decided_by = p_actor_id, decided_at = now(),
      decision_reason = nullif(btrim(p_reason), ''), completed_by = case when v_next = 'completed' then p_actor_id else null end,
      completed_at = case when v_next = 'completed' then now() else null end where id = p_correction_id;
  else return jsonb_build_object('result', 'invalid_decision'); end if;
  insert into public.consumption_order_events(hotel_id, order_id, action, actor_id, details)
  values (p_hotel_id, v_correction.order_id, 'correction_' || p_decision, p_actor_id,
    jsonb_build_object('correction_id', p_correction_id, 'status', v_next));
  insert into public.stay_account_events(hotel_id, stay_id, entity_type, entity_id, action, actor_id, details)
  values (p_hotel_id, v_correction.stay_id, 'consumption_correction', p_correction_id,
    'correction_' || p_decision, p_actor_id, jsonb_build_object('status', v_next));
  return jsonb_build_object('result', 'ok', 'status', v_next);
end;
$$;

create or replace function public.complete_partner_correction_refund(
  p_hotel_id uuid, p_correction_id uuid, p_actor_id uuid, p_reference text default null
) returns jsonb language plpgsql set search_path = public as $$
declare v_correction record;
begin
  select * into v_correction from public.consumption_corrections where id = p_correction_id and hotel_id = p_hotel_id for update;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if v_correction.status <> 'awaiting_partner_refund' then return jsonb_build_object('result', 'invalid_status'); end if;
  if not public.maintenance_user_has_hotel_scope(p_actor_id, p_hotel_id) then return jsonb_build_object('result', 'actor_outside_hotel'); end if;
  perform set_config('app.consumption_correction_write', 'on', true);
  update public.consumption_corrections set status = 'completed', completed_by = p_actor_id, completed_at = now()
    where id = p_correction_id;
  update public.stays set account_version = account_version + 1 where id = v_correction.stay_id;
  insert into public.consumption_order_events(hotel_id, order_id, action, actor_id, details)
  values (p_hotel_id, v_correction.order_id, 'partner_refund_confirmed', p_actor_id,
    jsonb_build_object('correction_id', p_correction_id, 'reference', nullif(btrim(p_reference), '')));
  insert into public.stay_account_events(hotel_id, stay_id, entity_type, entity_id, action, actor_id, details)
  values (p_hotel_id, v_correction.stay_id, 'consumption_correction', p_correction_id,
    'partner_refund_confirmed', p_actor_id,
    jsonb_build_object('reference', nullif(btrim(p_reference), '')));
  return jsonb_build_object('result', 'ok', 'status', 'completed');
end;
$$;

create or replace function public.create_stay_refund(
  p_hotel_id uuid, p_stay_id uuid, p_actor_id uuid, p_amount numeric,
  p_payment_method public.consumption_payment_method, p_reason text, p_idempotency_key uuid,
  p_expected_version bigint, p_correction_id uuid default null, p_original_tender_id uuid default null,
  p_reference text default null, p_method_override_reason text default null
) returns jsonb language plpgsql set search_path = public as $$
declare
  v_stay record; v_correction record; v_tender record; v_existing record; v_fingerprint text;
  v_refund_id uuid := gen_random_uuid(); v_transaction_id uuid; v_debit_id uuid; v_adjustment_credit_id uuid;
  v_correction_order_id uuid;
  v_available numeric(12,2); v_tender_remaining numeric(12,2);
  v_original_method public.consumption_payment_method;
begin
  v_fingerprint := md5(jsonb_build_object('stay', p_stay_id, 'amount', p_amount, 'method', p_payment_method,
    'reason', btrim(p_reason), 'correction', p_correction_id, 'tender', p_original_tender_id,
    'reference', nullif(btrim(p_reference), ''), 'override', nullif(btrim(p_method_override_reason), ''))::text);
  select id, request_fingerprint into v_existing from public.stay_refunds
    where hotel_id = p_hotel_id and idempotency_key = p_idempotency_key for update;
  if found then
    if v_existing.request_fingerprint = v_fingerprint then return jsonb_build_object('result', 'ok', 'refund_id', v_existing.id, 'created', false); end if;
    return jsonb_build_object('result', 'idempotency_conflict');
  end if;
  if not public.maintenance_user_has_hotel_scope(p_actor_id, p_hotel_id) then return jsonb_build_object('result', 'actor_outside_hotel'); end if;
  select stay.*, reservation.hotel_id, reservation.id reservation_id, hotel.currency into v_stay
  from public.stays stay join public.reservations reservation on reservation.id = stay.reservation_id
  join public.hotels hotel on hotel.id = reservation.hotel_id
  where stay.id = p_stay_id and reservation.hotel_id = p_hotel_id for update of stay;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if v_stay.account_version <> p_expected_version then return jsonb_build_object('result', 'version_conflict'); end if;
  if p_amount <= 0 or length(coalesce(btrim(p_reason), '')) < 3 then return jsonb_build_object('result', 'invalid_refund'); end if;
  if p_original_tender_id is not null then
    select tender.* into v_tender from public.stay_payment_batch_tenders tender
    join public.stay_payment_batches batch on batch.id = tender.batch_id
    where tender.id = p_original_tender_id and tender.hotel_id = p_hotel_id and batch.stay_id = p_stay_id;
    if not found then return jsonb_build_object('result', 'tender_not_found'); end if;
    v_original_method := v_tender.payment_method;
    select v_tender.amount - coalesce(sum(refund.amount), 0) into v_tender_remaining
    from public.stay_refunds refund where refund.original_tender_id = p_original_tender_id;
    if p_amount > v_tender_remaining then
      return jsonb_build_object('result', 'refund_exceeds_payment', 'available', v_tender_remaining);
    end if;
  end if;
  if v_original_method is not null and v_original_method <> p_payment_method and length(coalesce(btrim(p_method_override_reason), '')) < 3
    then return jsonb_build_object('result', 'method_override_reason_required'); end if;
  if p_correction_id is not null then
    select * into v_correction from public.consumption_corrections
      where id = p_correction_id and hotel_id = p_hotel_id and stay_id = p_stay_id for update;
    if not found or v_correction.status <> 'awaiting_refund'
      then return jsonb_build_object('result', 'invalid_correction_refund'); end if;
    v_correction_order_id := v_correction.order_id;
    select entry.id, entry.amount - coalesce(sum(allocation.amount), 0)
      into v_adjustment_credit_id, v_available
    from public.stay_folio_entries entry
    left join public.stay_folio_allocations allocation on allocation.credit_entry_id = entry.id
    where entry.hotel_id = p_hotel_id and entry.consumption_correction_id = p_correction_id
      and entry.direction = 'credit' and entry.kind = 'adjustment'
    group by entry.id, entry.amount limit 1;
    if found then
      if p_amount <> v_available or v_available <= 0
        then return jsonb_build_object('result', 'invalid_correction_refund', 'available', v_available); end if;
    elsif p_amount <> v_correction.net_reduction then
      return jsonb_build_object('result', 'invalid_correction_refund', 'available', v_correction.net_reduction);
    end if;
  elsif p_original_tender_id is null then
    if v_stay.stay_status = 'checked_out' then return jsonb_build_object('result', 'closed_account_refund_requires_correction'); end if;
    select coalesce(sum(entry.amount - coalesce(allocated.amount, 0)), 0) into v_available
    from public.stay_folio_entries entry
    left join lateral (select sum(amount) amount from public.stay_folio_allocations where credit_entry_id = entry.id) allocated on true
    where entry.hotel_id = p_hotel_id and entry.stay_id = p_stay_id and entry.direction = 'credit'
      and entry.amount > coalesce(allocated.amount, 0);
    if p_amount > v_available then return jsonb_build_object('result', 'refund_exceeds_credit', 'available', v_available); end if;
  elsif v_stay.stay_status = 'checked_out' then
    return jsonb_build_object('result', 'closed_account_refund_requires_correction');
  end if;
  insert into public.stay_refunds(id, hotel_id, stay_id, reservation_id, correction_id, original_tender_id,
    amount, currency, payment_method, original_payment_method, method_override_reason, reference_code, reason,
    financial_transaction_id, folio_debit_entry_id, idempotency_key, request_fingerprint, created_by)
  values (v_refund_id, p_hotel_id, p_stay_id, v_stay.reservation_id, p_correction_id, p_original_tender_id,
    p_amount, v_stay.currency, p_payment_method, v_original_method, nullif(btrim(p_method_override_reason), ''),
    nullif(btrim(p_reference), ''), btrim(p_reason), gen_random_uuid(), gen_random_uuid(), p_idempotency_key, v_fingerprint, p_actor_id);
  select financial_transaction_id, folio_debit_entry_id into v_transaction_id, v_debit_id
    from public.stay_refunds where id = v_refund_id;
  insert into public.financial_transactions(id, hotel_id, type, category, amount, currency, description, status,
    stay_id, reservation_id, payment_method, paid_at, created_by, reference_code, stay_refund_id, consumption_order_id)
  values (v_transaction_id, p_hotel_id, 'REFUND', 'STAY_REFUND', p_amount, v_stay.currency, btrim(p_reason),
    'COMPLETED', p_stay_id, v_stay.reservation_id, p_payment_method::text, now(), p_actor_id,
    nullif(btrim(p_reference), ''), v_refund_id,
    v_correction_order_id);
  insert into public.stay_folio_entries(id, hotel_id, stay_id, reservation_id, direction, kind, amount, currency,
    description, financial_transaction_id, consumption_order_id, consumption_correction_id, source_key, posted_by)
  values (v_debit_id, p_hotel_id, p_stay_id, v_stay.reservation_id, 'debit', 'refund', p_amount,
    v_stay.currency, btrim(p_reason), v_transaction_id,
    v_correction_order_id, p_correction_id,
    'stay-refund:' || v_refund_id::text, p_actor_id);
  if p_correction_id is not null then
    select id into v_adjustment_credit_id from public.stay_folio_entries
      where hotel_id = p_hotel_id and consumption_correction_id = p_correction_id
        and direction = 'credit' and kind = 'adjustment' limit 1;
    if v_adjustment_credit_id is null then
      insert into public.stay_folio_entries(hotel_id, stay_id, reservation_id, direction, kind, amount, currency,
        description, consumption_order_id, consumption_correction_id, source_key, posted_by)
      values (p_hotel_id, p_stay_id, v_stay.reservation_id, 'credit', 'adjustment', p_amount, v_stay.currency,
        'Ajuste de consumo aprovado', v_correction_order_id, p_correction_id,
        'consumption-correction:' || p_correction_id::text, p_actor_id)
      returning id into v_adjustment_credit_id;
    end if;
    insert into public.stay_folio_allocations(hotel_id, stay_id, credit_entry_id, debit_entry_id, amount, created_by)
    values (p_hotel_id, p_stay_id, v_adjustment_credit_id, v_debit_id, p_amount, p_actor_id);
    perform set_config('app.consumption_correction_write', 'on', true);
    update public.consumption_corrections set status = 'completed', completed_by = p_actor_id, completed_at = now()
      where id = p_correction_id;
  end if;
  insert into public.stay_account_events(hotel_id, stay_id, entity_type, entity_id, action, actor_id, details)
  values (p_hotel_id, p_stay_id, 'refund', v_refund_id, 'refund_posted', p_actor_id,
    jsonb_build_object('amount', p_amount, 'method', p_payment_method, 'correction_id', p_correction_id));
  return jsonb_build_object('result', 'ok', 'refund_id', v_refund_id, 'created', true);
end;
$$;

create or replace function public.checkout_stay_account(
  p_hotel_id uuid, p_stay_id uuid, p_actor_id uuid, p_expected_version bigint,
  p_tenders jsonb, p_idempotency_key uuid, p_occurrence_ids uuid[] default array[]::uuid[],
  p_maintenance_folio_entry_ids uuid[] default array[]::uuid[], p_note text default null
) returns jsonb language plpgsql set search_path = public as $$
declare
  v_stay record; v_existing record; v_due numeric(12,2); v_open_credit numeric(12,2); v_batch jsonb;
  v_fingerprint text; v_record_id uuid := gen_random_uuid(); v_snapshot jsonb; v_currency text;
  v_lodging numeric(12,2); v_consumption numeric(12,2); v_maintenance numeric(12,2); v_payments numeric(12,2);
  v_partner numeric(12,2); v_courtesy numeric(12,2); v_discount numeric(12,2); v_voided numeric(12,2);
begin
  v_fingerprint := md5(jsonb_build_object('stay', p_stay_id, 'version', p_expected_version, 'tenders', p_tenders,
    'occurrences', p_occurrence_ids, 'maintenance_entries', p_maintenance_folio_entry_ids,
    'note', nullif(btrim(p_note), ''))::text);
  select id, request_fingerprint into v_existing from public.stay_checkout_records
    where hotel_id = p_hotel_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_fingerprint = v_fingerprint then return jsonb_build_object('result', 'ok', 'checkout_record_id', v_existing.id, 'created', false); end if;
    return jsonb_build_object('result', 'idempotency_conflict');
  end if;
  if not public.maintenance_user_has_hotel_scope(p_actor_id, p_hotel_id) then return jsonb_build_object('result', 'actor_outside_hotel'); end if;
  select stay.*, reservation.hotel_id, reservation.reservation_code, hotel.currency,
    hotel.timezone, hotel.checkout_time_start, hotel.checkout_time_limit into v_stay
  from public.stays stay join public.reservations reservation on reservation.id = stay.reservation_id
  join public.hotels hotel on hotel.id = reservation.hotel_id
  where stay.id = p_stay_id and reservation.hotel_id = p_hotel_id for update of stay;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if v_stay.stay_status <> 'checked_in' then return jsonb_build_object('result', 'stay_not_checked_in'); end if;
  if v_stay.account_version <> p_expected_version then return jsonb_build_object('result', 'version_conflict'); end if;
  if v_stay.checkout_time_start is null or v_stay.checkout_time_limit is null
    then return jsonb_build_object('result', 'checkout_window_not_configured'); end if;
  if (now() at time zone v_stay.timezone)::date <> v_stay.checkout_date_expected::date
    then return jsonb_build_object('result', 'checkout_date_invalid'); end if;
  if (v_stay.checkout_time_start <= v_stay.checkout_time_limit and
      (now() at time zone v_stay.timezone)::time not between v_stay.checkout_time_start and v_stay.checkout_time_limit)
    or (v_stay.checkout_time_start > v_stay.checkout_time_limit and
      (now() at time zone v_stay.timezone)::time < v_stay.checkout_time_start and
      (now() at time zone v_stay.timezone)::time > v_stay.checkout_time_limit)
    then return jsonb_build_object('result', 'checkout_time_invalid'); end if;
  if exists (select 1 from public.consumption_corrections where stay_id = p_stay_id and status in ('pending','approved','awaiting_refund','awaiting_partner_refund'))
    then return jsonb_build_object('result', 'pending_correction'); end if;
  select coalesce(sum(entry.amount - coalesce(allocated.amount, 0)), 0) into v_due
  from public.stay_folio_entries entry
  left join lateral (select sum(amount) amount from public.stay_folio_allocations where debit_entry_id = entry.id) allocated on true
  where entry.hotel_id = p_hotel_id and entry.stay_id = p_stay_id and entry.direction = 'debit'
    and entry.kind <> 'maintenance_charge' and entry.amount > coalesce(allocated.amount, 0);
  select coalesce(sum(entry.amount - coalesce(allocated.amount, 0)), 0) into v_open_credit
  from public.stay_folio_entries entry
  left join lateral (select sum(amount) amount from public.stay_folio_allocations where credit_entry_id = entry.id) allocated on true
  where entry.hotel_id = p_hotel_id and entry.stay_id = p_stay_id and entry.direction = 'credit'
    and entry.amount > coalesce(allocated.amount, 0);
  if v_open_credit > 0 then return jsonb_build_object('result', 'refundable_credit', 'amount', v_open_credit); end if;
  if v_due > 0 then
    if jsonb_typeof(p_tenders) <> 'array' or jsonb_array_length(p_tenders) = 0 then
      return jsonb_build_object('result', 'payment_required', 'amount', v_due); end if;
    v_batch := public.create_stay_payment_batch(p_hotel_id, p_stay_id, p_actor_id, p_tenders, p_idempotency_key,
      p_expected_version, 'checkout', p_note);
    if v_batch->>'result' <> 'ok' then return v_batch; end if;
  elsif jsonb_typeof(p_tenders) = 'array' and jsonb_array_length(p_tenders) > 0 then
    return jsonb_build_object('result', 'payment_exceeds_balance');
  end if;
  if exists (
    select 1 from public.stay_folio_entries entry
    left join lateral (select sum(amount) amount from public.stay_folio_allocations where debit_entry_id = entry.id) allocated on true
    where entry.hotel_id = p_hotel_id and entry.stay_id = p_stay_id and entry.direction = 'debit'
      and entry.kind = 'maintenance_charge' and entry.amount > coalesce(allocated.amount, 0)
      and not (entry.id = any(coalesce(p_maintenance_folio_entry_ids, array[]::uuid[])))
  ) then return jsonb_build_object('result', 'maintenance_acknowledgement_required'); end if;
  if exists (select 1 from unnest(coalesce(p_maintenance_folio_entry_ids, array[]::uuid[])) entry_id where not exists (
    select 1 from public.stay_folio_entries entry where entry.id = entry_id and entry.hotel_id = p_hotel_id
      and entry.stay_id = p_stay_id and entry.direction = 'debit' and entry.kind = 'maintenance_charge'
  )) then return jsonb_build_object('result', 'invalid_maintenance_acknowledgement'); end if;
  insert into public.maintenance_financial_checkout_acknowledgements(hotel_id, stay_id, folio_entry_id, acknowledged_by, note)
  select p_hotel_id, p_stay_id, entry.id, p_actor_id, nullif(btrim(p_note), '') from public.stay_folio_entries entry
  where entry.id = any(coalesce(p_maintenance_folio_entry_ids, array[]::uuid[])) on conflict (stay_id, folio_entry_id) do nothing;
  insert into public.maintenance_checkout_acknowledgements(hotel_id, occurrence_id, stay_id, acknowledged_by, note)
  select p_hotel_id, occurrence.id, p_stay_id, p_actor_id, nullif(btrim(p_note), '')
  from public.maintenance_occurrences occurrence where occurrence.id = any(coalesce(p_occurrence_ids, array[]::uuid[]))
    and occurrence.hotel_id = p_hotel_id on conflict (occurrence_id, stay_id) do nothing;
  select coalesce(sum(case when kind='lodging' and direction='debit' then amount else 0 end),0),
    coalesce(sum(case when kind='consumption_charge' and direction='debit' then amount else 0 end),0),
    coalesce(sum(case when kind='maintenance_charge' and direction='debit' then amount else 0 end),0),
    coalesce(sum(case when kind='payment' and direction='credit' then amount else 0 end),0)
  into v_lodging, v_consumption, v_maintenance, v_payments from public.stay_folio_entries
  where hotel_id = p_hotel_id and stay_id = p_stay_id;
  select coalesce(sum(case when billing_mode='partner_direct' then effective_net_amount else 0 end),0),
    coalesce(sum(case when disposition='courtesy' then original_gross_amount else 0 end),0),
    coalesce(sum(original_net_amount-effective_net_amount),0),
    coalesce(sum(case when effective_status='voided' then original_net_amount else 0 end),0)
  into v_partner, v_courtesy, v_discount, v_voided from public.consumption_order_effective
  where stay_id = p_stay_id;
  select jsonb_build_object('stay_id', p_stay_id, 'reservation_code', v_stay.reservation_code,
    'currency', v_stay.currency, 'folio_entries', coalesce(jsonb_agg(to_jsonb(entry) order by entry.posted_at), '[]'::jsonb))
  into v_snapshot from public.stay_folio_entries entry where entry.hotel_id = p_hotel_id and entry.stay_id = p_stay_id;
  update public.stays set stay_status = 'checked_out', checkout_date_actual = now() where id = p_stay_id;
  select account_version into p_expected_version from public.stays where id = p_stay_id;
  insert into public.stay_checkout_records(id, hotel_id, stay_id, reservation_id, kind, account_version, currency,
    lodging_total, consumption_total, maintenance_total, payment_total, partner_direct_total, courtesy_total,
    discount_total, voided_total, exception_folio_entry_ids, statement_snapshot, idempotency_key,
    request_fingerprint, checked_out_by, checked_out_at)
  values (v_record_id, p_hotel_id, p_stay_id, v_stay.reservation_id, 'operational', p_expected_version, v_stay.currency,
    v_lodging, v_consumption, v_maintenance, v_payments, v_partner, v_courtesy, v_discount, v_voided,
    coalesce(p_maintenance_folio_entry_ids, array[]::uuid[]), v_snapshot, p_idempotency_key, v_fingerprint,
    p_actor_id, now());
  insert into public.stay_account_events(hotel_id, stay_id, entity_type, entity_id, action, actor_id, details)
  values (p_hotel_id, p_stay_id, 'checkout', v_record_id, 'account_closed', p_actor_id,
    jsonb_build_object('account_version', p_expected_version, 'maintenance_exceptions', p_maintenance_folio_entry_ids));
  return jsonb_build_object('result', 'ok', 'checkout_record_id', v_record_id, 'created', true);
end;
$$;

create or replace function public.block_invalid_stay_checkout()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.stay_status = 'checked_out' and old.stay_status <> 'checked_out' then
    if exists (
      select 1 from public.stay_folio_entries entry
      left join lateral (select sum(amount) amount from public.stay_folio_allocations where debit_entry_id=entry.id) allocated on true
      where entry.stay_id=new.id and entry.direction='debit' and entry.amount>coalesce(allocated.amount,0)
        and (entry.kind <> 'maintenance_charge' or not exists (
          select 1 from public.maintenance_financial_checkout_acknowledgements acknowledgement
          where acknowledgement.stay_id=new.id and acknowledgement.folio_entry_id=entry.id))
    ) or exists (
      select 1 from public.stay_folio_entries entry
      left join lateral (select sum(amount) amount from public.stay_folio_allocations where credit_entry_id=entry.id) allocated on true
      where entry.stay_id=new.id and entry.direction='credit' and entry.amount>coalesce(allocated.amount,0)
    ) or exists (
      select 1 from public.consumption_corrections correction where correction.stay_id=new.id
        and correction.status in ('pending','approved','awaiting_refund','awaiting_partner_refund')
    ) then raise exception 'open stay account blocks checkout' using errcode='23514'; end if;
  end if;
  return new;
end;
$$;
drop trigger trg_stays_block_checkout_with_consumption on public.stays;
create trigger trg_stays_block_invalid_checkout before update of stay_status on public.stays
  for each row execute function public.block_invalid_stay_checkout();

create or replace function public.protect_stay_account_record()
returns trigger language plpgsql as $$ begin raise exception 'stay account records are immutable' using errcode='23514'; end; $$;
create trigger trg_payment_batches_immutable before update or delete on public.stay_payment_batches for each row execute function public.protect_stay_account_record();
create trigger trg_payment_tenders_immutable before update or delete on public.stay_payment_batch_tenders for each row execute function public.protect_stay_account_record();
create trigger trg_correction_items_immutable before update or delete on public.consumption_correction_items for each row execute function public.protect_stay_account_record();
create trigger trg_refunds_immutable before update or delete on public.stay_refunds for each row execute function public.protect_stay_account_record();
create trigger trg_checkout_records_immutable before update or delete on public.stay_checkout_records for each row execute function public.protect_stay_account_record();
create trigger trg_account_events_immutable before update or delete on public.stay_account_events for each row execute function public.protect_stay_account_record();
create or replace function public.protect_consumption_correction_state()
returns trigger language plpgsql as $$
begin
  if current_setting('app.consumption_correction_write', true) is distinct from 'on'
    then raise exception 'consumption correction state requires transactional routine' using errcode='23514'; end if;
  return new;
end; $$;
create trigger trg_corrections_controlled before update or delete on public.consumption_corrections
  for each row execute function public.protect_consumption_correction_state();

-- Existing payments become one-tender legacy batches without duplicating money movements.
insert into public.stay_payment_batches(id, hotel_id, stay_id, reservation_id, kind, amount, currency, note, created_by, created_at)
select transaction.id, transaction.hotel_id, transaction.stay_id, transaction.reservation_id, 'legacy', transaction.amount,
  transaction.currency, coalesce(nullif(btrim(transaction.description), ''), 'Pagamento migrado'), transaction.created_by,
  transaction.created_at
from public.financial_transactions transaction
where transaction.stay_id is not null and transaction.reservation_id is not null and transaction.type = 'INCOME'
  and transaction.status in ('COMPLETED','REFUNDED') and exists (
    select 1 from public.stay_folio_entries entry where entry.financial_transaction_id = transaction.id and entry.direction='credit'
  );
insert into public.stay_payment_batch_tenders(hotel_id, batch_id, payment_method, amount, reference_code,
  financial_transaction_id, folio_credit_entry_id, display_order)
select batch.hotel_id, batch.id,
  case when transaction.payment_method in ('cash','pix','credit_card','debit_card','bank_transfer')
    then transaction.payment_method::public.consumption_payment_method else 'bank_transfer' end,
  transaction.amount, transaction.reference_code, transaction.id, entry.id, 0
from public.stay_payment_batches batch
join public.financial_transactions transaction on transaction.id = batch.id
join public.stay_folio_entries entry on entry.financial_transaction_id=transaction.id;

insert into public.stay_checkout_records(hotel_id, stay_id, reservation_id, kind, account_version, currency,
  lodging_total, consumption_total, maintenance_total, payment_total, partner_direct_total, courtesy_total,
  discount_total, voided_total, statement_snapshot, checked_out_at)
select reservation.hotel_id, stay.id, stay.reservation_id, 'legacy', stay.account_version, hotel.currency,
  coalesce(sum(entry.amount) filter (where entry.kind='lodging' and entry.direction='debit'),0),
  coalesce(sum(entry.amount) filter (where entry.kind='consumption_charge' and entry.direction='debit'),0),
  coalesce(sum(entry.amount) filter (where entry.kind='maintenance_charge' and entry.direction='debit'),0),
  coalesce(sum(entry.amount) filter (where entry.kind='payment' and entry.direction='credit'),0),
  0, 0, 0, 0,
  jsonb_build_object('legacy', true, 'message', 'Fechamento migrado sem snapshot contemporâneo'),
  coalesce(stay.checkout_date_actual, stay.updated_at)
from public.stays stay join public.reservations reservation on reservation.id=stay.reservation_id
join public.hotels hotel on hotel.id=reservation.hotel_id
left join public.stay_folio_entries entry on entry.stay_id=stay.id
where stay.stay_status='checked_out'
group by reservation.hotel_id, stay.id, hotel.currency;

alter table public.stay_payment_batches enable row level security;
alter table public.stay_payment_batch_tenders enable row level security;
alter table public.consumption_corrections enable row level security;
alter table public.consumption_correction_items enable row level security;
alter table public.stay_refunds enable row level security;
alter table public.stay_checkout_records enable row level security;
alter table public.stay_account_events enable row level security;

grant usage on type public.stay_payment_batch_kind, public.consumption_correction_kind,
  public.consumption_correction_status, public.stay_checkout_record_kind to postgres, service_role;
grant select, insert on public.stay_payment_batches, public.stay_payment_batch_tenders,
  public.consumption_corrections, public.consumption_correction_items, public.stay_refunds,
  public.stay_checkout_records, public.stay_account_events to postgres, service_role;
grant update on public.consumption_corrections to postgres, service_role;
grant select on public.consumption_order_item_effective, public.consumption_order_effective to postgres, service_role;
grant execute on function public.allocate_stay_account_credit(uuid,uuid,uuid,uuid),
  public.create_stay_payment_batch(uuid,uuid,uuid,jsonb,uuid,bigint,public.stay_payment_batch_kind,text),
  public.request_consumption_correction(uuid,uuid,uuid,public.consumption_correction_kind,text,jsonb,bigint),
  public.decide_consumption_correction(uuid,uuid,uuid,text,text),
  public.complete_partner_correction_refund(uuid,uuid,uuid,text),
  public.create_stay_refund(uuid,uuid,uuid,numeric,public.consumption_payment_method,text,uuid,bigint,uuid,uuid,text,text),
  public.checkout_stay_account(uuid,uuid,uuid,bigint,jsonb,uuid,uuid[],uuid[],text)
to postgres, service_role;
