create type public.consumption_billing_mode as enum ('hotel_immediate', 'stay_folio', 'partner_direct');
create type public.consumption_policy_source as enum ('inherit', 'override');
create type public.consumption_configuration_entity as enum ('consumption_point', 'consumption_offer');

alter table public.products
  add constraint products_id_hotel_unique unique (id, hotel_id);

create table public.consumption_points (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  name text not null,
  internal_code text,
  description text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  default_allowed_billing_modes public.consumption_billing_mode[] not null,
  default_billing_mode public.consumption_billing_mode not null,
  archived_at timestamptz,
  last_changed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint consumption_points_id_hotel_unique unique (id, hotel_id),
  constraint consumption_points_name_check check (length(btrim(name)) between 1 and 120),
  constraint consumption_points_internal_code_check check (
    internal_code is null or length(btrim(internal_code)) between 1 and 80
  ),
  constraint consumption_points_description_check check (
    description is null or length(btrim(description)) <= 1000
  ),
  constraint consumption_points_display_order_check check (display_order >= 0),
  constraint consumption_points_modes_not_empty_check check (
    cardinality(default_allowed_billing_modes) > 0
  ),
  constraint consumption_points_default_mode_allowed_check check (
    default_billing_mode = any(default_allowed_billing_modes)
  ),
  constraint consumption_points_partner_mode_future_check check (
    not ('partner_direct'::public.consumption_billing_mode = any(default_allowed_billing_modes))
  )
);

create unique index consumption_points_hotel_name_unique
  on public.consumption_points(hotel_id, lower(btrim(name)));
create unique index consumption_points_hotel_code_unique
  on public.consumption_points(hotel_id, lower(btrim(internal_code)))
  where internal_code is not null;
create index consumption_points_hotel_order_index
  on public.consumption_points(hotel_id, archived_at, is_active, display_order, name);

create table public.consumption_offers (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  point_id uuid not null,
  product_id uuid not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  policy_source public.consumption_policy_source not null default 'inherit',
  allowed_billing_modes public.consumption_billing_mode[],
  default_billing_mode public.consumption_billing_mode,
  archived_at timestamptz,
  last_changed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint consumption_offers_id_hotel_unique unique (id, hotel_id),
  constraint consumption_offers_point_product_unique unique (point_id, product_id),
  constraint consumption_offers_point_hotel_fkey foreign key (point_id, hotel_id)
    references public.consumption_points(id, hotel_id) on delete restrict,
  constraint consumption_offers_product_hotel_fkey foreign key (product_id, hotel_id)
    references public.products(id, hotel_id) on delete restrict,
  constraint consumption_offers_display_order_check check (display_order >= 0),
  constraint consumption_offers_policy_shape_check check (
    (policy_source = 'inherit' and allowed_billing_modes is null and default_billing_mode is null)
    or (
      policy_source = 'override'
      and cardinality(allowed_billing_modes) > 0
      and default_billing_mode = any(allowed_billing_modes)
    )
  ),
  constraint consumption_offers_partner_mode_future_check check (
    allowed_billing_modes is null
    or not ('partner_direct'::public.consumption_billing_mode = any(allowed_billing_modes))
  )
);

create index consumption_offers_point_order_index
  on public.consumption_offers(hotel_id, point_id, archived_at, is_active, display_order, id);
create index consumption_offers_product_index
  on public.consumption_offers(hotel_id, product_id, archived_at);

create table public.consumption_configuration_audit_events (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  entity_type public.consumption_configuration_entity not null,
  entity_id uuid not null,
  actor_id uuid references public.users(id) on delete set null,
  action text not null,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint consumption_configuration_audit_action_check check (
    length(btrim(action)) between 1 and 80
  )
);

create index consumption_configuration_audit_entity_index
  on public.consumption_configuration_audit_events(
    hotel_id, entity_type, entity_id, created_at desc
  );

