create type public.inventory_negative_stock_policy as enum ('allow_with_warning', 'block');
create type public.inventory_movement_kind as enum (
  'opening', 'receipt', 'consumption', 'courtesy', 'return',
  'transfer_out', 'transfer_in', 'loss', 'internal_use',
  'adjustment_in', 'adjustment_out', 'count_gain', 'count_loss'
);
create type public.inventory_document_kind as enum ('receipt', 'adjustment', 'loss', 'internal_use', 'transfer');
create type public.inventory_count_status as enum ('draft', 'completed', 'canceled');

create table public.inventory_settings (
  hotel_id uuid primary key references public.hotels(id) on delete restrict,
  negative_stock_policy public.inventory_negative_stock_policy not null default 'allow_with_warning',
  updated_by uuid references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  name text not null,
  internal_code text,
  description text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_by uuid references public.users(id) on delete restrict,
  updated_by uuid references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_locations_id_hotel_unique unique (id, hotel_id),
  constraint inventory_locations_name_check check (length(btrim(name)) between 1 and 120),
  constraint inventory_locations_code_check check (internal_code is null or length(btrim(internal_code)) between 1 and 60),
  constraint inventory_locations_description_check check (description is null or length(btrim(description)) between 1 and 1000),
  constraint inventory_locations_order_check check (display_order >= 0)
);
create unique index inventory_locations_hotel_name_unique on public.inventory_locations(hotel_id, lower(btrim(name)));
create unique index inventory_locations_hotel_code_unique on public.inventory_locations(hotel_id, lower(btrim(internal_code))) where internal_code is not null;

create table public.inventory_positions (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  product_id uuid not null,
  location_id uuid not null,
  quantity numeric(14,3) not null default 0,
  version bigint not null default 0,
  minimum_quantity numeric(14,3) not null default 0,
  ideal_quantity numeric(14,3) not null default 0,
  average_unit_cost numeric(14,4),
  is_active boolean not null default true,
  archived_at timestamptz,
  created_by uuid references public.users(id) on delete restrict,
  updated_by uuid references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_positions_id_hotel_unique unique (id, hotel_id),
  constraint inventory_positions_product_hotel_fkey foreign key (product_id, hotel_id) references public.products(id, hotel_id) on delete restrict,
  constraint inventory_positions_location_hotel_fkey foreign key (location_id, hotel_id) references public.inventory_locations(id, hotel_id) on delete restrict,
  constraint inventory_positions_product_location_unique unique (hotel_id, product_id, location_id),
  constraint inventory_positions_integer_check check (quantity = trunc(quantity) and minimum_quantity = trunc(minimum_quantity) and ideal_quantity = trunc(ideal_quantity)),
  constraint inventory_positions_threshold_check check (minimum_quantity >= 0 and ideal_quantity >= minimum_quantity),
  constraint inventory_positions_cost_check check (average_unit_cost is null or average_unit_cost >= 0)
);

create table public.inventory_documents (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  kind public.inventory_document_kind not null,
  reason text not null,
  reference_code text,
  occurred_at timestamptz not null,
  posted_at timestamptz not null default now(),
  posted_by uuid not null references public.users(id) on delete restrict,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  metadata jsonb not null default '{}'::jsonb,
  constraint inventory_documents_id_hotel_unique unique (id, hotel_id),
  constraint inventory_documents_hotel_idempotency_unique unique (hotel_id, idempotency_key),
  constraint inventory_documents_reason_check check (length(btrim(reason)) between 3 and 1000),
  constraint inventory_documents_reference_check check (reference_code is null or length(btrim(reference_code)) between 1 and 120),
  constraint inventory_documents_time_check check (occurred_at <= posted_at)
);

create table public.inventory_count_sessions (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  location_id uuid not null,
  status public.inventory_count_status not null default 'draft',
  notes text,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_by uuid references public.users(id) on delete restrict,
  completed_at timestamptz,
  canceled_by uuid references public.users(id) on delete restrict,
  canceled_at timestamptz,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  constraint inventory_count_sessions_id_hotel_unique unique (id, hotel_id),
  constraint inventory_count_sessions_location_hotel_fkey foreign key (location_id, hotel_id) references public.inventory_locations(id, hotel_id) on delete restrict,
  constraint inventory_count_sessions_hotel_idempotency_unique unique (hotel_id, idempotency_key),
  constraint inventory_count_sessions_notes_check check (notes is null or length(btrim(notes)) between 1 and 1000),
  constraint inventory_count_sessions_status_check check (
    (status = 'draft' and completed_at is null and canceled_at is null)
    or (status = 'completed' and completed_at is not null and completed_by is not null and canceled_at is null)
    or (status = 'canceled' and canceled_at is not null and canceled_by is not null and completed_at is null)
  )
);

create table public.inventory_count_items (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  session_id uuid not null,
  position_id uuid not null,
  expected_quantity numeric(14,3) not null,
  expected_version bigint not null,
  counted_quantity numeric(14,3),
  constraint inventory_count_items_session_hotel_fkey foreign key (session_id, hotel_id) references public.inventory_count_sessions(id, hotel_id) on delete restrict,
  constraint inventory_count_items_position_hotel_fkey foreign key (position_id, hotel_id) references public.inventory_positions(id, hotel_id) on delete restrict,
  constraint inventory_count_items_session_position_unique unique (session_id, position_id),
  constraint inventory_count_items_integer_check check (expected_quantity = trunc(expected_quantity) and (counted_quantity is null or (counted_quantity >= 0 and counted_quantity = trunc(counted_quantity))))
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  position_id uuid not null,
  product_id uuid not null,
  location_id uuid not null,
  kind public.inventory_movement_kind not null,
  quantity_delta numeric(14,3) not null,
  quantity_before numeric(14,3) not null,
  quantity_after numeric(14,3) not null,
  average_unit_cost numeric(14,4),
  total_cost numeric(14,4),
  reason text,
  reference_code text,
  occurred_at timestamptz not null,
  posted_at timestamptz not null default now(),
  actor_id uuid references public.users(id) on delete restrict,
  document_id uuid,
  count_session_id uuid,
  consumption_order_id uuid,
  consumption_order_item_id uuid,
  consumption_correction_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  constraint inventory_movements_position_hotel_fkey foreign key (position_id, hotel_id) references public.inventory_positions(id, hotel_id) on delete restrict,
  constraint inventory_movements_product_hotel_fkey foreign key (product_id, hotel_id) references public.products(id, hotel_id) on delete restrict,
  constraint inventory_movements_location_hotel_fkey foreign key (location_id, hotel_id) references public.inventory_locations(id, hotel_id) on delete restrict,
  constraint inventory_movements_document_hotel_fkey foreign key (document_id, hotel_id) references public.inventory_documents(id, hotel_id) on delete restrict,
  constraint inventory_movements_count_hotel_fkey foreign key (count_session_id, hotel_id) references public.inventory_count_sessions(id, hotel_id) on delete restrict,
  constraint inventory_movements_order_hotel_fkey foreign key (consumption_order_id, hotel_id) references public.consumption_orders(id, hotel_id) on delete restrict,
  constraint inventory_movements_order_item_hotel_fkey foreign key (consumption_order_item_id, hotel_id) references public.consumption_order_items(id, hotel_id) on delete restrict,
  constraint inventory_movements_correction_hotel_fkey foreign key (consumption_correction_id, hotel_id) references public.consumption_corrections(id, hotel_id) on delete restrict,
  constraint inventory_movements_delta_check check (quantity_delta <> 0 and quantity_after = quantity_before + quantity_delta),
  constraint inventory_movements_integer_check check (quantity_delta = trunc(quantity_delta) and quantity_before = trunc(quantity_before) and quantity_after = trunc(quantity_after)),
  constraint inventory_movements_cost_check check ((average_unit_cost is null or average_unit_cost >= 0) and (total_cost is null or total_cost >= 0))
);
create unique index inventory_movements_consumption_item_unique on public.inventory_movements(consumption_order_item_id) where consumption_order_item_id is not null and kind in ('consumption', 'courtesy');
create unique index inventory_movements_correction_item_unique on public.inventory_movements(consumption_correction_id, consumption_order_item_id) where consumption_correction_id is not null and kind = 'return';
create index inventory_movements_hotel_time_idx on public.inventory_movements(hotel_id, occurred_at desc, id desc);

