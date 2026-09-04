create type public.consumption_order_disposition as enum ('charged', 'courtesy', 'legacy_unclassified');
create type public.consumption_payment_method as enum ('cash', 'pix', 'credit_card', 'debit_card', 'bank_transfer');

alter type public.stay_folio_kind rename to stay_folio_kind_legacy;
create type public.stay_folio_kind as enum ('lodging', 'maintenance_charge', 'consumption_charge', 'payment', 'refund', 'adjustment');
alter table public.stay_folio_entries
  alter column kind type public.stay_folio_kind using kind::text::public.stay_folio_kind;
drop type public.stay_folio_kind_legacy;

alter table public.reservations add constraint reservations_id_hotel_unique unique (id, hotel_id);
alter table public.stays add constraint stays_id_reservation_unique unique (id, reservation_id);
alter table public.customers add constraint customers_id_hotel_unique unique (id, hotel_id);

create table public.consumption_orders (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  stay_id uuid references public.stays(id) on delete restrict,
  reservation_id uuid references public.reservations(id) on delete restrict,
  point_id uuid,
  guest_customer_id uuid references public.customers(id) on delete restrict,
  disposition public.consumption_order_disposition not null,
  billing_mode public.consumption_billing_mode,
  payment_method public.consumption_payment_method,
  payment_reference text,
  partner_receipt_confirmed boolean not null default false,
  currency text not null,
  gross_amount numeric(12,2) not null,
  discount_amount numeric(12,2) not null default 0,
  net_amount numeric(12,2) not null,
  reservation_code_snapshot text,
  room_number_snapshot text,
  guest_name_snapshot text,
  point_name_snapshot text,
  notes text,
  courtesy_reason text,
  occurred_at timestamptz not null,
  posted_at timestamptz not null default now(),
  posted_by uuid references public.users(id) on delete restrict,
  idempotency_key uuid,
  request_fingerprint text not null,
  is_legacy boolean not null default false,
  constraint consumption_orders_id_hotel_unique unique (id, hotel_id),
  constraint consumption_orders_stay_reservation_fkey foreign key (stay_id, reservation_id)
    references public.stays(id, reservation_id) on delete restrict,
  constraint consumption_orders_reservation_hotel_fkey foreign key (reservation_id, hotel_id)
    references public.reservations(id, hotel_id) on delete restrict,
  constraint consumption_orders_point_hotel_fkey foreign key (point_id, hotel_id)
    references public.consumption_points(id, hotel_id) on delete restrict,
  constraint consumption_orders_guest_hotel_fkey foreign key (guest_customer_id, hotel_id)
    references public.customers(id, hotel_id) on delete restrict,
  constraint consumption_orders_amounts_check check (
    gross_amount >= 0 and discount_amount >= 0 and net_amount >= 0
    and discount_amount <= gross_amount and net_amount = gross_amount - discount_amount
  ),
  constraint consumption_orders_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint consumption_orders_payment_reference_check check (
    payment_reference is null or length(btrim(payment_reference)) between 1 and 120
  ),
  constraint consumption_orders_notes_check check (notes is null or length(btrim(notes)) between 1 and 1000),
  constraint consumption_orders_courtesy_reason_check check (
    courtesy_reason is null or length(btrim(courtesy_reason)) between 3 and 1000
  ),
  constraint consumption_orders_shape_check check (
    (disposition = 'legacy_unclassified' and is_legacy and billing_mode is null
      and payment_method is null and idempotency_key is null and posted_by is null)
    or
    (disposition = 'courtesy' and not is_legacy and stay_id is not null and reservation_id is not null
      and point_id is not null and billing_mode is null and payment_method is null
      and not partner_receipt_confirmed and courtesy_reason is not null
      and gross_amount > 0 and discount_amount = gross_amount and net_amount = 0
      and posted_by is not null and idempotency_key is not null)
    or
    (disposition = 'charged' and not is_legacy and stay_id is not null and reservation_id is not null
      and point_id is not null and billing_mode is not null and courtesy_reason is null
      and gross_amount > 0 and discount_amount = 0 and net_amount = gross_amount
      and posted_by is not null and idempotency_key is not null
      and ((billing_mode = 'hotel_immediate' and payment_method is not null and not partner_receipt_confirmed)
        or (billing_mode = 'stay_folio' and payment_method is null and not partner_receipt_confirmed)
        or (billing_mode = 'partner_direct' and payment_method is null and partner_receipt_confirmed)))
  )
);

create unique index consumption_orders_hotel_idempotency_unique
  on public.consumption_orders(hotel_id, idempotency_key) where idempotency_key is not null;
create index consumption_orders_hotel_occurred_idx on public.consumption_orders(hotel_id, occurred_at desc, id desc);
create index consumption_orders_stay_idx on public.consumption_orders(hotel_id, stay_id, occurred_at desc);

