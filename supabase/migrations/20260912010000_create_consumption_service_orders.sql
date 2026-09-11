create type public.consumption_service_mode as enum ('restaurant', 'room_service');
create type public.consumption_service_status as enum ('received', 'preparing', 'ready', 'delivered', 'canceled');
create type public.consumption_service_reservation_status as enum ('reserved', 'consumed', 'released');

create table public.consumption_service_orders (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  stay_id uuid not null references public.stays(id) on delete restrict,
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  point_id uuid not null,
  guest_customer_id uuid,
  mode public.consumption_service_mode not null,
  status public.consumption_service_status not null default 'received',
  responsible_id uuid references public.users(id) on delete restrict,
  expected_at timestamptz,
  notes text,
  version integer not null default 0,
  gross_amount numeric(12,2) not null default 0,
  reserved_benefit_amount numeric(12,2) not null default 0,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  delivery_idempotency_key uuid,
  delivery_fingerprint text,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  delivered_at timestamptz,
  canceled_at timestamptz,
  constraint consumption_service_orders_id_hotel_unique unique(id, hotel_id),
  constraint consumption_service_orders_stay_reservation_fkey foreign key(stay_id, reservation_id)
    references public.stays(id, reservation_id) on delete restrict,
  constraint consumption_service_orders_reservation_hotel_fkey foreign key(reservation_id, hotel_id)
    references public.reservations(id, hotel_id) on delete restrict,
  constraint consumption_service_orders_point_hotel_fkey foreign key(point_id, hotel_id)
    references public.consumption_points(id, hotel_id) on delete restrict,
  constraint consumption_service_orders_guest_hotel_fkey foreign key(guest_customer_id, hotel_id)
    references public.customers(id, hotel_id) on delete restrict,
  constraint consumption_service_orders_version_check check(version >= 0),
  constraint consumption_service_orders_amount_check check(gross_amount >= 0 and reserved_benefit_amount >= 0),
  constraint consumption_service_orders_notes_check check(notes is null or length(btrim(notes)) between 1 and 1000),
  constraint consumption_service_orders_delivery_shape check(
    (delivery_idempotency_key is null and delivery_fingerprint is null) or
    (delivery_idempotency_key is not null and delivery_fingerprint is not null)
  ),
  constraint consumption_service_orders_status_dates check(
    (status = 'delivered') = (delivered_at is not null) and
    (status = 'canceled') = (canceled_at is not null)
  ),
  unique(hotel_id, idempotency_key)
);

create table public.consumption_service_order_items (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  service_order_id uuid not null,
  offer_id uuid not null,
  product_id uuid not null,
  category_id uuid not null,
  commercial_partner_id uuid,
  commercial_agreement_id uuid,
  quantity numeric(12,3) not null,
  unit_price numeric(12,2) not null,
  product_name_snapshot text not null,
  category_name_snapshot text not null,
  billing_mode public.consumption_billing_mode not null,
  payment_method public.consumption_payment_method,
  payment_reference text,
  billing_policy_snapshot jsonb not null,
  commercial_terms_snapshot jsonb,
  version_token text not null,
  inventory_position_id uuid,
  created_at timestamptz not null default now(),
  constraint consumption_service_items_order_hotel_fkey foreign key(service_order_id, hotel_id)
    references public.consumption_service_orders(id, hotel_id) on delete restrict,
  constraint consumption_service_items_offer_hotel_fkey foreign key(offer_id, hotel_id)
    references public.consumption_offers(id, hotel_id) on delete restrict,
  constraint consumption_service_items_product_hotel_fkey foreign key(product_id, hotel_id)
    references public.products(id, hotel_id) on delete restrict,
  constraint consumption_service_items_category_hotel_fkey foreign key(category_id, hotel_id)
    references public.product_categories(id, hotel_id) on delete restrict,
  constraint consumption_service_items_partner_hotel_fkey foreign key(commercial_partner_id, hotel_id)
    references public.commercial_partners(id, hotel_id) on delete restrict,
  constraint consumption_service_items_agreement_hotel_fkey foreign key(commercial_agreement_id, hotel_id)
    references public.commercial_agreements(id, hotel_id) on delete restrict,
  constraint consumption_service_items_inventory_hotel_fkey foreign key(inventory_position_id, hotel_id)
    references public.inventory_positions(id, hotel_id) on delete restrict,
  constraint consumption_service_items_quantity_check check(quantity > 0 and quantity <= 9999),
  constraint consumption_service_items_price_check check(unit_price >= 0),
  constraint consumption_service_items_payment_check check(
    (billing_mode = 'hotel_immediate' and payment_method is not null) or
    (billing_mode <> 'hotel_immediate' and payment_method is null and payment_reference is null)
  )
);
create index consumption_service_items_order_idx on public.consumption_service_order_items(hotel_id, service_order_id);

