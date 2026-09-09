create type public.governance_cycle_status as enum (
  'departure_review','cleaning_pending','cleaning_in_progress','inspection_pending',
  'maintenance_hold','released','canceled'
);
create type public.governance_cycle_source as enum ('checkout','pre_departure','manual','maintenance');
create type public.governance_task_kind as enum ('departure_review','cleaning','replenishment','inspection');
create type public.governance_task_status as enum ('pending','assigned','in_progress','completed','canceled');
create type public.governance_check_result as enum ('pending','approved','rejected','not_applicable');

create table public.governance_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  kind public.governance_task_kind not null check (kind <> 'replenishment'),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  version integer not null check (version > 0),
  is_active boolean not null default true,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  unique (hotel_id, kind, version),
  unique (hotel_id, id)
);
create unique index governance_template_active
  on public.governance_checklist_templates(hotel_id,kind) where is_active;

create table public.governance_checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null,
  template_id uuid not null,
  label text not null check (char_length(btrim(label)) between 1 and 240),
  display_order integer not null check (display_order >= 0),
  required boolean not null default true,
  foreign key (hotel_id,template_id) references public.governance_checklist_templates(hotel_id,id) on delete cascade,
  unique (template_id,display_order)
);

create table public.governance_cycles (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete restrict,
  stay_id uuid references public.stays(id) on delete restrict,
  source public.governance_cycle_source not null,
  status public.governance_cycle_status not null,
  version integer not null default 1 check (version > 0),
  opened_by uuid references public.users(id),
  released_by uuid references public.users(id),
  release_reason text,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id,id),
  check ((status='released')=(released_at is not null))
);
create unique index governance_cycle_active_room
  on public.governance_cycles(hotel_id,room_id) where status not in ('released','canceled');
create unique index governance_cycle_active_stay
  on public.governance_cycles(hotel_id,stay_id) where stay_id is not null and status not in ('released','canceled');

create table public.governance_tasks (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null,
  cycle_id uuid not null,
  kind public.governance_task_kind not null,
  status public.governance_task_status not null default 'pending',
  assigned_to uuid references public.users(id),
  next_action text check (next_action is null or char_length(btrim(next_action)) between 1 and 500),
  version integer not null default 1 check(version>0),
  started_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (hotel_id,cycle_id) references public.governance_cycles(hotel_id,id) on delete cascade,
  unique(hotel_id,id),
  check ((status='completed')=(completed_at is not null)),
  check ((status in ('assigned','in_progress'))=(assigned_to is not null))
);
create unique index governance_task_active_kind
  on public.governance_tasks(cycle_id,kind) where status not in ('completed','canceled');

create table public.governance_task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null,
  task_id uuid not null,
  template_id uuid,
  label text not null,
  display_order integer not null,
  required boolean not null,
  result public.governance_check_result not null default 'pending',
  notes text check(notes is null or char_length(btrim(notes))<=1000),
  foreign key(hotel_id,task_id) references public.governance_tasks(hotel_id,id) on delete cascade,
  unique(task_id,display_order)
);

create table public.governance_minibar_findings (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null, cycle_id uuid not null,
  offer_id uuid references public.consumption_offers(id), quantity numeric(12,3) not null check(quantity>0),
  replenishment_quantity numeric(12,3) not null default 0 check(replenishment_quantity>=0),
  consumption_order_id uuid references public.consumption_orders(id), discrepancy_only boolean not null default false,
  request_key uuid, notes text, created_at timestamptz not null default now(),
  foreign key(hotel_id,cycle_id) references public.governance_cycles(hotel_id,id) on delete cascade,
  unique(cycle_id,request_key,offer_id)
);

create table public.governance_maintenance_links (
  hotel_id uuid not null, cycle_id uuid not null, occurrence_id uuid not null,
  room_block_id uuid, blocking boolean not null, created_at timestamptz not null default now(),
  primary key(cycle_id,occurrence_id),
  foreign key(hotel_id,cycle_id) references public.governance_cycles(hotel_id,id) on delete cascade,
  foreign key(occurrence_id) references public.maintenance_occurrences(id),
  foreign key(room_block_id) references public.room_blocks(id)
);

create table public.governance_events (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null, cycle_id uuid not null,
  task_id uuid, actor_id uuid references public.users(id), action text not null,
  message text, metadata jsonb not null default '{}', created_at timestamptz not null default now(),
  foreign key(hotel_id,cycle_id) references public.governance_cycles(hotel_id,id) on delete cascade,
  foreign key(task_id) references public.governance_tasks(id)
);
create trigger governance_events_immutable before update or delete on public.governance_events
  for each row execute function public.prevent_maintenance_event_mutation();

alter table public.stays add column operational_version integer not null default 1 check(operational_version>0);
create table public.stay_relocation_events (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id),
  stay_id uuid not null references public.stays(id), source_room_id uuid not null references public.rooms(id),
  destination_room_id uuid not null references public.rooms(id), room_block_id uuid references public.room_blocks(id),
  actor_id uuid not null references public.users(id), reason text not null check(char_length(btrim(reason)) between 1 and 1000),
  contracted_daily_rate numeric(12,2) not null, destination_public_rate numeric(12,2) not null,
  created_at timestamptz not null default now()
);
create trigger stay_relocation_events_immutable before update or delete on public.stay_relocation_events
  for each row execute function public.prevent_maintenance_event_mutation();

alter table public.rooms add constraint rooms_id_hotel_governance_unique unique(id,hotel_id);
alter table public.maintenance_categories add constraint maintenance_categories_id_hotel_governance_unique unique(id,hotel_id);
alter table public.maintenance_occurrences add constraint maintenance_occurrences_id_hotel_governance_unique unique(id,hotel_id);
alter table public.room_blocks add constraint room_blocks_id_hotel_governance_unique unique(id,hotel_id);
alter table public.governance_cycles add constraint governance_cycles_room_hotel_fkey foreign key(room_id,hotel_id) references public.rooms(id,hotel_id);
alter table public.governance_minibar_findings add constraint governance_minibar_offer_hotel_fkey foreign key(offer_id,hotel_id) references public.consumption_offers(id,hotel_id);
alter table public.governance_maintenance_links add constraint governance_links_occurrence_hotel_fkey foreign key(occurrence_id,hotel_id) references public.maintenance_occurrences(id,hotel_id);
alter table public.governance_maintenance_links add constraint governance_links_block_hotel_fkey foreign key(room_block_id,hotel_id) references public.room_blocks(id,hotel_id);
alter table public.stay_relocation_events add constraint relocation_source_room_hotel_fkey foreign key(source_room_id,hotel_id) references public.rooms(id,hotel_id);
alter table public.stay_relocation_events add constraint relocation_destination_room_hotel_fkey foreign key(destination_room_id,hotel_id) references public.rooms(id,hotel_id);
alter table public.stay_relocation_events add constraint relocation_block_hotel_fkey foreign key(room_block_id,hotel_id) references public.room_blocks(id,hotel_id);

create function public.validate_governance_hotel_scope() returns trigger language plpgsql set search_path=public as $$
begin
  if new.stay_id is not null and not exists(select 1 from public.stays s join public.reservations r on r.id=s.reservation_id where s.id=new.stay_id and r.hotel_id=new.hotel_id and s.room_id=new.room_id) then
    raise exception 'governance stay must belong to the same hotel and room' using errcode='23514';
  end if;
  return new;
