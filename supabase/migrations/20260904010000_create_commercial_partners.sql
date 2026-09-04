create type public.product_provider_type as enum ('hotel', 'partner');
create type public.commercial_contact_purpose as enum ('operational', 'financial', 'general');
create type public.commercial_model as enum ('fixed_rent', 'revenue_share', 'hybrid');
create type public.commercial_rent_frequency as enum ('monthly', 'quarterly', 'yearly');
create type public.commercial_payment_recipient as enum ('hotel', 'partner', 'both');
create type public.commercial_revision_status as enum ('draft', 'activated', 'terminated');
create type public.commercial_audit_entity as enum (
  'partner', 'partner_contact', 'agreement', 'agreement_revision', 'agreement_revision_point'
);

create table public.commercial_partners (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  trade_name text not null,
  legal_name text not null,
  tax_id text,
  email text,
  phone text,
  notes text,
  is_active boolean not null default true,
  archived_at timestamptz,
  last_changed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_partners_id_hotel_unique unique (id, hotel_id),
  constraint commercial_partners_trade_name_check check (length(btrim(trade_name)) between 1 and 160),
  constraint commercial_partners_legal_name_check check (length(btrim(legal_name)) between 1 and 200),
  constraint commercial_partners_tax_id_check check (tax_id is null or length(btrim(tax_id)) between 3 and 40),
  constraint commercial_partners_email_check check (email is null or length(btrim(email)) between 3 and 254),
  constraint commercial_partners_phone_check check (phone is null or length(btrim(phone)) <= 40),
  constraint commercial_partners_notes_check check (notes is null or length(btrim(notes)) <= 2000)
);
create unique index commercial_partners_hotel_trade_name_unique
  on public.commercial_partners(hotel_id, lower(btrim(trade_name)));
create unique index commercial_partners_hotel_tax_id_unique
  on public.commercial_partners(hotel_id, lower(btrim(tax_id))) where tax_id is not null;
create index commercial_partners_hotel_status_index
  on public.commercial_partners(hotel_id, archived_at, is_active, trade_name);

create table public.commercial_partner_contacts (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  partner_id uuid not null,
  name text not null,
  role text,
  purpose public.commercial_contact_purpose not null default 'general',
  email text,
  phone text,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  archived_at timestamptz,
  last_changed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_partner_contacts_id_hotel_unique unique (id, hotel_id),
  constraint commercial_partner_contacts_partner_hotel_fkey foreign key (partner_id, hotel_id)
    references public.commercial_partners(id, hotel_id) on delete restrict,
  constraint commercial_partner_contacts_name_check check (length(btrim(name)) between 1 and 160),
  constraint commercial_partner_contacts_role_check check (role is null or length(btrim(role)) <= 120),
  constraint commercial_partner_contacts_channel_check check (email is not null or phone is not null)
);
create unique index commercial_partner_contacts_primary_unique
  on public.commercial_partner_contacts(partner_id, purpose)
  where is_primary and archived_at is null;

create table public.commercial_agreements (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  partner_id uuid not null,
  internal_number text not null,
  archived_at timestamptz,
  last_changed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_agreements_id_hotel_unique unique (id, hotel_id),
  constraint commercial_agreements_partner_hotel_fkey foreign key (partner_id, hotel_id)
    references public.commercial_partners(id, hotel_id) on delete restrict,
  constraint commercial_agreements_number_check check (length(btrim(internal_number)) between 1 and 80)
);
create unique index commercial_agreements_hotel_number_unique
  on public.commercial_agreements(hotel_id, lower(btrim(internal_number)));
create index commercial_agreements_partner_index
  on public.commercial_agreements(hotel_id, partner_id, archived_at);

