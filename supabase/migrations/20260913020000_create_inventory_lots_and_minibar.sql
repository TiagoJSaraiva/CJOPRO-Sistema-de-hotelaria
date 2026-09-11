-- Etapa 5.2: lotes, validade e estoque operacional de frigobar.

create type public.inventory_lot_tracking_mode as enum ('none','lot','lot_expiry');
create type public.inventory_location_kind as enum ('warehouse','consumption_point','minibar_room');
create type public.inventory_lot_status as enum ('active','quarantine','disposed');
create type public.minibar_route_status as enum ('draft','in_progress','completed','canceled');

alter table public.products add column lot_tracking_mode public.inventory_lot_tracking_mode not null default 'none';
alter table public.products add column expiry_alert_days integer not null default 30 check(expiry_alert_days between 1 and 365);
alter table public.inventory_locations add column kind public.inventory_location_kind not null default 'warehouse';
alter table public.inventory_locations add column room_id uuid;
alter table public.inventory_locations add constraint inventory_locations_room_hotel_fkey foreign key(room_id,hotel_id) references public.rooms(id,hotel_id) on delete restrict;
alter table public.inventory_locations add constraint inventory_locations_kind_room_check check((kind='minibar_room')=(room_id is not null));
create unique index inventory_locations_room_unique on public.inventory_locations(hotel_id,room_id) where room_id is not null;
update public.inventory_locations l set kind='consumption_point' where exists(select 1 from public.consumption_points p where p.default_inventory_location_id=l.id);

create table public.inventory_lots (
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id) on delete restrict,
 product_id uuid not null, lot_code text not null, expires_on date, status public.inventory_lot_status not null default 'active',
 received_at timestamptz not null default now(), disposed_at timestamptz, disposed_by uuid references public.users(id),
 created_at timestamptz not null default now(), unique(id,hotel_id), unique(hotel_id,product_id,lot_code),
 foreign key(product_id,hotel_id) references public.products(id,hotel_id) on delete restrict,
 check(length(btrim(lot_code)) between 1 and 120), check((status='disposed')=(disposed_at is not null))
);
create table public.inventory_lot_balances (
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null, lot_id uuid not null, position_id uuid not null,
 quantity numeric(14,3) not null default 0, version bigint not null default 1, updated_at timestamptz not null default now(),
 unique(id,hotel_id), unique(lot_id,position_id),
 foreign key(lot_id,hotel_id) references public.inventory_lots(id,hotel_id) on delete restrict,
 foreign key(position_id,hotel_id) references public.inventory_positions(id,hotel_id) on delete restrict, check(quantity>=0)
);
alter table public.inventory_movements add constraint inventory_movements_id_hotel_unique unique(id,hotel_id);
alter table public.purchase_receipt_lines add constraint purchase_receipt_line_movement_hotel_fkey foreign key(inventory_movement_id,hotel_id) references public.inventory_movements(id,hotel_id) on delete restrict;
create table public.inventory_movement_lots (
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null, movement_id uuid not null, lot_id uuid not null,
 quantity numeric(14,3) not null, created_at timestamptz not null default now(),
 foreign key(movement_id,hotel_id) references public.inventory_movements(id,hotel_id) on delete restrict,
 foreign key(lot_id,hotel_id) references public.inventory_lots(id,hotel_id) on delete restrict, check(quantity>0)
);

