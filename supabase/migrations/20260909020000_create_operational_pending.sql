create table public.operational_pending (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id),
  source text not null check(source in ('maintenance','consumption')),
  source_key text not null,
  kind text not null,
  entity_type text not null,
  entity_id uuid not null,
  episode integer not null check(episode>0),
  title text not null,
  href text not null,
  severity text not null check(severity in ('info','warning','critical')),
  status text not null default 'open' check(status in ('open','claimed','resolved')),
  assigned_to uuid references public.users(id),
  version integer not null default 1,
  opened_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_reason text,
  due_on date,
  unique(hotel_id,source_key,episode),
  unique(hotel_id,id),
  check((status='claimed')=(assigned_to is not null)),
  check((status='resolved')=(resolved_at is not null))
);
create unique index operational_pending_active on public.operational_pending(hotel_id,source_key) where status<>'resolved';
create table public.operational_pending_reads (
  hotel_id uuid not null, pending_id uuid not null, user_id uuid not null references public.users(id),
  read_at timestamptz not null default now(), primary key(pending_id,user_id),
  foreign key(hotel_id,pending_id) references public.operational_pending(hotel_id,id)
);
create table public.operational_pending_events (
  id uuid primary key default gen_random_uuid(), hotel_id uuid not null, pending_id uuid not null,
  actor_id uuid references public.users(id), action text not null check(action in ('created','claimed','released','resolved')),
  created_at timestamptz not null default now(),
  foreign key(hotel_id,pending_id) references public.operational_pending(hotel_id,id)
);
create table public.operational_pending_sync (
  hotel_id uuid primary key references public.hotels(id),
  last_success_at timestamptz, last_attempt_at timestamptz, error_message text
);
create trigger operational_pending_events_immutable before update or delete
on public.operational_pending_events for each row execute function public.prevent_maintenance_event_mutation();
alter table public.operational_pending enable row level security;
alter table public.operational_pending_reads enable row level security;
alter table public.operational_pending_events enable row level security;
alter table public.operational_pending_sync enable row level security;
revoke all on public.operational_pending, public.operational_pending_reads, public.operational_pending_events, public.operational_pending_sync from anon, authenticated;
grant all on public.operational_pending, public.operational_pending_reads, public.operational_pending_events, public.operational_pending_sync to service_role;