create table public.commercial_agreement_revisions (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  agreement_id uuid not null,
  version integer not null,
  starts_on date not null,
  ends_on date,
  status public.commercial_revision_status not null default 'draft',
  commercial_model public.commercial_model not null,
  fixed_rent numeric(14,2),
  rent_frequency public.commercial_rent_frequency,
  commission_percentage numeric(7,4),
  minimum_guarantee numeric(14,2),
  payment_recipient public.commercial_payment_recipient not null,
  currency text not null,
  notes text,
  activated_at timestamptz,
  activated_by uuid references public.users(id) on delete set null,
  terminated_at timestamptz,
  terminated_by uuid references public.users(id) on delete set null,
  last_changed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_agreement_revisions_id_hotel_unique unique (id, hotel_id),
  constraint commercial_agreement_revisions_agreement_hotel_fkey foreign key (agreement_id, hotel_id)
    references public.commercial_agreements(id, hotel_id) on delete restrict,
  constraint commercial_agreement_revisions_version_unique unique (agreement_id, version),
  constraint commercial_agreement_revisions_version_check check (version > 0),
  constraint commercial_agreement_revisions_dates_check check (ends_on is null or ends_on >= starts_on),
  constraint commercial_agreement_revisions_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint commercial_agreement_revisions_values_check check (
    (fixed_rent is null or fixed_rent >= 0)
    and (commission_percentage is null or commission_percentage between 0 and 100)
    and (minimum_guarantee is null or minimum_guarantee >= 0)
  ),
  constraint commercial_agreement_revisions_terms_check check (
    (commercial_model = 'fixed_rent' and fixed_rent is not null and rent_frequency is not null
      and commission_percentage is null and minimum_guarantee is null)
    or (commercial_model = 'revenue_share' and fixed_rent is null and rent_frequency is null
      and commission_percentage is not null and minimum_guarantee is null)
    or (commercial_model = 'hybrid' and fixed_rent is not null and rent_frequency is not null
      and commission_percentage is not null)
  ),
  constraint commercial_agreement_revisions_activation_shape_check check (
    (status = 'draft' and activated_at is null and terminated_at is null)
    or (status = 'activated' and activated_at is not null and terminated_at is null)
    or (status = 'terminated' and activated_at is not null and terminated_at is not null)
  )
);
create index commercial_agreement_revisions_effective_index
  on public.commercial_agreement_revisions(hotel_id, agreement_id, status, starts_on, ends_on);

create table public.commercial_agreement_revision_points (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  revision_id uuid not null,
  point_id uuid not null,
  last_changed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint commercial_agreement_revision_points_id_hotel_unique unique (id, hotel_id),
  constraint commercial_agreement_revision_points_revision_hotel_fkey foreign key (revision_id, hotel_id)
    references public.commercial_agreement_revisions(id, hotel_id) on delete restrict,
  constraint commercial_agreement_revision_points_point_hotel_fkey foreign key (point_id, hotel_id)
    references public.consumption_points(id, hotel_id) on delete restrict,
  constraint commercial_agreement_revision_points_unique unique (revision_id, point_id)
);

create table public.commercial_audit_events (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  entity_type public.commercial_audit_entity not null,
  entity_id uuid not null,
  actor_id uuid references public.users(id) on delete set null,
  action text not null,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint commercial_audit_events_action_check check (length(btrim(action)) between 1 and 80)
);
create index commercial_audit_events_entity_index
  on public.commercial_audit_events(hotel_id, entity_type, entity_id, created_at desc);

alter table public.products
  add column provider_type public.product_provider_type not null default 'hotel',
  add column commercial_partner_id uuid,
  add constraint products_commercial_partner_hotel_fkey foreign key (commercial_partner_id, hotel_id)
    references public.commercial_partners(id, hotel_id) on delete restrict,
  add constraint products_provider_shape_check check (
    (provider_type = 'hotel' and commercial_partner_id is null)
    or (provider_type = 'partner' and commercial_partner_id is not null)
  );

insert into public.catalog_audit_events(hotel_id, entity_type, entity_id, actor_id, action, changes)
select hotel_id, 'product', id, null, 'provider_migrated',
  jsonb_build_object('provider_type', 'hotel', 'commercial_partner_id', null)
from public.products;

