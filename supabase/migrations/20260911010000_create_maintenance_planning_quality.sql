create type public.maintenance_schedule_status as enum ('planned','confirmed','in_progress','completed','canceled');
create type public.maintenance_access_kind as enum ('free','vacant_room','guest_authorized','front_desk_coordination');
create type public.maintenance_availability_exception_kind as enum ('unavailable','additional_capacity');
create type public.maintenance_reschedule_status as enum ('pending','approved','rejected','canceled');
create type public.maintenance_lifecycle_kind as enum ('repair','replace','warranty');
create type public.maintenance_lifecycle_status as enum ('draft','submitted','approved','rejected','executed','canceled');
create type public.maintenance_service_confirmation_result as enum ('arrived','access_obtained','provider_absent','access_denied');

create table public.maintenance_teams (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id) on delete cascade,
  name text not null, description text, is_active boolean not null default true, version integer not null default 1,
  created_by uuid not null references public.users(id) on delete restrict, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint maintenance_teams_name_check check(length(btrim(name)) between 2 and 120),
  constraint maintenance_teams_hotel_name_key unique(hotel_id,name), constraint maintenance_teams_version_check check(version>0)
);
create table public.maintenance_team_members (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id) on delete cascade,
  team_id uuid not null references public.maintenance_teams(id) on delete cascade, user_id uuid not null references public.users(id) on delete restrict,
  role text not null, valid_from date not null, valid_until date, created_at timestamptz not null default now(),
  constraint maintenance_team_members_period_check check(valid_until is null or valid_until>=valid_from),
  constraint maintenance_team_members_role_check check(length(btrim(role)) between 2 and 80),
  constraint maintenance_team_members_key unique(team_id,user_id,valid_from)
);
create table public.maintenance_team_availability (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id) on delete cascade,
  team_id uuid not null references public.maintenance_teams(id) on delete cascade, weekday smallint not null,
  starts_at time not null, ends_at time not null, capacity smallint not null default 1,
  constraint maintenance_team_availability_day_check check(weekday between 0 and 6),
  constraint maintenance_team_availability_time_check check(ends_at>starts_at),
  constraint maintenance_team_availability_capacity_check check(capacity between 1 and 100),
  constraint maintenance_team_availability_key unique(team_id,weekday,starts_at,ends_at)
);
create table public.maintenance_availability_exceptions (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id) on delete cascade,
  team_id uuid references public.maintenance_teams(id) on delete cascade, user_id uuid references public.users(id) on delete cascade,
  kind public.maintenance_availability_exception_kind not null, starts_at timestamptz not null, ends_at timestamptz not null,
  capacity_delta integer not null default 0, reason text not null, created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint maintenance_availability_exception_target_check check((team_id is null)<>(user_id is null)),
  constraint maintenance_availability_exception_period_check check(ends_at>starts_at),
  constraint maintenance_availability_exception_reason_check check(length(btrim(reason)) between 3 and 1000),
  constraint maintenance_availability_exception_capacity_check check((kind='unavailable' and capacity_delta=0) or (kind='additional_capacity' and capacity_delta>0))
);

alter table public.maintenance_work_orders add column version integer not null default 1;

create table public.maintenance_schedules (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id) on delete cascade,
  work_order_id uuid not null references public.maintenance_work_orders(id) on delete cascade,
  team_id uuid references public.maintenance_teams(id) on delete restrict, technician_id uuid references public.users(id) on delete restrict,
  planned_start timestamptz not null, planned_end timestamptz not null, estimated_minutes integer not null,
  status public.maintenance_schedule_status not null default 'planned', access_kind public.maintenance_access_kind not null default 'free', access_notes text,
  version integer not null default 1, override_reason text, created_by uuid not null references public.users(id) on delete restrict,
  canceled_by uuid references public.users(id) on delete restrict, canceled_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint maintenance_schedules_target_check check(team_id is not null or technician_id is not null),
  constraint maintenance_schedules_period_check check(planned_end>planned_start and estimated_minutes between 5 and 10080),
  constraint maintenance_schedules_access_notes_check check(access_kind='free' or nullif(btrim(access_notes),'') is not null),
  constraint maintenance_schedules_cancel_check check((status<>'canceled') or (canceled_by is not null and canceled_at is not null)),
  constraint maintenance_schedules_version_check check(version>0)
);
create unique index maintenance_schedules_active_order_key on public.maintenance_schedules(work_order_id) where status<>'canceled';
create index maintenance_schedules_technician_time_idx on public.maintenance_schedules(hotel_id,technician_id,planned_start,planned_end) where status<>'canceled';
create index maintenance_schedules_team_time_idx on public.maintenance_schedules(hotel_id,team_id,planned_start,planned_end) where status<>'canceled';

create table public.maintenance_reschedule_requests (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id) on delete cascade,
  work_order_id uuid not null references public.maintenance_work_orders(id) on delete cascade,
  requested_by uuid not null references public.users(id) on delete restrict, requested_start timestamptz, reason text not null,
  status public.maintenance_reschedule_status not null default 'pending', decided_by uuid references public.users(id) on delete restrict,
  decision_reason text, decided_at timestamptz, created_at timestamptz not null default now(),
  constraint maintenance_reschedule_reason_check check(length(btrim(reason)) between 3 and 1000),
  constraint maintenance_reschedule_decision_check check((status='pending' and decided_by is null and decided_at is null) or (status<>'pending' and decided_by is not null and decided_at is not null and nullif(btrim(decision_reason),'') is not null))
);
create unique index maintenance_reschedule_pending_key on public.maintenance_reschedule_requests(work_order_id) where status='pending';

create table public.maintenance_waiting_episodes (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id) on delete cascade,
  work_order_id uuid not null references public.maintenance_work_orders(id) on delete cascade,
  reason public.maintenance_waiting_reason not null, description text not null, owner_id uuid not null references public.users(id) on delete restrict,
  supplier_id uuid references public.maintenance_suppliers(id) on delete restrict, contract_id uuid references public.maintenance_contracts(id) on delete restrict,
  next_follow_up_at timestamptz not null, started_at timestamptz not null default now(), resolved_at timestamptz,
  resolved_by uuid references public.users(id) on delete restrict, version integer not null default 1,
  constraint maintenance_waiting_description_check check(length(btrim(description)) between 3 and 4000),
  constraint maintenance_waiting_resolution_check check((resolved_at is null and resolved_by is null) or (resolved_at is not null and resolved_by is not null))
);
create unique index maintenance_waiting_active_key on public.maintenance_waiting_episodes(work_order_id) where resolved_at is null;
create index maintenance_waiting_due_idx on public.maintenance_waiting_episodes(hotel_id,next_follow_up_at) where resolved_at is null;
create table public.maintenance_waiting_followups (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id) on delete cascade,
  episode_id uuid not null references public.maintenance_waiting_episodes(id) on delete cascade,
  actor_id uuid not null references public.users(id) on delete restrict, notes text not null, next_follow_up_at timestamptz not null, created_at timestamptz not null default now(),
  constraint maintenance_waiting_followup_notes_check check(length(btrim(notes)) between 3 and 2000)
);
create table public.maintenance_execution_sessions (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id) on delete cascade,
  work_order_id uuid not null references public.maintenance_work_orders(id) on delete cascade,
  technician_id uuid not null references public.users(id) on delete restrict, started_at timestamptz not null default now(), ended_at timestamptz,
  end_reason text, created_at timestamptz not null default now(), constraint maintenance_execution_session_period_check check(ended_at is null or ended_at>=started_at)
);
create unique index maintenance_execution_active_key on public.maintenance_execution_sessions(work_order_id) where ended_at is null;

create table public.maintenance_occurrence_affected_rooms (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id) on delete cascade,
  occurrence_id uuid not null references public.maintenance_occurrences(id) on delete cascade, room_id uuid not null references public.rooms(id) on delete restrict,
  source text not null default 'confirmed', reason text not null, confirmed_by uuid not null references public.users(id) on delete restrict,
  impact_started_at timestamptz, impact_ended_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint maintenance_affected_rooms_source_check check(source in ('primary','block','suggested','confirmed')),
  constraint maintenance_affected_rooms_reason_check check(length(btrim(reason)) between 3 and 1000),
  constraint maintenance_affected_rooms_impact_check check(impact_ended_at is null or impact_started_at is not null),
  constraint maintenance_affected_rooms_key unique(occurrence_id,room_id)
);
create table public.maintenance_impact_scores (
  occurrence_id uuid primary key references public.maintenance_occurrences(id) on delete cascade,
  hotel_id uuid not null references public.hotels(id) on delete cascade, score smallint not null, recommended_priority public.maintenance_priority not null,
  components jsonb not null default '[]'::jsonb, guest_present boolean not null default false, next_arrival_at timestamptz,
  affected_room_count integer not null default 0, active_block boolean not null default false, impact_started_at timestamptz,
  recurrent boolean not null default false, computed_at timestamptz not null default now(),
  constraint maintenance_impact_score_check check(score between 0 and 100)
);