-- Apenas candidatos realmente ativos; notificações históricas não bastam para manter pendências.
create function public.operational_pending_candidates(p_hotel_id uuid, p_now timestamptz default now())
returns jsonb language plpgsql set search_path=public as $$
declare v_alerts jsonb; v_result jsonb := '[]'; v_alert jsonb; v_row record; v_date date; v_key text;
begin
  select (p_now at time zone timezone)::date into v_date from public.hotels where id=p_hotel_id and is_active;
  if v_date is null then raise exception 'Hotel inválido'; end if;
  v_alerts := public.get_management_alerts(p_hotel_id);
  if v_alerts->>'result' is distinct from 'ok' then raise exception 'Falha na origem gerencial'; end if;
  if exists(select 1 from unnest(array['guest_balances','critical_stock','expiring_agreements','pending_settlements']) key where jsonb_typeof(v_alerts->key) is distinct from 'array') then raise exception 'Resposta incompleta da origem gerencial'; end if;
  for v_alert in select value from jsonb_array_elements((v_alerts->'guest_balances')||(v_alerts->'critical_stock')||(v_alerts->'expiring_agreements')||(v_alerts->'pending_settlements')) loop
    v_key := v_alert->>'id';
    if v_alert->>'kind'='pending_settlement' then
      select partner_id,period_start into v_row from public.partner_settlements
        where hotel_id=p_hotel_id and id=(v_alert->>'entity_id')::uuid;
      if found then
        -- The legacy alert switches from partner/month to settlement ID on approval.
        -- Preserve the shared episode, reading and owner through that transition.
        v_key := 'settlement-'||v_row.partner_id||'-'||v_row.period_start;
        v_alert := v_alert || jsonb_build_object('entity_id',v_row.partner_id);
      end if;
    end if;
    v_result := v_result || jsonb_build_array(v_alert || jsonb_build_object('source','consumption','source_key',v_key,'entity_type',v_alert->>'kind'));
  end loop;
  for v_row in
    select distinct on(n.kind,n.entity_id) n.*,
      case n.kind when 'contract_expiry' then c.ends_on when 'warranty_expiry' then l.warranty_ends_on end expires_on
    from public.maintenance_notifications n
    left join public.maintenance_occurrences o on n.entity_type='occurrence' and o.id=n.entity_id and o.hotel_id=p_hotel_id
    left join public.maintenance_preventive_runs r on n.entity_type='preventive_run' and r.id=n.entity_id and r.hotel_id=p_hotel_id
    left join public.maintenance_contracts c on n.kind='contract_expiry' and c.id=n.entity_id and c.hotel_id=p_hotel_id
    left join public.maintenance_locations l on n.kind='warranty_expiry' and l.id=n.entity_id and l.hotel_id=p_hotel_id
    where n.hotel_id=p_hotel_id and (
      (n.kind='sla_response' and o.status<>'canceled' and o.triaged_at is null and p_now>=o.created_at+(o.sla_response_due_at-o.created_at)*0.75)
      or (n.kind='sla_resolution' and o.status<>'canceled' and o.operational_resolved_at is null and p_now>=o.created_at+(o.sla_resolution_due_at-o.created_at)*0.75)
      or (n.kind='preventive_deferred' and r.status='deferred')
      or (n.kind='contract_expiry' and c.status='active' and c.ends_on between v_date and v_date+30)
      or (n.kind='warranty_expiry' and l.is_active and l.warranty_ends_on between v_date and v_date+30)
    ) order by n.kind,n.entity_id,n.created_at desc
  loop
    v_result := v_result || jsonb_build_array(jsonb_build_object('source','maintenance','source_key',v_row.kind||':'||v_row.entity_id,
      'kind',v_row.kind,'entity_type',v_row.entity_type,'entity_id',v_row.entity_id,'title',v_row.title,'href',v_row.href,'severity',v_row.severity,'due_on',v_row.expires_on));
  end loop;
  return v_result;
end; $$;

