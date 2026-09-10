-- Completa a disponibilidade individual, os conflitos de governança e o
-- acompanhamento de garantia da etapa 3 sem reescrever a migration original.

alter table public.maintenance_team_availability
  add column user_id uuid references public.users(id) on delete cascade;

alter table public.maintenance_team_availability
  drop constraint maintenance_team_availability_key;

create unique index maintenance_team_availability_team_key
  on public.maintenance_team_availability(team_id,weekday,starts_at,ends_at)
  where user_id is null;

create unique index maintenance_team_availability_member_key
  on public.maintenance_team_availability(team_id,user_id,weekday,starts_at,ends_at)
  where user_id is not null;

create or replace function public.maintenance_schedule_conflicts(
  p_hotel_id uuid,
  p_work_order_id uuid,
  p_team_id uuid,
  p_technician_id uuid,
  p_start timestamptz,
  p_minutes integer,
  p_access public.maintenance_access_kind,
  p_exclude uuid default null
) returns jsonb language plpgsql stable set search_path=public as $$
declare
  v_end timestamptz:=p_start+make_interval(mins=>p_minutes);
  v_order record;
  v_timezone text;
  v_local timestamp;
  v_conflicts jsonb:='[]'::jsonb;
  v_capacity int;
  v_allocated int;
begin
  select w.id,w.occurrence_id,o.room_id into v_order
    from public.maintenance_work_orders w
    join public.maintenance_occurrences o on o.id=w.occurrence_id
   where w.id=p_work_order_id and w.hotel_id=p_hotel_id;
  if not found then
    return jsonb_build_object('result','not_found','conflicts',v_conflicts);
  end if;

  select timezone into v_timezone from public.hotels where id=p_hotel_id;
  v_local:=p_start at time zone v_timezone;

  if exists(
    select 1 from public.maintenance_availability_exceptions e
     where e.hotel_id=p_hotel_id and e.kind='unavailable'
       and (e.team_id=p_team_id or e.user_id=p_technician_id)
       and tstzrange(e.starts_at,e.ends_at,'[)')&&tstzrange(p_start,v_end,'[)')
  ) then
    v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object(
      'kind','outside_availability',
      'message','Há uma ausência ou indisponibilidade registrada nesse período.'
    ));
  end if;

  if p_technician_id is not null and exists(
    select 1 from public.maintenance_schedules s
     where s.hotel_id=p_hotel_id and s.technician_id=p_technician_id
       and s.status<>'canceled' and s.id is distinct from p_exclude
       and tstzrange(s.planned_start,s.planned_end,'[)')&&tstzrange(p_start,v_end,'[)')
  ) then
    v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object(
      'kind','technician_overlap','message','O técnico já possui atendimento nesse período.'
    ));
  end if;

  if p_technician_id is not null and exists(
    select 1 from public.maintenance_team_availability a
     where a.team_id=p_team_id and a.user_id=p_technician_id
  ) and not exists(
    select 1 from public.maintenance_team_availability a
     where a.team_id=p_team_id and a.user_id=p_technician_id
       and a.weekday=extract(dow from v_local)
       and a.starts_at<=v_local::time
       and a.ends_at>=(v_end at time zone v_timezone)::time
  ) then
    v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object(
      'kind','outside_member_availability',
      'message','O período está fora da disponibilidade semanal do técnico.'
    ));
  end if;

  if p_team_id is not null then
    select coalesce(max(capacity),0)+(
      select coalesce(sum(capacity_delta),0)
        from public.maintenance_availability_exceptions e
       where e.team_id=p_team_id and e.kind='additional_capacity'
         and tstzrange(e.starts_at,e.ends_at,'[)')&&tstzrange(p_start,v_end,'[)')
    ) into v_capacity
      from public.maintenance_team_availability
     where team_id=p_team_id and user_id is null
       and weekday=extract(dow from v_local)
       and starts_at<=v_local::time
       and ends_at>=(v_end at time zone v_timezone)::time;
    if v_capacity=0 then
      v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object(
        'kind','outside_availability','message','O período está fora da disponibilidade da equipe.'
      ));
    else
      select count(*) into v_allocated from public.maintenance_schedules s
       where s.team_id=p_team_id and s.status<>'canceled'
         and s.id is distinct from p_exclude
         and tstzrange(s.planned_start,s.planned_end,'[)')&&tstzrange(p_start,v_end,'[)');
      if v_allocated>=v_capacity then
        v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object(
          'kind','team_capacity','message','A capacidade da equipe está esgotada.'
        ));
      end if;
    end if;
  end if;

  if p_access='vacant_room' and v_order.room_id is not null and exists(
    select 1 from public.stays
     where room_id=v_order.room_id and stay_status='checked_in'
       and tstzrange(checkin_date_actual,checkout_date_expected,'[)')&&tstzrange(p_start,v_end,'[)')
  ) then
    v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object(
      'kind','room_occupancy','message','O quarto estará ocupado na janela solicitada.'
    ));
  end if;

  if v_order.room_id is not null and exists(
    select 1 from public.stays
     where room_id=v_order.room_id and stay_status='confirmed'
       and checkin_date_expected between p_start and v_end
  ) then
    v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object(
      'kind','room_arrival','message','Há uma chegada prevista durante o atendimento.'
    ));
  end if;

  if v_order.room_id is not null and exists(
    select 1 from public.governance_cycles
     where hotel_id=p_hotel_id and room_id=v_order.room_id
       and status in ('departure_review','cleaning_pending','cleaning_in_progress','inspection_pending')
  ) then
    v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object(
      'kind','room_governance','message','O quarto possui um giro de governança em andamento.'
    ));
  end if;

  if v_order.room_id is not null and exists(
    select 1 from public.room_blocks
     where room_id=v_order.room_id and released_at is null
       and daterange(start_date,end_date,'[]')&&daterange(p_start::date,v_end::date,'[]')
  ) then
    v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object(
      'kind','room_block','message','Existe uma interdição ativa no período.'
    ));
  end if;

  return jsonb_build_object(
    'result','ok','valid',jsonb_array_length(v_conflicts)=0,
    'planned_end',v_end,'conflicts',v_conflicts
  );
