create type public.partner_settlement_status as enum ('draft', 'in_review', 'approved', 'settled');
create type public.partner_settlement_direction as enum ('hotel_to_partner', 'partner_to_hotel', 'balanced');
create type public.partner_settlement_source_kind as enum ('regular', 'late_correction');

create table public.consumption_management_settings (
  hotel_id uuid primary key references public.hotels(id) on delete restrict,
  settlement_tracking_starts_on date not null,
  payment_due_days integer not null default 5,
  agreement_expiry_alert_days integer not null default 30,
  guest_balance_alert_days integer not null default 0,
  last_changed_by uuid references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint consumption_management_settings_month_check check (settlement_tracking_starts_on=date_trunc('month',settlement_tracking_starts_on)::date),
  constraint consumption_management_settings_due_days_check check (payment_due_days between 0 and 90),
  constraint consumption_management_settings_agreement_days_check check (agreement_expiry_alert_days between 1 and 365),
  constraint consumption_management_settings_guest_days_check check (guest_balance_alert_days between 0 and 30)
);

insert into public.consumption_management_settings(hotel_id, settlement_tracking_starts_on)
select id, date_trunc('month', now() at time zone timezone)::date
from public.hotels;

create or replace function public.initialize_consumption_management_settings()
returns trigger language plpgsql set search_path = public as $$
begin
  insert into public.consumption_management_settings(hotel_id,settlement_tracking_starts_on)
  values(new.id,date_trunc('month',now() at time zone new.timezone)::date)
  on conflict(hotel_id) do nothing;
  return new;
end;
$$;

create trigger trg_hotels_initialize_consumption_management
after insert on public.hotels for each row
execute function public.initialize_consumption_management_settings();

create table public.partner_settlements (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  partner_id uuid not null,
  period_start date not null,
  period_end date not null,
  currency text not null,
  status public.partner_settlement_status not null default 'draft',
  direction public.partner_settlement_direction not null default 'balanced',
  version bigint not null default 1,
  gross_sales numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  courtesy_total numeric(14,2) not null default 0,
  reversal_total numeric(14,2) not null default 0,
  operational_net numeric(14,2) not null default 0,
  hotel_collected numeric(14,2) not null default 0,
  partner_direct numeric(14,2) not null default 0,
  rent_total numeric(14,2) not null default 0,
  commission_total numeric(14,2) not null default 0,
  minimum_guarantee_topup numeric(14,2) not null default 0,
  contribution_total numeric(14,2) not null default 0,
  net_settlement numeric(14,2) not null default 0,
  due_on date not null,
  source_fingerprint text not null default '',
  statement_snapshot jsonb,
  prepared_by uuid references public.users(id) on delete restrict,
  prepared_at timestamptz,
  submitted_by uuid references public.users(id) on delete restrict,
  submitted_at timestamptz,
  approved_by uuid references public.users(id) on delete restrict,
  approved_at timestamptz,
  settled_by uuid references public.users(id) on delete restrict,
  settled_at timestamptz,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_settlements_id_hotel_unique unique (id, hotel_id),
  constraint partner_settlements_partner_hotel_fkey foreign key (partner_id, hotel_id)
    references public.commercial_partners(id, hotel_id) on delete restrict,
  constraint partner_settlements_month_check check (
    period_start = date_trunc('month', period_start)::date
    and period_end = (period_start + interval '1 month - 1 day')::date
  ),
  constraint partner_settlements_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint partner_settlements_version_check check (version > 0),
  constraint partner_settlements_amounts_check check (
    gross_sales >= 0 and discount_total >= 0 and courtesy_total >= 0 and reversal_total >= 0
    and operational_net >= 0 and hotel_collected >= 0 and partner_direct >= 0
    and rent_total >= 0
  ),
  constraint partner_settlements_direction_check check (
    (net_settlement > 0 and direction = 'hotel_to_partner')
    or (net_settlement < 0 and direction = 'partner_to_hotel')
    or (net_settlement = 0 and direction = 'balanced')
  ),
  constraint partner_settlements_workflow_check check (
    (status = 'draft' and approved_at is null and settled_at is null)
    or (status = 'in_review' and prepared_by is not null and submitted_by is not null and submitted_at is not null and approved_at is null and settled_at is null)
    or (status = 'approved' and approved_by is not null and approved_at is not null and statement_snapshot is not null and settled_at is null)
    or (status = 'settled' and approved_by is not null and approved_at is not null and statement_snapshot is not null)
  ),
  constraint partner_settlements_hotel_partner_month_unique unique (hotel_id, partner_id, period_start)
);

create index partner_settlements_queue_idx
  on public.partner_settlements(hotel_id, status, due_on, period_start desc);
create index partner_settlements_partner_idx
  on public.partner_settlements(hotel_id, partner_id, period_start desc);

create table public.partner_settlement_components (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  settlement_id uuid not null,
  source_kind public.partner_settlement_source_kind not null default 'regular',
  agreement_id uuid not null,
  revision_id uuid not null,
  origin_component_id uuid,
  agreement_number text not null,
  revision_version integer not null,
  segment_start date not null,
  segment_end date not null,
  commercial_model public.commercial_model not null,
  fixed_rent numeric(14,2),
  rent_frequency public.commercial_rent_frequency,
  commission_percentage numeric(7,4),
  minimum_guarantee numeric(14,2),
  payment_recipient public.commercial_payment_recipient not null,
  gross_sales numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  courtesy_total numeric(14,2) not null default 0,
  reversal_total numeric(14,2) not null default 0,
  operational_net numeric(14,2) not null default 0,
  hotel_collected numeric(14,2) not null default 0,
  partner_direct numeric(14,2) not null default 0,
  prorated_rent numeric(14,2) not null default 0,
  commission_amount numeric(14,2) not null default 0,
  prorated_minimum_guarantee numeric(14,2) not null default 0,
  minimum_guarantee_topup numeric(14,2) not null default 0,
  contribution_amount numeric(14,2) not null default 0,
  net_settlement_amount numeric(14,2) not null default 0,
  calculation_memory jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint partner_settlement_components_id_hotel_unique unique (id, hotel_id),
  constraint partner_settlement_components_settlement_hotel_fkey foreign key (settlement_id, hotel_id)
    references public.partner_settlements(id, hotel_id) on delete restrict,
  constraint partner_settlement_components_agreement_hotel_fkey foreign key (agreement_id, hotel_id)
    references public.commercial_agreements(id, hotel_id) on delete restrict,
  constraint partner_settlement_components_revision_hotel_fkey foreign key (revision_id, hotel_id)
    references public.commercial_agreement_revisions(id, hotel_id) on delete restrict,
  constraint partner_settlement_components_origin_hotel_fkey foreign key (origin_component_id, hotel_id)
    references public.partner_settlement_components(id, hotel_id) on delete restrict,
  constraint partner_settlement_components_segment_check check (segment_end >= segment_start),
  constraint partner_settlement_components_origin_check check (
    (source_kind = 'regular' and origin_component_id is null)
    or (source_kind = 'late_correction' and origin_component_id is not null)
  ),
  constraint partner_settlement_components_amounts_check check (
    gross_sales >= 0 and discount_total >= 0 and courtesy_total >= 0 and reversal_total >= 0
    and prorated_rent >= 0 and prorated_minimum_guarantee >= 0
    and (source_kind = 'late_correction' or (commission_amount >= 0 and minimum_guarantee_topup >= 0 and contribution_amount >= 0))
  )
);

