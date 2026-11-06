-- Estoque e compras usam o relógio do hotel, mas o limite de "data futura" comparava com o tempo
-- real: com o relógio à frente, como em treinamento, entrada, transferência e recebimento quebravam.
-- O limite passa a ser a hora do hotel. `posted_at` continua sendo o instante técnico do registro,
-- e pode ser anterior a `occurred_at` nesse caso, por isso a restrição entre os dois sai.
alter table public.inventory_documents drop constraint inventory_documents_time_check;

CREATE OR REPLACE FUNCTION public.post_inventory_document(p_hotel_id uuid, p_actor_id uuid, p_kind inventory_document_kind, p_direction text, p_reason text, p_reference text, p_occurred_at timestamp with time zone, p_lines jsonb, p_idempotency_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_document_id uuid:=gen_random_uuid(); v_existing record; v_fingerprint text; v_line jsonb; v_result jsonb;
  v_delta numeric; v_movement_kind public.inventory_movement_kind;
begin
  perform public.inventory_assert_actor(p_actor_id,p_hotel_id);
  if p_kind not in ('receipt','adjustment','loss','internal_use') or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)<1
    or length(coalesce(btrim(p_reason),''))<3 or p_occurred_at>public.hotel_operational_now(p_hotel_id) then return jsonb_build_object('result','invalid_document'); end if;
  v_fingerprint:=md5(jsonb_build_object('kind',p_kind,'direction',p_direction,'reason',btrim(p_reason),'reference',nullif(btrim(p_reference),''),'occurred',p_occurred_at,'lines',p_lines)::text);
  select id,request_fingerprint into v_existing from public.inventory_documents where hotel_id=p_hotel_id and idempotency_key=p_idempotency_key for update;
  if found then return case when v_existing.request_fingerprint=v_fingerprint then jsonb_build_object('result','ok','document_id',v_existing.id,'created',false) else jsonb_build_object('result','idempotency_conflict') end; end if;
  insert into public.inventory_documents(id,hotel_id,kind,reason,reference_code,occurred_at,posted_by,idempotency_key,request_fingerprint)
  values(v_document_id,p_hotel_id,p_kind,btrim(p_reason),nullif(btrim(p_reference),''),p_occurred_at,p_actor_id,p_idempotency_key,v_fingerprint);
  for v_line in select value from jsonb_array_elements(p_lines) order by value->>'position_id' loop
    v_delta:=(v_line->>'quantity')::numeric;
    if v_delta<=0 then raise exception 'invalid inventory quantity' using errcode='23514'; end if;
    if p_kind='receipt' then v_movement_kind:='receipt';
    elsif p_kind='loss' then v_movement_kind:='loss'; v_delta:=-v_delta;
    elsif p_kind='internal_use' then v_movement_kind:='internal_use'; v_delta:=-v_delta;
    elsif p_direction='in' then v_movement_kind:='adjustment_in';
    elsif p_direction='out' then v_movement_kind:='adjustment_out'; v_delta:=-v_delta;
    else raise exception 'invalid inventory direction' using errcode='23514'; end if;
    v_result:=public.apply_inventory_delta((v_line->>'position_id')::uuid,p_hotel_id,v_delta,v_movement_kind,p_actor_id,p_occurred_at,p_reason,p_reference,
      nullif(v_line->>'unit_cost','')::numeric,v_document_id);
    if v_result->>'result'<>'ok' then raise exception '%',v_result->>'result' using errcode='23514'; end if;
  end loop;
  insert into public.inventory_audit_events(hotel_id,entity_type,entity_id,action,actor_id,changes)
  values(p_hotel_id,'document',v_document_id,'completed',p_actor_id,jsonb_build_object('kind',p_kind,'line_count',jsonb_array_length(p_lines)));
  return jsonb_build_object('result','ok','document_id',v_document_id,'created',true);
exception when check_violation then return jsonb_build_object('result',sqlerrm); end;
$function$;

