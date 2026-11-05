-- QA-009: bloqueios por período (room_blocks) passam a reduzir o estoque vendido
-- pelo site direto e pelos canais. rooms.status continua representando apenas o
-- quarto fora de operação por tempo indeterminado.
--
-- QA-010: o alias i colidia com a variável i de create_public_booking_hold e fazia
-- toda pré-reserva do site direto falhar com "column reference i.id is ambiguous".
-- A chave do lock também concatenava o operador ->> sem parênteses.

create function public.room_type_sellable_units(p_hotel_id uuid, p_room_type text, p_date date)
returns integer
language sql
stable
set search_path = public
as $$
  select count(*)::integer
  from public.rooms r
  where r.hotel_id = p_hotel_id
    and r.room_type = p_room_type
    and r.status not in ('maintenance', 'blocked')
    and not exists (
      select 1
      from public.room_blocks b
      where b.hotel_id = r.hotel_id
        and b.room_id = r.id
        and b.released_at is null
        and b.start_date <= p_date
        -- O fim do bloqueio é inclusivo; vencido sem liberação continua valendo.
        and (b.end_date >= p_date or b.end_date < public.hotel_operational_date(p_hotel_id))
    )
$$;

revoke all on function public.room_type_sellable_units(uuid, text, date) from public, anon, authenticated;
grant execute on function public.room_type_sellable_units(uuid, text, date) to service_role;

CREATE OR REPLACE FUNCTION public.quote_public_booking(p_slug text, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
   select min(public.room_type_sellable_units(v_hotel,v_type.room_type,d::date)-(select count(*) from public.reservation_accommodations a where a.hotel_id=v_hotel and a.room_type=v_type.room_type and a.checkin_date<d::date+1 and a.checkout_date>d::date and (a.status in('confirmed','assigned','checked_in') or a.status='held' and a.hold_expires_at>v_now)))::integer into v_available from generate_series(v_checkin,v_checkout-1,interval '1 day') d;
   if coalesce(v_available,0)<=0 then continue;end if;
   for v_rate in select v.*,p.name plan_name,p.kind from public.rate_plan_versions v join public.rate_plans p on p.id=v.rate_plan_id join public.rate_plan_version_room_types t on t.version_id=v.id and t.room_type=v_type.room_type where p.hotel_id=v_hotel and p.status='active' and p.active_version_id=v.id and 'direct'=any(v.channels) order by p.name loop
    select coalesce(jsonb_agg(jsonb_build_object('date',d::date,'base',v_type.base,'seasonal',coalesce(s.extra,0),'plan_adjustment',case when v_rate.adjustment_type='percentage' then round((v_type.base+coalesce(s.extra,0))*v_rate.adjustment_value/100,2) else v_rate.adjustment_value end,'occupancy_supplement',greatest(0,(v_room->>'adults')::integer-v_rate.included_adults)*v_rate.extra_adult_amount+greatest(0,(v_room->>'children')::integer-v_rate.included_children)*v_rate.extra_child_amount,'final',round(case when v_rate.adjustment_type='percentage' then (v_type.base+coalesce(s.extra,0))*(1+v_rate.adjustment_value/100) else v_type.base+coalesce(s.extra,0)+v_rate.adjustment_value end+greatest(0,(v_room->>'adults')::integer-v_rate.included_adults)*v_rate.extra_adult_amount+greatest(0,(v_room->>'children')::integer-v_rate.included_children)*v_rate.extra_child_amount,2)) order by d),'[]'),coalesce(sum(round(case when v_rate.adjustment_type='percentage' then (v_type.base+coalesce(s.extra,0))*(1+v_rate.adjustment_value/100) else v_type.base+coalesce(s.extra,0)+v_rate.adjustment_value end+greatest(0,(v_room->>'adults')::integer-v_rate.included_adults)*v_rate.extra_adult_amount+greatest(0,(v_room->>'children')::integer-v_rate.included_children)*v_rate.extra_child_amount,2)),0) into v_nightly,v_total from generate_series(v_checkin,v_checkout-1,interval '1 day') d left join lateral(select coalesce(sr.daily_rate,0)::numeric extra from public.seasons se join public.season_room_rates sr on sr.season_id=se.id and sr.room_type=v_type.room_type where se.hotel_id=v_hotel and se.is_active and d::date between se.start_date and se.end_date order by se.start_date desc limit 1)s on true;
    v_item=gen_random_uuid();insert into public.booking_quote_items(id,hotel_id,quote_id,room_index,room_type,rate_plan_version_id,adults,children,available_count,total,nightly) values(v_item,v_hotel,v_id,v_index,v_type.room_type,v_rate.id,(v_room->>'adults')::integer,(v_room->>'children')::integer,v_available,v_total,v_nightly);
   end loop;
  end loop;
 end loop;
 return jsonb_build_object('result','ok','quote_id',v_id,'fingerprint',v_fp,'expires_at',v_now+interval '15 minutes','currency',v_currency,'items',(select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('plan_name',p.name,'plan_kind',p.kind,'guarantee',jsonb_build_object('type',v.guarantee_type,'value',v.guarantee_value),'cancellation',jsonb_build_object('type',v.cancellation_type,'value',v.cancellation_value,'cutoff_hours',v.cancellation_cutoff_hours),'benefit_plan_version_id',v.benefit_plan_version_id) order by i.room_index,i.total),'[]') from public.booking_quote_items i join public.rate_plan_versions v on v.id=i.rate_plan_version_id join public.rate_plans p on p.id=v.rate_plan_id where i.quote_id=v_id));