create or replace function public.allocate_inventory_movement_lots()
returns trigger language plpgsql set search_path=public as $$
declare v_mode public.inventory_lot_tracking_mode; v_lot public.inventory_lots%rowtype; v_balance record; v_remaining numeric:=abs(new.quantity_delta); v_take numeric; v_source uuid;
begin
 select lot_tracking_mode into v_mode from public.products where id=new.product_id and hotel_id=new.hotel_id;
 if v_mode='none' then return new; end if;
 if new.quantity_delta>0 then
   if new.metadata ? 'source_movement_id' then
     v_source:=(new.metadata->>'source_movement_id')::uuid;
     for v_balance in select ml.quantity,l.* from public.inventory_movement_lots ml join public.inventory_lots l on l.id=ml.lot_id where ml.movement_id=v_source order by l.expires_on nulls last,l.received_at,l.id loop
       insert into public.inventory_lots(hotel_id,product_id,lot_code,expires_on,status,received_at)
       values(new.hotel_id,new.product_id,v_balance.lot_code,v_balance.expires_on,v_balance.status,v_balance.received_at)
       on conflict(hotel_id,product_id,lot_code) do update set lot_code=excluded.lot_code returning * into v_lot;
       insert into public.inventory_lot_balances(hotel_id,lot_id,position_id,quantity) values(new.hotel_id,v_lot.id,new.position_id,v_balance.quantity)
       on conflict(lot_id,position_id) do update set quantity=inventory_lot_balances.quantity+excluded.quantity,version=inventory_lot_balances.version+1,updated_at=now();
       insert into public.inventory_movement_lots(hotel_id,movement_id,lot_id,quantity) values(new.hotel_id,new.id,v_lot.id,v_balance.quantity);
     end loop;
   else
     insert into public.inventory_lots(hotel_id,product_id,lot_code,expires_on,status,received_at)
     values(new.hotel_id,new.product_id,coalesce(nullif(btrim(new.metadata->>'lot_code'),''),'QUARANTINE-'||new.id),
       (new.metadata->>'expires_on')::date,case when nullif(btrim(new.metadata->>'lot_code'),'') is null then 'quarantine' else 'active' end,new.occurred_at)
     on conflict(hotel_id,product_id,lot_code) do update set expires_on=coalesce(public.inventory_lots.expires_on,excluded.expires_on) returning * into v_lot;
     if v_mode='lot_expiry' and v_lot.expires_on is null and v_lot.status='active' then raise exception 'expiry_required'; end if;
     insert into public.inventory_lot_balances(hotel_id,lot_id,position_id,quantity) values(new.hotel_id,v_lot.id,new.position_id,new.quantity_delta)
     on conflict(lot_id,position_id) do update set quantity=inventory_lot_balances.quantity+excluded.quantity,version=inventory_lot_balances.version+1,updated_at=now();
     insert into public.inventory_movement_lots(hotel_id,movement_id,lot_id,quantity) values(new.hotel_id,new.id,v_lot.id,new.quantity_delta);
   end if;
 else
   if new.metadata ? 'lot_id' then
     select b.*,l.expires_on,l.received_at into v_balance from public.inventory_lot_balances b join public.inventory_lots l on l.id=b.lot_id
       where b.position_id=new.position_id and b.lot_id=(new.metadata->>'lot_id')::uuid and b.quantity>=v_remaining and l.status='active' for update of b;
     if not found then raise exception 'insufficient_explicit_lot_stock'; end if;
     update public.inventory_lot_balances set quantity=quantity-v_remaining,version=version+1,updated_at=now() where id=v_balance.id;
     insert into public.inventory_movement_lots(hotel_id,movement_id,lot_id,quantity) values(new.hotel_id,new.id,v_balance.lot_id,v_remaining);
     return new;
   end if;
   for v_balance in select b.*,l.expires_on,l.received_at from public.inventory_lot_balances b join public.inventory_lots l on l.id=b.lot_id
     where b.position_id=new.position_id and b.quantity>0 and l.status='active' and (l.expires_on is null or l.expires_on>=(new.occurred_at at time zone 'UTC')::date)
     order by l.expires_on nulls last,l.received_at,l.id for update of b
   loop exit when v_remaining<=0; v_take:=least(v_remaining,v_balance.quantity);
     update public.inventory_lot_balances set quantity=quantity-v_take,version=version+1,updated_at=now() where id=v_balance.id;
     insert into public.inventory_movement_lots(hotel_id,movement_id,lot_id,quantity) values(new.hotel_id,new.id,v_balance.lot_id,v_take); v_remaining:=v_remaining-v_take;
   end loop;
   if v_remaining>0 then raise exception 'insufficient_fefo_stock'; end if;
 end if; return new; end $$;
