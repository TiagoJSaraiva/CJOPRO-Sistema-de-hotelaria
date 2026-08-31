create type public.maintenance_location_kind as enum ('area', 'equipment');
create type public.maintenance_occurrence_kind as enum ('damage', 'defect', 'wear', 'safety_risk', 'special_cleaning', 'other');
create type public.maintenance_priority as enum ('low', 'normal', 'high', 'critical');
create type public.maintenance_occurrence_status as enum (
  'reported', 'triaged', 'in_progress', 'awaiting_inspection', 'awaiting_liability', 'resolved', 'canceled'
);
create type public.maintenance_work_order_status as enum (
  'pending', 'assigned', 'in_progress', 'paused', 'waiting', 'awaiting_inspection', 'completed', 'canceled'
);
create type public.maintenance_waiting_reason as enum ('parts', 'vendor', 'authorization', 'access', 'other');
create type public.maintenance_liability_status as enum ('not_applicable', 'not_assessed', 'suspected', 'confirmed', 'dismissed');
create type public.maintenance_responsible_party as enum ('guest', 'hotel', 'supplier', 'normal_wear');
create type public.maintenance_inspection_result as enum ('approved', 'rejected');

create table public.maintenance_locations (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  parent_location_id uuid references public.maintenance_locations(id) on delete restrict,
  kind public.maintenance_location_kind not null,
  name text not null,
  description text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_locations_name_check check (length(btrim(name)) between 1 and 120),
  constraint maintenance_locations_parent_check check (kind = 'equipment' or parent_location_id is null),
  constraint maintenance_locations_hotel_name_key unique (hotel_id, name)
);

create table public.maintenance_categories (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  name text not null,
  description text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_categories_name_check check (length(btrim(name)) between 1 and 100),
  constraint maintenance_categories_hotel_name_key unique (hotel_id, name)
);

create sequence public.maintenance_occurrence_number_seq;

create table public.maintenance_occurrences (
  id uuid primary key default gen_random_uuid(),
  occurrence_number bigint not null default nextval('public.maintenance_occurrence_number_seq'),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  category_id uuid not null references public.maintenance_categories(id) on delete restrict,
  room_id uuid references public.rooms(id) on delete restrict,
  location_id uuid references public.maintenance_locations(id) on delete restrict,
  stay_id uuid references public.stays(id) on delete restrict,
  kind public.maintenance_occurrence_kind not null,
  priority public.maintenance_priority not null default 'normal',
  status public.maintenance_occurrence_status not null default 'reported',
  description text not null,
  discovered_at timestamptz not null default now(),
  reported_by uuid not null references public.users(id) on delete restrict,
  blocking_recommended boolean not null default false,
  triaged_by uuid references public.users(id) on delete restrict,
  triaged_at timestamptz,
  liability_status public.maintenance_liability_status not null default 'not_assessed',
  suspected_party public.maintenance_responsible_party,
  confirmed_party public.maintenance_responsible_party,
  liability_notes text,
  liability_decided_by uuid references public.users(id) on delete restrict,
  liability_decided_at timestamptz,
  duplicate_of_id uuid references public.maintenance_occurrences(id) on delete restrict,
  canceled_reason text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_occurrences_number_key unique (occurrence_number),
  constraint maintenance_occurrences_target_check check ((room_id is null) <> (location_id is null)),
  constraint maintenance_occurrences_stay_room_check check (stay_id is null or room_id is not null),
  constraint maintenance_occurrences_not_self_duplicate_check check (duplicate_of_id is null or duplicate_of_id <> id),
  constraint maintenance_occurrences_description_check check (length(btrim(description)) between 3 and 4000),
  constraint maintenance_occurrences_suspected_check check (
    (liability_status = 'suspected' and suspected_party is not null)
    or liability_status <> 'suspected'
  ),
  constraint maintenance_occurrences_confirmed_check check (
    (liability_status = 'confirmed' and confirmed_party is not null and liability_decided_by is not null and liability_decided_at is not null)
    or liability_status <> 'confirmed'
  )
);

create table public.maintenance_work_orders (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  occurrence_id uuid not null references public.maintenance_occurrences(id) on delete cascade,
  title text not null,
  instructions text not null,
  priority public.maintenance_priority not null default 'normal',
  status public.maintenance_work_order_status not null default 'pending',
  assigned_to uuid references public.users(id) on delete restrict,
  due_at timestamptz,
  waiting_reason public.maintenance_waiting_reason,
  waiting_notes text,
  requires_inspection boolean not null default false,
  diagnosis text,
  resolution_notes text,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_work_orders_title_check check (length(btrim(title)) between 3 and 160),
  constraint maintenance_work_orders_instructions_check check (length(btrim(instructions)) between 3 and 4000),
  constraint maintenance_work_orders_assignment_check check (status <> 'assigned' or assigned_to is not null),
  constraint maintenance_work_orders_waiting_check check (status <> 'waiting' or waiting_reason is not null)
);

create table public.maintenance_inspections (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  work_order_id uuid not null references public.maintenance_work_orders(id) on delete cascade,
  inspector_id uuid not null references public.users(id) on delete restrict,
  result public.maintenance_inspection_result not null,
  notes text not null,
  created_at timestamptz not null default now(),
  constraint maintenance_inspections_notes_check check (length(btrim(notes)) between 3 and 2000)
);

