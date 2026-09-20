-- Hotel-escola local: relógio operacional, decisões de garantia e clareza operacional.

create type public.training_clock_mode as enum ('live', 'frozen');
create type public.maintenance_warranty_decision_result as enum (
  'claim_submitted', 'renewed', 'replaced', 'retired', 'expiry_acknowledged'
);

create table public.hotel_training_environments (
  hotel_id uuid primary key references public.hotels(id) on delete cascade,
  scenario_key text,
  scenario_version integer check (scenario_version is null or scenario_version > 0),
  clock_mode public.training_clock_mode not null default 'live',
  frozen_at timestamptz,
  version integer not null default 1 check (version > 0),
  updated_by uuid references public.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  check ((clock_mode = 'frozen') = (frozen_at is not null))
);

create table public.hotel_training_clock_events (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  action text not null check (action in ('freeze', 'set', 'advance', 'resume', 'scenario_reset')),
  before_state jsonb not null,
  after_state jsonb not null,
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  actor_id uuid references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (hotel_id, id)
);

create trigger hotel_training_clock_events_immutable
before update or delete on public.hotel_training_clock_events
for each row execute function public.prevent_maintenance_event_mutation();

create function public.hotel_operational_now(p_hotel_id uuid)
returns timestamptz language sql stable set search_path=public as $$
  select case when e.clock_mode='frozen' then e.frozen_at else now() end
  from public.hotels h
  left join public.hotel_training_environments e on e.hotel_id=h.id
  where h.id=p_hotel_id
$$;

create function public.hotel_operational_date(p_hotel_id uuid)
returns date language sql stable set search_path=public as $$
  select (public.hotel_operational_now(h.id) at time zone h.timezone)::date
  from public.hotels h where h.id=p_hotel_id
$$;

create function public.get_training_environment(p_hotel_id uuid)
returns jsonb language plpgsql stable set search_path=public as $$
declare v public.hotel_training_environments%rowtype; v_real timestamptz:=clock_timestamp();
begin
  select * into v from public.hotel_training_environments where hotel_id=p_hotel_id;
  if not found then
    return jsonb_build_object(
      'hotel_id',p_hotel_id,'scenario_key',null,'scenario_version',null,
      'clock_mode','live','frozen_at',null,'operational_now',v_real,
      'real_now',v_real,'version',1,'updated_by',null,'updated_at',v_real
    );
  end if;
  return to_jsonb(v)||jsonb_build_object(
    'operational_now',case when v.clock_mode='frozen' then v.frozen_at else v_real end,
    'real_now',v_real
  );
end $$;

create function public.act_training_clock(
  p_hotel_id uuid, p_actor_id uuid, p_input jsonb
) returns jsonb language plpgsql set search_path=public as $$
declare
  v public.hotel_training_environments%rowtype;
  v_before jsonb;
  v_action text:=p_input->>'action';
  v_at timestamptz;
  v_amount integer;
  v_unit text;
begin
  insert into public.hotel_training_environments(hotel_id)
  values(p_hotel_id) on conflict(hotel_id) do nothing;
  select * into v from public.hotel_training_environments where hotel_id=p_hotel_id for update;
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
    v_at:=nullif(p_input->>'at','')::timestamptz;
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
exception when invalid_text_representation then return jsonb_build_object('result','invalid');
end $$;

create function public.prepare_training_scenario(
  p_hotel_id uuid,
  p_scenario_key text,
  p_scenario_version integer,
  p_description text,
  p_actor_id uuid default null
) returns jsonb language plpgsql set search_path=public as $$
declare v_before jsonb; v_after jsonb;
begin
  if nullif(btrim(p_scenario_key),'') is null or p_scenario_version<1 then
    raise exception 'training scenario key and version are required' using errcode='23514';
  end if;
  if not exists(select 1 from public.hotels where id=p_hotel_id) then
    raise exception 'training hotel not found' using errcode='23503';
  end if;
  select to_jsonb(e) into v_before from public.hotel_training_environments e
  where e.hotel_id=p_hotel_id for update;
  insert into public.hotel_training_environments(
    hotel_id,scenario_key,scenario_version,clock_mode,frozen_at,version,updated_by,updated_at
  ) values(
    p_hotel_id,btrim(p_scenario_key),p_scenario_version,'frozen',clock_timestamp(),1,p_actor_id,clock_timestamp()
  ) on conflict(hotel_id) do update set
    scenario_key=excluded.scenario_key,
    scenario_version=excluded.scenario_version,
    clock_mode='frozen',
    frozen_at=clock_timestamp(),
    version=public.hotel_training_environments.version+1,
    updated_by=p_actor_id,
    updated_at=clock_timestamp();
  select to_jsonb(e) into v_after from public.hotel_training_environments e where e.hotel_id=p_hotel_id;
  insert into public.hotel_training_clock_events(hotel_id,action,before_state,after_state,reason,actor_id)
  values(p_hotel_id,'scenario_reset',coalesce(v_before,'{}'::jsonb),v_after,
    coalesce(nullif(btrim(p_description),''),'Cenário local preparado.'),p_actor_id);
  return public.get_training_environment(p_hotel_id);