create trigger inventory_movement_lot_allocation after insert on public.inventory_movements for each row execute function public.allocate_inventory_movement_lots();

create table public.minibar_compositions (
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id) on delete restrict,
 room_type text not null, name text not null, active_version_id uuid, created_by uuid not null references public.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,hotel_id), unique(hotel_id,room_type),
 check(length(btrim(room_type)) between 1 and 120 and length(btrim(name)) between 2 and 160)
);
create table public.minibar_composition_versions (
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null, composition_id uuid not null, version integer not null,
 activated_at timestamptz, activated_by uuid references public.users(id), created_by uuid not null references public.users(id), created_at timestamptz not null default now(),
 unique(id,hotel_id), unique(composition_id,version), foreign key(composition_id,hotel_id) references public.minibar_compositions(id,hotel_id) on delete restrict
);
alter table public.minibar_compositions add constraint minibar_active_version_fkey foreign key(active_version_id,hotel_id) references public.minibar_composition_versions(id,hotel_id) deferrable initially deferred;
create table public.minibar_composition_items (
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null, version_id uuid not null, product_id uuid not null, source_location_id uuid not null,
 ideal_quantity numeric(14,3) not null, unique(version_id,product_id), foreign key(version_id,hotel_id) references public.minibar_composition_versions(id,hotel_id) on delete restrict,
 foreign key(product_id,hotel_id) references public.products(id,hotel_id), foreign key(source_location_id,hotel_id) references public.inventory_locations(id,hotel_id), check(ideal_quantity>=0)
);
create table public.minibar_room_overrides (
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null, room_id uuid not null, product_id uuid not null,
 source_location_id uuid not null, ideal_quantity numeric(14,3) not null, starts_on date not null, ends_on date, reason text not null,
 created_by uuid not null references public.users(id), created_at timestamptz not null default now(),
 foreign key(room_id,hotel_id) references public.rooms(id,hotel_id), foreign key(product_id,hotel_id) references public.products(id,hotel_id),
 foreign key(source_location_id,hotel_id) references public.inventory_locations(id,hotel_id), check(ends_on is null or ends_on>=starts_on)
);
create table public.minibar_replenishment_routes (
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id), status public.minibar_route_status not null default 'draft',
 version integer not null default 1, responsible_id uuid references public.users(id), idempotency_key uuid not null, request_fingerprint text not null,
 created_by uuid not null references public.users(id), created_at timestamptz not null default now(), completed_at timestamptz, unique(id,hotel_id),unique(hotel_id,idempotency_key)
);
create table public.minibar_replenishment_route_items (
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null, route_id uuid not null, room_id uuid not null, product_id uuid not null,
 source_position_id uuid not null, destination_position_id uuid not null, quantity numeric(14,3) not null, status text not null default 'pending',
 foreign key(route_id,hotel_id) references public.minibar_replenishment_routes(id,hotel_id), foreign key(room_id,hotel_id) references public.rooms(id,hotel_id),
 foreign key(product_id,hotel_id) references public.products(id,hotel_id),foreign key(source_position_id,hotel_id) references public.inventory_positions(id,hotel_id),
 foreign key(destination_position_id,hotel_id) references public.inventory_positions(id,hotel_id),check(quantity>0 and status in('pending','completed','shortage'))
);