create table public.consumption_order_items (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  order_id uuid not null,
  offer_id uuid,
  product_id uuid not null,
  category_id uuid,
  commercial_partner_id uuid,
  commercial_agreement_id uuid,
  commercial_revision_id uuid,
  quantity numeric(12,3) not null,
  charged_unit_price numeric(12,2) not null,
  item_total_amount numeric(12,2) generated always as (round(quantity * charged_unit_price, 2)) stored,
  discount_amount numeric(12,2) not null default 0,
  net_amount numeric(12,2) generated always as (round(quantity * charged_unit_price, 2) - discount_amount) stored,
  product_name_snapshot text not null,
  product_internal_code_snapshot text,
  product_kind_snapshot public.product_kind not null,
  sales_unit_snapshot public.product_sales_unit not null,
  category_name_snapshot text not null,
  provider_type_snapshot public.product_provider_type not null,
  partner_name_snapshot text,
  agreement_number_snapshot text,
  commercial_revision_version_snapshot integer,
  commercial_terms_snapshot jsonb,
  billing_policy_snapshot jsonb not null,
  version_token text not null,
  notes text,
  created_at timestamptz not null default now(),
  constraint consumption_order_items_order_hotel_fkey foreign key (order_id, hotel_id)
    references public.consumption_orders(id, hotel_id) on delete restrict,
  constraint consumption_order_items_offer_hotel_fkey foreign key (offer_id, hotel_id)
    references public.consumption_offers(id, hotel_id) on delete restrict,
  constraint consumption_order_items_product_hotel_fkey foreign key (product_id, hotel_id)
    references public.products(id, hotel_id) on delete restrict,
  constraint consumption_order_items_category_hotel_fkey foreign key (category_id, hotel_id)
    references public.product_categories(id, hotel_id) on delete restrict,
  constraint consumption_order_items_partner_hotel_fkey foreign key (commercial_partner_id, hotel_id)
    references public.commercial_partners(id, hotel_id) on delete restrict,
  constraint consumption_order_items_agreement_hotel_fkey foreign key (commercial_agreement_id, hotel_id)
    references public.commercial_agreements(id, hotel_id) on delete restrict,
  constraint consumption_order_items_revision_hotel_fkey foreign key (commercial_revision_id, hotel_id)
    references public.commercial_agreement_revisions(id, hotel_id) on delete restrict,
  constraint consumption_order_items_quantity_check check (quantity > 0 and quantity <= 9999),
  constraint consumption_order_items_price_check check (charged_unit_price >= 0),
  constraint consumption_order_items_discount_check check (
    discount_amount >= 0 and discount_amount <= round(quantity * charged_unit_price, 2)
  ),
  constraint consumption_order_items_integer_quantity_check check (
    sales_unit_snapshot = 'hour' or quantity = trunc(quantity)
  ),
  constraint consumption_order_items_partner_snapshot_check check (
    (provider_type_snapshot = 'hotel' and commercial_partner_id is null and partner_name_snapshot is null
      and commercial_agreement_id is null and commercial_revision_id is null)
    or
    (provider_type_snapshot = 'partner' and commercial_partner_id is not null and partner_name_snapshot is not null
      and commercial_agreement_id is not null and commercial_revision_id is not null)
  )
);

create index consumption_order_items_order_idx on public.consumption_order_items(hotel_id, order_id);
create index consumption_order_items_product_idx on public.consumption_order_items(hotel_id, product_id);

create table public.consumption_order_events (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  order_id uuid not null,
  action text not null,
  actor_id uuid references public.users(id) on delete restrict,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint consumption_order_events_order_hotel_fkey foreign key (order_id, hotel_id)
    references public.consumption_orders(id, hotel_id) on delete restrict,
  constraint consumption_order_events_action_check check (length(btrim(action)) between 1 and 80)
);

alter table public.financial_transactions add column consumption_order_id uuid;
alter table public.financial_transactions add constraint financial_transactions_consumption_order_fkey
  foreign key (consumption_order_id, hotel_id) references public.consumption_orders(id, hotel_id) on delete restrict;
alter table public.stay_folio_entries add column consumption_order_id uuid;
alter table public.stay_folio_entries add constraint stay_folio_entries_consumption_order_fkey
  foreign key (consumption_order_id, hotel_id) references public.consumption_orders(id, hotel_id) on delete restrict;

do $$
begin
  if exists (
    select 1 from public.stay_consumption legacy
    join public.products product on product.id = legacy.product_id
    join public.stays stay on stay.id = legacy.stay_id
    join public.reservations reservation on reservation.id = stay.reservation_id
    where reservation.hotel_id <> product.hotel_id
  ) then
    raise exception 'legacy consumption crosses hotel scope' using errcode = '23514';
  end if;
end;
$$;