create table public.maintenance_recurrence_policies (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id) on delete cascade,
  category_id uuid references public.maintenance_categories(id) on delete restrict, window_days integer not null default 90,
  occurrence_threshold integer not null default 3, is_active boolean not null default true, created_by uuid references public.users(id) on delete restrict,
  version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint maintenance_recurrence_policy_limits check(window_days between 1 and 730 and occurrence_threshold between 2 and 20)
);
create unique index maintenance_recurrence_policy_default_key on public.maintenance_recurrence_policies(hotel_id) where category_id is null and is_active;
create unique index maintenance_recurrence_policy_category_key on public.maintenance_recurrence_policies(hotel_id,category_id) where category_id is not null and is_active;
create table public.maintenance_recurrence_groups (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id) on delete cascade,
  category_id uuid not null references public.maintenance_categories(id) on delete restrict, room_id uuid references public.rooms(id) on delete restrict,
  location_id uuid references public.maintenance_locations(id) on delete restrict, first_occurrence_at timestamptz not null,
  last_occurrence_at timestamptz not null, occurrence_count integer not null default 0, status text not null default 'active',
  review_reason text, reviewed_by uuid references public.users(id) on delete restrict, reviewed_at timestamptz,
  constraint maintenance_recurrence_group_target_check check((room_id is null)<>(location_id is null)),
  constraint maintenance_recurrence_group_status_check check(status in ('active','false_positive','closed'))
);
create table public.maintenance_recurrence_members (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id) on delete cascade,
  group_id uuid not null references public.maintenance_recurrence_groups(id) on delete cascade,
  occurrence_id uuid not null references public.maintenance_occurrences(id) on delete cascade,
  linked_by uuid references public.users(id) on delete restrict, link_reason text, created_at timestamptz not null default now(),
  constraint maintenance_recurrence_member_key unique(group_id,occurrence_id)
);

create table public.maintenance_lifecycle_decisions (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id) on delete cascade,
  occurrence_id uuid not null references public.maintenance_occurrences(id) on delete cascade,
  recommendation public.maintenance_lifecycle_kind not null, status public.maintenance_lifecycle_status not null default 'draft',
  single_option_reason text, proposed_by uuid not null references public.users(id) on delete restrict, submitted_at timestamptz,
  approved_by uuid references public.users(id) on delete restrict, approved_at timestamptz, selected_option_id uuid,
  decision_reason text, executed_by uuid references public.users(id) on delete restrict, executed_at timestamptz,
  replacement_location_id uuid references public.maintenance_locations(id) on delete restrict, version integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint maintenance_lifecycle_approval_separation check(approved_by is null or approved_by<>proposed_by)
);
create unique index maintenance_lifecycle_active_key on public.maintenance_lifecycle_decisions(occurrence_id) where status in ('draft','submitted','approved');
create table public.maintenance_lifecycle_options (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id) on delete cascade,
  decision_id uuid not null references public.maintenance_lifecycle_decisions(id) on delete cascade,
  kind public.maintenance_lifecycle_kind not null, estimated_cost numeric(12,2) not null default 0,
  estimated_downtime_hours integer not null default 0, supplier_id uuid references public.maintenance_suppliers(id) on delete restrict,
  contract_id uuid references public.maintenance_contracts(id) on delete restrict, cost_item_id uuid references public.maintenance_cost_items(id) on delete restrict,
  warranty_eligible boolean not null default false, warranty_snapshot jsonb not null default '{}'::jsonb,
  risks text not null, benefits text not null, justification text not null, created_at timestamptz not null default now(),
  constraint maintenance_lifecycle_option_cost_check check(estimated_cost>=0 and estimated_downtime_hours between 0 and 8760)
);
alter table public.maintenance_lifecycle_decisions add constraint maintenance_lifecycle_selected_option_fk foreign key(selected_option_id) references public.maintenance_lifecycle_options(id) on delete restrict;

create table public.maintenance_service_communications (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id) on delete cascade,
  work_order_id uuid not null references public.maintenance_work_orders(id) on delete cascade,
  audience text not null, channel text not null, promised_at timestamptz not null, notes text not null,
  communicated_by uuid not null references public.users(id) on delete restrict, communicated_at timestamptz not null default now(),
  constraint maintenance_service_communication_audience check(audience in ('front_desk','guest','requester','internal')),
  constraint maintenance_service_communication_channel check(channel in ('in_person','phone','message','other')),
  constraint maintenance_service_communication_notes check(length(btrim(notes)) between 3 and 2000)
);
create table public.maintenance_service_confirmations (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id) on delete cascade,
  work_order_id uuid not null references public.maintenance_work_orders(id) on delete cascade,
  confirmed_by uuid not null references public.users(id) on delete restrict,
  result public.maintenance_service_confirmation_result not null, notes text not null, confirmed_at timestamptz not null default now(),
  constraint maintenance_service_confirmation_notes check(length(btrim(notes)) between 3 and 2000)
);

create trigger maintenance_teams_updated_at before update on public.maintenance_teams for each row execute function public.set_updated_at();
create trigger maintenance_schedules_updated_at before update on public.maintenance_schedules for each row execute function public.set_updated_at();
create trigger maintenance_affected_rooms_updated_at before update on public.maintenance_occurrence_affected_rooms for each row execute function public.set_updated_at();
create trigger maintenance_recurrence_policies_updated_at before update on public.maintenance_recurrence_policies for each row execute function public.set_updated_at();
create trigger maintenance_lifecycle_decisions_updated_at before update on public.maintenance_lifecycle_decisions for each row execute function public.set_updated_at();

create function public.validate_maintenance_planning_scope() returns trigger language plpgsql set search_path=public as $$
declare v_hotel uuid;
begin
  if tg_table_name='maintenance_team_members' then select hotel_id into v_hotel from public.maintenance_teams where id=new.team_id;
  elsif tg_table_name='maintenance_team_availability' then select hotel_id into v_hotel from public.maintenance_teams where id=new.team_id;
  elsif tg_table_name='maintenance_schedules' then select hotel_id into v_hotel from public.maintenance_work_orders where id=new.work_order_id;
  elsif tg_table_name='maintenance_reschedule_requests' then select hotel_id into v_hotel from public.maintenance_work_orders where id=new.work_order_id;
  elsif tg_table_name='maintenance_waiting_episodes' then select hotel_id into v_hotel from public.maintenance_work_orders where id=new.work_order_id;
  elsif tg_table_name='maintenance_waiting_followups' then select hotel_id into v_hotel from public.maintenance_waiting_episodes where id=new.episode_id;
  elsif tg_table_name='maintenance_execution_sessions' then select hotel_id into v_hotel from public.maintenance_work_orders where id=new.work_order_id;
  elsif tg_table_name='maintenance_occurrence_affected_rooms' then select hotel_id into v_hotel from public.maintenance_occurrences where id=new.occurrence_id;
  elsif tg_table_name='maintenance_recurrence_members' then select hotel_id into v_hotel from public.maintenance_recurrence_groups where id=new.group_id;
  elsif tg_table_name='maintenance_lifecycle_options' then select hotel_id into v_hotel from public.maintenance_lifecycle_decisions where id=new.decision_id;
  elsif tg_table_name in ('maintenance_service_communications','maintenance_service_confirmations') then select hotel_id into v_hotel from public.maintenance_work_orders where id=new.work_order_id;
  end if;
  if v_hotel is null or v_hotel<>new.hotel_id then raise exception 'Referência fora do hotel.' using errcode='23514'; end if;
  return new;
end $$;
do $$ declare t text; begin foreach t in array array['maintenance_team_members','maintenance_team_availability','maintenance_schedules','maintenance_reschedule_requests','maintenance_waiting_episodes','maintenance_waiting_followups','maintenance_execution_sessions','maintenance_occurrence_affected_rooms','maintenance_recurrence_members','maintenance_lifecycle_options','maintenance_service_communications','maintenance_service_confirmations'] loop execute format('create trigger %I_scope before insert or update on public.%I for each row execute function public.validate_maintenance_planning_scope()',t,t); end loop; end $$;

create function public.create_default_maintenance_recurrence_policy(p_hotel_id uuid) returns void language sql set search_path=public as $$
  insert into public.maintenance_recurrence_policies(hotel_id,window_days,occurrence_threshold)
  values(p_hotel_id,90,3) on conflict do nothing;
$$;
select public.create_default_maintenance_recurrence_policy(id) from public.hotels;
create function public.provision_maintenance_recurrence_policy() returns trigger language plpgsql security definer set search_path=public as $$ begin perform public.create_default_maintenance_recurrence_policy(new.id); return new; end $$;
create trigger hotels_provision_maintenance_recurrence after insert on public.hotels for each row execute function public.provision_maintenance_recurrence_policy();