end $$;

create or replace function public.save_maintenance_team(
  p_hotel_id uuid,p_actor_id uuid,p_team_id uuid,p_input jsonb
) returns jsonb language plpgsql set search_path=public as $$
declare v_id uuid; v_version int;
begin
  if p_team_id is null then
    insert into public.maintenance_teams(hotel_id,name,description,created_by)
    values(p_hotel_id,btrim(p_input->>'name'),nullif(btrim(p_input->>'description'),''),p_actor_id)
    returning id,version into v_id,v_version;
  else
    update public.maintenance_teams
       set name=btrim(p_input->>'name'),description=nullif(btrim(p_input->>'description'),''),version=version+1
     where id=p_team_id and hotel_id=p_hotel_id
       and version=coalesce((p_input->>'expected_version')::int,version)
    returning id,version into v_id,v_version;
    if v_id is null then return jsonb_build_object('result','conflict'); end if;
    delete from public.maintenance_team_members where team_id=v_id;
    delete from public.maintenance_team_availability where team_id=v_id;
  end if;

  insert into public.maintenance_team_members(hotel_id,team_id,user_id,role,valid_from,valid_until)
  select p_hotel_id,v_id,(x->>'user_id')::uuid,btrim(x->>'role'),
         (x->>'valid_from')::date,nullif(x->>'valid_until','')::date
    from jsonb_array_elements(p_input->'members') x;

  insert into public.maintenance_team_availability(
    hotel_id,team_id,user_id,weekday,starts_at,ends_at,capacity
  )
  select p_hotel_id,v_id,nullif(x->>'user_id','')::uuid,
         (x->>'weekday')::smallint,(x->>'starts_at')::time,
         (x->>'ends_at')::time,(x->>'capacity')::smallint
    from jsonb_array_elements(p_input->'availability') x;

  if exists(
    select 1 from public.maintenance_team_availability a
     where a.team_id=v_id and a.user_id is not null
       and not exists(
         select 1 from public.maintenance_team_members m
          where m.team_id=v_id and m.user_id=a.user_id
       )
  ) then
    raise check_violation using message='Disponibilidade individual exige membro vigente da equipe.';
  end if;

  return jsonb_build_object('result','ok','team_id',v_id,'version',v_version);
exception when check_violation or unique_violation or foreign_key_violation then
  return jsonb_build_object('result','invalid');
end $$;