create unique index partner_settlement_components_regular_unique
  on public.partner_settlement_components(settlement_id, revision_id)
  where source_kind = 'regular';
create unique index partner_settlement_components_late_unique
  on public.partner_settlement_components(settlement_id, origin_component_id)
  where source_kind = 'late_correction';

create table public.partner_settlement_sources (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  settlement_id uuid not null,
  component_id uuid not null,
  source_kind public.partner_settlement_source_kind not null,
  order_id uuid not null,
  order_item_id uuid not null,
  correction_id uuid,
  correction_item_id uuid,
  original_settlement_id uuid,
  occurred_at timestamptz not null,
  completed_at timestamptz,
  point_id uuid,
  point_name text,
  product_id uuid not null,
  product_name text not null,
  category_id uuid,
  category_name text not null,
  stay_id uuid,
  reservation_code text,
  room_number text,
  billing_mode public.consumption_billing_mode,
  payment_method public.consumption_payment_method,
  disposition public.consumption_order_disposition not null,
  provider_type public.product_provider_type not null,
  gross_amount numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  reversal_amount numeric(14,2) not null default 0,
  operational_net numeric(14,2) not null default 0,
  hotel_collected numeric(14,2) not null default 0,
  partner_direct numeric(14,2) not null default 0,
  source_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  constraint partner_settlement_sources_settlement_hotel_fkey foreign key (settlement_id, hotel_id)
    references public.partner_settlements(id, hotel_id) on delete restrict,
  constraint partner_settlement_sources_component_hotel_fkey foreign key (component_id, hotel_id)
    references public.partner_settlement_components(id, hotel_id) on delete restrict,
  constraint partner_settlement_sources_order_hotel_fkey foreign key (order_id, hotel_id)
    references public.consumption_orders(id, hotel_id) on delete restrict,
  constraint partner_settlement_sources_item_hotel_fkey foreign key (order_item_id, hotel_id)
    references public.consumption_order_items(id, hotel_id) on delete restrict,
  constraint partner_settlement_sources_correction_hotel_fkey foreign key (correction_id, hotel_id)
    references public.consumption_corrections(id, hotel_id) on delete restrict,
  constraint partner_settlement_sources_correction_item_fkey foreign key (correction_item_id)
    references public.consumption_correction_items(id) on delete restrict,
  constraint partner_settlement_sources_original_hotel_fkey foreign key (original_settlement_id, hotel_id)
    references public.partner_settlements(id, hotel_id) on delete restrict,
  constraint partner_settlement_sources_amounts_check check (
    gross_amount >= 0 and discount_amount >= 0 and reversal_amount >= 0
  ),
  constraint partner_settlement_sources_shape_check check (
    (source_kind = 'regular' and correction_id is null and correction_item_id is null and original_settlement_id is null)
    or (source_kind = 'late_correction' and correction_id is not null and correction_item_id is not null and original_settlement_id is not null)
  )
);

create unique index partner_settlement_sources_regular_item_unique
  on public.partner_settlement_sources(order_item_id) where source_kind = 'regular';
create unique index partner_settlement_sources_correction_item_unique
  on public.partner_settlement_sources(correction_item_id) where correction_item_id is not null;
create index partner_settlement_sources_dimensions_idx
  on public.partner_settlement_sources(hotel_id, occurred_at, point_id, product_id, category_id);

create table public.partner_settlement_payments (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  settlement_id uuid not null,
  financial_transaction_id uuid not null,
  amount numeric(14,2) not null,
  direction public.partner_settlement_direction not null,
  payment_method public.consumption_payment_method not null,
  paid_at timestamptz not null,
  reference_code text,
  notes text,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  reversal_of_id uuid references public.partner_settlement_payments(id) on delete restrict,
  constraint partner_settlement_payments_settlement_hotel_fkey foreign key (settlement_id, hotel_id)
    references public.partner_settlements(id, hotel_id) on delete restrict,
  constraint partner_settlement_payments_transaction_hotel_fkey foreign key (financial_transaction_id, hotel_id)
    references public.financial_transactions(id, hotel_id) on delete restrict,
  constraint partner_settlement_payments_amount_check check (amount > 0),
  constraint partner_settlement_payments_direction_check check (direction <> 'balanced'),
  constraint partner_settlement_payments_reference_check check (reference_code is null or length(btrim(reference_code)) between 1 and 200),
  constraint partner_settlement_payments_notes_check check (notes is null or length(btrim(notes)) between 3 and 1000),
  constraint partner_settlement_payments_hotel_idempotency_unique unique (hotel_id, idempotency_key),
  constraint partner_settlement_payments_transaction_unique unique (financial_transaction_id),
  constraint partner_settlement_payments_reversal_unique unique (reversal_of_id),
  constraint partner_settlement_payments_not_self_check check (reversal_of_id is null or reversal_of_id <> id)
);

create table public.partner_settlement_events (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  settlement_id uuid not null,
  action text not null,
  actor_id uuid references public.users(id) on delete restrict,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint partner_settlement_events_settlement_hotel_fkey foreign key (settlement_id, hotel_id)
    references public.partner_settlements(id, hotel_id) on delete restrict,
  constraint partner_settlement_events_action_check check (length(btrim(action)) between 1 and 80)
);

alter table public.financial_transactions add column partner_settlement_id uuid;
alter table public.financial_transactions add constraint financial_transactions_partner_settlement_hotel_fkey
  foreign key (partner_settlement_id, hotel_id) references public.partner_settlements(id, hotel_id) on delete restrict;

create trigger trg_consumption_management_settings_updated_at before update on public.consumption_management_settings
  for each row execute function public.set_updated_at();
create trigger trg_partner_settlements_updated_at before update on public.partner_settlements
  for each row execute function public.set_updated_at();