create function public.maintenance_schedule_conflicts(p_hotel_id uuid,p_work_order_id uuid,p_team_id uuid,p_technician_id uuid,p_start timestamptz,p_minutes integer,p_access public.maintenance_access_kind,p_exclude uuid default null)
returns jsonb language plpgsql stable set search_path=public as $$
declare v_end timestamptz:=p_start+make_interval(mins=>p_minutes); v_order record; v_timezone text; v_local timestamp; v_conflicts jsonb:='[]'::jsonb; v_capacity int; v_allocated int;
begin
  select w.id,w.occurrence_id,o.room_id into v_order from public.maintenance_work_orders w join public.maintenance_occurrences o on o.id=w.occurrence_id where w.id=p_work_order_id and w.hotel_id=p_hotel_id;
  if not found then return jsonb_build_object('result','not_found','conflicts',v_conflicts); end if;
  select timezone into v_timezone from public.hotels where id=p_hotel_id; v_local:=p_start at time zone v_timezone;
  if exists(select 1 from public.maintenance_availability_exceptions e where e.hotel_id=p_hotel_id and e.kind='unavailable' and (e.team_id=p_team_id or e.user_id=p_technician_id) and tstzrange(e.starts_at,e.ends_at,'[)')&&tstzrange(p_start,v_end,'[)')) then v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('kind','outside_availability','message','Há uma ausência ou indisponibilidade registrada nesse período.')); end if;
  if p_technician_id is not null and exists(select 1 from public.maintenance_schedules s where s.hotel_id=p_hotel_id and s.technician_id=p_technician_id and s.status<>'canceled' and s.id is distinct from p_exclude and tstzrange(s.planned_start,s.planned_end,'[)')&&tstzrange(p_start,v_end,'[)')) then v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('kind','technician_overlap','message','O técnico já possui atendimento nesse período.')); end if;
  if p_team_id is not null then
    select coalesce(max(capacity),0)+(select coalesce(sum(capacity_delta),0) from public.maintenance_availability_exceptions e where e.team_id=p_team_id and e.kind='additional_capacity' and tstzrange(e.starts_at,e.ends_at,'[)')&&tstzrange(p_start,v_end,'[)')) into v_capacity from public.maintenance_team_availability where team_id=p_team_id and weekday=extract(dow from v_local) and starts_at<=v_local::time and ends_at>=(v_end at time zone v_timezone)::time;
    if v_capacity=0 then v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('kind','outside_availability','message','O período está fora da disponibilidade da equipe.'));
    else select count(*) into v_allocated from public.maintenance_schedules s where s.team_id=p_team_id and s.status<>'canceled' and s.id is distinct from p_exclude and tstzrange(s.planned_start,s.planned_end,'[)')&&tstzrange(p_start,v_end,'[)'); if v_allocated>=v_capacity then v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('kind','team_capacity','message','A capacidade da equipe está esgotada.')); end if; end if;
  end if;
  if p_access='vacant_room' and v_order.room_id is not null and exists(select 1 from public.stays where room_id=v_order.room_id and stay_status='checked_in' and tstzrange(checkin_date_actual,checkout_date_expected,'[)')&&tstzrange(p_start,v_end,'[)')) then v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('kind','room_occupancy','message','O quarto estará ocupado na janela solicitada.')); end if;
  if v_order.room_id is not null and exists(select 1 from public.stays where room_id=v_order.room_id and stay_status='confirmed' and checkin_date_expected between p_start and v_end) then v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('kind','room_arrival','message','Há uma chegada prevista durante o atendimento.')); end if;
  if v_order.room_id is not null and exists(select 1 from public.room_blocks where room_id=v_order.room_id and released_at is null and daterange(start_date,end_date,'[]')&&daterange(p_start::date,v_end::date,'[]')) then v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('kind','room_block','message','Existe uma interdição ativa no período.')); end if;
  return jsonb_build_object('result','ok','valid',jsonb_array_length(v_conflicts)=0,'planned_end',v_end,'conflicts',v_conflicts);
end $$;

create function public.schedule_maintenance_work_order(p_hotel_id uuid,p_work_order_id uuid,p_actor_id uuid,p_input jsonb,p_allow_override boolean default false)
returns jsonb language plpgsql set search_path=public as $$
declare v_order public.maintenance_work_orders%rowtype; v_existing public.maintenance_schedules%rowtype; v_conflicts jsonb; v_id uuid; v_start timestamptz; v_minutes int; v_reason text;
begin
  select * into v_order from public.maintenance_work_orders where id=p_work_order_id and hotel_id=p_hotel_id for update;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if v_order.status in ('completed','canceled') then return jsonb_build_object('result','invalid_state'); end if;
  select * into v_existing from public.maintenance_schedules where work_order_id=p_work_order_id and status<>'canceled' for update;
  if v_existing.id is not null and coalesce((p_input->>'expected_version')::int,0)<>v_existing.version then return jsonb_build_object('result','conflict','context',public.maintenance_schedule_conflicts(p_hotel_id,p_work_order_id,(p_input->>'team_id')::uuid,(p_input->>'technician_id')::uuid,(p_input->>'planned_start')::timestamptz,(p_input->>'estimated_minutes')::int,(p_input->>'access_kind')::public.maintenance_access_kind,v_existing.id)); end if;
  v_start:=(p_input->>'planned_start')::timestamptz; v_minutes:=(p_input->>'estimated_minutes')::int;
  v_conflicts:=public.maintenance_schedule_conflicts(p_hotel_id,p_work_order_id,nullif(p_input->>'team_id','')::uuid,nullif(p_input->>'technician_id','')::uuid,v_start,v_minutes,(p_input->>'access_kind')::public.maintenance_access_kind,v_existing.id);
  v_reason:=nullif(btrim(p_input->>'override_reason'),'');
  if jsonb_array_length(v_conflicts->'conflicts')>0 and (not p_allow_override or not coalesce((p_input->>'override_conflicts')::boolean,false) or v_reason is null) then return jsonb_build_object('result','conflict','context',v_conflicts); end if;
  if v_existing.id is null then insert into public.maintenance_schedules(hotel_id,work_order_id,team_id,technician_id,planned_start,planned_end,estimated_minutes,access_kind,access_notes,override_reason,created_by) values(p_hotel_id,p_work_order_id,nullif(p_input->>'team_id','')::uuid,nullif(p_input->>'technician_id','')::uuid,v_start,v_start+make_interval(mins=>v_minutes),v_minutes,(p_input->>'access_kind')::public.maintenance_access_kind,nullif(btrim(p_input->>'access_notes'),''),v_reason,p_actor_id) returning id into v_id;
  else update public.maintenance_schedules set team_id=nullif(p_input->>'team_id','')::uuid,technician_id=nullif(p_input->>'technician_id','')::uuid,planned_start=v_start,planned_end=v_start+make_interval(mins=>v_minutes),estimated_minutes=v_minutes,access_kind=(p_input->>'access_kind')::public.maintenance_access_kind,access_notes=nullif(btrim(p_input->>'access_notes'),''),override_reason=v_reason,version=version+1 where id=v_existing.id returning id into v_id; end if;
  if nullif(p_input->>'technician_id','') is not null then update public.maintenance_work_orders set assigned_to=(p_input->>'technician_id')::uuid,status=case when status='pending' then 'assigned'::public.maintenance_work_order_status else status end,version=version+1 where id=p_work_order_id; end if;
  insert into public.maintenance_events(hotel_id,occurrence_id,work_order_id,actor_id,event_type,message,metadata) values(p_hotel_id,v_order.occurrence_id,p_work_order_id,p_actor_id,case when v_existing.id is null then 'schedule_created' else 'schedule_updated' end,v_reason,jsonb_build_object('schedule_id',v_id,'conflicts',v_conflicts->'conflicts'));
  return jsonb_build_object('result','ok','schedule_id',v_id);
exception when invalid_text_representation or check_violation or unique_violation then return jsonb_build_object('result','invalid');
end $$;

create function public.save_maintenance_team(p_hotel_id uuid,p_actor_id uuid,p_team_id uuid,p_input jsonb) returns jsonb language plpgsql set search_path=public as $$
declare v_id uuid; v_version int; v_item jsonb;
begin
  if p_team_id is null then insert into public.maintenance_teams(hotel_id,name,description,created_by) values(p_hotel_id,btrim(p_input->>'name'),nullif(btrim(p_input->>'description'),''),p_actor_id) returning id,version into v_id,v_version;
  else update public.maintenance_teams set name=btrim(p_input->>'name'),description=nullif(btrim(p_input->>'description'),''),version=version+1 where id=p_team_id and hotel_id=p_hotel_id and version=coalesce((p_input->>'expected_version')::int,version) returning id,version into v_id,v_version; if v_id is null then return jsonb_build_object('result','conflict'); end if; delete from public.maintenance_team_members where team_id=v_id; delete from public.maintenance_team_availability where team_id=v_id; end if;
  insert into public.maintenance_team_members(hotel_id,team_id,user_id,role,valid_from,valid_until) select p_hotel_id,v_id,(x->>'user_id')::uuid,btrim(x->>'role'),(x->>'valid_from')::date,nullif(x->>'valid_until','')::date from jsonb_array_elements(p_input->'members') x;
  insert into public.maintenance_team_availability(hotel_id,team_id,weekday,starts_at,ends_at,capacity) select p_hotel_id,v_id,(x->>'weekday')::smallint,(x->>'starts_at')::time,(x->>'ends_at')::time,(x->>'capacity')::smallint from jsonb_array_elements(p_input->'availability') x;
  return jsonb_build_object('result','ok','team_id',v_id,'version',v_version);
exception when check_violation or unique_violation or foreign_key_violation then return jsonb_build_object('result','invalid');
end $$;

create function public.create_maintenance_availability_exception(p_hotel_id uuid,p_actor_id uuid,p_input jsonb) returns jsonb language plpgsql set search_path=public as $$
declare v_id uuid; v_kind public.maintenance_availability_exception_kind:=(p_input->>'kind')::public.maintenance_availability_exception_kind;
begin
  if (nullif(p_input->>'team_id','') is null)=(nullif(p_input->>'user_id','') is null) then return jsonb_build_object('result','invalid'); end if;
  insert into public.maintenance_availability_exceptions(hotel_id,team_id,user_id,kind,starts_at,ends_at,capacity_delta,reason,created_by)
  values(p_hotel_id,nullif(p_input->>'team_id','')::uuid,nullif(p_input->>'user_id','')::uuid,v_kind,(p_input->>'starts_at')::timestamptz,(p_input->>'ends_at')::timestamptz,case when v_kind='additional_capacity' then coalesce((p_input->>'capacity_delta')::int,0) else 0 end,btrim(p_input->>'reason'),p_actor_id) returning id into v_id;
  return jsonb_build_object('result','ok','id',v_id);
exception when invalid_text_representation or check_violation or foreign_key_violation then return jsonb_build_object('result','invalid'); end $$;

