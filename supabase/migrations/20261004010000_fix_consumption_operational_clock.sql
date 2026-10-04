-- Consumption follows the same hotel clock as arrival; technical audit timestamps remain real.

create or replace function public.get_consumption_operational_context(
  p_hotel_id uuid, p_stay_id uuid, p_occurred_at timestamptz default null
) returns jsonb language plpgsql stable set search_path = public as $$
declare v_stay record; v_offers jsonb; v_guests jsonb; v_now timestamptz := public.hotel_operational_now(p_hotel_id);
begin
  p_occurred_at := coalesce(p_occurred_at, v_now);
  select stay.*, reservation.reservation_code, room.room_number, room.room_type,
    customer.full_name primary_guest_name
  into v_stay from public.stays stay
  join public.reservations reservation on reservation.id = stay.reservation_id and reservation.hotel_id = p_hotel_id
  join public.rooms room on room.id = stay.room_id and room.hotel_id = p_hotel_id
  join public.customers customer on customer.id = reservation.booking_customer_id
  where stay.id = p_stay_id;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if v_stay.stay_status <> 'checked_in' then return jsonb_build_object('result', 'stay_not_checked_in'); end if;
  if v_stay.checkin_date_actual is null or p_occurred_at < v_stay.checkin_date_actual then
    return jsonb_build_object('result', 'occurred_before_checkin');
  end if;
  if p_occurred_at > v_now then return jsonb_build_object('result', 'occurred_in_future'); end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', customer.id, 'name', customer.full_name) order by customer.full_name), '[]'::jsonb)
  into v_guests from public.stay_customers link join public.customers customer on customer.id = link.customer_id
  where link.stay_id = p_stay_id and customer.hotel_id = p_hotel_id;
  select coalesce(jsonb_agg(public.resolve_consumption_offer_snapshot(p_hotel_id, offer.id, p_occurred_at)
    order by point.display_order, offer.display_order, offer.id), '[]'::jsonb)
  into v_offers from public.consumption_offers offer
  join public.consumption_points point on point.id = offer.point_id and point.hotel_id = offer.hotel_id
  where offer.hotel_id = p_hotel_id and offer.archived_at is null and point.archived_at is null;
  return jsonb_build_object('result', 'ok', 'stay', jsonb_build_object(
    'id', v_stay.id, 'reservation_id', v_stay.reservation_id, 'reservation_code', v_stay.reservation_code,
    'room_id', v_stay.room_id, 'room_number', v_stay.room_number, 'room_type', v_stay.room_type,
    'stay_status', v_stay.stay_status,
    'primary_guest_name', v_stay.primary_guest_name, 'checkin_date_actual', v_stay.checkin_date_actual,
    'checkout_date_expected', v_stay.checkout_date_expected), 'guests', v_guests, 'offers', v_offers,
    'occurred_at', p_occurred_at, 'operational_now', v_now);
end;
$$;

