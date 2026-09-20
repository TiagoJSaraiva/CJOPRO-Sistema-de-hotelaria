-- Complete the local hotel-school workflows without rewriting the foundation migration.

create or replace function public.get_training_environment(p_hotel_id uuid)
returns jsonb language plpgsql stable set search_path=public as $$
declare v public.hotel_training_environments%rowtype; v_real timestamptz:=clock_timestamp(); v_timezone text;
begin
  select timezone into v_timezone from public.hotels where id=p_hotel_id;
  select * into v from public.hotel_training_environments where hotel_id=p_hotel_id;
  if not found then
    return jsonb_build_object(
      'hotel_id',p_hotel_id,'timezone',v_timezone,'scenario_key',null,'scenario_version',null,
      'clock_mode','live','frozen_at',null,'operational_now',v_real,
      'real_now',v_real,'version',1,'updated_by',null,'updated_at',v_real
    );
  end if;
  return to_jsonb(v)||jsonb_build_object(
    'timezone',v_timezone,
    'operational_now',case when v.clock_mode='frozen' then v.frozen_at else v_real end,
    'real_now',v_real
  );
end $$;

create or replace function public.act_training_clock(
  p_hotel_id uuid, p_actor_id uuid, p_input jsonb
) returns jsonb language plpgsql set search_path=public as $$
declare
  v public.hotel_training_environments%rowtype;
  v_before jsonb;
  v_action text:=p_input->>'action';
  v_at timestamptz;
  v_amount integer;
  v_unit text;
  v_timezone text;
begin
  insert into public.hotel_training_environments(hotel_id)
  values(p_hotel_id) on conflict(hotel_id) do nothing;
  select * into v from public.hotel_training_environments where hotel_id=p_hotel_id for update;
  select timezone into v_timezone from public.hotels where id=p_hotel_id;
  if v.version<>coalesce((p_input->>'expected_version')::integer,0) then
    return jsonb_build_object('result','conflict','context',public.get_training_environment(p_hotel_id));
  end if;
  v_before:=to_jsonb(v);
  if nullif(btrim(p_input->>'reason'),'') is null then
    return jsonb_build_object('result','reason_required');
  end if;
  if v_action='freeze' then
    update public.hotel_training_environments set clock_mode='frozen',frozen_at=clock_timestamp(),version=version+1,updated_by=p_actor_id,updated_at=clock_timestamp() where hotel_id=p_hotel_id;
  elsif v_action='set' then
    if nullif(p_input->>'local_at','') is not null and nullif(p_input->>'at','') is not null then
      return jsonb_build_object('result','invalid');
    end if;
    if nullif(p_input->>'local_at','') is not null then
      v_at:=(p_input->>'local_at')::timestamp at time zone v_timezone;
    else
      v_at:=nullif(p_input->>'at','')::timestamptz;
    end if;
    if v_at is null then return jsonb_build_object('result','at_required'); end if;
    update public.hotel_training_environments set clock_mode='frozen',frozen_at=v_at,version=version+1,updated_by=p_actor_id,updated_at=clock_timestamp() where hotel_id=p_hotel_id;
  elsif v_action='advance' then
    v_amount:=coalesce((p_input->>'amount')::integer,0); v_unit:=p_input->>'unit';
    if v.clock_mode<>'frozen' then return jsonb_build_object('result','clock_not_frozen'); end if;
    if v_amount<=0 or v_unit not in('hours','days') then return jsonb_build_object('result','invalid_advance'); end if;
    update public.hotel_training_environments set frozen_at=frozen_at+(v_amount||' '||v_unit)::interval,version=version+1,updated_by=p_actor_id,updated_at=clock_timestamp() where hotel_id=p_hotel_id;
  elsif v_action='resume' then
    update public.hotel_training_environments set clock_mode='live',frozen_at=null,version=version+1,updated_by=p_actor_id,updated_at=clock_timestamp() where hotel_id=p_hotel_id;
  else return jsonb_build_object('result','invalid_action'); end if;
  select * into v from public.hotel_training_environments where hotel_id=p_hotel_id;
  insert into public.hotel_training_clock_events(hotel_id,action,before_state,after_state,reason,actor_id)
  values(p_hotel_id,v_action,v_before,to_jsonb(v),btrim(p_input->>'reason'),p_actor_id);
  return jsonb_build_object('result','ok','environment',public.get_training_environment(p_hotel_id));
exception when invalid_text_representation or datetime_field_overflow then return jsonb_build_object('result','invalid');
end $$;

alter table public.maintenance_warranty_decisions
  add column location_state_before jsonb not null default '{}'::jsonb,
  add column location_state_after jsonb not null default '{}'::jsonb;