insert into public.consumption_orders(
  id, hotel_id, stay_id, reservation_id, disposition, currency, gross_amount,
  discount_amount, net_amount, reservation_code_snapshot, room_number_snapshot,
  guest_name_snapshot, notes, occurred_at, posted_at, request_fingerprint, is_legacy
)
select legacy.id, product.hotel_id, stay.id, reservation.id, 'legacy_unclassified', hotel.currency,
  legacy.item_total_amount, 0, legacy.item_total_amount, reservation.reservation_code,
  room.room_number, customer.full_name, legacy.notes, coalesce(legacy.consumption_date, legacy.created_at),
  legacy.created_at, 'legacy:' || legacy.id::text, true
from public.stay_consumption legacy
join public.products product on product.id = legacy.product_id
join public.hotels hotel on hotel.id = product.hotel_id
left join public.stays stay on stay.id = legacy.stay_id
left join public.reservations reservation on reservation.id = stay.reservation_id
left join public.rooms room on room.id = stay.room_id
left join public.customers customer on customer.id = reservation.booking_customer_id;

insert into public.consumption_order_items(
  id, hotel_id, order_id, product_id, category_id, commercial_partner_id, quantity,
  charged_unit_price, discount_amount, product_name_snapshot, product_internal_code_snapshot,
  product_kind_snapshot, sales_unit_snapshot, category_name_snapshot, provider_type_snapshot,
  partner_name_snapshot, billing_policy_snapshot, version_token, created_at
)
select legacy.id, product.hotel_id, legacy.id, product.id, category.id, product.commercial_partner_id,
  legacy.quantity, legacy.charged_unit_price, 0, product.name, product.internal_code,
  product.kind, product.sales_unit, category.name, product.provider_type, partner.trade_name,
  '{}'::jsonb, 'legacy:' || legacy.id::text, legacy.created_at
from public.stay_consumption legacy
join public.products product on product.id = legacy.product_id
join public.product_categories category on category.id = product.category_id
left join public.commercial_partners partner on partner.id = product.commercial_partner_id;

do $$
begin
  if (select count(*) from public.stay_consumption) <> (select count(*) from public.consumption_order_items where version_token like 'legacy:%') then
    raise exception 'legacy consumption backfill is incomplete' using errcode = '23514';
  end if;
end;
$$;

insert into public.consumption_order_events(hotel_id, order_id, action, details, created_at)
select hotel_id, id, 'legacy_migrated', jsonb_build_object('source', 'stay_consumption'), posted_at
from public.consumption_orders where is_legacy;

drop table public.stay_consumption;

create or replace function public.resolve_consumption_offer_snapshot(
  p_hotel_id uuid, p_offer_id uuid, p_occurred_at timestamptz
) returns jsonb language plpgsql stable set search_path = public as $$
declare
  v_offer record;
  v_revision public.commercial_agreement_revisions%rowtype;
  v_modes public.consumption_billing_mode[];
  v_eligible public.consumption_billing_mode[] := array[]::public.consumption_billing_mode[];
  v_reasons text[] := array[]::text[];
  v_local_date date;
  v_token text;