create table public.maintenance_events (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  occurrence_id uuid not null references public.maintenance_occurrences(id) on delete cascade,
  work_order_id uuid references public.maintenance_work_orders(id) on delete cascade,
  actor_id uuid not null references public.users(id) on delete restrict,
  event_type text not null,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint maintenance_events_type_check check (length(btrim(event_type)) between 1 and 80)
);

create table public.maintenance_attachments (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  occurrence_id uuid not null references public.maintenance_occurrences(id) on delete cascade,
  work_order_id uuid references public.maintenance_work_orders(id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  content_type text not null,
  size_bytes bigint not null,
  uploaded_by uuid not null references public.users(id) on delete restrict,
  removed_at timestamptz,
  removed_by uuid references public.users(id) on delete restrict,
  removal_reason text,
  created_at timestamptz not null default now(),
  constraint maintenance_attachments_path_key unique (storage_path),
  constraint maintenance_attachments_type_check check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint maintenance_attachments_size_check check (size_bytes > 0 and size_bytes <= 10485760),
  constraint maintenance_attachments_removal_check check (
    (removed_at is null and removed_by is null and removal_reason is null)
    or (removed_at is not null and removed_by is not null and length(btrim(removal_reason)) >= 3)
  )
);

create table public.maintenance_checkout_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  occurrence_id uuid not null references public.maintenance_occurrences(id) on delete cascade,
  stay_id uuid not null references public.stays(id) on delete cascade,
  acknowledged_by uuid not null references public.users(id) on delete restrict,
  note text,
  acknowledged_at timestamptz not null default now(),
  constraint maintenance_checkout_ack_unique unique (occurrence_id, stay_id)
);

alter table public.room_blocks
  add column hotel_id uuid references public.hotels(id) on delete cascade,
  add column maintenance_occurrence_id uuid references public.maintenance_occurrences(id) on delete set null,
  add column created_by uuid references public.users(id) on delete set null,
  add column released_at timestamptz,
  add column released_by uuid references public.users(id) on delete set null,
  add column release_reason text,
  add column conflicts_acknowledged_at timestamptz,
  add column conflicts_acknowledged_by uuid references public.users(id) on delete set null,
  add column conflicts_acknowledgement text;

update public.room_blocks rb
set hotel_id = r.hotel_id
from public.rooms r
where r.id = rb.room_id;

alter table public.room_blocks alter column hotel_id set not null;
alter table public.room_blocks drop constraint room_blocks_room_id_dates_excl;
alter table public.room_blocks add constraint room_blocks_room_id_dates_excl exclude using gist (
  room_id with =,
  daterange(start_date, end_date, '[]'::text) with &&
) where (released_at is null);
alter table public.room_blocks add constraint room_blocks_release_check check (
  (released_at is null and released_by is null and release_reason is null)
  or (released_at is not null and released_by is not null and length(btrim(release_reason)) >= 3)
);

create index idx_maintenance_locations_hotel on public.maintenance_locations(hotel_id, is_active, display_order);
create index idx_maintenance_categories_hotel on public.maintenance_categories(hotel_id, is_active, display_order);
create index idx_maintenance_occurrences_hotel_status on public.maintenance_occurrences(hotel_id, status, priority, created_at desc);
create index idx_maintenance_occurrences_room on public.maintenance_occurrences(hotel_id, room_id, created_at desc) where room_id is not null;
create index idx_maintenance_occurrences_stay on public.maintenance_occurrences(hotel_id, stay_id) where stay_id is not null;
create index idx_maintenance_work_orders_assignee on public.maintenance_work_orders(hotel_id, assigned_to, status, due_at);
create index idx_maintenance_events_occurrence on public.maintenance_events(occurrence_id, created_at);
create index idx_maintenance_attachments_occurrence on public.maintenance_attachments(occurrence_id, created_at) where removed_at is null;
create index idx_room_blocks_maintenance_active on public.room_blocks(hotel_id, maintenance_occurrence_id, start_date, end_date) where released_at is null;

create trigger trg_maintenance_locations_set_updated_at before update on public.maintenance_locations
  for each row execute function public.set_updated_at();
create trigger trg_maintenance_categories_set_updated_at before update on public.maintenance_categories
  for each row execute function public.set_updated_at();
create trigger trg_maintenance_occurrences_set_updated_at before update on public.maintenance_occurrences
  for each row execute function public.set_updated_at();
create trigger trg_maintenance_work_orders_set_updated_at before update on public.maintenance_work_orders
  for each row execute function public.set_updated_at();

create or replace function public.maintenance_user_has_hotel_scope(p_user_id uuid, p_hotel_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users u
    join public.user_roles ur on ur.user_id = u.id
    join public.roles r on r.id = ur.role_id
    where u.id = p_user_id and u.is_active
      and (ur.hotel_id = p_hotel_id or (ur.hotel_id is null and r.role_type = 'SYSTEM_ROLE'))
  );
$$;

create or replace function public.validate_maintenance_location_scope()
returns trigger
language plpgsql
as $$
declare
  v_hotel_id uuid;
  v_parent_kind public.maintenance_location_kind;