end $$;

alter table public.maintenance_locations
  add column version integer not null default 1 check (version > 0),
  add constraint maintenance_locations_id_hotel_training_unique unique(id,hotel_id);

create table public.maintenance_warranty_decisions (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  location_id uuid not null,
  warranty_ends_on date not null,
  result public.maintenance_warranty_decision_result not null,
  reason text not null check (char_length(btrim(reason)) between 3 and 1000),
  occurrence_id uuid,
  replacement_location_id uuid,
  new_warranty_ends_on date,
  supersedes_id uuid,
  decided_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(hotel_id,id),
  foreign key(location_id,hotel_id) references public.maintenance_locations(id,hotel_id) on delete restrict,
  foreign key(occurrence_id,hotel_id) references public.maintenance_occurrences(id,hotel_id) on delete restrict,
  foreign key(replacement_location_id,hotel_id) references public.maintenance_locations(id,hotel_id) on delete restrict,
  foreign key(supersedes_id,hotel_id) references public.maintenance_warranty_decisions(id,hotel_id) on delete restrict,
  check ((result='claim_submitted')=(occurrence_id is not null)),
  check ((result='renewed')=(new_warranty_ends_on is not null)),
  check ((result='replaced')=(replacement_location_id is not null))
);

create unique index maintenance_warranty_decision_superseded_once
on public.maintenance_warranty_decisions(supersedes_id) where supersedes_id is not null;
create trigger maintenance_warranty_decisions_immutable
before update or delete on public.maintenance_warranty_decisions
for each row execute function public.prevent_maintenance_event_mutation();

create function public.list_maintenance_warranty_decisions(p_hotel_id uuid,p_location_id uuid)
returns jsonb language sql stable set search_path=public as $$
  select jsonb_build_object(
    'location',to_jsonb(l),
    'decisions',coalesce(jsonb_agg(
      jsonb_build_object('id',d.id,'hotel_id',d.hotel_id,'location_id',d.location_id,
      'warranty_ends_on',d.warranty_ends_on,'result',d.result,'reason',d.reason,
      'occurrence_id',d.occurrence_id,'replacement_location_id',d.replacement_location_id,
      'new_warranty_ends_on',d.new_warranty_ends_on,'supersedes_id',d.supersedes_id,
      'decided_by',d.decided_by,'decided_by_name',u.name,'created_at',d.created_at)
      order by d.created_at desc) filter(where d.id is not null),'[]'::jsonb)
  )
  from public.maintenance_locations l
  left join public.maintenance_warranty_decisions d on d.location_id=l.id and d.hotel_id=l.hotel_id
  left join public.users u on u.id=d.decided_by
  where l.hotel_id=p_hotel_id and l.id=p_location_id and l.kind='equipment'
  group by l.id
$$;