end $$;
create trigger governance_cycles_validate_scope before insert or update of hotel_id,room_id,stay_id on public.governance_cycles for each row execute function public.validate_governance_hotel_scope();

create function public.validate_relocation_hotel_scope() returns trigger language plpgsql set search_path=public as $$
begin
  if not exists(select 1 from public.stays s join public.reservations r on r.id=s.reservation_id where s.id=new.stay_id and r.hotel_id=new.hotel_id) then
    raise exception 'relocation stay must belong to the same hotel' using errcode='23514';
  end if;
  return new;
end $$;
create trigger stay_relocation_validate_scope before insert or update on public.stay_relocation_events for each row execute function public.validate_relocation_hotel_scope();

create or replace function public.governance_seed_templates(p_hotel_id uuid,p_actor_id uuid default null)
returns void language plpgsql set search_path=public as $$
declare v_id uuid;
begin
  if not exists(select 1 from public.governance_checklist_templates where hotel_id=p_hotel_id and kind='departure_review' and is_active) then
    insert into public.governance_checklist_templates(hotel_id,kind,name,version,created_by) values(p_hotel_id,'departure_review','Conferência de saída',1,p_actor_id) returning id into v_id;
    insert into public.governance_checklist_template_items(hotel_id,template_id,label,display_order,required) values
      (p_hotel_id,v_id,'Conferir frigobar e registrar consumos',10,true),(p_hotel_id,v_id,'Registrar pertences ou avarias visíveis',20,true);
  end if;
  if not exists(select 1 from public.governance_checklist_templates where hotel_id=p_hotel_id and kind='cleaning' and is_active) then
    insert into public.governance_checklist_templates(hotel_id,kind,name,version,created_by) values(p_hotel_id,'cleaning','Limpeza do quarto',1,p_actor_id) returning id into v_id;
    insert into public.governance_checklist_template_items(hotel_id,template_id,label,display_order,required) values
      (p_hotel_id,v_id,'Trocar e conferir enxoval',10,true),(p_hotel_id,v_id,'Higienizar banheiro',20,true),
      (p_hotel_id,v_id,'Limpar superfícies e piso',30,true),(p_hotel_id,v_id,'Repor amenidades e retirar resíduos',40,true);
  end if;
  if not exists(select 1 from public.governance_checklist_templates where hotel_id=p_hotel_id and kind='inspection' and is_active) then
    insert into public.governance_checklist_templates(hotel_id,kind,name,version,created_by) values(p_hotel_id,'inspection','Inspeção final',1,p_actor_id) returning id into v_id;
    insert into public.governance_checklist_template_items(hotel_id,template_id,label,display_order,required) values
      (p_hotel_id,v_id,'Validar limpeza e enxoval',10,true),(p_hotel_id,v_id,'Validar frigobar, amenidades e reposição',20,true),
      (p_hotel_id,v_id,'Testar equipamentos e registrar avarias',30,true),(p_hotel_id,v_id,'Confirmar segurança e liberação do quarto',40,true);
  end if;
end $$;
select public.governance_seed_templates(id) from public.hotels;
create function public.governance_seed_templates_for_hotel() returns trigger language plpgsql set search_path=public as $$
begin perform public.governance_seed_templates(new.id); return new; end $$;
create trigger hotels_seed_governance_templates after insert on public.hotels for each row execute function public.governance_seed_templates_for_hotel();

create function public.governance_create_task(p_hotel_id uuid,p_cycle_id uuid,p_kind public.governance_task_kind)
returns uuid language plpgsql set search_path=public as $$
declare v_task uuid; v_template uuid;
begin
  select id into v_task from public.governance_tasks where cycle_id=p_cycle_id and kind=p_kind and status not in ('completed','canceled');
  if found then return v_task; end if;
  insert into public.governance_tasks(hotel_id,cycle_id,kind,status) values(p_hotel_id,p_cycle_id,p_kind,'pending') returning id into v_task;
  if p_kind<>'replenishment' then
    select id into v_template from public.governance_checklist_templates where hotel_id=p_hotel_id and kind=p_kind and is_active;
    insert into public.governance_task_checklist_items(hotel_id,task_id,template_id,label,display_order,required)
      select p_hotel_id,v_task,v_template,label,display_order,required from public.governance_checklist_template_items where template_id=v_template order by display_order;
  end if;
  return v_task;
end $$;

create function public.ensure_governance_cycle(p_hotel_id uuid,p_room_id uuid,p_stay_id uuid,p_source public.governance_cycle_source,p_actor_id uuid default null)
returns uuid language plpgsql set search_path=public as $$
declare v_id uuid; v_status public.governance_cycle_status;
begin
  if not exists(select 1 from public.rooms where id=p_room_id and hotel_id=p_hotel_id) then return null; end if;
  select id into v_id from public.governance_cycles where hotel_id=p_hotel_id and room_id=p_room_id and status not in ('released','canceled') for update;
  if found then return v_id; end if;
  v_status:=case p_source when 'pre_departure' then 'departure_review' when 'maintenance' then 'maintenance_hold' else 'cleaning_pending' end;
  insert into public.governance_cycles(hotel_id,room_id,stay_id,source,status,opened_by) values(p_hotel_id,p_room_id,p_stay_id,p_source,v_status,p_actor_id) returning id into v_id;
  if v_status='departure_review' then perform public.governance_create_task(p_hotel_id,v_id,'departure_review');
  elsif v_status='cleaning_pending' then perform public.governance_create_task(p_hotel_id,v_id,'cleaning'); end if;
  insert into public.governance_events(hotel_id,cycle_id,actor_id,action,metadata) values(p_hotel_id,v_id,p_actor_id,'cycle_created',jsonb_build_object('source',p_source,'status',v_status));
  return v_id;
end $$;

create function public.governance_after_stay_checkout() returns trigger language plpgsql set search_path=public as $$
declare v_hotel uuid; v_cycle uuid;
begin
  if new.stay_status='checked_out' and old.stay_status<>'checked_out' then
    select hotel_id into v_hotel from public.reservations where id=new.reservation_id;
    v_cycle:=public.ensure_governance_cycle(v_hotel,new.room_id,new.id,'checkout',null);
    update public.governance_cycles set status='cleaning_pending',source='checkout',version=version+1,updated_at=now() where id=v_cycle and status='departure_review';
    update public.governance_tasks set status='canceled',assigned_to=null,completed_at=null,version=version+1,updated_at=now()
      where cycle_id=v_cycle and kind='departure_review' and status not in ('completed','canceled');
    perform public.governance_create_task(v_hotel,v_cycle,'cleaning');
    insert into public.governance_events(hotel_id,cycle_id,action,metadata) values(v_hotel,v_cycle,'checkout_registered',jsonb_build_object('stay_id',new.id));
  end if; return new;
end $$;
create trigger stays_create_governance_cycle after update of stay_status on public.stays for each row execute function public.governance_after_stay_checkout();