alter table public.consumption_offers
  drop constraint consumption_offers_partner_mode_future_check,
  add column commercial_agreement_id uuid,
  add constraint consumption_offers_agreement_hotel_fkey foreign key (commercial_agreement_id, hotel_id)
    references public.commercial_agreements(id, hotel_id) on delete restrict;

create or replace function public.validate_commercial_actor(p_actor_id uuid, p_hotel_id uuid)
returns void language plpgsql as $$
begin
  if p_actor_id is not null and not public.maintenance_user_has_hotel_scope(p_actor_id, p_hotel_id) then
    raise exception 'commercial actor crosses hotel scope' using errcode = '23514';
  end if;
end;
$$;

create or replace function public.validate_commercial_record_scope()
returns trigger language plpgsql as $$
declare v_hotel uuid;
begin
  perform public.validate_commercial_actor(new.last_changed_by, new.hotel_id);
  if tg_table_name = 'commercial_partner_contacts' then
    select hotel_id into v_hotel from public.commercial_partners where id = new.partner_id;
  elsif tg_table_name = 'commercial_agreements' then
    select hotel_id into v_hotel from public.commercial_partners where id = new.partner_id;
  elsif tg_table_name = 'commercial_agreement_revisions' then
    select hotel_id into v_hotel from public.commercial_agreements where id = new.agreement_id;
  elsif tg_table_name = 'commercial_agreement_revision_points' then
    select hotel_id into v_hotel from public.commercial_agreement_revisions where id = new.revision_id;
  else
    v_hotel := new.hotel_id;
  end if;
  if v_hotel is distinct from new.hotel_id then
    raise exception 'commercial record crosses hotel scope' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_activated_commercial_revision_mutation()
returns trigger language plpgsql as $$
begin
  if current_setting('app.commercial_revision_transition', true) = 'true' then
    return new;
  end if;
  if old.status = 'draft' and new.status <> 'draft' then
    raise exception 'commercial revision status changes require a transactional routine' using errcode = '23514';
  end if;
  if old.status <> 'draft' and (
    new.starts_on is distinct from old.starts_on or new.ends_on is distinct from old.ends_on
    or new.commercial_model is distinct from old.commercial_model
    or new.fixed_rent is distinct from old.fixed_rent or new.rent_frequency is distinct from old.rent_frequency
    or new.commission_percentage is distinct from old.commission_percentage
    or new.minimum_guarantee is distinct from old.minimum_guarantee
    or new.payment_recipient is distinct from old.payment_recipient or new.currency is distinct from old.currency
    or new.notes is distinct from old.notes
  ) then
    raise exception 'activated commercial revision terms are immutable' using errcode = '23514';
  end if;
  if old.status = 'terminated' then
    raise exception 'terminated commercial revision is immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_commercial_revision_initial_draft()
returns trigger language plpgsql as $$
begin
  if new.status <> 'draft' then
    raise exception 'commercial revisions must start as draft' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_activated_revision_point_mutation()
returns trigger language plpgsql as $$
declare v_status public.commercial_revision_status;
begin
  select status into v_status from public.commercial_agreement_revisions
    where id = case when tg_op = 'DELETE' then old.revision_id else new.revision_id end;
  if v_status <> 'draft' then
    raise exception 'activated commercial revision points are immutable' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.prevent_product_provider_mutation()
returns trigger language plpgsql as $$
begin
  if new.provider_type is distinct from old.provider_type
    or new.commercial_partner_id is distinct from old.commercial_partner_id then
    raise exception 'product provider is immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.validate_product_commercial_provider()
returns trigger language plpgsql as $$
begin
  if new.provider_type = 'partner' and not exists (
    select 1 from public.commercial_partners partner
    where partner.id = new.commercial_partner_id and partner.hotel_id = new.hotel_id
      and partner.archived_at is null
  ) then
    raise exception 'commercial partner is archived or outside hotel scope' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.validate_consumption_offer_commercial_terms()