create or replace function public.list_maintenance_planning_board(
  p_hotel_id uuid,
  p_from timestamptz default now()-interval '1 day',
  p_to timestamptz default now()+interval '14 days'
)
returns jsonb language sql stable set search_path=public as $$
select jsonb_build_object(
  'generated_at',now(),
  'teams',coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',t.id,'name',t.name,'description',t.description,'is_active',t.is_active,'version',t.version,
      'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'user_id',m.user_id,'user_name',u.name,'role',m.role,'valid_from',m.valid_from,'valid_until',m.valid_until)) from public.maintenance_team_members m join public.users u on u.id=m.user_id where m.team_id=t.id),'[]'::jsonb),
      'availability',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'user_id',a.user_id,'weekday',a.weekday,'starts_at',a.starts_at,'ends_at',a.ends_at,'capacity',a.capacity) order by a.weekday,a.starts_at) from public.maintenance_team_availability a where a.team_id=t.id),'[]'::jsonb),
      'exceptions',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'user_id',e.user_id,'kind',e.kind,'starts_at',e.starts_at,'ends_at',e.ends_at,'capacity_delta',e.capacity_delta,'reason',e.reason)) from public.maintenance_availability_exceptions e where e.team_id=t.id or e.user_id in (select user_id from public.maintenance_team_members where team_id=t.id)),'[]'::jsonb)
    ) order by t.name) from public.maintenance_teams t where t.hotel_id=p_hotel_id and t.is_active
  ),'[]'::jsonb),
  'schedules',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'work_order_id',s.work_order_id,'occurrence_id',o.id,'occurrence_code','MAN-'||lpad(o.occurrence_number::text,6,'0'),'title',w.title,'room_number',r.room_number,'team_id',s.team_id,'team_name',t.name,'technician_id',s.technician_id,'technician_name',u.name,'planned_start',s.planned_start,'planned_end',s.planned_end,'estimated_minutes',s.estimated_minutes,'status',s.status,'access_kind',s.access_kind,'access_notes',s.access_notes,'version',s.version,'impact_score',coalesce(i.score,0),'recommended_priority',coalesce(i.recommended_priority,o.priority),'next_arrival_at',i.next_arrival_at) order by s.planned_start) from public.maintenance_schedules s join public.maintenance_work_orders w on w.id=s.work_order_id join public.maintenance_occurrences o on o.id=w.occurrence_id left join public.rooms r on r.id=o.room_id left join public.maintenance_teams t on t.id=s.team_id left join public.users u on u.id=s.technician_id left join public.maintenance_impact_scores i on i.occurrence_id=o.id where s.hotel_id=p_hotel_id and s.status<>'canceled' and s.planned_end>=p_from and s.planned_start<=p_to),'[]'::jsonb),
  'backlog',coalesce((select jsonb_agg(jsonb_build_object('work_order_id',w.id,'occurrence_id',o.id,'occurrence_code','MAN-'||lpad(o.occurrence_number::text,6,'0'),'title',w.title,'priority',o.priority,'impact_score',coalesce(i.score,0),'recommended_priority',coalesce(i.recommended_priority,o.priority),'room_number',r.room_number,'due_at',w.due_at) order by coalesce(i.score,0) desc,i.next_arrival_at nulls last,o.created_at) from public.maintenance_work_orders w join public.maintenance_occurrences o on o.id=w.occurrence_id left join public.rooms r on r.id=o.room_id left join public.maintenance_impact_scores i on i.occurrence_id=o.id where w.hotel_id=p_hotel_id and w.status not in ('completed','canceled') and not exists(select 1 from public.maintenance_schedules s where s.work_order_id=w.id and s.status<>'canceled')),'[]'::jsonb),
  'reschedule_requests',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'work_order_id',q.work_order_id,'occurrence_code','MAN-'||lpad(o.occurrence_number::text,6,'0'),'title',w.title,'requester_name',u.name,'requested_start',q.requested_start,'reason',q.reason,'created_at',q.created_at) order by q.created_at) from public.maintenance_reschedule_requests q join public.maintenance_work_orders w on w.id=q.work_order_id join public.maintenance_occurrences o on o.id=w.occurrence_id join public.users u on u.id=q.requested_by where q.hotel_id=p_hotel_id and q.status='pending'),'[]'::jsonb),
  'users',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'name',u.name) order by u.name) from public.users u where u.is_active and public.maintenance_user_has_hotel_scope(u.id,p_hotel_id)),'[]'::jsonb),
  'summary',jsonb_build_object(
    'scheduled',(select count(*) from public.maintenance_schedules where hotel_id=p_hotel_id and status<>'canceled'),
    'backlog',(select count(*) from public.maintenance_work_orders w where w.hotel_id=p_hotel_id and w.status not in ('completed','canceled') and not exists(select 1 from public.maintenance_schedules s where s.work_order_id=w.id and s.status<>'canceled')),
    'conflicts',0,
    'capacity_minutes',coalesce((select sum(extract(epoch from (ends_at-starts_at))/60*capacity) from public.maintenance_team_availability a join public.maintenance_teams t on t.id=a.team_id where t.hotel_id=p_hotel_id and t.is_active and a.user_id is null),0),
    'allocated_minutes',coalesce((select sum(estimated_minutes) from public.maintenance_schedules where hotel_id=p_hotel_id and status<>'canceled'),0)
  )
);
$$;