begin
  select offer.*, point.name point_name, point.internal_code point_code, point.is_active point_active,
    point.archived_at point_archived_at, point.default_allowed_billing_modes, point.default_billing_mode point_default_mode,
    point.updated_at point_updated_at, product.name product_name, product.internal_code product_code,
    product.kind product_kind, product.sales_unit, product.unit_price, product.status product_status,
    product.archived_at product_archived_at, product.updated_at product_updated_at,
    product.provider_type, product.commercial_partner_id, category.id category_id, category.name category_name,
    category.is_active category_active, category.archived_at category_archived_at,
    partner.trade_name partner_name, partner.is_active partner_active, partner.archived_at partner_archived_at,
    agreement.internal_number agreement_number, agreement.archived_at agreement_archived_at,
    hotel.currency, hotel.timezone
  into v_offer
  from public.consumption_offers offer
  join public.consumption_points point on point.id = offer.point_id and point.hotel_id = offer.hotel_id
  join public.products product on product.id = offer.product_id and product.hotel_id = offer.hotel_id
  join public.product_categories category on category.id = product.category_id and category.hotel_id = offer.hotel_id
  join public.hotels hotel on hotel.id = offer.hotel_id
  left join public.commercial_partners partner on partner.id = product.commercial_partner_id and partner.hotel_id = offer.hotel_id
  left join public.commercial_agreements agreement on agreement.id = offer.commercial_agreement_id and agreement.hotel_id = offer.hotel_id
  where offer.id = p_offer_id and offer.hotel_id = p_hotel_id;
  if not found then return jsonb_build_object('found', false, 'reasons', jsonb_build_array('offer_not_found')); end if;

  v_local_date := (p_occurred_at at time zone v_offer.timezone)::date;
  v_modes := case when v_offer.policy_source = 'inherit' then v_offer.default_allowed_billing_modes else v_offer.allowed_billing_modes end;

  if not v_offer.point_active then v_reasons := array_append(v_reasons, 'point_inactive'); end if;
  if v_offer.point_archived_at is not null then v_reasons := array_append(v_reasons, 'point_archived'); end if;
  if not v_offer.is_active then v_reasons := array_append(v_reasons, 'offer_inactive'); end if;
  if v_offer.archived_at is not null then v_reasons := array_append(v_reasons, 'offer_archived'); end if;
  if v_offer.product_status <> 'active' then v_reasons := array_append(v_reasons, 'product_inactive'); end if;
  if v_offer.product_archived_at is not null then v_reasons := array_append(v_reasons, 'product_archived'); end if;
  if not v_offer.category_active then v_reasons := array_append(v_reasons, 'category_inactive'); end if;
  if v_offer.category_archived_at is not null then v_reasons := array_append(v_reasons, 'category_archived'); end if;

  if v_offer.provider_type = 'partner' then
    if not coalesce(v_offer.partner_active, false) then v_reasons := array_append(v_reasons, 'partner_inactive'); end if;
    if v_offer.partner_archived_at is not null then v_reasons := array_append(v_reasons, 'partner_archived'); end if;
    if v_offer.commercial_agreement_id is null then
      v_reasons := array_append(v_reasons, 'agreement_missing');
    elsif v_offer.agreement_archived_at is not null then
      v_reasons := array_append(v_reasons, 'agreement_terminated');
    else
      select revision.* into v_revision
      from public.commercial_agreement_revisions revision
      join public.commercial_agreement_revision_points scope on scope.revision_id = revision.id
        and scope.hotel_id = revision.hotel_id and scope.point_id = v_offer.point_id
      where revision.hotel_id = p_hotel_id and revision.agreement_id = v_offer.commercial_agreement_id
        and revision.status in ('activated', 'terminated') and revision.starts_on <= v_local_date
        and (revision.ends_on is null or revision.ends_on >= v_local_date)
      order by revision.starts_on desc, revision.version desc limit 1;
      if not found then v_reasons := array_append(v_reasons, 'agreement_revision_missing'); end if;
    end if;
  end if;

  if cardinality(v_reasons) = 0 then
    if v_offer.provider_type = 'hotel' then
      select coalesce(array_agg(mode), array[]::public.consumption_billing_mode[]) into v_eligible
      from unnest(v_modes) mode where mode <> 'partner_direct';
    elsif v_revision.payment_recipient = 'both' then
      v_eligible := v_modes;
    elsif v_revision.payment_recipient = 'hotel' then
      select coalesce(array_agg(mode), array[]::public.consumption_billing_mode[]) into v_eligible
      from unnest(v_modes) mode where mode <> 'partner_direct';
    else
      select coalesce(array_agg(mode), array[]::public.consumption_billing_mode[]) into v_eligible
      from unnest(v_modes) mode where mode = 'partner_direct';
    end if;
    if cardinality(v_eligible) = 0 then v_reasons := array_append(v_reasons, 'billing_mode_incompatible'); end if;
  end if;

  v_token := md5(concat_ws('|', v_offer.updated_at, v_offer.point_updated_at, v_offer.product_updated_at,
    coalesce(v_revision.id::text, ''), coalesce(v_revision.updated_at::text, '')));
  return jsonb_build_object(
    'found', true, 'available', cardinality(v_reasons) = 0, 'reasons', to_jsonb(v_reasons),
    'version_token', v_token, 'offer_id', v_offer.id, 'point_id', v_offer.point_id,
    'point_name', v_offer.point_name, 'point_code', v_offer.point_code,
    'product_id', v_offer.product_id, 'product_name', v_offer.product_name, 'product_code', v_offer.product_code,
    'product_kind', v_offer.product_kind, 'sales_unit', v_offer.sales_unit, 'unit_price', v_offer.unit_price,
    'category_id', v_offer.category_id, 'category_name', v_offer.category_name,
    'provider_type', v_offer.provider_type, 'partner_id', v_offer.commercial_partner_id,
    'partner_name', v_offer.partner_name, 'agreement_id', v_offer.commercial_agreement_id,
    'agreement_number', v_offer.agreement_number, 'currency', v_offer.currency,
    'allowed_modes', to_jsonb(v_eligible),
    'default_mode', case when (case when v_offer.policy_source = 'inherit' then v_offer.point_default_mode else v_offer.default_billing_mode end) = any(v_eligible)
      then (case when v_offer.policy_source = 'inherit' then v_offer.point_default_mode else v_offer.default_billing_mode end) else null end,
    'policy_source', v_offer.policy_source,
    'billing_policy', jsonb_build_object('source', v_offer.policy_source, 'allowed_modes', to_jsonb(v_modes),
      'resolved_allowed_modes', to_jsonb(v_eligible)),
    'revision', case when v_revision.id is null then null else jsonb_build_object(
      'id', v_revision.id, 'version', v_revision.version, 'starts_on', v_revision.starts_on,
      'ends_on', v_revision.ends_on, 'commercial_model', v_revision.commercial_model,
      'fixed_rent', v_revision.fixed_rent, 'rent_frequency', v_revision.rent_frequency,
      'commission_percentage', v_revision.commission_percentage, 'minimum_guarantee', v_revision.minimum_guarantee,
      'payment_recipient', v_revision.payment_recipient, 'currency', v_revision.currency) end
  );
