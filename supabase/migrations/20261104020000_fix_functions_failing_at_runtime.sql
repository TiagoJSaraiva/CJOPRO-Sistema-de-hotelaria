-- QA-011: funções que falhavam ao executar e nunca foram percorridas por um teste,
-- encontradas pela análise estática de supabase/training/sweeps/plpgsql-static.sql.
-- As correções são mínimas: não alteram nenhuma regra de negócio.
--
-- - CASE com literais vira text e não pode ser atribuído a uma coluna enum;
-- - variável x colidindo com o alias x de jsonb_array_elements ("ambiguous");
-- - pay_procurement_installment lia procurement_invoices.currency, que não existe;
-- - operational_pending_candidates_stage3 lia um campo que o laço não selecionava.
--
-- QA-012: version_minibar_composition percorria quartos de todos os hotéis com a
-- mesma categoria; a FK barrava o vazamento, mas a ativação falhava.

-- Código morto: nenhum gatilho as usa e reservation_rooms não existe mais.
drop function public.validate_capacity_after_reservations_change();
drop function public.validate_capacity_after_reservation_rooms_change();
drop function public.validate_reservation_capacity(uuid);

CREATE OR REPLACE FUNCTION public.allocate_inventory_movement_lots()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
       (new.metadata->>'expires_on')::date,case when nullif(btrim(new.metadata->>'lot_code'),'') is null then 'quarantine'::public.inventory_lot_status else 'active'::public.inventory_lot_status end,new.occurred_at)
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
 end if; return new; end $function$;