begin
  if new.parent_location_id is not null then
    select hotel_id, kind into v_hotel_id, v_parent_kind from public.maintenance_locations where id = new.parent_location_id;
    if v_hotel_id is distinct from new.hotel_id or v_parent_kind is distinct from 'area' then raise exception 'maintenance location crosses hotel scope or has an invalid parent' using errcode = '23514'; end if;
  end if;
  return new;
end;
$$;

create or replace function public.validate_maintenance_occurrence_scope()
returns trigger language plpgsql as $$
declare
  v_hotel_id uuid;
  v_room_id uuid;
begin
  if not public.maintenance_user_has_hotel_scope(new.reported_by, new.hotel_id)
    or (new.triaged_by is not null and not public.maintenance_user_has_hotel_scope(new.triaged_by, new.hotel_id))
    or (new.liability_decided_by is not null and not public.maintenance_user_has_hotel_scope(new.liability_decided_by, new.hotel_id)) then
    raise exception 'maintenance occurrence user crosses hotel scope' using errcode = '23514';
  end if;
  select hotel_id into v_hotel_id from public.maintenance_categories where id = new.category_id;
  if v_hotel_id is distinct from new.hotel_id then raise exception 'maintenance category crosses hotel scope' using errcode = '23514'; end if;
  if new.room_id is not null then
    select hotel_id into v_hotel_id from public.rooms where id = new.room_id;
    if v_hotel_id is distinct from new.hotel_id then raise exception 'maintenance room crosses hotel scope' using errcode = '23514'; end if;
  end if;
  if new.location_id is not null then
    select hotel_id into v_hotel_id from public.maintenance_locations where id = new.location_id;
    if v_hotel_id is distinct from new.hotel_id then raise exception 'maintenance location crosses hotel scope' using errcode = '23514'; end if;
  end if;
  if new.stay_id is not null then
    select r.hotel_id, s.room_id into v_hotel_id, v_room_id
    from public.stays s join public.reservations r on r.id = s.reservation_id where s.id = new.stay_id;
    if v_hotel_id is distinct from new.hotel_id or v_room_id is distinct from new.room_id then
      raise exception 'maintenance stay crosses target scope' using errcode = '23514';
    end if;
  end if;
  if new.duplicate_of_id is not null then
    select hotel_id into v_hotel_id from public.maintenance_occurrences where id = new.duplicate_of_id;
    if v_hotel_id is distinct from new.hotel_id then raise exception 'duplicate maintenance occurrence crosses hotel scope' using errcode = '23514'; end if;
  end if;
  if new.status = 'resolved' and (
    new.liability_status = 'suspected' or exists (
      select 1 from public.room_blocks where maintenance_occurrence_id = new.id and released_at is null
    )
  ) then raise exception 'maintenance occurrence has unresolved liability or active block' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.validate_maintenance_work_order_scope()
returns trigger language plpgsql as $$
declare v_hotel_id uuid;
begin
  select hotel_id into v_hotel_id from public.maintenance_occurrences where id = new.occurrence_id;
  if v_hotel_id is distinct from new.hotel_id then raise exception 'work order crosses hotel scope' using errcode = '23514'; end if;
  if not public.maintenance_user_has_hotel_scope(new.created_by, new.hotel_id)
    or (new.assigned_to is not null and not public.maintenance_user_has_hotel_scope(new.assigned_to, new.hotel_id)) then
    raise exception 'work order user crosses hotel scope' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger trg_maintenance_locations_validate_scope before insert or update on public.maintenance_locations
  for each row execute function public.validate_maintenance_location_scope();
create trigger trg_maintenance_occurrences_validate_scope before insert or update on public.maintenance_occurrences
  for each row execute function public.validate_maintenance_occurrence_scope();
create trigger trg_maintenance_work_orders_validate_scope before insert or update on public.maintenance_work_orders
  for each row execute function public.validate_maintenance_work_order_scope();

create or replace function public.validate_maintenance_child_scope()
returns trigger language plpgsql as $$
declare
  v_hotel_id uuid;
  v_occurrence_id uuid;
  v_assigned_to uuid;
  v_room_id uuid;