create function public.record_maintenance_warranty_decision(
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
  v_current_decision uuid;
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
  select d.id into v_current_decision
  from public.maintenance_warranty_decisions d
  where d.hotel_id=p_hotel_id and d.location_id=p_location_id
    and d.warranty_ends_on=v_location.warranty_ends_on
    and not exists(
      select 1 from public.maintenance_warranty_decisions newer
      where newer.supersedes_id=d.id
    )
  order by d.created_at desc limit 1;
  if v_current_decision is not null and v_supersedes is distinct from v_current_decision then
    return jsonb_build_object('result','decision_exists','context',jsonb_build_object('decision_id',v_current_decision));
  end if;
  if v_supersedes is not null and not exists(
    select 1 from public.maintenance_warranty_decisions d
    where d.id=v_supersedes and d.hotel_id=p_hotel_id and d.location_id=p_location_id
      and not exists(
        select 1 from public.maintenance_warranty_decisions newer
        where newer.supersedes_id=d.id
      )
  ) then
    return jsonb_build_object('result','invalid_supersedes');
  end if;
  if v_result='claim_submitted' and not exists(
    select 1 from public.maintenance_occurrences where id=v_occurrence and hotel_id=p_hotel_id
      and location_id=p_location_id and status not in('resolved','canceled')
  ) then return jsonb_build_object('result','active_occurrence_required'); end if;
  if v_result='renewed' and (v_new_date is null or v_new_date<=v_location.warranty_ends_on) then
    return jsonb_build_object('result','later_warranty_required');
  end if;
  if v_result='replaced' and (v_replacement=p_location_id or not exists(
    select 1 from public.maintenance_locations where id=v_replacement and hotel_id=p_hotel_id
      and kind='equipment' and is_active and lifecycle_status='active'
  )) then return jsonb_build_object('result','active_replacement_required'); end if;
  insert into public.maintenance_warranty_decisions(
    hotel_id,location_id,warranty_ends_on,result,reason,occurrence_id,
    replacement_location_id,new_warranty_ends_on,supersedes_id,decided_by
  ) values(
    p_hotel_id,p_location_id,v_location.warranty_ends_on,v_result,btrim(p_input->>'reason'),
    v_occurrence,v_replacement,v_new_date,v_supersedes,p_actor_id
  ) returning id into v_id;
  update public.maintenance_locations set
    warranty_ends_on=case when v_result='renewed' then v_new_date else warranty_ends_on end,
    lifecycle_status=case when v_result in('replaced','retired') then 'retired' else lifecycle_status end,
    is_active=case when v_result in('replaced','retired') then false else is_active end,
    version=version+1,updated_at=now()
  where id=p_location_id;
  update public.maintenance_notifications set
    status='read',read_at=clock_timestamp(),dismissed_at=null
  where hotel_id=p_hotel_id and entity_type='location' and entity_id=p_location_id
    and kind='warranty_expiry' and status='unread';
  return jsonb_build_object('result','ok','id',v_id);
exception when unique_violation then return jsonb_build_object('result','decision_already_superseded');
when invalid_text_representation then return jsonb_build_object('result','invalid');
end $$;

create function public.save_maintenance_location(
  p_hotel_id uuid,p_id uuid,p_actor_id uuid,p_input jsonb
) returns jsonb language plpgsql set search_path=public as $$
declare v_id uuid; v_version integer; v_kind public.maintenance_location_kind;
begin
  v_kind:=(p_input->>'kind')::public.maintenance_location_kind;
  if nullif(btrim(p_input->>'name'),'') is null then return jsonb_build_object('result','invalid'); end if;
  if v_kind='equipment' and nullif(p_input->>'parent_location_id','') is not null and not exists(
    select 1 from public.maintenance_locations where id=(p_input->>'parent_location_id')::uuid and hotel_id=p_hotel_id and kind='area'
  ) then return jsonb_build_object('result','invalid_parent'); end if;
  if p_id is null then
    insert into public.maintenance_locations(
      hotel_id,parent_location_id,kind,name,description,display_order,is_active,asset_tag,
      manufacturer,model,serial_number,installed_on,warranty_ends_on,supplier_id,contract_id,lifecycle_status
    ) values(
      p_hotel_id,nullif(p_input->>'parent_location_id','')::uuid,v_kind,btrim(p_input->>'name'),nullif(btrim(p_input->>'description'),''),
      coalesce((p_input->>'display_order')::integer,0),coalesce((p_input->>'is_active')::boolean,true),
      nullif(btrim(p_input->>'asset_tag'),''),nullif(btrim(p_input->>'manufacturer'),''),nullif(btrim(p_input->>'model'),''),
      nullif(btrim(p_input->>'serial_number'),''),nullif(p_input->>'installed_on','')::date,nullif(p_input->>'warranty_ends_on','')::date,
      nullif(p_input->>'supplier_id','')::uuid,nullif(p_input->>'contract_id','')::uuid,
      case when v_kind='equipment' then coalesce(nullif(p_input->>'lifecycle_status','')::public.maintenance_asset_lifecycle,'active') else null end
    ) returning id into v_id;
  else
    v_version:=coalesce((p_input->>'expected_version')::integer,0);
    update public.maintenance_locations set
      parent_location_id=case when v_kind='equipment' then nullif(p_input->>'parent_location_id','')::uuid else null end,
      kind=v_kind,name=btrim(p_input->>'name'),description=nullif(btrim(p_input->>'description'),''),
      display_order=coalesce((p_input->>'display_order')::integer,display_order),is_active=coalesce((p_input->>'is_active')::boolean,is_active),
      asset_tag=case when v_kind='equipment' then nullif(btrim(p_input->>'asset_tag'),'') else null end,
      manufacturer=case when v_kind='equipment' then nullif(btrim(p_input->>'manufacturer'),'') else null end,
      model=case when v_kind='equipment' then nullif(btrim(p_input->>'model'),'') else null end,
      serial_number=case when v_kind='equipment' then nullif(btrim(p_input->>'serial_number'),'') else null end,
      installed_on=case when v_kind='equipment' then nullif(p_input->>'installed_on','')::date else null end,
      warranty_ends_on=case when v_kind='equipment' then nullif(p_input->>'warranty_ends_on','')::date else null end,
      supplier_id=case when v_kind='equipment' then nullif(p_input->>'supplier_id','')::uuid else null end,
      contract_id=case when v_kind='equipment' then nullif(p_input->>'contract_id','')::uuid else null end,
      lifecycle_status=case when v_kind='equipment' then coalesce(nullif(p_input->>'lifecycle_status','')::public.maintenance_asset_lifecycle,lifecycle_status,'active') else null end,
      version=version+1,updated_at=now()
    where id=p_id and hotel_id=p_hotel_id and version=v_version returning id into v_id;
    if v_id is null then
      if exists(select 1 from public.maintenance_locations where id=p_id and hotel_id=p_hotel_id) then return jsonb_build_object('result','conflict'); end if;
      return jsonb_build_object('result','not_found');
    end if;
  end if;
  return jsonb_build_object('result','ok','id',v_id);
exception when unique_violation or foreign_key_violation or check_violation then return jsonb_build_object('result','invalid');
end $$;

-- A liberação técnica exige todas as ordens encerradas; o trigger já cria a inspeção de governança atomicamente.
create or replace function public.release_maintenance_room_block(
  p_hotel_id uuid,p_block_id uuid,p_actor_id uuid,p_reason text
) returns uuid language plpgsql set search_path=public as $$
declare v_block public.room_blocks%rowtype;
begin
  if char_length(btrim(coalesce(p_reason,'')))<3 then raise exception 'Justificativa obrigatória.' using errcode='23514'; end if;
  select * into v_block from public.room_blocks where id=p_block_id and hotel_id=p_hotel_id for update;
  if not found or v_block.maintenance_occurrence_id is null then return null; end if;
  if v_block.released_at is not null then raise exception 'Bloqueio já liberado.' using errcode='23514'; end if;
  if exists(select 1 from public.maintenance_work_orders where occurrence_id=v_block.maintenance_occurrence_id and status not in('completed','canceled')) then
    raise exception 'Há ordens de serviço pendentes.' using errcode='23514';
  end if;
  if exists(select 1 from public.maintenance_work_orders w where w.occurrence_id=v_block.maintenance_occurrence_id and w.requires_inspection and w.status='completed'
    and not exists(select 1 from public.maintenance_inspections i where i.work_order_id=w.id and i.result='approved')) then
    raise exception 'Há inspeções técnicas obrigatórias pendentes.' using errcode='23514';
  end if;
  update public.room_blocks set released_at=now(),released_by=p_actor_id,release_reason=btrim(p_reason) where id=p_block_id;
  insert into public.maintenance_events(hotel_id,occurrence_id,actor_id,event_type,message,metadata)
  values(p_hotel_id,v_block.maintenance_occurrence_id,p_actor_id,'room_block_released',btrim(p_reason),jsonb_build_object('block_id',p_block_id,'governance_inspection_created',true));
  perform public.recompute_maintenance_occurrence_status(v_block.maintenance_occurrence_id);
  return v_block.maintenance_occurrence_id;
end $$;

create table public.cash_management_settings (
  hotel_id uuid primary key references public.hotels(id) on delete cascade,
  daily_close_started_on date not null,
  activated_at timestamptz not null default now(),
  activated_by uuid references public.users(id),
  updated_at timestamptz not null default now()
);

create function public.activate_daily_close_obligation()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.active then
    insert into public.cash_management_settings(hotel_id,daily_close_started_on,activated_by)
    values(new.hotel_id,public.hotel_operational_date(new.hotel_id),new.created_by)
    on conflict(hotel_id) do nothing;
  end if;
  return new;
end $$;
create trigger cash_register_activates_daily_close after insert or update of active on public.cash_registers
for each row execute function public.activate_daily_close_obligation();

create function public.redact_cash_session(p_session jsonb,p_actor_id uuid,p_can_approve boolean)
returns jsonb language sql immutable set search_path=public as $$
  select case
    when p_session->>'status' in('open','counting')
      and ((p_session->>'operator_id')::uuid=p_actor_id or not p_can_approve)
    then jsonb_set(p_session,'{expected_cash}','null'::jsonb)
    else p_session end
$$;

create function public.list_cash_registers_for_actor(p_hotel_id uuid,p_actor_id uuid,p_can_approve boolean)
returns jsonb language sql stable set search_path=public as $$
  select jsonb_build_object('registers',coalesce(jsonb_agg(
    to_jsonb(r)||jsonb_build_object(
      'consumption_point_name',cp.name,
      'active_session',(select public.redact_cash_session(to_jsonb(s)||jsonb_build_object(
        'operator_name',u.name,'movement_totals',coalesce((select jsonb_object_agg(x.kind,x.total) from(
          select kind::text,sum(cash_delta) total from public.cash_movements where cash_session_id=s.id group by kind
        )x),'{}'::jsonb)),p_actor_id,p_can_approve)
        from public.cash_sessions s left join public.users u on u.id=s.operator_id
        where s.cash_register_id=r.id and s.status in('open','counting','difference_pending') limit 1)
    ) order by r.name),'[]'::jsonb))
  from public.cash_registers r left join public.consumption_points cp on cp.id=r.consumption_point_id
  where r.hotel_id=p_hotel_id
$$;

create function public.get_cash_session_for_actor(p_hotel_id uuid,p_id uuid,p_actor_id uuid,p_can_approve boolean)
returns jsonb language sql stable set search_path=public as $$
  select coalesce((select public.redact_cash_session(to_jsonb(s)||jsonb_build_object(
    'register_name',r.name,'operator_name',u.name,
    'movements',(select coalesce(jsonb_agg(to_jsonb(m) order by m.occurred_at),'[]'::jsonb) from public.cash_movements m where m.cash_session_id=s.id),
    'counts',case when s.status in('open','counting') then '[]'::jsonb else (select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at),'[]'::jsonb) from public.cash_session_counts c where c.cash_session_id=s.id) end
  ),p_actor_id,p_can_approve) from public.cash_sessions s join public.cash_registers r on r.id=s.cash_register_id left join public.users u on u.id=s.operator_id where s.hotel_id=p_hotel_id and s.id=p_id),'{}'::jsonb)