end;
$$;

create or replace function public.get_consumption_operational_context(
  p_hotel_id uuid, p_stay_id uuid, p_occurred_at timestamptz default now()
) returns jsonb language plpgsql stable set search_path = public as $$
declare v_stay record; v_offers jsonb; v_guests jsonb;
begin
  select stay.*, reservation.reservation_code, room.room_number, room.room_type,
    customer.full_name primary_guest_name
  into v_stay from public.stays stay
  join public.reservations reservation on reservation.id = stay.reservation_id and reservation.hotel_id = p_hotel_id
  join public.rooms room on room.id = stay.room_id and room.hotel_id = p_hotel_id
  join public.customers customer on customer.id = reservation.booking_customer_id
  where stay.id = p_stay_id;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if v_stay.stay_status <> 'checked_in' then return jsonb_build_object('result', 'stay_not_checked_in'); end if;
  if v_stay.checkin_date_actual is null or p_occurred_at < v_stay.checkin_date_actual then
    return jsonb_build_object('result', 'occurred_before_checkin');
  end if;
  if p_occurred_at > now() then return jsonb_build_object('result', 'occurred_in_future'); end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', customer.id, 'name', customer.full_name) order by customer.full_name), '[]'::jsonb)
  into v_guests from public.stay_customers link join public.customers customer on customer.id = link.customer_id
  where link.stay_id = p_stay_id and customer.hotel_id = p_hotel_id;
  select coalesce(jsonb_agg(public.resolve_consumption_offer_snapshot(p_hotel_id, offer.id, p_occurred_at)
    order by point.display_order, offer.display_order, offer.id), '[]'::jsonb)
  into v_offers from public.consumption_offers offer
  join public.consumption_points point on point.id = offer.point_id and point.hotel_id = offer.hotel_id
  where offer.hotel_id = p_hotel_id and offer.archived_at is null and point.archived_at is null;
  return jsonb_build_object('result', 'ok', 'stay', jsonb_build_object(
    'id', v_stay.id, 'reservation_id', v_stay.reservation_id, 'reservation_code', v_stay.reservation_code,
    'room_id', v_stay.room_id, 'room_number', v_stay.room_number, 'room_type', v_stay.room_type,
    'stay_status', v_stay.stay_status,
    'primary_guest_name', v_stay.primary_guest_name, 'checkin_date_actual', v_stay.checkin_date_actual,
    'checkout_date_expected', v_stay.checkout_date_expected), 'guests', v_guests, 'offers', v_offers,
    'occurred_at', p_occurred_at);
end;
$$;