create function public.reconcile_operational_pending(p_hotel_id uuid, p_now timestamptz default now())
returns jsonb language plpgsql set search_path=public as $$
declare v_candidates jsonb; v_item jsonb; v_id uuid; v_episode integer; v_old record;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_hotel_id::text,714));
  insert into public.operational_pending_sync(hotel_id,last_attempt_at) values(p_hotel_id,p_now)
    on conflict(hotel_id) do update set last_attempt_at=p_now;
  begin
    -- Atualização manual também emite marcos recém-atingidos, sem gerar preventivas.
    perform public.process_maintenance_sla_alerts(p_hotel_id,p_now);
    perform public.process_maintenance_expiry_alerts(p_hotel_id,(p_now at time zone (select timezone from public.hotels where id=p_hotel_id))::date);
    v_candidates := public.operational_pending_candidates(p_hotel_id,p_now);
    for v_item in select value from jsonb_array_elements(v_candidates) loop
      select id into v_id from public.operational_pending where hotel_id=p_hotel_id and source_key=v_item->>'source_key' and status<>'resolved' for update;
      if v_id is null then
        select coalesce(max(episode),0)+1 into v_episode from public.operational_pending where hotel_id=p_hotel_id and source_key=v_item->>'source_key';
        insert into public.operational_pending(hotel_id,source,source_key,kind,entity_type,entity_id,episode,title,href,severity,due_on,opened_at,updated_at)
        values(p_hotel_id,v_item->>'source',v_item->>'source_key',v_item->>'kind',v_item->>'entity_type',(v_item->>'entity_id')::uuid,v_episode,v_item->>'title',v_item->>'href',v_item->>'severity',(v_item->>'due_on')::date,p_now,p_now) returning id into v_id;
        insert into public.operational_pending_events(hotel_id,pending_id,action) values(p_hotel_id,v_id,'created');
      else
        update public.operational_pending set title=v_item->>'title',href=v_item->>'href',severity=v_item->>'severity',due_on=(v_item->>'due_on')::date,updated_at=p_now
        where id=v_id and (title,href,severity,due_on) is distinct from (v_item->>'title',v_item->>'href',v_item->>'severity',(v_item->>'due_on')::date);
      end if;
    end loop;
    for v_old in select * from public.operational_pending p where hotel_id=p_hotel_id and status<>'resolved'
      and not exists(select 1 from jsonb_array_elements(v_candidates) c where c->>'source_key'=p.source_key) for update
    loop
      update public.operational_pending set status='resolved',assigned_to=null,resolved_at=p_now,updated_at=p_now,version=version+1,
      resolution_reason=case when v_old.kind in ('agreement_expiry','contract_expiry','warranty_expiry') and v_old.due_on<(p_now at time zone (select timezone from public.hotels where id=p_hotel_id))::date then 'Fim da vigência; não indica renovação.' else 'A condição de origem deixou de existir.' end where id=v_old.id;
      insert into public.operational_pending_events(hotel_id,pending_id,action) values(p_hotel_id,v_old.id,'resolved');
    end loop;
    update public.operational_pending_sync set last_success_at=p_now,error_message=null where hotel_id=p_hotel_id;
    return jsonb_build_object('result','ok');
  exception when others then
    update public.operational_pending_sync set error_message='Não foi possível sincronizar as origens. Pendências anteriores preservadas.' where hotel_id=p_hotel_id;
    return jsonb_build_object('result','failed');
  end;
end; $$;

create function public.can_read_operational_pending(p public.operational_pending, p_user_id uuid, p_permissions text[])
returns boolean language sql stable set search_path=public as $$
  select public.maintenance_user_has_hotel_scope(p_user_id,p.hotel_id) and case
    when p.source='maintenance' then exists(select 1 from public.maintenance_notifications n where n.hotel_id=p.hotel_id and n.recipient_id=p_user_id and n.kind=p.kind and n.entity_id=p.entity_id)
      and p_permissions && array['read_maintenance','execute_maintenance','triage_maintenance','manage_maintenance_plans','manage_maintenance_sla','read_maintenance_analytics','manage_maintenance_suppliers']
    when p.kind='guest_balance' then p_permissions && array['read_consumption_analytics','access_reservations_calendar']
    when p.kind='critical_stock' then p_permissions && array['read_consumption_analytics','read_inventory']
    when p.kind='agreement_expiry' then p_permissions && array['read_consumption_analytics','read_commercial_partners']
    when p.kind='pending_settlement' then p_permissions && array['read_partner_settlements','prepare_partner_settlements','approve_partner_settlements','settle_partner_settlements']
    else false end;
$$;