alter table public.maintenance_warranty_decisions
  alter column created_at set default clock_timestamp();

create or replace function public.list_maintenance_warranty_decisions(p_hotel_id uuid,p_location_id uuid)
returns jsonb language sql stable set search_path=public as $$
  select jsonb_build_object(
    'location',to_jsonb(l),
    'decisions',coalesce((select jsonb_agg(
      jsonb_build_object('id',d.id,'hotel_id',d.hotel_id,'location_id',d.location_id,
      'warranty_ends_on',d.warranty_ends_on,'result',d.result,'reason',d.reason,
      'occurrence_id',d.occurrence_id,'replacement_location_id',d.replacement_location_id,
      'new_warranty_ends_on',d.new_warranty_ends_on,'supersedes_id',d.supersedes_id,
      'decided_by',d.decided_by,'decided_by_name',u.name,'created_at',d.created_at)
      order by d.created_at desc)
      from public.maintenance_warranty_decisions d left join public.users u on u.id=d.decided_by
      where d.location_id=l.id and d.hotel_id=l.hotel_id),'[]'::jsonb),
    'current_decision_id',(select d.id from public.maintenance_warranty_decisions d
      where d.location_id=l.id and d.hotel_id=l.hotel_id
        and not exists(select 1 from public.maintenance_warranty_decisions newer where newer.supersedes_id=d.id)
        and (d.warranty_ends_on=l.warranty_ends_on or d.location_state_after=jsonb_build_object(
          'warranty_ends_on',l.warranty_ends_on,'lifecycle_status',l.lifecycle_status,'is_active',l.is_active))
      order by (d.warranty_ends_on=l.warranty_ends_on) desc,d.created_at desc limit 1),
    'active_occurrences',coalesce((select jsonb_agg(jsonb_build_object(
      'id',o.id,'code','MAN-'||lpad(o.occurrence_number::text,6,'0'),'title',left(o.description,160)
    ) order by o.created_at desc) from public.maintenance_occurrences o
      where o.hotel_id=l.hotel_id and o.location_id=l.id and o.status not in('resolved','canceled')),'[]'::jsonb)
  )
  from public.maintenance_locations l
  where l.hotel_id=p_hotel_id and l.id=p_location_id and l.kind='equipment'
$$;

create or replace function public.record_maintenance_warranty_decision(
  p_hotel_id uuid,p_location_id uuid,p_actor_id uuid,p_input jsonb
) returns jsonb language plpgsql set search_path=public as $$
declare
  v_location public.maintenance_locations%rowtype;
  v_result public.maintenance_warranty_decision_result;
  v_id uuid;
  v_occurrence uuid:=nullif(p_input->>'occurrence_id','')::uuid;
  v_replacement uuid:=nullif(p_input->>'replacement_location_id','')::uuid;
  v_new_date date:=nullif(p_input->>'new_warranty_ends_on','')::date;
  v_supersedes uuid:=nullif(p_input->>'supersedes_id','')::uuid;
  v_current_decision public.maintenance_warranty_decisions%rowtype;
  v_before jsonb;
  v_after jsonb;