CREATE OR REPLACE FUNCTION public.transfer_inventory(p_hotel_id uuid, p_actor_id uuid, p_source_location_id uuid, p_destination_location_id uuid, p_product_id uuid, p_quantity numeric, p_reason text, p_reference text, p_occurred_at timestamp with time zone, p_idempotency_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_source public.inventory_positions%rowtype; v_destination public.inventory_positions%rowtype; v_document_id uuid:=gen_random_uuid();
  v_fingerprint text; v_existing record; v_result jsonb;
begin
  perform public.inventory_assert_actor(p_actor_id,p_hotel_id);
  if p_source_location_id=p_destination_location_id or p_quantity<=0 or p_quantity<>trunc(p_quantity) or p_occurred_at>public.hotel_operational_now(p_hotel_id) or length(coalesce(btrim(p_reason),''))<3
    then return jsonb_build_object('result','invalid_transfer'); end if;
  v_fingerprint:=md5(jsonb_build_object('source',p_source_location_id,'destination',p_destination_location_id,'product',p_product_id,'quantity',p_quantity,'reason',btrim(p_reason),'reference',nullif(btrim(p_reference),''),'occurred',p_occurred_at)::text);
  select id,request_fingerprint into v_existing from public.inventory_documents where hotel_id=p_hotel_id and idempotency_key=p_idempotency_key for update;
  if found then return case when v_existing.request_fingerprint=v_fingerprint then jsonb_build_object('result','ok','document_id',v_existing.id,'created',false) else jsonb_build_object('result','idempotency_conflict') end; end if;
  perform 1 from public.inventory_positions where hotel_id=p_hotel_id and product_id=p_product_id and location_id in(p_source_location_id,p_destination_location_id) order by id for update;
  select * into v_source from public.inventory_positions where hotel_id=p_hotel_id and product_id=p_product_id and location_id=p_source_location_id;
  select * into v_destination from public.inventory_positions where hotel_id=p_hotel_id and product_id=p_product_id and location_id=p_destination_location_id;
  if v_source.id is null or v_destination.id is null then return jsonb_build_object('result','position_not_found'); end if;
  insert into public.inventory_documents(id,hotel_id,kind,reason,reference_code,occurred_at,posted_by,idempotency_key,request_fingerprint,metadata)
  values(v_document_id,p_hotel_id,'transfer',btrim(p_reason),nullif(btrim(p_reference),''),p_occurred_at,p_actor_id,p_idempotency_key,v_fingerprint,jsonb_build_object('source_location_id',p_source_location_id,'destination_location_id',p_destination_location_id));
  v_result:=public.apply_inventory_delta(v_source.id,p_hotel_id,-p_quantity,'transfer_out',p_actor_id,p_occurred_at,p_reason,p_reference,null,v_document_id);
  if v_result->>'result'<>'ok' then raise exception '%',v_result->>'result' using errcode='23514'; end if;
  v_result:=public.apply_inventory_delta(v_destination.id,p_hotel_id,p_quantity,'transfer_in',p_actor_id,p_occurred_at,p_reason,p_reference,v_source.average_unit_cost,v_document_id);
  if v_result->>'result'<>'ok' then raise exception '%',v_result->>'result' using errcode='23514'; end if;
  return jsonb_build_object('result','ok','document_id',v_document_id,'created',true);
exception when check_violation then return jsonb_build_object('result',sqlerrm); end;
$function$;

CREATE OR REPLACE FUNCTION public.receive_purchase_order(p_hotel_id uuid, p_id uuid, p_actor_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ declare v_order public.purchase_orders%rowtype; v_receipt uuid; v_line record; x jsonb; v_pos record; v_doc uuid; v_movement uuid;
begin select * into v_order from public.purchase_orders where id=p_id and hotel_id=p_hotel_id for update;
 if not found then return jsonb_build_object('result','not_found'); end if; if v_order.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict'); end if;
 if v_order.status not in('issued','partially_received') then return jsonb_build_object('result','invalid_transition'); end if;
 if exists(select 1 from public.purchase_receipts where hotel_id=p_hotel_id and idempotency_key=(p_input->>'idempotency_key')::uuid and request_fingerprint<>md5(p_input::text)) then return jsonb_build_object('result','idempotency_conflict'); end if;
 select id into v_receipt from public.purchase_receipts where hotel_id=p_hotel_id and idempotency_key=(p_input->>'idempotency_key')::uuid; if found then return jsonb_build_object('result','ok','id',v_receipt); end if;
 if (p_input->>'occurred_at')::timestamptz>public.hotel_operational_now(p_hotel_id) then return jsonb_build_object('result','invalid_occurred_at'); end if;
 insert into public.purchase_receipts(hotel_id,purchase_order_id,occurred_at,reference_code,notes,idempotency_key,request_fingerprint,received_by)
 values(p_hotel_id,p_id,(p_input->>'occurred_at')::timestamptz,p_input->>'reference_code',p_input->>'notes',(p_input->>'idempotency_key')::uuid,md5(p_input::text),p_actor_id) returning id into v_receipt;
 insert into public.inventory_documents(hotel_id,kind,reason,reference_code,occurred_at,posted_by,idempotency_key,request_fingerprint,metadata)
 values(p_hotel_id,'receipt','Recebimento de pedido de compra',p_input->>'reference_code',(p_input->>'occurred_at')::timestamptz,p_actor_id,gen_random_uuid(),md5(p_input::text),jsonb_build_object('purchase_order_id',p_id)) returning id into v_doc;
 for x in select value from jsonb_array_elements(p_input->'lines') loop
   select * into v_line from public.purchase_order_lines where id=(x->>'order_line_id')::uuid and purchase_order_id=p_id and hotel_id=p_hotel_id for update;
   if not found or v_line.received_quantity+(x->>'accepted_quantity')::numeric>v_line.quantity then raise exception 'invalid_quantity'; end if;
   select * into v_pos from public.inventory_positions where hotel_id=p_hotel_id and product_id=v_line.product_id and location_id=v_order.destination_location_id for update;
   if not found then raise exception 'inventory_position_missing'; end if;
   v_movement:=null;
   if (x->>'accepted_quantity')::numeric>0 then
     insert into public.inventory_movements(hotel_id,position_id,product_id,location_id,kind,quantity_delta,quantity_before,quantity_after,average_unit_cost,total_cost,reason,reference_code,occurred_at,actor_id,document_id,metadata)
     values(p_hotel_id,v_pos.id,v_pos.product_id,v_pos.location_id,'receipt',(x->>'accepted_quantity')::numeric,v_pos.quantity,v_pos.quantity+(x->>'accepted_quantity')::numeric,
       case when v_pos.quantity+(x->>'accepted_quantity')::numeric=0 then v_pos.average_unit_cost else ((v_pos.quantity*coalesce(v_pos.average_unit_cost,0))+((x->>'accepted_quantity')::numeric*(x->>'unit_cost')::numeric))/(v_pos.quantity+(x->>'accepted_quantity')::numeric) end,
       (x->>'accepted_quantity')::numeric*(x->>'unit_cost')::numeric,'Recebimento de compra',p_input->>'reference_code',(p_input->>'occurred_at')::timestamptz,p_actor_id,v_doc,jsonb_strip_nulls(jsonb_build_object('lot_code',x->>'lot_code','expires_on',x->>'expires_on'))) returning id into v_movement;
     update public.inventory_positions set quantity=quantity+(x->>'accepted_quantity')::numeric,average_unit_cost=case when quantity+(x->>'accepted_quantity')::numeric=0 then average_unit_cost else ((quantity*coalesce(average_unit_cost,0))+((x->>'accepted_quantity')::numeric*(x->>'unit_cost')::numeric))/(quantity+(x->>'accepted_quantity')::numeric) end,version=version+1,updated_at=now() where id=v_pos.id;
   end if;
   update public.purchase_order_lines set received_quantity=received_quantity+(x->>'accepted_quantity')::numeric where id=v_line.id;
   insert into public.purchase_receipt_lines(hotel_id,receipt_id,order_line_id,accepted_quantity,rejected_quantity,unit_cost,lot_code,expires_on,evidence_path,inventory_movement_id)
   values(p_hotel_id,v_receipt,v_line.id,(x->>'accepted_quantity')::numeric,(x->>'rejected_quantity')::numeric,(x->>'unit_cost')::numeric,x->>'lot_code',(x->>'expires_on')::date,x->>'evidence_path',v_movement);
 end loop;
 update public.purchase_orders set status=case when exists(select 1 from public.purchase_order_lines where purchase_order_id=p_id and received_quantity<quantity) then 'partially_received'::public.purchase_order_status else 'received' end,version=version+1,updated_at=now() where id=p_id;
 perform public.reconcile_replenishment_requests(p_hotel_id,p_actor_id); return jsonb_build_object('result','ok','id',v_receipt);
 exception when others then if sqlerrm in('invalid_quantity','inventory_position_missing') then return jsonb_build_object('result',sqlerrm); else raise; end if; end $function$;