create table public.consumption_service_stock_reservations (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  service_order_id uuid not null,
  service_order_item_id uuid not null unique,
  inventory_position_id uuid not null,
  quantity numeric(12,3) not null,
  status public.consumption_service_reservation_status not null default 'reserved',
  reserved_at timestamptz not null default now(),
  released_at timestamptz,
  constraint consumption_service_stock_order_hotel_fkey foreign key(service_order_id, hotel_id)
    references public.consumption_service_orders(id, hotel_id) on delete restrict,
  constraint consumption_service_stock_item_hotel_fkey foreign key(service_order_item_id, hotel_id)
    references public.consumption_service_order_items(id, hotel_id) on delete restrict,
  constraint consumption_service_stock_position_hotel_fkey foreign key(inventory_position_id, hotel_id)
    references public.inventory_positions(id, hotel_id) on delete restrict,
  constraint consumption_service_stock_quantity_check check(quantity > 0),
  constraint consumption_service_stock_release_check check((status = 'reserved') = (released_at is null))
);
create index consumption_service_stock_active_idx on public.consumption_service_stock_reservations(hotel_id, inventory_position_id) where status='reserved';

create table public.consumption_service_order_links (
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  service_order_id uuid not null,
  consumption_order_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(service_order_id, consumption_order_id),
  constraint consumption_service_links_service_hotel_fkey foreign key(service_order_id, hotel_id)
    references public.consumption_service_orders(id, hotel_id) on delete restrict,
  constraint consumption_service_links_order_hotel_fkey foreign key(consumption_order_id, hotel_id)
    references public.consumption_orders(id, hotel_id) on delete restrict
);

create table public.consumption_service_order_events (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  service_order_id uuid not null,
  action text not null,
  actor_id uuid references public.users(id) on delete restrict,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint consumption_service_events_order_hotel_fkey foreign key(service_order_id, hotel_id)
    references public.consumption_service_orders(id, hotel_id) on delete restrict,
  constraint consumption_service_events_action_check check(length(btrim(action)) between 1 and 80)
);

create or replace function public.create_consumption_service_order(
  p_hotel_id uuid, p_actor_id uuid, p_stay_id uuid, p_point_id uuid,
  p_guest_customer_id uuid, p_mode public.consumption_service_mode,
  p_expected_at timestamptz, p_notes text, p_items jsonb, p_idempotency_key uuid
) returns jsonb language plpgsql set search_path=public as $$
declare
  v_stay record; v_existing record; v_item jsonb; v_snapshot jsonb; v_order_id uuid:=gen_random_uuid();
  v_item_id uuid; v_position public.inventory_positions%rowtype; v_reserved numeric; v_gross numeric(12,2):=0;
  v_fingerprint text; v_mode public.consumption_billing_mode; v_method public.consumption_payment_method;