create or replace function public.validate_partner_settlement_scope()
returns trigger language plpgsql set search_path = public as $$
declare v_hotel uuid;
begin
  if tg_table_name = 'consumption_management_settings' then
    if new.last_changed_by is not null and not public.maintenance_user_has_hotel_scope(new.last_changed_by, new.hotel_id) then
      raise exception 'management settings actor crosses hotel scope' using errcode = '23514';
    end if;
    return new;
  end if;
  if tg_table_name = 'partner_settlements' then
    select hotel_id into v_hotel from public.commercial_partners where id = new.partner_id;
  elsif tg_table_name = 'partner_settlement_components' then
    select hotel_id into v_hotel from public.partner_settlements where id = new.settlement_id;
  elsif tg_table_name = 'partner_settlement_sources' then
    select hotel_id into v_hotel from public.partner_settlement_components where id = new.component_id and settlement_id = new.settlement_id;
  elsif tg_table_name = 'partner_settlement_payments' then
    select hotel_id into v_hotel from public.partner_settlements where id = new.settlement_id;
  elsif tg_table_name = 'partner_settlement_events' then
    select hotel_id into v_hotel from public.partner_settlements where id = new.settlement_id;
  end if;
  if v_hotel is distinct from new.hotel_id then
    raise exception 'partner settlement crosses hotel scope' using errcode = '23514';
  end if;
  if tg_table_name in ('partner_settlements', 'partner_settlement_payments') then
    if new.created_by is not null and not public.maintenance_user_has_hotel_scope(new.created_by, new.hotel_id) then
      raise exception 'partner settlement actor crosses hotel scope' using errcode = '23514';
    end if;
  elsif tg_table_name = 'partner_settlement_events' then
    if new.actor_id is not null and not public.maintenance_user_has_hotel_scope(new.actor_id, new.hotel_id) then
      raise exception 'partner settlement actor crosses hotel scope' using errcode = '23514';
    end if;
  end if;
  if tg_table_name = 'partner_settlement_sources' then
    if new.correction_item_id is not null and not exists (
      select 1 from public.consumption_correction_items item
      where item.id = new.correction_item_id and item.correction_id = new.correction_id and item.order_item_id = new.order_item_id
    ) then
      raise exception 'partner settlement correction source is inconsistent' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_management_settings_scope before insert or update on public.consumption_management_settings
  for each row execute function public.validate_partner_settlement_scope();
create trigger trg_partner_settlements_scope before insert or update on public.partner_settlements
  for each row execute function public.validate_partner_settlement_scope();
create trigger trg_partner_settlement_components_scope before insert or update on public.partner_settlement_components
  for each row execute function public.validate_partner_settlement_scope();
create trigger trg_partner_settlement_sources_scope before insert or update on public.partner_settlement_sources
  for each row execute function public.validate_partner_settlement_scope();
create trigger trg_partner_settlement_payments_scope before insert on public.partner_settlement_payments
  for each row execute function public.validate_partner_settlement_scope();
create trigger trg_partner_settlement_events_scope before insert on public.partner_settlement_events
  for each row execute function public.validate_partner_settlement_scope();

create or replace function public.protect_partner_settlement_child()
returns trigger language plpgsql set search_path = public as $$
declare v_status public.partner_settlement_status;
begin
  select status into v_status from public.partner_settlements where id = coalesce(old.settlement_id, new.settlement_id);
  if v_status in ('draft', 'in_review') then return case when tg_op = 'DELETE' then old else new end; end if;
  raise exception 'closed partner settlement records are immutable' using errcode = '23514';
end;
$$;

create or replace function public.protect_partner_settlement_header()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'partner settlements cannot be deleted' using errcode = '23514'; end if;
  if old.status in ('approved', 'settled') and (
    new.hotel_id is distinct from old.hotel_id or new.partner_id is distinct from old.partner_id
    or new.period_start is distinct from old.period_start or new.period_end is distinct from old.period_end
    or new.currency is distinct from old.currency or new.direction is distinct from old.direction
    or new.gross_sales is distinct from old.gross_sales or new.discount_total is distinct from old.discount_total
    or new.courtesy_total is distinct from old.courtesy_total or new.reversal_total is distinct from old.reversal_total
    or new.operational_net is distinct from old.operational_net or new.hotel_collected is distinct from old.hotel_collected
    or new.partner_direct is distinct from old.partner_direct or new.rent_total is distinct from old.rent_total
    or new.commission_total is distinct from old.commission_total or new.minimum_guarantee_topup is distinct from old.minimum_guarantee_topup
    or new.contribution_total is distinct from old.contribution_total or new.net_settlement is distinct from old.net_settlement
    or new.due_on is distinct from old.due_on or new.source_fingerprint is distinct from old.source_fingerprint
    or new.statement_snapshot is distinct from old.statement_snapshot or new.approved_by is distinct from old.approved_by
    or new.approved_at is distinct from old.approved_at
  ) then raise exception 'approved partner settlement statement is immutable' using errcode = '23514'; end if;
  return new;
end;
$$;

create trigger trg_partner_settlements_protect before update or delete on public.partner_settlements
  for each row execute function public.protect_partner_settlement_header();
create trigger trg_partner_settlement_components_protect before update or delete on public.partner_settlement_components
  for each row execute function public.protect_partner_settlement_child();
create trigger trg_partner_settlement_sources_protect before update or delete on public.partner_settlement_sources
  for each row execute function public.protect_partner_settlement_child();
create trigger trg_partner_settlement_payments_immutable before update or delete on public.partner_settlement_payments
  for each row execute function public.protect_stay_account_record();
create trigger trg_partner_settlement_events_immutable before update or delete on public.partner_settlement_events
  for each row execute function public.protect_stay_account_record();

create or replace function public.protect_generated_financial_transaction()
returns trigger language plpgsql as $$
begin
  if old.maintenance_cost_item_id is not null or old.maintenance_recovery_id is not null
    or old.partner_settlement_id is not null
    or exists (select 1 from public.stay_folio_entries where financial_transaction_id = old.id) then
    raise exception 'generated financial transactions require compensating operations' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.partner_settlement_live_fingerprint(
  p_hotel_id uuid, p_partner_id uuid, p_period_start date
) returns text language sql stable set search_path = public as $$
  with hotel_context as (
    select timezone from public.hotels where id = p_hotel_id
  ), item_state as (
    select item.id::text || ':' || effective.effective_quantity::text || ':' || effective.effective_discount::text || ':' || effective.effective_net_amount::text as value
    from public.consumption_order_item_effective effective
    join public.consumption_order_items item on item.id = effective.id
    join public.consumption_orders orders on orders.id = item.order_id and orders.hotel_id = p_hotel_id
    cross join hotel_context hotel
    where item.commercial_partner_id = p_partner_id and not orders.is_legacy
      and (orders.occurred_at at time zone hotel.timezone)::date between p_period_start and (p_period_start + interval '1 month - 1 day')::date
  ), correction_state as (
    select correction_item.id::text || ':' || correction.status::text || ':' || coalesce(correction.completed_at::text, '') as value
    from public.consumption_correction_items correction_item
    join public.consumption_corrections correction on correction.id = correction_item.correction_id and correction.hotel_id = p_hotel_id
    join public.consumption_order_items item on item.id = correction_item.order_item_id and item.commercial_partner_id = p_partner_id
    where correction.status <> 'rejected'
  ), revision_state as (
    select revision.id::text || ':' || revision.updated_at::text || ':' || revision.status::text || ':' || coalesce(revision.ends_on::text, '') as value
    from public.commercial_agreement_revisions revision
    join public.commercial_agreements agreement on agreement.id = revision.agreement_id and agreement.hotel_id = p_hotel_id
    where agreement.partner_id = p_partner_id
      and revision.starts_on <= (p_period_start + interval '1 month - 1 day')::date
      and coalesce(revision.ends_on, 'infinity'::date) >= p_period_start
  )
  select md5(concat_ws('|', p_hotel_id::text, p_partner_id::text, p_period_start::text,
    coalesce((select string_agg(value, ',' order by value) from item_state), ''),
    coalesce((select string_agg(value, ',' order by value) from correction_state), ''),
    coalesce((select string_agg(value, ',' order by value) from revision_state), '')));