begin
  if tg_table_name = 'maintenance_inspections' then
    select hotel_id, occurrence_id, assigned_to into v_hotel_id, v_occurrence_id, v_assigned_to
    from public.maintenance_work_orders where id = new.work_order_id;
    if v_hotel_id is distinct from new.hotel_id or v_assigned_to = new.inspector_id
      or not public.maintenance_user_has_hotel_scope(new.inspector_id, new.hotel_id) then
      raise exception 'maintenance inspection crosses scope or uses the executor' using errcode = '23514';
    end if;
  elsif tg_table_name = 'maintenance_events' then
    select hotel_id into v_hotel_id from public.maintenance_occurrences where id = new.occurrence_id;
    if v_hotel_id is distinct from new.hotel_id or not public.maintenance_user_has_hotel_scope(new.actor_id, new.hotel_id) then raise exception 'maintenance event crosses hotel scope' using errcode = '23514'; end if;
    if new.work_order_id is not null then
      select occurrence_id into v_occurrence_id from public.maintenance_work_orders where id = new.work_order_id and hotel_id = new.hotel_id;
      if v_occurrence_id is distinct from new.occurrence_id then raise exception 'maintenance event crosses occurrence scope' using errcode = '23514'; end if;
    end if;
  elsif tg_table_name = 'maintenance_attachments' then
    select hotel_id into v_hotel_id from public.maintenance_occurrences where id = new.occurrence_id;
    if v_hotel_id is distinct from new.hotel_id
      or not public.maintenance_user_has_hotel_scope(new.uploaded_by, new.hotel_id)
      or (new.removed_by is not null and not public.maintenance_user_has_hotel_scope(new.removed_by, new.hotel_id)) then raise exception 'maintenance attachment crosses hotel scope' using errcode = '23514'; end if;
    if new.work_order_id is not null then
      select occurrence_id into v_occurrence_id from public.maintenance_work_orders where id = new.work_order_id and hotel_id = new.hotel_id;
      if v_occurrence_id is distinct from new.occurrence_id then raise exception 'maintenance attachment crosses occurrence scope' using errcode = '23514'; end if;
    end if;
  elsif tg_table_name = 'maintenance_checkout_acknowledgements' then
    select hotel_id, stay_id into v_hotel_id, v_occurrence_id from public.maintenance_occurrences where id = new.occurrence_id;
    if v_hotel_id is distinct from new.hotel_id or v_occurrence_id is distinct from new.stay_id
      or not public.maintenance_user_has_hotel_scope(new.acknowledged_by, new.hotel_id) then
      raise exception 'maintenance acknowledgement crosses stay scope' using errcode = '23514';
    end if;
  elsif tg_table_name = 'room_blocks' and new.maintenance_occurrence_id is not null then
    select hotel_id, room_id into v_hotel_id, v_room_id from public.maintenance_occurrences where id = new.maintenance_occurrence_id;
    if v_hotel_id is distinct from new.hotel_id or v_room_id is distinct from new.room_id
      or (new.created_by is not null and not public.maintenance_user_has_hotel_scope(new.created_by, new.hotel_id))
      or (new.released_by is not null and not public.maintenance_user_has_hotel_scope(new.released_by, new.hotel_id))
      or (new.conflicts_acknowledged_by is not null and not public.maintenance_user_has_hotel_scope(new.conflicts_acknowledged_by, new.hotel_id)) then
      raise exception 'maintenance room block crosses occurrence scope' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_maintenance_inspections_validate_scope before insert or update on public.maintenance_inspections
  for each row execute function public.validate_maintenance_child_scope();
create trigger trg_maintenance_events_validate_scope before insert or update on public.maintenance_events
  for each row execute function public.validate_maintenance_child_scope();
create trigger trg_maintenance_attachments_validate_scope before insert or update on public.maintenance_attachments
  for each row execute function public.validate_maintenance_child_scope();
create trigger trg_maintenance_acknowledgements_validate_scope before insert or update on public.maintenance_checkout_acknowledgements
  for each row execute function public.validate_maintenance_child_scope();
create trigger trg_room_blocks_validate_maintenance_scope before insert or update on public.room_blocks
  for each row execute function public.validate_maintenance_child_scope();

create or replace function public.prevent_maintenance_record_deletion()
returns trigger language plpgsql as $$
begin
  raise exception 'maintenance records must be canceled or deactivated, not deleted' using errcode = '23514';
end;
$$;

create or replace function public.prevent_maintenance_event_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'maintenance timeline is immutable' using errcode = '23514';
end;
$$;

create trigger trg_maintenance_locations_prevent_delete before delete on public.maintenance_locations for each row execute function public.prevent_maintenance_record_deletion();
create trigger trg_maintenance_categories_prevent_delete before delete on public.maintenance_categories for each row execute function public.prevent_maintenance_record_deletion();
create trigger trg_maintenance_occurrences_prevent_delete before delete on public.maintenance_occurrences for each row execute function public.prevent_maintenance_record_deletion();
create trigger trg_maintenance_work_orders_prevent_delete before delete on public.maintenance_work_orders for each row execute function public.prevent_maintenance_record_deletion();
create trigger trg_maintenance_inspections_prevent_delete before delete on public.maintenance_inspections for each row execute function public.prevent_maintenance_record_deletion();
create trigger trg_maintenance_attachments_prevent_delete before delete on public.maintenance_attachments for each row execute function public.prevent_maintenance_record_deletion();
create trigger trg_maintenance_acknowledgements_prevent_delete before delete on public.maintenance_checkout_acknowledgements for each row execute function public.prevent_maintenance_record_deletion();
create trigger trg_maintenance_events_immutable before update or delete on public.maintenance_events for each row execute function public.prevent_maintenance_event_mutation();

create or replace function public.recompute_maintenance_occurrence_status(p_occurrence_id uuid)
returns public.maintenance_occurrence_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_occ public.maintenance_occurrences%rowtype;
  v_next public.maintenance_occurrence_status;
  v_active_blocks integer;
  v_total integer;
  v_open integer;
  v_inspection integer;
  v_completed integer;