returns trigger language plpgsql as $$
declare
  v_provider public.product_provider_type;
  v_partner uuid;
  v_agreement_partner uuid;
  v_agreement_archived timestamptz;
  v_recipient public.commercial_payment_recipient;
  v_modes public.consumption_billing_mode[];
begin
  select provider_type, commercial_partner_id into v_provider, v_partner
    from public.products where id = new.product_id and hotel_id = new.hotel_id;
  if new.policy_source = 'inherit' then
    select default_allowed_billing_modes into v_modes from public.consumption_points
      where id = new.point_id and hotel_id = new.hotel_id;
  else
    v_modes := new.allowed_billing_modes;
  end if;
  if v_provider = 'hotel' then
    if new.commercial_agreement_id is not null
      or 'partner_direct'::public.consumption_billing_mode = any(v_modes) then
      raise exception 'hotel product cannot use a commercial agreement or partner payment' using errcode = '23514';
    end if;
    return new;
  end if;
  if new.commercial_agreement_id is null then
    raise exception 'partner product requires a commercial agreement' using errcode = '23514';
  end if;
  select partner_id, archived_at into v_agreement_partner, v_agreement_archived
    from public.commercial_agreements
    where id = new.commercial_agreement_id and hotel_id = new.hotel_id;
  if v_agreement_partner is distinct from v_partner or v_agreement_archived is not null then
    raise exception 'commercial agreement is not eligible for product' using errcode = '23514';
  end if;
  select revision.payment_recipient into v_recipient
    from public.commercial_agreement_revisions revision
    join public.commercial_agreement_revision_points scope on scope.revision_id = revision.id
    where revision.agreement_id = new.commercial_agreement_id and scope.point_id = new.point_id
      and revision.status <> 'terminated'
    order by revision.version desc limit 1;
  if v_recipient is null then
    raise exception 'commercial agreement does not cover this point' using errcode = '23514';
  end if;
  if 'partner_direct'::public.consumption_billing_mode = any(v_modes)
    and (new.policy_source <> 'override' or v_recipient not in ('partner', 'both')) then
    raise exception 'partner payment is incompatible with agreement' using errcode = '23514';
  end if;
  if (('hotel_immediate'::public.consumption_billing_mode = any(v_modes))
      or ('stay_folio'::public.consumption_billing_mode = any(v_modes)))
    and v_recipient not in ('hotel', 'both') then
    raise exception 'hotel payment is incompatible with agreement' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.write_commercial_audit_event()
returns trigger language plpgsql as $$
declare v_action text; v_new jsonb; v_old jsonb;
begin
  v_new := to_jsonb(new);
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op = 'INSERT' then v_action := 'created';
  elsif v_new ? 'archived_at' and v_new->'archived_at' is distinct from v_old->'archived_at' then
    v_action := case when v_new->>'archived_at' is null then 'restored' else 'archived' end;
  elsif v_new ? 'is_active' and v_new->'is_active' is distinct from v_old->'is_active' then
    v_action := case when (v_new->>'is_active')::boolean then 'activated' else 'deactivated' end;
  elsif tg_table_name = 'commercial_agreement_revisions' and v_new->'status' is distinct from v_old->'status' then
    v_action := v_new->>'status';
  else v_action := 'updated'; end if;
  insert into public.commercial_audit_events(hotel_id, entity_type, entity_id, actor_id, action, changes)
  values (new.hotel_id,
    case tg_table_name
      when 'commercial_partners' then 'partner'::public.commercial_audit_entity
      when 'commercial_partner_contacts' then 'partner_contact'::public.commercial_audit_entity
      when 'commercial_agreements' then 'agreement'::public.commercial_audit_entity
      when 'commercial_agreement_revisions' then 'agreement_revision'::public.commercial_audit_entity
      else 'agreement_revision_point'::public.commercial_audit_entity end,
    new.id, new.last_changed_by, v_action,
    jsonb_build_object('before', case when tg_op = 'INSERT' then null else v_old - 'last_changed_by' end,
      'after', v_new - 'last_changed_by'));
  return new;