$$;

create or replace function public.open_cash_session(p_hotel_id uuid,p_register_id uuid,p_actor_id uuid,p_input jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare v_id uuid;v_date date;v_fp text:=md5(p_input::text);v_float numeric;
begin
  if not exists(select 1 from public.cash_registers where id=p_register_id and hotel_id=p_hotel_id and active for update) then return jsonb_build_object('result','not_found'); end if;
  v_date:=public.hotel_operational_date(p_hotel_id);v_float:=(p_input->>'opening_float')::numeric;
  insert into public.cash_sessions(hotel_id,cash_register_id,operator_id,business_date,opening_float,expected_cash,idempotency_key,request_fingerprint)
  values(p_hotel_id,p_register_id,p_actor_id,v_date,v_float,v_float,(p_input->>'idempotency_key')::uuid,v_fp) returning id into v_id;
  if v_float>0 then insert into public.cash_movements(hotel_id,cash_session_id,kind,amount,cash_delta,reason,idempotency_key,request_fingerprint,actor_id)
    values(p_hotel_id,v_id,'opening_float',v_float,v_float,'Fundo inicial',gen_random_uuid(),v_fp,p_actor_id); end if;
  return jsonb_build_object('result','ok','id',v_id);
exception when unique_violation then return jsonb_build_object('result','active_session_exists');
end $$;

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
  'cash_sessions',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('operator_name',u.name,'closed_by_name',cu.name) order by s.opened_at)
    from public.cash_sessions s left join public.users u on u.id=s.operator_id left join public.users cu on cu.id=s.closed_by
    where s.hotel_id=p_hotel_id and s.business_date=p_business_date),'[]'::jsonb),
  'blockers',coalesce((select jsonb_agg(to_jsonb(blockers)) from blockers),'[]'::jsonb)
) from totals
$$;