begin
  select * into v_occ from public.maintenance_occurrences where id = p_occurrence_id for update;
  if not found then raise exception 'occurrence not found' using errcode = 'P0002'; end if;
  if v_occ.status = 'canceled' then return v_occ.status; end if;

  select count(*),
         count(*) filter (where status not in ('completed', 'canceled')),
         count(*) filter (where status = 'awaiting_inspection'),
         count(*) filter (where status = 'completed')
    into v_total, v_open, v_inspection, v_completed
  from public.maintenance_work_orders where occurrence_id = p_occurrence_id;

  select count(*) into v_active_blocks from public.room_blocks
  where maintenance_occurrence_id = p_occurrence_id and released_at is null;

  if v_occ.triaged_at is null then v_next := 'reported';
  elsif v_inspection > 0 and v_open = v_inspection then v_next := 'awaiting_inspection';
  elsif v_open > 0 then v_next := 'in_progress';
  elsif v_total = 0 then v_next := 'triaged';
  elsif v_active_blocks > 0 then v_next := 'in_progress';
  elsif v_occ.liability_status = 'suspected' then v_next := 'awaiting_liability';
  elsif v_completed > 0 then v_next := 'resolved';
  else v_next := 'triaged';
  end if;

  update public.maintenance_occurrences
  set status = v_next, resolved_at = case when v_next = 'resolved' then coalesce(resolved_at, now()) else null end
  where id = p_occurrence_id;
  return v_next;
end;
$$;