create or replace function public.post_consumption_order(
  p_hotel_id uuid, p_stay_id uuid, p_point_id uuid, p_actor_id uuid, p_occurred_at timestamptz,
  p_disposition public.consumption_order_disposition, p_billing_mode public.consumption_billing_mode,
  p_items jsonb, p_idempotency_key uuid, p_guest_customer_id uuid default null,
  p_payment_method public.consumption_payment_method default null, p_payment_reference text default null,
  p_partner_receipt_confirmed boolean default false, p_notes text default null, p_courtesy_reason text default null
) returns jsonb language plpgsql set search_path = public as $$
declare
  v_stay record; v_point record; v_existing record; v_item jsonb; v_snapshot jsonb;
  v_order_id uuid := gen_random_uuid(); v_offer_id uuid; v_quantity numeric(12,3);
  v_gross numeric(12,2) := 0; v_line numeric(12,2); v_partner_id uuid; v_direct_partner uuid;
  v_agreement_id uuid; v_direct_agreement uuid;
  v_fingerprint text; v_debit_id uuid; v_credit_id uuid; v_transaction_id uuid; v_action text;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then
    return jsonb_build_object('result', 'invalid_items');
  end if;
  v_fingerprint := md5(jsonb_build_object('stay', p_stay_id, 'point', p_point_id, 'occurred', p_occurred_at,
    'disposition', p_disposition, 'mode', p_billing_mode, 'items', p_items, 'guest', p_guest_customer_id,
    'method', p_payment_method, 'reference', nullif(btrim(p_payment_reference), ''),
    'partner_confirmed', p_partner_receipt_confirmed, 'notes', nullif(btrim(p_notes), ''),
    'courtesy_reason', nullif(btrim(p_courtesy_reason), ''))::text);
  select id, request_fingerprint into v_existing from public.consumption_orders
    where hotel_id = p_hotel_id and idempotency_key = p_idempotency_key for update;
  if found then
    if v_existing.request_fingerprint = v_fingerprint then
      return jsonb_build_object('result', 'ok', 'order_id', v_existing.id, 'created', false);
    end if;
    return jsonb_build_object('result', 'idempotency_conflict');
  end if;
  if not public.maintenance_user_has_hotel_scope(p_actor_id, p_hotel_id) then
    return jsonb_build_object('result', 'actor_outside_hotel');
  end if;
  select stay.id, stay.reservation_id, stay.room_id, stay.stay_status, stay.checkin_date_actual,
    reservation.reservation_code, room.room_number, hotel.currency, customer.full_name primary_guest_name
  into v_stay from public.stays stay
  join public.reservations reservation on reservation.id = stay.reservation_id and reservation.hotel_id = p_hotel_id
  join public.rooms room on room.id = stay.room_id and room.hotel_id = p_hotel_id
  join public.hotels hotel on hotel.id = p_hotel_id
  join public.customers customer on customer.id = reservation.booking_customer_id
  where stay.id = p_stay_id for update of stay;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if v_stay.stay_status <> 'checked_in' then return jsonb_build_object('result', 'stay_not_checked_in'); end if;
  if v_stay.checkin_date_actual is null or p_occurred_at < v_stay.checkin_date_actual then
    return jsonb_build_object('result', 'occurred_before_checkin');
  end if;
  if p_occurred_at > now() then return jsonb_build_object('result', 'occurred_in_future'); end if;
  if p_guest_customer_id is not null and not exists (
    select 1 from public.stay_customers where stay_id = p_stay_id and customer_id = p_guest_customer_id
  ) then return jsonb_build_object('result', 'guest_outside_stay'); end if;
  select * into v_point from public.consumption_points where id = p_point_id and hotel_id = p_hotel_id for update;
  if not found then return jsonb_build_object('result', 'point_not_found'); end if;
  if v_point.archived_at is not null or not v_point.is_active then return jsonb_build_object('result', 'point_unavailable'); end if;
  if (select count(*) from jsonb_array_elements(p_items)) <> (
    select count(distinct value->>'offer_id') from jsonb_array_elements(p_items)
  ) then return jsonb_build_object('result', 'duplicate_offer'); end if;

  perform 1 from public.consumption_offers offer
    where offer.hotel_id = p_hotel_id and offer.id in (select (value->>'offer_id')::uuid from jsonb_array_elements(p_items))
    order by offer.id for update;
  perform 1 from public.products product where product.hotel_id = p_hotel_id and product.id in (
    select offer.product_id from public.consumption_offers offer
    where offer.id in (select (value->>'offer_id')::uuid from jsonb_array_elements(p_items))
  ) order by product.id for update;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_offer_id := (v_item->>'offer_id')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;
    v_snapshot := public.resolve_consumption_offer_snapshot(p_hotel_id, v_offer_id, p_occurred_at);
    if not coalesce((v_snapshot->>'found')::boolean, false) then return jsonb_build_object('result', 'offer_not_found'); end if;
    if (v_snapshot->>'point_id')::uuid <> p_point_id then return jsonb_build_object('result', 'offer_outside_point'); end if;
    if not coalesce((v_snapshot->>'available')::boolean, false) then
      return jsonb_build_object('result', 'offer_unavailable', 'reasons', v_snapshot->'reasons');
    end if;
    if v_item->>'version_token' is distinct from v_snapshot->>'version_token' then
      return jsonb_build_object('result', 'version_conflict');
    end if;
    if v_quantity <= 0 or v_quantity > 9999 or ((v_snapshot->>'sales_unit') <> 'hour' and v_quantity <> trunc(v_quantity)) then
      return jsonb_build_object('result', 'invalid_quantity');
    end if;
    if p_disposition = 'charged' and not exists (
      select 1 from jsonb_array_elements_text(v_snapshot->'allowed_modes') mode where mode = p_billing_mode::text
    ) then return jsonb_build_object('result', 'billing_mode_not_allowed'); end if;
    if p_billing_mode = 'partner_direct' then
      if v_snapshot->>'provider_type' <> 'partner' then return jsonb_build_object('result', 'partner_direct_requires_partner'); end if;
      v_partner_id := (v_snapshot->>'partner_id')::uuid;
      v_agreement_id := (v_snapshot->>'agreement_id')::uuid;
      if v_direct_partner is null then v_direct_partner := v_partner_id;
      elsif v_direct_partner <> v_partner_id then return jsonb_build_object('result', 'different_partners'); end if;
      if v_direct_agreement is null then v_direct_agreement := v_agreement_id;
      elsif v_direct_agreement <> v_agreement_id then return jsonb_build_object('result', 'different_partners'); end if;
    end if;
    v_line := round(v_quantity * (v_snapshot->>'unit_price')::numeric, 2);
    v_gross := v_gross + v_line;
  end loop;
  if v_gross <= 0 then return jsonb_build_object('result', 'invalid_total'); end if;
  if p_disposition = 'courtesy' then
    if p_billing_mode is not null or p_payment_method is not null or p_partner_receipt_confirmed
      or nullif(btrim(p_payment_reference), '') is not null
      or length(coalesce(btrim(p_courtesy_reason), '')) < 3 then return jsonb_build_object('result', 'invalid_courtesy'); end if;
  elsif p_disposition <> 'charged' or p_billing_mode is null then return jsonb_build_object('result', 'invalid_disposition');
  elsif p_billing_mode = 'hotel_immediate' and p_payment_method is null then return jsonb_build_object('result', 'payment_method_required');
  elsif p_billing_mode <> 'hotel_immediate' and p_payment_method is not null then return jsonb_build_object('result', 'payment_method_not_allowed');
  elsif p_billing_mode <> 'hotel_immediate' and nullif(btrim(p_payment_reference), '') is not null then return jsonb_build_object('result', 'payment_reference_not_allowed');
  elsif p_billing_mode = 'partner_direct' and not p_partner_receipt_confirmed then return jsonb_build_object('result', 'partner_confirmation_required');
  elsif p_billing_mode <> 'partner_direct' and p_partner_receipt_confirmed then return jsonb_build_object('result', 'partner_confirmation_not_allowed');
  end if;

  insert into public.consumption_orders(
    id, hotel_id, stay_id, reservation_id, point_id, guest_customer_id, disposition, billing_mode,
    payment_method, payment_reference, partner_receipt_confirmed, currency, gross_amount, discount_amount,
    net_amount, reservation_code_snapshot, room_number_snapshot, guest_name_snapshot, point_name_snapshot,
    notes, courtesy_reason, occurred_at, posted_by, idempotency_key, request_fingerprint
  ) values (
    v_order_id, p_hotel_id, p_stay_id, v_stay.reservation_id, p_point_id, p_guest_customer_id, p_disposition,
    case when p_disposition = 'charged' then p_billing_mode else null end,
    p_payment_method, nullif(btrim(p_payment_reference), ''), p_partner_receipt_confirmed, v_stay.currency,
    v_gross, case when p_disposition = 'courtesy' then v_gross else 0 end,
    case when p_disposition = 'courtesy' then 0 else v_gross end, v_stay.reservation_code,
    v_stay.room_number, coalesce((select full_name from public.customers where id = p_guest_customer_id), v_stay.primary_guest_name),
    v_point.name, nullif(btrim(p_notes), ''), nullif(btrim(p_courtesy_reason), ''), p_occurred_at,
    p_actor_id, p_idempotency_key, v_fingerprint
  );

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_offer_id := (v_item->>'offer_id')::uuid; v_quantity := (v_item->>'quantity')::numeric;
    v_snapshot := public.resolve_consumption_offer_snapshot(p_hotel_id, v_offer_id, p_occurred_at);
    v_line := round(v_quantity * (v_snapshot->>'unit_price')::numeric, 2);
    insert into public.consumption_order_items(
      hotel_id, order_id, offer_id, product_id, category_id, commercial_partner_id,
      commercial_agreement_id, commercial_revision_id, quantity, charged_unit_price, discount_amount,
      product_name_snapshot, product_internal_code_snapshot, product_kind_snapshot, sales_unit_snapshot,
      category_name_snapshot, provider_type_snapshot, partner_name_snapshot, agreement_number_snapshot,
      commercial_revision_version_snapshot, commercial_terms_snapshot, billing_policy_snapshot, version_token, notes
    ) values (
      p_hotel_id, v_order_id, v_offer_id, (v_snapshot->>'product_id')::uuid, (v_snapshot->>'category_id')::uuid,
      nullif(v_snapshot->>'partner_id', '')::uuid, nullif(v_snapshot->>'agreement_id', '')::uuid,
      nullif(v_snapshot->'revision'->>'id', '')::uuid, v_quantity, (v_snapshot->>'unit_price')::numeric,
      case when p_disposition = 'courtesy' then v_line else 0 end, v_snapshot->>'product_name',
      v_snapshot->>'product_code', (v_snapshot->>'product_kind')::public.product_kind,
      (v_snapshot->>'sales_unit')::public.product_sales_unit, v_snapshot->>'category_name',
      (v_snapshot->>'provider_type')::public.product_provider_type, v_snapshot->>'partner_name',
      v_snapshot->>'agreement_number', nullif(v_snapshot->'revision'->>'version', '')::integer,
      v_snapshot->'revision', v_snapshot->'billing_policy', v_snapshot->>'version_token',
      nullif(btrim(v_item->>'notes'), '')
    );
  end loop;

  if p_disposition = 'charged' and p_billing_mode in ('stay_folio', 'hotel_immediate') then
    insert into public.stay_folio_entries(hotel_id, stay_id, reservation_id, direction, kind, amount, currency,
      description, consumption_order_id, source_key, posted_by, posted_at)
    values (p_hotel_id, p_stay_id, v_stay.reservation_id, 'debit', 'consumption_charge', v_gross,
      v_stay.currency, 'Consumo em ' || v_point.name, v_order_id, 'consumption:' || v_order_id::text,
      p_actor_id, p_occurred_at) returning id into v_debit_id;
    if p_billing_mode = 'hotel_immediate' then
      insert into public.financial_transactions(hotel_id, type, category, amount, currency, description, status,
        stay_id, reservation_id, payment_method, paid_at, created_by, reference_code, consumption_order_id)
      values (p_hotel_id, 'INCOME', 'CONSUMPTION_PAYMENT', v_gross, v_stay.currency,
        'Pagamento imediato de consumo em ' || v_point.name, 'COMPLETED', p_stay_id, v_stay.reservation_id,
        p_payment_method::text, now(), p_actor_id, nullif(btrim(p_payment_reference), ''), v_order_id)
      returning id into v_transaction_id;
      insert into public.stay_folio_entries(hotel_id, stay_id, reservation_id, direction, kind, amount, currency,
        description, financial_transaction_id, consumption_order_id, source_key, posted_by, posted_at)
      values (p_hotel_id, p_stay_id, v_stay.reservation_id, 'credit', 'payment', v_gross, v_stay.currency,
        'Pagamento imediato de consumo', v_transaction_id, v_order_id, 'consumption-payment:' || v_order_id::text,
        p_actor_id, now()) returning id into v_credit_id;
      insert into public.stay_folio_allocations(hotel_id, stay_id, credit_entry_id, debit_entry_id, amount, created_by)
      values (p_hotel_id, p_stay_id, v_credit_id, v_debit_id, v_gross, p_actor_id);
      update public.stays set total_paid = coalesce(total_paid, 0) + v_gross where id = p_stay_id;
    end if;
  end if;
  v_action := case when p_disposition = 'courtesy' then 'courtesy_posted' else 'posted' end;
  insert into public.consumption_order_events(hotel_id, order_id, action, actor_id, details)
    values (p_hotel_id, v_order_id, v_action, p_actor_id,
      jsonb_build_object('billing_mode', p_billing_mode, 'gross_amount', v_gross, 'net_amount',
        case when p_disposition = 'courtesy' then 0 else v_gross end));
  return jsonb_build_object('result', 'ok', 'order_id', v_order_id, 'created', true);