create table public.inventory_audit_events (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  actor_id uuid references public.users(id) on delete restrict,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint inventory_audit_entity_check check (entity_type in ('settings','location','position','document','count')),
  constraint inventory_audit_action_check check (length(btrim(action)) between 1 and 80)
);

alter table public.consumption_points add column default_inventory_location_id uuid;
alter table public.consumption_points add constraint consumption_points_inventory_location_hotel_fkey
  foreign key (default_inventory_location_id, hotel_id) references public.inventory_locations(id, hotel_id) on delete restrict;
alter table public.consumption_offers add column inventory_location_id uuid;
alter table public.consumption_offers add constraint consumption_offers_inventory_location_hotel_fkey
  foreign key (inventory_location_id, hotel_id) references public.inventory_locations(id, hotel_id) on delete restrict;
alter table public.consumption_order_items
  add column inventory_controlled_snapshot boolean not null default false,
  add column inventory_location_id_snapshot uuid,
  add column inventory_location_name_snapshot text,
  add column inventory_position_version_snapshot bigint;
alter table public.consumption_correction_items
  add column restock_quantity numeric(14,3) not null default 0,
  add column restock_location_id uuid,
  add column inventory_version bigint;
alter table public.consumption_correction_items add constraint consumption_correction_items_restock_check
  check (restock_quantity >= 0 and restock_quantity = trunc(restock_quantity));
alter table public.consumption_correction_items add constraint consumption_correction_items_restock_location_check
  check ((restock_quantity = 0 and restock_location_id is null) or (restock_quantity > 0 and restock_location_id is not null));

-- Keep the shared point/offer audit trigger compatible as both records gain
-- inventory-specific columns. JSON access avoids resolving fields that only
-- exist on one of the two trigger tables.
create or replace function public.write_consumption_configuration_audit_event()
returns trigger language plpgsql as $$
declare v_action text; v_new jsonb:=to_jsonb(new);
  v_old jsonb:=case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
begin
  if tg_op='INSERT' then v_action:='created';
  elsif v_new->'archived_at' is distinct from v_old->'archived_at' then
    v_action:=case when v_new->>'archived_at' is null then 'restored' else 'archived' end;
  elsif v_new->'is_active' is distinct from v_old->'is_active' then
    v_action:=case when (v_new->>'is_active')::boolean then 'activated' else 'deactivated' end;
  elsif v_new->'display_order' is distinct from v_old->'display_order'
    and (v_new-array['display_order','updated_at','last_changed_by'])=(v_old-array['display_order','updated_at','last_changed_by'])
    then v_action:='reordered';
  elsif tg_table_name='consumption_points' and (
    v_new->'default_allowed_billing_modes' is distinct from v_old->'default_allowed_billing_modes'
    or v_new->'default_billing_mode' is distinct from v_old->'default_billing_mode') then v_action:='policy_updated';
  elsif tg_table_name='consumption_offers' and (
    v_new->'policy_source' is distinct from v_old->'policy_source'
    or v_new->'allowed_billing_modes' is distinct from v_old->'allowed_billing_modes'
    or v_new->'default_billing_mode' is distinct from v_old->'default_billing_mode') then v_action:='policy_updated';
  else v_action:='updated'; end if;
  insert into public.consumption_configuration_audit_events(hotel_id,entity_type,entity_id,actor_id,action,changes)
  values((v_new->>'hotel_id')::uuid,
    case when tg_table_name='consumption_points' then 'consumption_point'::public.consumption_configuration_entity else 'consumption_offer'::public.consumption_configuration_entity end,
    (v_new->>'id')::uuid,nullif(v_new->>'last_changed_by','')::uuid,v_action,
    jsonb_build_object('before',case when tg_op='INSERT' then null else v_old-'last_changed_by' end,'after',v_new-'last_changed_by'));
  return new;
end;
$$;

insert into public.inventory_settings(hotel_id) select id from public.hotels on conflict do nothing;
insert into public.inventory_locations(hotel_id, name, internal_code, description, display_order)
select id, 'Estoque central', 'CENTRAL', 'Local principal criado automaticamente; nenhum produto foi ativado.', 0
from public.hotels;

create or replace function public.initialize_hotel_inventory()
returns trigger language plpgsql set search_path=public as $$
declare v_location_id uuid;
begin
  insert into public.inventory_settings(hotel_id) values(new.id) on conflict do nothing;
  insert into public.inventory_locations(hotel_id,name,internal_code,description,display_order)
  values(new.id,'Estoque central','CENTRAL','Local principal criado automaticamente; nenhum produto foi ativado.',0)
  on conflict do nothing returning id into v_location_id;
  if v_location_id is not null then
    insert into public.inventory_audit_events(hotel_id,entity_type,entity_id,action,changes)
    values(new.id,'location',v_location_id,'system_created',jsonb_build_object('source','hotel_created'));
  end if;
  return new;
end;
$$;
create trigger trg_hotels_initialize_inventory after insert on public.hotels
  for each row execute function public.initialize_hotel_inventory();

insert into public.inventory_audit_events(hotel_id,entity_type,entity_id,action,changes)
select hotel_id,'settings',hotel_id,'system_migrated',jsonb_build_object('source','20260907010000') from public.inventory_settings;
insert into public.inventory_audit_events(hotel_id,entity_type,entity_id,action,changes)
select hotel_id,'location',id,'system_created',jsonb_build_object('source','20260907010000') from public.inventory_locations where internal_code='CENTRAL';