create or replace function public.create_default_maintenance_categories(p_hotel_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.maintenance_categories(hotel_id, name, display_order)
  select p_hotel_id, item.name, item.ordinal
  from (values
    ('Elétrica', 10), ('Hidráulica', 20), ('Climatização', 30), ('Mobiliário', 40),
    ('Enxoval', 50), ('Eletrônicos', 60), ('Estrutura', 70), ('Segurança', 80),
    ('Limpeza especial', 90), ('Outros', 100)
  ) as item(name, ordinal)
  on conflict (hotel_id, name) do nothing;
$$;

create or replace function public.provision_maintenance_categories_for_hotel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.create_default_maintenance_categories(new.id);
  return new;
end;
$$;

create trigger trg_hotels_provision_maintenance_categories
  after insert on public.hotels for each row execute function public.provision_maintenance_categories_for_hotel();

select public.create_default_maintenance_categories(id) from public.hotels;

create or replace function public.checkout_stay_with_maintenance_acknowledgements(
  p_hotel_id uuid,
  p_stay_id uuid,
  p_actor_id uuid,
  p_occurrence_ids uuid[] default array[]::uuid[],
  p_note text default null
)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_updated boolean := false;
begin
  if not exists (
    select 1 from public.stays s
    join public.rooms r on r.id = s.room_id
    where s.id = p_stay_id and r.hotel_id = p_hotel_id
  ) then
    return false;
  end if;

  if exists (
    select 1
    from public.maintenance_occurrences occurrence
    where occurrence.hotel_id = p_hotel_id
      and occurrence.stay_id = p_stay_id
      and occurrence.status not in ('resolved', 'canceled')
      and occurrence.id <> all(coalesce(p_occurrence_ids, array[]::uuid[]))
      and not exists (
        select 1 from public.maintenance_checkout_acknowledgements acknowledgement
        where acknowledgement.occurrence_id = occurrence.id and acknowledgement.stay_id = p_stay_id
      )
  ) then
    raise exception using errcode = '23514', message = 'Há ocorrências de manutenção sem ciência para esta estadia.';
  end if;

  if exists (
    select 1 from unnest(coalesce(p_occurrence_ids, array[]::uuid[])) occurrence_id
    where not exists (
      select 1 from public.maintenance_occurrences occurrence
      where occurrence.id = occurrence_id
        and occurrence.hotel_id = p_hotel_id
        and occurrence.stay_id = p_stay_id
        and occurrence.status not in ('resolved', 'canceled')
    )
  ) then
    raise exception using errcode = '23514', message = 'A ciência contém uma ocorrência inválida para esta estadia.';
  end if;

  with acknowledged as (
    insert into public.maintenance_checkout_acknowledgements(hotel_id, occurrence_id, stay_id, acknowledged_by, note)
    select p_hotel_id, occurrence.id, p_stay_id, p_actor_id, nullif(btrim(p_note), '')
    from public.maintenance_occurrences occurrence
    where occurrence.id = any(coalesce(p_occurrence_ids, array[]::uuid[]))
      and occurrence.hotel_id = p_hotel_id
      and occurrence.stay_id = p_stay_id
    on conflict (occurrence_id, stay_id) do nothing
    returning occurrence_id
  )
  insert into public.maintenance_events(hotel_id, occurrence_id, actor_id, event_type, message)
  select p_hotel_id, occurrence_id, p_actor_id, 'checkout_acknowledged', nullif(btrim(p_note), '')
  from acknowledged;

  update public.stays
  set stay_status = 'checked_out', checkout_date_actual = now(), updated_at = now()
  where id = p_stay_id;
  v_updated := found;
  return v_updated;
end;
$$;

create or replace function public.apply_maintenance_occurrence_change(
  p_hotel_id uuid, p_occurrence_id uuid, p_actor_id uuid, p_patch jsonb,
  p_event_type text, p_message text default null
)
returns boolean language plpgsql set search_path = public as $$
declare
  v_current public.maintenance_occurrences%rowtype;
  v_next public.maintenance_occurrences%rowtype;
begin
  select * into v_current from public.maintenance_occurrences
  where id = p_occurrence_id and hotel_id = p_hotel_id for update;
  if not found then return false; end if;
  v_next := jsonb_populate_record(v_current, p_patch);
  update public.maintenance_occurrences set
    category_id = v_next.category_id, priority = v_next.priority, status = v_next.status,
    triaged_by = v_next.triaged_by, triaged_at = v_next.triaged_at,
    liability_status = v_next.liability_status, suspected_party = v_next.suspected_party,
    confirmed_party = v_next.confirmed_party, liability_notes = v_next.liability_notes,
    liability_decided_by = v_next.liability_decided_by, liability_decided_at = v_next.liability_decided_at,
    duplicate_of_id = v_next.duplicate_of_id,
    canceled_reason = v_next.canceled_reason, resolved_at = v_next.resolved_at
  where id = p_occurrence_id and hotel_id = p_hotel_id;
  insert into public.maintenance_events(hotel_id, occurrence_id, actor_id, event_type, message, metadata)
  values (p_hotel_id, p_occurrence_id, p_actor_id, p_event_type, p_message, p_patch);
  if p_event_type not in ('occurrence_canceled', 'occurrence_reopened') then
    perform public.recompute_maintenance_occurrence_status(p_occurrence_id);
  end if;
  return true;
end;
$$;

create or replace function public.create_maintenance_occurrence(
  p_hotel_id uuid, p_category_id uuid, p_room_id uuid default null, p_location_id uuid default null, p_stay_id uuid default null,
  p_kind public.maintenance_occurrence_kind default 'other', p_priority public.maintenance_priority default 'normal',
  p_description text default '', p_discovered_at timestamptz default now(), p_reported_by uuid default null, p_blocking_recommended boolean default false
)
returns uuid language plpgsql set search_path = public as $$
declare v_id uuid;
begin
  insert into public.maintenance_occurrences(
    hotel_id, category_id, room_id, location_id, stay_id, kind, priority, description,
    discovered_at, reported_by, blocking_recommended, liability_status
  ) values (
    p_hotel_id, p_category_id, p_room_id, p_location_id, p_stay_id, p_kind, p_priority,
    p_description, p_discovered_at, p_reported_by, p_blocking_recommended,
    case when p_kind = 'damage' then 'not_assessed'::public.maintenance_liability_status else 'not_applicable'::public.maintenance_liability_status end
  ) returning id into v_id;
  insert into public.maintenance_events(hotel_id, occurrence_id, actor_id, event_type, message)
  values (p_hotel_id, v_id, p_reported_by, 'occurrence_reported', p_description);
  return v_id;
end;
$$;

create or replace function public.create_maintenance_work_order(
  p_hotel_id uuid, p_occurrence_id uuid, p_actor_id uuid, p_title text, p_instructions text,
  p_priority public.maintenance_priority, p_assigned_to uuid default null,
  p_due_at timestamptz default null, p_requires_inspection boolean default false
)
returns uuid language plpgsql set search_path = public as $$
declare
  v_occurrence public.maintenance_occurrences%rowtype;
  v_order_id uuid;
  v_requires_inspection boolean;
begin
  select * into v_occurrence from public.maintenance_occurrences
  where id = p_occurrence_id and hotel_id = p_hotel_id for update;
  if not found then return null; end if;
  v_requires_inspection := p_requires_inspection or v_occurrence.priority = 'critical' or exists (
    select 1 from public.room_blocks where maintenance_occurrence_id = p_occurrence_id and released_at is null
  );
  insert into public.maintenance_work_orders(
    hotel_id, occurrence_id, title, instructions, priority, status, assigned_to,
    due_at, requires_inspection, created_by
  ) values (
    p_hotel_id, p_occurrence_id, p_title, p_instructions, p_priority,
    case when p_assigned_to is null then 'pending'::public.maintenance_work_order_status else 'assigned'::public.maintenance_work_order_status end,
    p_assigned_to, p_due_at, v_requires_inspection, p_actor_id
  ) returning id into v_order_id;
  insert into public.maintenance_events(hotel_id, occurrence_id, work_order_id, actor_id, event_type, message, metadata)
  values (p_hotel_id, p_occurrence_id, v_order_id, p_actor_id, 'work_order_created', p_title,
    jsonb_build_object('assigned_to', p_assigned_to, 'requires_inspection', v_requires_inspection));
  perform public.recompute_maintenance_occurrence_status(p_occurrence_id);
  return v_order_id;
end;
$$;

create or replace function public.create_maintenance_room_block(
  p_hotel_id uuid, p_occurrence_id uuid, p_actor_id uuid,
  p_start_date date, p_end_date date, p_status public.room_block_status,
  p_label text default null, p_conflict_acknowledgement text default null
)
returns uuid language plpgsql set search_path = public as $$
declare
  v_occurrence public.maintenance_occurrences%rowtype;
  v_block_id uuid;
  v_has_conflicts boolean;
begin
  select * into v_occurrence from public.maintenance_occurrences
  where id = p_occurrence_id and hotel_id = p_hotel_id for update;
  if not found or v_occurrence.room_id is null then return null; end if;
  select exists (
    select 1 from public.stays stay
    where stay.room_id = v_occurrence.room_id
      and stay.stay_status not in ('canceled', 'no_show')
      and stay.checkin_date_expected < (p_end_date + 1)::timestamptz
      and stay.checkout_date_expected > p_start_date::timestamptz
  ) into v_has_conflicts;
  if v_has_conflicts and nullif(btrim(p_conflict_acknowledgement), '') is null then
    raise exception 'Há estadias ou reservas conflitantes sem ciência.' using errcode = '23514';
  end if;
  insert into public.room_blocks(
    hotel_id, room_id, maintenance_occurrence_id, created_by, status, label, start_date, end_date,
    conflicts_acknowledged_at, conflicts_acknowledged_by, conflicts_acknowledgement
  ) values (
    p_hotel_id, v_occurrence.room_id, p_occurrence_id, p_actor_id, p_status, coalesce(p_label, 'OCO-' || lpad(v_occurrence.occurrence_number::text, 6, '0')),
    p_start_date, p_end_date, case when v_has_conflicts then now() end,
    case when v_has_conflicts then p_actor_id end, case when v_has_conflicts then p_conflict_acknowledgement end
  ) returning id into v_block_id;
  update public.maintenance_work_orders set requires_inspection = true
  where occurrence_id = p_occurrence_id and status not in ('completed', 'canceled');
  insert into public.maintenance_events(hotel_id, occurrence_id, actor_id, event_type, message, metadata)
  values (p_hotel_id, p_occurrence_id, p_actor_id, 'room_block_created', p_label,
    jsonb_build_object('block_id', v_block_id, 'start_date', p_start_date, 'end_date', p_end_date, 'conflicts_acknowledged', v_has_conflicts));
  perform public.recompute_maintenance_occurrence_status(p_occurrence_id);
  return v_block_id;
end;
$$;

create or replace function public.transition_maintenance_work_order(
  p_hotel_id uuid, p_work_order_id uuid, p_actor_id uuid, p_action text,
  p_assigned_to uuid default null, p_waiting_reason public.maintenance_waiting_reason default null,
  p_notes text default null, p_diagnosis text default null
)
returns uuid language plpgsql set search_path = public as $$
declare
  v_order public.maintenance_work_orders%rowtype;
  v_next public.maintenance_work_order_status;
begin
  select * into v_order from public.maintenance_work_orders
  where id = p_work_order_id and hotel_id = p_hotel_id for update;
  if not found then return null; end if;
  if p_action = 'assign' and v_order.status in ('pending', 'assigned', 'paused', 'waiting', 'in_progress') then
    v_next := case when p_assigned_to is null then 'pending' else 'assigned' end;
  elsif p_action = 'start' and v_order.status = 'assigned' then v_next := 'in_progress';
  elsif p_action = 'pause' and v_order.status = 'in_progress' then v_next := 'paused';
  elsif p_action = 'wait' and v_order.status = 'in_progress' and p_waiting_reason is not null then v_next := 'waiting';
  elsif p_action = 'resume' and v_order.status in ('paused', 'waiting') then v_next := 'in_progress';
  elsif p_action = 'complete' and v_order.status = 'in_progress' then
    v_next := case when v_order.requires_inspection then 'awaiting_inspection' else 'completed' end;
  elsif p_action = 'cancel' and v_order.status in ('pending', 'assigned', 'in_progress', 'paused', 'waiting') then v_next := 'canceled';
  elsif p_action = 'reopen' and v_order.status = 'completed' then
    v_next := case when v_order.assigned_to is null then 'pending' else 'in_progress' end;
  else
    raise exception 'Transição de ordem de trabalho inválida.' using errcode = '23514';
  end if;

  update public.maintenance_work_orders set
    status = v_next,
    assigned_to = case when p_action = 'assign' then p_assigned_to else assigned_to end,
    waiting_reason = case when p_action = 'wait' then p_waiting_reason when p_action = 'resume' then null else waiting_reason end,
    waiting_notes = case when p_action = 'wait' then p_notes when p_action = 'resume' then null else waiting_notes end,
    diagnosis = case when p_action = 'complete' then p_diagnosis else diagnosis end,
    resolution_notes = case when p_action in ('complete', 'cancel') then p_notes else resolution_notes end,
    started_at = case when p_action = 'start' then coalesce(started_at, now()) else started_at end,
    completed_at = case when v_next = 'completed' then now() when p_action in ('complete', 'reopen') then null else completed_at end
  where id = p_work_order_id;
  insert into public.maintenance_events(hotel_id, occurrence_id, work_order_id, actor_id, event_type, message, metadata)
  values (p_hotel_id, v_order.occurrence_id, p_work_order_id, p_actor_id, 'work_order_' || p_action, p_notes,
    jsonb_build_object('previous_status', v_order.status, 'status', v_next, 'assigned_to', p_assigned_to));
  perform public.recompute_maintenance_occurrence_status(v_order.occurrence_id);
  return v_order.occurrence_id;
end;
$$;

create or replace function public.inspect_maintenance_work_order(
  p_hotel_id uuid, p_work_order_id uuid, p_actor_id uuid,
  p_result public.maintenance_inspection_result, p_notes text
)
returns uuid language plpgsql set search_path = public as $$
declare v_order public.maintenance_work_orders%rowtype;
begin
  select * into v_order from public.maintenance_work_orders
  where id = p_work_order_id and hotel_id = p_hotel_id for update;
  if not found then return null; end if;
  if v_order.status <> 'awaiting_inspection' or v_order.assigned_to = p_actor_id then
    raise exception 'Inspeção não permitida.' using errcode = '23514';
  end if;
  insert into public.maintenance_inspections(hotel_id, work_order_id, inspector_id, result, notes)
  values (p_hotel_id, p_work_order_id, p_actor_id, p_result, p_notes);
  update public.maintenance_work_orders set
    status = case when p_result = 'approved' then 'completed'::public.maintenance_work_order_status else 'in_progress'::public.maintenance_work_order_status end,
    completed_at = case when p_result = 'approved' then now() else null end
  where id = p_work_order_id;
  insert into public.maintenance_events(hotel_id, occurrence_id, work_order_id, actor_id, event_type, message)
  values (p_hotel_id, v_order.occurrence_id, p_work_order_id, p_actor_id, 'inspection_' || p_result::text, p_notes);
  perform public.recompute_maintenance_occurrence_status(v_order.occurrence_id);
  return v_order.occurrence_id;
end;
$$;

create or replace function public.release_maintenance_room_block(
  p_hotel_id uuid, p_block_id uuid, p_actor_id uuid, p_reason text
)
returns uuid language plpgsql set search_path = public as $$
declare v_block public.room_blocks%rowtype;
begin
  select * into v_block from public.room_blocks
  where id = p_block_id and hotel_id = p_hotel_id for update;
  if not found or v_block.maintenance_occurrence_id is null then return null; end if;
  if v_block.released_at is not null then raise exception 'Bloqueio já liberado.' using errcode = '23514'; end if;
  if exists (
    select 1 from public.maintenance_work_orders
    where occurrence_id = v_block.maintenance_occurrence_id and requires_inspection
      and status not in ('completed', 'canceled')
  ) then raise exception 'Há inspeções obrigatórias pendentes.' using errcode = '23514'; end if;
  update public.room_blocks set released_at = now(), released_by = p_actor_id, release_reason = p_reason where id = p_block_id;
  insert into public.maintenance_events(hotel_id, occurrence_id, actor_id, event_type, message, metadata)
  values (p_hotel_id, v_block.maintenance_occurrence_id, p_actor_id, 'room_block_released', p_reason, jsonb_build_object('block_id', p_block_id));
  perform public.recompute_maintenance_occurrence_status(v_block.maintenance_occurrence_id);
  return v_block.maintenance_occurrence_id;
end;
$$;

alter table public.maintenance_locations enable row level security;
alter table public.maintenance_categories enable row level security;
alter table public.maintenance_occurrences enable row level security;
alter table public.maintenance_work_orders enable row level security;
alter table public.maintenance_inspections enable row level security;
alter table public.maintenance_events enable row level security;
alter table public.maintenance_attachments enable row level security;
alter table public.maintenance_checkout_acknowledgements enable row level security;

grant usage on type public.maintenance_location_kind, public.maintenance_occurrence_kind,
  public.maintenance_priority, public.maintenance_occurrence_status, public.maintenance_work_order_status,
  public.maintenance_waiting_reason, public.maintenance_liability_status, public.maintenance_responsible_party,
  public.maintenance_inspection_result to postgres, service_role;
grant usage, select on sequence public.maintenance_occurrence_number_seq to postgres, service_role;
grant select, insert, update on public.maintenance_locations, public.maintenance_categories,
  public.maintenance_occurrences, public.maintenance_work_orders, public.maintenance_inspections,
  public.maintenance_events, public.maintenance_attachments, public.maintenance_checkout_acknowledgements
  to postgres, service_role;
grant execute on function public.recompute_maintenance_occurrence_status(uuid),
  public.create_default_maintenance_categories(uuid),
  public.checkout_stay_with_maintenance_acknowledgements(uuid, uuid, uuid, uuid[], text),
  public.apply_maintenance_occurrence_change(uuid, uuid, uuid, jsonb, text, text),
  public.create_maintenance_occurrence(uuid, uuid, uuid, uuid, uuid, public.maintenance_occurrence_kind, public.maintenance_priority, text, timestamptz, uuid, boolean),
  public.create_maintenance_work_order(uuid, uuid, uuid, text, text, public.maintenance_priority, uuid, timestamptz, boolean),
  public.create_maintenance_room_block(uuid, uuid, uuid, date, date, public.room_block_status, text, text),
  public.transition_maintenance_work_order(uuid, uuid, uuid, text, uuid, public.maintenance_waiting_reason, text, text),
  public.inspect_maintenance_work_order(uuid, uuid, uuid, public.maintenance_inspection_result, text),
  public.release_maintenance_room_block(uuid, uuid, uuid, text) to postgres, service_role;

insert into public.permissions(name, type)
select name, 'HOTEL_PERMISSION'
from unnest(array[
  'create_maintenance_occurrence', 'read_maintenance', 'triage_maintenance', 'execute_maintenance',
  'manage_maintenance_blocks', 'inspect_maintenance', 'confirm_damage_liability', 'manage_maintenance_catalogs'
]) as name
on conflict (name) do nothing;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('maintenance-evidence', 'maintenance-evidence', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