create or replace function public.configure_product_lot_tracking(p_hotel_id uuid,p_product_id uuid,p_actor_id uuid,p_input jsonb)
returns jsonb language plpgsql set search_path=public as $$ declare v_mode public.inventory_lot_tracking_mode:=(p_input->>'mode')::public.inventory_lot_tracking_mode; x jsonb; v_total numeric; v_pos record; v_lot uuid;
begin if not exists(select 1 from public.products where id=p_product_id and hotel_id=p_hotel_id and kind='physical') then return jsonb_build_object('result','not_found'); end if;
 if v_mode<>'none' then
  for v_pos in select * from public.inventory_positions where hotel_id=p_hotel_id and product_id=p_product_id for update loop
   select coalesce(sum((x->>'quantity')::numeric),0) into v_total from jsonb_array_elements(p_input->'initial_lots') x where (x->>'position_id')::uuid=v_pos.id;
   if v_total<>v_pos.quantity then return jsonb_build_object('result','initial_distribution_mismatch','context',jsonb_build_object('position_id',v_pos.id,'expected',v_pos.quantity,'actual',v_total)); end if;
  end loop;
  delete from public.inventory_lot_balances where position_id in(select id from public.inventory_positions where hotel_id=p_hotel_id and product_id=p_product_id);
  for x in select value from jsonb_array_elements(p_input->'initial_lots') loop
   if v_mode='lot_expiry' and nullif(x->>'expires_on','') is null then return jsonb_build_object('result','expiry_required'); end if;
   insert into public.inventory_lots(hotel_id,product_id,lot_code,expires_on,received_at) values(p_hotel_id,p_product_id,btrim(x->>'lot_code'),(x->>'expires_on')::date,now())
   on conflict(hotel_id,product_id,lot_code) do update set expires_on=excluded.expires_on returning id into v_lot;
   insert into public.inventory_lot_balances(hotel_id,lot_id,position_id,quantity) values(p_hotel_id,v_lot,(x->>'position_id')::uuid,(x->>'quantity')::numeric);
  end loop;
 else delete from public.inventory_lot_balances where position_id in(select id from public.inventory_positions where hotel_id=p_hotel_id and product_id=p_product_id); end if;
 update public.products set lot_tracking_mode=v_mode,expiry_alert_days=(p_input->>'expiry_alert_days')::integer,updated_at=now() where id=p_product_id; return jsonb_build_object('result','ok'); end $$;

create or replace function public.list_inventory_lots(p_hotel_id uuid) returns jsonb language sql stable set search_path=public as $$
 select jsonb_build_object('lots',coalesce(jsonb_agg(to_jsonb(l)||jsonb_build_object('product_name',p.name,'balances',(select coalesce(jsonb_agg(to_jsonb(b)||jsonb_build_object('location_name',loc.name)),'[]') from public.inventory_lot_balances b join public.inventory_positions pos on pos.id=b.position_id join public.inventory_locations loc on loc.id=pos.location_id where b.lot_id=l.id)) order by l.expires_on nulls last,l.received_at),'[]')) from public.inventory_lots l join public.products p on p.id=l.product_id where l.hotel_id=p_hotel_id;
$$;
create or replace function public.act_inventory_lot(p_hotel_id uuid,p_lot_id uuid,p_actor_id uuid,p_input jsonb) returns jsonb language plpgsql set search_path=public as $$ declare v_bal record; v_qty numeric:=(p_input->>'quantity')::numeric; v_pos record; v_doc uuid; v_move uuid;
begin select b.*,p.quantity position_quantity,p.product_id,p.location_id from public.inventory_lot_balances b join public.inventory_positions p on p.id=b.position_id where b.lot_id=p_lot_id and b.position_id=(p_input->>'position_id')::uuid and b.hotel_id=p_hotel_id for update into v_bal;
 if not found then return jsonb_build_object('result','not_found'); end if; if v_bal.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict'); end if; if v_qty>v_bal.quantity then return jsonb_build_object('result','invalid_quantity'); end if;
 if p_input->>'action'<>'discard' then return jsonb_build_object('result','invalid_action'); end if;
 insert into public.inventory_documents(hotel_id,kind,reason,occurred_at,posted_by,idempotency_key,request_fingerprint,metadata) values(p_hotel_id,'loss',btrim(p_input->>'reason'),now(),p_actor_id,(p_input->>'idempotency_key')::uuid,md5(p_input::text),jsonb_build_object('lot_id',p_lot_id)) returning id into v_doc;
 insert into public.inventory_movements(hotel_id,position_id,product_id,location_id,kind,quantity_delta,quantity_before,quantity_after,average_unit_cost,total_cost,reason,occurred_at,actor_id,document_id,metadata)
 select p_hotel_id,v_bal.position_id,v_bal.product_id,v_bal.location_id,'loss',-v_qty,v_bal.position_quantity,v_bal.position_quantity-v_qty,average_unit_cost,v_qty*average_unit_cost,btrim(p_input->>'reason'),now(),p_actor_id,v_doc,jsonb_build_object('lot_id',p_lot_id) from public.inventory_positions where id=v_bal.position_id returning id into v_move;
 update public.inventory_positions set quantity=quantity-v_qty,version=version+1,updated_at=now() where id=v_bal.position_id;
 if not exists(select 1 from public.inventory_lot_balances where lot_id=p_lot_id and quantity>0) then update public.inventory_lots set status='disposed',disposed_at=now(),disposed_by=p_actor_id where id=p_lot_id; end if;
 return jsonb_build_object('result','ok'); end $$;