begin
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>100
    then return jsonb_build_object('result','invalid_items'); end if;
  v_fingerprint:=md5(jsonb_build_object('stay',p_stay_id,'point',p_point_id,'guest',p_guest_customer_id,
    'mode',p_mode,'expected',p_expected_at,'notes',nullif(btrim(p_notes),''),'items',p_items)::text);
  select id,request_fingerprint into v_existing from public.consumption_service_orders
    where hotel_id=p_hotel_id and idempotency_key=p_idempotency_key for update;
  if found then return case when v_existing.request_fingerprint=v_fingerprint
    then jsonb_build_object('result','ok','order_id',v_existing.id,'created',false)
    else jsonb_build_object('result','idempotency_conflict') end; end if;
  if not public.maintenance_user_has_hotel_scope(p_actor_id,p_hotel_id)
    then return jsonb_build_object('result','actor_outside_hotel'); end if;
  select stay.*,reservation.hotel_id,reservation.id reservation_id into v_stay from public.stays stay
    join public.reservations reservation on reservation.id=stay.reservation_id
    where stay.id=p_stay_id and reservation.hotel_id=p_hotel_id for update of stay;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if v_stay.stay_status<>'checked_in' then return jsonb_build_object('result','stay_not_checked_in'); end if;
  if not exists(select 1 from public.consumption_points where id=p_point_id and hotel_id=p_hotel_id and is_active and archived_at is null)
    then return jsonb_build_object('result','point_unavailable'); end if;
  if p_guest_customer_id is not null and not exists(select 1 from public.stay_customers where stay_id=p_stay_id and customer_id=p_guest_customer_id)
    then return jsonb_build_object('result','guest_outside_stay'); end if;

  insert into public.consumption_service_orders(id,hotel_id,stay_id,reservation_id,point_id,guest_customer_id,mode,
    expected_at,notes,idempotency_key,request_fingerprint,created_by)
  values(v_order_id,p_hotel_id,p_stay_id,v_stay.reservation_id,p_point_id,p_guest_customer_id,p_mode,
    p_expected_at,nullif(btrim(p_notes),''),p_idempotency_key,v_fingerprint,p_actor_id);

  for v_item in select value from jsonb_array_elements(p_items) order by value->>'offer_id' loop
    if (v_item->>'quantity')::numeric<=0 then raise exception 'invalid_quantity' using errcode='P0001'; end if;
    v_snapshot:=public.resolve_consumption_offer_snapshot(p_hotel_id,(v_item->>'offer_id')::uuid,now());
    if not coalesce((v_snapshot->>'found')::boolean,false) or (v_snapshot->>'point_id')::uuid<>p_point_id
      then raise exception 'offer_not_found' using errcode='P0001'; end if;
    if not coalesce((v_snapshot->>'available')::boolean,false)
      then raise exception 'offer_unavailable' using errcode='P0001'; end if;
    if v_item->>'version_token' is not null and v_item->>'version_token' is distinct from v_snapshot->>'version_token'
      then raise exception 'version_conflict' using errcode='P0001'; end if;
    v_mode:=coalesce(nullif(v_item->>'billing_mode','')::public.consumption_billing_mode,
      nullif(v_snapshot->'billing_policy'->>'default_mode','')::public.consumption_billing_mode);
    if v_mode is null or not exists(select 1 from jsonb_array_elements_text(v_snapshot->'allowed_modes') m where m=v_mode::text)
      then raise exception 'billing_mode_not_allowed' using errcode='P0001'; end if;
    v_method:=nullif(v_item->>'payment_method','')::public.consumption_payment_method;
    if (v_mode='hotel_immediate')<>(v_method is not null)
      then raise exception 'payment_method_required' using errcode='P0001'; end if;
    v_gross:=v_gross+round((v_item->>'quantity')::numeric*(v_snapshot->>'unit_price')::numeric,2);
    select position.* into v_position from public.inventory_positions position
      where position.hotel_id=p_hotel_id and position.product_id=(v_snapshot->>'product_id')::uuid
        and position.location_id=nullif(v_snapshot->>'inventory_location_id','')::uuid for update;
    if coalesce((v_snapshot->>'inventory_controlled')::boolean,false) then
      if not found then raise exception 'inventory_position_not_found' using errcode='P0001'; end if;
      select coalesce(sum(quantity),0) into v_reserved from public.consumption_service_stock_reservations
        where inventory_position_id=v_position.id and status='reserved';
      if (select negative_stock_policy from public.inventory_settings where hotel_id=p_hotel_id)='block'
        and v_position.quantity-v_reserved<(v_item->>'quantity')::numeric
        then raise exception 'insufficient_inventory' using errcode='P0001'; end if;
    end if;
    insert into public.consumption_service_order_items(hotel_id,service_order_id,offer_id,product_id,category_id,
      commercial_partner_id,commercial_agreement_id,quantity,unit_price,product_name_snapshot,category_name_snapshot,
      billing_mode,payment_method,payment_reference,billing_policy_snapshot,commercial_terms_snapshot,version_token,inventory_position_id)
    values(p_hotel_id,v_order_id,(v_item->>'offer_id')::uuid,(v_snapshot->>'product_id')::uuid,
      (v_snapshot->>'category_id')::uuid,nullif(v_snapshot->>'partner_id','')::uuid,nullif(v_snapshot->>'agreement_id','')::uuid,
      (v_item->>'quantity')::numeric,(v_snapshot->>'unit_price')::numeric,v_snapshot->>'product_name',v_snapshot->>'category_name',
      v_mode,v_method,nullif(btrim(v_item->>'payment_reference'),''),v_snapshot->'billing_policy',v_snapshot->'revision',
      v_snapshot->>'version_token',case when coalesce((v_snapshot->>'inventory_controlled')::boolean,false) then v_position.id else null end)
    returning id into v_item_id;
    if coalesce((v_snapshot->>'inventory_controlled')::boolean,false) then
      insert into public.consumption_service_stock_reservations(hotel_id,service_order_id,service_order_item_id,inventory_position_id,quantity)
      values(p_hotel_id,v_order_id,v_item_id,v_position.id,(v_item->>'quantity')::numeric);
    end if;
  end loop;
  update public.consumption_service_orders set gross_amount=v_gross where id=v_order_id;
  insert into public.consumption_service_order_events(hotel_id,service_order_id,action,actor_id,details)
    values(p_hotel_id,v_order_id,'received',p_actor_id,jsonb_build_object('gross_amount',v_gross,'items',jsonb_array_length(p_items)));
  return jsonb_build_object('result','ok','order_id',v_order_id,'created',true);