$$;

create or replace function public.refresh_partner_settlement(
  p_hotel_id uuid, p_partner_id uuid, p_period_start date, p_actor_id uuid,
  p_expected_version bigint default null
) returns jsonb language plpgsql set search_path = public as $$
declare
  v_hotel record; v_settings public.consumption_management_settings%rowtype; v_settlement public.partner_settlements%rowtype;
  v_revision record; v_component_id uuid; v_origin record; v_period_end date;
  v_days numeric; v_month_days numeric; v_divisor numeric; v_monthly_rent numeric; v_monthly_minimum numeric;
  v_gross numeric(14,2); v_discount numeric(14,2); v_courtesy numeric(14,2); v_reversal numeric(14,2);
  v_net numeric(14,2); v_hotel_collected numeric(14,2); v_partner_direct numeric(14,2);
  v_rent numeric(14,2); v_commission numeric(14,2); v_minimum numeric(14,2); v_topup numeric(14,2); v_contribution numeric(14,2);
  v_delta_net numeric(14,2); v_delta_hotel numeric(14,2); v_delta_partner numeric(14,2);
  v_last_base numeric(14,2); v_last_contribution numeric(14,2); v_restated_contribution numeric(14,2); v_delta_contribution numeric(14,2);
  v_fingerprint text;