create function public.update_maintenance_affected_rooms(p_hotel_id uuid,p_occurrence_id uuid,p_actor_id uuid,p_room_ids uuid[],p_reason text) returns jsonb language plpgsql set search_path=public as $$
begin
  if nullif(btrim(p_reason),'') is null or not exists(select 1 from public.maintenance_occurrences where id=p_occurrence_id and hotel_id=p_hotel_id) or exists(select 1 from unnest(p_room_ids) x left join public.rooms r on r.id=x and r.hotel_id=p_hotel_id where r.id is null) then return jsonb_build_object('result','invalid'); end if;
  delete from public.maintenance_occurrence_affected_rooms where occurrence_id=p_occurrence_id and source not in ('primary','block') and room_id<>all(p_room_ids);
  insert into public.maintenance_occurrence_affected_rooms(hotel_id,occurrence_id,room_id,source,reason,confirmed_by,impact_started_at) select p_hotel_id,p_occurrence_id,x,'confirmed',btrim(p_reason),p_actor_id,now() from unnest(p_room_ids) x on conflict(occurrence_id,room_id) do update set source='confirmed',reason=excluded.reason,confirmed_by=excluded.confirmed_by,impact_started_at=coalesce(maintenance_occurrence_affected_rooms.impact_started_at,now()),impact_ended_at=null;
  insert into public.maintenance_events(hotel_id,occurrence_id,actor_id,event_type,message,metadata) values(p_hotel_id,p_occurrence_id,p_actor_id,'affected_rooms_confirmed',btrim(p_reason),jsonb_build_object('room_ids',p_room_ids));
  return jsonb_build_object('result','ok');
end $$;

create function public.save_maintenance_recurrence_policy(p_hotel_id uuid,p_actor_id uuid,p_input jsonb) returns jsonb language plpgsql set search_path=public as $$
declare v public.maintenance_recurrence_policies%rowtype; v_category uuid:=nullif(p_input->>'category_id','')::uuid;
begin
  select * into v from public.maintenance_recurrence_policies where hotel_id=p_hotel_id and category_id is not distinct from v_category and is_active for update;
  if found then
    if v.version<>coalesce((p_input->>'expected_version')::int,v.version) then return jsonb_build_object('result','conflict','context',jsonb_build_object('version',v.version)); end if;
    update public.maintenance_recurrence_policies set window_days=(p_input->>'window_days')::int,occurrence_threshold=(p_input->>'occurrence_threshold')::int,created_by=coalesce(created_by,p_actor_id),version=version+1 where id=v.id;
  else
    insert into public.maintenance_recurrence_policies(hotel_id,category_id,window_days,occurrence_threshold,created_by) values(p_hotel_id,v_category,(p_input->>'window_days')::int,(p_input->>'occurrence_threshold')::int,p_actor_id) returning * into v;
  end if;
  perform public.refresh_maintenance_recurrence(p_hotel_id,now());
  return jsonb_build_object('result','ok');
exception when invalid_text_representation or check_violation or unique_violation or foreign_key_violation then return jsonb_build_object('result','invalid'); end $$;

create function public.act_maintenance_recurrence_group(p_hotel_id uuid,p_group_id uuid,p_actor_id uuid,p_input jsonb) returns jsonb language plpgsql set search_path=public as $$
declare v public.maintenance_recurrence_groups%rowtype; v_target uuid:=nullif(p_input->>'target_group_id','')::uuid; v_action text:=p_input->>'action'; v_occurrence uuid;
begin
  select * into v from public.maintenance_recurrence_groups where id=p_group_id and hotel_id=p_hotel_id for update;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if v.status<>'active' or nullif(btrim(p_input->>'reason'),'') is null then return jsonb_build_object('result','conflict'); end if;
  if v_action='merge' then
    if v_target is null or v_target=v.id or not exists(select 1 from public.maintenance_recurrence_groups where id=v_target and hotel_id=p_hotel_id and status='active') then return jsonb_build_object('result','invalid'); end if;
    insert into public.maintenance_recurrence_members(hotel_id,group_id,occurrence_id,linked_by,link_reason) select p_hotel_id,v_target,occurrence_id,p_actor_id,btrim(p_input->>'reason') from public.maintenance_recurrence_members where group_id=v.id on conflict do nothing;
    update public.maintenance_recurrence_groups g set occurrence_count=(select count(*) from public.maintenance_recurrence_members where group_id=v_target),first_occurrence_at=(select min(o.created_at) from public.maintenance_recurrence_members m join public.maintenance_occurrences o on o.id=m.occurrence_id where m.group_id=v_target),last_occurrence_at=(select max(o.created_at) from public.maintenance_recurrence_members m join public.maintenance_occurrences o on o.id=m.occurrence_id where m.group_id=v_target) where g.id=v_target;
    update public.maintenance_recurrence_groups set status='closed',review_reason=btrim(p_input->>'reason'),reviewed_by=p_actor_id,reviewed_at=now() where id=v.id;
  elsif v_action in ('false_positive','close') then
    update public.maintenance_recurrence_groups set status=case when v_action='false_positive' then 'false_positive' else 'closed' end,review_reason=btrim(p_input->>'reason'),reviewed_by=p_actor_id,reviewed_at=now() where id=v.id;
  else return jsonb_build_object('result','invalid'); end if;
  select occurrence_id into v_occurrence from public.maintenance_recurrence_members where group_id=v.id order by created_at limit 1;
  if v_occurrence is not null then insert into public.maintenance_events(hotel_id,occurrence_id,actor_id,event_type,message,metadata) values(p_hotel_id,v_occurrence,p_actor_id,'recurrence_'||v_action,btrim(p_input->>'reason'),jsonb_build_object('group_id',v.id,'target_group_id',v_target)); end if;
  return jsonb_build_object('result','ok');
end $$;

create function public.create_maintenance_lifecycle_decision(p_hotel_id uuid,p_occurrence_id uuid,p_actor_id uuid,p_input jsonb) returns jsonb language plpgsql set search_path=public as $$
declare v_id uuid; v_count int:=jsonb_array_length(p_input->'options'); v_location record; v_option jsonb;
begin
  if not exists(select 1 from public.maintenance_occurrences where id=p_occurrence_id and hotel_id=p_hotel_id) then return jsonb_build_object('result','not_found'); end if;
  if v_count<1 or (v_count=1 and nullif(btrim(p_input->>'single_option_reason'),'') is null) then return jsonb_build_object('result','invalid'); end if;
  select l.* into v_location from public.maintenance_occurrences o left join public.maintenance_locations l on l.id=o.location_id where o.id=p_occurrence_id;
  insert into public.maintenance_lifecycle_decisions(hotel_id,occurrence_id,recommendation,single_option_reason,proposed_by) values(p_hotel_id,p_occurrence_id,(p_input->>'recommendation')::public.maintenance_lifecycle_kind,nullif(btrim(p_input->>'single_option_reason'),''),p_actor_id) returning id into v_id;
  for v_option in select value from jsonb_array_elements(p_input->'options') loop
    insert into public.maintenance_lifecycle_options(hotel_id,decision_id,kind,estimated_cost,estimated_downtime_hours,supplier_id,contract_id,cost_item_id,warranty_eligible,warranty_snapshot,risks,benefits,justification) values(p_hotel_id,v_id,(v_option->>'kind')::public.maintenance_lifecycle_kind,(v_option->>'estimated_cost')::numeric,(v_option->>'estimated_downtime_hours')::int,nullif(v_option->>'supplier_id','')::uuid,nullif(v_option->>'contract_id','')::uuid,nullif(v_option->>'cost_item_id','')::uuid,(v_option->>'kind'='warranty' and v_location.warranty_ends_on>=current_date),jsonb_build_object('location_id',v_location.id,'warranty_ends_on',v_location.warranty_ends_on,'supplier_id',v_location.supplier_id,'contract_id',v_location.contract_id),btrim(v_option->>'risks'),btrim(v_option->>'benefits'),btrim(v_option->>'justification'));
  end loop;
  insert into public.maintenance_events(hotel_id,occurrence_id,actor_id,event_type,metadata) values(p_hotel_id,p_occurrence_id,p_actor_id,'lifecycle_draft_created',jsonb_build_object('decision_id',v_id));
  return jsonb_build_object('result','ok','decision_id',v_id);
exception when unique_violation or check_violation or foreign_key_violation then return jsonb_build_object('result','invalid');
end $$;