exception when sqlstate 'P0001' then return jsonb_build_object('result',sqlerrm);
end; $$;

create or replace function public.act_consumption_service_order(
  p_hotel_id uuid,p_order_id uuid,p_actor_id uuid,p_action text,p_expected_version integer,
  p_assignee_id uuid,p_reason text,p_next_action text,p_idempotency_key uuid
) returns jsonb language plpgsql set search_path=public as $$
declare v_order public.consumption_service_orders%rowtype; v_result jsonb; v_group record; v_order_ids uuid[]:=array[]::uuid[];
  v_delivery_fingerprint text; v_child_key uuid;
begin
  if not public.maintenance_user_has_hotel_scope(p_actor_id,p_hotel_id)
    then return jsonb_build_object('result','actor_outside_hotel'); end if;
  select * into v_order from public.consumption_service_orders where id=p_order_id and hotel_id=p_hotel_id for update;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if v_order.version<>p_expected_version then return jsonb_build_object('result','version_conflict','context',to_jsonb(v_order)); end if;
  if p_action='assign' then
    if v_order.status not in ('received','preparing','ready') or p_assignee_id is null
      then return jsonb_build_object('result','invalid_state'); end if;
    update public.consumption_service_orders set responsible_id=p_assignee_id,version=version+1,updated_at=now() where id=p_order_id;
  elsif p_action='start_preparing' then
    if v_order.status<>'received' then return jsonb_build_object('result','invalid_state'); end if;
    update public.consumption_service_orders set status='preparing',responsible_id=coalesce(responsible_id,p_actor_id),version=version+1,updated_at=now() where id=p_order_id;
  elsif p_action='mark_ready' then
    if v_order.status<>'preparing' then return jsonb_build_object('result','invalid_state'); end if;
    update public.consumption_service_orders set status='ready',version=version+1,updated_at=now() where id=p_order_id;
  elsif p_action='delivery_failed' then
    if v_order.status<>'ready' or length(coalesce(btrim(p_reason),''))<3 or length(coalesce(btrim(p_next_action),''))<3
      then return jsonb_build_object('result','invalid'); end if;
    update public.consumption_service_orders set version=version+1,updated_at=now() where id=p_order_id;
  elsif p_action='cancel' then
    if v_order.status in ('delivered','canceled') or (v_order.status<>'received' and length(coalesce(btrim(p_reason),''))<3)
      then return jsonb_build_object('result','invalid_state'); end if;
    update public.consumption_service_orders set status='canceled',canceled_at=now(),version=version+1,updated_at=now() where id=p_order_id;
    update public.consumption_service_stock_reservations set status='released',released_at=now()
      where service_order_id=p_order_id and status='reserved';
  elsif p_action='deliver' then
    if v_order.status<>'ready' or p_idempotency_key is null then return jsonb_build_object('result','invalid_state'); end if;
    v_delivery_fingerprint:=md5(jsonb_build_object('order',p_order_id,'version',p_expected_version)::text);
    if v_order.delivery_idempotency_key is not null then
      if v_order.delivery_idempotency_key=p_idempotency_key and v_order.delivery_fingerprint=v_delivery_fingerprint and v_order.status='delivered'
        then return jsonb_build_object('result','ok','order_ids',(select coalesce(jsonb_agg(consumption_order_id),'[]'::jsonb) from public.consumption_service_order_links where service_order_id=p_order_id),'created',false); end if;
      return jsonb_build_object('result','idempotency_conflict');
    end if;
    begin
      for v_group in
        select item.billing_mode,item.payment_method,item.payment_reference,item.commercial_partner_id,item.commercial_agreement_id,
          jsonb_agg(jsonb_build_object('offer_id',item.offer_id,'quantity',item.quantity,'version_token',item.version_token) order by item.id) items
        from public.consumption_service_order_items item where item.service_order_id=p_order_id
        group by item.billing_mode,item.payment_method,item.payment_reference,item.commercial_partner_id,item.commercial_agreement_id
        order by item.billing_mode,item.commercial_partner_id nulls first,item.commercial_agreement_id nulls first
      loop
        v_child_key:=md5(p_idempotency_key::text||coalesce(v_group.billing_mode::text,'')||coalesce(v_group.commercial_partner_id::text,'')||coalesce(v_group.commercial_agreement_id::text,''))::uuid;
        v_result:=public.post_consumption_order(p_hotel_id,v_order.stay_id,v_order.point_id,p_actor_id,now(),'charged',
          v_group.billing_mode,v_group.items,v_child_key,v_order.guest_customer_id,v_group.payment_method,v_group.payment_reference,
          v_group.billing_mode='partner_direct','Pedido '||p_order_id::text,null);
        if v_result->>'result'<>'ok' then raise exception '%',v_result->>'result' using errcode='P0001'; end if;
        v_order_ids:=array_append(v_order_ids,(v_result->>'order_id')::uuid);
        insert into public.consumption_service_order_links(hotel_id,service_order_id,consumption_order_id)
          values(p_hotel_id,p_order_id,(v_result->>'order_id')::uuid) on conflict do nothing;
      end loop;
      update public.consumption_service_stock_reservations set status='consumed',released_at=now()
        where service_order_id=p_order_id and status='reserved';
      update public.consumption_service_orders set status='delivered',delivered_at=now(),delivery_idempotency_key=p_idempotency_key,
        delivery_fingerprint=v_delivery_fingerprint,version=version+1,updated_at=now() where id=p_order_id;
    exception when sqlstate 'P0001' then
      return jsonb_build_object('result',sqlerrm,'context',jsonb_build_object('status','ready'));
    end;
  else return jsonb_build_object('result','invalid_action'); end if;
  insert into public.consumption_service_order_events(hotel_id,service_order_id,action,actor_id,details)
    values(p_hotel_id,p_order_id,p_action,p_actor_id,jsonb_strip_nulls(jsonb_build_object('reason',nullif(btrim(p_reason),''),'next_action',nullif(btrim(p_next_action),''),'assignee_id',p_assignee_id)));
  return jsonb_build_object('result','ok','order_ids',to_jsonb(v_order_ids),'created',true);