insert into public.permissions(id, name, type)
select gen_random_uuid(), permission_name, 'HOTEL_PERMISSION'
from unnest(array['read_inventory','read_inventory_costs','manage_inventory_settings','post_inventory_movements','perform_inventory_counts']) permission_name
where not exists (select 1 from public.permissions where name = permission_name);

create or replace function public.inventory_assert_actor(p_actor_id uuid, p_hotel_id uuid)
returns void language plpgsql stable set search_path = public as $$
begin
  if not public.maintenance_user_has_hotel_scope(p_actor_id, p_hotel_id) then
    raise exception 'actor_outside_hotel' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.inventory_protect_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'inventory records are immutable' using errcode = '23514';
end;
$$;
create trigger trg_inventory_movements_immutable before update or delete on public.inventory_movements for each row execute function public.inventory_protect_immutable();
create trigger trg_inventory_documents_immutable before update or delete on public.inventory_documents for each row execute function public.inventory_protect_immutable();
create trigger trg_inventory_audit_immutable before update or delete on public.inventory_audit_events for each row execute function public.inventory_protect_immutable();

create or replace function public.inventory_audit_mutable_entity()
returns trigger language plpgsql set search_path=public as $$
declare v_row jsonb:=to_jsonb(new); v_old jsonb:=case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end; v_entity text; v_id uuid; v_actor uuid; v_action text;
begin
  v_entity:=case tg_table_name when 'inventory_settings' then 'settings' when 'inventory_locations' then 'location' else 'position' end;
  v_id:=case when tg_table_name='inventory_settings' then new.hotel_id else (v_row->>'id')::uuid end;
  v_actor:=coalesce(nullif(v_row->>'updated_by','')::uuid,nullif(v_row->>'created_by','')::uuid);
  v_action:=case when tg_op='INSERT' then 'created'
    when v_old->>'archived_at' is null and v_row->>'archived_at' is not null then 'archived'
    when v_old->>'archived_at' is not null and v_row->>'archived_at' is null then 'restored'
    else 'updated' end;
  insert into public.inventory_audit_events(hotel_id,entity_type,entity_id,action,actor_id,changes)
  values((v_row->>'hotel_id')::uuid,v_entity,v_id,v_action,v_actor,jsonb_build_object('before',case when tg_op='UPDATE' then v_old else null end,'after',v_row));
  return new;
end;
$$;
create trigger trg_inventory_settings_audit after insert or update on public.inventory_settings for each row execute function public.inventory_audit_mutable_entity();
create trigger trg_inventory_locations_audit after insert or update on public.inventory_locations for each row execute function public.inventory_audit_mutable_entity();
create trigger trg_inventory_positions_audit after insert or update on public.inventory_positions for each row execute function public.inventory_audit_mutable_entity();

create or replace function public.inventory_protect_count_records()
returns trigger language plpgsql set search_path=public as $$
declare v_status public.inventory_count_status;
begin
  if tg_op='DELETE' then raise exception 'inventory count records cannot be deleted' using errcode='23514'; end if;
  if tg_table_name='inventory_count_sessions' then
    if old.status<>'draft' then raise exception 'completed inventory count is immutable' using errcode='23514'; end if;
  else
    select status into v_status from public.inventory_count_sessions where id=old.session_id;
    if v_status<>'draft' then raise exception 'completed inventory count is immutable' using errcode='23514'; end if;
  end if;
  return new;
end;
$$;
create trigger trg_inventory_count_sessions_protect before update or delete on public.inventory_count_sessions for each row execute function public.inventory_protect_count_records();
create trigger trg_inventory_count_items_protect before update or delete on public.inventory_count_items for each row execute function public.inventory_protect_count_records();

create or replace function public.inventory_protect_location_delete()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'inventory locations cannot be deleted' using errcode = '23514'; end if;
  if new.archived_at is not null and old.archived_at is null and (
    exists (select 1 from public.inventory_positions where location_id = old.id and quantity <> 0)
    or exists (select 1 from public.inventory_positions where location_id = old.id and is_active and archived_at is null)
    or exists (select 1 from public.consumption_points where default_inventory_location_id = old.id and is_active and archived_at is null)
    or exists (select 1 from public.consumption_offers where inventory_location_id = old.id and is_active and archived_at is null)
  ) then raise exception 'inventory_location_in_use' using errcode = '23514'; end if;
  new.updated_at := now(); return new;
end;
$$;
create trigger trg_inventory_locations_protect before update or delete on public.inventory_locations for each row execute function public.inventory_protect_location_delete();

create or replace function public.inventory_protect_position()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then raise exception 'inventory positions cannot be deleted' using errcode = '23514'; end if;
  if ((not new.is_active and old.is_active) or (new.archived_at is not null and old.archived_at is null)) and old.quantity <> 0
    then raise exception 'inventory_position_has_balance' using errcode = '23514'; end if;
  if ((not new.is_active and old.is_active) or (new.archived_at is not null and old.archived_at is null)) and (
    exists (select 1 from public.consumption_points where default_inventory_location_id = old.location_id and is_active and archived_at is null)
    or exists (select 1 from public.consumption_offers where product_id = old.product_id and inventory_location_id = old.location_id and is_active and archived_at is null)
  ) then raise exception 'inventory_position_is_active_source' using errcode = '23514'; end if;
  new.updated_at := now(); return new;
end;
$$;
create trigger trg_inventory_positions_protect before update or delete on public.inventory_positions for each row execute function public.inventory_protect_position();

create or replace function public.configure_inventory_position(
  p_hotel_id uuid, p_actor_id uuid, p_product_id uuid, p_location_id uuid,
  p_initial_quantity numeric, p_minimum_quantity numeric, p_ideal_quantity numeric,
  p_average_unit_cost numeric, p_idempotency_key uuid
) returns jsonb language plpgsql set search_path = public as $$
declare v_product record; v_location record; v_position public.inventory_positions%rowtype; v_existing record;
  v_fingerprint text; v_document_id uuid;