create or replace function public.create_minibar_composition(p_hotel_id uuid,p_actor_id uuid,p_input jsonb) returns jsonb language plpgsql set search_path=public as $$ declare v_id uuid;
begin insert into public.minibar_compositions(hotel_id,room_type,name,created_by) values(p_hotel_id,btrim(p_input->>'room_type'),btrim(p_input->>'name'),p_actor_id) returning id into v_id; return jsonb_build_object('result','ok','id',v_id); exception when unique_violation then return jsonb_build_object('result','room_type_exists'); end $$;
create or replace function public.version_minibar_composition(p_hotel_id uuid,p_id uuid,p_actor_id uuid,p_input jsonb) returns jsonb language plpgsql set search_path=public as $$ declare v_version integer; v_id uuid; x jsonb; v_room record; v_location uuid;
begin if not exists(select 1 from public.minibar_compositions where id=p_id and hotel_id=p_hotel_id for update) then return jsonb_build_object('result','not_found'); end if;
 select coalesce(max(version),0)+1 into v_version from public.minibar_composition_versions where composition_id=p_id;
 insert into public.minibar_composition_versions(hotel_id,composition_id,version,activated_at,activated_by,created_by) values(p_hotel_id,p_id,v_version,case when (p_input->>'activate')::boolean then now() end,case when (p_input->>'activate')::boolean then p_actor_id end,p_actor_id) returning id into v_id;
 insert into public.minibar_composition_items(hotel_id,version_id,product_id,source_location_id,ideal_quantity) select p_hotel_id,v_id,(x->>'product_id')::uuid,(x->>'source_location_id')::uuid,(x->>'ideal_quantity')::numeric from jsonb_array_elements(p_input->'items') x;
 if (p_input->>'activate')::boolean then update public.minibar_compositions set active_version_id=v_id,updated_at=now() where id=p_id;
  for v_room in select r.* from public.rooms r join public.minibar_compositions c on lower(btrim(c.room_type))=lower(btrim(r.room_type)) where c.id=p_id loop
   insert into public.inventory_locations(hotel_id,name,internal_code,kind,room_id,is_active,created_by) values(p_hotel_id,'Frigobar '||v_room.room_number,'MINIBAR-'||v_room.id,'minibar_room',v_room.id,true,p_actor_id)
   on conflict(hotel_id,room_id) where room_id is not null do update set is_active=true returning id into v_location;
   insert into public.inventory_positions(hotel_id,product_id,location_id,quantity,minimum_quantity,ideal_quantity,is_active,created_by)
   select p_hotel_id,i.product_id,v_location,0,0,i.ideal_quantity,true,p_actor_id from public.minibar_composition_items i where i.version_id=v_id on conflict(hotel_id,product_id,location_id) do update set ideal_quantity=excluded.ideal_quantity,is_active=true,updated_at=now();
  end loop; end if; return jsonb_build_object('result','ok','id',v_id); exception when foreign_key_violation then return jsonb_build_object('result','invalid_reference'); end $$;

