-- QA-020: carimbos de ação, como aprovação, fechamento e entrega, usavam o tempo real e divergiam do
-- dia operacional no hotel-escola. Passam a usar o relógio do hotel, conforme
-- docs/training/time-contract.md. Criação, atualização, leitura de aviso e links externos continuam
-- no tempo real; operational_clock_stamps.test.sql mantém a lista do que pode usar now().
CREATE OR REPLACE FUNCTION public.act_business_organization(p_hotel_id uuid, p_id uuid, p_actor_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ declare v public.business_organizations%rowtype;v_target public.business_organizations%rowtype;v_new uuid;v_role text:=p_input->>'role_type';v_role_id uuid:=(p_input->>'role_id')::uuid;
begin select * into v from public.business_organizations where id=p_id and hotel_id=p_hotel_id for update;if not found then return jsonb_build_object('result','not_found');end if;if v.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict');end if;if nullif(btrim(p_input->>'reason'),'') is null then return jsonb_build_object('result','reason_required');end if;
 if p_input->>'action'='merge' then select * into v_target from public.business_organizations where id=(p_input->>'target_id')::uuid and hotel_id=p_hotel_id for update;if not found or v_target.id=v.id then return jsonb_build_object('result','invalid_target');end if;
  update public.commercial_partners set organization_id=v_target.id where organization_id=v.id;update public.maintenance_suppliers set organization_id=v_target.id where organization_id=v.id;update public.corporate_accounts set organization_id=v_target.id where organization_id=v.id;update public.procurement_suppliers set organization_id=v_target.id where organization_id=v.id;update public.business_organizations set active=false,version=version+1,updated_at=now() where id=v.id;
 elsif p_input->>'action'='split' then
  insert into public.business_organizations(hotel_id,legal_name,trade_name,currency,email,phone,created_by) values(p_hotel_id,v.legal_name,v.trade_name,v.currency,v.email,v.phone,p_actor_id) returning id into v_new;
  if v_role='commercial_partner' then update public.commercial_partners set organization_id=v_new where id=v_role_id and hotel_id=p_hotel_id and organization_id=v.id;
  elsif v_role='maintenance_supplier' then update public.maintenance_suppliers set organization_id=v_new where id=v_role_id and hotel_id=p_hotel_id and organization_id=v.id;
  elsif v_role='corporate_account' then update public.corporate_accounts set organization_id=v_new where id=v_role_id and hotel_id=p_hotel_id and organization_id=v.id;
  elsif v_role='stock_supplier' then update public.procurement_suppliers set organization_id=v_new where id=v_role_id and hotel_id=p_hotel_id and organization_id=v.id;else return jsonb_build_object('result','invalid_role');end if;if not found then return jsonb_build_object('result','role_not_found');end if;
 elsif p_input->>'action'='resolve_conflict' then
  update public.business_organization_conflicts set status='resolved',version=version+1,resolved_by=p_actor_id,resolution_reason=btrim(p_input->>'reason'),resolved_at=public.hotel_operational_now(p_hotel_id)
  where id=(p_input->>'conflict_id')::uuid and organization_id=v.id and hotel_id=p_hotel_id and status='open';if not found then return jsonb_build_object('result','conflict_not_found');end if;
 else return jsonb_build_object('result','invalid_action');end if;
 update public.business_organizations set version=version+1,updated_at=now() where id=p_id;insert into public.business_organization_events(hotel_id,organization_id,action,actor_id,reason,details) values(p_hotel_id,p_id,p_input->>'action',p_actor_id,btrim(p_input->>'reason'),jsonb_build_object('target_id',coalesce((p_input->>'target_id')::uuid,v_new),'role_type',v_role,'role_id',v_role_id));return jsonb_build_object('result','ok','id',coalesce(v_new,(p_input->>'target_id')::uuid));exception when unique_violation then return jsonb_build_object('result','role_conflict');end $function$
;

CREATE OR REPLACE FUNCTION public.act_cash_session(p_hotel_id uuid, p_id uuid, p_actor_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ declare v public.cash_sessions%rowtype;v_register public.cash_registers%rowtype;v_diff numeric;v_new uuid;
begin select * into v from public.cash_sessions where id=p_id and hotel_id=p_hotel_id for update;if not found then return jsonb_build_object('result','not_found');end if;if v.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict');end if;select * into v_register from public.cash_registers where id=v.cash_register_id;
 if p_input->>'action'='count' and v.status in('open','counting') and v.operator_id=p_actor_id then
  if (p_input->>'counted_amount') is null then return jsonb_build_object('result','count_required');end if;v_diff:=(p_input->>'counted_amount')::numeric-v.expected_cash;
  insert into public.cash_session_counts(hotel_id,cash_session_id,counted_amount,expected_amount,difference_amount,reason,actor_id) values(p_hotel_id,p_id,(p_input->>'counted_amount')::numeric,v.expected_cash,v_diff,p_input->>'reason',p_actor_id);
  update public.cash_sessions set counted_cash=(p_input->>'counted_amount')::numeric,difference_amount=v_diff,counted_at=public.hotel_operational_now(p_hotel_id),status=case when abs(v_diff)>v_register.difference_tolerance then 'difference_pending'::public.cash_session_status else 'closed' end,closed_at=case when abs(v_diff)<=v_register.difference_tolerance then public.hotel_operational_now(p_hotel_id) end,closed_by=case when abs(v_diff)<=v_register.difference_tolerance then p_actor_id end,version=version+1,updated_at=now() where id=p_id;
 elsif p_input->>'action'='approve_difference' and v.status='difference_pending' and v.operator_id<>p_actor_id and nullif(btrim(p_input->>'reason'),'') is not null then update public.cash_sessions set status='closed',closed_at=public.hotel_operational_now(p_hotel_id),closed_by=p_actor_id,version=version+1,updated_at=now() where id=p_id;
 elsif p_input->>'action'='request_recount' and v.status='difference_pending' and v.operator_id<>p_actor_id and nullif(btrim(p_input->>'reason'),'') is not null then update public.cash_sessions set status='counting',counted_cash=null,difference_amount=null,version=version+1,updated_at=now() where id=p_id;
 elsif p_input->>'action'='handoff' and v.status='open' and v.operator_id=p_actor_id and (p_input->>'next_operator_id') is not null and (p_input->>'counted_amount')::numeric=v.expected_cash then
  if not exists(select 1 from public.user_roles ur join public.role_permissions rp on rp.role_id=ur.role_id join public.permissions perm on perm.id=rp.permission_id
    where ur.user_id=(p_input->>'next_operator_id')::uuid and ur.hotel_id=p_hotel_id and perm.name='operate_cash_register') then return jsonb_build_object('result','invalid_operator');end if;
  update public.cash_sessions set status='closed',counted_cash=v.expected_cash,difference_amount=0,counted_at=public.hotel_operational_now(p_hotel_id),closed_at=public.hotel_operational_now(p_hotel_id),closed_by=p_actor_id,version=version+1 where id=p_id;
  insert into public.cash_sessions(hotel_id,cash_register_id,operator_id,business_date,opening_float,expected_cash,idempotency_key,request_fingerprint) values(p_hotel_id,v.cash_register_id,(p_input->>'next_operator_id')::uuid,v.business_date,v.expected_cash,v.expected_cash,(p_input->>'idempotency_key')::uuid,md5(p_input::text)) returning id into v_new;
  insert into public.cash_movements(hotel_id,cash_session_id,kind,amount,cash_delta,reason,idempotency_key,request_fingerprint,actor_id) values(p_hotel_id,v_new,'opening_float',v.expected_cash,v.expected_cash,'Saldo recebido na troca de operador',gen_random_uuid(),md5(p_input::text),(p_input->>'next_operator_id')::uuid);
 elsif p_input->>'action'='cancel' and v.status='open' and not exists(select 1 from public.cash_movements where cash_session_id=p_id and kind<>'opening_float') and nullif(btrim(p_input->>'reason'),'') is not null then update public.cash_sessions set status='canceled',closed_at=public.hotel_operational_now(p_hotel_id),closed_by=p_actor_id,version=version+1 where id=p_id;
 else return jsonb_build_object('result','invalid_transition');end if;return jsonb_build_object('result','ok','id',coalesce(v_new,p_id),'expected_cash',v.expected_cash,'difference',v_diff);end $function$
;

CREATE OR REPLACE FUNCTION public.act_consumption_service_order(p_hotel_id uuid, p_order_id uuid, p_actor_id uuid, p_action text, p_expected_version integer, p_assignee_id uuid, p_reason text, p_next_action text, p_idempotency_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
    update public.consumption_service_orders set status='canceled',canceled_at=public.hotel_operational_now(p_hotel_id),version=version+1,updated_at=now() where id=p_order_id;
    update public.consumption_service_stock_reservations set status='released',released_at=public.hotel_operational_now(p_hotel_id)
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
        v_result:=public.post_consumption_order(p_hotel_id,v_order.stay_id,v_order.point_id,p_actor_id,public.hotel_operational_now(p_hotel_id),'charged',
          v_group.billing_mode,v_group.items,v_child_key,v_order.guest_customer_id,v_group.payment_method,v_group.payment_reference,
          v_group.billing_mode='partner_direct','Pedido '||p_order_id::text,null);
        if v_result->>'result'<>'ok' then raise exception '%',v_result->>'result' using errcode='P0001'; end if;
        v_order_ids:=array_append(v_order_ids,(v_result->>'order_id')::uuid);
        insert into public.consumption_service_order_links(hotel_id,service_order_id,consumption_order_id)
          values(p_hotel_id,p_order_id,(v_result->>'order_id')::uuid) on conflict do nothing;
      end loop;
      update public.consumption_service_stock_reservations set status='consumed',released_at=public.hotel_operational_now(p_hotel_id)
        where service_order_id=p_order_id and status='reserved';
      update public.consumption_service_orders set status='delivered',delivered_at=public.hotel_operational_now(p_hotel_id),delivery_idempotency_key=p_idempotency_key,
        delivery_fingerprint=v_delivery_fingerprint,version=version+1,updated_at=now() where id=p_order_id;
    exception when sqlstate 'P0001' then
      return jsonb_build_object('result',sqlerrm,'context',jsonb_build_object('status','ready'));
    end;
  else return jsonb_build_object('result','invalid_action'); end if;
  insert into public.consumption_service_order_events(hotel_id,service_order_id,action,actor_id,details)
    values(p_hotel_id,p_order_id,p_action,p_actor_id,jsonb_strip_nulls(jsonb_build_object('reason',nullif(btrim(p_reason),''),'next_action',nullif(btrim(p_next_action),''),'assignee_id',p_assignee_id)));
  return jsonb_build_object('result','ok','order_ids',to_jsonb(v_order_ids),'created',true);
end; $function$
;

CREATE OR REPLACE FUNCTION public.act_corporate_credit_authorization(p_hotel_id uuid, p_id uuid, p_actor_id uuid, p_action text, p_expected_version integer, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_auth public.corporate_credit_authorizations%rowtype;v_status public.corporate_credit_status;
begin
  select * into v_auth from public.corporate_credit_authorizations where id=p_id and hotel_id=p_hotel_id for update;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if v_auth.version<>p_expected_version then return jsonb_build_object('result','version_conflict'); end if;
  if length(coalesce(btrim(p_reason),''))<3 then return jsonb_build_object('result','invalid'); end if;
  v_status:=case when p_action='submit' and v_auth.status='draft' then 'submitted'
    when p_action='approve' and v_auth.status='submitted' then 'approved'
    when p_action='reject' and v_auth.status='submitted' then 'rejected'
    when p_action='revoke' and v_auth.status='approved' then 'revoked' else null end;
  if v_status is null then return jsonb_build_object('result','invalid_state'); end if;
  if p_action in ('approve','reject') and v_auth.requested_by=p_actor_id then return jsonb_build_object('result','segregation_required'); end if;
  update public.corporate_credit_authorizations set status=v_status,version=version+1,updated_at=now(),
    decided_by=case when p_action in ('approve','reject') then p_actor_id else decided_by end,
    decided_at=case when p_action in ('approve','reject') then public.hotel_operational_now(p_hotel_id) else decided_at end,
    decision_reason=case when p_action in ('approve','reject') then btrim(p_reason) else decision_reason end where id=p_id;
  insert into public.corporate_credit_events(hotel_id,entity_type,entity_id,action,actor_id,details) values(p_hotel_id,'authorization',p_id,p_action,p_actor_id,jsonb_build_object('reason',btrim(p_reason)));
  return jsonb_build_object('result','ok','status',v_status,'version',v_auth.version+1);
end $function$
;

CREATE OR REPLACE FUNCTION public.act_daily_close(p_hotel_id uuid, p_business_date date, p_actor_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ declare v public.daily_closes%rowtype;v_current text;
begin select * into v from public.daily_closes where hotel_id=p_hotel_id and business_date=p_business_date for update;if not found then return jsonb_build_object('result','not_found');end if;if v.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict');end if;if v.prepared_by=p_actor_id then return jsonb_build_object('result','segregation_required');end if;v_current:=md5(public.daily_close_projection(p_hotel_id,p_business_date)::text);if p_input->>'action'='approve' and (v_current<>p_input->>'expected_fingerprint' or v_current<>v.fingerprint) then return jsonb_build_object('result','projection_changed');end if;
 if p_input->>'action'='approve' and v.status='prepared' then update public.daily_closes set status='closed',approved_by=p_actor_id,approved_at=public.hotel_operational_now(p_hotel_id),version=version+1,updated_at=now() where id=v.id;
 elsif p_input->>'action'='reject' and v.status='prepared' and nullif(btrim(p_input->>'reason'),'') is not null then update public.daily_closes set status='rejected',rejection_reason=btrim(p_input->>'reason'),version=version+1,updated_at=now() where id=v.id;
 else return jsonb_build_object('result','invalid_transition');end if;insert into public.daily_close_events(hotel_id,daily_close_id,action,actor_id,reason) values(p_hotel_id,v.id,p_input->>'action',p_actor_id,btrim(p_input->>'reason'));return jsonb_build_object('result','ok');end $function$
;

CREATE OR REPLACE FUNCTION public.act_governance_cycle(p_hotel_id uuid, p_cycle_id uuid, p_actor_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
  elsif v_action='start' and v_task.status='assigned' and v_task.assigned_to=p_actor_id then update public.governance_tasks set status='in_progress',started_at=coalesce(started_at,public.hotel_operational_now(p_hotel_id)),version=version+1,updated_at=now() where id=v_task.id; update public.governance_cycles set status=case when v_task.kind='cleaning' then 'cleaning_in_progress' else status end where id=p_cycle_id;
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
    update public.governance_tasks set status='completed',assigned_to=null,completed_at=public.hotel_operational_now(p_hotel_id),completed_by=p_actor_id,version=version+1,updated_at=now() where id=v_task.id;
    if v_task.kind='cleaning' then update public.governance_cycles set status='inspection_pending' where id=p_cycle_id; perform public.governance_create_task(p_hotel_id,p_cycle_id,'inspection');
    elsif v_task.kind='inspection' then update public.governance_cycles set status='released',released_at=public.hotel_operational_now(p_hotel_id),released_by=p_actor_id,release_reason=coalesce(v_note,'Inspeção aprovada') where id=p_cycle_id;
    elsif v_task.kind='departure_review' and exists(select 1 from public.stays where id=v_cycle.stay_id and stay_status='checked_out') then update public.governance_cycles set status='cleaning_pending' where id=p_cycle_id; perform public.governance_create_task(p_hotel_id,p_cycle_id,'cleaning'); end if;
  elsif v_action='reject' and v_task.kind='inspection' and v_task.assigned_to=p_actor_id and v_note is not null then
    if exists(select 1 from public.governance_task_checklist_items i where i.task_id=v_task.id and i.required and not exists(
      select 1 from jsonb_array_elements(coalesce(p_input->'answers','[]'::jsonb)) a where a->>'item_id'=i.id::text and a->>'result' in ('approved','rejected','not_applicable')
    )) then return jsonb_build_object('result','checklist_incomplete'); end if;
    if not exists(select 1 from jsonb_array_elements(coalesce(p_input->'answers','[]'::jsonb)) a where a->>'result'='rejected') then return jsonb_build_object('result','invalid_transition'); end if;
    if exists(select 1 from jsonb_array_elements(coalesce(p_input->'answers','[]'::jsonb)) a where a->>'result'='rejected' and nullif(btrim(a->>'notes'),'') is null) then return jsonb_build_object('result','rejection_note_required'); end if;
    for v_answer in select value from jsonb_array_elements(coalesce(p_input->'answers','[]'::jsonb)) loop update public.governance_task_checklist_items set result=(v_answer->>'result')::public.governance_check_result,notes=nullif(btrim(v_answer->>'notes'),'') where id=(v_answer->>'item_id')::uuid and task_id=v_task.id; end loop;
    update public.governance_tasks set status='completed',assigned_to=null,completed_at=public.hotel_operational_now(p_hotel_id),completed_by=p_actor_id,version=version+1,updated_at=now() where id=v_task.id;
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
end $function$
;

CREATE OR REPLACE FUNCTION public.act_inventory_lot(p_hotel_id uuid, p_lot_id uuid, p_actor_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ declare v_bal record; v_qty numeric:=(p_input->>'quantity')::numeric; v_pos record; v_doc uuid; v_move uuid;
begin select b.*,p.quantity position_quantity,p.product_id,p.location_id from public.inventory_lot_balances b join public.inventory_positions p on p.id=b.position_id where b.lot_id=p_lot_id and b.position_id=(p_input->>'position_id')::uuid and b.hotel_id=p_hotel_id for update into v_bal;
 if not found then return jsonb_build_object('result','not_found'); end if; if v_bal.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict'); end if; if v_qty>v_bal.quantity then return jsonb_build_object('result','invalid_quantity'); end if;
 if p_input->>'action'<>'discard' then return jsonb_build_object('result','invalid_action'); end if;
 insert into public.inventory_documents(hotel_id,kind,reason,occurred_at,posted_by,idempotency_key,request_fingerprint,metadata) values(p_hotel_id,'loss',btrim(p_input->>'reason'),public.hotel_operational_now(p_hotel_id),p_actor_id,(p_input->>'idempotency_key')::uuid,md5(p_input::text),jsonb_build_object('lot_id',p_lot_id)) returning id into v_doc;
 insert into public.inventory_movements(hotel_id,position_id,product_id,location_id,kind,quantity_delta,quantity_before,quantity_after,average_unit_cost,total_cost,reason,occurred_at,actor_id,document_id,metadata)
 select p_hotel_id,v_bal.position_id,v_bal.product_id,v_bal.location_id,'loss',-v_qty,v_bal.position_quantity,v_bal.position_quantity-v_qty,average_unit_cost,v_qty*average_unit_cost,btrim(p_input->>'reason'),public.hotel_operational_now(p_hotel_id),p_actor_id,v_doc,jsonb_build_object('lot_id',p_lot_id) from public.inventory_positions where id=v_bal.position_id returning id into v_move;
 update public.inventory_positions set quantity=quantity-v_qty,version=version+1,updated_at=now() where id=v_bal.position_id;
 if not exists(select 1 from public.inventory_lot_balances where lot_id=p_lot_id and quantity>0) then update public.inventory_lots set status='disposed',disposed_at=public.hotel_operational_now(p_hotel_id),disposed_by=p_actor_id where id=p_lot_id; end if;
 return jsonb_build_object('result','ok'); end $function$
;

CREATE OR REPLACE FUNCTION public.act_maintenance_lifecycle_decision(p_hotel_id uuid, p_decision_id uuid, p_actor_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
  update public.maintenance_lifecycle_decisions set status=v_next,submitted_at=case when v_action='submit' then public.hotel_operational_now(p_hotel_id) else submitted_at end,approved_by=case when v_action in ('approve','reject') then p_actor_id else approved_by end,approved_at=case when v_action in ('approve','reject') then public.hotel_operational_now(p_hotel_id) else approved_at end,selected_option_id=case when v_action='approve' then v_selected else selected_option_id end,decision_reason=btrim(p_input->>'reason'),executed_by=case when v_action='execute' then p_actor_id else executed_by end,executed_at=case when v_action='execute' then public.hotel_operational_now(p_hotel_id) else executed_at end,replacement_location_id=case when v_action='execute' then nullif(p_input->>'replacement_location_id','')::uuid else replacement_location_id end,version=version+1 where id=v.id;
  if v_action='execute' and (select kind from public.maintenance_lifecycle_options where id=v.selected_option_id)='replace' and nullif(p_input->>'replacement_location_id','') is not null then update public.maintenance_locations set lifecycle_status='retired' where id=(select location_id from public.maintenance_occurrences where id=v.occurrence_id) and hotel_id=p_hotel_id; end if;
  insert into public.maintenance_events(hotel_id,occurrence_id,actor_id,event_type,message,metadata) values(p_hotel_id,v.occurrence_id,p_actor_id,'lifecycle_'||v_action,btrim(p_input->>'reason'),jsonb_build_object('decision_id',v.id,'status',v_next,'selected_option_id',v_selected));
  return jsonb_build_object('result','ok');
end $function$
;

CREATE OR REPLACE FUNCTION public.act_maintenance_recurrence_group(p_hotel_id uuid, p_group_id uuid, p_actor_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v public.maintenance_recurrence_groups%rowtype; v_target uuid:=nullif(p_input->>'target_group_id','')::uuid; v_action text:=p_input->>'action'; v_occurrence uuid;
begin
  select * into v from public.maintenance_recurrence_groups where id=p_group_id and hotel_id=p_hotel_id for update;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if v.status<>'active' or nullif(btrim(p_input->>'reason'),'') is null then return jsonb_build_object('result','conflict'); end if;
  if v_action='merge' then
    if v_target is null or v_target=v.id or not exists(select 1 from public.maintenance_recurrence_groups where id=v_target and hotel_id=p_hotel_id and status='active') then return jsonb_build_object('result','invalid'); end if;
    insert into public.maintenance_recurrence_members(hotel_id,group_id,occurrence_id,linked_by,link_reason) select p_hotel_id,v_target,occurrence_id,p_actor_id,btrim(p_input->>'reason') from public.maintenance_recurrence_members where group_id=v.id on conflict do nothing;
    update public.maintenance_recurrence_groups g set occurrence_count=(select count(*) from public.maintenance_recurrence_members where group_id=v_target),first_occurrence_at=(select min(o.created_at) from public.maintenance_recurrence_members m join public.maintenance_occurrences o on o.id=m.occurrence_id where m.group_id=v_target),last_occurrence_at=(select max(o.created_at) from public.maintenance_recurrence_members m join public.maintenance_occurrences o on o.id=m.occurrence_id where m.group_id=v_target) where g.id=v_target;
    update public.maintenance_recurrence_groups set status='closed',review_reason=btrim(p_input->>'reason'),reviewed_by=p_actor_id,reviewed_at=public.hotel_operational_now(p_hotel_id) where id=v.id;
  elsif v_action in ('false_positive','close') then
    update public.maintenance_recurrence_groups set status=case when v_action='false_positive' then 'false_positive' else 'closed' end,review_reason=btrim(p_input->>'reason'),reviewed_by=p_actor_id,reviewed_at=public.hotel_operational_now(p_hotel_id) where id=v.id;
  else return jsonb_build_object('result','invalid'); end if;
  select occurrence_id into v_occurrence from public.maintenance_recurrence_members where group_id=v.id order by created_at limit 1;
  if v_occurrence is not null then insert into public.maintenance_events(hotel_id,occurrence_id,actor_id,event_type,message,metadata) values(p_hotel_id,v_occurrence,p_actor_id,'recurrence_'||v_action,btrim(p_input->>'reason'),jsonb_build_object('group_id',v.id,'target_group_id',v_target)); end if;
  return jsonb_build_object('result','ok');
end $function$
;

CREATE OR REPLACE FUNCTION public.act_partner_settlement_dispute(p_hotel_id uuid, p_id uuid, p_actor_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ declare v public.partner_settlement_disputes%rowtype;v_open integer;
begin select * into v from public.partner_settlement_disputes where id=p_id and hotel_id=p_hotel_id for update;if not found then return jsonb_build_object('result','not_found');end if;if v.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict');end if;if v.opened_by=p_actor_id then return jsonb_build_object('result','segregation_required');end if;
 if p_input->>'action' in('accept','reject','cancel') and v.status='open' then update public.partner_settlement_disputes set status=case p_input->>'action' when 'accept' then 'accepted' when 'reject' then 'rejected' else 'canceled' end,decided_by=p_actor_id,decision_reason=btrim(p_input->>'reason'),resolved_at=public.hotel_operational_now(p_hotel_id),version=version+1,updated_at=now() where id=p_id;else return jsonb_build_object('result','invalid_transition');end if;
 select count(*) into v_open from public.partner_settlement_disputes where settlement_id=v.settlement_id and status='open';update public.partner_settlements set dispute_state=case when v_open=0 then 'resolved' else 'disputed' end,version=version+1,updated_at=now() where id=v.settlement_id;
 insert into public.partner_settlement_events(hotel_id,settlement_id,action,actor_id,details) values(p_hotel_id,v.settlement_id,'dispute_'||(p_input->>'action'),p_actor_id,jsonb_build_object('dispute_id',p_id,'reason',p_input->>'reason'));return jsonb_build_object('result','ok');end $function$
;

CREATE OR REPLACE FUNCTION public.act_post_checkout_consumption_case(p_hotel_id uuid, p_case_id uuid, p_actor_id uuid, p_action text, p_expected_version integer, p_reason text, p_result text, p_promised_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_case public.post_checkout_consumption_cases%rowtype;v_status public.post_checkout_consumption_status;v_order uuid:=gen_random_uuid();v_amount numeric;v_stay record;v_item record;
begin
  select * into v_case from public.post_checkout_consumption_cases where id=p_case_id and hotel_id=p_hotel_id for update;if not found then return jsonb_build_object('result','not_found');end if;
  if v_case.version<>p_expected_version then return jsonb_build_object('result','version_conflict');end if;
  if length(coalesce(btrim(p_reason),''))<3 then return jsonb_build_object('result','invalid');end if;
  v_status:=case when p_action='submit' and v_case.status='draft' then 'submitted' when p_action='approve' and v_case.status='submitted' then 'collection_pending' when p_action='reject' and v_case.status='submitted' then 'rejected' when p_action='record_contact' and v_case.status in('collection_pending','partially_paid') then v_case.status when p_action='dispute' and v_case.status in('collection_pending','partially_paid') then 'disputed' when p_action='resume_collection' and v_case.status='disputed' then 'collection_pending' when p_action='waive' and v_case.status='disputed' then 'waived' when p_action='cancel' and v_case.status in('draft','submitted') then 'canceled' else null end;
  if v_status is null then return jsonb_build_object('result','invalid_state');end if;
  if p_action in('approve','reject','waive') and v_case.created_by=p_actor_id then return jsonb_build_object('result','segregation_required');end if;
  if p_action='approve' then
    if v_case.governance_inspection_id is null and not exists(select 1 from public.post_checkout_consumption_evidence where case_id=p_case_id) then return jsonb_build_object('result','evidence_required');end if;
    select stay.reservation_id,reservation.reservation_code,room.room_number,customer.full_name,hotel.currency into v_stay from public.stays stay join public.reservations reservation on reservation.id=stay.reservation_id join public.rooms room on room.id=stay.room_id join public.customers customer on customer.id=reservation.booking_customer_id join public.hotels hotel on hotel.id=reservation.hotel_id where stay.id=v_case.stay_id;
    select sum(quantity*unit_price) into v_amount from public.post_checkout_consumption_items where case_id=p_case_id;
    insert into public.consumption_orders(id,hotel_id,stay_id,reservation_id,point_id,disposition,billing_mode,currency,gross_amount,net_amount,reservation_code_snapshot,room_number_snapshot,guest_name_snapshot,point_name_snapshot,notes,occurred_at,posted_by,idempotency_key,request_fingerprint,operational_origin)
      select v_order,p_hotel_id,v_case.stay_id,v_stay.reservation_id,(array_agg(point_id order by point_id))[1],'charged','stay_folio',v_stay.currency,v_amount,v_amount,v_stay.reservation_code,v_stay.room_number,v_stay.full_name,'Consumo pós-saída','Conta complementar '||p_case_id,v_case.occurred_at,p_actor_id,gen_random_uuid(),md5(p_case_id::text),'post_checkout' from public.post_checkout_consumption_items where case_id=p_case_id;
    for v_item in select * from public.post_checkout_consumption_items where case_id=p_case_id loop
      insert into public.consumption_order_items(hotel_id,order_id,offer_id,product_id,category_id,commercial_partner_id,commercial_agreement_id,commercial_revision_id,quantity,charged_unit_price,product_name_snapshot,product_kind_snapshot,sales_unit_snapshot,category_name_snapshot,provider_type_snapshot,partner_name_snapshot,agreement_number_snapshot,commercial_terms_snapshot,billing_policy_snapshot,version_token,inventory_controlled_snapshot,inventory_location_id_snapshot)
      values(p_hotel_id,v_order,v_item.offer_id,v_item.product_id,v_item.category_id,v_item.partner_id,v_item.agreement_id,v_item.revision_id,v_item.quantity,v_item.unit_price,v_item.product_name_snapshot,v_item.product_kind_snapshot,v_item.sales_unit_snapshot,v_item.category_name_snapshot,v_item.provider_type_snapshot,(select legal_name from public.commercial_partners where id=v_item.partner_id),(select internal_number from public.commercial_agreements where id=v_item.agreement_id),v_item.commercial_terms_snapshot,v_item.billing_policy_snapshot,v_item.version_token,v_item.inventory_controlled,v_item.inventory_location_id);
    end loop;
    insert into public.consumption_order_events(hotel_id,order_id,action,actor_id,details) values(p_hotel_id,v_order,'post_checkout_approved',p_actor_id,jsonb_build_object('case_id',p_case_id));
    insert into public.post_checkout_supplemental_accounts(hotel_id,case_id,checkout_record_id,amount,currency) values(p_hotel_id,p_case_id,v_case.checkout_record_id,v_amount,v_stay.currency);
  end if;
  update public.post_checkout_consumption_cases set status=v_status,version=version+1,updated_at=now(),consumption_order_id=case when p_action='approve' then v_order else consumption_order_id end,submitted_at=case when p_action='submit' then public.hotel_operational_now(p_hotel_id) else submitted_at end,decided_by=case when p_action in('approve','reject','waive') then p_actor_id else decided_by end,decided_at=case when p_action in('approve','reject','waive') then public.hotel_operational_now(p_hotel_id) else decided_at end,decision_reason=case when p_action in('approve','reject','waive') then btrim(p_reason) else decision_reason end where id=p_case_id;
  insert into public.post_checkout_consumption_events(hotel_id,case_id,action,actor_id,details) values(p_hotel_id,p_case_id,p_action,p_actor_id,jsonb_strip_nulls(jsonb_build_object('reason',btrim(p_reason),'result',nullif(btrim(p_result),''),'promised_at',p_promised_at)));
  return jsonb_build_object('result','ok','status',v_status,'version',v_case.version+1);
end $function$
;

CREATE OR REPLACE FUNCTION public.act_procurement_invoice(p_hotel_id uuid, p_id uuid, p_actor_id uuid, p_action text, p_expected_version integer, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ declare v public.procurement_invoices%rowtype;
begin select * into v from public.procurement_invoices where id=p_id and hotel_id=p_hotel_id for update; if not found then return jsonb_build_object('result','not_found'); end if; if v.version<>p_expected_version then return jsonb_build_object('result','conflict'); end if;
 if nullif(btrim(p_reason),'') is null then return jsonb_build_object('result','reason_required'); end if;
 if p_action='approve' and v.status='draft' and v.created_by<>p_actor_id then update public.procurement_invoices set status='approved',approved_by=p_actor_id,approved_at=public.hotel_operational_now(p_hotel_id),version=version+1,updated_at=now() where id=p_id;
 elsif p_action='accept_exception' and v.status='exception' and v.created_by<>p_actor_id then update public.procurement_discrepancies set status='accepted',decided_by=p_actor_id,decision_reason=btrim(p_reason),resolved_at=public.hotel_operational_now(p_hotel_id) where invoice_id=p_id and status='open'; update public.procurement_invoices set status='approved',approved_by=p_actor_id,approved_at=public.hotel_operational_now(p_hotel_id),version=version+1,updated_at=now() where id=p_id;
 elsif p_action='cancel' and v.status in('draft','exception') then update public.procurement_invoices set status='canceled',version=version+1,updated_at=now() where id=p_id;
 else return jsonb_build_object('result','invalid_transition'); end if; return jsonb_build_object('result','ok'); end $function$
;

CREATE OR REPLACE FUNCTION public.act_rate_plan_version(p_hotel_id uuid, p_version_id uuid, p_actor_id uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$declare v_plan uuid;begin
 select rate_plan_id into v_plan from public.rate_plan_versions where id=p_version_id and hotel_id=p_hotel_id;if not found then return jsonb_build_object('result','not_found');end if;
 if p_action='activate' then update public.rate_plan_versions set activated_at=coalesce(activated_at,public.hotel_operational_now(p_hotel_id)) where id=p_version_id;update public.rate_plans set active_version_id=p_version_id,status='active',updated_at=now() where id=v_plan;elsif p_action='retire' then update public.rate_plans set status='retired',updated_at=now() where id=v_plan;else return jsonb_build_object('result','invalid_action');end if;return jsonb_build_object('result','ok','id',v_plan);end$function$
;

CREATE OR REPLACE FUNCTION public.activate_commercial_agreement_revision(p_hotel_id uuid, p_revision_id uuid, p_actor_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_revision public.commercial_agreement_revisions%rowtype; v_partner uuid;
begin
  perform public.validate_commercial_actor(p_actor_id, p_hotel_id);
  select * into v_revision from public.commercial_agreement_revisions
    where id = p_revision_id and hotel_id = p_hotel_id for update;
  if not found or v_revision.status <> 'draft' then return 'conflict'; end if;
  if not exists (
    select 1 from public.commercial_agreement_revision_points scope
    join public.consumption_points point on point.id = scope.point_id and point.hotel_id = scope.hotel_id
    where scope.revision_id = v_revision.id and point.archived_at is null
  ) then return 'conflict'; end if;
  select agreement.partner_id into v_partner
    from public.commercial_agreements agreement
    join public.commercial_partners partner on partner.id = agreement.partner_id
      and partner.hotel_id = agreement.hotel_id
    where agreement.id = v_revision.agreement_id
      and agreement.hotel_id = p_hotel_id
      and agreement.archived_at is null
      and partner.archived_at is null;
  if not found then return 'conflict'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_hotel_id::text || ':' || v_partner::text, 0));
  if exists (
    select 1 from public.commercial_agreement_revisions current_revision
    where current_revision.agreement_id = v_revision.agreement_id
      and current_revision.status = 'activated'
      and current_revision.starts_on >= v_revision.starts_on
  ) then return 'overlap'; end if;
  if exists (
    select 1 from public.commercial_agreement_revisions other
    join public.commercial_agreements agreement on agreement.id = other.agreement_id
    join public.commercial_agreement_revision_points other_scope on other_scope.revision_id = other.id
    join public.commercial_agreement_revision_points candidate_scope on candidate_scope.revision_id = v_revision.id
      and candidate_scope.point_id = other_scope.point_id
    where agreement.partner_id = v_partner and other.hotel_id = p_hotel_id and other.status = 'activated'
      and other.id <> v_revision.id
      and other.agreement_id <> v_revision.agreement_id
      and daterange(other.starts_on, coalesce(other.ends_on + 1, 'infinity'::date), '[)')
        && daterange(v_revision.starts_on, coalesce(v_revision.ends_on + 1, 'infinity'::date), '[)')
  ) then return 'overlap'; end if;
  perform set_config('app.commercial_revision_transition', 'true', true);
  update public.commercial_agreement_revisions
    set ends_on = v_revision.starts_on - 1, last_changed_by = p_actor_id
    where agreement_id = v_revision.agreement_id and status = 'activated'
      and starts_on < v_revision.starts_on and (ends_on is null or ends_on >= v_revision.starts_on);
  update public.commercial_agreement_revisions set status = 'activated', activated_at = public.hotel_operational_now(p_hotel_id),
    activated_by = p_actor_id, last_changed_by = p_actor_id where id = v_revision.id;
  perform set_config('app.commercial_revision_transition', 'false', true);
  return 'ok';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.apply_correction_inventory_return(p_correction_id uuid, p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
    v_result:=public.apply_inventory_delta(v_position.id,v_correction.hotel_id,v_item.restock_quantity,'return',p_actor_id,public.hotel_operational_now(v_correction.hotel_id),'Retorno aprovado de consumo',null,null,null,null,v_correction.order_id,v_item.order_item_id,v_correction.id);
    if v_result->>'result'<>'ok' then return v_result; end if;
  end loop;
  return jsonb_build_object('result','ok');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.cancel_inventory_count(p_hotel_id uuid, p_actor_id uuid, p_count_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  perform public.inventory_assert_actor(p_actor_id,p_hotel_id);
  update public.inventory_count_sessions set status='canceled',canceled_by=p_actor_id,canceled_at=public.hotel_operational_now(p_hotel_id)
  where id=p_count_id and hotel_id=p_hotel_id and status='draft';
  if not found then return jsonb_build_object('result','count_not_editable'); end if;
  insert into public.inventory_audit_events(hotel_id,entity_type,entity_id,action,actor_id) values(p_hotel_id,'count',p_count_id,'canceled',p_actor_id);
  return jsonb_build_object('result','ok','count_id',p_count_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.complete_inventory_count(p_hotel_id uuid, p_actor_id uuid, p_count_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
      v_result:=public.apply_inventory_delta(v_item.position_id,p_hotel_id,v_delta,case when v_delta>0 then 'count_gain'::public.inventory_movement_kind else 'count_loss'::public.inventory_movement_kind end,p_actor_id,public.hotel_operational_now(p_hotel_id),'Divergência de contagem',null,null,null,p_count_id);
      if v_result->>'result'<>'ok' then raise exception '%',v_result->>'result' using errcode='23514'; end if;
    end if;
  end loop;
  update public.inventory_count_sessions set status='completed',completed_by=p_actor_id,completed_at=public.hotel_operational_now(p_hotel_id) where id=p_count_id;
  insert into public.inventory_audit_events(hotel_id,entity_type,entity_id,action,actor_id) values(p_hotel_id,'count',p_count_id,'completed',p_actor_id);
  return jsonb_build_object('result','ok','count_id',p_count_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.complete_maintenance_checklist_item(p_hotel_id uuid, p_work_order_id uuid, p_item_id uuid, p_actor_id uuid, p_completed boolean, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_occurrence uuid;
begin
  select occurrence_id into v_occurrence from public.maintenance_work_orders
  where id = p_work_order_id and hotel_id = p_hotel_id for update;
  if not found then return null; end if;
  update public.maintenance_work_order_checklist_items set
    completed_by = case when p_completed then p_actor_id else null end,
    completed_at = case when p_completed then public.hotel_operational_now(p_hotel_id) else null end,
    completion_notes = nullif(btrim(p_notes), '')
  where id = p_item_id and work_order_id = p_work_order_id and hotel_id = p_hotel_id;
  if not found then return null; end if;
  insert into public.maintenance_events(hotel_id, occurrence_id, work_order_id, actor_id, event_type, message, metadata)
  values (p_hotel_id, v_occurrence, p_work_order_id, p_actor_id,
    case when p_completed then 'checklist_completed' else 'checklist_reopened' end,
    p_notes, jsonb_build_object('checklist_item_id', p_item_id));
  return v_occurrence;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.complete_partner_correction_refund(p_hotel_id uuid, p_correction_id uuid, p_actor_id uuid, p_reference text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_correction record;
begin
  select * into v_correction from public.consumption_corrections where id = p_correction_id and hotel_id = p_hotel_id for update;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if v_correction.status <> 'awaiting_partner_refund' then return jsonb_build_object('result', 'invalid_status'); end if;
  if not public.maintenance_user_has_hotel_scope(p_actor_id, p_hotel_id) then return jsonb_build_object('result', 'actor_outside_hotel'); end if;
  perform set_config('app.consumption_correction_write', 'on', true);
  update public.consumption_corrections set status = 'completed', completed_by = p_actor_id, completed_at = public.hotel_operational_now(p_hotel_id)
    where id = p_correction_id;
  update public.stays set account_version = account_version + 1 where id = v_correction.stay_id;
  insert into public.consumption_order_events(hotel_id, order_id, action, actor_id, details)
  values (p_hotel_id, v_correction.order_id, 'partner_refund_confirmed', p_actor_id,
    jsonb_build_object('correction_id', p_correction_id, 'reference', nullif(btrim(p_reference), '')));
  insert into public.stay_account_events(hotel_id, stay_id, entity_type, entity_id, action, actor_id, details)
  values (p_hotel_id, v_correction.stay_id, 'consumption_correction', p_correction_id,
    'partner_refund_confirmed', p_actor_id,
    jsonb_build_object('reference', nullif(btrim(p_reference), '')));
  return jsonb_build_object('result', 'ok', 'status', 'completed');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.configure_inventory_position(p_hotel_id uuid, p_actor_id uuid, p_product_id uuid, p_location_id uuid, p_initial_quantity numeric, p_minimum_quantity numeric, p_ideal_quantity numeric, p_average_unit_cost numeric, p_idempotency_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
  values(p_hotel_id,'adjustment','Ativação do controle de estoque',null,public.hotel_operational_now(p_hotel_id),p_actor_id,p_idempotency_key,v_fingerprint,jsonb_build_object('operation','opening')) returning id into v_document_id;
  if p_initial_quantity>0 then
    insert into public.inventory_movements(hotel_id,position_id,product_id,location_id,kind,quantity_delta,quantity_before,quantity_after,average_unit_cost,total_cost,reason,occurred_at,actor_id,document_id)
    values(p_hotel_id,v_position.id,p_product_id,p_location_id,'opening',p_initial_quantity,0,p_initial_quantity,p_average_unit_cost,case when p_average_unit_cost is null then null else p_initial_quantity*p_average_unit_cost end,'Ativação do controle de estoque',public.hotel_operational_now(p_hotel_id),p_actor_id,v_document_id);
  end if;
  return jsonb_build_object('result','ok','position_id',v_position.id,'created',true);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.configure_product_lot_tracking(p_hotel_id uuid, p_product_id uuid, p_actor_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ declare v_mode public.inventory_lot_tracking_mode:=(p_input->>'mode')::public.inventory_lot_tracking_mode; x jsonb; v_total numeric; v_pos record; v_lot uuid;
begin if not exists(select 1 from public.products where id=p_product_id and hotel_id=p_hotel_id and kind='physical') then return jsonb_build_object('result','not_found'); end if;
 if v_mode<>'none' then
  for v_pos in select * from public.inventory_positions where hotel_id=p_hotel_id and product_id=p_product_id for update loop
   select coalesce(sum((lot->>'quantity')::numeric),0) into v_total from jsonb_array_elements(p_input->'initial_lots') lot where (lot->>'position_id')::uuid=v_pos.id;
   if v_total<>v_pos.quantity then return jsonb_build_object('result','initial_distribution_mismatch','context',jsonb_build_object('position_id',v_pos.id,'expected',v_pos.quantity,'actual',v_total)); end if;
  end loop;
  delete from public.inventory_lot_balances where position_id in(select id from public.inventory_positions where hotel_id=p_hotel_id and product_id=p_product_id);
  for x in select value from jsonb_array_elements(p_input->'initial_lots') loop
   if v_mode='lot_expiry' and nullif(x->>'expires_on','') is null then return jsonb_build_object('result','expiry_required'); end if;
   insert into public.inventory_lots(hotel_id,product_id,lot_code,expires_on,received_at) values(p_hotel_id,p_product_id,btrim(x->>'lot_code'),(x->>'expires_on')::date,public.hotel_operational_now(p_hotel_id))
   on conflict(hotel_id,product_id,lot_code) do update set expires_on=excluded.expires_on returning id into v_lot;
   insert into public.inventory_lot_balances(hotel_id,lot_id,position_id,quantity) values(p_hotel_id,v_lot,(x->>'position_id')::uuid,(x->>'quantity')::numeric);
  end loop;
 else delete from public.inventory_lot_balances where position_id in(select id from public.inventory_positions where hotel_id=p_hotel_id and product_id=p_product_id); end if;
 update public.products set lot_tracking_mode=v_mode,expiry_alert_days=(p_input->>'expiry_alert_days')::integer,updated_at=now() where id=p_product_id; return jsonb_build_object('result','ok'); end $function$
;

CREATE OR REPLACE FUNCTION public.create_consumption_benefit_version(p_hotel_id uuid, p_plan_id uuid, p_actor_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_id uuid;v_number integer;v_rule jsonb;v_order integer:=0;
begin
  if not exists(select 1 from public.consumption_benefit_plans where id=p_plan_id and hotel_id=p_hotel_id and archived_at is null) then return jsonb_build_object('result','not_found');end if;
  select coalesce(max(version_number),0)+1 into v_number from public.consumption_benefit_plan_versions where plan_id=p_plan_id;
  if coalesce((p_input->>'activate')::boolean,false) then update public.consumption_benefit_plan_versions set active=false,activated_at=null where plan_id=p_plan_id and active;end if;
  insert into public.consumption_benefit_plan_versions(hotel_id,plan_id,version_number,allowance_scope,active,activated_at,created_by)
  values(p_hotel_id,p_plan_id,v_number,(p_input->>'allowance_scope')::public.consumption_benefit_allowance_scope,coalesce((p_input->>'activate')::boolean,false),case when coalesce((p_input->>'activate')::boolean,false) then public.hotel_operational_now(p_hotel_id) end,p_actor_id) returning id into v_id;
  for v_rule in select value from jsonb_array_elements(p_input->'rules') loop
    insert into public.consumption_benefit_rules(hotel_id,plan_version_id,kind,product_id,category_id,offer_id,point_id,quantity,amount,display_order)
    values(p_hotel_id,v_id,(v_rule->>'kind')::public.consumption_benefit_rule_kind,nullif(v_rule->>'product_id','')::uuid,nullif(v_rule->>'category_id','')::uuid,
      nullif(v_rule->>'offer_id','')::uuid,nullif(v_rule->>'point_id','')::uuid,nullif(v_rule->>'quantity','')::numeric,nullif(v_rule->>'amount','')::numeric,v_order);v_order:=v_order+1;
  end loop;
  return jsonb_build_object('result','ok','version_id',v_id,'version_number',v_number);
end $function$
;

CREATE OR REPLACE FUNCTION public.create_maintenance_occurrence(p_hotel_id uuid, p_category_id uuid, p_room_id uuid DEFAULT NULL::uuid, p_location_id uuid DEFAULT NULL::uuid, p_stay_id uuid DEFAULT NULL::uuid, p_kind maintenance_occurrence_kind DEFAULT 'other'::maintenance_occurrence_kind, p_priority maintenance_priority DEFAULT 'normal'::maintenance_priority, p_description text DEFAULT ''::text, p_discovered_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_reported_by uuid DEFAULT NULL::uuid, p_blocking_recommended boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_id uuid;
begin
  insert into public.maintenance_occurrences(
    hotel_id, category_id, room_id, location_id, stay_id, kind, priority, description,
    discovered_at, reported_by, blocking_recommended, liability_status
  ) values (
    p_hotel_id, p_category_id, p_room_id, p_location_id, p_stay_id, p_kind, p_priority,
    p_description, p_discovered_at, p_reported_by, p_blocking_recommended,
    case when p_kind = 'damage' then 'not_assessed'::public.maintenance_liability_status else 'not_applicable'::public.maintenance_liability_status end
  ) returning id into v_id;
  insert into public.maintenance_events(hotel_id, occurrence_id, actor_id, event_type, message)
  values (p_hotel_id, v_id, p_reported_by, 'occurrence_reported', p_description);
  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_maintenance_room_block(p_hotel_id uuid, p_occurrence_id uuid, p_actor_id uuid, p_start_date date, p_end_date date, p_status room_block_status, p_label text DEFAULT NULL::text, p_conflict_acknowledgement text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_occurrence public.maintenance_occurrences%rowtype;
  v_block_id uuid;
  v_has_conflicts boolean;
begin
  select * into v_occurrence from public.maintenance_occurrences
  where id = p_occurrence_id and hotel_id = p_hotel_id for update;
  if not found or v_occurrence.room_id is null then return null; end if;
  select exists (
    select 1 from public.stays stay
    where stay.room_id = v_occurrence.room_id
      and stay.stay_status not in ('canceled', 'no_show')
      and stay.checkin_date_expected < (p_end_date + 1)::timestamptz
      and stay.checkout_date_expected > p_start_date::timestamptz
  ) into v_has_conflicts;
  if v_has_conflicts and nullif(btrim(p_conflict_acknowledgement), '') is null then
    raise exception 'Há estadias ou reservas conflitantes sem ciência.' using errcode = '23514';
  end if;
  insert into public.room_blocks(
    hotel_id, room_id, maintenance_occurrence_id, created_by, status, label, start_date, end_date,
    conflicts_acknowledged_at, conflicts_acknowledged_by, conflicts_acknowledgement
  ) values (
    p_hotel_id, v_occurrence.room_id, p_occurrence_id, p_actor_id, p_status, coalesce(p_label, 'MAN-' || lpad(v_occurrence.occurrence_number::text, 6, '0')),
    p_start_date, p_end_date, case when v_has_conflicts then public.hotel_operational_now(p_hotel_id) end,
    case when v_has_conflicts then p_actor_id end, case when v_has_conflicts then p_conflict_acknowledgement end
  ) returning id into v_block_id;
  update public.maintenance_work_orders set requires_inspection = true
  where occurrence_id = p_occurrence_id and status not in ('completed', 'canceled');
  insert into public.maintenance_events(hotel_id, occurrence_id, actor_id, event_type, message, metadata)
  values (p_hotel_id, p_occurrence_id, p_actor_id, 'room_block_created', p_label,
    jsonb_build_object('block_id', v_block_id, 'start_date', p_start_date, 'end_date', p_end_date, 'conflicts_acknowledged', v_has_conflicts));
  perform public.recompute_maintenance_occurrence_status(p_occurrence_id);
  return v_block_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.decide_consumption_correction(p_hotel_id uuid, p_correction_id uuid, p_actor_id uuid, p_decision text, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_correction record; v_order record; v_credit_id uuid; v_next public.consumption_correction_status;
  v_open_credit numeric(12,2);
begin
  if not public.maintenance_user_has_hotel_scope(p_actor_id, p_hotel_id) then return jsonb_build_object('result', 'actor_outside_hotel'); end if;
  select * into v_correction from public.consumption_corrections where id = p_correction_id and hotel_id = p_hotel_id for update;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if v_correction.status <> 'pending' then return jsonb_build_object('result', 'invalid_status'); end if;
  if v_correction.requested_by = p_actor_id then return jsonb_build_object('result', 'self_approval'); end if;
  if (select account_version from public.stays where id = v_correction.stay_id) <> v_correction.account_version
    then return jsonb_build_object('result', 'version_conflict'); end if;
  perform set_config('app.consumption_correction_write', 'on', true);
  if p_decision = 'reject' then
    if length(coalesce(btrim(p_reason), '')) < 3 then return jsonb_build_object('result', 'decision_reason_required'); end if;
    update public.consumption_corrections set status = 'rejected', decided_by = p_actor_id,
      decided_at = public.hotel_operational_now(p_hotel_id), decision_reason = btrim(p_reason) where id = p_correction_id;
    v_next := 'rejected';
  elsif p_decision = 'approve' then
    select * into v_order from public.consumption_orders where id = v_correction.order_id;
    if v_order.billing_mode = 'hotel_immediate' then v_next := 'awaiting_refund';
    elsif v_order.billing_mode = 'partner_direct' then v_next := 'awaiting_partner_refund';
    else
      v_next := 'completed';
      if v_order.billing_mode = 'stay_folio' then
        insert into public.stay_folio_entries(hotel_id, stay_id, reservation_id, direction, kind, amount, currency,
          description, consumption_order_id, consumption_correction_id, source_key, posted_by)
        values (p_hotel_id, v_order.stay_id, v_order.reservation_id, 'credit', 'adjustment', v_correction.net_reduction,
          v_order.currency, 'Ajuste de consumo aprovado', v_order.id, v_correction.id,
          'consumption-correction:' || v_correction.id::text, p_actor_id) returning id into v_credit_id;
        perform public.allocate_stay_account_credit(p_hotel_id, v_order.stay_id, v_credit_id, p_actor_id);
        select entry.amount - coalesce(sum(allocation.amount), 0) into v_open_credit
        from public.stay_folio_entries entry
        left join public.stay_folio_allocations allocation on allocation.credit_entry_id = entry.id
        where entry.id = v_credit_id group by entry.id, entry.amount;
        if v_open_credit > 0 then v_next := 'awaiting_refund'; end if;
      else update public.stays set account_version = account_version + 1 where id = v_order.stay_id; end if;
    end if;
    update public.consumption_corrections set status = v_next, decided_by = p_actor_id, decided_at = public.hotel_operational_now(p_hotel_id),
      decision_reason = nullif(btrim(p_reason), ''), completed_by = case when v_next = 'completed' then p_actor_id else null end,
      completed_at = case when v_next = 'completed' then public.hotel_operational_now(p_hotel_id) else null end where id = p_correction_id;
  else return jsonb_build_object('result', 'invalid_decision'); end if;
  insert into public.consumption_order_events(hotel_id, order_id, action, actor_id, details)
  values (p_hotel_id, v_correction.order_id, 'correction_' || p_decision, p_actor_id,
    jsonb_build_object('correction_id', p_correction_id, 'status', v_next));
  insert into public.stay_account_events(hotel_id, stay_id, entity_type, entity_id, action, actor_id, details)
  values (p_hotel_id, v_correction.stay_id, 'consumption_correction', p_correction_id,
    'correction_' || p_decision, p_actor_id, jsonb_build_object('status', v_next));
  return jsonb_build_object('result', 'ok', 'status', v_next);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.decide_maintenance_preventive_run(p_hotel_id uuid, p_run_id uuid, p_actor_id uuid, p_action text, p_reason text, p_rescheduled_for date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_run public.maintenance_preventive_runs%rowtype; v_timezone text; v_local_time time;
begin
  if nullif(btrim(p_reason), '') is null then raise exception 'A justificativa é obrigatória.' using errcode = '23514'; end if;
  select * into v_run from public.maintenance_preventive_runs where id = p_run_id and hotel_id = p_hotel_id for update;
  if not found then return null; end if;
  if p_action = 'generate' then
    return public.generate_maintenance_preventive_run(p_hotel_id, p_run_id, p_actor_id, true, p_reason);
  elsif p_action = 'skip' and v_run.status in ('scheduled', 'deferred', 'rescheduled') then
    update public.maintenance_preventive_runs set status = 'skipped', decision_reason = p_reason, decided_by = p_actor_id, decided_at = public.hotel_operational_now(p_hotel_id) where id = p_run_id;
  elsif p_action = 'reschedule' and v_run.status in ('scheduled', 'deferred', 'rescheduled') and p_rescheduled_for is not null then
    select hotel.timezone, plan.local_time into v_timezone, v_local_time
    from public.maintenance_preventive_plans plan join public.hotels hotel on hotel.id = plan.hotel_id where plan.id = v_run.plan_id;
    update public.maintenance_preventive_runs set
      status = 'rescheduled', decision_reason = p_reason, decided_by = p_actor_id, decided_at = public.hotel_operational_now(p_hotel_id),
      rescheduled_for = p_rescheduled_for,
      scheduled_for = ((p_rescheduled_for::text || ' ' || v_local_time::text)::timestamp at time zone v_timezone)
    where id = p_run_id;
  else raise exception 'Decisão de competência preventiva inválida.' using errcode = '23514'; end if;
  return p_run_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.decide_maintenance_reschedule(p_hotel_id uuid, p_request_id uuid, p_actor_id uuid, p_approved boolean, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v public.maintenance_reschedule_requests%rowtype; v_occ uuid;
begin select * into v from public.maintenance_reschedule_requests where id=p_request_id and hotel_id=p_hotel_id for update; if not found then return jsonb_build_object('result','not_found'); end if; if v.status<>'pending' or nullif(btrim(p_reason),'') is null then return jsonb_build_object('result','conflict'); end if;
  update public.maintenance_reschedule_requests set status=case when p_approved then 'approved'::public.maintenance_reschedule_status else 'rejected'::public.maintenance_reschedule_status end,decided_by=p_actor_id,decision_reason=btrim(p_reason),decided_at=public.hotel_operational_now(p_hotel_id) where id=v.id;
  select occurrence_id into v_occ from public.maintenance_work_orders where id=v.work_order_id; insert into public.maintenance_events(hotel_id,occurrence_id,work_order_id,actor_id,event_type,message,metadata) values(p_hotel_id,v_occ,v.work_order_id,p_actor_id,case when p_approved then 'reschedule_approved' else 'reschedule_rejected' end,btrim(p_reason),jsonb_build_object('request_id',v.id)); return jsonb_build_object('result','ok'); end $function$
;

CREATE OR REPLACE FUNCTION public.decide_partner_settlement(p_hotel_id uuid, p_settlement_id uuid, p_actor_id uuid, p_expected_version bigint, p_decision text, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_settlement public.partner_settlements%rowtype; v_timezone text; v_live text; v_snapshot jsonb; v_operational_date date;
begin
  if not public.maintenance_user_has_hotel_scope(p_actor_id,p_hotel_id) then return jsonb_build_object('result','actor_outside_hotel'); end if;
  select * into v_settlement from public.partner_settlements settlement
  where settlement.id=p_settlement_id and settlement.hotel_id=p_hotel_id for update;
  if not found then return jsonb_build_object('result','not_found'); end if;
  select timezone into v_timezone from public.hotels where id=p_hotel_id;
  v_operational_date:=public.hotel_operational_date(p_hotel_id);
  if v_settlement.status<>'in_review' then return jsonb_build_object('result','settlement_invalid_state'); end if;
  if v_settlement.version<>p_expected_version then return jsonb_build_object('result','settlement_version_conflict'); end if;
  if p_decision='reject' then
    if nullif(btrim(p_reason),'') is null then return jsonb_build_object('result','reason_required'); end if;
    update public.partner_settlements set status='draft',version=version+1,submitted_by=null,submitted_at=null where id=p_settlement_id returning * into v_settlement;
    insert into public.partner_settlement_events(hotel_id,settlement_id,action,actor_id,details)
    values(p_hotel_id,p_settlement_id,'rejected',p_actor_id,jsonb_build_object('reason',btrim(p_reason),'version',v_settlement.version));
    return jsonb_build_object('result','ok','id',p_settlement_id,'version',v_settlement.version);
  end if;
  if p_decision<>'approve' then return jsonb_build_object('result','invalid_decision'); end if;
  if v_settlement.prepared_by=p_actor_id then return jsonb_build_object('result','settlement_self_approval'); end if;
  if v_operational_date<=v_settlement.period_end then return jsonb_build_object('result','settlement_month_still_open'); end if;
  if exists (
    select 1 from public.consumption_corrections correction
    join public.consumption_order_items item on item.order_id=correction.order_id and item.commercial_partner_id=v_settlement.partner_id
    join public.consumption_orders orders on orders.id=correction.order_id
    where correction.hotel_id=p_hotel_id and correction.status in ('pending','approved','awaiting_refund','awaiting_partner_refund')
      and (orders.occurred_at at time zone v_timezone)::date<=v_settlement.period_end
  ) then return jsonb_build_object('result','settlement_pending_corrections'); end if;
  v_live:=public.partner_settlement_live_fingerprint(p_hotel_id,v_settlement.partner_id,v_settlement.period_start);
  if v_live<>v_settlement.source_fingerprint then return jsonb_build_object('result','settlement_sources_changed'); end if;
  select jsonb_build_object(
    'settlement',to_jsonb(v_settlement)-'statement_snapshot',
    'components',coalesce((select jsonb_agg(to_jsonb(component) order by component.segment_start,component.revision_version) from public.partner_settlement_components component where component.settlement_id=p_settlement_id),'[]'::jsonb),
    'sources',coalesce((select jsonb_agg(to_jsonb(source) order by source.occurred_at,source.id) from public.partner_settlement_sources source where source.settlement_id=p_settlement_id),'[]'::jsonb)
  ) into v_snapshot;
  update public.partner_settlements set
    status=case when net_settlement=0 then 'settled'::public.partner_settlement_status else 'approved'::public.partner_settlement_status end,
    version=version+1,approved_by=p_actor_id,approved_at=public.hotel_operational_now(p_hotel_id),statement_snapshot=v_snapshot,
    settled_by=case when net_settlement=0 then p_actor_id else null end,settled_at=case when net_settlement=0 then public.hotel_operational_now(p_hotel_id) else null end
  where id=p_settlement_id returning * into v_settlement;
  insert into public.partner_settlement_events(hotel_id,settlement_id,action,actor_id,details)
  values(p_hotel_id,p_settlement_id,'approved',p_actor_id,jsonb_build_object('version',v_settlement.version,'direction',v_settlement.direction,'net_settlement',v_settlement.net_settlement));
  if v_settlement.net_settlement=0 then
    insert into public.partner_settlement_events(hotel_id,settlement_id,action,actor_id,details)
    values(p_hotel_id,p_settlement_id,'settled_without_payment',p_actor_id,'{}');
  end if;
  return jsonb_build_object('result','ok','id',p_settlement_id,'version',v_settlement.version);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_maintenance_preventive_run(p_hotel_id uuid, p_run_id uuid, p_actor_id uuid, p_force boolean DEFAULT false, p_reason text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_run public.maintenance_preventive_runs%rowtype;
  v_plan public.maintenance_preventive_plans%rowtype;
  v_occurrence uuid;
  v_order uuid;
begin
  select * into v_run from public.maintenance_preventive_runs where id = p_run_id and hotel_id = p_hotel_id for update;
  if not found then return null; end if;
  if v_run.status = 'generated' then return v_run.occurrence_id; end if;
  if v_run.status not in ('scheduled', 'deferred', 'rescheduled') then raise exception 'Competência preventiva não pode ser gerada.' using errcode = '23514'; end if;
  select * into v_plan from public.maintenance_preventive_plans where id = v_run.plan_id and hotel_id = p_hotel_id;
  if not found then return null; end if;
  if not p_force and exists (
    select 1 from public.maintenance_preventive_runs previous_run
    join public.maintenance_occurrences occurrence on occurrence.id = previous_run.occurrence_id
    where previous_run.plan_id = v_plan.id and previous_run.id <> v_run.id
      and previous_run.scheduled_local_date < v_run.scheduled_local_date
      and occurrence.status not in ('resolved', 'canceled')
  ) then
    update public.maintenance_preventive_runs set status = 'deferred', decision_reason = 'Execução anterior permanece aberta.' where id = v_run.id;
    perform public.notify_maintenance_recipient(p_hotel_id, v_plan.assigned_to, 'preventive_deferred', 'warning',
      'Preventiva adiada', v_plan.name || ' aguarda decisão porque a execução anterior está aberta.',
      '/dashboard/maintenance/preventive?run=' || v_run.id, 'preventive_run', v_run.id, 'overlap');
    perform public.notify_maintenance_managers(p_hotel_id, 'preventive_deferred', 'warning', 'Preventiva adiada',
      v_plan.name || ' possui uma execução anterior aberta.', '/dashboard/maintenance/preventive?run=' || v_run.id,
      'preventive_run', v_run.id, 'overlap');
    return null;
  end if;
  v_occurrence := public.create_maintenance_occurrence(
    p_hotel_id, (v_run.snapshot->>'category_id')::uuid,
    (v_run.snapshot->>'room_id')::uuid, (v_run.snapshot->>'location_id')::uuid, null,
    'preventive', (v_run.snapshot->>'priority')::public.maintenance_priority,
    (v_run.snapshot->>'plan_name') || ': ' || (v_run.snapshot->>'instructions'),
    v_run.scheduled_for, coalesce(p_actor_id, v_plan.created_by),
    coalesce((v_run.snapshot->>'blocking_recommended')::boolean, false)
  );
  update public.maintenance_occurrences set
    preventive_plan_id = v_plan.id, preventive_run_id = v_run.id,
    status = 'triaged', triaged_by = coalesce(p_actor_id, v_plan.created_by), triaged_at = now(),
    liability_status = 'not_applicable'
  where id = v_occurrence;
  v_order := public.create_maintenance_work_order(
    p_hotel_id, v_occurrence, coalesce(p_actor_id, v_plan.created_by), v_run.snapshot->>'plan_name',
    v_run.snapshot->>'instructions', (v_run.snapshot->>'priority')::public.maintenance_priority,
    (v_run.snapshot->>'assigned_to')::uuid,
    v_run.scheduled_for + make_interval(hours => (v_run.snapshot->>'completion_due_hours')::integer),
    coalesce((v_run.snapshot->>'requires_inspection')::boolean, false)
  );
  insert into public.maintenance_work_order_checklist_items(
    hotel_id, work_order_id, source_task_id, position, description, is_required
  ) select p_hotel_id, v_order, (task->>'id')::uuid, (task->>'position')::integer,
      task->>'description', coalesce((task->>'is_required')::boolean, true)
    from jsonb_array_elements(v_run.snapshot->'tasks') task;
  update public.maintenance_work_orders set
    supplier_id = (v_run.snapshot->>'supplier_id')::uuid,
    contract_id = (v_run.snapshot->>'contract_id')::uuid
  where id = v_order;
  update public.maintenance_preventive_runs set
    status = 'generated', occurrence_id = v_occurrence, work_order_id = v_order,
    decided_by = case when p_force then p_actor_id else decided_by end,
    decided_at = case when p_force then public.hotel_operational_now(p_hotel_id) else decided_at end,
    decision_reason = case when p_force then nullif(btrim(p_reason), '') else decision_reason end
  where id = v_run.id;
  insert into public.maintenance_events(hotel_id, occurrence_id, work_order_id, actor_id, event_type, message, metadata)
  values (p_hotel_id, v_occurrence, v_order, coalesce(p_actor_id, v_plan.created_by), 'preventive_generated', p_reason,
    jsonb_build_object('plan_id', v_plan.id, 'run_id', v_run.id, 'scheduled_for', v_run.scheduled_for));
  perform public.notify_maintenance_recipient(p_hotel_id, (v_run.snapshot->>'assigned_to')::uuid, 'preventive_assigned', 'info',
    'Preventiva disponível', (v_run.snapshot->>'plan_name') || ' foi incluída na sua agenda.',
    '/dashboard/maintenance/occurrences/' || v_occurrence, 'occurrence', v_occurrence, 'generated');
  return v_occurrence;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.inspect_maintenance_work_order(p_hotel_id uuid, p_work_order_id uuid, p_actor_id uuid, p_result maintenance_inspection_result, p_notes text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
    completed_at = case when p_result = 'approved' then public.hotel_operational_now(p_hotel_id) else null end
  where id = p_work_order_id;
  insert into public.maintenance_events(hotel_id, occurrence_id, work_order_id, actor_id, event_type, message)
  values (p_hotel_id, v_order.occurrence_id, p_work_order_id, p_actor_id, 'inspection_' || p_result::text, p_notes);
  perform public.recompute_maintenance_occurrence_status(v_order.occurrence_id);
  return v_order.occurrence_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.prepare_daily_close(p_hotel_id uuid, p_business_date date, p_actor_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ declare v_id uuid;v_version integer;v_status public.daily_close_status;v_projection jsonb;v_fingerprint text;x jsonb;
begin insert into public.daily_closes(hotel_id,business_date) values(p_hotel_id,p_business_date) on conflict(hotel_id,business_date) do nothing;select id,version,status into v_id,v_version,v_status from public.daily_closes where hotel_id=p_hotel_id and business_date=p_business_date for update;
 if v_status='closed' then return jsonb_build_object('result','invalid_transition');end if;
 if v_version<>(p_input->>'expected_version')::integer and not(v_version=1 and (p_input->>'expected_version')::integer=0) then return jsonb_build_object('result','conflict');end if;v_projection:=public.daily_close_projection(p_hotel_id,p_business_date);if jsonb_array_length(v_projection->'blockers')>0 then return jsonb_build_object('result','blocking_items','context',v_projection->'blockers');end if;v_fingerprint:=md5(v_projection::text);
 delete from public.daily_close_pending_acceptances where daily_close_id=v_id;for x in select value from jsonb_array_elements(p_input->'accepted_pending') loop insert into public.daily_close_pending_acceptances(hotel_id,daily_close_id,pending_id,responsible_id,next_action,reason,created_by) values(p_hotel_id,v_id,(x->>'pending_id')::uuid,(x->>'responsible_id')::uuid,btrim(x->>'next_action'),btrim(x->>'reason'),p_actor_id);end loop;
 update public.daily_closes set status='prepared',snapshot=v_projection,fingerprint=v_fingerprint,prepared_by=p_actor_id,prepared_at=public.hotel_operational_now(p_hotel_id),approved_by=null,approved_at=null,version=version+1,updated_at=now() where id=v_id;insert into public.daily_close_events(hotel_id,daily_close_id,action,actor_id,details) values(p_hotel_id,v_id,'prepared',p_actor_id,jsonb_build_object('fingerprint',v_fingerprint));return jsonb_build_object('result','ok','id',v_id,'fingerprint',v_fingerprint);end $function$
;

CREATE OR REPLACE FUNCTION public.recompute_maintenance_occurrence_status(p_occurrence_id uuid)
 RETURNS maintenance_occurrence_status
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_occ public.maintenance_occurrences%rowtype;
  v_next public.maintenance_occurrence_status;
  v_active_blocks integer;
  v_total integer;
  v_open integer;
  v_inspection integer;
  v_completed integer;
begin
  select * into v_occ from public.maintenance_occurrences where id = p_occurrence_id for update;
  if not found then raise exception 'occurrence not found' using errcode = 'P0002'; end if;
  if v_occ.status = 'canceled' then return v_occ.status; end if;

  select count(*),
         count(*) filter (where status not in ('completed', 'canceled')),
         count(*) filter (where status = 'awaiting_inspection'),
         count(*) filter (where status = 'completed')
    into v_total, v_open, v_inspection, v_completed
  from public.maintenance_work_orders where occurrence_id = p_occurrence_id;

  select count(*) into v_active_blocks from public.room_blocks
  where maintenance_occurrence_id = p_occurrence_id and released_at is null;

  if v_occ.triaged_at is null then v_next := 'reported';
  elsif v_inspection > 0 and v_open = v_inspection then v_next := 'awaiting_inspection';
  elsif v_open > 0 then v_next := 'in_progress';
  elsif v_total = 0 then v_next := 'triaged';
  elsif v_active_blocks > 0 then v_next := 'in_progress';
  elsif v_occ.liability_status = 'suspected' then v_next := 'awaiting_liability';
  elsif v_completed > 0 then v_next := 'resolved';
  else v_next := 'triaged';
  end if;

  update public.maintenance_occurrences
  set status = v_next, resolved_at = case when v_next = 'resolved' then coalesce(resolved_at, public.hotel_operational_now(v_occ.hotel_id)) else null end
  where id = p_occurrence_id;
  return v_next;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_partner_settlement(p_hotel_id uuid, p_partner_id uuid, p_period_start date, p_actor_id uuid, p_expected_version bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_hotel record; v_settings public.consumption_management_settings%rowtype; v_settlement public.partner_settlements%rowtype;
  v_revision record; v_component_id uuid; v_origin record; v_period_end date;
  v_days numeric; v_month_days numeric; v_divisor numeric; v_monthly_rent numeric; v_monthly_minimum numeric;
  v_gross numeric(14,2); v_discount numeric(14,2); v_courtesy numeric(14,2); v_reversal numeric(14,2);
  v_net numeric(14,2); v_hotel_collected numeric(14,2); v_partner_direct numeric(14,2);
  v_rent numeric(14,2); v_commission numeric(14,2); v_minimum numeric(14,2); v_topup numeric(14,2); v_contribution numeric(14,2);
  v_delta_net numeric(14,2); v_delta_hotel numeric(14,2); v_delta_partner numeric(14,2);
  v_last_base numeric(14,2); v_last_contribution numeric(14,2); v_restated_contribution numeric(14,2); v_delta_contribution numeric(14,2);
  v_fingerprint text;
begin
  if not public.maintenance_user_has_hotel_scope(p_actor_id, p_hotel_id) then return jsonb_build_object('result','actor_outside_hotel'); end if;
  if p_period_start <> date_trunc('month', p_period_start)::date then return jsonb_build_object('result','invalid_period'); end if;
  select id, timezone, currency into v_hotel from public.hotels where id = p_hotel_id and is_active;
  if not found then return jsonb_build_object('result','hotel_not_found'); end if;
  if not exists (select 1 from public.commercial_partners where id=p_partner_id and hotel_id=p_hotel_id) then return jsonb_build_object('result','partner_not_found'); end if;
  select * into v_settings from public.consumption_management_settings where hotel_id=p_hotel_id;
  if p_period_start < v_settings.settlement_tracking_starts_on then return jsonb_build_object('result','period_before_tracking'); end if;
  v_period_end := (p_period_start + interval '1 month - 1 day')::date;

  select * into v_settlement from public.partner_settlements
  where hotel_id=p_hotel_id and partner_id=p_partner_id and period_start=p_period_start for update;
  if found then
    if p_expected_version is null then return jsonb_build_object('result','settlement_already_exists'); end if;
    if v_settlement.status in ('approved','settled') then return jsonb_build_object('result','settlement_invalid_state'); end if;
    if p_expected_version is not null and p_expected_version <> v_settlement.version then return jsonb_build_object('result','settlement_version_conflict'); end if;
    delete from public.partner_settlement_sources where settlement_id=v_settlement.id;
    delete from public.partner_settlement_components where settlement_id=v_settlement.id;
  else
    insert into public.partner_settlements(
      hotel_id, partner_id, period_start, period_end, currency, due_on, created_by, prepared_by, prepared_at
    ) values (
      p_hotel_id, p_partner_id, p_period_start, v_period_end, v_hotel.currency,
      v_period_end + v_settings.payment_due_days, p_actor_id, p_actor_id, public.hotel_operational_now(p_hotel_id)
    ) returning * into v_settlement;
  end if;

  v_month_days := extract(day from v_period_end);
  for v_revision in
    select revision.*, agreement.internal_number
    from public.commercial_agreement_revisions revision
    join public.commercial_agreements agreement on agreement.id=revision.agreement_id and agreement.hotel_id=revision.hotel_id
    where revision.hotel_id=p_hotel_id and agreement.partner_id=p_partner_id
      and revision.status in ('activated','terminated')
      and revision.starts_on <= v_period_end and coalesce(revision.ends_on, 'infinity'::date) >= p_period_start
    order by revision.starts_on, revision.version
  loop
    select
      coalesce(sum(case when orders.disposition <> 'legacy_unclassified' then item.item_total_amount else 0 end),0),
      coalesce(sum(case when orders.disposition='charged' then effective.effective_discount else 0 end),0),
      coalesce(sum(case when orders.disposition='courtesy' then item.item_total_amount else 0 end),0),
      coalesce(sum(case when orders.disposition='charged' then greatest(item.net_amount-effective.effective_net_amount,0) else 0 end),0),
      coalesce(sum(case when orders.disposition='charged' then effective.effective_net_amount else 0 end),0),
      coalesce(sum(case when orders.disposition='charged' and orders.billing_mode in ('stay_folio','hotel_immediate') then effective.effective_net_amount else 0 end),0),
      coalesce(sum(case when orders.disposition='charged' and orders.billing_mode='partner_direct' then effective.effective_net_amount else 0 end),0)
    into v_gross,v_discount,v_courtesy,v_reversal,v_net,v_hotel_collected,v_partner_direct
    from public.consumption_order_item_effective effective
    join public.consumption_order_items item on item.id=effective.id
    join public.consumption_orders orders on orders.id=item.order_id and orders.hotel_id=p_hotel_id
    where item.commercial_partner_id=p_partner_id and item.commercial_revision_id=v_revision.id and not orders.is_legacy
      and (orders.occurred_at at time zone v_hotel.timezone)::date between p_period_start and v_period_end;

    v_days := greatest(0, least(v_period_end, coalesce(v_revision.ends_on,v_period_end))-greatest(p_period_start,v_revision.starts_on)+1);
    v_divisor := case v_revision.rent_frequency when 'quarterly' then 3 when 'yearly' then 12 else 1 end;
    v_monthly_rent := coalesce(v_revision.fixed_rent,0)/v_divisor;
    v_monthly_minimum := coalesce(v_revision.minimum_guarantee,0)/v_divisor;
    v_rent := round(v_monthly_rent*v_days/v_month_days,2);
    v_minimum := round(v_monthly_minimum*v_days/v_month_days,2);
    v_commission := round(v_net*coalesce(v_revision.commission_percentage,0)/100,2);
    v_contribution := case v_revision.commercial_model
      when 'fixed_rent' then v_rent
      when 'revenue_share' then v_commission
      else greatest(v_rent+v_commission,v_minimum) end;
    v_topup := case when v_revision.commercial_model='hybrid' then greatest(v_minimum-(v_rent+v_commission),0) else 0 end;

    insert into public.partner_settlement_components(
      hotel_id,settlement_id,source_kind,agreement_id,revision_id,agreement_number,revision_version,
      segment_start,segment_end,commercial_model,fixed_rent,rent_frequency,commission_percentage,minimum_guarantee,payment_recipient,
      gross_sales,discount_total,courtesy_total,reversal_total,operational_net,hotel_collected,partner_direct,
      prorated_rent,commission_amount,prorated_minimum_guarantee,minimum_guarantee_topup,contribution_amount,net_settlement_amount,calculation_memory
    ) values (
      p_hotel_id,v_settlement.id,'regular',v_revision.agreement_id,v_revision.id,v_revision.internal_number,v_revision.version,
      greatest(p_period_start,v_revision.starts_on),least(v_period_end,coalesce(v_revision.ends_on,v_period_end)),v_revision.commercial_model,
      v_revision.fixed_rent,v_revision.rent_frequency,v_revision.commission_percentage,v_revision.minimum_guarantee,v_revision.payment_recipient,
      v_gross,v_discount,v_courtesy,v_reversal,v_net,v_hotel_collected,v_partner_direct,
      v_rent,v_commission,v_minimum,v_topup,v_contribution,v_hotel_collected-v_contribution,
      jsonb_build_object('active_days',v_days,'month_days',v_month_days,'rent_divisor',v_divisor,'commission_base',v_net)
    ) returning id into v_component_id;

    insert into public.partner_settlement_sources(
      hotel_id,settlement_id,component_id,source_kind,order_id,order_item_id,occurred_at,point_id,point_name,
      product_id,product_name,category_id,category_name,stay_id,reservation_code,room_number,billing_mode,payment_method,
      disposition,provider_type,gross_amount,discount_amount,reversal_amount,operational_net,hotel_collected,partner_direct,source_snapshot
    )
    select p_hotel_id,v_settlement.id,v_component_id,'regular',orders.id,item.id,orders.occurred_at,orders.point_id,orders.point_name_snapshot,
      item.product_id,item.product_name_snapshot,item.category_id,item.category_name_snapshot,orders.stay_id,orders.reservation_code_snapshot,
      orders.room_number_snapshot,orders.billing_mode,orders.payment_method,orders.disposition,item.provider_type_snapshot,
      case when orders.disposition='legacy_unclassified' then 0 else item.item_total_amount end,
      case when orders.disposition='charged' then effective.effective_discount else 0 end,
      case when orders.disposition='charged' then greatest(item.net_amount-effective.effective_net_amount,0) else 0 end,
      case when orders.disposition='charged' then effective.effective_net_amount else 0 end,
      case when orders.disposition='charged' and orders.billing_mode in ('stay_folio','hotel_immediate') then effective.effective_net_amount else 0 end,
      case when orders.disposition='charged' and orders.billing_mode='partner_direct' then effective.effective_net_amount else 0 end,
      jsonb_build_object('order_id',orders.id,'item_id',item.id,'quantity',item.quantity,'effective_quantity',effective.effective_quantity,
        'unit_price',item.charged_unit_price,'terms',item.commercial_terms_snapshot,'policy',item.billing_policy_snapshot)
    from public.consumption_order_item_effective effective
    join public.consumption_order_items item on item.id=effective.id
    join public.consumption_orders orders on orders.id=item.order_id and orders.hotel_id=p_hotel_id
    where item.commercial_partner_id=p_partner_id and item.commercial_revision_id=v_revision.id and not orders.is_legacy
      and (orders.occurred_at at time zone v_hotel.timezone)::date between p_period_start and v_period_end;
  end loop;

  for v_origin in
    select distinct origin.*
    from public.partner_settlement_components origin
    join public.partner_settlements original_settlement on original_settlement.id=origin.settlement_id
    join public.partner_settlement_sources original_source on original_source.component_id=origin.id and original_source.source_kind='regular'
    join public.consumption_correction_items correction_item on correction_item.order_item_id=original_source.order_item_id
    join public.consumption_corrections correction on correction.id=correction_item.correction_id and correction.status='completed'
    where original_settlement.hotel_id=p_hotel_id and original_settlement.partner_id=p_partner_id
      and original_settlement.status in ('approved','settled') and original_settlement.period_end < p_period_start
      and correction.completed_at <= ((v_period_end+1)::timestamp at time zone v_hotel.timezone)
      and not exists (select 1 from public.partner_settlement_sources recognized where recognized.correction_item_id=correction_item.id)
  loop
    select
      -coalesce(sum(correction_item.previous_net-correction_item.resulting_net),0),
      -coalesce(sum(case when orders.billing_mode in ('stay_folio','hotel_immediate') then correction_item.previous_net-correction_item.resulting_net else 0 end),0),
      -coalesce(sum(case when orders.billing_mode='partner_direct' then correction_item.previous_net-correction_item.resulting_net else 0 end),0)
    into v_delta_net,v_delta_hotel,v_delta_partner
    from public.partner_settlement_sources original_source
    join public.consumption_correction_items correction_item on correction_item.order_item_id=original_source.order_item_id
    join public.consumption_corrections correction on correction.id=correction_item.correction_id and correction.status='completed'
    join public.consumption_orders orders on orders.id=original_source.order_id
    where original_source.component_id=v_origin.id
      and correction.completed_at <= ((v_period_end+1)::timestamp at time zone v_hotel.timezone)
      and not exists (select 1 from public.partner_settlement_sources recognized where recognized.correction_item_id=correction_item.id);
    if v_delta_net = 0 then continue; end if;
    select v_origin.operational_net+coalesce(sum(adjustment.operational_net),0),
      v_origin.contribution_amount+coalesce(sum(adjustment.contribution_amount),0)
    into v_last_base,v_last_contribution
    from public.partner_settlement_components adjustment
    where adjustment.origin_component_id=v_origin.id;
    v_commission := round((v_last_base+v_delta_net)*coalesce(v_origin.commission_percentage,0)/100,2);
    v_restated_contribution := case v_origin.commercial_model
      when 'fixed_rent' then v_origin.prorated_rent
      when 'revenue_share' then v_commission
      else greatest(v_origin.prorated_rent+v_commission,v_origin.prorated_minimum_guarantee) end;
    v_delta_contribution := v_restated_contribution-v_last_contribution;
    insert into public.partner_settlement_components(
      hotel_id,settlement_id,source_kind,agreement_id,revision_id,origin_component_id,agreement_number,revision_version,
      segment_start,segment_end,commercial_model,fixed_rent,rent_frequency,commission_percentage,minimum_guarantee,payment_recipient,
      operational_net,hotel_collected,partner_direct,commission_amount,contribution_amount,net_settlement_amount,calculation_memory
    ) values (
      p_hotel_id,v_settlement.id,'late_correction',v_origin.agreement_id,v_origin.revision_id,v_origin.id,v_origin.agreement_number,v_origin.revision_version,
      v_origin.segment_start,v_origin.segment_end,v_origin.commercial_model,v_origin.fixed_rent,v_origin.rent_frequency,
      v_origin.commission_percentage,v_origin.minimum_guarantee,v_origin.payment_recipient,
      v_delta_net,v_delta_hotel,v_delta_partner,v_delta_contribution,v_delta_contribution,v_delta_hotel-v_delta_contribution,
      jsonb_build_object('previous_base',v_last_base,'restated_base',v_last_base+v_delta_net,
        'previous_contribution',v_last_contribution,'restated_contribution',v_restated_contribution)
    ) returning id into v_component_id;
    update public.partner_settlement_components set reversal_total = -v_delta_net where id = v_component_id;
    insert into public.partner_settlement_sources(
      hotel_id,settlement_id,component_id,source_kind,order_id,order_item_id,correction_id,correction_item_id,original_settlement_id,
      occurred_at,completed_at,point_id,point_name,product_id,product_name,category_id,category_name,stay_id,reservation_code,room_number,
      billing_mode,payment_method,disposition,provider_type,reversal_amount,operational_net,hotel_collected,partner_direct,source_snapshot
    )
    select p_hotel_id,v_settlement.id,v_component_id,'late_correction',orders.id,item.id,correction.id,correction_item.id,original_source.settlement_id,
      orders.occurred_at,correction.completed_at,orders.point_id,orders.point_name_snapshot,item.product_id,item.product_name_snapshot,
      item.category_id,item.category_name_snapshot,orders.stay_id,orders.reservation_code_snapshot,orders.room_number_snapshot,
      orders.billing_mode,orders.payment_method,orders.disposition,item.provider_type_snapshot,
      correction_item.previous_net-correction_item.resulting_net,
      -(correction_item.previous_net-correction_item.resulting_net),
      case when orders.billing_mode in ('stay_folio','hotel_immediate') then -(correction_item.previous_net-correction_item.resulting_net) else 0 end,
      case when orders.billing_mode='partner_direct' then -(correction_item.previous_net-correction_item.resulting_net) else 0 end,
      jsonb_build_object('correction_id',correction.id,'correction_item_id',correction_item.id,'reason',correction.reason,
        'previous_net',correction_item.previous_net,'resulting_net',correction_item.resulting_net)
    from public.partner_settlement_sources original_source
    join public.consumption_order_items item on item.id=original_source.order_item_id
    join public.consumption_orders orders on orders.id=original_source.order_id
    join public.consumption_correction_items correction_item on correction_item.order_item_id=original_source.order_item_id
    join public.consumption_corrections correction on correction.id=correction_item.correction_id and correction.status='completed'
    where original_source.component_id=v_origin.id
      and correction.completed_at <= ((v_period_end+1)::timestamp at time zone v_hotel.timezone)
      and not exists (select 1 from public.partner_settlement_sources recognized where recognized.correction_item_id=correction_item.id);
  end loop;

  select coalesce(sum(gross_sales),0),coalesce(sum(discount_total),0),coalesce(sum(courtesy_total),0),coalesce(sum(reversal_total),0),
    greatest(coalesce(sum(operational_net),0),0),greatest(coalesce(sum(hotel_collected),0),0),greatest(coalesce(sum(partner_direct),0),0),
    coalesce(sum(prorated_rent),0),coalesce(sum(commission_amount),0),coalesce(sum(minimum_guarantee_topup),0),
    coalesce(sum(contribution_amount),0),coalesce(sum(net_settlement_amount),0)
  into v_gross,v_discount,v_courtesy,v_reversal,v_net,v_hotel_collected,v_partner_direct,v_rent,v_commission,v_topup,v_contribution,v_delta_net
  from public.partner_settlement_components where settlement_id=v_settlement.id;
  v_fingerprint := public.partner_settlement_live_fingerprint(p_hotel_id,p_partner_id,p_period_start);
  update public.partner_settlements set
    status='draft',version=version+case when p_expected_version is null then 0 else 1 end,
    gross_sales=v_gross,discount_total=v_discount,courtesy_total=v_courtesy,reversal_total=v_reversal,
    operational_net=v_net,hotel_collected=v_hotel_collected,partner_direct=v_partner_direct,
    rent_total=v_rent,commission_total=v_commission,minimum_guarantee_topup=v_topup,
    contribution_total=v_contribution,net_settlement=v_delta_net,
    direction=case when v_delta_net>0 then 'hotel_to_partner'::public.partner_settlement_direction when v_delta_net<0 then 'partner_to_hotel'::public.partner_settlement_direction else 'balanced'::public.partner_settlement_direction end,
    due_on=v_period_end+v_settings.payment_due_days,source_fingerprint=v_fingerprint,statement_snapshot=null,
    prepared_by=p_actor_id,prepared_at=public.hotel_operational_now(p_hotel_id),submitted_by=null,submitted_at=null,updated_at=now()
  where id=v_settlement.id returning * into v_settlement;
  insert into public.partner_settlement_events(hotel_id,settlement_id,action,actor_id,details)
  values (p_hotel_id,v_settlement.id,'calculated',p_actor_id,jsonb_build_object('version',v_settlement.version,'fingerprint',v_fingerprint));
  return jsonb_build_object('result','ok','id',v_settlement.id,'created',v_settlement.created_at=v_settlement.updated_at,'version',v_settlement.version);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.release_maintenance_room_block(p_hotel_id uuid, p_block_id uuid, p_actor_id uuid, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
  update public.room_blocks set released_at=public.hotel_operational_now(p_hotel_id),released_by=p_actor_id,release_reason=btrim(p_reason) where id=p_block_id;
  insert into public.maintenance_events(hotel_id,occurrence_id,actor_id,event_type,message,metadata)
  values(p_hotel_id,v_block.maintenance_occurrence_id,p_actor_id,'room_block_released',btrim(p_reason),jsonb_build_object('block_id',p_block_id,'governance_inspection_created',true));
  perform public.recompute_maintenance_occurrence_status(v_block.maintenance_occurrence_id);
  return v_block.maintenance_occurrence_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.request_consumption_correction(p_hotel_id uuid, p_order_id uuid, p_actor_id uuid, p_kind consumption_correction_kind, p_reason text, p_items jsonb, p_expected_version bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_order record; v_item jsonb; v_effective record; v_id uuid := gen_random_uuid(); v_paid boolean := false;
  v_gross numeric(12,2) := 0; v_discount numeric(12,2) := 0; v_net numeric(12,2) := 0;
  v_new_quantity numeric(12,3); v_additional_discount numeric(12,2); v_new_gross numeric(12,2); v_new_net numeric(12,2);
  v_status public.consumption_correction_status := 'pending';
begin
  if not public.maintenance_user_has_hotel_scope(p_actor_id, p_hotel_id) then return jsonb_build_object('result', 'actor_outside_hotel'); end if;
  if length(coalesce(btrim(p_reason), '')) < 3 then return jsonb_build_object('result', 'reason_required'); end if;
  select orders.*, stay.account_version into v_order from public.consumption_orders orders
  left join public.stays stay on stay.id = orders.stay_id
  where orders.id = p_order_id and orders.hotel_id = p_hotel_id for update of orders;
  if not found or v_order.is_legacy or v_order.stay_id is null then return jsonb_build_object('result', 'not_found'); end if;
  if v_order.account_version <> p_expected_version then return jsonb_build_object('result', 'version_conflict'); end if;
  if exists (select 1 from public.consumption_corrections where order_id = p_order_id and status in ('pending','approved','awaiting_refund','awaiting_partner_refund'))
    then return jsonb_build_object('result', 'correction_already_open'); end if;
  v_paid := v_order.billing_mode in ('hotel_immediate', 'partner_direct') or exists (
    select 1 from public.stay_folio_entries entry join public.stay_folio_allocations allocation on allocation.debit_entry_id = entry.id
    where entry.consumption_order_id = p_order_id and entry.direction = 'debit'
  );
  insert into public.consumption_corrections(id, hotel_id, order_id, stay_id, kind, status, reason, account_version,
    gross_reduction, discount_increase, net_reduction, requested_by)
  values (v_id, p_hotel_id, p_order_id, v_order.stay_id, p_kind, 'pending', btrim(p_reason), p_expected_version,
    0, 0, 0.01, p_actor_id);
  if p_kind = 'full_void' then
    for v_effective in select * from public.consumption_order_item_effective where order_id = p_order_id loop
      insert into public.consumption_correction_items(hotel_id, correction_id, order_item_id, previous_quantity,
        resulting_quantity, previous_discount, additional_discount, previous_net, resulting_net)
      values (p_hotel_id, v_id, v_effective.id, v_effective.effective_quantity, 0, v_effective.effective_discount,
        0, v_effective.effective_net_amount, 0);
      v_gross := v_gross + round(v_effective.effective_quantity * v_effective.charged_unit_price, 2);
      v_net := v_net + v_effective.effective_net_amount;
    end loop;
  else
    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 then raise exception 'invalid correction items' using errcode = '23514'; end if;
    for v_item in select value from jsonb_array_elements(p_items) loop
      select * into v_effective from public.consumption_order_item_effective
        where id = (v_item->>'order_item_id')::uuid and order_id = p_order_id;
      if not found then raise exception 'correction item not found' using errcode = '23514'; end if;
      v_new_quantity := (v_item->>'resulting_quantity')::numeric;
      v_additional_discount := round(coalesce((v_item->>'additional_discount')::numeric, 0), 2);
      v_new_gross := round(v_new_quantity * v_effective.charged_unit_price, 2);
      if v_new_quantity < 0 or v_new_quantity > v_effective.effective_quantity or
        (v_effective.sales_unit_snapshot <> 'hour' and v_new_quantity <> trunc(v_new_quantity)) or
        v_additional_discount < 0 or v_effective.effective_discount + v_additional_discount > v_new_gross
      then raise exception 'invalid correction values' using errcode = '23514'; end if;
      v_new_net := v_new_gross - v_effective.effective_discount - v_additional_discount;
      if v_new_net >= v_effective.effective_net_amount then raise exception 'correction must reduce amount' using errcode = '23514'; end if;
      insert into public.consumption_correction_items(hotel_id, correction_id, order_item_id, previous_quantity,
        resulting_quantity, previous_discount, additional_discount, previous_net, resulting_net)
      values (p_hotel_id, v_id, v_effective.id, v_effective.effective_quantity, v_new_quantity,
        v_effective.effective_discount, v_additional_discount, v_effective.effective_net_amount, v_new_net);
      v_gross := v_gross + round((v_effective.effective_quantity - v_new_quantity) * v_effective.charged_unit_price, 2);
      v_discount := v_discount + v_additional_discount; v_net := v_net + v_effective.effective_net_amount - v_new_net;
    end loop;
    if v_net >= (select effective_net_amount from public.consumption_order_effective where id = p_order_id)
      then raise exception 'full reduction requires void' using errcode = '23514'; end if;
  end if;
  perform set_config('app.consumption_correction_write', 'on', true);
  update public.consumption_corrections set gross_reduction = v_gross, discount_increase = v_discount,
    net_reduction = v_net where id = v_id;
  if p_kind = 'full_void' and not v_paid and v_order.billing_mode is distinct from 'partner_direct' then
    update public.consumption_corrections set status = 'completed', decided_by = p_actor_id,
      decided_at = public.hotel_operational_now(p_hotel_id), completed_by = p_actor_id, completed_at = public.hotel_operational_now(p_hotel_id) where id = v_id;
    if v_order.billing_mode = 'stay_folio' then
      insert into public.stay_folio_entries(hotel_id, stay_id, reservation_id, direction, kind, amount, currency,
        description, consumption_order_id, consumption_correction_id, source_key, posted_by)
      values (p_hotel_id, v_order.stay_id, v_order.reservation_id, 'credit', 'adjustment', v_net, v_order.currency,
        'Anulação de consumo', p_order_id, v_id, 'consumption-correction:' || v_id::text, p_actor_id);
      perform public.allocate_stay_account_credit(p_hotel_id, v_order.stay_id,
        (select id from public.stay_folio_entries where consumption_correction_id = v_id), p_actor_id);
    else update public.stays set account_version = account_version + 1 where id = v_order.stay_id; end if;
    v_status := 'completed';
  end if;
  insert into public.consumption_order_events(hotel_id, order_id, action, actor_id, details)
  values (p_hotel_id, p_order_id, case when v_status = 'completed' then 'voided' else 'correction_requested' end,
    p_actor_id, jsonb_build_object('correction_id', v_id, 'kind', p_kind, 'net_reduction', v_net));
  insert into public.stay_account_events(hotel_id, stay_id, entity_type, entity_id, action, actor_id, details)
  values (p_hotel_id, v_order.stay_id, 'consumption_correction', v_id,
    case when v_status = 'completed' then 'consumption_voided' else 'correction_requested' end,
    p_actor_id, jsonb_build_object('order_id', p_order_id, 'net_reduction', v_net));
  return jsonb_build_object('result', 'ok', 'correction_id', v_id, 'status', v_status);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_partner_settlement(p_hotel_id uuid, p_settlement_id uuid, p_actor_id uuid, p_expected_version bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_settlement public.partner_settlements%rowtype;
begin
  if not public.maintenance_user_has_hotel_scope(p_actor_id,p_hotel_id) then return jsonb_build_object('result','actor_outside_hotel'); end if;
  select * into v_settlement from public.partner_settlements where id=p_settlement_id and hotel_id=p_hotel_id for update;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if v_settlement.status<>'draft' then return jsonb_build_object('result','settlement_invalid_state'); end if;
  if v_settlement.version<>p_expected_version then return jsonb_build_object('result','settlement_version_conflict'); end if;
  update public.partner_settlements set status='in_review',version=version+1,prepared_by=p_actor_id,prepared_at=public.hotel_operational_now(p_hotel_id),submitted_by=p_actor_id,submitted_at=public.hotel_operational_now(p_hotel_id)
  where id=p_settlement_id returning * into v_settlement;
  insert into public.partner_settlement_events(hotel_id,settlement_id,action,actor_id,details)
  values(p_hotel_id,p_settlement_id,'submitted',p_actor_id,jsonb_build_object('version',v_settlement.version));
  return jsonb_build_object('result','ok','id',p_settlement_id,'version',v_settlement.version);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.terminate_commercial_agreement_revision(p_hotel_id uuid, p_revision_id uuid, p_actor_id uuid, p_ends_on date)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_revision public.commercial_agreement_revisions%rowtype;
begin
  perform public.validate_commercial_actor(p_actor_id, p_hotel_id);
  select * into v_revision from public.commercial_agreement_revisions
    where id = p_revision_id and hotel_id = p_hotel_id for update;
  if not found or v_revision.status <> 'activated' or p_ends_on < v_revision.starts_on then return 'conflict'; end if;
  perform set_config('app.commercial_revision_transition', 'true', true);
  update public.commercial_agreement_revisions set status = 'terminated', ends_on = p_ends_on,
    terminated_at = public.hotel_operational_now(p_hotel_id), terminated_by = p_actor_id, last_changed_by = p_actor_id where id = p_revision_id;
  perform set_config('app.commercial_revision_transition', 'false', true);
  return 'ok';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.transfer_consumption_order(p_hotel_id uuid, p_order_id uuid, p_actor_id uuid, p_input jsonb, p_simulate boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_order public.consumption_orders%rowtype;v_source public.stays%rowtype;v_dest public.stays%rowtype;v_line jsonb;v_item public.consumption_order_items%rowtype;
  v_qty numeric;v_used numeric;v_amount numeric:=0;v_benefit numeric:=0;v_transfer uuid:=gen_random_uuid();v_source_credit uuid;v_dest_debit uuid;v_source_debit uuid;
begin
  select * into v_order from public.consumption_orders where id=p_order_id and hotel_id=p_hotel_id for update;
  if not found or v_order.billing_mode not in ('stay_folio','hotel_immediate') then return jsonb_build_object('result','not_found');end if;
  select * into v_source from public.stays where id=v_order.stay_id for update;
  select stay.* into v_dest from public.stays stay join public.reservations reservation on reservation.id=stay.reservation_id where stay.id=(p_input->>'destination_stay_id')::uuid and reservation.hotel_id=p_hotel_id for update of stay;
  if v_source.stay_status<>'checked_in' or v_dest.stay_status<>'checked_in' or v_source.id=v_dest.id then return jsonb_build_object('result','invalid_destination');end if;
  if v_source.account_version<>(p_input->>'expected_source_version')::bigint or v_dest.account_version<>(p_input->>'expected_destination_version')::bigint then return jsonb_build_object('result','version_conflict');end if;
  if exists(select 1 from public.consumption_corrections where order_id=p_order_id and status in('pending','approved','awaiting_refund','awaiting_partner_refund')) then return jsonb_build_object('result','open_correction');end if;
  if not exists(select 1 from public.stay_customers where stay_id=v_dest.id and customer_id=(p_input->>'guest_customer_id')::uuid)
    or not exists(select 1 from public.stay_payer_accounts where id=(p_input->>'payer_account_id')::uuid and stay_id=v_dest.id and hotel_id=p_hotel_id) then return jsonb_build_object('result','invalid_destination_party');end if;
  for v_line in select value from jsonb_array_elements(p_input->'items') loop
    select * into v_item from public.consumption_order_items where id=(v_line->>'order_item_id')::uuid and order_id=p_order_id for update;
    if not found then return jsonb_build_object('result','item_not_found');end if;
    v_qty:=(v_line->>'quantity')::numeric;
    select coalesce(sum(quantity),0) into v_used from public.consumption_transfer_items where order_item_id=v_item.id;
    if v_qty<=0 or v_qty+v_used>v_item.quantity then return jsonb_build_object('result','invalid_quantity');end if;
    v_amount:=v_amount+round(v_qty*v_item.charged_unit_price,2);
    v_benefit:=v_benefit+coalesce((select round(sum(amount)*v_qty/nullif(v_item.quantity,0),2) from public.consumption_benefit_redemptions where consumption_order_item_id=v_item.id),0);
  end loop;
  if p_simulate then return jsonb_build_object('result','ok','amount',v_amount,'benefit_amount',v_benefit,'source_balance_change',v_amount-v_benefit,'destination_balance_change',v_amount-v_benefit);end if;
  insert into public.consumption_transfers(id,hotel_id,source_order_id,source_stay_id,destination_stay_id,destination_guest_customer_id,destination_payer_account_id,reason,amount,benefit_amount,source_account_version,destination_account_version,created_by)
    values(v_transfer,p_hotel_id,p_order_id,v_source.id,v_dest.id,(p_input->>'guest_customer_id')::uuid,(p_input->>'payer_account_id')::uuid,btrim(p_input->>'reason'),v_amount,v_benefit,v_source.account_version,v_dest.account_version,p_actor_id);
  for v_line in select value from jsonb_array_elements(p_input->'items') loop
    select * into v_item from public.consumption_order_items where id=(v_line->>'order_item_id')::uuid;
    v_qty:=(v_line->>'quantity')::numeric;
    insert into public.consumption_transfer_items(hotel_id,transfer_id,order_item_id,quantity,amount,benefit_amount)
      values(p_hotel_id,v_transfer,v_item.id,v_qty,round(v_qty*v_item.charged_unit_price,2),coalesce((select round(sum(amount)*v_qty/nullif(v_item.quantity,0),2) from public.consumption_benefit_redemptions where consumption_order_item_id=v_item.id),0));
  end loop;
  select id into v_source_debit from public.stay_folio_entries where consumption_order_id=p_order_id and direction='debit' order by posted_at limit 1;
  insert into public.stay_folio_entries(hotel_id,stay_id,reservation_id,direction,kind,amount,currency,description,source_key,posted_by,posted_at)
    values(p_hotel_id,v_source.id,v_order.reservation_id,'credit','adjustment',v_amount-v_benefit,v_order.currency,'Correção de consumo para outra estadia','transfer-source:'||v_transfer,p_actor_id,public.hotel_operational_now(p_hotel_id)) returning id into v_source_credit;
  if v_source_debit is not null then insert into public.stay_folio_allocations(hotel_id,stay_id,credit_entry_id,debit_entry_id,amount,created_by) values(p_hotel_id,v_source.id,v_source_credit,v_source_debit,v_amount-v_benefit,p_actor_id);end if;
  insert into public.stay_folio_entries(hotel_id,stay_id,reservation_id,direction,kind,amount,currency,description,source_key,posted_by,posted_at)
    values(p_hotel_id,v_dest.id,v_dest.reservation_id,'debit','consumption_charge',v_amount-v_benefit,v_order.currency,'Consumo transferido da estadia '||v_source.id,'transfer-destination:'||v_transfer,p_actor_id,public.hotel_operational_now(p_hotel_id)) returning id into v_dest_debit;
  delete from public.stay_payer_allocations where folio_entry_id=v_dest_debit;
  insert into public.stay_payer_allocations(hotel_id,stay_id,folio_entry_id,payer_account_id,amount,allocated_by) values(p_hotel_id,v_dest.id,v_dest_debit,(p_input->>'payer_account_id')::uuid,v_amount-v_benefit,p_actor_id);
  insert into public.consumption_transfer_events(hotel_id,transfer_id,action,actor_id,details) values(p_hotel_id,v_transfer,'completed',p_actor_id,jsonb_build_object('reason',btrim(p_input->>'reason'),'benefit_recalculated',v_benefit));
  return jsonb_build_object('result','ok','transfer_id',v_transfer,'amount',v_amount,'benefit_amount',v_benefit);
end $function$
;

CREATE OR REPLACE FUNCTION public.transition_maintenance_cost_item(p_hotel_id uuid, p_cost_item_id uuid, p_actor_id uuid, p_action text, p_reason text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_item public.maintenance_cost_items%rowtype;
begin
  select * into v_item from public.maintenance_cost_items where id = p_cost_item_id and hotel_id = p_hotel_id for update;
  if not found then return null; end if;
  if p_action = 'submit' and v_item.approval_status in ('draft', 'rejected') and v_item.actual_amount is not null then
    update public.maintenance_cost_items set approval_status = 'submitted', submitted_at = public.hotel_operational_now(p_hotel_id),
      rejected_by = null, rejected_at = null, decision_reason = null where id = p_cost_item_id;
  elsif p_action = 'approve' and v_item.approval_status = 'submitted' and v_item.created_by <> p_actor_id then
    update public.maintenance_cost_items set approval_status = 'approved', settlement_status = 'open',
      approved_by = p_actor_id, approved_at = public.hotel_operational_now(p_hotel_id), decision_reason = null where id = p_cost_item_id;
  elsif p_action = 'reject' and v_item.approval_status = 'submitted' and nullif(btrim(p_reason), '') is not null then
    update public.maintenance_cost_items set approval_status = 'rejected', rejected_by = p_actor_id,
      rejected_at = public.hotel_operational_now(p_hotel_id), decision_reason = btrim(p_reason) where id = p_cost_item_id;
  elsif p_action = 'cancel' and v_item.approval_status in ('draft', 'submitted', 'rejected', 'approved')
    and v_item.settlement_status in ('not_posted', 'open')
    and not exists (select 1 from public.maintenance_financial_settlements where cost_item_id = p_cost_item_id) then
    update public.maintenance_cost_items set approval_status = 'canceled', settlement_status = 'not_posted',
      canceled_by = p_actor_id, canceled_at = public.hotel_operational_now(p_hotel_id), decision_reason = nullif(btrim(p_reason), '') where id = p_cost_item_id;
  else raise exception 'invalid maintenance cost transition' using errcode = '23514'; end if;
  insert into public.maintenance_events(hotel_id, occurrence_id, work_order_id, actor_id, event_type, message, metadata)
  values (p_hotel_id, v_item.occurrence_id, v_item.work_order_id, p_actor_id, 'finance_cost_' || p_action,
    nullif(btrim(p_reason), ''), jsonb_build_object('cost_item_id', p_cost_item_id));
  return v_item.occurrence_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.transition_maintenance_recovery(p_hotel_id uuid, p_recovery_id uuid, p_actor_id uuid, p_action text, p_reason text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_item public.maintenance_recoveries%rowtype;
  v_occurrence public.maintenance_occurrences%rowtype;
  v_cost_total numeric(12,2);
  v_recovery_total numeric(12,2);
  v_reservation_id uuid;
  v_entry_id uuid;
begin
  select * into v_item from public.maintenance_recoveries where id = p_recovery_id and hotel_id = p_hotel_id for update;
  if not found then return null; end if;
  select * into v_occurrence from public.maintenance_occurrences where id = v_item.occurrence_id for update;
  if p_action = 'submit' and v_item.approval_status in ('draft', 'rejected') then
    if v_occurrence.liability_status <> 'confirmed' or v_occurrence.confirmed_party is distinct from v_item.responsible_party then
      raise exception 'recovery requires matching confirmed liability' using errcode = '23514';
    end if;
    update public.maintenance_recoveries set approval_status = 'submitted', submitted_at = public.hotel_operational_now(p_hotel_id),
      rejected_by = null, rejected_at = null, decision_reason = null where id = p_recovery_id;
  elsif p_action = 'approve' and v_item.approval_status = 'submitted' and v_item.created_by <> p_actor_id then
    select coalesce(sum(actual_amount), 0) into v_cost_total from public.maintenance_cost_items
    where occurrence_id = v_item.occurrence_id and approval_status = 'approved';
    select coalesce(sum(charge_amount + waived_amount), 0) into v_recovery_total from public.maintenance_recoveries
    where occurrence_id = v_item.occurrence_id and approval_status = 'approved' and id <> p_recovery_id;
    if v_recovery_total + v_item.charge_amount + v_item.waived_amount > v_cost_total then
      raise exception 'recovery exceeds approved actual cost' using errcode = '23514';
    end if;
    if v_item.charge_amount > 0 and v_item.responsible_party = 'guest' then
      select reservation_id into v_reservation_id from public.stays where id = v_item.stay_id;
      insert into public.stay_folio_entries(
        hotel_id, stay_id, reservation_id, direction, kind, amount, currency, description,
        maintenance_occurrence_id, source_key, posted_by
      ) values (
        p_hotel_id, v_item.stay_id, v_reservation_id, 'debit', 'maintenance_charge', v_item.charge_amount,
        v_item.currency, v_item.justification, v_item.occurrence_id, 'maintenance-recovery:' || v_item.id::text, p_actor_id
      ) returning id into v_entry_id;
    end if;
    update public.maintenance_recoveries set approval_status = 'approved',
      settlement_status = case when charge_amount > 0 then 'open'::public.maintenance_finance_settlement_status else 'settled'::public.maintenance_finance_settlement_status end,
      approved_by = p_actor_id, approved_at = public.hotel_operational_now(p_hotel_id), folio_entry_id = v_entry_id, decision_reason = null
    where id = p_recovery_id;
  elsif p_action = 'reject' and v_item.approval_status = 'submitted' and nullif(btrim(p_reason), '') is not null then
    update public.maintenance_recoveries set approval_status = 'rejected', rejected_by = p_actor_id,
      rejected_at = public.hotel_operational_now(p_hotel_id), decision_reason = btrim(p_reason) where id = p_recovery_id;
  elsif p_action = 'cancel' and v_item.approval_status in ('draft', 'submitted', 'rejected') then
    update public.maintenance_recoveries set approval_status = 'canceled', canceled_by = p_actor_id,
      canceled_at = public.hotel_operational_now(p_hotel_id), decision_reason = nullif(btrim(p_reason), '') where id = p_recovery_id;
  else raise exception 'invalid maintenance recovery transition' using errcode = '23514'; end if;
  insert into public.maintenance_events(hotel_id, occurrence_id, actor_id, event_type, message, metadata)
  values (p_hotel_id, v_item.occurrence_id, p_actor_id, 'finance_recovery_' || p_action,
    nullif(btrim(p_reason), ''), jsonb_build_object('recovery_id', p_recovery_id));
  return v_item.occurrence_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.transition_maintenance_supplier_work(p_hotel_id uuid, p_work_order_id uuid, p_actor_id uuid, p_action text, p_supplier_id uuid DEFAULT NULL::uuid, p_contract_id uuid DEFAULT NULL::uuid, p_external_reference text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_order public.maintenance_work_orders%rowtype; v_next public.maintenance_supplier_work_status;
begin
  select * into v_order from public.maintenance_work_orders where id = p_work_order_id and hotel_id = p_hotel_id for update;
  if not found then return null; end if;
  if p_action = 'send' and v_order.supplier_status in ('not_sent', 'canceled') and p_supplier_id is not null then v_next := 'sent';
  elsif p_action = 'accept' and v_order.supplier_status = 'sent' then v_next := 'accepted';
  elsif p_action = 'start' and v_order.supplier_status in ('sent', 'accepted') then v_next := 'in_service';
  elsif p_action = 'complete' and v_order.supplier_status = 'in_service' then v_next := 'completed';
  elsif p_action = 'cancel' and v_order.supplier_status in ('sent', 'accepted', 'in_service') then v_next := 'canceled';
  else raise exception 'Transição de fornecedor inválida.' using errcode = '23514'; end if;
  update public.maintenance_work_orders set
    supplier_id = case when p_action = 'send' then p_supplier_id else supplier_id end,
    contract_id = case when p_action = 'send' then p_contract_id else contract_id end,
    supplier_status = v_next,
    supplier_external_reference = case when p_action = 'send' then nullif(btrim(p_external_reference), '') else supplier_external_reference end,
    supplier_sent_at = case when p_action = 'send' then public.hotel_operational_now(p_hotel_id) else supplier_sent_at end,
    supplier_accepted_at = case when p_action = 'accept' then public.hotel_operational_now(p_hotel_id) else supplier_accepted_at end,
    supplier_completed_at = case when p_action = 'complete' then public.hotel_operational_now(p_hotel_id) else null end
  where id = p_work_order_id;
  insert into public.maintenance_events(hotel_id, occurrence_id, work_order_id, actor_id, event_type, message, metadata)
  values (p_hotel_id, v_order.occurrence_id, p_work_order_id, p_actor_id, 'supplier_' || p_action, p_notes,
    jsonb_build_object('supplier_id', p_supplier_id, 'contract_id', p_contract_id, 'status', v_next));
  return v_order.occurrence_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_maintenance_affected_rooms(p_hotel_id uuid, p_occurrence_id uuid, p_actor_id uuid, p_room_ids uuid[], p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if nullif(btrim(p_reason),'') is null or not exists(select 1 from public.maintenance_occurrences where id=p_occurrence_id and hotel_id=p_hotel_id) or exists(select 1 from unnest(p_room_ids) x left join public.rooms r on r.id=x and r.hotel_id=p_hotel_id where r.id is null) then return jsonb_build_object('result','invalid'); end if;
  delete from public.maintenance_occurrence_affected_rooms where occurrence_id=p_occurrence_id and source not in ('primary','block') and room_id<>all(p_room_ids);
  insert into public.maintenance_occurrence_affected_rooms(hotel_id,occurrence_id,room_id,source,reason,confirmed_by,impact_started_at) select p_hotel_id,p_occurrence_id,x,'confirmed',btrim(p_reason),p_actor_id,public.hotel_operational_now(p_hotel_id) from unnest(p_room_ids) x on conflict(occurrence_id,room_id) do update set source='confirmed',reason=excluded.reason,confirmed_by=excluded.confirmed_by,impact_started_at=coalesce(maintenance_occurrence_affected_rooms.impact_started_at,public.hotel_operational_now(p_hotel_id)),impact_ended_at=null;
  insert into public.maintenance_events(hotel_id,occurrence_id,actor_id,event_type,message,metadata) values(p_hotel_id,p_occurrence_id,p_actor_id,'affected_rooms_confirmed',btrim(p_reason),jsonb_build_object('room_ids',p_room_ids));
  return jsonb_build_object('result','ok');
end $function$
;

CREATE OR REPLACE FUNCTION public.update_maintenance_operational_resolution()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_occurrence uuid;
begin
  v_occurrence := coalesce(new.occurrence_id, old.occurrence_id);
  if exists (select 1 from public.maintenance_work_orders where occurrence_id = v_occurrence)
    and not exists (
      select 1 from public.maintenance_work_orders
      where occurrence_id = v_occurrence and status not in ('completed', 'canceled')
    ) then
    update public.maintenance_occurrences set operational_resolved_at = coalesce(operational_resolved_at, public.hotel_operational_now((select occurrence.hotel_id from public.maintenance_occurrences occurrence where occurrence.id=v_occurrence))) where id = v_occurrence;
  else
    update public.maintenance_occurrences set operational_resolved_at = null where id = v_occurrence;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_maintenance_contract(p_hotel_id uuid, p_actor_id uuid, p_contract_id uuid, p_supplier_id uuid, p_contract_number text, p_kind maintenance_contract_kind, p_status maintenance_contract_status, p_starts_on date, p_ends_on date, p_renewal_notice_on date, p_scope_notes text, p_response_hours integer, p_resolution_hours integer, p_commercial_terms text, p_contract_amount numeric, p_currency text, p_category_ids uuid[], p_location_ids uuid[], p_termination_reason text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_id uuid;
begin
  if p_contract_id is null then
    insert into public.maintenance_contracts(
      hotel_id, supplier_id, contract_number, kind, status, starts_on, ends_on,
      renewal_notice_on, scope_notes, response_hours, resolution_hours,
      commercial_terms, contract_amount, currency, created_by
    ) values (
      p_hotel_id, p_supplier_id, p_contract_number, p_kind, p_status, p_starts_on,
      p_ends_on, p_renewal_notice_on, p_scope_notes, p_response_hours,
      p_resolution_hours, p_commercial_terms, p_contract_amount, p_currency, p_actor_id
    ) returning id into v_id;
  else
    select id into v_id from public.maintenance_contracts where id = p_contract_id and hotel_id = p_hotel_id for update;
    if not found then return null; end if;
    update public.maintenance_contracts set
      supplier_id = p_supplier_id, contract_number = p_contract_number, kind = p_kind,
      status = p_status, starts_on = p_starts_on, ends_on = p_ends_on,
      renewal_notice_on = p_renewal_notice_on, scope_notes = p_scope_notes,
      response_hours = p_response_hours, resolution_hours = p_resolution_hours,
      commercial_terms = p_commercial_terms, contract_amount = p_contract_amount,
      currency = p_currency,
      terminated_by = case when p_status = 'terminated' then p_actor_id else null end,
      terminated_at = case when p_status = 'terminated' then public.hotel_operational_now(p_hotel_id) else null end,
      termination_reason = case when p_status = 'terminated' then p_termination_reason else null end
    where id = v_id;
    update public.maintenance_contract_categories set is_active = false where contract_id = v_id;
    update public.maintenance_contract_locations set is_active = false where contract_id = v_id;
  end if;
  insert into public.maintenance_contract_categories(hotel_id, contract_id, category_id)
  select p_hotel_id, v_id, value from unnest(coalesce(p_category_ids, array[]::uuid[])) value
  on conflict (contract_id, category_id) do update set is_active = true;
  insert into public.maintenance_contract_locations(hotel_id, contract_id, location_id)
  select p_hotel_id, v_id, value from unnest(coalesce(p_location_ids, array[]::uuid[])) value
  on conflict (contract_id, location_id) do update set is_active = true;
  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.version_minibar_composition(p_hotel_id uuid, p_id uuid, p_actor_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ declare v_version integer; v_id uuid; v_room record; v_location uuid;
begin if not exists(select 1 from public.minibar_compositions where id=p_id and hotel_id=p_hotel_id for update) then return jsonb_build_object('result','not_found'); end if;
 select coalesce(max(version),0)+1 into v_version from public.minibar_composition_versions where composition_id=p_id;
 insert into public.minibar_composition_versions(hotel_id,composition_id,version,activated_at,activated_by,created_by) values(p_hotel_id,p_id,v_version,case when (p_input->>'activate')::boolean then public.hotel_operational_now(p_hotel_id) end,case when (p_input->>'activate')::boolean then p_actor_id end,p_actor_id) returning id into v_id;
 insert into public.minibar_composition_items(hotel_id,version_id,product_id,source_location_id,ideal_quantity) select p_hotel_id,v_id,(x->>'product_id')::uuid,(x->>'source_location_id')::uuid,(x->>'ideal_quantity')::numeric from jsonb_array_elements(p_input->'items') x;
 if (p_input->>'activate')::boolean then update public.minibar_compositions set active_version_id=v_id,updated_at=now() where id=p_id;
  for v_room in select r.* from public.rooms r join public.minibar_compositions c on c.hotel_id=r.hotel_id and lower(btrim(c.room_type))=lower(btrim(r.room_type)) where c.id=p_id loop
   insert into public.inventory_locations(hotel_id,name,internal_code,kind,room_id,is_active,created_by) values(p_hotel_id,'Frigobar '||v_room.room_number,'MINIBAR-'||v_room.id,'minibar_room',v_room.id,true,p_actor_id)
   on conflict(hotel_id,room_id) where room_id is not null do update set is_active=true returning id into v_location;
   insert into public.inventory_positions(hotel_id,product_id,location_id,quantity,minimum_quantity,ideal_quantity,is_active,created_by)
   select p_hotel_id,i.product_id,v_location,0,0,i.ideal_quantity,true,p_actor_id from public.minibar_composition_items i where i.version_id=v_id on conflict(hotel_id,product_id,location_id) do update set ideal_quantity=excluded.ideal_quantity,is_active=true,updated_at=now();
  end loop; end if; return jsonb_build_object('result','ok','id',v_id); exception when foreign_key_violation then return jsonb_build_object('result','invalid_reference'); end $function$
;

CREATE OR REPLACE FUNCTION public.version_rate_plan(p_hotel_id uuid, p_plan_id uuid, p_actor_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$declare v_id uuid;v_number integer;v_activate boolean:=coalesce((p_input->>'activate')::boolean,false);begin
 perform 1 from public.rate_plans where id=p_plan_id and hotel_id=p_hotel_id for update;if not found then return jsonb_build_object('result','not_found');end if;
 select coalesce(max(version_number),0)+1 into v_number from public.rate_plan_versions where rate_plan_id=p_plan_id;
 insert into public.rate_plan_versions(hotel_id,rate_plan_id,version_number,currency,adjustment_type,adjustment_value,included_adults,included_children,extra_adult_amount,extra_child_amount,guarantee_type,guarantee_value,hold_hours,cancellation_type,cancellation_value,cancellation_cutoff_hours,benefit_plan_version_id,channels,activated_at,created_by)
 values(p_hotel_id,p_plan_id,v_number,p_input->>'currency',p_input->>'adjustment_type',(p_input->>'adjustment_value')::numeric,(p_input->>'included_adults')::integer,(p_input->>'included_children')::integer,(p_input->>'extra_adult_amount')::numeric,(p_input->>'extra_child_amount')::numeric,p_input->>'guarantee_type',(p_input->>'guarantee_value')::numeric,(p_input->>'hold_hours')::integer,p_input->>'cancellation_type',(p_input->>'cancellation_value')::numeric,(p_input->>'cancellation_cutoff_hours')::integer,nullif(p_input->>'benefit_plan_version_id','')::uuid,array(select jsonb_array_elements_text(p_input->'channels')),case when v_activate then public.hotel_operational_now(p_hotel_id) end,p_actor_id) returning id into v_id;
 insert into public.rate_plan_version_room_types(hotel_id,version_id,room_type) select p_hotel_id,v_id,value from jsonb_array_elements_text(p_input->'room_types');
 if v_activate then update public.rate_plans set active_version_id=v_id,status='active',updated_at=now() where id=p_plan_id;end if;
 return jsonb_build_object('result','ok','id',v_id,'version_number',v_number);exception when check_violation or invalid_text_representation then return jsonb_build_object('result','invalid');end$function$
;