begin
  if not public.maintenance_user_has_hotel_scope(p_actor_id, p_hotel_id) then return jsonb_build_object('result','actor_outside_hotel'); end if;
  if p_period_start <> date_trunc('month', p_period_start)::date then return jsonb_build_object('result','invalid_period'); end if;
  select id, timezone, currency into v_hotel from public.hotels where id = p_hotel_id and is_active;
  if not found then return jsonb_build_object('result','hotel_not_found'); end if;
  if not exists (select 1 from public.commercial_partners where id=p_partner_id and hotel_id=p_hotel_id) then return jsonb_build_object('result','partner_not_found'); end if;
  select * into v_settings from public.consumption_management_settings where hotel_id=p_hotel_id;
  if p_period_start < v_settings.settlement_tracking_starts_on then return jsonb_build_object('result','period_before_tracking'); end if;
  v_period_end := (p_period_start + interval '1 month - 1 day')::date;

  select * into v_settlement from public.partner_settlements
  where hotel_id=p_hotel_id and partner_id=p_partner_id and period_start=p_period_start for update;
  if found then
    if p_expected_version is null then return jsonb_build_object('result','settlement_already_exists'); end if;
    if v_settlement.status in ('approved','settled') then return jsonb_build_object('result','settlement_invalid_state'); end if;
    if p_expected_version is not null and p_expected_version <> v_settlement.version then return jsonb_build_object('result','settlement_version_conflict'); end if;
    delete from public.partner_settlement_sources where settlement_id=v_settlement.id;
    delete from public.partner_settlement_components where settlement_id=v_settlement.id;
  else
    insert into public.partner_settlements(
      hotel_id, partner_id, period_start, period_end, currency, due_on, created_by, prepared_by, prepared_at
    ) values (
      p_hotel_id, p_partner_id, p_period_start, v_period_end, v_hotel.currency,
      v_period_end + v_settings.payment_due_days, p_actor_id, p_actor_id, now()
    ) returning * into v_settlement;
  end if;

  v_month_days := extract(day from v_period_end);
  for v_revision in
    select revision.*, agreement.internal_number
    from public.commercial_agreement_revisions revision
    join public.commercial_agreements agreement on agreement.id=revision.agreement_id and agreement.hotel_id=revision.hotel_id
    where revision.hotel_id=p_hotel_id and agreement.partner_id=p_partner_id
      and revision.status in ('activated','terminated')
      and revision.starts_on <= v_period_end and coalesce(revision.ends_on, 'infinity'::date) >= p_period_start
    order by revision.starts_on, revision.version
  loop
    select
      coalesce(sum(case when orders.disposition <> 'legacy_unclassified' then item.item_total_amount else 0 end),0),
      coalesce(sum(case when orders.disposition='charged' then effective.effective_discount else 0 end),0),
      coalesce(sum(case when orders.disposition='courtesy' then item.item_total_amount else 0 end),0),
      coalesce(sum(case when orders.disposition='charged' then greatest(item.net_amount-effective.effective_net_amount,0) else 0 end),0),
      coalesce(sum(case when orders.disposition='charged' then effective.effective_net_amount else 0 end),0),
      coalesce(sum(case when orders.disposition='charged' and orders.billing_mode in ('stay_folio','hotel_immediate') then effective.effective_net_amount else 0 end),0),
      coalesce(sum(case when orders.disposition='charged' and orders.billing_mode='partner_direct' then effective.effective_net_amount else 0 end),0)
    into v_gross,v_discount,v_courtesy,v_reversal,v_net,v_hotel_collected,v_partner_direct
    from public.consumption_order_item_effective effective
    join public.consumption_order_items item on item.id=effective.id
    join public.consumption_orders orders on orders.id=item.order_id and orders.hotel_id=p_hotel_id
    where item.commercial_partner_id=p_partner_id and item.commercial_revision_id=v_revision.id and not orders.is_legacy
      and (orders.occurred_at at time zone v_hotel.timezone)::date between p_period_start and v_period_end;

    v_days := greatest(0, least(v_period_end, coalesce(v_revision.ends_on,v_period_end))-greatest(p_period_start,v_revision.starts_on)+1);
    v_divisor := case v_revision.rent_frequency when 'quarterly' then 3 when 'yearly' then 12 else 1 end;
    v_monthly_rent := coalesce(v_revision.fixed_rent,0)/v_divisor;
    v_monthly_minimum := coalesce(v_revision.minimum_guarantee,0)/v_divisor;
    v_rent := round(v_monthly_rent*v_days/v_month_days,2);
    v_minimum := round(v_monthly_minimum*v_days/v_month_days,2);
    v_commission := round(v_net*coalesce(v_revision.commission_percentage,0)/100,2);
    v_contribution := case v_revision.commercial_model
      when 'fixed_rent' then v_rent
      when 'revenue_share' then v_commission
      else greatest(v_rent+v_commission,v_minimum) end;
    v_topup := case when v_revision.commercial_model='hybrid' then greatest(v_minimum-(v_rent+v_commission),0) else 0 end;

    insert into public.partner_settlement_components(
      hotel_id,settlement_id,source_kind,agreement_id,revision_id,agreement_number,revision_version,
      segment_start,segment_end,commercial_model,fixed_rent,rent_frequency,commission_percentage,minimum_guarantee,payment_recipient,
      gross_sales,discount_total,courtesy_total,reversal_total,operational_net,hotel_collected,partner_direct,
      prorated_rent,commission_amount,prorated_minimum_guarantee,minimum_guarantee_topup,contribution_amount,net_settlement_amount,calculation_memory
    ) values (
      p_hotel_id,v_settlement.id,'regular',v_revision.agreement_id,v_revision.id,v_revision.internal_number,v_revision.version,
      greatest(p_period_start,v_revision.starts_on),least(v_period_end,coalesce(v_revision.ends_on,v_period_end)),v_revision.commercial_model,
      v_revision.fixed_rent,v_revision.rent_frequency,v_revision.commission_percentage,v_revision.minimum_guarantee,v_revision.payment_recipient,
      v_gross,v_discount,v_courtesy,v_reversal,v_net,v_hotel_collected,v_partner_direct,
      v_rent,v_commission,v_minimum,v_topup,v_contribution,v_hotel_collected-v_contribution,
      jsonb_build_object('active_days',v_days,'month_days',v_month_days,'rent_divisor',v_divisor,'commission_base',v_net)
    ) returning id into v_component_id;

    insert into public.partner_settlement_sources(
      hotel_id,settlement_id,component_id,source_kind,order_id,order_item_id,occurred_at,point_id,point_name,
      product_id,product_name,category_id,category_name,stay_id,reservation_code,room_number,billing_mode,payment_method,
      disposition,provider_type,gross_amount,discount_amount,reversal_amount,operational_net,hotel_collected,partner_direct,source_snapshot
    )
    select p_hotel_id,v_settlement.id,v_component_id,'regular',orders.id,item.id,orders.occurred_at,orders.point_id,orders.point_name_snapshot,
      item.product_id,item.product_name_snapshot,item.category_id,item.category_name_snapshot,orders.stay_id,orders.reservation_code_snapshot,
      orders.room_number_snapshot,orders.billing_mode,orders.payment_method,orders.disposition,item.provider_type_snapshot,
      case when orders.disposition='legacy_unclassified' then 0 else item.item_total_amount end,
      case when orders.disposition='charged' then effective.effective_discount else 0 end,
      case when orders.disposition='charged' then greatest(item.net_amount-effective.effective_net_amount,0) else 0 end,
      case when orders.disposition='charged' then effective.effective_net_amount else 0 end,
      case when orders.disposition='charged' and orders.billing_mode in ('stay_folio','hotel_immediate') then effective.effective_net_amount else 0 end,
      case when orders.disposition='charged' and orders.billing_mode='partner_direct' then effective.effective_net_amount else 0 end,
      jsonb_build_object('order_id',orders.id,'item_id',item.id,'quantity',item.quantity,'effective_quantity',effective.effective_quantity,
        'unit_price',item.charged_unit_price,'terms',item.commercial_terms_snapshot,'policy',item.billing_policy_snapshot)
    from public.consumption_order_item_effective effective
    join public.consumption_order_items item on item.id=effective.id
    join public.consumption_orders orders on orders.id=item.order_id and orders.hotel_id=p_hotel_id
    where item.commercial_partner_id=p_partner_id and item.commercial_revision_id=v_revision.id and not orders.is_legacy
      and (orders.occurred_at at time zone v_hotel.timezone)::date between p_period_start and v_period_end;
  end loop;

  for v_origin in
    select distinct origin.*
    from public.partner_settlement_components origin
    join public.partner_settlements original_settlement on original_settlement.id=origin.settlement_id
    join public.partner_settlement_sources original_source on original_source.component_id=origin.id and original_source.source_kind='regular'
    join public.consumption_correction_items correction_item on correction_item.order_item_id=original_source.order_item_id
    join public.consumption_corrections correction on correction.id=correction_item.correction_id and correction.status='completed'
    where original_settlement.hotel_id=p_hotel_id and original_settlement.partner_id=p_partner_id
      and original_settlement.status in ('approved','settled') and original_settlement.period_end < p_period_start
      and correction.completed_at <= ((v_period_end+1)::timestamp at time zone v_hotel.timezone)
      and not exists (select 1 from public.partner_settlement_sources recognized where recognized.correction_item_id=correction_item.id)
  loop
    select
      -coalesce(sum(correction_item.previous_net-correction_item.resulting_net),0),
      -coalesce(sum(case when orders.billing_mode in ('stay_folio','hotel_immediate') then correction_item.previous_net-correction_item.resulting_net else 0 end),0),
      -coalesce(sum(case when orders.billing_mode='partner_direct' then correction_item.previous_net-correction_item.resulting_net else 0 end),0)
    into v_delta_net,v_delta_hotel,v_delta_partner
    from public.partner_settlement_sources original_source
    join public.consumption_correction_items correction_item on correction_item.order_item_id=original_source.order_item_id
    join public.consumption_corrections correction on correction.id=correction_item.correction_id and correction.status='completed'
    join public.consumption_orders orders on orders.id=original_source.order_id
    where original_source.component_id=v_origin.id
      and correction.completed_at <= ((v_period_end+1)::timestamp at time zone v_hotel.timezone)
      and not exists (select 1 from public.partner_settlement_sources recognized where recognized.correction_item_id=correction_item.id);
    if v_delta_net = 0 then continue; end if;
    select v_origin.operational_net+coalesce(sum(adjustment.operational_net),0),
      v_origin.contribution_amount+coalesce(sum(adjustment.contribution_amount),0)
    into v_last_base,v_last_contribution
    from public.partner_settlement_components adjustment
    where adjustment.origin_component_id=v_origin.id;
    v_commission := round((v_last_base+v_delta_net)*coalesce(v_origin.commission_percentage,0)/100,2);
    v_restated_contribution := case v_origin.commercial_model
      when 'fixed_rent' then v_origin.prorated_rent
      when 'revenue_share' then v_commission
      else greatest(v_origin.prorated_rent+v_commission,v_origin.prorated_minimum_guarantee) end;
    v_delta_contribution := v_restated_contribution-v_last_contribution;
    insert into public.partner_settlement_components(
      hotel_id,settlement_id,source_kind,agreement_id,revision_id,origin_component_id,agreement_number,revision_version,
      segment_start,segment_end,commercial_model,fixed_rent,rent_frequency,commission_percentage,minimum_guarantee,payment_recipient,
      operational_net,hotel_collected,partner_direct,commission_amount,contribution_amount,net_settlement_amount,calculation_memory
    ) values (
      p_hotel_id,v_settlement.id,'late_correction',v_origin.agreement_id,v_origin.revision_id,v_origin.id,v_origin.agreement_number,v_origin.revision_version,
      v_origin.segment_start,v_origin.segment_end,v_origin.commercial_model,v_origin.fixed_rent,v_origin.rent_frequency,
      v_origin.commission_percentage,v_origin.minimum_guarantee,v_origin.payment_recipient,
      v_delta_net,v_delta_hotel,v_delta_partner,v_delta_contribution,v_delta_contribution,v_delta_hotel-v_delta_contribution,
      jsonb_build_object('previous_base',v_last_base,'restated_base',v_last_base+v_delta_net,
        'previous_contribution',v_last_contribution,'restated_contribution',v_restated_contribution)
    ) returning id into v_component_id;
    update public.partner_settlement_components set reversal_total = -v_delta_net where id = v_component_id;
    insert into public.partner_settlement_sources(
      hotel_id,settlement_id,component_id,source_kind,order_id,order_item_id,correction_id,correction_item_id,original_settlement_id,
      occurred_at,completed_at,point_id,point_name,product_id,product_name,category_id,category_name,stay_id,reservation_code,room_number,
      billing_mode,payment_method,disposition,provider_type,reversal_amount,operational_net,hotel_collected,partner_direct,source_snapshot
    )
    select p_hotel_id,v_settlement.id,v_component_id,'late_correction',orders.id,item.id,correction.id,correction_item.id,original_source.settlement_id,
      orders.occurred_at,correction.completed_at,orders.point_id,orders.point_name_snapshot,item.product_id,item.product_name_snapshot,
      item.category_id,item.category_name_snapshot,orders.stay_id,orders.reservation_code_snapshot,orders.room_number_snapshot,
      orders.billing_mode,orders.payment_method,orders.disposition,item.provider_type_snapshot,
      correction_item.previous_net-correction_item.resulting_net,
      -(correction_item.previous_net-correction_item.resulting_net),
      case when orders.billing_mode in ('stay_folio','hotel_immediate') then -(correction_item.previous_net-correction_item.resulting_net) else 0 end,
      case when orders.billing_mode='partner_direct' then -(correction_item.previous_net-correction_item.resulting_net) else 0 end,
      jsonb_build_object('correction_id',correction.id,'correction_item_id',correction_item.id,'reason',correction.reason,
        'previous_net',correction_item.previous_net,'resulting_net',correction_item.resulting_net)
    from public.partner_settlement_sources original_source
    join public.consumption_order_items item on item.id=original_source.order_item_id
    join public.consumption_orders orders on orders.id=original_source.order_id
    join public.consumption_correction_items correction_item on correction_item.order_item_id=original_source.order_item_id
    join public.consumption_corrections correction on correction.id=correction_item.correction_id and correction.status='completed'
    where original_source.component_id=v_origin.id
      and correction.completed_at <= ((v_period_end+1)::timestamp at time zone v_hotel.timezone)
      and not exists (select 1 from public.partner_settlement_sources recognized where recognized.correction_item_id=correction_item.id);
  end loop;

  select coalesce(sum(gross_sales),0),coalesce(sum(discount_total),0),coalesce(sum(courtesy_total),0),coalesce(sum(reversal_total),0),
    greatest(coalesce(sum(operational_net),0),0),greatest(coalesce(sum(hotel_collected),0),0),greatest(coalesce(sum(partner_direct),0),0),
    coalesce(sum(prorated_rent),0),coalesce(sum(commission_amount),0),coalesce(sum(minimum_guarantee_topup),0),
    coalesce(sum(contribution_amount),0),coalesce(sum(net_settlement_amount),0)
  into v_gross,v_discount,v_courtesy,v_reversal,v_net,v_hotel_collected,v_partner_direct,v_rent,v_commission,v_topup,v_contribution,v_delta_net
  from public.partner_settlement_components where settlement_id=v_settlement.id;
  v_fingerprint := public.partner_settlement_live_fingerprint(p_hotel_id,p_partner_id,p_period_start);
  update public.partner_settlements set
    status='draft',version=version+case when created_at=updated_at then 0 else 1 end,
    gross_sales=v_gross,discount_total=v_discount,courtesy_total=v_courtesy,reversal_total=v_reversal,
    operational_net=v_net,hotel_collected=v_hotel_collected,partner_direct=v_partner_direct,
    rent_total=v_rent,commission_total=v_commission,minimum_guarantee_topup=v_topup,
    contribution_total=v_contribution,net_settlement=v_delta_net,
    direction=case when v_delta_net>0 then 'hotel_to_partner'::public.partner_settlement_direction when v_delta_net<0 then 'partner_to_hotel'::public.partner_settlement_direction else 'balanced'::public.partner_settlement_direction end,
    due_on=v_period_end+v_settings.payment_due_days,source_fingerprint=v_fingerprint,statement_snapshot=null,
    prepared_by=p_actor_id,prepared_at=now(),submitted_by=null,submitted_at=null,updated_at=now()
  where id=v_settlement.id returning * into v_settlement;
  insert into public.partner_settlement_events(hotel_id,settlement_id,action,actor_id,details)
  values (p_hotel_id,v_settlement.id,'calculated',p_actor_id,jsonb_build_object('version',v_settlement.version,'fingerprint',v_fingerprint));
  return jsonb_build_object('result','ok','id',v_settlement.id,'created',v_settlement.created_at=v_settlement.updated_at,'version',v_settlement.version);