exception when unique_violation then
  select id, request_fingerprint into v_existing from public.consumption_orders
    where hotel_id = p_hotel_id and idempotency_key = p_idempotency_key;
  if found and v_existing.request_fingerprint = v_fingerprint then
    return jsonb_build_object('result', 'ok', 'order_id', v_existing.id, 'created', false);
  end if;
  return jsonb_build_object('result', 'idempotency_conflict');
end;
$$;

create or replace function public.protect_consumption_records()
returns trigger language plpgsql as $$
begin
  raise exception 'consumption records are immutable' using errcode = '23514';
end;
$$;
create trigger trg_consumption_orders_immutable before update or delete on public.consumption_orders
  for each row execute function public.protect_consumption_records();
create trigger trg_consumption_order_items_immutable before update or delete on public.consumption_order_items
  for each row execute function public.protect_consumption_records();
create trigger trg_consumption_order_events_immutable before update or delete on public.consumption_order_events
  for each row execute function public.protect_consumption_records();

create or replace function public.block_checkout_with_open_consumption()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.stay_status = 'checked_out' and old.stay_status <> 'checked_out' and exists (
    select 1 from public.stay_folio_entries entry
    where entry.stay_id = new.id and entry.kind = 'consumption_charge' and entry.direction = 'debit'
      and entry.amount > coalesce((select sum(amount) from public.stay_folio_allocations allocation
        where allocation.debit_entry_id = entry.id), 0)
  ) then raise exception 'open consumption balance blocks checkout' using errcode = '23514'; end if;
  return new;
end;
$$;
create trigger trg_stays_block_checkout_with_consumption before update of stay_status on public.stays
  for each row execute function public.block_checkout_with_open_consumption();

alter table public.consumption_orders enable row level security;
alter table public.consumption_order_items enable row level security;
alter table public.consumption_order_events enable row level security;
grant usage on type public.consumption_order_disposition, public.consumption_payment_method to postgres, service_role;
grant select, insert on public.consumption_orders, public.consumption_order_items, public.consumption_order_events to postgres, service_role;
grant execute on function public.resolve_consumption_offer_snapshot(uuid, uuid, timestamptz),
  public.get_consumption_operational_context(uuid, uuid, timestamptz),
  public.post_consumption_order(uuid, uuid, uuid, uuid, timestamptz, public.consumption_order_disposition,
    public.consumption_billing_mode, jsonb, uuid, uuid, public.consumption_payment_method, text, boolean, text, text)
  to postgres, service_role;