begin
  select * into v_location from public.maintenance_locations
  where id=p_location_id and hotel_id=p_hotel_id and kind='equipment' for update;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if v_location.version<>coalesce((p_input->>'expected_location_version')::integer,0) then
    return jsonb_build_object('result','conflict','context',to_jsonb(v_location));
  end if;
  if v_location.warranty_ends_on is null then return jsonb_build_object('result','warranty_missing'); end if;
  v_result:=(p_input->>'result')::public.maintenance_warranty_decision_result;
  if nullif(btrim(p_input->>'reason'),'') is null then return jsonb_build_object('result','reason_required'); end if;

  if v_supersedes is not null then
    select * into v_current_decision from public.maintenance_warranty_decisions d
    where d.id=v_supersedes and d.hotel_id=p_hotel_id and d.location_id=p_location_id
      and not exists(select 1 from public.maintenance_warranty_decisions newer where newer.supersedes_id=d.id)
    for update;
    if not found then return jsonb_build_object('result','invalid_supersedes'); end if;
    if v_current_decision.location_state_before='{}'::jsonb or v_current_decision.location_state_after<>'{}'::jsonb and
      v_current_decision.location_state_after<>jsonb_build_object('warranty_ends_on',v_location.warranty_ends_on,'lifecycle_status',v_location.lifecycle_status,'is_active',v_location.is_active)
    then return jsonb_build_object('result','correction_conflict','context',to_jsonb(v_location)); end if;
    v_before:=v_current_decision.location_state_before;
  else
    select * into v_current_decision from public.maintenance_warranty_decisions d
    where d.hotel_id=p_hotel_id and d.location_id=p_location_id and d.warranty_ends_on=v_location.warranty_ends_on
      and not exists(select 1 from public.maintenance_warranty_decisions newer where newer.supersedes_id=d.id)
    order by d.created_at desc limit 1;
    if found then return jsonb_build_object('result','decision_exists','context',jsonb_build_object('decision_id',v_current_decision.id)); end if;
    v_before:=jsonb_build_object('warranty_ends_on',v_location.warranty_ends_on,'lifecycle_status',v_location.lifecycle_status,'is_active',v_location.is_active);
  end if;

  if v_result='claim_submitted' and not exists(
    select 1 from public.maintenance_occurrences where id=v_occurrence and hotel_id=p_hotel_id
      and location_id=p_location_id and status not in('resolved','canceled')
  ) then return jsonb_build_object('result','active_occurrence_required'); end if;
  if v_result='renewed' and (v_new_date is null or v_new_date<=(v_before->>'warranty_ends_on')::date) then
    return jsonb_build_object('result','later_warranty_required');
  end if;
  if v_result='replaced' and (v_replacement=p_location_id or not exists(
    select 1 from public.maintenance_locations where id=v_replacement and hotel_id=p_hotel_id
      and kind='equipment' and is_active and lifecycle_status='active'
  )) then return jsonb_build_object('result','active_replacement_required'); end if;

  v_after:=jsonb_build_object(
    'warranty_ends_on',case when v_result='renewed' then v_new_date else (v_before->>'warranty_ends_on')::date end,
    'lifecycle_status',case when v_result in('replaced','retired') then 'retired' else v_before->>'lifecycle_status' end,
    'is_active',case when v_result in('replaced','retired') then false else (v_before->>'is_active')::boolean end
  );
  insert into public.maintenance_warranty_decisions(
    hotel_id,location_id,warranty_ends_on,result,reason,occurrence_id,
    replacement_location_id,new_warranty_ends_on,supersedes_id,decided_by,
    location_state_before,location_state_after
  ) values(
    p_hotel_id,p_location_id,(v_before->>'warranty_ends_on')::date,v_result,btrim(p_input->>'reason'),
    v_occurrence,v_replacement,v_new_date,v_supersedes,p_actor_id,v_before,v_after
  ) returning id into v_id;
  update public.maintenance_locations set
    warranty_ends_on=(v_after->>'warranty_ends_on')::date,
    lifecycle_status=(v_after->>'lifecycle_status')::public.maintenance_asset_lifecycle,
    is_active=(v_after->>'is_active')::boolean,
    version=version+1,updated_at=clock_timestamp()
  where id=p_location_id;
  update public.maintenance_notifications set status='read',read_at=clock_timestamp(),dismissed_at=null
  where hotel_id=p_hotel_id and entity_type='location' and entity_id=p_location_id
    and kind='warranty_expiry' and status='unread';
  return jsonb_build_object('result','ok','id',v_id);
exception when unique_violation then return jsonb_build_object('result','decision_already_superseded');
when invalid_text_representation then return jsonb_build_object('result','invalid');
end $$;