create function public.governance_after_room_block() returns trigger language plpgsql set search_path=public as $$
declare v_cycle uuid; v_hotel uuid; v_room uuid;
begin
  v_hotel:=new.hotel_id; v_room:=new.room_id;
  if tg_op='INSERT' or (old.released_at is not null and new.released_at is null) then
    v_cycle:=public.ensure_governance_cycle(v_hotel,v_room,null,'maintenance',new.created_by);
    update public.governance_cycles set status='maintenance_hold',version=version+1,updated_at=now() where id=v_cycle and status not in ('released','canceled');
    insert into public.governance_events(hotel_id,cycle_id,actor_id,action,metadata) values(v_hotel,v_cycle,new.created_by,'maintenance_hold',jsonb_build_object('room_block_id',new.id));
  elsif old.released_at is null and new.released_at is not null then
    select id into v_cycle from public.governance_cycles where hotel_id=v_hotel and room_id=v_room and status='maintenance_hold' for update;
    if v_cycle is not null and not exists(select 1 from public.room_blocks where hotel_id=v_hotel and room_id=v_room and released_at is null and id<>new.id) then
      update public.governance_cycles set status='inspection_pending',version=version+1,updated_at=now() where id=v_cycle;
      perform public.governance_create_task(v_hotel,v_cycle,'inspection');
      insert into public.governance_events(hotel_id,cycle_id,actor_id,action,metadata) values(v_hotel,v_cycle,new.released_by,'maintenance_released',jsonb_build_object('room_block_id',new.id));
    end if;
  end if; return new;
end $$;
create trigger room_blocks_sync_governance after insert or update of released_at on public.room_blocks for each row execute function public.governance_after_room_block();

-- Existing active blocks predate the trigger and must require an operational inspection.
do $$ declare v record; begin for v in select * from public.room_blocks where released_at is null loop
  perform public.ensure_governance_cycle(v.hotel_id,v.room_id,null,'maintenance',v.created_by);
end loop; end $$;

create function public.governance_room_state(p_hotel_id uuid,p_room_id uuid,p_now timestamptz default now())
returns jsonb language plpgsql stable set search_path=public as $$
declare v_cycle record; v_arrival record; v_occupied boolean; v_blocked boolean; v_assignee_id uuid; v_assignee_name text; v_house text; v_ready text; v_blockers text[]:='{}';
begin
  if not exists(select 1 from public.rooms where hotel_id=p_hotel_id and id=p_room_id) then return null; end if;
  select * into v_cycle from public.governance_cycles where hotel_id=p_hotel_id and room_id=p_room_id and status not in ('released','canceled') order by created_at desc limit 1;
  select exists(select 1 from public.stays s join public.reservations r on r.id=s.reservation_id where r.hotel_id=p_hotel_id and s.room_id=p_room_id and s.stay_status='checked_in') into v_occupied;
  select exists(select 1 from public.room_blocks b where b.hotel_id=p_hotel_id and b.room_id=p_room_id and b.released_at is null and b.start_date<=(p_now at time zone (select timezone from public.hotels where id=p_hotel_id))::date) into v_blocked;
  select s.checkin_date_expected into v_arrival from public.stays s join public.reservations r on r.id=s.reservation_id where r.hotel_id=p_hotel_id and s.room_id=p_room_id and s.stay_status='confirmed' and s.checkin_date_expected>=p_now order by s.checkin_date_expected limit 1;
  if v_cycle.id is not null then select t.assigned_to,u.name into v_assignee_id,v_assignee_name from public.governance_tasks t left join public.users u on u.id=t.assigned_to where t.cycle_id=v_cycle.id and t.status not in ('completed','canceled') order by t.created_at desc limit 1; end if;
  v_house:=coalesce(v_cycle.status::text,'ready');
  if v_blocked then v_ready:='blocked'; v_blockers:=array_append(v_blockers,'Interdição de manutenção ativa');
  elsif v_cycle.id is not null then v_ready:='not_ready'; v_blockers:=array_append(v_blockers,'Governança: '||replace(v_house,'_',' '));
  else v_ready:='ready'; end if;
  return jsonb_build_object('room_id',p_room_id,'occupancy',case when v_occupied then 'occupied' when v_arrival.checkin_date_expected is not null then 'arrival_expected' else 'vacant' end,
    'housekeeping',v_house,'maintenance',case when v_blocked then 'blocked' else 'clear' end,'readiness',v_ready,
    'cycle_id',v_cycle.id,'cycle_version',v_cycle.version,'next_arrival_at',v_arrival.checkin_date_expected,
    'assignee_id',v_assignee_id,'assignee_name',v_assignee_name,'last_updated_at',v_cycle.updated_at,'blockers',to_jsonb(v_blockers));
end $$;

create function public.get_governance_cycle(p_hotel_id uuid,p_cycle_id uuid)
returns jsonb language sql stable set search_path=public as $$
select jsonb_build_object('id',c.id,'hotel_id',c.hotel_id,'room_id',c.room_id,'room_number',r.room_number,'stay_id',c.stay_id,'status',c.status,'source',c.source,'version',c.version,
 'next_arrival_at',(select s.checkin_date_expected from public.stays s where s.room_id=c.room_id and s.stay_status='confirmed' and s.checkin_date_expected>=now() order by s.checkin_date_expected limit 1),
 'severity',case when exists(select 1 from public.stays s where s.room_id=c.room_id and s.stay_status='confirmed' and s.checkin_date_expected::date<=current_date) then 'critical' when exists(select 1 from public.stays s where s.room_id=c.room_id and s.stay_status='confirmed' and s.checkin_date_expected<=now()+interval '24 hours') then 'warning' else 'info' end,
 'last_updated_at',c.updated_at,'released_at',c.released_at,'tasks',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'kind',t.kind,'status',t.status,'assigned_to',t.assigned_to,'assignee_name',u.name,'next_action',t.next_action,'version',t.version,'started_at',t.started_at,'completed_at',t.completed_at,
 'checklist',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'label',i.label,'display_order',i.display_order,'required',i.required,'result',i.result,'notes',i.notes) order by i.display_order) from public.governance_task_checklist_items i where i.task_id=t.id),'[]'::jsonb)) order by t.created_at) from public.governance_tasks t left join public.users u on u.id=t.assigned_to where t.cycle_id=c.id),'[]'::jsonb))
 || jsonb_build_object('events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'action',e.action,'message',e.message,'actor_name',u.name,'created_at',e.created_at) order by e.created_at desc) from public.governance_events e left join public.users u on u.id=e.actor_id where e.cycle_id=c.id),'[]'::jsonb))
from public.governance_cycles c join public.rooms r on r.id=c.room_id where c.hotel_id=p_hotel_id and c.id=p_cycle_id;
$$;

create function public.list_governance_board(p_hotel_id uuid)
returns jsonb language sql stable set search_path=public as $$
with cycles as (select public.get_governance_cycle(p_hotel_id,id) item from public.governance_cycles where hotel_id=p_hotel_id and status not in ('released','canceled'))
select jsonb_build_object('items',coalesce(jsonb_agg(item order by case item->>'severity' when 'critical' then 0 when 'warning' then 1 else 2 end,item->>'next_arrival_at' nulls last),'[]'::jsonb),
 'rooms',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'room_number',r.room_number,'room_type',r.room_type) order by r.room_number),'[]'::jsonb) from public.rooms r where r.hotel_id=p_hotel_id),
 'maintenance_categories',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',m.name) order by m.display_order,m.name),'[]'::jsonb) from public.maintenance_categories m where m.hotel_id=p_hotel_id and m.is_active),
 'minibar_options',(select coalesce(jsonb_agg(jsonb_build_object('offer_id',o.id,'point_id',o.point_id,'point_name',cp.name,'product_name',p.name) order by cp.display_order,o.display_order,p.name),'[]'::jsonb)
   from public.consumption_offers o join public.consumption_points cp on cp.id=o.point_id join public.products p on p.id=o.product_id
   where o.hotel_id=p_hotel_id and o.is_active and o.archived_at is null and cp.is_active and cp.archived_at is null and p.status='active'),
 'assignable_users',(select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'name',q.name) order by q.name),'[]'::jsonb) from (select distinct u.id,u.name from public.users u join public.user_roles ur on ur.user_id=u.id where ur.hotel_id=p_hotel_id and u.is_active) q),
 'summary',jsonb_build_object('total',count(*),'critical',count(*) filter(where item->>'severity'='critical'),'unassigned',count(*) filter(where not exists(select 1 from public.governance_tasks t where t.cycle_id=(item->>'id')::uuid and t.status in ('assigned','in_progress'))),'awaiting_inspection',count(*) filter(where item->>'status'='inspection_pending'))) from cycles;