create function public.list_operational_pending(p_hotel_id uuid,p_user_id uuid,p_permissions text[],p_filters jsonb default '{}')
returns jsonb language sql stable set search_path=public as $$
  with visible as (
    select p.*,r.read_at,u.name assignee_name from public.operational_pending p
    left join public.operational_pending_reads r on r.pending_id=p.id and r.user_id=p_user_id
    left join public.users u on u.id=p.assigned_to
    where p.hotel_id=p_hotel_id and public.can_read_operational_pending(p,p_user_id,p_permissions)
  ), filtered as (
    select * from visible where
      (coalesce(p_filters->>'source','')='' or source=p_filters->>'source') and
      (coalesce(p_filters->>'kind','')='' or kind=p_filters->>'kind') and
      (coalesce(p_filters->>'severity','')='' or severity=p_filters->>'severity') and
      (coalesce(p_filters->>'status','')='' or status=p_filters->>'status') and
      (coalesce(p_filters->>'assignee','')='' or (p_filters->>'assignee'='me' and assigned_to=p_user_id) or (p_filters->>'assignee'='unassigned' and status='open')) and
      (coalesce(p_filters->>'read','')='' or (p_filters->>'read'='read' and read_at is not null) or (p_filters->>'read'='unread' and read_at is null))
  ), paged as (
    select * from filtered order by case severity when 'critical' then 0 when 'warning' then 1 else 2 end,opened_at,id
    limit 30 offset (greatest(1,coalesce((p_filters->>'page')::integer,1))-1)*30
  ) select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object(
    'id',id,'source',source,'kind',kind,'entity_id',entity_id,'title',title,'href',case
      when source='consumption' and (
        (kind='guest_balance' and not ('access_reservations_calendar'=any(p_permissions))) or
        (kind='critical_stock' and not ('read_inventory'=any(p_permissions))) or
        (kind='agreement_expiry' and not ('read_commercial_partners'=any(p_permissions)))
      ) then '/dashboard/consumption/analytics' else href end,'severity',severity,'status',status,
    'assigned_to',assigned_to,'assignee_name',assignee_name,'version',version,'opened_at',opened_at,'resolved_at',resolved_at,'resolution_reason',resolution_reason,'read',read_at is not null
  )) from paged),'[]'::jsonb),'total',(select count(*) from filtered),
  'summary',jsonb_build_object('open',(select count(*) from filtered where status='open'),'claimed',(select count(*) from filtered where status='claimed'),'resolved',(select count(*) from filtered where status='resolved'),'unread',(select count(*) from filtered where read_at is null and status<>'resolved')),
  'sync',jsonb_build_object('last_success_at',(select last_success_at from public.operational_pending_sync where hotel_id=p_hotel_id),'error_message',(select error_message from public.operational_pending_sync where hotel_id=p_hotel_id)));
$$;

create function public.act_operational_pending(p_hotel_id uuid,p_user_id uuid,p_permissions text[],p_ids uuid[],p_action text,p_version integer default null)
returns jsonb language plpgsql set search_path=public as $$
declare v_item public.operational_pending%rowtype; v_id uuid;
begin
  if p_action not in ('read','unread','claim','release') or coalesce(array_length(p_ids,1),0) not between 1 and 100 then return jsonb_build_object('result','invalid'); end if;
  if p_action in ('claim','release') and (array_length(p_ids,1)<>1 or p_version is null) then return jsonb_build_object('result','invalid'); end if;
  -- Valida todo o lote antes de gravar qualquer leitura.
  for v_id in select unnest(p_ids) order by 1 loop
    select * into v_item from public.operational_pending where id=v_id and hotel_id=p_hotel_id for update;
    if not found or not public.can_read_operational_pending(v_item,p_user_id,p_permissions) then return jsonb_build_object('result','not_found'); end if;
  end loop;
  if p_action in ('claim','release') then
    if v_item.version<>p_version or (p_action='claim' and v_item.status<>'open') or (p_action='release' and (v_item.status<>'claimed' or v_item.assigned_to<>p_user_id)) then return jsonb_build_object('result','conflict'); end if;
    update public.operational_pending set status=case when p_action='claim' then 'claimed' else 'open' end,
      assigned_to=case when p_action='claim' then p_user_id else null end,version=version+1,updated_at=now() where id=v_item.id;
    insert into public.operational_pending_events(hotel_id,pending_id,actor_id,action) values(p_hotel_id,v_item.id,p_user_id,case when p_action='claim' then 'claimed' else 'released' end);
  elsif p_action='read' then
    insert into public.operational_pending_reads(hotel_id,pending_id,user_id) select p_hotel_id,id,p_user_id from unnest(p_ids) id on conflict(pending_id,user_id) do update set read_at=now();
  else
    delete from public.operational_pending_reads where hotel_id=p_hotel_id and user_id=p_user_id and pending_id=any(p_ids);
  end if;
  return jsonb_build_object('result','ok');