begin
  perform public.inventory_assert_actor(p_actor_id, p_hotel_id);
  v_fingerprint := md5(jsonb_build_object('product',p_product_id,'location',p_location_id,'initial',p_initial_quantity,'minimum',p_minimum_quantity,'ideal',p_ideal_quantity,'cost',p_average_unit_cost)::text);
  select id, request_fingerprint into v_existing from public.inventory_documents where hotel_id=p_hotel_id and idempotency_key=p_idempotency_key for update;
  if found then
    if v_existing.request_fingerprint=v_fingerprint then return jsonb_build_object('result','ok','position_id',(select position_id from public.inventory_movements where document_id=v_existing.id limit 1),'created',false); end if;
    return jsonb_build_object('result','idempotency_conflict');
  end if;
  select * into v_product from public.products where id=p_product_id and hotel_id=p_hotel_id for update;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if v_product.provider_type <> 'hotel' or v_product.kind <> 'physical' or v_product.sales_unit not in ('unit','portion')
    then return jsonb_build_object('result','product_ineligible'); end if;
  select * into v_location from public.inventory_locations where id=p_location_id and hotel_id=p_hotel_id for update;
  if not found then return jsonb_build_object('result','location_not_found'); end if;
  if not v_location.is_active or v_location.archived_at is not null then return jsonb_build_object('result','location_unavailable'); end if;
  if p_initial_quantity < 0 or p_initial_quantity <> trunc(p_initial_quantity) or p_minimum_quantity < 0 or p_minimum_quantity <> trunc(p_minimum_quantity)
    or p_ideal_quantity < p_minimum_quantity or p_ideal_quantity <> trunc(p_ideal_quantity) or p_average_unit_cost < 0
    then return jsonb_build_object('result','invalid_values'); end if;
  if exists(select 1 from public.inventory_positions where hotel_id=p_hotel_id and product_id=p_product_id and location_id=p_location_id)
    then return jsonb_build_object('result','position_exists'); end if;
  insert into public.inventory_positions(hotel_id,product_id,location_id,quantity,version,minimum_quantity,ideal_quantity,average_unit_cost,created_by,updated_by)
  values(p_hotel_id,p_product_id,p_location_id,p_initial_quantity,case when p_initial_quantity>0 then 1 else 0 end,p_minimum_quantity,p_ideal_quantity,p_average_unit_cost,p_actor_id,p_actor_id)
  returning * into v_position;
  insert into public.inventory_documents(hotel_id,kind,reason,reference_code,occurred_at,posted_by,idempotency_key,request_fingerprint,metadata)
  values(p_hotel_id,'adjustment','Ativação do controle de estoque',null,now(),p_actor_id,p_idempotency_key,v_fingerprint,jsonb_build_object('operation','opening')) returning id into v_document_id;
  if p_initial_quantity>0 then
    insert into public.inventory_movements(hotel_id,position_id,product_id,location_id,kind,quantity_delta,quantity_before,quantity_after,average_unit_cost,total_cost,reason,occurred_at,actor_id,document_id)
    values(p_hotel_id,v_position.id,p_product_id,p_location_id,'opening',p_initial_quantity,0,p_initial_quantity,p_average_unit_cost,case when p_average_unit_cost is null then null else p_initial_quantity*p_average_unit_cost end,'Ativação do controle de estoque',now(),p_actor_id,v_document_id);
  end if;
  return jsonb_build_object('result','ok','position_id',v_position.id,'created',true);
end;
$$;

create or replace function public.apply_inventory_delta(
  p_position_id uuid, p_hotel_id uuid, p_quantity_delta numeric, p_kind public.inventory_movement_kind,
  p_actor_id uuid, p_occurred_at timestamptz, p_reason text, p_reference text,
  p_unit_cost numeric default null, p_document_id uuid default null, p_count_session_id uuid default null,
  p_order_id uuid default null, p_order_item_id uuid default null, p_correction_id uuid default null
) returns jsonb language plpgsql set search_path = public as $$
declare v_position public.inventory_positions%rowtype; v_before numeric; v_after numeric; v_cost numeric; v_policy public.inventory_negative_stock_policy;
begin
  select * into v_position from public.inventory_positions where id=p_position_id and hotel_id=p_hotel_id for update;
  if not found then return jsonb_build_object('result','position_not_found'); end if;
  if not v_position.is_active or v_position.archived_at is not null then return jsonb_build_object('result','position_inactive'); end if;
  if p_quantity_delta=0 or p_quantity_delta<>trunc(p_quantity_delta) or p_unit_cost<0 then return jsonb_build_object('result','invalid_quantity'); end if;
  v_before:=v_position.quantity; v_after:=v_before+p_quantity_delta;
  select negative_stock_policy into v_policy from public.inventory_settings where hotel_id=p_hotel_id;
  if p_quantity_delta<0 and v_after<0 and v_policy='block' then return jsonb_build_object('result','insufficient_inventory','available',v_before); end if;
  v_cost:=v_position.average_unit_cost;
  if p_quantity_delta>0 and p_unit_cost is not null then
    v_cost:=case when v_before>0 and v_position.average_unit_cost is not null
      then round(((v_before*v_position.average_unit_cost)+(p_quantity_delta*p_unit_cost))/(v_before+p_quantity_delta),4)
      else p_unit_cost end;
  end if;
  update public.inventory_positions set quantity=v_after,version=version+1,average_unit_cost=v_cost,updated_by=p_actor_id where id=v_position.id;
  insert into public.inventory_movements(hotel_id,position_id,product_id,location_id,kind,quantity_delta,quantity_before,quantity_after,
    average_unit_cost,total_cost,reason,reference_code,occurred_at,actor_id,document_id,count_session_id,consumption_order_id,consumption_order_item_id,consumption_correction_id,metadata)
  values(p_hotel_id,v_position.id,v_position.product_id,v_position.location_id,p_kind,p_quantity_delta,v_before,v_after,
    coalesce(p_unit_cost,v_position.average_unit_cost),
    case when coalesce(p_unit_cost,v_position.average_unit_cost) is null then null
      else abs(p_quantity_delta)*coalesce(p_unit_cost,v_position.average_unit_cost) end,
    nullif(btrim(p_reason),''),nullif(btrim(p_reference),''),p_occurred_at,p_actor_id,p_document_id,p_count_session_id,p_order_id,p_order_item_id,p_correction_id,
    jsonb_build_object('negative_stock_warning',v_after<0))
  returning id into v_position.id;
  return jsonb_build_object('result','ok','movement_id',v_position.id,'quantity_before',v_before,'quantity_after',v_after,'version',v_position.version+1,'warning',v_after<0);
end;
$$;

create or replace function public.post_inventory_document(
  p_hotel_id uuid, p_actor_id uuid, p_kind public.inventory_document_kind, p_direction text,
  p_reason text, p_reference text, p_occurred_at timestamptz, p_lines jsonb, p_idempotency_key uuid
) returns jsonb language plpgsql set search_path = public as $$
declare v_document_id uuid:=gen_random_uuid(); v_existing record; v_fingerprint text; v_line jsonb; v_result jsonb;
  v_delta numeric; v_movement_kind public.inventory_movement_kind;