create or replace function public.validate_consumption_configuration_scope()
returns trigger language plpgsql as $$
declare
  v_point_hotel_id uuid;
  v_product_hotel_id uuid;
begin
  if new.last_changed_by is not null
    and not public.maintenance_user_has_hotel_scope(new.last_changed_by, new.hotel_id) then
    raise exception 'consumption configuration actor crosses hotel scope' using errcode = '23514';
  end if;

  if tg_table_name = 'consumption_offers' then
    select hotel_id into v_point_hotel_id from public.consumption_points where id = new.point_id;
    select hotel_id into v_product_hotel_id from public.products where id = new.product_id;
    if v_point_hotel_id is distinct from new.hotel_id
      or v_product_hotel_id is distinct from new.hotel_id then
      raise exception 'consumption offer crosses hotel scope' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.write_consumption_configuration_audit_event()
returns trigger language plpgsql as $$
declare v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'created';
  elsif new.archived_at is distinct from old.archived_at then
    v_action := case when new.archived_at is null then 'restored' else 'archived' end;
  elsif new.is_active is distinct from old.is_active then
    v_action := case when new.is_active then 'activated' else 'deactivated' end;
  elsif new.display_order is distinct from old.display_order
    and (to_jsonb(new) - 'display_order' - 'updated_at' - 'last_changed_by')
      = (to_jsonb(old) - 'display_order' - 'updated_at' - 'last_changed_by') then
    v_action := 'reordered';
  elsif tg_table_name = 'consumption_points'
    and (
      new.default_allowed_billing_modes is distinct from old.default_allowed_billing_modes
      or new.default_billing_mode is distinct from old.default_billing_mode
    ) then
    v_action := 'policy_updated';
  elsif tg_table_name = 'consumption_offers'
    and (
      new.policy_source is distinct from old.policy_source
      or new.allowed_billing_modes is distinct from old.allowed_billing_modes
      or new.default_billing_mode is distinct from old.default_billing_mode
    ) then
    v_action := 'policy_updated';
  else
    v_action := 'updated';
  end if;

  insert into public.consumption_configuration_audit_events(
    hotel_id, entity_type, entity_id, actor_id, action, changes
  ) values (
    new.hotel_id,
    case
      when tg_table_name = 'consumption_points'
        then 'consumption_point'::public.consumption_configuration_entity
      else 'consumption_offer'::public.consumption_configuration_entity
    end,
    new.id,
    new.last_changed_by,
    v_action,
    jsonb_build_object(
      'before', case when tg_op = 'INSERT' then null else to_jsonb(old) - 'last_changed_by' end,
      'after', to_jsonb(new) - 'last_changed_by'
    )
  );
  return new;
end;
$$;

create or replace function public.prevent_consumption_configuration_deletion()
returns trigger language plpgsql as $$
begin
  raise exception 'consumption configuration must be archived, not deleted' using errcode = '23514';
end;
$$;

create or replace function public.prevent_consumption_configuration_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'consumption configuration audit is immutable' using errcode = '23514';
end;
$$;

create or replace function public.reorder_consumption_points(
  p_hotel_id uuid,
  p_actor_id uuid,
  p_ids uuid[]
) returns text language plpgsql set search_path = public as $$
declare v_expected integer;
begin
  if not public.maintenance_user_has_hotel_scope(p_actor_id, p_hotel_id) then
    return 'conflict';
  end if;
  select count(*) into v_expected from public.consumption_points
    where hotel_id = p_hotel_id and archived_at is null;
  if cardinality(p_ids) is distinct from v_expected
    or (
      select count(distinct candidate.id)
      from unnest(p_ids) as candidate(id)
    ) <> v_expected
    or exists (
      select 1 from unnest(p_ids) as candidate(id)
      left join public.consumption_points point
        on point.id = candidate.id
        and point.hotel_id = p_hotel_id
        and point.archived_at is null
      where point.id is null
    ) then
    return 'conflict';
  end if;
  update public.consumption_points point
  set display_order = ordered.ordinality * 10, last_changed_by = p_actor_id
  from unnest(p_ids) with ordinality ordered(id, ordinality)
  where point.id = ordered.id and point.hotel_id = p_hotel_id;
  return 'ok';