create or replace function public.save_cash_register(p_hotel_id uuid,p_actor_id uuid,p_input jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare v_id uuid; v_kind public.cash_register_kind:=(p_input->>'kind')::public.cash_register_kind; v_point uuid:=nullif(p_input->>'consumption_point_id','')::uuid;
begin
  if (v_kind='reception' and v_point is not null) or (v_kind='consumption' and v_point is null)
    or coalesce(p_input->>'currency','')!~'^[A-Z]{3}$' then return jsonb_build_object('result','invalid'); end if;
  insert into public.cash_registers(hotel_id,name,code,kind,consumption_point_id,currency,difference_tolerance,active,created_by)
  values(p_hotel_id,btrim(p_input->>'name'),upper(btrim(p_input->>'code')),v_kind,v_point,p_input->>'currency',(p_input->>'difference_tolerance')::numeric,(p_input->>'active')::boolean,p_actor_id)
  returning id into v_id;
  return jsonb_build_object('result','ok','id',v_id);
exception when unique_violation then return jsonb_build_object('result','code_exists');
when foreign_key_violation then return jsonb_build_object('result','invalid_reference');
when check_violation or invalid_text_representation then return jsonb_build_object('result','invalid');
end $$;

insert into public.cash_management_settings(hotel_id,daily_close_started_on,activated_by)
select r.hotel_id,public.hotel_operational_date(r.hotel_id),(array_agg(r.created_by order by r.created_at))[1]
from public.cash_registers r
where r.active and not exists(select 1 from public.cash_management_settings s where s.hotel_id=r.hotel_id)
group by r.hotel_id;

create or replace function public.list_cash_registers_for_actor(p_hotel_id uuid,p_actor_id uuid,p_can_approve boolean)
returns jsonb language sql stable set search_path=public as $$
  select jsonb_build_object(
    'operational_date',public.hotel_operational_date(p_hotel_id),
    'currency',(select h.currency from public.hotels h where h.id=p_hotel_id),
    'registers',coalesce(jsonb_agg(
      to_jsonb(r)||jsonb_build_object(
        'consumption_point_name',cp.name,
        'active_session',(select public.redact_cash_session(to_jsonb(s)||jsonb_build_object(
          'operator_name',u.name,'register_name',r.name,'currency',r.currency,
          'movement_totals',coalesce((select jsonb_object_agg(x.kind,x.total) from(
            select kind::text,sum(cash_delta) total from public.cash_movements where cash_session_id=s.id group by kind
          )x),'{}'::jsonb)),p_actor_id,p_can_approve)
          from public.cash_sessions s left join public.users u on u.id=s.operator_id
          where s.cash_register_id=r.id and s.status in('open','counting','difference_pending') limit 1)
      ) order by r.name),'[]'::jsonb)
  )
  from public.cash_registers r left join public.consumption_points cp on cp.id=r.consumption_point_id
  where r.hotel_id=p_hotel_id
$$;

create or replace function public.daily_close_projection(p_hotel_id uuid,p_business_date date)
returns jsonb language sql stable set search_path=public as $$
with tx as(
  select type,coalesce(nullif(lower(payment_method),''),'other') payment_method,sum(amount) amount,count(*) count
  from public.financial_transactions where hotel_id=p_hotel_id and business_date=p_business_date and status='COMPLETED'
  group by type,coalesce(nullif(lower(payment_method),''),'other')
), blockers as(
  select 'cash_session_open' kind,id entity_id,'Feche ou cancele a sessão de caixa antes de preparar o dia.' title
  from public.cash_sessions where hotel_id=p_hotel_id and business_date=p_business_date and status in('open','counting','difference_pending')
  union all
  select 'cash_without_session',id,'Vincule o movimento em dinheiro a uma sessão de caixa.'
  from public.financial_transactions where hotel_id=p_hotel_id and business_date=p_business_date and lower(coalesce(payment_method,''))='cash' and cash_session_id is null
), totals as(
  select coalesce(sum(amount) filter(where type='INCOME'),0) income,
    coalesce(sum(amount) filter(where type='EXPENSE'),0) expense,
    coalesce(sum(amount) filter(where type='REFUND'),0) refund
  from public.financial_transactions where hotel_id=p_hotel_id and business_date=p_business_date and status='COMPLETED'
)
select jsonb_build_object(
  'business_date',p_business_date,
  'transactions',coalesce((select jsonb_agg(to_jsonb(tx) order by type,payment_method) from tx),'[]'::jsonb),
  'totals',jsonb_build_object('income',totals.income,'expense',totals.expense,'refund',totals.refund),
  'is_zero_activity',(totals.income=0 and totals.expense=0 and totals.refund=0),
  'cash_sessions',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object(
      'operator_name',u.name,'closed_by_name',cu.name,'register_name',r.name,'currency',r.currency) order by s.opened_at)
    from public.cash_sessions s join public.cash_registers r on r.id=s.cash_register_id
    left join public.users u on u.id=s.operator_id left join public.users cu on cu.id=s.closed_by
    where s.hotel_id=p_hotel_id and s.business_date=p_business_date),'[]'::jsonb),
  'blockers',coalesce((select jsonb_agg(to_jsonb(blockers)) from blockers),'[]'::jsonb)
) from totals
$$;

create or replace function public.governance_room_state(p_hotel_id uuid,p_room_id uuid,p_now timestamptz default null)
returns jsonb language plpgsql stable set search_path=public as $$
declare v_cycle record; v_arrival record; v_occupied boolean; v_blocked boolean; v_assignee_id uuid; v_assignee_name text; v_house text; v_ready text; v_blockers text[]:='{}'; v_effective_now timestamptz:=coalesce(p_now,public.hotel_operational_now(p_hotel_id));
begin
  if not exists(select 1 from public.rooms where hotel_id=p_hotel_id and id=p_room_id) then return null; end if;
  select * into v_cycle from public.governance_cycles where hotel_id=p_hotel_id and room_id=p_room_id and status not in ('released','canceled') order by created_at desc limit 1;
  select exists(select 1 from public.stays s join public.reservations r on r.id=s.reservation_id where r.hotel_id=p_hotel_id and s.room_id=p_room_id and s.stay_status='checked_in') into v_occupied;
  select exists(select 1 from public.room_blocks b where b.hotel_id=p_hotel_id and b.room_id=p_room_id and b.released_at is null and b.start_date<=(v_effective_now at time zone (select timezone from public.hotels where id=p_hotel_id))::date) into v_blocked;
  select s.checkin_date_expected into v_arrival from public.stays s join public.reservations r on r.id=s.reservation_id where r.hotel_id=p_hotel_id and s.room_id=p_room_id and s.stay_status='confirmed' and s.checkin_date_expected>=v_effective_now order by s.checkin_date_expected limit 1;
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