begin
  perform public.inventory_assert_actor(p_actor_id,p_hotel_id);
  if p_kind not in ('receipt','adjustment','loss','internal_use') or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)<1
    or length(coalesce(btrim(p_reason),''))<3 or p_occurred_at>now() then return jsonb_build_object('result','invalid_document'); end if;
  v_fingerprint:=md5(jsonb_build_object('kind',p_kind,'direction',p_direction,'reason',btrim(p_reason),'reference',nullif(btrim(p_reference),''),'occurred',p_occurred_at,'lines',p_lines)::text);
  select id,request_fingerprint into v_existing from public.inventory_documents where hotel_id=p_hotel_id and idempotency_key=p_idempotency_key for update;
  if found then return case when v_existing.request_fingerprint=v_fingerprint then jsonb_build_object('result','ok','document_id',v_existing.id,'created',false) else jsonb_build_object('result','idempotency_conflict') end; end if;
  insert into public.inventory_documents(id,hotel_id,kind,reason,reference_code,occurred_at,posted_by,idempotency_key,request_fingerprint)
  values(v_document_id,p_hotel_id,p_kind,btrim(p_reason),nullif(btrim(p_reference),''),p_occurred_at,p_actor_id,p_idempotency_key,v_fingerprint);
  for v_line in select value from jsonb_array_elements(p_lines) order by value->>'position_id' loop
    v_delta:=(v_line->>'quantity')::numeric;
    if v_delta<=0 then raise exception 'invalid inventory quantity' using errcode='23514'; end if;
    if p_kind='receipt' then v_movement_kind:='receipt';
    elsif p_kind='loss' then v_movement_kind:='loss'; v_delta:=-v_delta;
    elsif p_kind='internal_use' then v_movement_kind:='internal_use'; v_delta:=-v_delta;
    elsif p_direction='in' then v_movement_kind:='adjustment_in';
    elsif p_direction='out' then v_movement_kind:='adjustment_out'; v_delta:=-v_delta;
    else raise exception 'invalid inventory direction' using errcode='23514'; end if;
    v_result:=public.apply_inventory_delta((v_line->>'position_id')::uuid,p_hotel_id,v_delta,v_movement_kind,p_actor_id,p_occurred_at,p_reason,p_reference,
      nullif(v_line->>'unit_cost','')::numeric,v_document_id);
    if v_result->>'result'<>'ok' then raise exception '%',v_result->>'result' using errcode='23514'; end if;
  end loop;
  insert into public.inventory_audit_events(hotel_id,entity_type,entity_id,action,actor_id,changes)
  values(p_hotel_id,'document',v_document_id,'completed',p_actor_id,jsonb_build_object('kind',p_kind,'line_count',jsonb_array_length(p_lines)));
  return jsonb_build_object('result','ok','document_id',v_document_id,'created',true);
exception when check_violation then return jsonb_build_object('result',sqlerrm); end;
$$;

create or replace function public.transfer_inventory(
  p_hotel_id uuid,p_actor_id uuid,p_source_location_id uuid,p_destination_location_id uuid,p_product_id uuid,
  p_quantity numeric,p_reason text,p_reference text,p_occurred_at timestamptz,p_idempotency_key uuid
) returns jsonb language plpgsql set search_path=public as $$
declare v_source public.inventory_positions%rowtype; v_destination public.inventory_positions%rowtype; v_document_id uuid:=gen_random_uuid();
  v_fingerprint text; v_existing record; v_result jsonb;
begin
  perform public.inventory_assert_actor(p_actor_id,p_hotel_id);
  if p_source_location_id=p_destination_location_id or p_quantity<=0 or p_quantity<>trunc(p_quantity) or p_occurred_at>now() or length(coalesce(btrim(p_reason),''))<3
    then return jsonb_build_object('result','invalid_transfer'); end if;
  v_fingerprint:=md5(jsonb_build_object('source',p_source_location_id,'destination',p_destination_location_id,'product',p_product_id,'quantity',p_quantity,'reason',btrim(p_reason),'reference',nullif(btrim(p_reference),''),'occurred',p_occurred_at)::text);
  select id,request_fingerprint into v_existing from public.inventory_documents where hotel_id=p_hotel_id and idempotency_key=p_idempotency_key for update;
  if found then return case when v_existing.request_fingerprint=v_fingerprint then jsonb_build_object('result','ok','document_id',v_existing.id,'created',false) else jsonb_build_object('result','idempotency_conflict') end; end if;
  perform 1 from public.inventory_positions where hotel_id=p_hotel_id and product_id=p_product_id and location_id in(p_source_location_id,p_destination_location_id) order by id for update;
  select * into v_source from public.inventory_positions where hotel_id=p_hotel_id and product_id=p_product_id and location_id=p_source_location_id;
  select * into v_destination from public.inventory_positions where hotel_id=p_hotel_id and product_id=p_product_id and location_id=p_destination_location_id;
  if v_source.id is null or v_destination.id is null then return jsonb_build_object('result','position_not_found'); end if;
  insert into public.inventory_documents(id,hotel_id,kind,reason,reference_code,occurred_at,posted_by,idempotency_key,request_fingerprint,metadata)
  values(v_document_id,p_hotel_id,'transfer',btrim(p_reason),nullif(btrim(p_reference),''),p_occurred_at,p_actor_id,p_idempotency_key,v_fingerprint,jsonb_build_object('source_location_id',p_source_location_id,'destination_location_id',p_destination_location_id));
  v_result:=public.apply_inventory_delta(v_source.id,p_hotel_id,-p_quantity,'transfer_out',p_actor_id,p_occurred_at,p_reason,p_reference,null,v_document_id);
  if v_result->>'result'<>'ok' then raise exception '%',v_result->>'result' using errcode='23514'; end if;
  v_result:=public.apply_inventory_delta(v_destination.id,p_hotel_id,p_quantity,'transfer_in',p_actor_id,p_occurred_at,p_reason,p_reference,v_source.average_unit_cost,v_document_id);
  if v_result->>'result'<>'ok' then raise exception '%',v_result->>'result' using errcode='23514'; end if;
  return jsonb_build_object('result','ok','document_id',v_document_id,'created',true);
exception when check_violation then return jsonb_build_object('result',sqlerrm); end;
$$;

create or replace function public.create_inventory_count(
  p_hotel_id uuid,p_actor_id uuid,p_location_id uuid,p_product_ids uuid[],p_notes text,p_idempotency_key uuid
) returns jsonb language plpgsql set search_path=public as $$
declare v_id uuid:=gen_random_uuid(); v_fingerprint text; v_existing record;
begin
  perform public.inventory_assert_actor(p_actor_id,p_hotel_id);
  if not exists(select 1 from public.inventory_locations where id=p_location_id and hotel_id=p_hotel_id and is_active and archived_at is null)
    then return jsonb_build_object('result','location_unavailable'); end if;
  v_fingerprint:=md5(jsonb_build_object('location',p_location_id,'products',p_product_ids,'notes',nullif(btrim(p_notes),''))::text);
  select id,request_fingerprint into v_existing from public.inventory_count_sessions where hotel_id=p_hotel_id and idempotency_key=p_idempotency_key for update;
  if found then return case when v_existing.request_fingerprint=v_fingerprint then jsonb_build_object('result','ok','count_id',v_existing.id,'created',false) else jsonb_build_object('result','idempotency_conflict') end; end if;
  insert into public.inventory_count_sessions(id,hotel_id,location_id,notes,created_by,idempotency_key,request_fingerprint)
  values(v_id,p_hotel_id,p_location_id,nullif(btrim(p_notes),''),p_actor_id,p_idempotency_key,v_fingerprint);
  insert into public.inventory_count_items(hotel_id,session_id,position_id,expected_quantity,expected_version)
  select p_hotel_id,v_id,id,quantity,version from public.inventory_positions
  where hotel_id=p_hotel_id and location_id=p_location_id and is_active and archived_at is null
    and (p_product_ids is null or cardinality(p_product_ids)=0 or product_id=any(p_product_ids));
  if not exists(select 1 from public.inventory_count_items where session_id=v_id) then raise exception 'count_without_items' using errcode='23514'; end if;
  return jsonb_build_object('result','ok','count_id',v_id,'created',true);