create function public.act_maintenance_lifecycle_decision(p_hotel_id uuid,p_decision_id uuid,p_actor_id uuid,p_input jsonb) returns jsonb language plpgsql set search_path=public as $$
declare v public.maintenance_lifecycle_decisions%rowtype; v_action text:=p_input->>'action'; v_next public.maintenance_lifecycle_status; v_selected uuid:=nullif(p_input->>'selected_option_id','')::uuid;
begin
  select * into v from public.maintenance_lifecycle_decisions where id=p_decision_id and hotel_id=p_hotel_id for update;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if v.version<>(p_input->>'expected_version')::int or nullif(btrim(p_input->>'reason'),'') is null then return jsonb_build_object('result','conflict'); end if;
  if v_action in ('approve','reject') and v.proposed_by=p_actor_id then return jsonb_build_object('result','conflict'); end if;
  if v_action='submit' and v.status='draft' then v_next:='submitted';
  elsif v_action='approve' and v.status='submitted' and v.proposed_by<>p_actor_id and exists(select 1 from public.maintenance_lifecycle_options where id=v_selected and decision_id=v.id) then v_next:='approved';
  elsif v_action='reject' and v.status='submitted' and v.proposed_by<>p_actor_id then v_next:='rejected';
  elsif v_action='execute' and v.status='approved' then v_next:='executed';
  elsif v_action='cancel' and v.status in ('draft','submitted','approved') then v_next:='canceled'; else return jsonb_build_object('result','invalid_state'); end if;
  update public.maintenance_lifecycle_decisions set status=v_next,submitted_at=case when v_action='submit' then now() else submitted_at end,approved_by=case when v_action in ('approve','reject') then p_actor_id else approved_by end,approved_at=case when v_action in ('approve','reject') then now() else approved_at end,selected_option_id=case when v_action='approve' then v_selected else selected_option_id end,decision_reason=btrim(p_input->>'reason'),executed_by=case when v_action='execute' then p_actor_id else executed_by end,executed_at=case when v_action='execute' then now() else executed_at end,replacement_location_id=case when v_action='execute' then nullif(p_input->>'replacement_location_id','')::uuid else replacement_location_id end,version=version+1 where id=v.id;
  if v_action='execute' and (select kind from public.maintenance_lifecycle_options where id=v.selected_option_id)='replace' and nullif(p_input->>'replacement_location_id','') is not null then update public.maintenance_locations set lifecycle_status='retired' where id=(select location_id from public.maintenance_occurrences where id=v.occurrence_id) and hotel_id=p_hotel_id; end if;
  insert into public.maintenance_events(hotel_id,occurrence_id,actor_id,event_type,message,metadata) values(p_hotel_id,v.occurrence_id,p_actor_id,'lifecycle_'||v_action,btrim(p_input->>'reason'),jsonb_build_object('decision_id',v.id,'status',v_next,'selected_option_id',v_selected));
  return jsonb_build_object('result','ok');
end $$;

create function public.record_maintenance_service_confirmation(p_hotel_id uuid,p_work_order_id uuid,p_actor_id uuid,p_result public.maintenance_service_confirmation_result,p_notes text) returns jsonb language plpgsql set search_path=public as $$
declare v_occ uuid;
begin select occurrence_id into v_occ from public.maintenance_work_orders where id=p_work_order_id and hotel_id=p_hotel_id; if v_occ is null then return jsonb_build_object('result','not_found'); end if;
  insert into public.maintenance_service_confirmations(hotel_id,work_order_id,confirmed_by,result,notes) values(p_hotel_id,p_work_order_id,p_actor_id,p_result,btrim(p_notes));
  insert into public.maintenance_events(hotel_id,occurrence_id,work_order_id,actor_id,event_type,message) values(p_hotel_id,v_occ,p_work_order_id,p_actor_id,'service_'||p_result::text,btrim(p_notes));
  return jsonb_build_object('result','ok');
end $$;

drop function public.transition_maintenance_work_order(uuid,uuid,uuid,text,uuid,public.maintenance_waiting_reason,text,text);
create function public.transition_maintenance_work_order(
  p_hotel_id uuid,p_work_order_id uuid,p_actor_id uuid,p_action text,p_assigned_to uuid default null,
  p_waiting_reason public.maintenance_waiting_reason default null,p_notes text default null,p_diagnosis text default null,
  p_waiting_owner_id uuid default null,p_next_follow_up_at timestamptz default null,p_supplier_id uuid default null,p_contract_id uuid default null
) returns uuid language plpgsql set search_path=public as $$
declare v_order public.maintenance_work_orders%rowtype; v_next public.maintenance_work_order_status;
begin
  p_notes:=nullif(btrim(p_notes),''); p_diagnosis:=nullif(btrim(p_diagnosis),'');
  if length(p_notes)>4000 or length(p_diagnosis)>4000 then raise exception 'Texto excede 4000 caracteres.' using errcode='23514'; end if;
  if p_action in ('pause','wait','complete','cancel','reopen') and p_notes is null then raise exception 'Informe o motivo ou serviço realizado.' using errcode='23514'; end if;
  if p_action='complete' and p_diagnosis is null then raise exception 'Informe o diagnóstico.' using errcode='23514'; end if;
  if p_action='wait' and (p_waiting_owner_id is null or p_next_follow_up_at is null or p_next_follow_up_at<=now()) then raise exception 'Informe responsável e próxima cobrança futura.' using errcode='23514'; end if;
  select * into v_order from public.maintenance_work_orders where id=p_work_order_id and hotel_id=p_hotel_id for update;
  if not found then return null; end if;
  if p_action='assign' and v_order.status in ('pending','assigned','paused','waiting','in_progress') then v_next:=case when p_assigned_to is null then 'pending' else 'assigned' end;
  elsif p_action='start' and v_order.status='assigned' then v_next:='in_progress';
  elsif p_action='pause' and v_order.status='in_progress' then v_next:='paused';
  elsif p_action='wait' and v_order.status='in_progress' and p_waiting_reason is not null then v_next:='waiting';
  elsif p_action='resume' and v_order.status in ('paused','waiting') then v_next:='in_progress';
  elsif p_action='complete' and v_order.status='in_progress' then
    if exists(select 1 from public.maintenance_work_order_checklist_items where work_order_id=p_work_order_id and is_required and completed_at is null) then raise exception 'Há itens obrigatórios do checklist pendentes.' using errcode='23514'; end if;
    v_next:=case when v_order.requires_inspection then 'awaiting_inspection' else 'completed' end;
  elsif p_action='cancel' and v_order.status in ('pending','assigned','in_progress','paused','waiting') then v_next:='canceled';
  elsif p_action='reopen' and v_order.status='completed' then v_next:=case when v_order.assigned_to is null then 'pending' else 'in_progress' end;
  else raise exception 'Transição de ordem de trabalho inválida.' using errcode='23514'; end if;
  update public.maintenance_work_orders set status=v_next,assigned_to=case when p_action='assign' then p_assigned_to else assigned_to end,
    waiting_reason=case when p_action='wait' then p_waiting_reason when p_action='resume' then null else waiting_reason end,
    waiting_notes=case when p_action='wait' then p_notes when p_action='resume' then null else waiting_notes end,
    diagnosis=case when p_action='complete' then p_diagnosis else diagnosis end,
    resolution_notes=case when p_action in ('complete','cancel') then p_notes else resolution_notes end,
    started_at=case when p_action='start' then coalesce(started_at,now()) else started_at end,
    completed_at=case when v_next='completed' then now() when p_action in ('complete','reopen') then null else completed_at end,version=version+1 where id=p_work_order_id;
  if p_action in ('start','resume','reopen') and not exists(select 1 from public.maintenance_execution_sessions where work_order_id=p_work_order_id and ended_at is null) then insert into public.maintenance_execution_sessions(hotel_id,work_order_id,technician_id) values(p_hotel_id,p_work_order_id,coalesce(v_order.assigned_to,p_actor_id)); end if;
  if p_action in ('pause','wait','complete','cancel') then update public.maintenance_execution_sessions set ended_at=now(),end_reason=p_action where work_order_id=p_work_order_id and ended_at is null; end if;
  if p_action='wait' then insert into public.maintenance_waiting_episodes(hotel_id,work_order_id,reason,description,owner_id,supplier_id,contract_id,next_follow_up_at) values(p_hotel_id,p_work_order_id,p_waiting_reason,p_notes,p_waiting_owner_id,p_supplier_id,p_contract_id,p_next_follow_up_at); end if;
  if p_action='resume' then update public.maintenance_waiting_episodes set resolved_at=now(),resolved_by=p_actor_id,version=version+1 where work_order_id=p_work_order_id and resolved_at is null; end if;
  update public.maintenance_schedules set status=case when p_action in ('start','resume') then 'in_progress'::public.maintenance_schedule_status when p_action='complete' then 'completed'::public.maintenance_schedule_status when p_action='cancel' then 'canceled'::public.maintenance_schedule_status else status end,version=version+1,canceled_by=case when p_action='cancel' then p_actor_id else canceled_by end,canceled_at=case when p_action='cancel' then now() else canceled_at end where work_order_id=p_work_order_id and status<>'canceled';
  insert into public.maintenance_events(hotel_id,occurrence_id,work_order_id,actor_id,event_type,message,metadata) values(p_hotel_id,v_order.occurrence_id,p_work_order_id,p_actor_id,'work_order_'||p_action,p_notes,jsonb_build_object('previous_status',v_order.status,'status',v_next,'assigned_to',p_assigned_to,'waiting_owner_id',p_waiting_owner_id,'next_follow_up_at',p_next_follow_up_at));
  perform public.recompute_maintenance_occurrence_status(v_order.occurrence_id); return v_order.occurrence_id;
end $$;

create function public.follow_up_maintenance_waiting(p_hotel_id uuid,p_work_order_id uuid,p_actor_id uuid,p_notes text,p_next timestamptz,p_expected_version integer) returns jsonb language plpgsql set search_path=public as $$
declare v public.maintenance_waiting_episodes%rowtype;
begin select * into v from public.maintenance_waiting_episodes where work_order_id=p_work_order_id and hotel_id=p_hotel_id and resolved_at is null for update;
  if not found then return jsonb_build_object('result','not_found'); end if; if v.owner_id<>p_actor_id then return jsonb_build_object('result','conflict','context',jsonb_build_object('owner_id',v.owner_id)); end if; if v.version<>p_expected_version then return jsonb_build_object('result','conflict','version',v.version); end if;
  if p_next<=now() or nullif(btrim(p_notes),'') is null then return jsonb_build_object('result','invalid'); end if;
  insert into public.maintenance_waiting_followups(hotel_id,episode_id,actor_id,notes,next_follow_up_at) values(p_hotel_id,v.id,p_actor_id,btrim(p_notes),p_next);
  update public.maintenance_waiting_episodes set next_follow_up_at=p_next,version=version+1 where id=v.id;
  insert into public.maintenance_events(hotel_id,occurrence_id,work_order_id,actor_id,event_type,message,metadata) select p_hotel_id,w.occurrence_id,w.id,p_actor_id,'waiting_follow_up',btrim(p_notes),jsonb_build_object('next_follow_up_at',p_next) from public.maintenance_work_orders w where w.id=p_work_order_id;
  return jsonb_build_object('result','ok'); end $$;