end;
$$;

create or replace function public.submit_partner_settlement(
  p_hotel_id uuid,p_settlement_id uuid,p_actor_id uuid,p_expected_version bigint
) returns jsonb language plpgsql set search_path=public as $$
declare v_settlement public.partner_settlements%rowtype;
begin
  if not public.maintenance_user_has_hotel_scope(p_actor_id,p_hotel_id) then return jsonb_build_object('result','actor_outside_hotel'); end if;
  select * into v_settlement from public.partner_settlements where id=p_settlement_id and hotel_id=p_hotel_id for update;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if v_settlement.status<>'draft' then return jsonb_build_object('result','settlement_invalid_state'); end if;
  if v_settlement.version<>p_expected_version then return jsonb_build_object('result','settlement_version_conflict'); end if;
  update public.partner_settlements set status='in_review',version=version+1,prepared_by=p_actor_id,prepared_at=now(),submitted_by=p_actor_id,submitted_at=now()
  where id=p_settlement_id returning * into v_settlement;
  insert into public.partner_settlement_events(hotel_id,settlement_id,action,actor_id,details)
  values(p_hotel_id,p_settlement_id,'submitted',p_actor_id,jsonb_build_object('version',v_settlement.version));
  return jsonb_build_object('result','ok','id',p_settlement_id,'version',v_settlement.version);
end;
$$;

create or replace function public.decide_partner_settlement(
  p_hotel_id uuid,p_settlement_id uuid,p_actor_id uuid,p_expected_version bigint,p_decision text,p_reason text default null
) returns jsonb language plpgsql set search_path=public as $$
declare v_settlement public.partner_settlements%rowtype; v_timezone text; v_live text; v_snapshot jsonb;
begin
  if not public.maintenance_user_has_hotel_scope(p_actor_id,p_hotel_id) then return jsonb_build_object('result','actor_outside_hotel'); end if;
  select * into v_settlement from public.partner_settlements settlement
  where settlement.id=p_settlement_id and settlement.hotel_id=p_hotel_id for update;
  if not found then return jsonb_build_object('result','not_found'); end if;
  select timezone into v_timezone from public.hotels where id=p_hotel_id;
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
  if (now() at time zone v_timezone)::date<=v_settlement.period_end then return jsonb_build_object('result','settlement_month_still_open'); end if;
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
    settled_by=case when net_settlement=0 then p_actor_id else null end,settled_at=case when net_settlement=0 then now() else null end
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
  v_fingerprint text; v_transaction_id uuid; v_payment_id uuid; v_expected numeric(14,2);
