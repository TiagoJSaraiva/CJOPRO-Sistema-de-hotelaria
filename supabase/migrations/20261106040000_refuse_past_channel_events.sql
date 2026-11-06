-- Evento de canal não cria reserva no passado: fica em revisão, com o motivo. Uma alteração de
-- estadia em curso continua possível, porque a saída ainda é futura.
CREATE OR REPLACE FUNCTION public.act_booking_channel_event(p_hotel_id uuid, p_id uuid, p_actor_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
 e public.booking_channel_events;
 m public.booking_channel_mappings;
 v_payload jsonb;
 v_reservation uuid;
 v_accommodation uuid;
 v_rate_version uuid;
 v_available integer;
 v_checkin date;
 v_checkout date;
 v_total numeric;
 v_nights integer;
 v_daily numeric;
 d date;
begin
 select * into e from public.booking_channel_events where id=p_id and hotel_id=p_hotel_id for update;
 if not found then return jsonb_build_object('result','not_found'); end if;
 if e.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict','context',to_jsonb(e)); end if;
 if length(trim(p_input->>'reason'))<3 then return jsonb_build_object('result','invalid'); end if;
 if p_input->>'action'='reject' then
  update public.booking_channel_events set status='rejected',reason=trim(p_input->>'reason'),version=version+1,updated_at=now() where id=p_id;
  return jsonb_build_object('result','ok','id',p_id);
 end if;
 if p_input->>'action' not in('apply','resolve') then return jsonb_build_object('result','invalid'); end if;
 v_payload:=e.normalized_payload->'reservation';
 select * into m from public.booking_channel_mappings where channel_id=e.channel_id and external_room_code=v_payload->>'room_code' and external_rate_code=v_payload->>'rate_code';
 if not found then
  update public.booking_channel_events set status='needs_review',reason='mapping_missing',version=version+1,updated_at=now() where id=p_id;
  return jsonb_build_object('result','mapping_missing');
 end if;
 select v.id into v_rate_version from public.rate_plan_versions v join public.rate_plans p on p.id=v.rate_plan_id and p.active_version_id=v.id where v.rate_plan_id=m.rate_plan_id order by v.version_number desc limit 1;
 v_checkin:=(v_payload->>'checkin_date')::date;v_checkout:=(v_payload->>'checkout_date')::date;v_total:=(v_payload->>'total')::numeric;v_nights:=v_checkout-v_checkin;
 if v_checkout<=v_checkin or v_rate_version is null then return jsonb_build_object('result','invalid'); end if;
 if (e.event_type='create' and v_checkin<public.hotel_operational_date(p_hotel_id))
   or (e.event_type='amend' and v_checkout<=public.hotel_operational_date(p_hotel_id)) then
  update public.booking_channel_events set status='needs_review',reason='past_dates',version=version+1,updated_at=now() where id=p_id;
  return jsonb_build_object('result','past_dates');
 end if;
 select reservation_id into v_reservation from public.booking_channel_events where channel_id=e.channel_id and external_reservation_id=e.external_reservation_id and reservation_id is not null order by created_at limit 1;
 if e.event_type='cancel' then
  if v_reservation is null then return jsonb_build_object('result','not_found'); end if;
  update public.reservations set lifecycle_status='canceled',version=version+1,updated_at=now() where id=v_reservation and hotel_id=p_hotel_id;
  update public.reservation_accommodations set status='canceled',version=version+1,updated_at=now() where reservation_id=v_reservation and status not in('checked_in','checked_out');
  update public.booking_channel_events set status='applied',reservation_id=v_reservation,reason=trim(p_input->>'reason'),version=version+1,updated_at=now() where id=p_id;
  return jsonb_build_object('result','ok','id',p_id,'reservation_id',v_reservation);
 end if;
 perform pg_advisory_xact_lock(hashtext(p_hotel_id::text||m.room_type||v_checkin::text||v_checkout::text));
 select min(public.room_type_sellable_units(p_hotel_id,m.room_type,n::date)-(select count(*) from public.reservation_accommodations a where a.hotel_id=p_hotel_id and a.room_type=m.room_type and a.checkin_date<=n::date and a.checkout_date>n::date and a.status in('confirmed','assigned','checked_in') and (v_reservation is null or a.reservation_id<>v_reservation)))::integer into v_available from generate_series(v_checkin,v_checkout-1,interval '1 day') n;
 if v_available<=0 then
  update public.booking_channel_events set status='needs_review',reason='inventory_conflict',version=version+1,updated_at=now() where id=p_id;
  return jsonb_build_object('result','inventory_conflict','context',jsonb_build_object('room_type',m.room_type,'available',greatest(v_available,0)));
 end if;
 if e.event_type='create' then
  if v_reservation is not null then return jsonb_build_object('result','conflict'); end if;
  insert into public.reservations(hotel_id,booking_customer_id,reservation_code,guest_count,reservation_source,estimated_total_price,final_total_price,notes,lifecycle_status)
  values(p_hotel_id,null,'CH-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),(v_payload->>'adults')::integer+(v_payload->>'children')::integer,'agency',v_total,v_total,'Importada pelo hub neutro: '||e.channel_id::text,'confirmed') returning id into v_reservation;
  insert into public.reservation_contacts(reservation_id,hotel_id,full_name,email,phone,consent_version)
  values(v_reservation,p_hotel_id,trim(v_payload->>'guest_name'),nullif(v_payload->>'guest_email',''),nullif(v_payload->>'guest_phone',''),'channel');
  insert into public.reservation_accommodations(hotel_id,reservation_id,room_type,checkin_date,checkout_date,adults,children,status,rate_plan_version_id,total_price)
  values(p_hotel_id,v_reservation,m.room_type,v_checkin,v_checkout,(v_payload->>'adults')::integer,(v_payload->>'children')::integer,'confirmed',v_rate_version,v_total) returning id into v_accommodation;
 else
  if v_reservation is null then return jsonb_build_object('result','not_found'); end if;
  select id into v_accommodation from public.reservation_accommodations where reservation_id=v_reservation and status not in('canceled','no_show') order by created_at limit 1 for update;
  update public.reservation_accommodations set room_type=m.room_type,checkin_date=v_checkin,checkout_date=v_checkout,adults=(v_payload->>'adults')::integer,children=(v_payload->>'children')::integer,rate_plan_version_id=v_rate_version,total_price=v_total,version=version+1,updated_at=now() where id=v_accommodation;
  delete from public.reservation_nightly_prices where accommodation_id=v_accommodation;
  update public.reservations set guest_count=(v_payload->>'adults')::integer+(v_payload->>'children')::integer,estimated_total_price=v_total,final_total_price=v_total,version=version+1,updated_at=now() where id=v_reservation;
 end if;
 v_daily:=round(v_total/v_nights,2);
 for d in select generate_series(v_checkin,v_checkout-1,interval '1 day')::date loop
  insert into public.reservation_nightly_prices(hotel_id,accommodation_id,stay_date,rate_plan_version_id,base_amount,final_amount,source)
  values(p_hotel_id,v_accommodation,d,v_rate_version,v_daily,case when d=v_checkout-1 then v_total-v_daily*(v_nights-1) else v_daily end,'channel');
 end loop;
 update public.booking_channel_events set status='applied',reservation_id=v_reservation,reason=trim(p_input->>'reason'),version=version+1,updated_at=now() where id=p_id;
 return jsonb_build_object('result','ok','id',p_id,'reservation_id',v_reservation);
end$function$;