create function public.request_maintenance_reschedule(p_hotel_id uuid,p_work_order_id uuid,p_actor_id uuid,p_requested_start timestamptz,p_reason text) returns jsonb language plpgsql set search_path=public as $$
declare v_id uuid; v_occ uuid;
begin select occurrence_id into v_occ from public.maintenance_work_orders where id=p_work_order_id and hotel_id=p_hotel_id and assigned_to=p_actor_id and status not in ('completed','canceled'); if v_occ is null then return jsonb_build_object('result','not_found'); end if;
  insert into public.maintenance_reschedule_requests(hotel_id,work_order_id,requested_by,requested_start,reason) values(p_hotel_id,p_work_order_id,p_actor_id,p_requested_start,btrim(p_reason)) returning id into v_id;
  insert into public.maintenance_events(hotel_id,occurrence_id,work_order_id,actor_id,event_type,message,metadata) values(p_hotel_id,v_occ,p_work_order_id,p_actor_id,'reschedule_requested',btrim(p_reason),jsonb_build_object('request_id',v_id,'requested_start',p_requested_start)); return jsonb_build_object('result','ok','request_id',v_id);
exception when unique_violation or check_violation then return jsonb_build_object('result','conflict'); end $$;

create function public.decide_maintenance_reschedule(p_hotel_id uuid,p_request_id uuid,p_actor_id uuid,p_approved boolean,p_reason text) returns jsonb language plpgsql set search_path=public as $$
declare v public.maintenance_reschedule_requests%rowtype; v_occ uuid;
begin select * into v from public.maintenance_reschedule_requests where id=p_request_id and hotel_id=p_hotel_id for update; if not found then return jsonb_build_object('result','not_found'); end if; if v.status<>'pending' or nullif(btrim(p_reason),'') is null then return jsonb_build_object('result','conflict'); end if;
  update public.maintenance_reschedule_requests set status=case when p_approved then 'approved' else 'rejected' end,decided_by=p_actor_id,decision_reason=btrim(p_reason),decided_at=now() where id=v.id;
  select occurrence_id into v_occ from public.maintenance_work_orders where id=v.work_order_id; insert into public.maintenance_events(hotel_id,occurrence_id,work_order_id,actor_id,event_type,message,metadata) values(p_hotel_id,v_occ,v.work_order_id,p_actor_id,case when p_approved then 'reschedule_approved' else 'reschedule_rejected' end,btrim(p_reason),jsonb_build_object('request_id',v.id)); return jsonb_build_object('result','ok'); end $$;

create function public.refresh_maintenance_recurrence(p_hotel_id uuid,p_now timestamptz default now()) returns integer language plpgsql set search_path=public as $$
declare v record; v_policy record; v_group uuid; v_count int:=0; v_first timestamptz; v_last timestamptz;
begin
  for v in select o.category_id,o.room_id,o.location_id from public.maintenance_occurrences o where o.hotel_id=p_hotel_id and o.status<>'canceled' and o.duplicate_of_id is null group by o.category_id,o.room_id,o.location_id loop
    select * into v_policy from public.maintenance_recurrence_policies p where p.hotel_id=p_hotel_id and p.is_active and (p.category_id=v.category_id or p.category_id is null) order by p.category_id nulls last limit 1;
    select count(*),min(created_at),max(created_at) into v_count,v_first,v_last from public.maintenance_occurrences o where o.hotel_id=p_hotel_id and o.category_id=v.category_id and o.room_id is not distinct from v.room_id and o.location_id is not distinct from v.location_id and o.status<>'canceled' and o.duplicate_of_id is null and o.created_at>=p_now-make_interval(days=>coalesce(v_policy.window_days,90));
    if v_count>=coalesce(v_policy.occurrence_threshold,3) then
      select id into v_group from public.maintenance_recurrence_groups g where g.hotel_id=p_hotel_id and g.category_id=v.category_id and g.room_id is not distinct from v.room_id and g.location_id is not distinct from v.location_id and g.status='active' limit 1;
      if v_group is null then insert into public.maintenance_recurrence_groups(hotel_id,category_id,room_id,location_id,first_occurrence_at,last_occurrence_at,occurrence_count) values(p_hotel_id,v.category_id,v.room_id,v.location_id,v_first,v_last,v_count) returning id into v_group; else update public.maintenance_recurrence_groups set first_occurrence_at=v_first,last_occurrence_at=v_last,occurrence_count=v_count where id=v_group; end if;
      insert into public.maintenance_recurrence_members(hotel_id,group_id,occurrence_id) select p_hotel_id,v_group,o.id from public.maintenance_occurrences o where o.hotel_id=p_hotel_id and o.category_id=v.category_id and o.room_id is not distinct from v.room_id and o.location_id is not distinct from v.location_id and o.status<>'canceled' and o.duplicate_of_id is null and o.created_at>=p_now-make_interval(days=>coalesce(v_policy.window_days,90)) on conflict do nothing;
    end if;
  end loop; return (select count(*) from public.maintenance_recurrence_groups where hotel_id=p_hotel_id and status='active'); end $$;

create function public.refresh_maintenance_impact_scores(p_hotel_id uuid,p_now timestamptz default now()) returns integer language plpgsql set search_path=public as $$
declare v record; v_base int; v_guest boolean; v_arrival timestamptz; v_rooms int; v_block boolean; v_started timestamptz; v_recurrent boolean; v_score int; v_components jsonb;
begin
  update public.maintenance_occurrence_affected_rooms ar set impact_ended_at=coalesce(ar.impact_ended_at,p_now)
  from public.maintenance_occurrences o where o.id=ar.occurrence_id and o.hotel_id=p_hotel_id and o.status in ('resolved','canceled') and ar.impact_started_at is not null and ar.impact_ended_at is null;
  perform public.refresh_maintenance_recurrence(p_hotel_id,p_now);
  insert into public.maintenance_occurrence_affected_rooms(hotel_id,occurrence_id,room_id,source,reason,confirmed_by,impact_started_at)
    select o.hotel_id,o.id,o.room_id,'primary','Quarto principal da ocorrência.',o.reported_by,o.discovered_at from public.maintenance_occurrences o where o.hotel_id=p_hotel_id and o.room_id is not null on conflict do nothing;
  for v in select * from public.maintenance_occurrences where hotel_id=p_hotel_id and status not in ('resolved','canceled') loop
    v_base:=case v.priority when 'low' then 10 when 'normal' then 30 when 'high' then 55 else 80 end;
    select exists(select 1 from public.maintenance_occurrence_affected_rooms ar join public.stays s on s.room_id=ar.room_id where ar.occurrence_id=v.id and s.stay_status='checked_in'),
      (select min(s.checkin_date_expected) from public.maintenance_occurrence_affected_rooms ar join public.stays s on s.room_id=ar.room_id where ar.occurrence_id=v.id and s.stay_status='confirmed' and s.checkin_date_expected>=p_now-interval '1 day'),
      (select count(*) from public.maintenance_occurrence_affected_rooms where occurrence_id=v.id),
      exists(select 1 from public.room_blocks b where b.maintenance_occurrence_id=v.id and b.released_at is null),
      (select min(impact_started_at) from public.maintenance_occurrence_affected_rooms where occurrence_id=v.id and impact_ended_at is null),
      exists(select 1 from public.maintenance_recurrence_members m join public.maintenance_recurrence_groups g on g.id=m.group_id where m.occurrence_id=v.id and g.status='active')
      into v_guest,v_arrival,v_rooms,v_block,v_started,v_recurrent;
    v_score:=least(100,v_base+case when v_guest then 20 else 0 end+case when v_arrival is null then 0 when v_arrival<=p_now then 20 when v_arrival<=p_now+interval '24 hours' then 15 when v_arrival<=p_now+interval '72 hours' then 5 else 0 end+least(v_rooms*4,16)+case when v_block then 10 else 0 end+case when v_started is null then 0 when v_started<=p_now-interval '72 hours' then 15 when v_started<=p_now-interval '24 hours' then 8 else 0 end+case when v_recurrent then 8 else 0 end);
    v_components:=jsonb_build_array(jsonb_build_object('key','technical_priority','points',v_base),jsonb_build_object('key','guest_present','points',case when v_guest then 20 else 0 end),jsonb_build_object('key','next_arrival','points',case when v_arrival is null then 0 when v_arrival<=p_now then 20 when v_arrival<=p_now+interval '24 hours' then 15 when v_arrival<=p_now+interval '72 hours' then 5 else 0 end),jsonb_build_object('key','affected_rooms','points',least(v_rooms*4,16)),jsonb_build_object('key','active_block','points',case when v_block then 10 else 0 end),jsonb_build_object('key','impact_duration','points',case when v_started is null then 0 when v_started<=p_now-interval '72 hours' then 15 when v_started<=p_now-interval '24 hours' then 8 else 0 end),jsonb_build_object('key','recurrence','points',case when v_recurrent then 8 else 0 end));
    insert into public.maintenance_impact_scores(occurrence_id,hotel_id,score,recommended_priority,components,guest_present,next_arrival_at,affected_room_count,active_block,impact_started_at,recurrent,computed_at) values(v.id,p_hotel_id,v_score,(case when v_score>=80 then 'critical' when v_score>=55 then 'high' when v_score>=30 then 'normal' else 'low' end)::public.maintenance_priority,v_components,v_guest,v_arrival,v_rooms,v_block,v_started,v_recurrent,p_now) on conflict(occurrence_id) do update set score=excluded.score,recommended_priority=excluded.recommended_priority,components=excluded.components,guest_present=excluded.guest_present,next_arrival_at=excluded.next_arrival_at,affected_room_count=excluded.affected_room_count,active_block=excluded.active_block,impact_started_at=excluded.impact_started_at,recurrent=excluded.recurrent,computed_at=excluded.computed_at;
  end loop; return (select count(*) from public.maintenance_impact_scores where hotel_id=p_hotel_id); end $$;