end;
$$;

create or replace function public.prevent_commercial_deletion()
returns trigger language plpgsql as $$
begin raise exception 'commercial records must be archived or preserved' using errcode = '23514'; end;
$$;
create or replace function public.prevent_commercial_audit_mutation()
returns trigger language plpgsql as $$
begin raise exception 'commercial audit is immutable' using errcode = '23514'; end;
$$;

create or replace function public.activate_commercial_agreement_revision(
  p_hotel_id uuid, p_revision_id uuid, p_actor_id uuid
) returns text language plpgsql set search_path = public as $$
declare v_revision public.commercial_agreement_revisions%rowtype; v_partner uuid;
begin
  perform public.validate_commercial_actor(p_actor_id, p_hotel_id);
  select * into v_revision from public.commercial_agreement_revisions
    where id = p_revision_id and hotel_id = p_hotel_id for update;
  if not found or v_revision.status <> 'draft' then return 'conflict'; end if;
  if not exists (
    select 1 from public.commercial_agreement_revision_points scope
    join public.consumption_points point on point.id = scope.point_id and point.hotel_id = scope.hotel_id
    where scope.revision_id = v_revision.id and point.archived_at is null
  ) then return 'conflict'; end if;
  select agreement.partner_id into v_partner
    from public.commercial_agreements agreement
    join public.commercial_partners partner on partner.id = agreement.partner_id
      and partner.hotel_id = agreement.hotel_id
    where agreement.id = v_revision.agreement_id
      and agreement.hotel_id = p_hotel_id
      and agreement.archived_at is null
      and partner.archived_at is null;
  if not found then return 'conflict'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_hotel_id::text || ':' || v_partner::text, 0));
  if exists (
    select 1 from public.commercial_agreement_revisions current_revision
    where current_revision.agreement_id = v_revision.agreement_id
      and current_revision.status = 'activated'
      and current_revision.starts_on >= v_revision.starts_on
  ) then return 'overlap'; end if;
  if exists (
    select 1 from public.commercial_agreement_revisions other
    join public.commercial_agreements agreement on agreement.id = other.agreement_id
    join public.commercial_agreement_revision_points other_scope on other_scope.revision_id = other.id
    join public.commercial_agreement_revision_points candidate_scope on candidate_scope.revision_id = v_revision.id
      and candidate_scope.point_id = other_scope.point_id
    where agreement.partner_id = v_partner and other.hotel_id = p_hotel_id and other.status = 'activated'
      and other.id <> v_revision.id
      and other.agreement_id <> v_revision.agreement_id
      and daterange(other.starts_on, coalesce(other.ends_on + 1, 'infinity'::date), '[)')
        && daterange(v_revision.starts_on, coalesce(v_revision.ends_on + 1, 'infinity'::date), '[)')
  ) then return 'overlap'; end if;
  perform set_config('app.commercial_revision_transition', 'true', true);
  update public.commercial_agreement_revisions
    set ends_on = v_revision.starts_on - 1, last_changed_by = p_actor_id
    where agreement_id = v_revision.agreement_id and status = 'activated'
      and starts_on < v_revision.starts_on and (ends_on is null or ends_on >= v_revision.starts_on);
  update public.commercial_agreement_revisions set status = 'activated', activated_at = now(),
    activated_by = p_actor_id, last_changed_by = p_actor_id where id = v_revision.id;
  perform set_config('app.commercial_revision_transition', 'false', true);
  return 'ok';
end;
$$;