begin
  if not public.maintenance_user_has_hotel_scope(p_actor_id,p_hotel_id) then return jsonb_build_object('result','actor_outside_hotel'); end if;
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
  if p_paid_at>now() then return jsonb_build_object('result','paid_at_in_future'); end if;
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
  if p_reversed_at>now() then return jsonb_build_object('result','paid_at_in_future'); end if;
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

create or replace function public.get_consumption_analytics(
  p_hotel_id uuid,p_from date,p_to date,p_dimension text default 'day',p_point_id uuid default null,
  p_category_id uuid default null,p_product_id uuid default null,p_stay_search text default null,
  p_disposition public.consumption_order_disposition default null,p_billing_mode public.consumption_billing_mode default null,
  p_payment_method public.consumption_payment_method default null,p_provider_type public.product_provider_type default null,
  p_partner_id uuid default null,p_operator_id uuid default null,p_offset integer default 0,p_limit integer default 50
) returns jsonb language plpgsql stable set search_path=public as $$
declare v_timezone text; v_summary jsonb; v_series jsonb; v_rows jsonb; v_total integer;
begin
  select timezone into v_timezone from public.hotels where id=p_hotel_id and is_active;
  if not found then return jsonb_build_object('result','hotel_not_found'); end if;
  if p_from>p_to or p_to-p_from>730 or p_dimension not in ('day','point','category','product','stay','billing_mode','payment_method','provider','partner','operator') then
    return jsonb_build_object('result','invalid_filters');
  end if;
  with base as (
    select orders.*,item.id item_id,item.product_id,item.category_id,item.commercial_partner_id,item.item_total_amount,
      item.product_name_snapshot,item.category_name_snapshot,item.provider_type_snapshot,effective.effective_discount,effective.effective_net_amount,
      coalesce(operator.name,'Sistema') operator_name,(orders.occurred_at at time zone v_timezone)::date local_day
    from public.consumption_order_item_effective effective
    join public.consumption_order_items item on item.id=effective.id
    join public.consumption_orders orders on orders.id=item.order_id and orders.hotel_id=p_hotel_id
    left join public.users operator on operator.id=orders.posted_by
    where (orders.occurred_at at time zone v_timezone)::date between p_from and p_to
      and (p_point_id is null or orders.point_id=p_point_id) and (p_category_id is null or item.category_id=p_category_id)
      and (p_product_id is null or item.product_id=p_product_id)
      and (p_stay_search is null or orders.room_number_snapshot ilike '%'||p_stay_search||'%' or orders.reservation_code_snapshot ilike '%'||p_stay_search||'%' or orders.guest_name_snapshot ilike '%'||p_stay_search||'%')
      and (p_disposition is null or orders.disposition=p_disposition) and (p_billing_mode is null or orders.billing_mode=p_billing_mode)
      and (p_payment_method is null or orders.payment_method=p_payment_method) and (p_provider_type is null or item.provider_type_snapshot=p_provider_type)
      and (p_partner_id is null or item.commercial_partner_id=p_partner_id) and (p_operator_id is null or orders.posted_by=p_operator_id)
  ) select jsonb_build_object(
      'gross_sales',coalesce(sum(case when not is_legacy then item_total_amount else 0 end),0),
      'discount_total',coalesce(sum(case when disposition='charged' then effective_discount else 0 end),0),
      'courtesy_total',coalesce(sum(case when disposition='courtesy' then item_total_amount else 0 end),0),
      'reversal_total',coalesce(sum(case when disposition='charged' then greatest(item_total_amount-effective_net_amount,0) else 0 end),0),
      'operational_net',coalesce(sum(case when disposition='charged' and not is_legacy then effective_net_amount else 0 end),0),
      'hotel_collected',coalesce(sum(case when disposition='charged' and billing_mode in ('stay_folio','hotel_immediate') then effective_net_amount else 0 end),0),
      'partner_direct',coalesce(sum(case when disposition='charged' and billing_mode='partner_direct' then effective_net_amount else 0 end),0),
      'order_count',count(distinct case when not is_legacy then id end),'legacy_count',count(distinct case when is_legacy then id end)
    ) into v_summary from base;
  with base as (
    select orders.id,orders.disposition,orders.billing_mode,orders.is_legacy,item.item_total_amount,effective.effective_net_amount,
      (orders.occurred_at at time zone v_timezone)::date local_day
    from public.consumption_order_item_effective effective join public.consumption_order_items item on item.id=effective.id
    join public.consumption_orders orders on orders.id=item.order_id and orders.hotel_id=p_hotel_id
    where (orders.occurred_at at time zone v_timezone)::date between p_from and p_to
      and (p_point_id is null or orders.point_id=p_point_id) and (p_category_id is null or item.category_id=p_category_id)
       and (p_product_id is null or item.product_id=p_product_id)
       and (p_stay_search is null or orders.room_number_snapshot ilike '%'||p_stay_search||'%' or orders.reservation_code_snapshot ilike '%'||p_stay_search||'%' or orders.guest_name_snapshot ilike '%'||p_stay_search||'%')
       and (p_disposition is null or orders.disposition=p_disposition) and (p_billing_mode is null or orders.billing_mode=p_billing_mode)
      and (p_payment_method is null or orders.payment_method=p_payment_method) and (p_provider_type is null or item.provider_type_snapshot=p_provider_type)
      and (p_partner_id is null or item.commercial_partner_id=p_partner_id) and (p_operator_id is null or orders.posted_by=p_operator_id)
  ) select coalesce(jsonb_agg(jsonb_build_object('date',local_day,'gross_sales',gross,'operational_net',net,'order_count',orders) order by local_day),'[]'::jsonb)
    into v_series from (select local_day,sum(case when not is_legacy then item_total_amount else 0 end) gross,
      sum(case when disposition='charged' and not is_legacy then effective_net_amount else 0 end) net,count(distinct id) orders from base group by local_day) daily;
  with base as (
    select orders.id,orders.disposition,orders.billing_mode,orders.payment_method,orders.is_legacy,orders.point_id,orders.point_name_snapshot,
      orders.stay_id,orders.room_number_snapshot,orders.reservation_code_snapshot,orders.posted_by,item.product_id,item.category_id,item.commercial_partner_id,
      item.product_name_snapshot,item.category_name_snapshot,item.provider_type_snapshot,item.item_total_amount,effective.effective_net_amount,
      coalesce(partner.trade_name,'Hotel') partner_name,coalesce(operator.name,'Sistema') operator_name,(orders.occurred_at at time zone v_timezone)::date local_day
    from public.consumption_order_item_effective effective join public.consumption_order_items item on item.id=effective.id
    join public.consumption_orders orders on orders.id=item.order_id and orders.hotel_id=p_hotel_id
    left join public.commercial_partners partner on partner.id=item.commercial_partner_id
    left join public.users operator on operator.id=orders.posted_by
    where (orders.occurred_at at time zone v_timezone)::date between p_from and p_to
      and (p_point_id is null or orders.point_id=p_point_id) and (p_category_id is null or item.category_id=p_category_id)
      and (p_product_id is null or item.product_id=p_product_id)
      and (p_stay_search is null or orders.room_number_snapshot ilike '%'||p_stay_search||'%' or orders.reservation_code_snapshot ilike '%'||p_stay_search||'%')
      and (p_disposition is null or orders.disposition=p_disposition) and (p_billing_mode is null or orders.billing_mode=p_billing_mode)
      and (p_payment_method is null or orders.payment_method=p_payment_method) and (p_provider_type is null or item.provider_type_snapshot=p_provider_type)
      and (p_partner_id is null or item.commercial_partner_id=p_partner_id) and (p_operator_id is null or orders.posted_by=p_operator_id)
  ), grouped as (
    select case p_dimension when 'day' then local_day::text when 'point' then coalesce(point_id::text,'unknown') when 'category' then coalesce(category_id::text,'unknown')
      when 'product' then product_id::text when 'stay' then coalesce(stay_id::text,'legacy') when 'billing_mode' then coalesce(billing_mode::text,disposition::text)
      when 'payment_method' then coalesce(payment_method::text,'not_applicable') when 'provider' then provider_type_snapshot::text
      when 'partner' then coalesce(commercial_partner_id::text,'hotel') else coalesce(posted_by::text,'system') end key,
      case p_dimension when 'day' then to_char(local_day,'DD/MM/YYYY') when 'point' then coalesce(point_name_snapshot,'Sem ponto') when 'category' then category_name_snapshot
      when 'product' then product_name_snapshot when 'stay' then coalesce('Quarto '||room_number_snapshot||' · '||reservation_code_snapshot,'Histórico legado')
      when 'billing_mode' then coalesce(billing_mode::text,disposition::text) when 'payment_method' then coalesce(payment_method::text,'not_applicable')
      when 'provider' then provider_type_snapshot::text when 'partner' then partner_name else operator_name end label,
      sum(case when not is_legacy then item_total_amount else 0 end) gross_sales,
      sum(case when disposition='charged' and not is_legacy then effective_net_amount else 0 end) operational_net,
      count(distinct id) order_count
    from base group by 1,2
  ), counted as (select *,count(*) over() total_rows from grouped)
  select coalesce(jsonb_agg(jsonb_build_object('key',key,'label',label,'gross_sales',gross_sales,'operational_net',operational_net,'order_count',order_count)
    order by operational_net desc,label),'[]'::jsonb),coalesce(max(total_rows),0) into v_rows,v_total from (select * from counted offset greatest(p_offset,0) limit least(greatest(p_limit,1),100)) page;
  return jsonb_build_object('result','ok','summary',v_summary,'series',v_series,'rows',v_rows,'total',v_total,
    'next_cursor',case when p_offset+p_limit<v_total then (p_offset+p_limit)::text else null end);