create function public.list_maintenance_planning_board(p_hotel_id uuid,p_from timestamptz default now()-interval '1 day',p_to timestamptz default now()+interval '14 days') returns jsonb language plpgsql set search_path=public as $$
begin return jsonb_build_object('generated_at',now(),
  'teams',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'description',t.description,'is_active',t.is_active,'version',t.version,'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'user_id',m.user_id,'user_name',u.name,'role',m.role,'valid_from',m.valid_from,'valid_until',m.valid_until)) from public.maintenance_team_members m join public.users u on u.id=m.user_id where m.team_id=t.id),'[]'::jsonb),'availability',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'weekday',a.weekday,'starts_at',a.starts_at,'ends_at',a.ends_at,'capacity',a.capacity) order by a.weekday,a.starts_at) from public.maintenance_team_availability a where a.team_id=t.id),'[]'::jsonb)) order by t.name) from public.maintenance_teams t where t.hotel_id=p_hotel_id and t.is_active),'[]'::jsonb),
  'schedules',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'work_order_id',w.id,'occurrence_id',o.id,'occurrence_code','MAN-'||lpad(o.occurrence_number::text,6,'0'),'title',w.title,'room_number',r.room_number,'team_id',s.team_id,'team_name',t.name,'technician_id',s.technician_id,'technician_name',u.name,'planned_start',s.planned_start,'planned_end',s.planned_end,'estimated_minutes',s.estimated_minutes,'status',s.status,'access_kind',s.access_kind,'access_notes',s.access_notes,'version',s.version,'impact_score',coalesce(sc.score,0),'recommended_priority',coalesce(sc.recommended_priority,o.priority),'next_arrival_at',sc.next_arrival_at) order by s.planned_start) from public.maintenance_schedules s join public.maintenance_work_orders w on w.id=s.work_order_id join public.maintenance_occurrences o on o.id=w.occurrence_id left join public.rooms r on r.id=o.room_id left join public.maintenance_teams t on t.id=s.team_id left join public.users u on u.id=s.technician_id left join public.maintenance_impact_scores sc on sc.occurrence_id=o.id where s.hotel_id=p_hotel_id and s.status<>'canceled' and s.planned_end>=p_from and s.planned_start<=p_to),'[]'::jsonb),
  'backlog',coalesce((select jsonb_agg(jsonb_build_object('work_order_id',w.id,'occurrence_id',o.id,'occurrence_code','MAN-'||lpad(o.occurrence_number::text,6,'0'),'title',w.title,'priority',o.priority,'impact_score',coalesce(sc.score,0),'recommended_priority',coalesce(sc.recommended_priority,o.priority),'room_number',r.room_number,'due_at',w.due_at) order by coalesce(sc.score,0) desc,sc.next_arrival_at nulls last,o.created_at) from public.maintenance_work_orders w join public.maintenance_occurrences o on o.id=w.occurrence_id left join public.rooms r on r.id=o.room_id left join public.maintenance_impact_scores sc on sc.occurrence_id=o.id where w.hotel_id=p_hotel_id and w.status not in ('completed','canceled') and not exists(select 1 from public.maintenance_schedules s where s.work_order_id=w.id and s.status<>'canceled')),'[]'::jsonb),
  'reschedule_requests',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'work_order_id',q.work_order_id,'occurrence_code','MAN-'||lpad(o.occurrence_number::text,6,'0'),'title',w.title,'requester_name',u.name,'requested_start',q.requested_start,'reason',q.reason,'created_at',q.created_at) order by q.created_at) from public.maintenance_reschedule_requests q join public.maintenance_work_orders w on w.id=q.work_order_id join public.maintenance_occurrences o on o.id=w.occurrence_id join public.users u on u.id=q.requested_by where q.hotel_id=p_hotel_id and q.status='pending'),'[]'::jsonb),
  'users',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'name',u.name) order by u.name) from public.users u where u.is_active and public.maintenance_user_has_hotel_scope(u.id,p_hotel_id)),'[]'::jsonb),
  'summary',jsonb_build_object('scheduled',(select count(*) from public.maintenance_schedules where hotel_id=p_hotel_id and status<>'canceled'),'backlog',(select count(*) from public.maintenance_work_orders w where w.hotel_id=p_hotel_id and w.status not in ('completed','canceled') and not exists(select 1 from public.maintenance_schedules s where s.work_order_id=w.id and s.status<>'canceled')),'conflicts',0,'capacity_minutes',coalesce((select sum(extract(epoch from (ends_at-starts_at))/60*capacity) from public.maintenance_team_availability a join public.maintenance_teams t on t.id=a.team_id where t.hotel_id=p_hotel_id and t.is_active),0),'allocated_minutes',coalesce((select sum(estimated_minutes) from public.maintenance_schedules where hotel_id=p_hotel_id and status<>'canceled'),0)));
end $$;

select public.refresh_maintenance_impact_scores(id,now()) from public.hotels;
alter function public.process_maintenance_management_cycle(timestamptz,uuid,boolean) rename to process_maintenance_management_cycle_stage2;
create function public.process_maintenance_management_cycle(p_now timestamptz default now(),p_hotel_id uuid default null,p_force boolean default false) returns jsonb language plpgsql set search_path=public as $$
declare v_result jsonb; v_hotel uuid;
begin
  v_result:=public.process_maintenance_management_cycle_stage2(p_now,p_hotel_id,p_force);
  for v_hotel in select id from public.hotels where p_hotel_id is null or id=p_hotel_id loop perform public.refresh_maintenance_impact_scores(v_hotel,p_now); end loop;
  return v_result;
end $$;

insert into public.permissions(name,type) select name,'HOTEL_PERMISSION' from unnest(array['manage_maintenance_teams','manage_maintenance_schedule','override_maintenance_schedule_conflicts','propose_maintenance_lifecycle','approve_maintenance_lifecycle','confirm_maintenance_service']) name on conflict(name) do nothing;

do $$ declare t text; begin foreach t in array array['maintenance_teams','maintenance_team_members','maintenance_team_availability','maintenance_availability_exceptions','maintenance_schedules','maintenance_reschedule_requests','maintenance_waiting_episodes','maintenance_waiting_followups','maintenance_execution_sessions','maintenance_occurrence_affected_rooms','maintenance_impact_scores','maintenance_recurrence_policies','maintenance_recurrence_groups','maintenance_recurrence_members','maintenance_lifecycle_decisions','maintenance_lifecycle_options','maintenance_service_communications','maintenance_service_confirmations'] loop execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from anon,authenticated',t); execute format('grant all on public.%I to service_role',t); end loop; end $$;
grant usage on type public.maintenance_schedule_status,public.maintenance_access_kind,public.maintenance_availability_exception_kind,public.maintenance_reschedule_status,public.maintenance_lifecycle_kind,public.maintenance_lifecycle_status,public.maintenance_service_confirmation_result to service_role;
revoke all on function public.validate_maintenance_planning_scope(),public.provision_maintenance_recurrence_policy() from public,anon,authenticated;
revoke all on function public.create_default_maintenance_recurrence_policy(uuid),public.maintenance_schedule_conflicts(uuid,uuid,uuid,uuid,timestamptz,integer,public.maintenance_access_kind,uuid),public.schedule_maintenance_work_order(uuid,uuid,uuid,jsonb,boolean),public.save_maintenance_team(uuid,uuid,uuid,jsonb),public.create_maintenance_availability_exception(uuid,uuid,jsonb),public.update_maintenance_affected_rooms(uuid,uuid,uuid,uuid[],text),public.save_maintenance_recurrence_policy(uuid,uuid,jsonb),public.act_maintenance_recurrence_group(uuid,uuid,uuid,jsonb),public.create_maintenance_lifecycle_decision(uuid,uuid,uuid,jsonb),public.act_maintenance_lifecycle_decision(uuid,uuid,uuid,jsonb),public.record_maintenance_service_confirmation(uuid,uuid,uuid,public.maintenance_service_confirmation_result,text) from public,anon,authenticated;
grant execute on function public.create_default_maintenance_recurrence_policy(uuid),public.maintenance_schedule_conflicts(uuid,uuid,uuid,uuid,timestamptz,integer,public.maintenance_access_kind,uuid),public.schedule_maintenance_work_order(uuid,uuid,uuid,jsonb,boolean),public.save_maintenance_team(uuid,uuid,uuid,jsonb),public.create_maintenance_availability_exception(uuid,uuid,jsonb),public.update_maintenance_affected_rooms(uuid,uuid,uuid,uuid[],text),public.save_maintenance_recurrence_policy(uuid,uuid,jsonb),public.act_maintenance_recurrence_group(uuid,uuid,uuid,jsonb),public.create_maintenance_lifecycle_decision(uuid,uuid,uuid,jsonb),public.act_maintenance_lifecycle_decision(uuid,uuid,uuid,jsonb),public.record_maintenance_service_confirmation(uuid,uuid,uuid,public.maintenance_service_confirmation_result,text) to service_role;
grant execute on function public.transition_maintenance_work_order(uuid,uuid,uuid,text,uuid,public.maintenance_waiting_reason,text,text,uuid,timestamptz,uuid,uuid),public.follow_up_maintenance_waiting(uuid,uuid,uuid,text,timestamptz,integer),public.request_maintenance_reschedule(uuid,uuid,uuid,timestamptz,text),public.decide_maintenance_reschedule(uuid,uuid,uuid,boolean,text),public.refresh_maintenance_recurrence(uuid,timestamptz),public.refresh_maintenance_impact_scores(uuid,timestamptz),public.list_maintenance_planning_board(uuid,timestamptz,timestamptz),public.process_maintenance_management_cycle_stage2(timestamptz,uuid,boolean),public.process_maintenance_management_cycle(timestamptz,uuid,boolean) to service_role;

