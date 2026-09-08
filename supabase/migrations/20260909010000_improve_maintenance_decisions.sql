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
  p_notes := nullif(btrim(p_notes), '');
  p_diagnosis := nullif(btrim(p_diagnosis), '');
  if length(p_notes)>4000 or length(p_diagnosis)>4000 then raise exception 'Texto excede 4000 caracteres.' using errcode='23514'; end if;
  if p_action in ('pause','wait','complete','cancel','reopen') and p_notes is null then
    raise exception 'Informe o motivo ou serviço realizado.' using errcode='23514';
  end if;
  if p_action='complete' and p_diagnosis is null then raise exception 'Informe o diagnóstico.' using errcode='23514'; end if;
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
    if exists (
      select 1 from public.maintenance_work_order_checklist_items
      where work_order_id = p_work_order_id and is_required and completed_at is null
    ) then raise exception 'Há itens obrigatórios do checklist pendentes.' using errcode = '23514'; end if;
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

-- Serialização por hotel evita ciclos entre duas marcações concorrentes.
create or replace function public.guard_maintenance_duplicate()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.duplicate_of_id is null then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.hotel_id::text, 713));
  if new.duplicate_of_id=new.id or not exists (
    select 1 from public.maintenance_occurrences target
    where target.id=new.duplicate_of_id and target.hotel_id=new.hotel_id and target.duplicate_of_id is null
  ) or exists(select 1 from public.maintenance_occurrences source where source.duplicate_of_id=new.id) then
    raise exception 'Destino duplicado, cíclico ou fora do hotel.' using errcode='23514';
  end if;
  return new;
end; $$;
create trigger trg_guard_maintenance_duplicate before insert or update of duplicate_of_id
on public.maintenance_occurrences for each row execute function public.guard_maintenance_duplicate();
revoke all on function public.guard_maintenance_duplicate() from public, anon, authenticated;

create or replace function public.apply_maintenance_occurrence_change(
  p_hotel_id uuid, p_occurrence_id uuid, p_actor_id uuid, p_patch jsonb,
  p_event_type text, p_message text default null
)
returns boolean language plpgsql set search_path = public as $$
declare
  v_current public.maintenance_occurrences%rowtype;
  v_next public.maintenance_occurrences%rowtype;
begin
  p_message := nullif(btrim(p_message), '');
  if p_event_type in ('occurrence_canceled','occurrence_reopened','occurrence_marked_duplicate') and (p_message is null or length(p_message)<3 or length(p_message)>2000) then raise exception 'Justificativa deve conter entre 3 e 2000 caracteres.' using errcode='23514'; end if;
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

create or replace function public.inspect_maintenance_work_order(
  p_hotel_id uuid, p_work_order_id uuid, p_actor_id uuid,
  p_result public.maintenance_inspection_result, p_notes text
)
returns uuid language plpgsql set search_path = public as $$
declare v_order public.maintenance_work_orders%rowtype;
begin
  p_notes := nullif(btrim(p_notes), '');
  if p_notes is null or length(p_notes)<3 or length(p_notes)>2000 then raise exception 'Observação deve conter entre 3 e 2000 caracteres.' using errcode='23514'; end if;
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