create function public.get_daily_close_for_actor(p_hotel_id uuid,p_business_date date,p_actor_id uuid,p_can_approve boolean)
returns jsonb language plpgsql stable set search_path=public as $$
declare v_close jsonb;v_projection jsonb;v_sessions jsonb;
begin
  select to_jsonb(c)||jsonb_build_object('prepared_by_name',pu.name,'approved_by_name',au.name)
  into v_close from public.daily_closes c left join public.users pu on pu.id=c.prepared_by left join public.users au on au.id=c.approved_by
  where c.hotel_id=p_hotel_id and c.business_date=p_business_date;
  v_projection:=public.daily_close_projection(p_hotel_id,p_business_date);
  select coalesce(jsonb_agg(public.redact_cash_session(value,p_actor_id,p_can_approve)),'[]'::jsonb) into v_sessions
  from jsonb_array_elements(v_projection->'cash_sessions');
  return jsonb_build_object('close',v_close,'projection',jsonb_set(v_projection,'{cash_sessions}',v_sessions));
end $$;

alter function public.reconcile_operational_pending(uuid,timestamptz)
rename to reconcile_operational_pending_before_training;
create function public.reconcile_operational_pending(p_hotel_id uuid,p_now timestamptz default null)
returns jsonb language plpgsql set search_path=public as $$
declare v_now timestamptz:=coalesce(p_now,public.hotel_operational_now(p_hotel_id));v_start date;v_date date;
begin
  v_date:=(v_now at time zone (select timezone from public.hotels where id=p_hotel_id))::date;
  select daily_close_started_on into v_start from public.cash_management_settings where hotel_id=p_hotel_id;
  if v_start is not null and v_start<v_date then
    insert into public.daily_closes(hotel_id,business_date)
    select p_hotel_id,d::date from generate_series(v_start::timestamp,(v_date-1)::timestamp,interval '1 day') d
    on conflict(hotel_id,business_date) do nothing;
  end if;
  return public.reconcile_operational_pending_before_training(p_hotel_id,v_now);