create or replace function public.list_minibar_compositions(p_hotel_id uuid) returns jsonb language sql stable set search_path=public as $$ select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('active_items',(select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('product_name',p.name,'source_name',l.name)),'[]') from public.minibar_composition_items i join public.products p on p.id=i.product_id join public.inventory_locations l on l.id=i.source_location_id where i.version_id=c.active_version_id)) order by c.room_type),'[]')) from public.minibar_compositions c where c.hotel_id=p_hotel_id $$;
create or replace function public.get_minibar_replenishment_board(p_hotel_id uuid) returns jsonb language sql stable set search_path=public as $$
 with needs as(select r.id room_id,r.room_number,c.id composition_id,i.product_id,p.name product_name,i.source_location_id,src.name source_name,i.ideal_quantity,coalesce(dest.quantity,0) current_quantity,greatest(0,i.ideal_quantity-coalesce(dest.quantity,0)) required_quantity,dest.id destination_position_id,source.id source_position_id
 from public.rooms r join public.minibar_compositions c on c.hotel_id=r.hotel_id and lower(btrim(c.room_type))=lower(btrim(r.room_type)) and c.active_version_id is not null join public.minibar_composition_items i on i.version_id=c.active_version_id join public.products p on p.id=i.product_id join public.inventory_locations roomloc on roomloc.room_id=r.id join public.inventory_locations src on src.id=i.source_location_id left join public.inventory_positions dest on dest.location_id=roomloc.id and dest.product_id=i.product_id left join public.inventory_positions source on source.location_id=i.source_location_id and source.product_id=i.product_id where r.hotel_id=p_hotel_id)
 select jsonb_build_object('version',coalesce((select max(version) from public.inventory_positions where hotel_id=p_hotel_id),0),'items',coalesce(jsonb_agg(to_jsonb(needs) order by room_number,product_name) filter(where required_quantity>0),'[]')) from needs;
$$;
create or replace function public.create_minibar_replenishment_route(p_hotel_id uuid,p_actor_id uuid,p_input jsonb) returns jsonb language plpgsql set search_path=public as $$ declare v_board jsonb; v_id uuid; x jsonb;
begin v_board:=public.get_minibar_replenishment_board(p_hotel_id); if (v_board->>'version')::bigint<>(p_input->>'expected_board_version')::bigint then return jsonb_build_object('result','conflict'); end if;
 insert into public.minibar_replenishment_routes(hotel_id,idempotency_key,request_fingerprint,created_by) values(p_hotel_id,(p_input->>'idempotency_key')::uuid,md5(p_input::text),p_actor_id) returning id into v_id;
 insert into public.minibar_replenishment_route_items(hotel_id,route_id,room_id,product_id,source_position_id,destination_position_id,quantity,status)
 select p_hotel_id,v_id,(x->>'room_id')::uuid,(x->>'product_id')::uuid,(x->>'source_position_id')::uuid,(x->>'destination_position_id')::uuid,least((x->>'required_quantity')::numeric,coalesce((select quantity from public.inventory_positions where id=(x->>'source_position_id')::uuid),0)),case when coalesce((select quantity from public.inventory_positions where id=(x->>'source_position_id')::uuid),0)<(x->>'required_quantity')::numeric then 'shortage' else 'pending' end
 from jsonb_array_elements(v_board->'items') x where (x->>'room_id')::uuid in(select value::text::uuid from jsonb_array_elements_text(p_input->'room_ids')) and (x->>'source_position_id') is not null and (x->>'destination_position_id') is not null and least((x->>'required_quantity')::numeric,coalesce((select quantity from public.inventory_positions where id=(x->>'source_position_id')::uuid),0))>0;
 -- Shortages become normal replenishment episodes through the existing reconciler after thresholds are reached.
 perform public.reconcile_replenishment_requests(p_hotel_id,p_actor_id); return jsonb_build_object('result','ok','id',v_id); exception when unique_violation then select id into v_id from public.minibar_replenishment_routes where hotel_id=p_hotel_id and idempotency_key=(p_input->>'idempotency_key')::uuid and request_fingerprint=md5(p_input::text); if found then return jsonb_build_object('result','ok','id',v_id); end if; return jsonb_build_object('result','idempotency_conflict'); end $$;