exception when check_violation then return jsonb_build_object('result',sqlerrm); end;
$$;

create or replace function public.update_inventory_count(
  p_hotel_id uuid,p_actor_id uuid,p_count_id uuid,p_items jsonb
) returns jsonb language plpgsql set search_path=public as $$
declare v_item jsonb;
begin
  perform public.inventory_assert_actor(p_actor_id,p_hotel_id);
  perform 1 from public.inventory_count_sessions where id=p_count_id and hotel_id=p_hotel_id and status='draft' for update;
  if not found then return jsonb_build_object('result','count_not_editable'); end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 then return jsonb_build_object('result','invalid_items'); end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if (v_item->>'counted_quantity')::numeric<0 or (v_item->>'counted_quantity')::numeric<>trunc((v_item->>'counted_quantity')::numeric)
      then return jsonb_build_object('result','invalid_quantity'); end if;
    update public.inventory_count_items set counted_quantity=(v_item->>'counted_quantity')::numeric
    where id=(v_item->>'item_id')::uuid and session_id=p_count_id and hotel_id=p_hotel_id;
    if not found then return jsonb_build_object('result','item_not_found'); end if;
  end loop;
  return jsonb_build_object('result','ok','count_id',p_count_id);
end;
$$;

create or replace function public.complete_inventory_count(
  p_hotel_id uuid,p_actor_id uuid,p_count_id uuid
) returns jsonb language plpgsql set search_path=public as $$
declare v_session public.inventory_count_sessions%rowtype; v_item record; v_result jsonb; v_delta numeric;
begin
  perform public.inventory_assert_actor(p_actor_id,p_hotel_id);
  select * into v_session from public.inventory_count_sessions where id=p_count_id and hotel_id=p_hotel_id for update;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if v_session.status<>'draft' then return jsonb_build_object('result','count_not_editable'); end if;
  if exists(select 1 from public.inventory_count_items where session_id=p_count_id and counted_quantity is null)
    then return jsonb_build_object('result','count_incomplete'); end if;
  perform 1 from public.inventory_positions where id in(select position_id from public.inventory_count_items where session_id=p_count_id) order by id for update;
  if exists(select 1 from public.inventory_count_items item join public.inventory_positions position on position.id=item.position_id where item.session_id=p_count_id and position.version<>item.expected_version)
    then return jsonb_build_object('result','count_version_conflict'); end if;
  for v_item in select item.*,position.quantity from public.inventory_count_items item join public.inventory_positions position on position.id=item.position_id where item.session_id=p_count_id loop
    v_delta:=v_item.counted_quantity-v_item.quantity;
    if v_delta<>0 then
      v_result:=public.apply_inventory_delta(v_item.position_id,p_hotel_id,v_delta,case when v_delta>0 then 'count_gain'::public.inventory_movement_kind else 'count_loss'::public.inventory_movement_kind end,p_actor_id,now(),'Divergência de contagem',null,null,null,p_count_id);
      if v_result->>'result'<>'ok' then raise exception '%',v_result->>'result' using errcode='23514'; end if;
    end if;
  end loop;
  update public.inventory_count_sessions set status='completed',completed_by=p_actor_id,completed_at=now() where id=p_count_id;
  insert into public.inventory_audit_events(hotel_id,entity_type,entity_id,action,actor_id) values(p_hotel_id,'count',p_count_id,'completed',p_actor_id);
  return jsonb_build_object('result','ok','count_id',p_count_id);
end;
$$;

create or replace function public.cancel_inventory_count(p_hotel_id uuid,p_actor_id uuid,p_count_id uuid)
returns jsonb language plpgsql set search_path=public as $$
begin
  perform public.inventory_assert_actor(p_actor_id,p_hotel_id);
  update public.inventory_count_sessions set status='canceled',canceled_by=p_actor_id,canceled_at=now()
  where id=p_count_id and hotel_id=p_hotel_id and status='draft';
  if not found then return jsonb_build_object('result','count_not_editable'); end if;
  insert into public.inventory_audit_events(hotel_id,entity_type,entity_id,action,actor_id) values(p_hotel_id,'count',p_count_id,'canceled',p_actor_id);
  return jsonb_build_object('result','ok','count_id',p_count_id);
end;
$$;

create or replace function public.reorder_inventory_locations(
  p_hotel_id uuid,p_actor_id uuid,p_ids uuid[]
) returns text language plpgsql set search_path=public as $$
declare v_expected integer; v_provided integer;
begin
  perform public.inventory_assert_actor(p_actor_id,p_hotel_id);
  select count(*) into v_expected from public.inventory_locations
    where hotel_id=p_hotel_id and archived_at is null;
  select count(distinct candidate_id) into v_provided
  from unnest(p_ids) candidate_id;
  if v_provided<>coalesce(cardinality(p_ids),0) or v_provided<>v_expected
    or exists(select 1 from unnest(p_ids) candidate(id)
      left join public.inventory_locations location on location.id=candidate.id
        and location.hotel_id=p_hotel_id and location.archived_at is null
      where location.id is null)
    then return 'invalid_order'; end if;
  update public.inventory_locations location
  set display_order=ordered.position::integer*10,updated_by=p_actor_id
  from unnest(p_ids) with ordinality ordered(id,position)
  where location.id=ordered.id and location.hotel_id=p_hotel_id;
  return 'ok';
end;
$$;