create or replace function public.post_consumption_order(
  p_hotel_id uuid, p_stay_id uuid, p_point_id uuid, p_actor_id uuid, p_occurred_at timestamptz,
  p_disposition public.consumption_order_disposition, p_billing_mode public.consumption_billing_mode,
  p_items jsonb, p_idempotency_key uuid, p_guest_customer_id uuid default null,
  p_payment_method public.consumption_payment_method default null, p_payment_reference text default null,
  p_partner_receipt_confirmed boolean default false, p_notes text default null, p_courtesy_reason text default null
) returns jsonb language plpgsql set search_path = public as $$
declare
  v_now timestamptz := public.hotel_operational_now(p_hotel_id);
  v_stay record; v_point record; v_existing record; v_item jsonb; v_snapshot jsonb;
  v_order_id uuid := gen_random_uuid(); v_offer_id uuid; v_quantity numeric(12,3);
  v_gross numeric(12,2) := 0; v_line numeric(12,2); v_partner_id uuid; v_direct_partner uuid;
  v_agreement_id uuid; v_direct_agreement uuid;
  v_fingerprint text; v_debit_id uuid; v_credit_id uuid; v_transaction_id uuid; v_action text;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then
    return jsonb_build_object('result', 'invalid_items');
  end if;
  v_fingerprint := md5(jsonb_build_object('stay', p_stay_id, 'point', p_point_id, 'occurred', p_occurred_at,
    'disposition', p_disposition, 'mode', p_billing_mode, 'items', p_items, 'guest', p_guest_customer_id,
    'method', p_payment_method, 'reference', nullif(btrim(p_payment_reference), ''),
    'partner_confirmed', p_partner_receipt_confirmed, 'notes', nullif(btrim(p_notes), ''),
    'courtesy_reason', nullif(btrim(p_courtesy_reason), ''))::text);
  select id, request_fingerprint into v_existing from public.consumption_orders
    where hotel_id = p_hotel_id and idempotency_key = p_idempotency_key for update;
  if found then
    if v_existing.request_fingerprint = v_fingerprint then
      return jsonb_build_object('result', 'ok', 'order_id', v_existing.id, 'created', false);
    end if;
    return jsonb_build_object('result', 'idempotency_conflict');
  end if;
  if not public.maintenance_user_has_hotel_scope(p_actor_id, p_hotel_id) then
    return jsonb_build_object('result', 'actor_outside_hotel');
  end if;
  select stay.id, stay.reservation_id, stay.room_id, stay.stay_status, stay.checkin_date_actual,
    reservation.reservation_code, room.room_number, hotel.currency, customer.full_name primary_guest_name
  into v_stay from public.stays stay
  join public.reservations reservation on reservation.id = stay.reservation_id and reservation.hotel_id = p_hotel_id
  join public.rooms room on room.id = stay.room_id and room.hotel_id = p_hotel_id
  join public.hotels hotel on hotel.id = p_hotel_id
  join public.customers customer on customer.id = reservation.booking_customer_id
  where stay.id = p_stay_id for update of stay;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if v_stay.stay_status <> 'checked_in' then return jsonb_build_object('result', 'stay_not_checked_in'); end if;
  if v_stay.checkin_date_actual is null or p_occurred_at < v_stay.checkin_date_actual then
    return jsonb_build_object('result', 'occurred_before_checkin');
  end if;
  if p_occurred_at > v_now then return jsonb_build_object('result', 'occurred_in_future'); end if;
  if p_guest_customer_id is not null and not exists (
    select 1 from public.stay_customers where stay_id = p_stay_id and customer_id = p_guest_customer_id
  ) then return jsonb_build_object('result', 'guest_outside_stay'); end if;
  select * into v_point from public.consumption_points where id = p_point_id and hotel_id = p_hotel_id for update;
  if not found then return jsonb_build_object('result', 'point_not_found'); end if;
  if v_point.archived_at is not null or not v_point.is_active then return jsonb_build_object('result', 'point_unavailable'); end if;
  if (select count(*) from jsonb_array_elements(p_items)) <> (
    select count(distinct value->>'offer_id') from jsonb_array_elements(p_items)
  ) then return jsonb_build_object('result', 'duplicate_offer'); end if;

  perform 1 from public.consumption_offers offer
    where offer.hotel_id = p_hotel_id and offer.id in (select (value->>'offer_id')::uuid from jsonb_array_elements(p_items))
    order by offer.id for update;
  perform 1 from public.products product where product.hotel_id = p_hotel_id and product.id in (
    select offer.product_id from public.consumption_offers offer
    where offer.id in (select (value->>'offer_id')::uuid from jsonb_array_elements(p_items))
  ) order by product.id for update;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_offer_id := (v_item->>'offer_id')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;
    v_snapshot := public.resolve_consumption_offer_snapshot(p_hotel_id, v_offer_id, p_occurred_at);
    if not coalesce((v_snapshot->>'found')::boolean, false) then return jsonb_build_object('result', 'offer_not_found'); end if;
    if (v_snapshot->>'point_id')::uuid <> p_point_id then return jsonb_build_object('result', 'offer_outside_point'); end if;
    if not coalesce((v_snapshot->>'available')::boolean, false) then
      return jsonb_build_object('result', 'offer_unavailable', 'reasons', v_snapshot->'reasons');
    end if;
    if v_item->>'version_token' is distinct from v_snapshot->>'version_token' then
      return jsonb_build_object('result', 'version_conflict');
    end if;
    if v_quantity <= 0 or v_quantity > 9999 or ((v_snapshot->>'sales_unit') <> 'hour' and v_quantity <> trunc(v_quantity)) then
      return jsonb_build_object('result', 'invalid_quantity');
    end if;
    if p_disposition = 'charged' and not exists (
      select 1 from jsonb_array_elements_text(v_snapshot->'allowed_modes') mode where mode = p_billing_mode::text
    ) then return jsonb_build_object('result', 'billing_mode_not_allowed'); end if;
    if p_billing_mode = 'partner_direct' then
      if v_snapshot->>'provider_type' <> 'partner' then return jsonb_build_object('result', 'partner_direct_requires_partner'); end if;
      v_partner_id := (v_snapshot->>'partner_id')::uuid;
      v_agreement_id := (v_snapshot->>'agreement_id')::uuid;
      if v_direct_partner is null then v_direct_partner := v_partner_id;
      elsif v_direct_partner <> v_partner_id then return jsonb_build_object('result', 'different_partners'); end if;
      if v_direct_agreement is null then v_direct_agreement := v_agreement_id;
      elsif v_direct_agreement <> v_agreement_id then return jsonb_build_object('result', 'different_partners'); end if;
    end if;
    v_line := round(v_quantity * (v_snapshot->>'unit_price')::numeric, 2);
    v_gross := v_gross + v_line;
  end loop;
  if v_gross <= 0 then return jsonb_build_object('result', 'invalid_total'); end if;
  if p_disposition = 'courtesy' then
    if p_billing_mode is not null or p_payment_method is not null or p_partner_receipt_confirmed
      or nullif(btrim(p_payment_reference), '') is not null
      or length(coalesce(btrim(p_courtesy_reason), '')) < 3 then return jsonb_build_object('result', 'invalid_courtesy'); end if;
  elsif p_disposition <> 'charged' or p_billing_mode is null then return jsonb_build_object('result', 'invalid_disposition');
  elsif p_billing_mode = 'hotel_immediate' and p_payment_method is null then return jsonb_build_object('result', 'payment_method_required');
  elsif p_billing_mode <> 'hotel_immediate' and p_payment_method is not null then return jsonb_build_object('result', 'payment_method_not_allowed');
  elsif p_billing_mode <> 'hotel_immediate' and nullif(btrim(p_payment_reference), '') is not null then return jsonb_build_object('result', 'payment_reference_not_allowed');
  elsif p_billing_mode = 'partner_direct' and not p_partner_receipt_confirmed then return jsonb_build_object('result', 'partner_confirmation_required');
  elsif p_billing_mode <> 'partner_direct' and p_partner_receipt_confirmed then return jsonb_build_object('result', 'partner_confirmation_not_allowed');
  end if;

  insert into public.consumption_orders(
    id, hotel_id, stay_id, reservation_id, point_id, guest_customer_id, disposition, billing_mode,
    payment_method, payment_reference, partner_receipt_confirmed, currency, gross_amount, discount_amount,
    net_amount, reservation_code_snapshot, room_number_snapshot, guest_name_snapshot, point_name_snapshot,
    notes, courtesy_reason, occurred_at, posted_by, idempotency_key, request_fingerprint, posted_at
  ) values (
    v_order_id, p_hotel_id, p_stay_id, v_stay.reservation_id, p_point_id, p_guest_customer_id, p_disposition,
    case when p_disposition = 'charged' then p_billing_mode else null end,
    p_payment_method, nullif(btrim(p_payment_reference), ''), p_partner_receipt_confirmed, v_stay.currency,
    v_gross, case when p_disposition = 'courtesy' then v_gross else 0 end,
    case when p_disposition = 'courtesy' then 0 else v_gross end, v_stay.reservation_code,
    v_stay.room_number, coalesce((select full_name from public.customers where id = p_guest_customer_id), v_stay.primary_guest_name),
    v_point.name, nullif(btrim(p_notes), ''), nullif(btrim(p_courtesy_reason), ''), p_occurred_at,
    p_actor_id, p_idempotency_key, v_fingerprint, v_now
  );

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_offer_id := (v_item->>'offer_id')::uuid; v_quantity := (v_item->>'quantity')::numeric;
    v_snapshot := public.resolve_consumption_offer_snapshot(p_hotel_id, v_offer_id, p_occurred_at);
    v_line := round(v_quantity * (v_snapshot->>'unit_price')::numeric, 2);
    insert into public.consumption_order_items(
      hotel_id, order_id, offer_id, product_id, category_id, commercial_partner_id,
      commercial_agreement_id, commercial_revision_id, quantity, charged_unit_price, discount_amount,
      product_name_snapshot, product_internal_code_snapshot, product_kind_snapshot, sales_unit_snapshot,
      category_name_snapshot, provider_type_snapshot, partner_name_snapshot, agreement_number_snapshot,
      commercial_revision_version_snapshot, commercial_terms_snapshot, billing_policy_snapshot, version_token, notes
    ) values (
      p_hotel_id, v_order_id, v_offer_id, (v_snapshot->>'product_id')::uuid, (v_snapshot->>'category_id')::uuid,
      nullif(v_snapshot->>'partner_id', '')::uuid, nullif(v_snapshot->>'agreement_id', '')::uuid,
      nullif(v_snapshot->'revision'->>'id', '')::uuid, v_quantity, (v_snapshot->>'unit_price')::numeric,
      case when p_disposition = 'courtesy' then v_line else 0 end, v_snapshot->>'product_name',
      v_snapshot->>'product_code', (v_snapshot->>'product_kind')::public.product_kind,
      (v_snapshot->>'sales_unit')::public.product_sales_unit, v_snapshot->>'category_name',
      (v_snapshot->>'provider_type')::public.product_provider_type, v_snapshot->>'partner_name',
      v_snapshot->>'agreement_number', nullif(v_snapshot->'revision'->>'version', '')::integer,
      v_snapshot->'revision', v_snapshot->'billing_policy', v_snapshot->>'version_token',
      nullif(btrim(v_item->>'notes'), '')
    );
  end loop;

  if p_disposition = 'charged' and p_billing_mode in ('stay_folio', 'hotel_immediate') then
    insert into public.stay_folio_entries(hotel_id, stay_id, reservation_id, direction, kind, amount, currency,
      description, consumption_order_id, source_key, posted_by, posted_at)
    values (p_hotel_id, p_stay_id, v_stay.reservation_id, 'debit', 'consumption_charge', v_gross,
      v_stay.currency, 'Consumo em ' || v_point.name, v_order_id, 'consumption:' || v_order_id::text,
      p_actor_id, p_occurred_at) returning id into v_debit_id;
    if p_billing_mode = 'hotel_immediate' then
      insert into public.financial_transactions(hotel_id, type, category, amount, currency, description, status,
        stay_id, reservation_id, payment_method, paid_at, created_by, reference_code, consumption_order_id)
      values (p_hotel_id, 'INCOME', 'CONSUMPTION_PAYMENT', v_gross, v_stay.currency,
        'Pagamento imediato de consumo em ' || v_point.name, 'COMPLETED', p_stay_id, v_stay.reservation_id,
        p_payment_method::text, v_now, p_actor_id, nullif(btrim(p_payment_reference), ''), v_order_id)
      returning id into v_transaction_id;
      insert into public.stay_folio_entries(hotel_id, stay_id, reservation_id, direction, kind, amount, currency,
        description, financial_transaction_id, consumption_order_id, source_key, posted_by, posted_at)
      values (p_hotel_id, p_stay_id, v_stay.reservation_id, 'credit', 'payment', v_gross, v_stay.currency,
        'Pagamento imediato de consumo', v_transaction_id, v_order_id, 'consumption-payment:' || v_order_id::text,
        p_actor_id, v_now) returning id into v_credit_id;
      insert into public.stay_folio_allocations(hotel_id, stay_id, credit_entry_id, debit_entry_id, amount, created_by)
      values (p_hotel_id, p_stay_id, v_credit_id, v_debit_id, v_gross, p_actor_id);
      update public.stays set total_paid = coalesce(total_paid, 0) + v_gross where id = p_stay_id;
    end if;
  end if;
  v_action := case when p_disposition = 'courtesy' then 'courtesy_posted' else 'posted' end;
  insert into public.consumption_order_events(hotel_id, order_id, action, actor_id, details)
    values (p_hotel_id, v_order_id, v_action, p_actor_id,
      jsonb_build_object('billing_mode', p_billing_mode, 'gross_amount', v_gross, 'net_amount',
        case when p_disposition = 'courtesy' then 0 else v_gross end));
  return jsonb_build_object('result', 'ok', 'order_id', v_order_id, 'created', true);