create or replace function public.act_minibar_replenishment_route(p_hotel_id uuid,p_id uuid,p_actor_id uuid,p_input jsonb) returns jsonb language plpgsql set search_path=public as $$ declare v public.minibar_replenishment_routes%rowtype; i record; s record; d record; v_out uuid;
begin select * into v from public.minibar_replenishment_routes where id=p_id and hotel_id=p_hotel_id for update; if not found then return jsonb_build_object('result','not_found'); end if; if v.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict'); end if;
 if p_input->>'action'='assign' and v.status='draft' then update public.minibar_replenishment_routes set status='in_progress',responsible_id=p_actor_id,version=version+1 where id=p_id;
 elsif p_input->>'action'='cancel' and v.status in('draft','in_progress') then update public.minibar_replenishment_routes set status='canceled',version=version+1 where id=p_id;
 elsif p_input->>'action'='complete' and v.status='in_progress' and v.responsible_id=p_actor_id then
  for i in select * from public.minibar_replenishment_route_items where route_id=p_id and status='pending' order by id loop
   select * into s from public.inventory_positions where id=i.source_position_id for update; select * into d from public.inventory_positions where id=i.destination_position_id for update;
   if s.quantity<i.quantity then return jsonb_build_object('result','stock_changed'); end if;
   insert into public.inventory_movements(hotel_id,position_id,product_id,location_id,kind,quantity_delta,quantity_before,quantity_after,average_unit_cost,total_cost,reason,occurred_at,actor_id,metadata)
   values(p_hotel_id,s.id,s.product_id,s.location_id,'transfer_out',-i.quantity,s.quantity,s.quantity-i.quantity,s.average_unit_cost,i.quantity*s.average_unit_cost,'Reposição de frigobar',now(),p_actor_id,jsonb_build_object('minibar_route_id',p_id)) returning id into v_out;
   update public.inventory_positions set quantity=quantity-i.quantity,version=version+1,updated_at=now() where id=s.id;
   insert into public.inventory_movements(hotel_id,position_id,product_id,location_id,kind,quantity_delta,quantity_before,quantity_after,average_unit_cost,total_cost,reason,occurred_at,actor_id,metadata)
   values(p_hotel_id,d.id,d.product_id,d.location_id,'transfer_in',i.quantity,d.quantity,d.quantity+i.quantity,s.average_unit_cost,i.quantity*s.average_unit_cost,'Reposição de frigobar',now(),p_actor_id,jsonb_build_object('minibar_route_id',p_id,'source_movement_id',v_out));
   update public.inventory_positions set quantity=quantity+i.quantity,average_unit_cost=s.average_unit_cost,version=version+1,updated_at=now() where id=d.id; update public.minibar_replenishment_route_items set status='completed' where id=i.id;
  end loop; update public.minibar_replenishment_routes set status='completed',version=version+1,completed_at=now() where id=p_id;
 else return jsonb_build_object('result','invalid_transition'); end if; return jsonb_build_object('result','ok'); end $$;

insert into public.permissions(name,type) select name,'HOTEL_PERMISSION' from unnest(array['manage_inventory_lots','manage_minibar_compositions','execute_minibar_replenishment']) name on conflict(name) do nothing;
do $$ declare t text; begin foreach t in array array['inventory_lots','inventory_lot_balances','inventory_movement_lots','minibar_compositions','minibar_composition_versions','minibar_composition_items','minibar_room_overrides','minibar_replenishment_routes','minibar_replenishment_route_items'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end $$;
grant execute on function public.configure_product_lot_tracking(uuid,uuid,uuid,jsonb),public.list_inventory_lots(uuid),public.act_inventory_lot(uuid,uuid,uuid,jsonb),public.create_minibar_composition(uuid,uuid,jsonb),public.version_minibar_composition(uuid,uuid,uuid,jsonb),public.list_minibar_compositions(uuid),public.get_minibar_replenishment_board(uuid),public.create_minibar_replenishment_route(uuid,uuid,jsonb),public.act_minibar_replenishment_route(uuid,uuid,uuid,jsonb) to service_role;