end;
$$;

create or replace function public.get_management_alerts(p_hotel_id uuid)
returns jsonb language plpgsql stable set search_path=public as $$
declare v_hotel record; v_settings public.consumption_management_settings%rowtype; v_guest jsonb; v_stock jsonb; v_agreements jsonb; v_settlements jsonb;
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
  ) select coalesce(jsonb_agg(jsonb_build_object('id','guest-balance-'||id,'kind','guest_balance','severity',case when (checkout_date_expected at time zone v_hotel.timezone)::date<(now() at time zone v_hotel.timezone)::date then 'critical' else 'warning' end,
    'title','Saldo pendente no quarto '||room_number,'description',reservation_code||' · '||currency||' '||to_char(balance,'FM999999990.00'),
    'href','/dashboard/reservations/account?stay_id='||id,'entity_id',id,'amount',balance,'guest_name',guest_name) order by checkout_date_expected),'[]'::jsonb)
  into v_guest from balances where balance>0 and (checkout_date_expected at time zone v_hotel.timezone)::date<=(now() at time zone v_hotel.timezone)::date+v_settings.guest_balance_alert_days;
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
  where revision.hotel_id=p_hotel_id and revision.status='activated' and revision.ends_on between (now() at time zone v_hotel.timezone)::date
    and (now() at time zone v_hotel.timezone)::date+v_settings.agreement_expiry_alert_days;
  with closed_months as (
    select partner.id partner_id,partner.trade_name,month_start::date period_start,(month_start+interval '1 month - 1 day')::date period_end
    from public.commercial_partners partner
    cross join lateral generate_series(v_settings.settlement_tracking_starts_on::timestamp,date_trunc('month',(now() at time zone v_hotel.timezone)::date)-interval '1 month',interval '1 month') month_start
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
    'severity',case when state='unpaid' and due_on<(now() at time zone v_hotel.timezone)::date then 'critical' else 'warning' end,
    'title',case when state='missing' then 'Apuração pendente: ' else 'Pagamento pendente: ' end||trade_name,
    'description',to_char(period_start,'MM/YYYY'),'href',case when settlement_id is null then '/dashboard/consumption/settlements?partner_id='||partner_id||'&period='||to_char(period_start,'YYYY-MM') else '/dashboard/consumption/settlements?id='||settlement_id end,
    'entity_id',coalesce(settlement_id,partner_id),'due_on',due_on) order by period_start),'[]'::jsonb) into v_settlements from missing;
  return jsonb_build_object('result','ok','guest_balances',v_guest,'critical_stock',v_stock,'expiring_agreements',v_agreements,'pending_settlements',v_settlements);
end;
$$;

alter table public.consumption_management_settings enable row level security;
alter table public.partner_settlements enable row level security;
alter table public.partner_settlement_components enable row level security;
alter table public.partner_settlement_sources enable row level security;
alter table public.partner_settlement_payments enable row level security;
alter table public.partner_settlement_events enable row level security;

grant select,insert,update on public.consumption_management_settings,public.partner_settlements,
  public.partner_settlement_components,public.partner_settlement_sources to postgres,service_role;
grant select,insert on public.partner_settlement_payments,public.partner_settlement_events to postgres,service_role;
grant execute on function public.partner_settlement_live_fingerprint(uuid,uuid,date),
  public.refresh_partner_settlement(uuid,uuid,date,uuid,bigint),public.submit_partner_settlement(uuid,uuid,uuid,bigint),
  public.decide_partner_settlement(uuid,uuid,uuid,bigint,text,text),
  public.pay_partner_settlement(uuid,uuid,uuid,bigint,numeric,public.consumption_payment_method,timestamptz,text,text,uuid),
  public.reverse_partner_settlement_payment(uuid,uuid,uuid,text,timestamptz,uuid),
  public.get_consumption_analytics(uuid,date,date,text,uuid,uuid,uuid,text,public.consumption_order_disposition,public.consumption_billing_mode,public.consumption_payment_method,public.product_provider_type,uuid,uuid,integer,integer),
  public.get_management_alerts(uuid) to postgres,service_role;

insert into public.permissions(name,type) values
  ('read_consumption_analytics','HOTEL_PERMISSION'),
  ('read_partner_settlements','HOTEL_PERMISSION'),
  ('prepare_partner_settlements','HOTEL_PERMISSION'),
  ('approve_partner_settlements','HOTEL_PERMISSION'),
  ('settle_partner_settlements','HOTEL_PERMISSION')
on conflict(name) do nothing;