exception when unique_violation then
  select id, request_fingerprint into v_existing from public.consumption_orders
    where hotel_id = p_hotel_id and idempotency_key = p_idempotency_key;
  if found and v_existing.request_fingerprint = v_fingerprint then
    return jsonb_build_object('result', 'ok', 'order_id', v_existing.id, 'created', false);
  end if;
  return jsonb_build_object('result', 'idempotency_conflict');
end;
$$;

create or replace function public.create_consumption_service_order(
  p_hotel_id uuid, p_actor_id uuid, p_stay_id uuid, p_point_id uuid,
  p_guest_customer_id uuid, p_mode public.consumption_service_mode,
  p_expected_at timestamptz, p_notes text, p_items jsonb, p_idempotency_key uuid
) returns jsonb language plpgsql set search_path=public as $$
declare
  v_stay record; v_existing record; v_item jsonb; v_snapshot jsonb; v_order_id uuid:=gen_random_uuid();
  v_item_id uuid; v_position public.inventory_positions%rowtype; v_reserved numeric; v_gross numeric(12,2):=0;
  v_fingerprint text; v_mode public.consumption_billing_mode; v_method public.consumption_payment_method;
begin
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>100
    then return jsonb_build_object('result','invalid_items'); end if;
  v_fingerprint:=md5(jsonb_build_object('stay',p_stay_id,'point',p_point_id,'guest',p_guest_customer_id,
    'mode',p_mode,'expected',p_expected_at,'notes',nullif(btrim(p_notes),''),'items',p_items)::text);
  select id,request_fingerprint into v_existing from public.consumption_service_orders
    where hotel_id=p_hotel_id and idempotency_key=p_idempotency_key for update;
  if found then return case when v_existing.request_fingerprint=v_fingerprint
    then jsonb_build_object('result','ok','order_id',v_existing.id,'created',false)
    else jsonb_build_object('result','idempotency_conflict') end; end if;
  if not public.maintenance_user_has_hotel_scope(p_actor_id,p_hotel_id)
    then return jsonb_build_object('result','actor_outside_hotel'); end if;
  select stay.*,reservation.hotel_id,reservation.id reservation_id into v_stay from public.stays stay
    join public.reservations reservation on reservation.id=stay.reservation_id
    where stay.id=p_stay_id and reservation.hotel_id=p_hotel_id for update of stay;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if v_stay.stay_status<>'checked_in' then return jsonb_build_object('result','stay_not_checked_in'); end if;
  if not exists(select 1 from public.consumption_points where id=p_point_id and hotel_id=p_hotel_id and is_active and archived_at is null)
    then return jsonb_build_object('result','point_unavailable'); end if;
  if p_guest_customer_id is not null and not exists(select 1 from public.stay_customers where stay_id=p_stay_id and customer_id=p_guest_customer_id)
    then return jsonb_build_object('result','guest_outside_stay'); end if;

  insert into public.consumption_service_orders(id,hotel_id,stay_id,reservation_id,point_id,guest_customer_id,mode,
    expected_at,notes,idempotency_key,request_fingerprint,created_by)
  values(v_order_id,p_hotel_id,p_stay_id,v_stay.reservation_id,p_point_id,p_guest_customer_id,p_mode,
    p_expected_at,nullif(btrim(p_notes),''),p_idempotency_key,v_fingerprint,p_actor_id);

  for v_item in select value from jsonb_array_elements(p_items) order by value->>'offer_id' loop
    if (v_item->>'quantity')::numeric<=0 then raise exception 'invalid_quantity' using errcode='P0001'; end if;
    v_snapshot:=public.resolve_consumption_offer_snapshot(p_hotel_id,(v_item->>'offer_id')::uuid,public.hotel_operational_now(p_hotel_id));
    if not coalesce((v_snapshot->>'found')::boolean,false) or (v_snapshot->>'point_id')::uuid<>p_point_id
      then raise exception 'offer_not_found' using errcode='P0001'; end if;
    if not coalesce((v_snapshot->>'available')::boolean,false)
      then raise exception 'offer_unavailable' using errcode='P0001'; end if;
    if v_item->>'version_token' is not null and v_item->>'version_token' is distinct from v_snapshot->>'version_token'
      then raise exception 'version_conflict' using errcode='P0001'; end if;
    v_mode:=coalesce(nullif(v_item->>'billing_mode','')::public.consumption_billing_mode,
      nullif(v_snapshot->'billing_policy'->>'default_mode','')::public.consumption_billing_mode);
    if v_mode is null or not exists(select 1 from jsonb_array_elements_text(v_snapshot->'allowed_modes') m where m=v_mode::text)
      then raise exception 'billing_mode_not_allowed' using errcode='P0001'; end if;
    v_method:=nullif(v_item->>'payment_method','')::public.consumption_payment_method;
    if (v_mode='hotel_immediate')<>(v_method is not null)
      then raise exception 'payment_method_required' using errcode='P0001'; end if;
    v_gross:=v_gross+round((v_item->>'quantity')::numeric*(v_snapshot->>'unit_price')::numeric,2);
    select position.* into v_position from public.inventory_positions position
      where position.hotel_id=p_hotel_id and position.product_id=(v_snapshot->>'product_id')::uuid
        and position.location_id=nullif(v_snapshot->>'inventory_location_id','')::uuid for update;
    if coalesce((v_snapshot->>'inventory_controlled')::boolean,false) then
      if not found then raise exception 'inventory_position_not_found' using errcode='P0001'; end if;
      select coalesce(sum(quantity),0) into v_reserved from public.consumption_service_stock_reservations
        where inventory_position_id=v_position.id and status='reserved';
      if (select negative_stock_policy from public.inventory_settings where hotel_id=p_hotel_id)='block'
        and v_position.quantity-v_reserved<(v_item->>'quantity')::numeric
        then raise exception 'insufficient_inventory' using errcode='P0001'; end if;
    end if;
    insert into public.consumption_service_order_items(hotel_id,service_order_id,offer_id,product_id,category_id,
      commercial_partner_id,commercial_agreement_id,quantity,unit_price,product_name_snapshot,category_name_snapshot,
      billing_mode,payment_method,payment_reference,billing_policy_snapshot,commercial_terms_snapshot,version_token,inventory_position_id)
    values(p_hotel_id,v_order_id,(v_item->>'offer_id')::uuid,(v_snapshot->>'product_id')::uuid,
      (v_snapshot->>'category_id')::uuid,nullif(v_snapshot->>'partner_id','')::uuid,nullif(v_snapshot->>'agreement_id','')::uuid,
      (v_item->>'quantity')::numeric,(v_snapshot->>'unit_price')::numeric,v_snapshot->>'product_name',v_snapshot->>'category_name',
      v_mode,v_method,nullif(btrim(v_item->>'payment_reference'),''),v_snapshot->'billing_policy',v_snapshot->'revision',
      v_snapshot->>'version_token',case when coalesce((v_snapshot->>'inventory_controlled')::boolean,false) then v_position.id else null end)
    returning id into v_item_id;
    if coalesce((v_snapshot->>'inventory_controlled')::boolean,false) then
      insert into public.consumption_service_stock_reservations(hotel_id,service_order_id,service_order_item_id,inventory_position_id,quantity)
      values(p_hotel_id,v_order_id,v_item_id,v_position.id,(v_item->>'quantity')::numeric);
    end if;
  end loop;
  update public.consumption_service_orders set gross_amount=v_gross where id=v_order_id;
  insert into public.consumption_service_order_events(hotel_id,service_order_id,action,actor_id,details)
    values(p_hotel_id,v_order_id,'received',p_actor_id,jsonb_build_object('gross_amount',v_gross,'items',jsonb_array_length(p_items)));
  return jsonb_build_object('result','ok','order_id',v_order_id,'created',true);