$$;

create function public.create_governance_cycle(p_hotel_id uuid,p_room_id uuid,p_stay_id uuid default null,p_source public.governance_cycle_source default 'manual',p_actor_id uuid default null,p_note text default null)
returns jsonb language plpgsql set search_path=public as $$ declare v_id uuid;
begin
  if p_source not in ('pre_departure','manual') then return jsonb_build_object('result','invalid'); end if;
  if p_source='pre_departure' and not exists(select 1 from public.stays s join public.reservations r on r.id=s.reservation_id where s.id=p_stay_id and s.room_id=p_room_id and s.stay_status='checked_in' and r.hotel_id=p_hotel_id) then return jsonb_build_object('result','stay_not_checked_in'); end if;
  v_id:=public.ensure_governance_cycle(p_hotel_id,p_room_id,p_stay_id,p_source,p_actor_id);
  if v_id is null then return jsonb_build_object('result','not_found'); end if;
  if nullif(btrim(p_note),'') is not null then insert into public.governance_events(hotel_id,cycle_id,actor_id,action,message) values(p_hotel_id,v_id,p_actor_id,'note',btrim(p_note)); end if;
  return jsonb_build_object('result','ok','cycle_id',v_id);
end $$;

create function public.act_governance_cycle(p_hotel_id uuid,p_cycle_id uuid,p_actor_id uuid,p_input jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare v_cycle public.governance_cycles%rowtype; v_task public.governance_tasks%rowtype; v_action text:=p_input->>'action'; v_note text:=nullif(btrim(p_input->>'note'),''); v_next text:=nullif(btrim(p_input->>'next_action'),''); v_answer jsonb; v_cleaner uuid; v_pending uuid;
begin
  select * into v_cycle from public.governance_cycles where id=p_cycle_id and hotel_id=p_hotel_id for update;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if v_cycle.version<>coalesce((p_input->>'expected_version')::integer,0) then return jsonb_build_object('result','conflict'); end if;
  if p_input->>'task_id' is not null then select * into v_task from public.governance_tasks where id=(p_input->>'task_id')::uuid and cycle_id=p_cycle_id for update; end if;
  if v_action='claim' and v_task.status='pending' then update public.governance_tasks set status='assigned',assigned_to=p_actor_id,version=version+1,updated_at=now() where id=v_task.id;
  elsif v_action='release_assignment' and v_task.status='assigned' and v_task.assigned_to=p_actor_id then update public.governance_tasks set status='pending',assigned_to=null,version=version+1,updated_at=now() where id=v_task.id;
  elsif v_action='assign' and v_task.status in ('pending','assigned') and p_input->>'assigned_to' is not null
    and public.maintenance_user_has_hotel_scope((p_input->>'assigned_to')::uuid,p_hotel_id)
    then update public.governance_tasks set status='assigned',assigned_to=(p_input->>'assigned_to')::uuid,version=version+1,updated_at=now() where id=v_task.id;
  elsif v_action='start' and v_task.status='assigned' and v_task.assigned_to=p_actor_id then update public.governance_tasks set status='in_progress',started_at=coalesce(started_at,now()),version=version+1,updated_at=now() where id=v_task.id; update public.governance_cycles set status=case when v_task.kind='cleaning' then 'cleaning_in_progress' else status end where id=p_cycle_id;
  elsif v_action in ('complete','approve') and v_task.status in ('assigned','in_progress') and v_task.assigned_to=p_actor_id then
    if (v_task.kind='inspection' and v_action<>'approve') or (v_task.kind<>'inspection' and v_action<>'complete') then return jsonb_build_object('result','invalid_transition'); end if;
    if v_task.kind='inspection' and v_note is null then return jsonb_build_object('result','inspection_note_required'); end if;
    if exists(select 1 from public.governance_task_checklist_items i where i.task_id=v_task.id and i.required and not exists(
      select 1 from jsonb_array_elements(coalesce(p_input->'answers','[]'::jsonb)) a where a->>'item_id'=i.id::text and a->>'result' in ('approved','rejected','not_applicable')
    )) then return jsonb_build_object('result','checklist_incomplete'); end if;
    if exists(select 1 from jsonb_array_elements(coalesce(p_input->'answers','[]'::jsonb)) a where a->>'result'='rejected' and nullif(btrim(a->>'notes'),'') is null) then return jsonb_build_object('result','rejection_note_required'); end if;
    if v_task.kind='inspection' then
      select completed_by into v_cleaner from public.governance_tasks where cycle_id=p_cycle_id and kind='cleaning' and status='completed' order by completed_at desc limit 1;
      if v_cleaner=p_actor_id then return jsonb_build_object('result','inspector_must_differ'); end if;
      if exists(select 1 from public.room_blocks where hotel_id=p_hotel_id and room_id=v_cycle.room_id and released_at is null) then return jsonb_build_object('result','maintenance_blocked'); end if;
      if exists(select 1 from public.governance_tasks where cycle_id=p_cycle_id and kind='replenishment' and status<>'completed') then return jsonb_build_object('result','replenishment_pending'); end if;
    end if;
    for v_answer in select value from jsonb_array_elements(coalesce(p_input->'answers','[]'::jsonb)) loop update public.governance_task_checklist_items set result=(v_answer->>'result')::public.governance_check_result,notes=nullif(btrim(v_answer->>'notes'),'') where id=(v_answer->>'item_id')::uuid and task_id=v_task.id; end loop;
    update public.governance_tasks set status='completed',assigned_to=null,completed_at=now(),completed_by=p_actor_id,version=version+1,updated_at=now() where id=v_task.id;
    if v_task.kind='cleaning' then update public.governance_cycles set status='inspection_pending' where id=p_cycle_id; perform public.governance_create_task(p_hotel_id,p_cycle_id,'inspection');
    elsif v_task.kind='inspection' then update public.governance_cycles set status='released',released_at=now(),released_by=p_actor_id,release_reason=coalesce(v_note,'Inspeção aprovada') where id=p_cycle_id;
    elsif v_task.kind='departure_review' and exists(select 1 from public.stays where id=v_cycle.stay_id and stay_status='checked_out') then update public.governance_cycles set status='cleaning_pending' where id=p_cycle_id; perform public.governance_create_task(p_hotel_id,p_cycle_id,'cleaning'); end if;
  elsif v_action='reject' and v_task.kind='inspection' and v_task.assigned_to=p_actor_id and v_note is not null then
    if exists(select 1 from public.governance_task_checklist_items i where i.task_id=v_task.id and i.required and not exists(
      select 1 from jsonb_array_elements(coalesce(p_input->'answers','[]'::jsonb)) a where a->>'item_id'=i.id::text and a->>'result' in ('approved','rejected','not_applicable')
    )) then return jsonb_build_object('result','checklist_incomplete'); end if;
    if not exists(select 1 from jsonb_array_elements(coalesce(p_input->'answers','[]'::jsonb)) a where a->>'result'='rejected') then return jsonb_build_object('result','invalid_transition'); end if;
    if exists(select 1 from jsonb_array_elements(coalesce(p_input->'answers','[]'::jsonb)) a where a->>'result'='rejected' and nullif(btrim(a->>'notes'),'') is null) then return jsonb_build_object('result','rejection_note_required'); end if;
    for v_answer in select value from jsonb_array_elements(coalesce(p_input->'answers','[]'::jsonb)) loop update public.governance_task_checklist_items set result=(v_answer->>'result')::public.governance_check_result,notes=nullif(btrim(v_answer->>'notes'),'') where id=(v_answer->>'item_id')::uuid and task_id=v_task.id; end loop;
    update public.governance_tasks set status='completed',assigned_to=null,completed_at=now(),completed_by=p_actor_id,version=version+1,updated_at=now() where id=v_task.id;
    update public.governance_cycles set status='cleaning_pending' where id=p_cycle_id; perform public.governance_create_task(p_hotel_id,p_cycle_id,'cleaning');
  elsif v_action='handoff_note' and v_note is not null and v_next is not null then update public.governance_tasks set next_action=v_next,version=version+1,updated_at=now() where id=v_task.id;
  elsif v_action='cancel' and v_note is not null then update public.governance_tasks set status='canceled',assigned_to=null,completed_at=null,version=version+1,updated_at=now() where cycle_id=p_cycle_id and status not in ('completed','canceled'); update public.governance_cycles set status='canceled' where id=p_cycle_id;
  else return jsonb_build_object('result','invalid_transition'); end if;
  if v_task.id is not null and v_action in ('claim','release_assignment','assign','start') then
    update public.operational_pending p set
      status=case when t.assigned_to is null then 'open' else 'claimed' end,
      assigned_to=t.assigned_to,version=p.version+1,updated_at=now()
    from public.governance_tasks t where p.source='governance' and p.entity_type='governance_task' and p.entity_id=t.id and p.status<>'resolved' and t.id=v_task.id
    returning p.id into v_pending;
    if v_pending is not null then insert into public.operational_pending_events(hotel_id,pending_id,actor_id,action) values(p_hotel_id,v_pending,p_actor_id,case when v_action='release_assignment' then 'released' else 'claimed' end); end if;
  end if;
  update public.governance_cycles set version=version+1,updated_at=now() where id=p_cycle_id;
  insert into public.governance_events(hotel_id,cycle_id,task_id,actor_id,action,message,metadata) values(p_hotel_id,p_cycle_id,v_task.id,p_actor_id,v_action,v_note,jsonb_build_object('next_action',v_next));
  return jsonb_build_object('result','ok','cycle_id',p_cycle_id);
end $$;

create function public.create_governance_template(p_hotel_id uuid,p_actor_id uuid,p_input jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare v_kind public.governance_task_kind; v_version integer; v_id uuid; v_item jsonb; v_order integer:=0;
begin
  v_kind:=(p_input->>'kind')::public.governance_task_kind;
  if v_kind='replenishment' or nullif(btrim(p_input->>'name'),'') is null or jsonb_array_length(coalesce(p_input->'items','[]')) not between 1 and 50 then return jsonb_build_object('result','invalid'); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_hotel_id::text||v_kind::text,912));
  select coalesce(max(version),0)+1 into v_version from public.governance_checklist_templates where hotel_id=p_hotel_id and kind=v_kind;
  update public.governance_checklist_templates set is_active=false where hotel_id=p_hotel_id and kind=v_kind and is_active;
  insert into public.governance_checklist_templates(hotel_id,kind,name,version,created_by) values(p_hotel_id,v_kind,btrim(p_input->>'name'),v_version,p_actor_id) returning id into v_id;
  for v_item in select value from jsonb_array_elements(p_input->'items') loop
    v_order:=v_order+10;
    if nullif(btrim(v_item->>'label'),'') is null then raise exception 'invalid checklist label' using errcode='23514'; end if;
    insert into public.governance_checklist_template_items(hotel_id,template_id,label,display_order,required)
      values(p_hotel_id,v_id,btrim(v_item->>'label'),v_order,coalesce((v_item->>'required')::boolean,true));
  end loop;  return jsonb_build_object('result','ok','template_id',v_id);