CREATE OR REPLACE FUNCTION public.decide_maintenance_reschedule(p_hotel_id uuid, p_request_id uuid, p_actor_id uuid, p_approved boolean, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v public.maintenance_reschedule_requests%rowtype; v_occ uuid;
begin select * into v from public.maintenance_reschedule_requests where id=p_request_id and hotel_id=p_hotel_id for update; if not found then return jsonb_build_object('result','not_found'); end if; if v.status<>'pending' or nullif(btrim(p_reason),'') is null then return jsonb_build_object('result','conflict'); end if;
  update public.maintenance_reschedule_requests set status=case when p_approved then 'approved'::public.maintenance_reschedule_status else 'rejected'::public.maintenance_reschedule_status end,decided_by=p_actor_id,decision_reason=btrim(p_reason),decided_at=now() where id=v.id;
  select occurrence_id into v_occ from public.maintenance_work_orders where id=v.work_order_id; insert into public.maintenance_events(hotel_id,occurrence_id,work_order_id,actor_id,event_type,message,metadata) values(p_hotel_id,v_occ,v.work_order_id,p_actor_id,case when p_approved then 'reschedule_approved' else 'reschedule_rejected' end,btrim(p_reason),jsonb_build_object('request_id',v.id)); return jsonb_build_object('result','ok'); end $function$;

CREATE OR REPLACE FUNCTION public.pay_corporate_receivable(p_hotel_id uuid, p_receivable_id uuid, p_actor_id uuid, p_expected_version integer, p_tenders jsonb, p_idempotency_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_receivable public.corporate_receivables%rowtype;v_tender jsonb;v_total numeric:=0;v_fingerprint text;v_existing record;v_index integer:=0;
begin
  v_fingerprint:=md5(jsonb_build_object('receivable',p_receivable_id,'tenders',p_tenders)::text);
  select id,request_fingerprint into v_existing from public.corporate_receivable_payments where hotel_id=p_hotel_id and idempotency_key=p_idempotency_key;
  if found then return case when v_existing.request_fingerprint=v_fingerprint then jsonb_build_object('result','ok','created',false) else jsonb_build_object('result','idempotency_conflict') end;end if;
  select * into v_receivable from public.corporate_receivables where id=p_receivable_id and hotel_id=p_hotel_id for update;
  if not found then return jsonb_build_object('result','not_found');end if;if v_receivable.version<>p_expected_version then return jsonb_build_object('result','version_conflict');end if;
  for v_tender in select value from jsonb_array_elements(p_tenders) loop v_total:=v_total+(v_tender->>'amount')::numeric;end loop;
  if v_total<=0 or v_receivable.paid_amount+v_total>v_receivable.amount then return jsonb_build_object('result','payment_exceeds_balance');end if;
  for v_tender in select value from jsonb_array_elements(p_tenders) loop
    insert into public.corporate_receivable_payments(hotel_id,receivable_id,amount,payment_method,reference_code,idempotency_key,request_fingerprint,created_by)
    values(p_hotel_id,p_receivable_id,(v_tender->>'amount')::numeric,(v_tender->>'payment_method')::public.consumption_payment_method,nullif(btrim(v_tender->>'reference_code'),''),case when v_index=0 then p_idempotency_key else md5(p_idempotency_key::text||v_index::text)::uuid end,v_fingerprint,p_actor_id);v_index:=v_index+1;
  end loop;
  update public.corporate_receivables set paid_amount=paid_amount+v_total,status=case when paid_amount+v_total=amount then 'paid'::public.corporate_receivable_status else 'partially_paid'::public.corporate_receivable_status end,version=version+1,updated_at=now() where id=p_receivable_id;
  insert into public.corporate_credit_events(hotel_id,entity_type,entity_id,action,actor_id,details) values(p_hotel_id,'receivable',p_receivable_id,'payment_received',p_actor_id,jsonb_build_object('amount',v_total,'multi_tender',jsonb_array_length(p_tenders)>1));
  return jsonb_build_object('result','ok','created',true);
end $function$;

CREATE OR REPLACE FUNCTION public.pay_post_checkout_consumption_case(p_hotel_id uuid, p_case_id uuid, p_actor_id uuid, p_expected_version integer, p_tenders jsonb, p_idempotency_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_case public.post_checkout_consumption_cases%rowtype;v_account public.post_checkout_supplemental_accounts%rowtype;v_tender jsonb;v_total numeric:=0;v_fingerprint text;v_existing record;
begin
  v_fingerprint:=md5(jsonb_build_object('case',p_case_id,'tenders',p_tenders)::text);select id,request_fingerprint into v_existing from public.post_checkout_consumption_payments where hotel_id=p_hotel_id and idempotency_key=p_idempotency_key;if found then return case when v_existing.request_fingerprint=v_fingerprint then jsonb_build_object('result','ok','created',false) else jsonb_build_object('result','idempotency_conflict') end;end if;
  select * into v_case from public.post_checkout_consumption_cases where id=p_case_id and hotel_id=p_hotel_id for update;if not found then return jsonb_build_object('result','not_found');end if;if v_case.version<>p_expected_version then return jsonb_build_object('result','version_conflict');end if;
  select * into v_account from public.post_checkout_supplemental_accounts where case_id=p_case_id for update;if not found or v_case.status not in('collection_pending','partially_paid') then return jsonb_build_object('result','invalid_state');end if;
  for v_tender in select value from jsonb_array_elements(p_tenders) loop v_total:=v_total+(v_tender->>'amount')::numeric;end loop;if v_total<=0 or v_account.paid_amount+v_total>v_account.amount then return jsonb_build_object('result','payment_exceeds_balance');end if;
  for v_tender in select value from jsonb_array_elements(p_tenders) loop insert into public.post_checkout_consumption_payments(hotel_id,case_id,amount,payment_method,reference_code,idempotency_key,request_fingerprint,created_by) values(p_hotel_id,p_case_id,(v_tender->>'amount')::numeric,(v_tender->>'payment_method')::public.consumption_payment_method,nullif(btrim(v_tender->>'reference_code'),''),case when v_total=(v_tender->>'amount')::numeric then p_idempotency_key else md5(p_idempotency_key::text||v_tender::text)::uuid end,v_fingerprint,p_actor_id);end loop;
  update public.post_checkout_supplemental_accounts set paid_amount=paid_amount+v_total,version=version+1,updated_at=now() where id=v_account.id;
  update public.post_checkout_consumption_cases set status=case when v_account.paid_amount+v_total=v_account.amount then 'paid'::public.post_checkout_consumption_status else 'partially_paid'::public.post_checkout_consumption_status end,version=version+1,updated_at=now() where id=p_case_id;
  insert into public.post_checkout_consumption_events(hotel_id,case_id,action,actor_id,details) values(p_hotel_id,p_case_id,'payment_received',p_actor_id,jsonb_build_object('amount',v_total,'multi_tender',jsonb_array_length(p_tenders)>1));return jsonb_build_object('result','ok','created',true);
end $function$;

CREATE OR REPLACE FUNCTION public.pay_partner_settlement_partial(p_hotel_id uuid, p_settlement_id uuid, p_actor_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_set public.partner_settlements%rowtype;
  v_disputed numeric; v_paid numeric; v_available numeric; v_total numeric;
  x jsonb; v_tx uuid; v_pay uuid; v_batch uuid; v_fp text:=md5(p_input::text);
  v_paid_at timestamptz:=coalesce((p_input->>'paid_at')::timestamptz,public.hotel_operational_now(p_hotel_id));
begin
  select * into v_set from public.partner_settlements where id=p_settlement_id and hotel_id=p_hotel_id for update;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if v_set.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict'); end if;
  if v_set.status not in('approved','settled') then return jsonb_build_object('result','invalid_status'); end if;
  if v_paid_at>public.hotel_operational_now(p_hotel_id) then return jsonb_build_object('result','paid_at_in_future'); end if;
  select coalesce(sum(disputed_amount),0) into v_disputed from public.partner_settlement_disputes where settlement_id=p_settlement_id and status in('open','accepted');
  select coalesce(sum(case when reversal_of_id is null then amount else -amount end),0) into v_paid from public.partner_settlement_payments where settlement_id=p_settlement_id;
  select sum((tender->>'amount')::numeric) into v_total from jsonb_array_elements(p_input->'tenders') tender;
  v_available:=greatest(0,abs(v_set.net_settlement)-v_disputed-v_paid);
  if v_total<=0 or v_total>v_available then return jsonb_build_object('result','invalid_amount','context',jsonb_build_object('available',v_available)); end if;
  if exists(select 1 from jsonb_array_elements(p_input->'tenders') tender where tender->>'payment_method'='cash') and nullif(p_input->>'cash_session_id','') is null then return jsonb_build_object('result','cash_session_required'); end if;
  select id into v_batch from public.partner_settlement_payment_batches where hotel_id=p_hotel_id and idempotency_key=(p_input->>'idempotency_key')::uuid and request_fingerprint=v_fp;
  if found then return jsonb_build_object('result','ok','id',v_batch); end if;
  if exists(select 1 from public.partner_settlement_payment_batches where hotel_id=p_hotel_id and idempotency_key=(p_input->>'idempotency_key')::uuid) then return jsonb_build_object('result','idempotency_conflict'); end if;
  insert into public.partner_settlement_payment_batches(hotel_id,settlement_id,idempotency_key,request_fingerprint,total_amount,created_by)
  values(p_hotel_id,p_settlement_id,(p_input->>'idempotency_key')::uuid,v_fp,v_total,p_actor_id) returning id into v_batch;
  for x in select value from jsonb_array_elements(p_input->'tenders') loop
    insert into public.financial_transactions(hotel_id,type,category,amount,currency,description,status,payment_method,paid_at,due_date,counterparty,reference_code,created_by,partner_settlement_id,cash_session_id)
    values(p_hotel_id,case when v_set.direction='hotel_to_partner' then 'EXPENSE'::public.transaction_type else 'INCOME'::public.transaction_type end,'PARTNER_SETTLEMENT',(x->>'amount')::numeric,v_set.currency,'Liquidação parcial de parceiro','COMPLETED',x->>'payment_method',v_paid_at,v_set.due_on,(select trade_name from public.commercial_partners where id=v_set.partner_id),x->>'reference_code',p_actor_id,p_settlement_id,(p_input->>'cash_session_id')::uuid) returning id into v_tx;
    insert into public.partner_settlement_payments(hotel_id,settlement_id,payment_batch_id,financial_transaction_id,amount,direction,payment_method,paid_at,reference_code,notes,idempotency_key,request_fingerprint,created_by,cash_session_id)
    values(p_hotel_id,p_settlement_id,v_batch,v_tx,(x->>'amount')::numeric,v_set.direction,(x->>'payment_method')::public.consumption_payment_method,v_paid_at,x->>'reference_code',p_input->>'notes',gen_random_uuid(),v_fp,p_actor_id,(p_input->>'cash_session_id')::uuid) returning id into v_pay;
  end loop;
  update public.partner_settlements set
    payment_state=case when v_paid+v_total>=abs(net_settlement)-v_disputed then 'settled' else 'partially_settled' end,
    status=case when v_paid+v_total>=abs(net_settlement)-v_disputed then 'settled'::public.partner_settlement_status else 'approved' end,
    settled_by=case when v_paid+v_total>=abs(net_settlement)-v_disputed then p_actor_id end,
    settled_at=case when v_paid+v_total>=abs(net_settlement)-v_disputed then v_paid_at end,
    version=version+1,updated_at=now()
  where id=p_settlement_id;
  insert into public.partner_settlement_events(hotel_id,settlement_id,action,actor_id,details)
  values(p_hotel_id,p_settlement_id,'partial_payment',p_actor_id,jsonb_build_object('amount',v_total,'remaining',v_available-v_total));
  return jsonb_build_object('result','ok','id',v_batch);
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_purchase_order(p_hotel_id uuid, p_actor_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ declare v_id uuid; v_total numeric; v_tier record;
begin
 if (select configuration_required from public.procurement_policies where hotel_id=p_hotel_id) then return jsonb_build_object('result','policy_required'); end if;
 if (p_input->>'currency')<>(select currency from public.procurement_policies where hotel_id=p_hotel_id) then return jsonb_build_object('result','currency_mismatch'); end if;
 select sum((x->>'quantity')::numeric*(x->>'unit_price')::numeric+(x->>'tax_amount')::numeric) into v_total from jsonb_array_elements(p_input->'lines') x;
 select * into v_tier from public.procurement_approval_tiers where hotel_id=p_hotel_id and v_total>=minimum_amount and (maximum_amount is null or v_total<=maximum_amount) order by minimum_amount desc limit 1;
 if not found then return jsonb_build_object('result','approval_tier_missing'); end if;
 if (select count(distinct value->>'supplier_id') from jsonb_array_elements(p_input->'quotes'))<v_tier.quotes_required then return jsonb_build_object('result','quotes_required'); end if;
 if exists(select 1 from public.replenishment_requests r where r.id in(select value::text::uuid from jsonb_array_elements_text(p_input->'replenishment_request_ids')) and (r.hotel_id<>p_hotel_id or r.status<>'approved' or r.location_id<>(p_input->>'destination_location_id')::uuid or r.preferred_supplier_id is not null and r.preferred_supplier_id<>(p_input->>'supplier_id')::uuid)) then return jsonb_build_object('result','incompatible_replenishments'); end if;
 insert into public.purchase_orders(hotel_id,supplier_id,destination_location_id,currency,expected_on,notes,total_amount,required_approvals,required_quotes,created_by)
 values(p_hotel_id,(p_input->>'supplier_id')::uuid,(p_input->>'destination_location_id')::uuid,p_input->>'currency',(p_input->>'expected_on')::date,p_input->>'notes',v_total,v_tier.approvals_required,v_tier.quotes_required,p_actor_id) returning id into v_id;
 insert into public.purchase_order_lines(hotel_id,purchase_order_id,product_id,quantity,unit_price,tax_amount)
 select p_hotel_id,v_id,(x->>'product_id')::uuid,(x->>'quantity')::numeric,(x->>'unit_price')::numeric,(x->>'tax_amount')::numeric from jsonb_array_elements(p_input->'lines') x;
 insert into public.purchase_order_quotes(hotel_id,purchase_order_id,supplier_id,amount,reference)
 select distinct on (x->>'supplier_id') p_hotel_id,v_id,(x->>'supplier_id')::uuid,(x->>'amount')::numeric,x->>'reference' from jsonb_array_elements(p_input->'quotes') x order by x->>'supplier_id';
 insert into public.purchase_order_replenishments(hotel_id,purchase_order_id,replenishment_request_id)
 select p_hotel_id,v_id,value::text::uuid from jsonb_array_elements_text(p_input->'replenishment_request_ids');
 update public.replenishment_requests set status='converted',version=version+1,updated_at=now() where id in(select replenishment_request_id from public.purchase_order_replenishments where purchase_order_id=v_id);
 return jsonb_build_object('result','ok','id',v_id); exception when foreign_key_violation then return jsonb_build_object('result','invalid_reference'); end $function$;

CREATE OR REPLACE FUNCTION public.create_minibar_replenishment_route(p_hotel_id uuid, p_actor_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ declare v_board jsonb; v_id uuid;
begin v_board:=public.get_minibar_replenishment_board(p_hotel_id); if (v_board->>'version')::bigint<>(p_input->>'expected_board_version')::bigint then return jsonb_build_object('result','conflict'); end if;
 insert into public.minibar_replenishment_routes(hotel_id,idempotency_key,request_fingerprint,created_by) values(p_hotel_id,(p_input->>'idempotency_key')::uuid,md5(p_input::text),p_actor_id) returning id into v_id;
 insert into public.minibar_replenishment_route_items(hotel_id,route_id,room_id,product_id,source_position_id,destination_position_id,quantity,status)
 select p_hotel_id,v_id,(x->>'room_id')::uuid,(x->>'product_id')::uuid,(x->>'source_position_id')::uuid,(x->>'destination_position_id')::uuid,least((x->>'required_quantity')::numeric,coalesce((select quantity from public.inventory_positions where id=(x->>'source_position_id')::uuid),0)),case when coalesce((select quantity from public.inventory_positions where id=(x->>'source_position_id')::uuid),0)<(x->>'required_quantity')::numeric then 'shortage' else 'pending' end
 from jsonb_array_elements(v_board->'items') x where (x->>'room_id')::uuid in(select value::text::uuid from jsonb_array_elements_text(p_input->'room_ids')) and (x->>'source_position_id') is not null and (x->>'destination_position_id') is not null and least((x->>'required_quantity')::numeric,coalesce((select quantity from public.inventory_positions where id=(x->>'source_position_id')::uuid),0))>0;
 -- Shortages become normal replenishment episodes through the existing reconciler after thresholds are reached.
 perform public.reconcile_replenishment_requests(p_hotel_id,p_actor_id); return jsonb_build_object('result','ok','id',v_id); exception when unique_violation then select id into v_id from public.minibar_replenishment_routes where hotel_id=p_hotel_id and idempotency_key=(p_input->>'idempotency_key')::uuid and request_fingerprint=md5(p_input::text); if found then return jsonb_build_object('result','ok','id',v_id); end if; return jsonb_build_object('result','idempotency_conflict'); end $function$;

CREATE OR REPLACE FUNCTION public.version_minibar_composition(p_hotel_id uuid, p_id uuid, p_actor_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ declare v_version integer; v_id uuid; v_room record; v_location uuid;
begin if not exists(select 1 from public.minibar_compositions where id=p_id and hotel_id=p_hotel_id for update) then return jsonb_build_object('result','not_found'); end if;
 select coalesce(max(version),0)+1 into v_version from public.minibar_composition_versions where composition_id=p_id;
 insert into public.minibar_composition_versions(hotel_id,composition_id,version,activated_at,activated_by,created_by) values(p_hotel_id,p_id,v_version,case when (p_input->>'activate')::boolean then now() end,case when (p_input->>'activate')::boolean then p_actor_id end,p_actor_id) returning id into v_id;
 insert into public.minibar_composition_items(hotel_id,version_id,product_id,source_location_id,ideal_quantity) select p_hotel_id,v_id,(x->>'product_id')::uuid,(x->>'source_location_id')::uuid,(x->>'ideal_quantity')::numeric from jsonb_array_elements(p_input->'items') x;
 if (p_input->>'activate')::boolean then update public.minibar_compositions set active_version_id=v_id,updated_at=now() where id=p_id;
  for v_room in select r.* from public.rooms r join public.minibar_compositions c on c.hotel_id=r.hotel_id and lower(btrim(c.room_type))=lower(btrim(r.room_type)) where c.id=p_id loop
   insert into public.inventory_locations(hotel_id,name,internal_code,kind,room_id,is_active,created_by) values(p_hotel_id,'Frigobar '||v_room.room_number,'MINIBAR-'||v_room.id,'minibar_room',v_room.id,true,p_actor_id)
   on conflict(hotel_id,room_id) where room_id is not null do update set is_active=true returning id into v_location;
   insert into public.inventory_positions(hotel_id,product_id,location_id,quantity,minimum_quantity,ideal_quantity,is_active,created_by)
   select p_hotel_id,i.product_id,v_location,0,0,i.ideal_quantity,true,p_actor_id from public.minibar_composition_items i where i.version_id=v_id on conflict(hotel_id,product_id,location_id) do update set ideal_quantity=excluded.ideal_quantity,is_active=true,updated_at=now();
  end loop; end if; return jsonb_build_object('result','ok','id',v_id); exception when foreign_key_violation then return jsonb_build_object('result','invalid_reference'); end $function$;

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
   insert into public.inventory_lots(hotel_id,product_id,lot_code,expires_on,received_at) values(p_hotel_id,p_product_id,btrim(x->>'lot_code'),(x->>'expires_on')::date,now())
   on conflict(hotel_id,product_id,lot_code) do update set expires_on=excluded.expires_on returning id into v_lot;
   insert into public.inventory_lot_balances(hotel_id,lot_id,position_id,quantity) values(p_hotel_id,v_lot,(x->>'position_id')::uuid,(x->>'quantity')::numeric);
  end loop;
 else delete from public.inventory_lot_balances where position_id in(select id from public.inventory_positions where hotel_id=p_hotel_id and product_id=p_product_id); end if;
 update public.products set lot_tracking_mode=v_mode,expiry_alert_days=(p_input->>'expiry_alert_days')::integer,updated_at=now() where id=p_product_id; return jsonb_build_object('result','ok'); end $function$;

CREATE OR REPLACE FUNCTION public.pay_procurement_installment(p_hotel_id uuid, p_id uuid, p_actor_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ declare v_due record; x jsonb; v_total numeric; v_payment uuid; v_batch uuid; v_tx uuid; v_fp text:=md5(p_input::text);
begin select d.*,i.status invoice_status,i.version invoice_version,o.supplier_id,b.legal_name from public.procurement_invoice_due_dates d join public.procurement_invoices i on i.id=d.invoice_id join public.purchase_orders o on o.id=i.purchase_order_id join public.procurement_suppliers s on s.id=o.supplier_id join public.business_organizations b on b.id=s.organization_id where d.id=p_id and d.hotel_id=p_hotel_id for update into v_due;
 if not found then return jsonb_build_object('result','not_found'); end if; if v_due.invoice_version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict'); end if;
 select sum((tender->>'amount')::numeric) into v_total from jsonb_array_elements(p_input->'tenders') tender; if v_total<=0 or v_due.paid_amount+v_total>v_due.amount then return jsonb_build_object('result','invalid_amount'); end if;
 if exists(select 1 from jsonb_array_elements(p_input->'tenders') tender where tender->>'payment_method'='cash') and nullif(p_input->>'cash_session_id','') is null then return jsonb_build_object('result','cash_session_required'); end if;
 select id into v_batch from public.procurement_payment_batches where hotel_id=p_hotel_id and idempotency_key=(p_input->>'idempotency_key')::uuid and request_fingerprint=v_fp; if found then return jsonb_build_object('result','ok','id',v_batch); end if;
 if exists(select 1 from public.procurement_payment_batches where hotel_id=p_hotel_id and idempotency_key=(p_input->>'idempotency_key')::uuid) then return jsonb_build_object('result','idempotency_conflict'); end if;
 insert into public.procurement_payment_batches(hotel_id,installment_id,idempotency_key,request_fingerprint,total_amount,created_by) values(p_hotel_id,p_id,(p_input->>'idempotency_key')::uuid,v_fp,v_total,p_actor_id) returning id into v_batch;
 for x in select value from jsonb_array_elements(p_input->'tenders') loop
   insert into public.financial_transactions(hotel_id,type,category,amount,currency,description,status,payment_method,paid_at,counterparty,reference_code,created_by)
   values(p_hotel_id,'EXPENSE','PROCUREMENT',(x->>'amount')::numeric,(select o.currency from public.procurement_invoices inv join public.purchase_orders o on o.id=inv.purchase_order_id where inv.id=v_due.invoice_id),'Pagamento de fornecedor','COMPLETED',x->>'payment_method',now(),v_due.legal_name,x->>'reference_code',p_actor_id) returning id into v_tx;
   insert into public.procurement_payments(hotel_id,installment_id,payment_batch_id,financial_transaction_id,amount,payment_method,reference_code,cash_session_id,idempotency_key,request_fingerprint,paid_at,created_by)
   values(p_hotel_id,p_id,v_batch,v_tx,(x->>'amount')::numeric,x->>'payment_method',x->>'reference_code',(p_input->>'cash_session_id')::uuid,gen_random_uuid(),v_fp,now(),p_actor_id) returning id into v_payment;
 end loop;
 update public.procurement_invoice_due_dates set paid_amount=paid_amount+v_total,version=version+1 where id=p_id;
 update public.procurement_invoices set status=case when exists(select 1 from public.procurement_invoice_due_dates where invoice_id=v_due.invoice_id and id<>p_id and paid_amount<amount) or v_due.paid_amount+v_total<v_due.amount then 'partially_paid'::public.procurement_invoice_status else 'paid' end,version=version+1,updated_at=now() where id=v_due.invoice_id;
 return jsonb_build_object('result','ok','id',v_batch); end $function$;

CREATE OR REPLACE FUNCTION public.operational_pending_candidates_stage3(p_hotel_id uuid, p_now timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
  for v in select s.id,s.work_order_id,s.planned_end,w.occurrence_id,o.occurrence_number from public.maintenance_schedules s join public.maintenance_work_orders w on w.id=s.work_order_id join public.maintenance_occurrences o on o.id=w.occurrence_id where s.hotel_id=p_hotel_id and s.status in ('planned','in_progress') and s.planned_end<=p_now and not exists(select 1 from public.maintenance_service_confirmations c where c.work_order_id=s.work_order_id)
  loop v_result:=v_result||jsonb_build_array(jsonb_build_object('source','maintenance','source_key','maintenance:confirmation:'||v.id,'kind','maintenance_service_confirmation','entity_type','work_order','entity_id',v.work_order_id,'title','Atendimento aguarda confirmação: MAN-'||lpad(v.occurrence_number::text,6,'0'),'href','/dashboard/maintenance/occurrences/'||v.occurrence_id,'severity','info','due_on',v.planned_end::date)); end loop;
  return v_result;
end $function$;