create or replace function public.create_commercial_agreement(
  p_hotel_id uuid, p_partner_id uuid, p_internal_number text, p_actor_id uuid,
  p_starts_on date, p_ends_on date, p_commercial_model public.commercial_model,
  p_fixed_rent numeric, p_rent_frequency public.commercial_rent_frequency,
  p_commission_percentage numeric, p_minimum_guarantee numeric,
  p_payment_recipient public.commercial_payment_recipient, p_notes text, p_point_ids uuid[]
) returns uuid language plpgsql set search_path = public as $$
declare v_agreement_id uuid; v_revision_id uuid; v_currency text;
begin
  perform public.validate_commercial_actor(p_actor_id, p_hotel_id);
  if not exists (select 1 from public.commercial_partners where id = p_partner_id
    and hotel_id = p_hotel_id and archived_at is null) then
    raise exception 'commercial partner unavailable' using errcode = '23514';
  end if;
  if cardinality(p_point_ids) < 1 or exists (
    select 1 from unnest(p_point_ids) candidate(id)
    left join public.consumption_points point on point.id = candidate.id and point.hotel_id = p_hotel_id
    where point.id is null
  ) then raise exception 'invalid commercial agreement points' using errcode = '23514'; end if;
  select currency into v_currency from public.hotels where id = p_hotel_id;
  insert into public.commercial_agreements(hotel_id, partner_id, internal_number, last_changed_by)
    values (p_hotel_id, p_partner_id, p_internal_number, p_actor_id) returning id into v_agreement_id;
  insert into public.commercial_agreement_revisions(
    hotel_id, agreement_id, version, starts_on, ends_on, commercial_model, fixed_rent,
    rent_frequency, commission_percentage, minimum_guarantee, payment_recipient,
    currency, notes, last_changed_by
  ) values (
    p_hotel_id, v_agreement_id, 1, p_starts_on, p_ends_on, p_commercial_model,
    p_fixed_rent, p_rent_frequency, p_commission_percentage, p_minimum_guarantee,
    p_payment_recipient, v_currency, p_notes, p_actor_id
  ) returning id into v_revision_id;
  insert into public.commercial_agreement_revision_points(hotel_id, revision_id, point_id, last_changed_by)
    select p_hotel_id, v_revision_id, point_id, p_actor_id from unnest(p_point_ids) point_id;
  return v_agreement_id;
end;
$$;

create or replace function public.create_commercial_agreement_revision(
  p_hotel_id uuid, p_agreement_id uuid, p_actor_id uuid,
  p_starts_on date, p_ends_on date, p_commercial_model public.commercial_model,
  p_fixed_rent numeric, p_rent_frequency public.commercial_rent_frequency,
  p_commission_percentage numeric, p_minimum_guarantee numeric,
  p_payment_recipient public.commercial_payment_recipient, p_notes text, p_point_ids uuid[]
) returns uuid language plpgsql set search_path = public as $$
declare v_revision_id uuid; v_version integer; v_currency text;
begin
  perform public.validate_commercial_actor(p_actor_id, p_hotel_id);
  if not exists (select 1 from public.commercial_agreements where id = p_agreement_id
    and hotel_id = p_hotel_id and archived_at is null) then
    raise exception 'commercial agreement unavailable' using errcode = '23514';
  end if;
  if cardinality(p_point_ids) < 1 or exists (
    select 1 from unnest(p_point_ids) candidate(id)
    left join public.consumption_points point on point.id = candidate.id and point.hotel_id = p_hotel_id
    where point.id is null
  ) then raise exception 'invalid commercial agreement points' using errcode = '23514'; end if;
  perform 1 from public.commercial_agreements where id = p_agreement_id for update;
  select coalesce(max(version), 0) + 1 into v_version from public.commercial_agreement_revisions
    where agreement_id = p_agreement_id;
  select currency into v_currency from public.hotels where id = p_hotel_id;
  insert into public.commercial_agreement_revisions(
    hotel_id, agreement_id, version, starts_on, ends_on, commercial_model, fixed_rent,
    rent_frequency, commission_percentage, minimum_guarantee, payment_recipient,
    currency, notes, last_changed_by
  ) values (
    p_hotel_id, p_agreement_id, v_version, p_starts_on, p_ends_on, p_commercial_model,
    p_fixed_rent, p_rent_frequency, p_commission_percentage, p_minimum_guarantee,
    p_payment_recipient, v_currency, p_notes, p_actor_id
  ) returning id into v_revision_id;
  insert into public.commercial_agreement_revision_points(hotel_id, revision_id, point_id, last_changed_by)
    select p_hotel_id, v_revision_id, point_id, p_actor_id from unnest(p_point_ids) point_id;
  return v_revision_id;