create or replace function public.apply_maintenance_sla_snapshot()
returns trigger language plpgsql set search_path=public as $$
declare v_policy public.maintenance_sla_policies%rowtype; v_started_at timestamptz;
begin
  if new.sla_snapshot is not null then return new; end if;
  select * into v_policy from public.maintenance_sla_policies policy
  where policy.hotel_id=new.hotel_id and policy.is_active
    and (policy.category_id is null or policy.category_id=new.category_id)
    and (policy.priority is null or policy.priority=new.priority)
  order by (policy.category_id is not null)::integer desc,(policy.priority is not null)::integer desc limit 1;
  if found then
    v_started_at:=coalesce(new.discovered_at,public.hotel_operational_now(new.hotel_id));
    new.sla_policy_id:=v_policy.id;
    new.sla_snapshot:=jsonb_build_object('policy_id',v_policy.id,'name',v_policy.name,'response_hours',v_policy.response_hours,'resolution_hours',v_policy.resolution_hours);
    new.sla_response_due_at:=v_started_at+make_interval(hours=>v_policy.response_hours);
    new.sla_resolution_due_at:=v_started_at+make_interval(hours=>v_policy.resolution_hours);
  end if;
  return new;
end $$;

create or replace function public.process_maintenance_sla_alerts(p_hotel_id uuid,p_now timestamptz default null)
returns integer language plpgsql set search_path=public as $$
declare v_occurrence record;v_threshold text;v_count integer:=0;v_recipient uuid;v_elapsed numeric;v_limit numeric;v_effective_now timestamptz:=coalesce(p_now,public.hotel_operational_now(p_hotel_id));
begin
  for v_occurrence in
    select occurrence.*,coalesce((select assigned_to from public.maintenance_work_orders work_order where work_order.occurrence_id=occurrence.id and assigned_to is not null order by created_at limit 1),occurrence.triaged_by,occurrence.reported_by) recipient
    from public.maintenance_occurrences occurrence
    where occurrence.hotel_id=p_hotel_id and occurrence.sla_snapshot is not null and occurrence.status<>'canceled'
      and ((occurrence.triaged_at is null and v_effective_now>=occurrence.discovered_at+(occurrence.sla_response_due_at-occurrence.discovered_at)*0.75)
        or (occurrence.operational_resolved_at is null and v_effective_now>=occurrence.discovered_at+(occurrence.sla_resolution_due_at-occurrence.discovered_at)*0.75))
  loop
    v_recipient:=v_occurrence.recipient;
    if v_occurrence.triaged_at is null then
      v_limit:=extract(epoch from(v_occurrence.sla_response_due_at-v_occurrence.discovered_at));
      v_elapsed:=extract(epoch from(v_effective_now-v_occurrence.discovered_at));
      if v_effective_now>=v_occurrence.sla_response_due_at then v_threshold:='response-breach:'||floor(extract(epoch from(v_effective_now-v_occurrence.sla_response_due_at))/86400)::text;
      elsif v_elapsed>=v_limit*0.75 then v_threshold:='response-75';else v_threshold:=null;end if;
      if v_threshold is not null then
        v_count:=v_count+public.notify_maintenance_recipient(p_hotel_id,v_recipient,'sla_response',case when v_effective_now>=v_occurrence.sla_response_due_at then 'critical' else 'warning' end,'SLA de resposta','A ocorrência MAN-'||lpad(v_occurrence.occurrence_number::text,6,'0')||' requer triagem.','/dashboard/maintenance/occurrences/'||v_occurrence.id,'occurrence',v_occurrence.id,v_threshold)::integer;
        v_count:=v_count+public.notify_maintenance_managers(p_hotel_id,'sla_response',case when v_effective_now>=v_occurrence.sla_response_due_at then 'critical' else 'warning' end,'SLA de resposta','Ocorrência próxima ou além do SLA de resposta.','/dashboard/maintenance/occurrences/'||v_occurrence.id,'occurrence',v_occurrence.id,v_threshold);
      end if;
    end if;
    if v_occurrence.operational_resolved_at is null then
      v_limit:=extract(epoch from(v_occurrence.sla_resolution_due_at-v_occurrence.discovered_at));
      v_elapsed:=extract(epoch from(v_effective_now-v_occurrence.discovered_at));
      if v_effective_now>=v_occurrence.sla_resolution_due_at then v_threshold:='resolution-breach:'||floor(extract(epoch from(v_effective_now-v_occurrence.sla_resolution_due_at))/86400)::text;
      elsif v_elapsed>=v_limit*0.75 then v_threshold:='resolution-75';else v_threshold:=null;end if;
      if v_threshold is not null then
        v_count:=v_count+public.notify_maintenance_recipient(p_hotel_id,v_recipient,'sla_resolution',case when v_effective_now>=v_occurrence.sla_resolution_due_at then 'critical' else 'warning' end,'SLA de resolução','A ocorrência MAN-'||lpad(v_occurrence.occurrence_number::text,6,'0')||' requer conclusão operacional.','/dashboard/maintenance/occurrences/'||v_occurrence.id,'occurrence',v_occurrence.id,v_threshold)::integer;
        v_count:=v_count+public.notify_maintenance_managers(p_hotel_id,'sla_resolution',case when v_effective_now>=v_occurrence.sla_resolution_due_at then 'critical' else 'warning' end,'SLA de resolução','Ocorrência próxima ou além do SLA de resolução.','/dashboard/maintenance/occurrences/'||v_occurrence.id,'occurrence',v_occurrence.id,v_threshold);
      end if;
    end if;
  end loop;
  return v_count;