end; $$;

create or replace function public.list_consumption_service_orders(
  p_hotel_id uuid,p_status text default null,p_point_id uuid default null,p_search text default null
) returns jsonb language sql stable set search_path=public as $$
  select jsonb_build_object(
    'items',coalesce(jsonb_agg(row_value order by row_value->>'expected_at' nulls last,row_value->>'created_at'),'[]'::jsonb),
    'summary',jsonb_build_object(
      'received',count(*) filter(where row_value->>'status'='received'),
      'preparing',count(*) filter(where row_value->>'status'='preparing'),
      'ready',count(*) filter(where row_value->>'status'='ready'),
      'late',count(*) filter(where row_value->>'status' in ('received','preparing','ready') and (row_value->>'expected_at')::timestamptz<now())
    ),'updated_at',now()
  ) from (
    select to_jsonb(service_order)||jsonb_build_object(
      'room_number',room.room_number,'point_name',point.name,'guest_name',customer.full_name,
      'item_count',(select count(*) from public.consumption_service_order_items item where item.service_order_id=service_order.id)
    ) row_value
    from public.consumption_service_orders service_order
    join public.stays stay on stay.id=service_order.stay_id
    join public.rooms room on room.id=stay.room_id
    join public.consumption_points point on point.id=service_order.point_id
    left join public.customers customer on customer.id=service_order.guest_customer_id
    where service_order.hotel_id=p_hotel_id
      and (p_status is null or service_order.status::text=p_status)
      and (p_point_id is null or service_order.point_id=p_point_id)
      and (p_search is null or room.room_number ilike '%'||p_search||'%' or coalesce(customer.full_name,'') ilike '%'||p_search||'%')
  ) rows;