end;
$$;

create or replace function public.set_commercial_agreement_revision_points(
  p_hotel_id uuid, p_revision_id uuid, p_actor_id uuid, p_point_ids uuid[]
) returns text language plpgsql set search_path = public as $$
begin
  perform public.validate_commercial_actor(p_actor_id, p_hotel_id);
  if not exists (select 1 from public.commercial_agreement_revisions where id = p_revision_id
    and hotel_id = p_hotel_id and status = 'draft') or cardinality(p_point_ids) < 1
    or exists (select 1 from unnest(p_point_ids) candidate(id)
      left join public.consumption_points point on point.id = candidate.id and point.hotel_id = p_hotel_id
      where point.id is null) then return 'conflict'; end if;
  delete from public.commercial_agreement_revision_points where revision_id = p_revision_id;
  insert into public.commercial_agreement_revision_points(hotel_id, revision_id, point_id, last_changed_by)
    select p_hotel_id, p_revision_id, point_id, p_actor_id from unnest(p_point_ids) point_id;
  insert into public.commercial_audit_events(hotel_id, entity_type, entity_id, actor_id, action, changes)
    values (p_hotel_id, 'agreement_revision', p_revision_id, p_actor_id, 'scope_updated',
      jsonb_build_object('point_ids', p_point_ids));
  return 'ok';
end;
$$;

create or replace function public.terminate_commercial_agreement_revision(
  p_hotel_id uuid, p_revision_id uuid, p_actor_id uuid, p_ends_on date
) returns text language plpgsql set search_path = public as $$
declare v_revision public.commercial_agreement_revisions%rowtype;
begin
  perform public.validate_commercial_actor(p_actor_id, p_hotel_id);
  select * into v_revision from public.commercial_agreement_revisions
    where id = p_revision_id and hotel_id = p_hotel_id for update;
  if not found or v_revision.status <> 'activated' or p_ends_on < v_revision.starts_on then return 'conflict'; end if;
  perform set_config('app.commercial_revision_transition', 'true', true);
  update public.commercial_agreement_revisions set status = 'terminated', ends_on = p_ends_on,
    terminated_at = now(), terminated_by = p_actor_id, last_changed_by = p_actor_id where id = p_revision_id;
  perform set_config('app.commercial_revision_transition', 'false', true);
  return 'ok';
end;
$$;

create trigger trg_products_prevent_provider_mutation before update on public.products
  for each row execute function public.prevent_product_provider_mutation();
create trigger trg_products_validate_commercial_provider before insert on public.products
  for each row execute function public.validate_product_commercial_provider();
create trigger trg_consumption_offers_validate_commercial before insert or update on public.consumption_offers
  for each row execute function public.validate_consumption_offer_commercial_terms();

create trigger trg_commercial_partners_updated before update on public.commercial_partners
  for each row execute function public.set_updated_at();
create trigger trg_commercial_contacts_updated before update on public.commercial_partner_contacts
  for each row execute function public.set_updated_at();
create trigger trg_commercial_agreements_updated before update on public.commercial_agreements
  for each row execute function public.set_updated_at();
create trigger trg_commercial_revisions_updated before update on public.commercial_agreement_revisions
  for each row execute function public.set_updated_at();
create trigger trg_commercial_revisions_initial_draft before insert on public.commercial_agreement_revisions
  for each row execute function public.enforce_commercial_revision_initial_draft();
create trigger trg_commercial_revisions_immutable before update on public.commercial_agreement_revisions
  for each row execute function public.prevent_activated_commercial_revision_mutation();
create trigger trg_commercial_revision_points_immutable before update or delete on public.commercial_agreement_revision_points
  for each row execute function public.prevent_activated_revision_point_mutation();