exception when invalid_text_representation then return jsonb_build_object('result','invalid');
end $$;

create function public.list_governance_templates(p_hotel_id uuid)
returns jsonb language sql stable set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'kind',t.kind,'name',t.name,'version',t.version,'is_active',t.is_active,'items',
    coalesce((select jsonb_agg(jsonb_build_object('label',i.label,'display_order',i.display_order,'required',i.required) order by i.display_order)
      from public.governance_checklist_template_items i where i.template_id=t.id),'[]'::jsonb))
    order by t.kind,t.version desc),'[]'::jsonb)
  from public.governance_checklist_templates t where t.hotel_id=p_hotel_id;
$$;
create function public.governance_register_minibar(p_hotel_id uuid,p_cycle_id uuid,p_actor_id uuid,p_input jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare v_cycle public.governance_cycles%rowtype; v_order jsonb; v_item jsonb; v_order_id uuid; v_key uuid; v_task uuid;
begin
  select * into v_cycle from public.governance_cycles where id=p_cycle_id and hotel_id=p_hotel_id for update;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if v_cycle.status in ('released','canceled') then return jsonb_build_object('result','invalid_state'); end if;
  v_key:=(p_input->>'idempotency_key')::uuid;
  if coalesce((p_input->>'discrepancy_only')::boolean,false) then
    if not exists(select 1 from public.stays where id=v_cycle.stay_id and stay_status in ('checked_in','checked_out')) then return jsonb_build_object('result','invalid_state'); end if;
  else
    v_order:=public.post_consumption_order(p_hotel_id,v_cycle.stay_id,(p_input->>'point_id')::uuid,p_actor_id,(p_input->>'occurred_at')::timestamptz,
      (p_input->>'disposition')::public.consumption_order_disposition,(p_input->>'billing_mode')::public.consumption_billing_mode,p_input->'items',v_key,
      nullif(p_input->>'guest_customer_id','')::uuid,nullif(p_input->>'payment_method','')::public.consumption_payment_method,p_input->>'payment_reference',coalesce((p_input->>'partner_receipt_confirmed')::boolean,false),p_input->>'notes',p_input->>'courtesy_reason');
    if v_order->>'result'<>'ok' then return v_order; end if; v_order_id:=(v_order->>'order_id')::uuid;
  end if;
  for v_item in select value from jsonb_array_elements(p_input->'items') loop
    insert into public.governance_minibar_findings(hotel_id,cycle_id,offer_id,quantity,replenishment_quantity,consumption_order_id,discrepancy_only,request_key,notes)
      values(p_hotel_id,p_cycle_id,(v_item->>'offer_id')::uuid,(v_item->>'quantity')::numeric,coalesce((v_item->>'replenishment_quantity')::numeric,(v_item->>'quantity')::numeric),v_order_id,coalesce((p_input->>'discrepancy_only')::boolean,false),v_key,nullif(btrim(p_input->>'notes'),''))
      on conflict(cycle_id,request_key,offer_id) do nothing;
  end loop;
  if exists(select 1 from public.governance_minibar_findings where cycle_id=p_cycle_id and request_key=v_key and replenishment_quantity>0) then v_task:=public.governance_create_task(p_hotel_id,p_cycle_id,'replenishment'); end if;
  insert into public.governance_events(hotel_id,cycle_id,task_id,actor_id,action,metadata) values(p_hotel_id,p_cycle_id,v_task,p_actor_id,case when v_order_id is null then 'minibar_discrepancy' else 'minibar_posted' end,jsonb_build_object('order_id',v_order_id,'request_key',v_key));
  update public.governance_cycles set version=version+1,updated_at=now() where id=p_cycle_id;
  return jsonb_build_object('result','ok','cycle_id',p_cycle_id,'order_id',v_order_id);
exception when invalid_text_representation or not_null_violation then return jsonb_build_object('result','invalid');
end $$;

create function public.simulate_stay_relocation(p_hotel_id uuid,p_stay_id uuid)
returns jsonb language plpgsql stable set search_path=public as $$
declare v_stay record;
begin
  select s.*,src.room_type source_type,src.max_occupancy source_capacity into v_stay from public.stays s join public.reservations r on r.id=s.reservation_id and r.hotel_id=p_hotel_id join public.rooms src on src.id=s.room_id where s.id=p_stay_id;
  if not found or v_stay.stay_status<>'confirmed' or v_stay.checkin_date_actual is not null then return jsonb_build_object('result','not_eligible'); end if;
  return jsonb_build_object('result','ok','version',v_stay.operational_version,'items',coalesce((select jsonb_agg(jsonb_build_object('room_id',room.id,'room_number',room.room_number,'room_type',room.room_type,'max_occupancy',room.max_occupancy,'public_daily_rate',room.base_daily_rate,'contracted_daily_rate',v_stay.applied_daily_rate,'rate_difference',room.base_daily_rate-v_stay.applied_daily_rate,'same_room_type',room.room_type=v_stay.source_type) order by (room.room_type=v_stay.source_type) desc,abs(room.base_daily_rate-v_stay.applied_daily_rate),room.room_number)
    from public.rooms room where room.hotel_id=p_hotel_id and room.id<>v_stay.room_id and room.max_occupancy>=v_stay.source_capacity
      and not exists(select 1 from public.stays other where other.room_id=room.id and other.id<>p_stay_id and other.stay_status not in ('canceled','no_show','checked_out') and other.checkin_date_expected<v_stay.checkout_date_expected and other.checkout_date_expected>v_stay.checkin_date_expected)
      and not exists(select 1 from public.room_blocks b where b.hotel_id=p_hotel_id and b.room_id=room.id and b.released_at is null and b.start_date<v_stay.checkout_date_expected::date and b.end_date>=v_stay.checkin_date_expected::date)),'[]'::jsonb));
end $$;

create function public.governance_create_defect(p_hotel_id uuid,p_cycle_id uuid,p_actor_id uuid,p_input jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare v_cycle public.governance_cycles%rowtype; v_occurrence uuid; v_block uuid; v_blocking boolean:=coalesce((p_input->>'blocking')::boolean,false);
begin
  select * into v_cycle from public.governance_cycles where id=p_cycle_id and hotel_id=p_hotel_id for update;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if v_cycle.status in ('released','canceled') then return jsonb_build_object('result','invalid_state'); end if;
  if nullif(btrim(p_input->>'description'),'') is null or not exists(select 1 from public.maintenance_categories where id=(p_input->>'category_id')::uuid and hotel_id=p_hotel_id and is_active) then return jsonb_build_object('result','invalid'); end if;
  if v_blocking and nullif(p_input->>'block_end_date','') is null then return jsonb_build_object('result','invalid'); end if;
  v_occurrence:=public.create_maintenance_occurrence(p_hotel_id,(p_input->>'category_id')::uuid,v_cycle.room_id,null,v_cycle.stay_id,
    (p_input->>'kind')::public.maintenance_occurrence_kind,(p_input->>'priority')::public.maintenance_priority,btrim(p_input->>'description'),now(),p_actor_id,v_blocking);
  if v_blocking then
    v_block:=public.create_maintenance_room_block(p_hotel_id,v_occurrence,p_actor_id,(now() at time zone (select timezone from public.hotels where id=p_hotel_id))::date,
      (p_input->>'block_end_date')::date,'maintenance','Governança: '||left(btrim(p_input->>'description'),80),nullif(btrim(p_input->>'conflict_acknowledgement'),''));
  end if;
  insert into public.governance_maintenance_links(hotel_id,cycle_id,occurrence_id,room_block_id,blocking) values(p_hotel_id,p_cycle_id,v_occurrence,v_block,v_blocking);
  insert into public.governance_events(hotel_id,cycle_id,actor_id,action,metadata) values(p_hotel_id,p_cycle_id,p_actor_id,'defect_reported',jsonb_build_object('occurrence_id',v_occurrence,'room_block_id',v_block,'blocking',v_blocking));
  return jsonb_build_object('result','ok','cycle_id',p_cycle_id,'occurrence_id',v_occurrence,'room_block_id',v_block);
exception when invalid_text_representation or not_null_violation or check_violation or exclusion_violation or foreign_key_violation then
  return jsonb_build_object('result','conflict');
end $$;

create function public.relocate_confirmed_stay(p_hotel_id uuid,p_stay_id uuid,p_destination_room_id uuid,p_actor_id uuid,p_expected_version integer,p_reason text,p_room_block_id uuid default null)
returns jsonb language plpgsql set search_path=public as $$
declare v_stay record; v_dest record;
begin
  select s.*,src.max_occupancy source_capacity into v_stay from public.stays s join public.reservations r on r.id=s.reservation_id and r.hotel_id=p_hotel_id join public.rooms src on src.id=s.room_id where s.id=p_stay_id for update of s;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if v_stay.stay_status<>'confirmed' or v_stay.checkin_date_actual is not null then return jsonb_build_object('result','not_eligible'); end if;
  if v_stay.operational_version<>p_expected_version then return jsonb_build_object('result','conflict'); end if;
  select * into v_dest from public.rooms where id=p_destination_room_id and hotel_id=p_hotel_id for update;
  if not found or v_dest.max_occupancy<v_stay.source_capacity then return jsonb_build_object('result','incompatible_room'); end if;
  if exists(select 1 from public.stays other where other.room_id=v_dest.id and other.id<>p_stay_id and other.stay_status not in ('canceled','no_show','checked_out') and other.checkin_date_expected<v_stay.checkout_date_expected and other.checkout_date_expected>v_stay.checkin_date_expected)
    or exists(select 1 from public.room_blocks b where b.hotel_id=p_hotel_id and b.room_id=v_dest.id and b.released_at is null and b.start_date<v_stay.checkout_date_expected::date and b.end_date>=v_stay.checkin_date_expected::date) then return jsonb_build_object('result','conflict'); end if;
  update public.stays set room_id=v_dest.id,operational_version=operational_version+1 where id=p_stay_id;
  insert into public.stay_relocation_events(hotel_id,stay_id,source_room_id,destination_room_id,room_block_id,actor_id,reason,contracted_daily_rate,destination_public_rate)
    values(p_hotel_id,p_stay_id,v_stay.room_id,v_dest.id,p_room_block_id,p_actor_id,btrim(p_reason),v_stay.applied_daily_rate,v_dest.base_daily_rate);
  return jsonb_build_object('result','ok','version',v_stay.operational_version+1);
end $$;

create function public.checkin_stay_with_readiness(p_hotel_id uuid,p_stay_id uuid,p_actor_id uuid,p_expected_version integer default null,p_override_reason text default null,p_allow_override boolean default false)
returns jsonb language plpgsql set search_path=public as $$
declare v_stay record; v_state jsonb; v_cycle uuid;
begin
  select s.* into v_stay from public.stays s join public.reservations r on r.id=s.reservation_id and r.hotel_id=p_hotel_id where s.id=p_stay_id for update of s;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if v_stay.stay_status<>'confirmed' then return jsonb_build_object('result','invalid_state'); end if;
  v_state:=public.governance_room_state(p_hotel_id,v_stay.room_id,now());
  if v_state->>'readiness'='blocked' then return jsonb_build_object('result','maintenance_blocked','state',v_state); end if;
  if v_state->>'readiness'='not_ready' then
    if p_expected_version is null or p_expected_version<>coalesce((v_state->>'cycle_version')::integer,0) then return jsonb_build_object('result','conflict','state',v_state); end if;
    if not p_allow_override or nullif(btrim(p_override_reason),'') is null then return jsonb_build_object('result','room_not_ready','state',v_state); end if;
    v_cycle:=(v_state->>'cycle_id')::uuid;
    update public.governance_tasks set status='canceled',assigned_to=null,completed_at=null,version=version+1,updated_at=now() where cycle_id=v_cycle and status not in ('completed','canceled');
    update public.governance_cycles set status='released',released_at=now(),released_by=p_actor_id,release_reason=btrim(p_override_reason),version=version+1,updated_at=now() where id=v_cycle;
    insert into public.governance_events(hotel_id,cycle_id,actor_id,action,message,metadata) values(p_hotel_id,v_cycle,p_actor_id,'readiness_override',btrim(p_override_reason),jsonb_build_object('state',v_state));
  end if;
  update public.stays set stay_status='checked_in',checkin_date_actual=now(),operational_version=operational_version+1 where id=p_stay_id;
  return jsonb_build_object('result','ok');
end $$;

alter table public.governance_checklist_templates enable row level security;
alter table public.governance_checklist_template_items enable row level security;
alter table public.governance_cycles enable row level security;
alter table public.governance_tasks enable row level security;
alter table public.governance_task_checklist_items enable row level security;
alter table public.governance_minibar_findings enable row level security;
alter table public.governance_maintenance_links enable row level security;
alter table public.governance_events enable row level security;
alter table public.stay_relocation_events enable row level security;
revoke all on public.governance_checklist_templates,public.governance_checklist_template_items,public.governance_cycles,public.governance_tasks,public.governance_task_checklist_items,public.governance_minibar_findings,public.governance_maintenance_links,public.governance_events,public.stay_relocation_events from anon,authenticated;
grant all on public.governance_checklist_templates,public.governance_checklist_template_items,public.governance_cycles,public.governance_tasks,public.governance_task_checklist_items,public.governance_minibar_findings,public.governance_maintenance_links,public.governance_events,public.stay_relocation_events to service_role;
grant usage on type public.governance_cycle_status,public.governance_cycle_source,public.governance_task_kind,public.governance_task_status,public.governance_check_result to service_role;
revoke all on function public.governance_seed_templates(uuid,uuid),public.governance_create_task(uuid,uuid,public.governance_task_kind),public.ensure_governance_cycle(uuid,uuid,uuid,public.governance_cycle_source,uuid),public.governance_room_state(uuid,uuid,timestamptz),public.get_governance_cycle(uuid,uuid),public.list_governance_board(uuid),public.create_governance_cycle(uuid,uuid,uuid,public.governance_cycle_source,uuid,text),public.act_governance_cycle(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.governance_seed_templates(uuid,uuid),public.governance_create_task(uuid,uuid,public.governance_task_kind),public.ensure_governance_cycle(uuid,uuid,uuid,public.governance_cycle_source,uuid),public.governance_room_state(uuid,uuid,timestamptz),public.get_governance_cycle(uuid,uuid),public.list_governance_board(uuid),public.create_governance_cycle(uuid,uuid,uuid,public.governance_cycle_source,uuid,text),public.act_governance_cycle(uuid,uuid,uuid,jsonb) to service_role;

revoke all on function public.create_governance_template(uuid,uuid,jsonb),public.list_governance_templates(uuid),public.governance_register_minibar(uuid,uuid,uuid,jsonb),public.simulate_stay_relocation(uuid,uuid),public.relocate_confirmed_stay(uuid,uuid,uuid,uuid,integer,text,uuid),public.checkin_stay_with_readiness(uuid,uuid,uuid,integer,text,boolean) from public,anon,authenticated;
grant execute on function public.create_governance_template(uuid,uuid,jsonb),public.list_governance_templates(uuid),public.governance_register_minibar(uuid,uuid,uuid,jsonb),public.simulate_stay_relocation(uuid,uuid),public.relocate_confirmed_stay(uuid,uuid,uuid,uuid,integer,text,uuid),public.checkin_stay_with_readiness(uuid,uuid,uuid,integer,text,boolean) to service_role;
revoke all on function public.governance_create_defect(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.governance_create_defect(uuid,uuid,uuid,jsonb) to service_role;
revoke all on function public.validate_governance_hotel_scope(),public.validate_relocation_hotel_scope(),public.governance_seed_templates_for_hotel(),public.governance_after_stay_checkout(),public.governance_after_room_block() from public,anon,authenticated;

alter table public.operational_pending drop constraint operational_pending_source_check;
alter table public.operational_pending add constraint operational_pending_source_check check(source in ('maintenance','consumption','governance'));

insert into public.permissions(name,type)
select name,'HOTEL_PERMISSION' from unnest(array[
  'read_governance','execute_governance','inspect_governance','assign_governance',
  'manage_governance_templates','override_room_readiness','relocate_reservation'
]) name on conflict(name) do nothing;

create function public.governance_initialize_pending_assignment() returns trigger language plpgsql set search_path=public as $$
declare v_assigned uuid;
begin
  if new.source='governance' and new.entity_type='governance_task' then
    select assigned_to into v_assigned from public.governance_tasks where id=new.entity_id and hotel_id=new.hotel_id;
    new.assigned_to:=v_assigned;
    new.status:=case when v_assigned is null then 'open' else 'claimed' end;
  end if;
  return new;
end $$;
create trigger governance_pending_assignment before insert on public.operational_pending for each row execute function public.governance_initialize_pending_assignment();

alter function public.operational_pending_candidates(uuid,timestamptz)
  rename to operational_pending_candidates_stage1;
create function public.operational_pending_candidates(p_hotel_id uuid,p_now timestamptz default now())
returns jsonb language plpgsql set search_path=public as $$
declare v_result jsonb; v_item record; v_task record; v_date date;
begin
  v_result:=public.operational_pending_candidates_stage1(p_hotel_id,p_now);
  select (p_now at time zone timezone)::date into v_date from public.hotels where id=p_hotel_id;
  for v_task in
    select t.id,t.kind,t.cycle_id,c.room_id,r.room_number,c.status,c.updated_at,
      (select s.checkin_date_expected from public.stays s where s.room_id=c.room_id and s.stay_status='confirmed' and s.checkin_date_expected>=p_now order by s.checkin_date_expected limit 1) next_arrival
    from public.governance_tasks t join public.governance_cycles c on c.id=t.cycle_id join public.rooms r on r.id=c.room_id
    where c.hotel_id=p_hotel_id and c.status not in ('released','canceled','maintenance_hold') and t.status not in ('completed','canceled')
  loop
    v_result:=v_result||jsonb_build_array(jsonb_build_object('source','governance','source_key','governance:task:'||v_task.id,'kind','governance_'||v_task.kind,
      'entity_type','governance_task','entity_id',v_task.id,'title','Quarto '||v_task.room_number||': '||replace(v_task.kind::text,'_',' '),
      'href','/dashboard/governance?cycle_id='||v_task.cycle_id,'severity',case when v_task.next_arrival::date<=v_date then 'critical' when v_task.next_arrival<=p_now+interval '24 hours' then 'warning' else 'info' end,'due_on',v_task.next_arrival::date));
  end loop;
  for v_item in
    select c.id,c.room_id,r.room_number,c.updated_at from public.governance_cycles c join public.rooms r on r.id=c.room_id
    where c.hotel_id=p_hotel_id and c.status='maintenance_hold'
  loop
    v_result:=v_result||jsonb_build_array(jsonb_build_object('source','governance','source_key','governance:maintenance:'||v_item.id,
      'kind','governance_maintenance','entity_type','governance_cycle','entity_id',v_item.id,'title','Quarto '||v_item.room_number||': retido pela manutenção',
      'href','/dashboard/governance?cycle_id='||v_item.id,'severity','warning'));
  end loop;
  for v_item in
    select b.id block_id,s.id stay_id,r.room_number,s.checkin_date_expected
    from public.room_blocks b join public.rooms r on r.id=b.room_id join public.stays s on s.room_id=b.room_id
    where b.hotel_id=p_hotel_id and b.released_at is null and s.stay_status='confirmed'
      and s.checkin_date_expected::date<=b.end_date and s.checkout_date_expected::date>b.start_date
  loop
    v_result:=v_result||jsonb_build_array(jsonb_build_object('source','governance','source_key','governance:relocation:'||v_item.block_id||':'||v_item.stay_id,
      'kind','governance_relocation','entity_type','stay','entity_id',v_item.stay_id,'title','Reserva afetada no quarto '||v_item.room_number,
      'href','/dashboard/reservations/view?stay_id='||v_item.stay_id,'severity',case when v_item.checkin_date_expected::date<=v_date then 'critical' else 'warning' end,'due_on',v_item.checkin_date_expected::date));
  end loop;
  for v_item in select f.id,c.room_id,r.room_number from public.governance_minibar_findings f join public.governance_cycles c on c.id=f.cycle_id join public.rooms r on r.id=c.room_id where f.hotel_id=p_hotel_id and f.discrepancy_only and f.consumption_order_id is null
  loop
    v_result:=v_result||jsonb_build_array(jsonb_build_object('source','governance','source_key','governance:minibar:'||v_item.id,'kind','governance_minibar','entity_type','minibar_finding','entity_id',v_item.id,'title','Divergência de frigobar no quarto '||v_item.room_number,'href','/dashboard/governance','severity','warning'));
  end loop;
  return v_result;
end $$;

create or replace function public.can_read_operational_pending(p public.operational_pending,p_user_id uuid,p_permissions text[])
returns boolean language sql stable set search_path=public as $$
  select public.maintenance_user_has_hotel_scope(p_user_id,p.hotel_id) and case
    when p.source='governance' then p_permissions && array['read_governance','execute_governance','inspect_governance','assign_governance']
    when p.source='maintenance' then exists(select 1 from public.maintenance_notifications n where n.hotel_id=p.hotel_id and n.recipient_id=p_user_id and n.kind=p.kind and n.entity_id=p.entity_id)
      and p_permissions && array['read_maintenance','execute_maintenance','triage_maintenance','manage_maintenance_plans','manage_maintenance_sla','read_maintenance_analytics','manage_maintenance_suppliers']
    when p.kind='guest_balance' then p_permissions && array['read_consumption_analytics','access_reservations_calendar']
    when p.kind='critical_stock' then p_permissions && array['read_consumption_analytics','read_inventory']
    when p.kind='agreement_expiry' then p_permissions && array['read_consumption_analytics','read_commercial_partners']
    when p.kind='pending_settlement' then p_permissions && array['read_partner_settlements','prepare_partner_settlements','approve_partner_settlements','settle_partner_settlements']
    else false end;
$$;

create or replace function public.act_operational_pending(p_hotel_id uuid,p_user_id uuid,p_permissions text[],p_ids uuid[],p_action text,p_version integer default null)
returns jsonb language plpgsql set search_path=public as $$
declare v_item public.operational_pending%rowtype; v_id uuid;
begin
  if p_action not in ('read','unread','claim','release') or coalesce(array_length(p_ids,1),0) not between 1 and 100 then return jsonb_build_object('result','invalid'); end if;
  if p_action in ('claim','release') and (array_length(p_ids,1)<>1 or p_version is null) then return jsonb_build_object('result','invalid'); end if;
  for v_id in select unnest(p_ids) order by 1 loop
    select * into v_item from public.operational_pending where id=v_id and hotel_id=p_hotel_id for update;
    if not found or not public.can_read_operational_pending(v_item,p_user_id,p_permissions) then return jsonb_build_object('result','not_found'); end if;
  end loop;
  if p_action in ('claim','release') then
    if v_item.version<>p_version or (p_action='claim' and v_item.status<>'open') or (p_action='release' and (v_item.status<>'claimed' or v_item.assigned_to<>p_user_id)) then return jsonb_build_object('result','conflict'); end if;
    if v_item.source='governance' and v_item.entity_type='governance_task' then
      if p_action='claim' then update public.governance_tasks set status='assigned',assigned_to=p_user_id,version=version+1,updated_at=now() where id=v_item.entity_id and status='pending';
      else update public.governance_tasks set status='pending',assigned_to=null,version=version+1,updated_at=now() where id=v_item.entity_id and status='assigned' and assigned_to=p_user_id; end if;
      if not found then return jsonb_build_object('result','conflict'); end if;
    end if;
    update public.operational_pending set status=case when p_action='claim' then 'claimed' else 'open' end,assigned_to=case when p_action='claim' then p_user_id else null end,version=version+1,updated_at=now() where id=v_item.id;
    insert into public.operational_pending_events(hotel_id,pending_id,actor_id,action) values(p_hotel_id,v_item.id,p_user_id,case when p_action='claim' then 'claimed' else 'released' end);
  elsif p_action='read' then
    insert into public.operational_pending_reads(hotel_id,pending_id,user_id) select p_hotel_id,id,p_user_id from unnest(p_ids) id on conflict(pending_id,user_id) do update set read_at=now();
  else delete from public.operational_pending_reads where hotel_id=p_hotel_id and user_id=p_user_id and pending_id=any(p_ids); end if;
  return jsonb_build_object('result','ok');
end $$;

revoke all on function public.operational_pending_candidates_stage1(uuid,timestamptz),public.operational_pending_candidates(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.operational_pending_candidates_stage1(uuid,timestamptz),public.operational_pending_candidates(uuid,timestamptz) to service_role;
revoke all on function public.governance_initialize_pending_assignment() from public,anon,authenticated;