end $$;

create or replace function public.quote_public_booking(p_slug text,p_input jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare v_hotel uuid;v_currency text;v_id uuid:=gen_random_uuid();v_fp text;v_checkin date:=(p_input->>'checkin_date')::date;v_checkout date:=(p_input->>'checkout_date')::date;v_room jsonb;v_index integer:=0;v_item uuid;v_type record;v_rate record;v_nightly jsonb;v_total numeric;v_available integer;v_now timestamptz;
begin
 select h.id,h.currency into v_hotel,v_currency from public.hotels h join public.booking_configurations c on c.hotel_id=h.id where h.slug=p_slug and h.is_active and c.published;
 if not found then return jsonb_build_object('result','not_found');end if;
 v_now:=public.hotel_operational_now(v_hotel);
 if v_checkout<=v_checkin or v_checkin<public.hotel_operational_date(v_hotel) then return jsonb_build_object('result','invalid_dates');end if;
 v_fp=encode(extensions.digest(convert_to(p_input::text||v_id::text,'UTF8'),'sha256'),'hex');
 insert into public.booking_quotes(id,hotel_id,input,fingerprint,expires_at) values(v_id,v_hotel,p_input,v_fp,v_now+interval '15 minutes');
 for v_room in select * from jsonb_array_elements(p_input->'rooms') loop v_index=v_index+1;
  for v_type in select room_type,count(*)::integer capacity,max(max_occupancy) max_occupancy,avg(base_daily_rate)::numeric base from public.rooms where hotel_id=v_hotel and status not in('maintenance','blocked') group by room_type having max(max_occupancy)>=(v_room->>'adults')::integer+(v_room->>'children')::integer loop
   select min(v_type.capacity-(select count(*) from public.reservation_accommodations a where a.hotel_id=v_hotel and a.room_type=v_type.room_type and a.checkin_date<d::date+1 and a.checkout_date>d::date and (a.status in('confirmed','assigned','checked_in') or a.status='held' and a.hold_expires_at>v_now)))::integer into v_available from generate_series(v_checkin,v_checkout-1,interval '1 day') d;
   if coalesce(v_available,0)<=0 then continue;end if;
   for v_rate in select v.*,p.name plan_name,p.kind from public.rate_plan_versions v join public.rate_plans p on p.id=v.rate_plan_id join public.rate_plan_version_room_types t on t.version_id=v.id and t.room_type=v_type.room_type where p.hotel_id=v_hotel and p.status='active' and p.active_version_id=v.id and 'direct'=any(v.channels) order by p.name loop
    select coalesce(jsonb_agg(jsonb_build_object('date',d::date,'base',v_type.base,'seasonal',coalesce(s.extra,0),'plan_adjustment',case when v_rate.adjustment_type='percentage' then round((v_type.base+coalesce(s.extra,0))*v_rate.adjustment_value/100,2) else v_rate.adjustment_value end,'occupancy_supplement',greatest(0,(v_room->>'adults')::integer-v_rate.included_adults)*v_rate.extra_adult_amount+greatest(0,(v_room->>'children')::integer-v_rate.included_children)*v_rate.extra_child_amount,'final',round(case when v_rate.adjustment_type='percentage' then (v_type.base+coalesce(s.extra,0))*(1+v_rate.adjustment_value/100) else v_type.base+coalesce(s.extra,0)+v_rate.adjustment_value end+greatest(0,(v_room->>'adults')::integer-v_rate.included_adults)*v_rate.extra_adult_amount+greatest(0,(v_room->>'children')::integer-v_rate.included_children)*v_rate.extra_child_amount,2)) order by d),'[]'),coalesce(sum(round(case when v_rate.adjustment_type='percentage' then (v_type.base+coalesce(s.extra,0))*(1+v_rate.adjustment_value/100) else v_type.base+coalesce(s.extra,0)+v_rate.adjustment_value end+greatest(0,(v_room->>'adults')::integer-v_rate.included_adults)*v_rate.extra_adult_amount+greatest(0,(v_room->>'children')::integer-v_rate.included_children)*v_rate.extra_child_amount,2)),0) into v_nightly,v_total from generate_series(v_checkin,v_checkout-1,interval '1 day') d left join lateral(select coalesce(sr.daily_rate,0)::numeric extra from public.seasons se join public.season_room_rates sr on sr.season_id=se.id and sr.room_type=v_type.room_type where se.hotel_id=v_hotel and se.is_active and d::date between se.start_date and se.end_date order by se.start_date desc limit 1)s on true;
    v_item=gen_random_uuid();insert into public.booking_quote_items(id,hotel_id,quote_id,room_index,room_type,rate_plan_version_id,adults,children,available_count,total,nightly) values(v_item,v_hotel,v_id,v_index,v_type.room_type,v_rate.id,(v_room->>'adults')::integer,(v_room->>'children')::integer,v_available,v_total,v_nightly);
   end loop;
  end loop;
 end loop;
 return jsonb_build_object('result','ok','quote_id',v_id,'fingerprint',v_fp,'expires_at',v_now+interval '15 minutes','currency',v_currency,'items',(select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('plan_name',p.name,'plan_kind',p.kind,'guarantee',jsonb_build_object('type',v.guarantee_type,'value',v.guarantee_value),'cancellation',jsonb_build_object('type',v.cancellation_type,'value',v.cancellation_value,'cutoff_hours',v.cancellation_cutoff_hours),'benefit_plan_version_id',v.benefit_plan_version_id) order by i.room_index,i.total),'[]') from public.booking_quote_items i join public.rate_plan_versions v on v.id=i.rate_plan_version_id join public.rate_plans p on p.id=v.rate_plan_id where i.quote_id=v_id));