alter function public.operational_pending_candidates(uuid,timestamptz)
  rename to operational_pending_candidates_stage3;

create function public.operational_pending_candidates(
  p_hotel_id uuid,p_now timestamptz default now()
) returns jsonb language plpgsql set search_path=public as $$
declare v_result jsonb; v record;
begin
  v_result:=public.operational_pending_candidates_stage3(p_hotel_id,p_now);
  for v in
    select d.id,d.occurrence_id,o.occurrence_number
      from public.maintenance_lifecycle_decisions d
      join public.maintenance_lifecycle_options x on x.id=d.selected_option_id and x.kind='warranty'
      join public.maintenance_occurrences o on o.id=d.occurrence_id
     where d.hotel_id=p_hotel_id and d.status='approved'
  loop
    v_result:=v_result||jsonb_build_array(jsonb_build_object(
      'source','maintenance','source_key','maintenance:warranty:'||v.id,
      'kind','maintenance_warranty_response','entity_type','lifecycle_decision','entity_id',v.id,
      'title','Garantia aguarda resposta: MAN-'||lpad(v.occurrence_number::text,6,'0'),
      'href','/dashboard/maintenance/occurrences/'||v.occurrence_id,'severity','warning'
    ));
  end loop;
  return v_result;
end $$;

create or replace function public.can_read_operational_pending(
  p public.operational_pending,p_user_id uuid,p_permissions text[]
) returns boolean language sql stable set search_path=public as $$
  select public.maintenance_user_has_hotel_scope(p_user_id,p.hotel_id) and case
    when p.source='governance' then p_permissions && array['read_governance','execute_governance','inspect_governance','assign_governance']
    when p.source='maintenance' and p.kind='maintenance_waiting_overdue' then p_permissions && array['execute_maintenance','manage_maintenance_schedule','read_maintenance_analytics']
    when p.source='maintenance' and p.kind in ('maintenance_critical_unscheduled','maintenance_reschedule') then p_permissions && array['manage_maintenance_schedule','read_maintenance_analytics']
    when p.source='maintenance' and p.kind='maintenance_service_confirmation' then p_permissions && array['confirm_maintenance_service','manage_maintenance_schedule']
    when p.source='maintenance' and p.kind='maintenance_recurrence_review' then p_permissions && array['read_maintenance','triage_maintenance','read_maintenance_analytics']
    when p.source='maintenance' and p.kind='maintenance_lifecycle_approval' then 'approve_maintenance_lifecycle'=any(p_permissions)
    when p.source='maintenance' and p.kind='maintenance_warranty_response' then p_permissions && array['propose_maintenance_lifecycle','approve_maintenance_lifecycle','manage_maintenance_suppliers']
    when p.source='maintenance' then exists(select 1 from public.maintenance_notifications n where n.hotel_id=p.hotel_id and n.recipient_id=p_user_id and n.kind=p.kind and n.entity_id=p.entity_id)
      and p_permissions && array['read_maintenance','execute_maintenance','triage_maintenance','manage_maintenance_plans','manage_maintenance_sla','read_maintenance_analytics','manage_maintenance_suppliers']
    when p.kind='guest_balance' then p_permissions && array['read_consumption_analytics','access_reservations_calendar']
    when p.kind='critical_stock' then p_permissions && array['read_consumption_analytics','read_inventory']
    when p.kind='agreement_expiry' then p_permissions && array['read_consumption_analytics','read_commercial_partners']
    when p.kind='pending_settlement' then p_permissions && array['read_partner_settlements','prepare_partner_settlements','approve_partner_settlements','settle_partner_settlements']
    else false end;
$$;

revoke all on function public.operational_pending_candidates_stage3(uuid,timestamptz),public.operational_pending_candidates(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.operational_pending_candidates_stage3(uuid,timestamptz),public.operational_pending_candidates(uuid,timestamptz) to service_role;

comment on column public.maintenance_team_availability.user_id is
  'Nulo para capacidade da equipe; preenchido para a janela semanal individual do membro.';