end; $$;

revoke all on function public.operational_pending_candidates(uuid,timestamptz), public.reconcile_operational_pending(uuid,timestamptz),public.can_read_operational_pending(public.operational_pending,uuid,text[]),public.list_operational_pending(uuid,uuid,text[],jsonb),public.act_operational_pending(uuid,uuid,text[],uuid[],text,integer) from public,anon,authenticated;
grant execute on function public.operational_pending_candidates(uuid,timestamptz), public.reconcile_operational_pending(uuid,timestamptz),public.can_read_operational_pending(public.operational_pending,uuid,text[]),public.list_operational_pending(uuid,uuid,text[],jsonb),public.act_operational_pending(uuid,uuid,text[],uuid[],text,integer) to service_role;

create or replace function public.process_maintenance_management_cycle(
  p_now timestamptz default now(), p_hotel_id uuid default null, p_force boolean default false
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_hotel record; v_run_id uuid; v_key text; v_started timestamptz; v_preventive jsonb; v_sla integer; v_expiry integer; v_total jsonb := '[]'::jsonb;
begin
  for v_hotel in select id, timezone, (p_now at time zone timezone)::date local_date from public.hotels where p_hotel_id is null or id = p_hotel_id
  loop
    v_key := 'management:' || v_hotel.id || ':' || to_char(
      date_trunc('hour', p_now) + make_interval(mins => (extract(minute from p_now)::integer / 15) * 15),
      'YYYYMMDDHH24MI'
    ) || case when p_force then ':' || gen_random_uuid()::text else '' end;
    insert into public.maintenance_automation_runs(hotel_id, run_key, status, trigger_kind, local_date)
    values (v_hotel.id, v_key, 'running', case when p_force then 'manual' else 'scheduled' end, v_hotel.local_date)
    on conflict (run_key) do nothing returning id, started_at into v_run_id, v_started;
    if v_run_id is null then continue; end if;
    begin
      v_preventive := public.process_maintenance_preventive_plans(v_hotel.id, p_now);
      v_sla := public.process_maintenance_sla_alerts(v_hotel.id, p_now);
      v_expiry := public.process_maintenance_expiry_alerts(v_hotel.id, v_hotel.local_date);
      perform public.reconcile_operational_pending(v_hotel.id,p_now);
      update public.maintenance_automation_runs set status = 'completed', finished_at = clock_timestamp(),
        duration_ms = (extract(epoch from (clock_timestamp() - v_started)) * 1000)::integer,
        counters = v_preventive || jsonb_build_object('sla_notifications', v_sla, 'expiry_notifications', v_expiry)
      where id = v_run_id;
      v_total := v_total || jsonb_build_array(jsonb_build_object('hotel_id', v_hotel.id, 'run_id', v_run_id, 'status', 'completed'));
    exception when others then
      insert into public.operational_pending_sync(hotel_id,last_attempt_at,error_message)
      values(v_hotel.id,p_now,'Não foi possível sincronizar as origens. Pendências anteriores preservadas.')
      on conflict(hotel_id) do update set last_attempt_at=p_now,error_message=excluded.error_message;
      update public.maintenance_automation_runs set status = 'failed', finished_at = clock_timestamp(),
        duration_ms = (extract(epoch from (clock_timestamp() - v_started)) * 1000)::integer, error_message = sqlerrm
      where id = v_run_id;
      v_total := v_total || jsonb_build_array(jsonb_build_object('hotel_id', v_hotel.id, 'run_id', v_run_id, 'status', 'failed'));
    end;
  end loop;
  return v_total;
end;
$$;