create or replace function public.resolve_inventory_source(p_hotel_id uuid,p_offer_id uuid)
returns jsonb language plpgsql stable set search_path=public as $$
declare v_offer record; v_position public.inventory_positions%rowtype; v_controlled boolean;
begin
  select offer.product_id,offer.inventory_location_id,point.default_inventory_location_id into v_offer
  from public.consumption_offers offer join public.consumption_points point on point.id=offer.point_id and point.hotel_id=offer.hotel_id
  where offer.id=p_offer_id and offer.hotel_id=p_hotel_id;
  if not found then return jsonb_build_object('controlled',false,'source','unmanaged'); end if;
  select exists(select 1 from public.inventory_positions where hotel_id=p_hotel_id and product_id=v_offer.product_id and archived_at is null) into v_controlled;
  if not v_controlled then return jsonb_build_object('controlled',false,'source','unmanaged'); end if;
  select * into v_position from public.inventory_positions where hotel_id=p_hotel_id and product_id=v_offer.product_id
    and location_id=coalesce(v_offer.inventory_location_id,v_offer.default_inventory_location_id);
  if not found then return jsonb_build_object('controlled',true,'source','missing'); end if;
  return jsonb_build_object('controlled',true,'source',case when v_offer.inventory_location_id is null then 'point' else 'offer' end,
    'location_id',v_position.location_id,'location_name',(select name from public.inventory_locations where id=v_position.location_id),
    'position_id',v_position.id,'quantity',v_position.quantity,'version',v_position.version,
    'active',v_position.is_active and v_position.archived_at is null,
    'status',case when not v_position.is_active or v_position.archived_at is not null then 'inactive' when v_position.quantity<0 then 'warning' else 'available' end);
end;
$$;

create or replace function public.inventory_before_consumption_item()
returns trigger language plpgsql set search_path=public as $$
declare v_source jsonb; v_legacy boolean;
begin
  select is_legacy into v_legacy from public.consumption_orders where id=new.order_id;
  if coalesce(v_legacy,false) then return new; end if;
  v_source:=public.resolve_inventory_source(new.hotel_id,new.offer_id);
  if coalesce((v_source->>'controlled')::boolean,false) then
    if v_source->>'source'='missing' then raise exception 'inventory_source_missing' using errcode='23514'; end if;
    if not coalesce((v_source->>'active')::boolean,false) then raise exception 'inventory_position_inactive' using errcode='23514'; end if;
    new.inventory_controlled_snapshot:=true;
    new.inventory_location_id_snapshot:=(v_source->>'location_id')::uuid;
    new.inventory_location_name_snapshot:=v_source->>'location_name';
    new.inventory_position_version_snapshot:=(v_source->>'version')::bigint;
  end if;
  return new;
end;
$$;
create trigger trg_consumption_item_inventory_snapshot before insert on public.consumption_order_items for each row execute function public.inventory_before_consumption_item();

create or replace function public.inventory_after_consumption_item()
returns trigger language plpgsql set search_path=public as $$
declare v_position public.inventory_positions%rowtype; v_order public.consumption_orders%rowtype; v_result jsonb;
begin
  if not new.inventory_controlled_snapshot then return new; end if;
  select * into v_position from public.inventory_positions where hotel_id=new.hotel_id and product_id=new.product_id and location_id=new.inventory_location_id_snapshot for update;
  if not found or not v_position.is_active or v_position.archived_at is not null then raise exception 'inventory_position_inactive' using errcode='23514'; end if;
  if v_position.version<>new.inventory_position_version_snapshot then raise exception 'inventory_version_conflict' using errcode='23514'; end if;
  select * into v_order from public.consumption_orders where id=new.order_id;
  v_result:=public.apply_inventory_delta(v_position.id,new.hotel_id,-new.quantity,
    case when v_order.disposition='courtesy' then 'courtesy'::public.inventory_movement_kind else 'consumption'::public.inventory_movement_kind end,
    v_order.posted_by,v_order.occurred_at,'Baixa automática por consumo',null,null,null,null,v_order.id,new.id,null);
  if v_result->>'result'<>'ok' then raise exception '%',v_result->>'result' using errcode='23514'; end if;
  if coalesce((v_result->>'warning')::boolean,false) then
    insert into public.inventory_audit_events(hotel_id,entity_type,entity_id,action,actor_id,changes)
    values(new.hotel_id,'position',v_position.id,'negative_stock_warning',v_order.posted_by,jsonb_build_object('order_id',v_order.id,'quantity_after',v_result->'quantity_after'));
  end if;
  return new;
end;
$$;
create trigger trg_consumption_item_inventory_movement after insert on public.consumption_order_items for each row execute function public.inventory_after_consumption_item();

alter function public.resolve_consumption_offer_snapshot(uuid,uuid,timestamptz)
  rename to resolve_consumption_offer_snapshot_without_inventory;

create or replace function public.resolve_consumption_offer_snapshot(
  p_hotel_id uuid,p_offer_id uuid,p_occurred_at timestamptz
) returns jsonb language plpgsql stable set search_path=public as $$
declare v_snapshot jsonb; v_inventory jsonb; v_reasons jsonb; v_token text;
begin
  v_snapshot:=public.resolve_consumption_offer_snapshot_without_inventory(p_hotel_id,p_offer_id,p_occurred_at);
  if not coalesce((v_snapshot->>'found')::boolean,false) then return v_snapshot; end if;
  v_inventory:=public.resolve_inventory_source(p_hotel_id,p_offer_id);
  v_reasons:=coalesce(v_snapshot->'reasons','[]'::jsonb);
  if coalesce((v_inventory->>'controlled')::boolean,false) then
    if v_inventory->>'source'='missing' then v_reasons:=v_reasons||jsonb_build_array('inventory_source_missing');
    elsif not coalesce((v_inventory->>'active')::boolean,false) then v_reasons:=v_reasons||jsonb_build_array('inventory_position_inactive'); end if;
  end if;
  v_token:=md5(concat_ws('|',v_snapshot->>'version_token',v_inventory->>'position_id',v_inventory->>'version'));
  return v_snapshot||jsonb_build_object(
    'available',jsonb_array_length(v_reasons)=0,
    'reasons',v_reasons,
    'version_token',v_token,
    'inventory',v_inventory
  );
end;
$$;

create or replace function public.apply_correction_inventory_return(p_correction_id uuid,p_actor_id uuid)
returns jsonb language plpgsql set search_path=public as $$
declare v_correction public.consumption_corrections%rowtype; v_item record; v_position public.inventory_positions%rowtype; v_result jsonb;
begin
  select * into v_correction from public.consumption_corrections where id=p_correction_id;
  if not found then return jsonb_build_object('result','not_found'); end if;
  for v_item in select correction_item.*,order_item.product_id,order_item.inventory_controlled_snapshot
    from public.consumption_correction_items correction_item join public.consumption_order_items order_item on order_item.id=correction_item.order_item_id
    where correction_item.correction_id=p_correction_id and correction_item.restock_quantity>0 loop
    if not v_item.inventory_controlled_snapshot or v_item.restock_quantity>v_item.previous_quantity-v_item.resulting_quantity
      then return jsonb_build_object('result','invalid_restock'); end if;
    select * into v_position from public.inventory_positions where hotel_id=v_correction.hotel_id and product_id=v_item.product_id and location_id=v_item.restock_location_id for update;
    if not found or not v_position.is_active or v_position.archived_at is not null then return jsonb_build_object('result','return_location_unavailable'); end if;
    if v_item.inventory_version is not null and v_item.inventory_version<>v_position.version then return jsonb_build_object('result','inventory_version_conflict'); end if;
    v_result:=public.apply_inventory_delta(v_position.id,v_correction.hotel_id,v_item.restock_quantity,'return',p_actor_id,now(),'Retorno aprovado de consumo',null,null,null,null,v_correction.order_id,v_item.order_item_id,v_correction.id);
    if v_result->>'result'<>'ok' then return v_result; end if;
  end loop;
  return jsonb_build_object('result','ok');