exception when sqlstate 'P0001' then return jsonb_build_object('result',sqlerrm);
end; $$;

create or replace function public.act_consumption_service_order(
  p_hotel_id uuid,p_order_id uuid,p_actor_id uuid,p_action text,p_expected_version integer,
  p_assignee_id uuid,p_reason text,p_next_action text,p_idempotency_key uuid
) returns jsonb language plpgsql set search_path=public as $$
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
    update public.consumption_service_orders set status='canceled',canceled_at=now(),version=version+1,updated_at=now() where id=p_order_id;
    update public.consumption_service_stock_reservations set status='released',released_at=now()
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
      update public.consumption_service_stock_reservations set status='consumed',released_at=now()
        where service_order_id=p_order_id and status='reserved';
      update public.consumption_service_orders set status='delivered',delivered_at=now(),delivery_idempotency_key=p_idempotency_key,
        delivery_fingerprint=v_delivery_fingerprint,version=version+1,updated_at=now() where id=p_order_id;
    exception when sqlstate 'P0001' then
      return jsonb_build_object('result',sqlerrm,'context',jsonb_build_object('status','ready'));
    end;
  else return jsonb_build_object('result','invalid_action'); end if;
  insert into public.consumption_service_order_events(hotel_id,service_order_id,action,actor_id,details)
    values(p_hotel_id,p_order_id,p_action,p_actor_id,jsonb_strip_nulls(jsonb_build_object('reason',nullif(btrim(p_reason),''),'next_action',nullif(btrim(p_next_action),''),'assignee_id',p_assignee_id)));
  return jsonb_build_object('result','ok','order_ids',to_jsonb(v_order_ids),'created',true);
end; $$;