exception when invalid_text_representation then return jsonb_build_object('result','invalid');end $function$;

CREATE OR REPLACE FUNCTION public.create_public_booking_hold(p_slug text, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare q public.booking_quotes;v_hotel uuid;v_existing public.booking_hold_requests;v_fp text:=encode(digest(convert_to(p_input::text,'UTF8'),'sha256'),'hex');v_res uuid;v_code text;v_selection jsonb;i public.booking_quote_items;v_expiry timestamptz;v_access text;v_access_result jsonb;v_a uuid;n jsonb;v_now timestamptz;
begin
 select h.id into v_hotel from public.hotels h join public.booking_configurations c on c.hotel_id=h.id where h.slug=p_slug and h.is_active and c.published;if not found then return jsonb_build_object('result','not_found');end if;
 v_now:=public.hotel_operational_now(v_hotel);
 select * into v_existing from public.booking_hold_requests where hotel_id=v_hotel and idempotency_key=(p_input->>'idempotency_key')::uuid;if found then if v_existing.request_fingerprint=v_fp then return jsonb_build_object('result','ok','reservation_id',v_existing.reservation_id,'repeated',true);end if;return jsonb_build_object('result','idempotency_conflict');end if;
 select * into q from public.booking_quotes where id=(p_input->>'quote_id')::uuid and hotel_id=v_hotel for update;if not found or q.status<>'active' or q.expires_at<=v_now or q.fingerprint<>p_input->>'quote_fingerprint' then return jsonb_build_object('result','quote_expired');end if;
 if jsonb_array_length(p_input->'selections')<>jsonb_array_length(q.input->'rooms') or (select count(distinct item.room_index) from jsonb_array_elements(p_input->'selections') s join public.booking_quote_items item on item.id=(s->>'quote_item_id')::uuid and item.quote_id=q.id)<>jsonb_array_length(q.input->'rooms') then return jsonb_build_object('result','invalid_selection');end if;
 v_code='WEB-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));insert into public.reservations(hotel_id,booking_customer_id,reservation_code,guest_count,reservation_source,estimated_total_price,final_total_price,notes,lifecycle_status,hold_expires_at) values(v_hotel,null,v_code,1,'website',0,0,'Pré-reserva direta','hold',v_now+interval '24 hours') returning id,hold_expires_at into v_res,v_expiry;
 insert into public.reservation_contacts(reservation_id,hotel_id,full_name,email,phone,consent_version) values(v_res,v_hotel,trim(p_input->>'contact_name'),nullif(p_input->>'email',''),nullif(p_input->>'phone',''),p_input->>'consent_version');
 for v_selection in select * from jsonb_array_elements(p_input->'selections') loop select * into i from public.booking_quote_items where id=(v_selection->>'quote_item_id')::uuid and quote_id=q.id and room_type=v_selection->>'room_type' and rate_plan_version_id=(v_selection->>'rate_plan_version_id')::uuid;if not found then raise exception using errcode='P0001',message='invalid_selection';end if;perform pg_advisory_xact_lock(hashtext(v_hotel::text||i.room_type||(q.input->>'checkin_date')||(q.input->>'checkout_date')));
  if exists(select 1 from generate_series((q.input->>'checkin_date')::date,(q.input->>'checkout_date')::date-1,interval '1 day') night where public.room_type_sellable_units(v_hotel,i.room_type,night::date) <= (select count(*) from public.reservation_accommodations a where a.hotel_id=v_hotel and a.room_type=i.room_type and a.checkin_date<=night::date and a.checkout_date>night::date and (a.status in('confirmed','assigned','checked_in') or a.status='held' and a.hold_expires_at>v_now))) then raise exception using errcode='P0001',message='availability_conflict';end if;
  select least(v_now+make_interval(hours=>v.hold_hours),((q.input->>'checkin_date')::date+coalesce(h.checkin_time_limit,time '23:59')) at time zone h.timezone) into v_expiry from public.rate_plan_versions v join public.hotels h on h.id=v_hotel where v.id=i.rate_plan_version_id;
  insert into public.reservation_accommodations(hotel_id,reservation_id,room_type,checkin_date,checkout_date,adults,children,status,rate_plan_version_id,total_price,hold_expires_at) values(v_hotel,v_res,i.room_type,(q.input->>'checkin_date')::date,(q.input->>'checkout_date')::date,i.adults,i.children,'held',i.rate_plan_version_id,i.total,v_expiry) returning id into v_a;
  for n in select * from jsonb_array_elements(i.nightly) loop insert into public.reservation_nightly_prices(hotel_id,accommodation_id,stay_date,rate_plan_version_id,base_amount,seasonal_amount,plan_adjustment,occupancy_supplement,final_amount,source) values(v_hotel,v_a,(n->>'date')::date,i.rate_plan_version_id,(n->>'base')::numeric,(n->>'seasonal')::numeric,(n->>'plan_adjustment')::numeric,(n->>'occupancy_supplement')::numeric,(n->>'final')::numeric,'direct');end loop;
 end loop;
 update public.reservations set guest_count=(select sum(adults+children) from public.reservation_accommodations where reservation_id=v_res),estimated_total_price=(select sum(total_price) from public.reservation_accommodations where reservation_id=v_res),final_total_price=(select sum(total_price) from public.reservation_accommodations where reservation_id=v_res),hold_expires_at=(select min(hold_expires_at) from public.reservation_accommodations where reservation_id=v_res) where id=v_res;
 update public.booking_quotes set status='consumed' where id=q.id;
 insert into public.booking_hold_requests(hotel_id,idempotency_key,request_fingerprint,reservation_id) values(v_hotel,(p_input->>'idempotency_key')::uuid,v_fp,v_res);
 v_access_result=public.create_prearrival_link(v_hotel,v_res,null,2160);
 return jsonb_build_object('result','ok','reservation_id',v_res,'reservation_code',v_code,'expires_at',(select hold_expires_at from public.reservations where id=v_res),'access_token',v_access_result->>'token');
exception when raise_exception then return jsonb_build_object('result',sqlerrm);end $function$;

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

CREATE OR REPLACE FUNCTION public.get_booking_channel_inventory(p_channel_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$select jsonb_build_object('feed_version',extract(epoch from date_trunc('minute',now()))::bigint::text,'hotel_id',c.hotel_id,'rooms',(select coalesce(jsonb_agg(jsonb_build_object('room_type',r.room_type,'available',r.capacity)),'[]') from(select distinct room_type,public.room_type_sellable_units(c.hotel_id,room_type,public.hotel_operational_date(c.hotel_id)) capacity from public.rooms where hotel_id=c.hotel_id and status not in('maintenance','blocked'))r),'rates',(select coalesce(jsonb_agg(jsonb_build_object('external_room_code',m.external_room_code,'external_rate_code',m.external_rate_code,'room_type',m.room_type,'rate_plan_id',m.rate_plan_id)),'[]') from public.booking_channel_mappings m where m.channel_id=c.id)) from public.booking_channels c where c.id=p_channel_id and c.active$function$;