exception when invalid_text_representation then return jsonb_build_object('result','invalid');end $$;

create or replace function public.create_public_booking_hold(p_slug text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare q public.booking_quotes;v_hotel uuid;v_existing public.booking_hold_requests;v_fp text:=encode(digest(convert_to(p_input::text,'UTF8'),'sha256'),'hex');v_res uuid;v_code text;v_selection jsonb;i public.booking_quote_items;v_expiry timestamptz;v_access text;v_access_result jsonb;v_a uuid;n jsonb;v_now timestamptz;
begin
 select h.id into v_hotel from public.hotels h join public.booking_configurations c on c.hotel_id=h.id where h.slug=p_slug and h.is_active and c.published;if not found then return jsonb_build_object('result','not_found');end if;
 v_now:=public.hotel_operational_now(v_hotel);
 select * into v_existing from public.booking_hold_requests where hotel_id=v_hotel and idempotency_key=(p_input->>'idempotency_key')::uuid;if found then if v_existing.request_fingerprint=v_fp then return jsonb_build_object('result','ok','reservation_id',v_existing.reservation_id,'repeated',true);end if;return jsonb_build_object('result','idempotency_conflict');end if;
 select * into q from public.booking_quotes where id=(p_input->>'quote_id')::uuid and hotel_id=v_hotel for update;if not found or q.status<>'active' or q.expires_at<=v_now or q.fingerprint<>p_input->>'quote_fingerprint' then return jsonb_build_object('result','quote_expired');end if;
 if jsonb_array_length(p_input->'selections')<>jsonb_array_length(q.input->'rooms') or (select count(distinct i.room_index) from jsonb_array_elements(p_input->'selections') s join public.booking_quote_items i on i.id=(s->>'quote_item_id')::uuid and i.quote_id=q.id)<>jsonb_array_length(q.input->'rooms') then return jsonb_build_object('result','invalid_selection');end if;
 v_code='WEB-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));insert into public.reservations(hotel_id,booking_customer_id,reservation_code,guest_count,reservation_source,estimated_total_price,final_total_price,notes,lifecycle_status,hold_expires_at) values(v_hotel,null,v_code,1,'website',0,0,'Pré-reserva direta','hold',v_now+interval '24 hours') returning id,hold_expires_at into v_res,v_expiry;
 insert into public.reservation_contacts(reservation_id,hotel_id,full_name,email,phone,consent_version) values(v_res,v_hotel,trim(p_input->>'contact_name'),nullif(p_input->>'email',''),nullif(p_input->>'phone',''),p_input->>'consent_version');
 for v_selection in select * from jsonb_array_elements(p_input->'selections') loop select * into i from public.booking_quote_items where id=(v_selection->>'quote_item_id')::uuid and quote_id=q.id and room_type=v_selection->>'room_type' and rate_plan_version_id=(v_selection->>'rate_plan_version_id')::uuid;if not found then raise exception using errcode='P0001',message='invalid_selection';end if;perform pg_advisory_xact_lock(hashtext(v_hotel::text||i.room_type||q.input->>'checkin_date'||q.input->>'checkout_date'));
  if (select count(*) from public.rooms where hotel_id=v_hotel and room_type=i.room_type and status not in('maintenance','blocked')) <= (select count(*) from public.reservation_accommodations a where a.hotel_id=v_hotel and a.room_type=i.room_type and a.checkin_date<(q.input->>'checkout_date')::date and a.checkout_date>(q.input->>'checkin_date')::date and (a.status in('confirmed','assigned','checked_in') or a.status='held' and a.hold_expires_at>v_now)) then raise exception using errcode='P0001',message='availability_conflict';end if;
  select least(v_now+make_interval(hours=>v.hold_hours),((q.input->>'checkin_date')::date+coalesce(h.checkin_time_limit,time '23:59')) at time zone h.timezone) into v_expiry from public.rate_plan_versions v join public.hotels h on h.id=v_hotel where v.id=i.rate_plan_version_id;
  insert into public.reservation_accommodations(hotel_id,reservation_id,room_type,checkin_date,checkout_date,adults,children,status,rate_plan_version_id,total_price,hold_expires_at) values(v_hotel,v_res,i.room_type,(q.input->>'checkin_date')::date,(q.input->>'checkout_date')::date,i.adults,i.children,'held',i.rate_plan_version_id,i.total,v_expiry) returning id into v_a;
  for n in select * from jsonb_array_elements(i.nightly) loop insert into public.reservation_nightly_prices(hotel_id,accommodation_id,stay_date,rate_plan_version_id,base_amount,seasonal_amount,plan_adjustment,occupancy_supplement,final_amount,source) values(v_hotel,v_a,(n->>'date')::date,i.rate_plan_version_id,(n->>'base')::numeric,(n->>'seasonal')::numeric,(n->>'plan_adjustment')::numeric,(n->>'occupancy_supplement')::numeric,(n->>'final')::numeric,'direct');end loop;
 end loop;
 update public.reservations set guest_count=(select sum(adults+children) from public.reservation_accommodations where reservation_id=v_res),estimated_total_price=(select sum(total_price) from public.reservation_accommodations where reservation_id=v_res),final_total_price=(select sum(total_price) from public.reservation_accommodations where reservation_id=v_res),hold_expires_at=(select min(hold_expires_at) from public.reservation_accommodations where reservation_id=v_res) where id=v_res;
 update public.booking_quotes set status='consumed' where id=q.id;
 insert into public.booking_hold_requests(hotel_id,idempotency_key,request_fingerprint,reservation_id) values(v_hotel,(p_input->>'idempotency_key')::uuid,v_fp,v_res);
 v_access_result=public.create_prearrival_link(v_hotel,v_res,null,2160);
 return jsonb_build_object('result','ok','reservation_id',v_res,'reservation_code',v_code,'expires_at',(select hold_expires_at from public.reservations where id=v_res),'access_token',v_access_result->>'token');
exception when raise_exception then return jsonb_build_object('result',sqlerrm);end $$;

grant execute on function public.get_training_environment(uuid),public.act_training_clock(uuid,uuid,jsonb),
  public.list_maintenance_warranty_decisions(uuid,uuid),public.record_maintenance_warranty_decision(uuid,uuid,uuid,jsonb),
  public.save_cash_register(uuid,uuid,jsonb),public.list_cash_registers_for_actor(uuid,uuid,boolean),
  public.daily_close_projection(uuid,date),public.governance_room_state(uuid,uuid,timestamptz)
  ,public.process_maintenance_sla_alerts(uuid,timestamptz)
  ,public.quote_public_booking(text,jsonb),public.create_public_booking_hold(text,jsonb)
to service_role;