comment on table public.maintenance_schedules is 'Agenda versionada de ordens; conflitos são revalidados transacionalmente.';
comment on table public.maintenance_waiting_episodes is 'Episódios de espera com responsável interno e próxima cobrança.';
comment on table public.maintenance_impact_scores is 'Projeção explicável de prioridade operacional; não substitui a prioridade técnica.';
comment on table public.maintenance_lifecycle_decisions is 'Decisão operacional segregada da aprovação financeira entre reparar, substituir ou garantia.';

-- A etapa 3 amplia a fonte persistente de pendências sem alterar os candidatos
-- das etapas anteriores. Cada condição usa uma chave estável e é encerrada pela
-- reconciliação quando a entidade de origem deixa de atender ao critério.
alter function public.operational_pending_candidates(uuid,timestamptz)
  rename to operational_pending_candidates_stage2;
create function public.operational_pending_candidates(p_hotel_id uuid,p_now timestamptz default now())
returns jsonb language plpgsql set search_path=public as $$
declare v_result jsonb; v record;
begin
  v_result:=public.operational_pending_candidates_stage2(p_hotel_id,p_now);
  for v in select e.id,e.work_order_id,e.owner_id,e.next_follow_up_at,o.id occurrence_id,o.occurrence_number
    from public.maintenance_waiting_episodes e join public.maintenance_work_orders w on w.id=e.work_order_id join public.maintenance_occurrences o on o.id=w.occurrence_id
    where e.hotel_id=p_hotel_id and e.resolved_at is null and e.next_follow_up_at<=p_now
  loop v_result:=v_result||jsonb_build_array(jsonb_build_object('source','maintenance','source_key','maintenance:waiting:'||v.id,'kind','maintenance_waiting_overdue','entity_type','work_order','entity_id',v.work_order_id,'title','Espera vencida na MAN-'||lpad(v.occurrence_number::text,6,'0'),'href','/dashboard/maintenance/occurrences/'||v.occurrence_id,'severity','warning','due_on',v.next_follow_up_at::date)); end loop;
  for v in select w.id work_order_id,o.id occurrence_id,o.occurrence_number from public.maintenance_work_orders w join public.maintenance_occurrences o on o.id=w.occurrence_id join public.maintenance_impact_scores s on s.occurrence_id=o.id
    where w.hotel_id=p_hotel_id and w.status not in ('completed','canceled') and s.recommended_priority='critical' and not exists(select 1 from public.maintenance_schedules x where x.work_order_id=w.id and x.status<>'canceled')
  loop v_result:=v_result||jsonb_build_array(jsonb_build_object('source','maintenance','source_key','maintenance:critical-unscheduled:'||v.work_order_id,'kind','maintenance_critical_unscheduled','entity_type','work_order','entity_id',v.work_order_id,'title','Ordem crítica sem agendamento: MAN-'||lpad(v.occurrence_number::text,6,'0'),'href','/dashboard/maintenance/agenda','severity','critical')); end loop;
  for v in select q.id,q.work_order_id,w.occurrence_id,o.occurrence_number from public.maintenance_reschedule_requests q join public.maintenance_work_orders w on w.id=q.work_order_id join public.maintenance_occurrences o on o.id=w.occurrence_id where q.hotel_id=p_hotel_id and q.status='pending'
  loop v_result:=v_result||jsonb_build_array(jsonb_build_object('source','maintenance','source_key','maintenance:reschedule:'||v.id,'kind','maintenance_reschedule','entity_type','reschedule_request','entity_id',v.id,'title','Reagendamento solicitado na MAN-'||lpad(v.occurrence_number::text,6,'0'),'href','/dashboard/maintenance/agenda','severity','warning')); end loop;
  for v in select d.id,d.occurrence_id,o.occurrence_number from public.maintenance_lifecycle_decisions d join public.maintenance_occurrences o on o.id=d.occurrence_id where d.hotel_id=p_hotel_id and d.status='submitted'
  loop v_result:=v_result||jsonb_build_array(jsonb_build_object('source','maintenance','source_key','maintenance:lifecycle:'||v.id,'kind','maintenance_lifecycle_approval','entity_type','lifecycle_decision','entity_id',v.id,'title','Decisão de ciclo de vida aguarda aprovação: MAN-'||lpad(v.occurrence_number::text,6,'0'),'href','/dashboard/maintenance/occurrences/'||v.occurrence_id,'severity','warning')); end loop;
  for v in select g.id,m.occurrence_id first_occurrence_id,o.occurrence_number from public.maintenance_recurrence_groups g join lateral (select occurrence_id from public.maintenance_recurrence_members where group_id=g.id order by created_at limit 1) m on true join public.maintenance_occurrences o on o.id=m.occurrence_id where g.hotel_id=p_hotel_id and g.status='active'
  loop v_result:=v_result||jsonb_build_array(jsonb_build_object('source','maintenance','source_key','maintenance:recurrence:'||v.id,'kind','maintenance_recurrence_review','entity_type','recurrence_group','entity_id',v.id,'title','Reincidência aguarda análise: MAN-'||lpad(v.occurrence_number::text,6,'0'),'href','/dashboard/maintenance/occurrences/'||v.first_occurrence_id,'severity','warning')); end loop;
  for v in select s.id,s.work_order_id,w.occurrence_id,o.occurrence_number from public.maintenance_schedules s join public.maintenance_work_orders w on w.id=s.work_order_id join public.maintenance_occurrences o on o.id=w.occurrence_id where s.hotel_id=p_hotel_id and s.status in ('planned','in_progress') and s.planned_end<=p_now and not exists(select 1 from public.maintenance_service_confirmations c where c.work_order_id=s.work_order_id)
  loop v_result:=v_result||jsonb_build_array(jsonb_build_object('source','maintenance','source_key','maintenance:confirmation:'||v.id,'kind','maintenance_service_confirmation','entity_type','work_order','entity_id',v.work_order_id,'title','Atendimento aguarda confirmação: MAN-'||lpad(v.occurrence_number::text,6,'0'),'href','/dashboard/maintenance/occurrences/'||v.occurrence_id,'severity','info','due_on',v.planned_end::date)); end loop;
  return v_result;
end $$;

create or replace function public.can_read_operational_pending(p public.operational_pending,p_user_id uuid,p_permissions text[])
returns boolean language sql stable set search_path=public as $$
  select public.maintenance_user_has_hotel_scope(p_user_id,p.hotel_id) and case
    when p.source='governance' then p_permissions && array['read_governance','execute_governance','inspect_governance','assign_governance']
    when p.source='maintenance' and p.kind='maintenance_waiting_overdue' then p_permissions && array['execute_maintenance','manage_maintenance_schedule','read_maintenance_analytics']
    when p.source='maintenance' and p.kind in ('maintenance_critical_unscheduled','maintenance_reschedule') then p_permissions && array['manage_maintenance_schedule','read_maintenance_analytics']
    when p.source='maintenance' and p.kind='maintenance_service_confirmation' then p_permissions && array['confirm_maintenance_service','manage_maintenance_schedule']
    when p.source='maintenance' and p.kind='maintenance_recurrence_review' then p_permissions && array['read_maintenance','triage_maintenance','read_maintenance_analytics']
    when p.source='maintenance' and p.kind='maintenance_lifecycle_approval' then 'approve_maintenance_lifecycle'=any(p_permissions)
    when p.source='maintenance' then exists(select 1 from public.maintenance_notifications n where n.hotel_id=p.hotel_id and n.recipient_id=p_user_id and n.kind=p.kind and n.entity_id=p.entity_id)
      and p_permissions && array['read_maintenance','execute_maintenance','triage_maintenance','manage_maintenance_plans','manage_maintenance_sla','read_maintenance_analytics','manage_maintenance_suppliers']
    when p.kind='guest_balance' then p_permissions && array['read_consumption_analytics','access_reservations_calendar']
    when p.kind='critical_stock' then p_permissions && array['read_consumption_analytics','read_inventory']
    when p.kind='agreement_expiry' then p_permissions && array['read_consumption_analytics','read_commercial_partners']
    when p.kind='pending_settlement' then p_permissions && array['read_partner_settlements','prepare_partner_settlements','approve_partner_settlements','settle_partner_settlements']
    else false end;
$$;

revoke all on function public.operational_pending_candidates_stage2(uuid,timestamptz),public.operational_pending_candidates(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.operational_pending_candidates_stage2(uuid,timestamptz),public.operational_pending_candidates(uuid,timestamptz) to service_role;