create trigger trg_commercial_partners_scope before insert or update on public.commercial_partners
  for each row execute function public.validate_commercial_record_scope();
create trigger trg_commercial_contacts_scope before insert or update on public.commercial_partner_contacts
  for each row execute function public.validate_commercial_record_scope();
create trigger trg_commercial_agreements_scope before insert or update on public.commercial_agreements
  for each row execute function public.validate_commercial_record_scope();
create trigger trg_commercial_revisions_scope before insert or update on public.commercial_agreement_revisions
  for each row execute function public.validate_commercial_record_scope();
create trigger trg_commercial_revision_points_scope before insert or update on public.commercial_agreement_revision_points
  for each row execute function public.validate_commercial_record_scope();

create trigger trg_commercial_partners_audit after insert or update on public.commercial_partners
  for each row execute function public.write_commercial_audit_event();
create trigger trg_commercial_contacts_audit after insert or update on public.commercial_partner_contacts
  for each row execute function public.write_commercial_audit_event();
create trigger trg_commercial_agreements_audit after insert or update on public.commercial_agreements
  for each row execute function public.write_commercial_audit_event();
create trigger trg_commercial_revisions_audit after insert or update on public.commercial_agreement_revisions
  for each row execute function public.write_commercial_audit_event();
create trigger trg_commercial_revision_points_audit after insert or update on public.commercial_agreement_revision_points
  for each row execute function public.write_commercial_audit_event();

create trigger trg_commercial_partners_no_delete before delete on public.commercial_partners
  for each row execute function public.prevent_commercial_deletion();
create trigger trg_commercial_contacts_no_delete before delete on public.commercial_partner_contacts
  for each row execute function public.prevent_commercial_deletion();
create trigger trg_commercial_agreements_no_delete before delete on public.commercial_agreements
  for each row execute function public.prevent_commercial_deletion();
create trigger trg_commercial_revisions_no_delete before delete on public.commercial_agreement_revisions
  for each row execute function public.prevent_commercial_deletion();
create trigger trg_commercial_audit_immutable before update or delete on public.commercial_audit_events
  for each row execute function public.prevent_commercial_audit_mutation();

alter table public.commercial_partners enable row level security;
alter table public.commercial_partner_contacts enable row level security;
alter table public.commercial_agreements enable row level security;
alter table public.commercial_agreement_revisions enable row level security;
alter table public.commercial_agreement_revision_points enable row level security;
alter table public.commercial_audit_events enable row level security;

grant usage on type public.product_provider_type, public.commercial_contact_purpose,
  public.commercial_model, public.commercial_rent_frequency, public.commercial_payment_recipient,
  public.commercial_revision_status, public.commercial_audit_entity to postgres, service_role;
grant select, insert, update on public.commercial_partners, public.commercial_partner_contacts,
  public.commercial_agreements, public.commercial_agreement_revisions,
  public.commercial_agreement_revision_points to postgres, service_role;
grant select, insert on public.commercial_audit_events to postgres, service_role;
grant execute on function public.activate_commercial_agreement_revision(uuid, uuid, uuid),
  public.terminate_commercial_agreement_revision(uuid, uuid, uuid, date),
  public.create_commercial_agreement(uuid, uuid, text, uuid, date, date, public.commercial_model,
    numeric, public.commercial_rent_frequency, numeric, numeric, public.commercial_payment_recipient,
    text, uuid[]),
  public.create_commercial_agreement_revision(uuid, uuid, uuid, date, date, public.commercial_model,
    numeric, public.commercial_rent_frequency, numeric, numeric, public.commercial_payment_recipient,
    text, uuid[]),
  public.set_commercial_agreement_revision_points(uuid, uuid, uuid, uuid[]) to postgres, service_role;

insert into public.permissions(name, type)
select name, 'HOTEL_PERMISSION'
from unnest(array[
  'read_commercial_partners',
  'manage_commercial_partners',
  'manage_commercial_agreements'
]) as name
on conflict (name) do nothing;