end;
$$;

create or replace function public.reorder_consumption_offers(
  p_hotel_id uuid,
  p_point_id uuid,
  p_actor_id uuid,
  p_ids uuid[]
) returns text language plpgsql set search_path = public as $$
declare v_expected integer;
begin
  if not public.maintenance_user_has_hotel_scope(p_actor_id, p_hotel_id)
    or not exists (
      select 1 from public.consumption_points where id = p_point_id and hotel_id = p_hotel_id
    ) then
    return 'conflict';
  end if;
  select count(*) into v_expected from public.consumption_offers
    where hotel_id = p_hotel_id and point_id = p_point_id and archived_at is null;
  if cardinality(p_ids) is distinct from v_expected
    or (
      select count(distinct candidate.id)
      from unnest(p_ids) as candidate(id)
    ) <> v_expected
    or exists (
      select 1 from unnest(p_ids) as candidate(id)
      left join public.consumption_offers offer
        on offer.id = candidate.id and offer.hotel_id = p_hotel_id
        and offer.point_id = p_point_id and offer.archived_at is null
      where offer.id is null
    ) then
    return 'conflict';
  end if;
  update public.consumption_offers offer
  set display_order = ordered.ordinality * 10, last_changed_by = p_actor_id
  from unnest(p_ids) with ordinality ordered(id, ordinality)
  where offer.id = ordered.id and offer.hotel_id = p_hotel_id and offer.point_id = p_point_id;
  return 'ok';
end;
$$;

create trigger trg_consumption_points_set_updated_at before update on public.consumption_points
  for each row execute function public.set_updated_at();
create trigger trg_consumption_offers_set_updated_at before update on public.consumption_offers
  for each row execute function public.set_updated_at();
create trigger trg_consumption_points_validate_scope before insert or update on public.consumption_points
  for each row execute function public.validate_consumption_configuration_scope();
create trigger trg_consumption_offers_validate_scope before insert or update on public.consumption_offers
  for each row execute function public.validate_consumption_configuration_scope();
create trigger trg_consumption_points_write_audit after insert or update on public.consumption_points
  for each row execute function public.write_consumption_configuration_audit_event();
create trigger trg_consumption_offers_write_audit after insert or update on public.consumption_offers
  for each row execute function public.write_consumption_configuration_audit_event();
create trigger trg_consumption_points_prevent_delete before delete on public.consumption_points
  for each row execute function public.prevent_consumption_configuration_deletion();
create trigger trg_consumption_offers_prevent_delete before delete on public.consumption_offers
  for each row execute function public.prevent_consumption_configuration_deletion();
create trigger trg_consumption_configuration_audit_immutable
  before update or delete on public.consumption_configuration_audit_events
  for each row execute function public.prevent_consumption_configuration_audit_mutation();

alter table public.consumption_points enable row level security;
alter table public.consumption_offers enable row level security;
alter table public.consumption_configuration_audit_events enable row level security;

grant usage on type public.consumption_billing_mode,
  public.consumption_policy_source,
  public.consumption_configuration_entity to postgres, service_role;
grant select, insert, update on public.consumption_points,
  public.consumption_offers to postgres, service_role;
grant select, insert on public.consumption_configuration_audit_events to postgres, service_role;
grant execute on function public.reorder_consumption_points(uuid, uuid, uuid[]),
  public.reorder_consumption_offers(uuid, uuid, uuid, uuid[]) to postgres, service_role;

insert into public.permissions(name, type)
select name, 'HOTEL_PERMISSION'
from unnest(array[
  'read_consumption',
  'manage_consumption_settings',
  'post_consumption',
  'receive_consumption_payment',
  'grant_consumption_courtesy',
  'void_consumption',
  'approve_consumption_adjustment'
]) as name
on conflict (name) do nothing;