end $$;

alter function public.operational_pending_candidates(uuid,timestamptz)
rename to operational_pending_candidates_before_training;
create function public.operational_pending_candidates(p_hotel_id uuid,p_now timestamptz default null)
returns jsonb language plpgsql stable set search_path=public as $$
declare v_now timestamptz:=coalesce(p_now,public.hotel_operational_now(p_hotel_id));v_base jsonb;
begin
  v_base:=public.operational_pending_candidates_before_training(p_hotel_id,v_now);
  return coalesce((select jsonb_agg(
    case
      when item->>'kind'='daily_close' then jsonb_set(item,'{href}',to_jsonb('/dashboard/cash?date='||(item->>'due_on')||'#daily-close'))
      when item->>'kind'='governance_maintenance' then jsonb_set(item,'{href}',to_jsonb(coalesce((
        select '/dashboard/maintenance/occurrences/'||b.maintenance_occurrence_id
        from public.governance_cycles c join public.room_blocks b on b.room_id=c.room_id and b.hotel_id=c.hotel_id and b.released_at is null
        where c.id=(item->>'entity_id')::uuid and b.maintenance_occurrence_id is not null order by b.created_at desc limit 1
      ),item->>'href')))
      else item end
  ) from jsonb_array_elements(v_base) item
  where not(
    item->>'kind'='daily_close' and not exists(
      select 1 from public.cash_management_settings s
      where s.hotel_id=p_hotel_id
        and (item->>'due_on')::date>=s.daily_close_started_on
    )
  ) and not(
    item->>'kind'='warranty_expiry' and (
      not exists(
        select 1 from public.maintenance_locations l
        where l.hotel_id=p_hotel_id and l.id=(item->>'entity_id')::uuid
          and l.kind='equipment' and l.is_active
          and l.warranty_ends_on>=(v_now at time zone (select timezone from public.hotels where id=p_hotel_id))::date
      ) or exists(
        select 1 from public.maintenance_warranty_decisions d
        join public.maintenance_locations l on l.id=d.location_id and l.hotel_id=d.hotel_id
        where d.hotel_id=p_hotel_id and d.location_id=(item->>'entity_id')::uuid
          and d.warranty_ends_on=l.warranty_ends_on
          and not exists(select 1 from public.maintenance_warranty_decisions newer where newer.supersedes_id=d.id)
      )
    )
  )),'[]'::jsonb);