$$;

create or replace function public.get_consumption_service_order(p_hotel_id uuid,p_order_id uuid)
returns jsonb language sql stable set search_path=public as $$
  select to_jsonb(service_order)||jsonb_build_object(
    'items',coalesce((select jsonb_agg(to_jsonb(item) order by item.created_at,item.id) from public.consumption_service_order_items item where item.service_order_id=service_order.id),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(to_jsonb(event) order by event.created_at,event.id) from public.consumption_service_order_events event where event.service_order_id=service_order.id),'[]'::jsonb),
    'produced_order_ids',coalesce((select jsonb_agg(link.consumption_order_id order by link.created_at) from public.consumption_service_order_links link where link.service_order_id=service_order.id),'[]'::jsonb)
  ) from public.consumption_service_orders service_order where service_order.hotel_id=p_hotel_id and service_order.id=p_order_id;
$$;

create or replace function public.protect_consumption_service_records() returns trigger language plpgsql as $$
begin raise exception 'consumption service history is immutable' using errcode='23514'; end; $$;
create trigger trg_consumption_service_items_immutable before update or delete on public.consumption_service_order_items for each row execute function public.protect_consumption_service_records();
create trigger trg_consumption_service_links_immutable before update or delete on public.consumption_service_order_links for each row execute function public.protect_consumption_service_records();
create trigger trg_consumption_service_events_immutable before update or delete on public.consumption_service_order_events for each row execute function public.protect_consumption_service_records();

insert into public.permissions(name,type) select name,'HOTEL_PERMISSION' from unnest(array[
  'manage_consumption_service','cancel_consumption_service'
]) name on conflict(name) do nothing;

alter table public.consumption_service_orders enable row level security;
alter table public.consumption_service_order_items enable row level security;
alter table public.consumption_service_stock_reservations enable row level security;
alter table public.consumption_service_order_links enable row level security;
alter table public.consumption_service_order_events enable row level security;
grant usage on type public.consumption_service_mode,public.consumption_service_status,public.consumption_service_reservation_status to postgres,service_role;
grant select,insert,update on public.consumption_service_orders,public.consumption_service_stock_reservations to postgres,service_role;
grant select,insert on public.consumption_service_order_items,public.consumption_service_order_links,public.consumption_service_order_events to postgres,service_role;
grant execute on function public.create_consumption_service_order(uuid,uuid,uuid,uuid,uuid,public.consumption_service_mode,timestamptz,text,jsonb,uuid),
  public.act_consumption_service_order(uuid,uuid,uuid,text,integer,uuid,text,text,uuid),
  public.list_consumption_service_orders(uuid,text,uuid,text),public.get_consumption_service_order(uuid,uuid) to postgres,service_role;