end;
$$;

create or replace function public.request_consumption_correction_with_inventory(
  p_hotel_id uuid,p_order_id uuid,p_actor_id uuid,p_kind public.consumption_correction_kind,
  p_reason text,p_items jsonb,p_expected_version bigint
) returns jsonb language plpgsql set search_path=public as $$
declare v_item jsonb; v_order_item record; v_position public.inventory_positions%rowtype; v_result jsonb; v_correction_id uuid;
begin
  if jsonb_typeof(p_items)='array' then
    for v_item in select value from jsonb_array_elements(p_items) loop
      if coalesce((v_item->>'restock_quantity')::numeric,0)>0 then
        select effective.*,original.inventory_controlled_snapshot into v_order_item
        from public.consumption_order_item_effective effective
        join public.consumption_order_items original on original.id=effective.id
        where effective.id=(v_item->>'order_item_id')::uuid and effective.order_id=p_order_id;
        if not found or not coalesce(v_order_item.inventory_controlled_snapshot,false)
          or (v_item->>'restock_quantity')::numeric<>trunc((v_item->>'restock_quantity')::numeric)
          or (v_item->>'restock_quantity')::numeric>v_order_item.effective_quantity-(v_item->>'resulting_quantity')::numeric
          then return jsonb_build_object('result','invalid_restock'); end if;
        select * into v_position from public.inventory_positions where location_id=(v_item->>'restock_location_id')::uuid and hotel_id=p_hotel_id and product_id=v_order_item.product_id;
        if not found or not v_position.is_active or v_position.archived_at is not null then return jsonb_build_object('result','return_location_unavailable'); end if;
        if nullif(v_item->>'inventory_version','') is not null and (v_item->>'inventory_version')::bigint<>v_position.version
          then return jsonb_build_object('result','inventory_version_conflict'); end if;
      elsif nullif(v_item->>'restock_location_id','') is not null then return jsonb_build_object('result','invalid_restock'); end if;
    end loop;
  end if;
  v_result:=public.request_consumption_correction(p_hotel_id,p_order_id,p_actor_id,p_kind,p_reason,p_items,p_expected_version);
  if v_result->>'result'<>'ok' then return v_result; end if;
  v_correction_id:=(v_result->>'correction_id')::uuid;
  perform set_config('app.inventory_correction_write','on',true);
  if jsonb_typeof(p_items)='array' then
    for v_item in select value from jsonb_array_elements(p_items) loop
      if coalesce((v_item->>'restock_quantity')::numeric,0)>0 then
        update public.consumption_correction_items item set
          restock_quantity=(v_item->>'restock_quantity')::numeric,
          restock_location_id=(v_item->>'restock_location_id')::uuid,
          inventory_version=nullif(v_item->>'inventory_version','')::bigint
        where item.correction_id=v_correction_id and item.order_item_id=(v_item->>'order_item_id')::uuid;
      end if;
    end loop;
  end if;
  if v_result->>'status'='completed' then
    v_result:=public.apply_correction_inventory_return(v_correction_id,p_actor_id);
    if v_result->>'result'<>'ok' then raise exception '%',v_result->>'result' using errcode='23514'; end if;
    return jsonb_build_object('result','ok','correction_id',v_correction_id,'status','completed');
  end if;
  return v_result;
end;
$$;

create or replace function public.protect_stay_account_record()
returns trigger language plpgsql as $$
declare v_new jsonb:=case when tg_op<>'DELETE' then to_jsonb(new) else '{}'::jsonb end;
  v_old jsonb:=to_jsonb(old);
begin
  if tg_table_name='consumption_correction_items'
    and current_setting('app.inventory_correction_write',true)='on'
    and tg_op='UPDATE'
    and (v_new - array['restock_quantity','restock_location_id','inventory_version'])
      = (v_old - array['restock_quantity','restock_location_id','inventory_version'])
  then return new; end if;
  raise exception 'stay account records are immutable' using errcode='23514';
end;
$$;

create or replace function public.decide_consumption_correction_with_inventory(
  p_hotel_id uuid,p_correction_id uuid,p_actor_id uuid,p_decision text,p_reason text default null
) returns jsonb language plpgsql set search_path=public as $$
declare v_result jsonb; v_inventory jsonb;
begin
  v_result:=public.decide_consumption_correction(p_hotel_id,p_correction_id,p_actor_id,p_decision,p_reason);
  if v_result->>'result'='ok' and p_decision='approve' then
    v_inventory:=public.apply_correction_inventory_return(p_correction_id,p_actor_id);
    if v_inventory->>'result'<>'ok' then raise exception '%',v_inventory->>'result' using errcode='23514'; end if;
  end if;
  return v_result;
end;
$$;

alter table public.inventory_settings enable row level security;
alter table public.inventory_locations enable row level security;
alter table public.inventory_positions enable row level security;
alter table public.inventory_documents enable row level security;
alter table public.inventory_count_sessions enable row level security;
alter table public.inventory_count_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.inventory_audit_events enable row level security;
grant usage on type public.inventory_negative_stock_policy,public.inventory_movement_kind,public.inventory_document_kind,public.inventory_count_status to postgres,service_role;
grant select,insert,update on public.inventory_settings,public.inventory_locations,public.inventory_positions,public.inventory_count_sessions,public.inventory_count_items to postgres,service_role;
grant select,insert on public.inventory_documents,public.inventory_movements,public.inventory_audit_events to postgres,service_role;
grant execute on function public.configure_inventory_position(uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric,uuid),
  public.post_inventory_document(uuid,uuid,public.inventory_document_kind,text,text,text,timestamptz,jsonb,uuid),
  public.transfer_inventory(uuid,uuid,uuid,uuid,uuid,numeric,text,text,timestamptz,uuid),
  public.create_inventory_count(uuid,uuid,uuid,uuid[],text,uuid),public.update_inventory_count(uuid,uuid,uuid,jsonb),
  public.complete_inventory_count(uuid,uuid,uuid),public.cancel_inventory_count(uuid,uuid,uuid),
  public.reorder_inventory_locations(uuid,uuid,uuid[]),
  public.resolve_inventory_source(uuid,uuid),public.apply_correction_inventory_return(uuid,uuid),
  public.request_consumption_correction_with_inventory(uuid,uuid,uuid,public.consumption_correction_kind,text,jsonb,bigint),
  public.decide_consumption_correction_with_inventory(uuid,uuid,uuid,text,text)
to postgres,service_role;