end $$;

create function public.list_booking_channel_reference_data(p_hotel_id uuid)
returns jsonb language sql stable set search_path=public as $$
  select jsonb_build_object(
    'room_types',coalesce((select jsonb_agg(jsonb_build_object('value',room_type,'label',room_type,'room_count',room_count) order by room_type)
      from(select room_type,count(*) room_count from public.rooms where hotel_id=p_hotel_id group by room_type)x),'[]'::jsonb),
    'rate_plans',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'code',p.code,'name',p.name,'version',v.version_number,'channels',v.channels) order by p.name)
      from public.rate_plans p join public.rate_plan_versions v on v.id=p.active_version_id and v.hotel_id=p.hotel_id
      where p.hotel_id=p_hotel_id and p.status='active' and ('channel'=any(v.channels) or 'external'=any(v.channels))),'[]'::jsonb)
  )
$$;

create or replace function public.get_governance_cycle(p_hotel_id uuid,p_cycle_id uuid)
returns jsonb language sql stable set search_path=public as $$
select jsonb_build_object(
  'id',c.id,'hotel_id',c.hotel_id,'room_id',c.room_id,'room_number',r.room_number,
  'stay_id',c.stay_id,'status',c.status,'source',c.source,'version',c.version,
  'next_arrival_at',(select s.checkin_date_expected from public.stays s where s.room_id=c.room_id and s.stay_status='confirmed' and s.checkin_date_expected>=public.hotel_operational_now(p_hotel_id) order by s.checkin_date_expected limit 1),
  'severity',case
    when exists(select 1 from public.stays s where s.room_id=c.room_id and s.stay_status='confirmed' and s.checkin_date_expected::date<=public.hotel_operational_date(p_hotel_id)) then 'critical'
    when exists(select 1 from public.stays s where s.room_id=c.room_id and s.stay_status='confirmed' and s.checkin_date_expected<=public.hotel_operational_now(p_hotel_id)+interval '24 hours') then 'warning'
    else 'info' end,
  'last_updated_at',c.updated_at,'released_at',c.released_at,
  'maintenance_occurrence_id',b.maintenance_occurrence_id,
  'maintenance_occurrence_code',case when o.id is null then null else 'MAN-'||lpad(o.occurrence_number::text,6,'0') end,
  'maintenance_block_id',b.id,
  'maintenance_href',case when o.id is null then null else '/dashboard/maintenance/occurrences/'||o.id end,
  'maintenance_next_step',case when c.status='maintenance_hold' then 'Aguardando liberação técnica da manutenção.' when c.status='inspection_pending' and c.source='maintenance' then 'Aguardando inspeção final da governança.' else null end,
  'tasks',coalesce((select jsonb_agg(jsonb_build_object(
    'id',t.id,'kind',t.kind,'status',t.status,'assigned_to',t.assigned_to,'assignee_name',u.name,
    'next_action',t.next_action,'version',t.version,'started_at',t.started_at,'completed_at',t.completed_at,
    'checklist',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'label',i.label,'display_order',i.display_order,'required',i.required,'result',i.result,'notes',i.notes) order by i.display_order) from public.governance_task_checklist_items i where i.task_id=t.id),'[]'::jsonb)
  ) order by t.created_at) from public.governance_tasks t left join public.users u on u.id=t.assigned_to where t.cycle_id=c.id),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'action',e.action,'message',e.message,'actor_name',u.name,'created_at',e.created_at) order by e.created_at desc) from public.governance_events e left join public.users u on u.id=e.actor_id where e.cycle_id=c.id),'[]'::jsonb)
)
from public.governance_cycles c
join public.rooms r on r.id=c.room_id
left join lateral (
  select rb.* from public.room_blocks rb where rb.hotel_id=c.hotel_id and rb.room_id=c.room_id
    and rb.maintenance_occurrence_id is not null order by (rb.released_at is null) desc,rb.created_at desc limit 1
) b on true
left join public.maintenance_occurrences o on o.id=b.maintenance_occurrence_id and o.hotel_id=c.hotel_id
where c.hotel_id=p_hotel_id and c.id=p_cycle_id
$$;

create or replace function public.process_maintenance_expiry_alerts(p_hotel_id uuid, p_local_date date)
returns integer language plpgsql set search_path=public as $$
declare v_item record; v_days integer; v_count integer:=0;
begin
  for v_item in
    select id,contract_number as label,ends_on as expires_on
    from public.maintenance_contracts
    where hotel_id=p_hotel_id and status='active' and ends_on-p_local_date in(30,7,0)
  loop
    v_days:=v_item.expires_on-p_local_date;
    v_count:=v_count+public.notify_maintenance_managers(
      p_hotel_id,'contract_expiry',case when v_days=0 then 'critical' else 'warning' end,
      'Vigência contratual','O contrato '||v_item.label||case when v_days=0 then ' vence hoje.' else ' vence em '||v_days||' dias.' end,
      '/dashboard/maintenance/suppliers?contract='||v_item.id,'contract',v_item.id,v_days::text
    );
  end loop;
  for v_item in
    select l.id,l.name as label,l.warranty_ends_on as expires_on
    from public.maintenance_locations l
    where l.hotel_id=p_hotel_id and l.kind='equipment' and l.is_active
      and l.warranty_ends_on-p_local_date in(30,7,0)
      and not exists(
        select 1 from public.maintenance_warranty_decisions d
        where d.hotel_id=l.hotel_id and d.location_id=l.id
          and d.warranty_ends_on=l.warranty_ends_on
          and not exists(select 1 from public.maintenance_warranty_decisions replacement where replacement.supersedes_id=d.id)
      )
  loop
    v_days:=v_item.expires_on-p_local_date;
    v_count:=v_count+public.notify_maintenance_managers(
      p_hotel_id,'warranty_expiry',case when v_days=0 then 'critical' else 'warning' end,
      'Garantia de equipamento','A garantia de '||v_item.label||case when v_days=0 then ' vence hoje.' else ' vence em '||v_days||' dias.' end,
      '/dashboard/maintenance/settings?location='||v_item.id,'location',v_item.id,v_days::text
    );
  end loop;
  update public.maintenance_contracts set status='expired'
  where hotel_id=p_hotel_id and status='active' and ends_on<p_local_date;
  return v_count;
end $$;

insert into public.permissions(name,type) values
  ('manage_training_environment','HOTEL_PERMISSION'),
  ('manage_maintenance_warranties','HOTEL_PERMISSION')
on conflict(name) do nothing;

alter table public.hotel_training_environments enable row level security;
alter table public.hotel_training_clock_events enable row level security;
alter table public.maintenance_warranty_decisions enable row level security;
alter table public.cash_management_settings enable row level security;
revoke all on public.hotel_training_environments,public.hotel_training_clock_events,
  public.maintenance_warranty_decisions,public.cash_management_settings from public,anon,authenticated;
grant all on public.hotel_training_environments,public.hotel_training_clock_events,
  public.maintenance_warranty_decisions,public.cash_management_settings to service_role;
grant usage on type public.training_clock_mode,
  public.maintenance_warranty_decision_result to postgres,service_role;

grant execute on function public.hotel_operational_now(uuid),public.hotel_operational_date(uuid),
  public.get_training_environment(uuid),public.act_training_clock(uuid,uuid,jsonb),
  public.prepare_training_scenario(uuid,text,integer,text,uuid),
  public.list_maintenance_warranty_decisions(uuid,uuid),public.record_maintenance_warranty_decision(uuid,uuid,uuid,jsonb),
  public.save_maintenance_location(uuid,uuid,uuid,jsonb),public.release_maintenance_room_block(uuid,uuid,uuid,text),
  public.list_cash_registers_for_actor(uuid,uuid,boolean),public.get_cash_session_for_actor(uuid,uuid,uuid,boolean),
  public.get_daily_close_for_actor(uuid,date,uuid,boolean),public.reconcile_operational_pending(uuid,timestamptz),
  public.operational_pending_candidates(uuid,timestamptz),public.list_booking_channel_reference_data(uuid)
to service_role;
