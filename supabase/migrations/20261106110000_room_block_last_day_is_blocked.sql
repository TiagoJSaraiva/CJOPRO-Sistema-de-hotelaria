-- QA-021: room_blocks.end_date é inclusivo, como já tratam a cotação e a realocação, mas a alocação de
-- quarto e os indicadores o liam como exclusivo. Quem chegava no último dia do bloqueio podia receber o
-- quarto bloqueado, e esse dia saía dos indicadores. A oferta também deixa de descontar duas vezes o
-- quarto que está em manutenção e bloqueado no mesmo dia.
CREATE OR REPLACE FUNCTION public.assign_reservation_room(p_hotel_id uuid, p_reservation_id uuid, p_actor_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$declare a public.reservation_accommodations;r public.rooms;v_stay uuid;begin
 select * into a from public.reservation_accommodations where id=(p_input->>'accommodation_id')::uuid and reservation_id=p_reservation_id and hotel_id=p_hotel_id for update;if not found then return jsonb_build_object('result','not_found');end if;if a.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict','context',to_jsonb(a));end if;select * into r from public.rooms where id=(p_input->>'room_id')::uuid and hotel_id=p_hotel_id;if not found or r.room_type<>a.room_type then return jsonb_build_object('result','invalid_room');end if;
 if exists(select 1 from public.stays x where x.room_id=r.id and x.stay_status in ('confirmed','checked_in') and x.checkin_date_expected::date<a.checkout_date and x.checkout_date_expected::date>a.checkin_date and x.id is distinct from a.stay_id) or exists(select 1 from public.room_blocks b where b.room_id=r.id and b.released_at is null and b.start_date<a.checkout_date and b.end_date>=a.checkin_date) then return jsonb_build_object('result','conflict');end if;
 if a.stay_id is null then insert into public.stays(reservation_id,room_id,applied_daily_rate,total_price_estimated,checkin_date_expected,checkout_date_expected,stay_status) values(p_reservation_id,r.id,round(a.total_price/greatest(1,a.checkout_date-a.checkin_date),2),a.total_price,a.checkin_date+time '12:00',a.checkout_date+time '12:00','confirmed') returning id into v_stay;else v_stay=a.stay_id;update public.stays set room_id=r.id where id=v_stay;end if;
 insert into public.reservation_assignment_events(hotel_id,accommodation_id,from_room_id,to_room_id,reason,actor_id) values(p_hotel_id,a.id,a.assigned_room_id,r.id,trim(p_input->>'reason'),p_actor_id);update public.reservation_accommodations set stay_id=v_stay,assigned_room_id=r.id,status=case when status='checked_in' then status else 'assigned' end,version=version+1,updated_at=now() where id=a.id;update public.reservations set version=version+1,updated_at=now() where id=p_reservation_id;return jsonb_build_object('result','ok','id',v_stay);end$function$;

CREATE OR REPLACE FUNCTION public.simulate_room_assignment(p_hotel_id uuid, p_reservation_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
 select jsonb_build_object('result',case when count(*)>0 then 'ok' else 'conflict' end,'candidates',coalesce(jsonb_agg(jsonb_build_object('room_id',r.id,'room_number',r.room_number,'room_type',r.room_type,'readiness',coalesce(s.state->>'readiness','ready')) order by case coalesce(s.state->>'readiness','ready') when 'ready' then 0 else 1 end,r.room_number) filter(where r.id is not null),'[]')) from public.reservation_accommodations a join public.rooms r on r.hotel_id=a.hotel_id and r.room_type=a.room_type left join lateral(select public.governance_room_state(p_hotel_id,r.id) state)s on true where a.id=(p_input->>'accommodation_id')::uuid and a.reservation_id=p_reservation_id and a.hotel_id=p_hotel_id and not exists(select 1 from public.stays x where x.room_id=r.id and x.stay_status in ('confirmed','checked_in') and x.checkin_date_expected::date<a.checkout_date and x.checkout_date_expected::date>a.checkin_date and x.id is distinct from a.stay_id) and not exists(select 1 from public.room_blocks b where b.room_id=r.id and b.released_at is null and b.start_date<a.checkout_date and b.end_date>=a.checkin_date) $function$;

CREATE OR REPLACE FUNCTION public.drilldown_integrated_analytics(p_hotel_id uuid, p_date date, p_metric text, p_permissions text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare v_tz text;
begin
 select timezone into v_tz from public.hotels where id=p_hotel_id;
 if p_metric in('lodging_revenue','consumption_revenue','adr','revpar','inventory_loss_cost') and not(p_permissions&&array['read_financial_transactions','read_consumption_analytics']) then return jsonb_build_object('result','forbidden');end if;
 if p_metric in('confirmed_room_nights','held_room_nights','arrivals','departures','unassigned_arrivals','cancellations','no_shows','direct_holds','direct_confirmations') then
  return jsonb_build_object('result','ok','items',(select coalesce(jsonb_agg(jsonb_build_object('reservation_id',a.reservation_id,'accommodation_id',a.id,'room_type',a.room_type,'checkin_date',a.checkin_date,'checkout_date',a.checkout_date,'status',a.status)),'[]') from public.reservation_accommodations a join public.reservations r on r.id=a.reservation_id where a.hotel_id=p_hotel_id and case p_metric when 'confirmed_room_nights' then a.checkin_date<=p_date and a.checkout_date>p_date and a.status in('confirmed','assigned','checked_in') when 'held_room_nights' then a.checkin_date<=p_date and a.checkout_date>p_date and a.status='held' when 'arrivals' then a.checkin_date=p_date when 'departures' then a.checkout_date=p_date when 'unassigned_arrivals' then a.checkin_date=p_date and a.status='confirmed' and a.assigned_room_id is null when 'cancellations' then a.status='canceled' and (a.updated_at at time zone v_tz)::date=p_date when 'no_shows' then a.status='no_show' and (a.updated_at at time zone v_tz)::date=p_date when 'direct_holds' then r.reservation_source='website' and (r.created_at at time zone v_tz)::date=p_date when 'direct_confirmations' then r.reservation_source='website' and exists(select 1 from public.reservation_events e where e.reservation_id=r.id and e.action='guarantee_confirmed' and (e.created_at at time zone v_tz)::date=p_date) else false end));
 end if;
 if p_metric in('unavailable_rooms','sellable_rooms') then return jsonb_build_object('result','ok','items',(select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'room_id',b.room_id,'start_date',b.start_date,'end_date',b.end_date)),'[]') from public.room_blocks b where b.hotel_id=p_hotel_id and b.released_at is null and b.start_date<=p_date and b.end_date>=p_date));end if;
 if p_metric in('consumption_revenue') then return jsonb_build_object('result','ok','items',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'occurred_at',occurred_at,'amount',net_amount)),'[]') from public.consumption_orders where hotel_id=p_hotel_id and (occurred_at at time zone v_tz)::date=p_date and disposition='charged'));end if;
 if p_metric in('inventory_loss_quantity','inventory_loss_cost') then return jsonb_build_object('result','ok','items',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'product_id',product_id,'quantity',quantity_delta,'cost',total_cost,'occurred_at',occurred_at)),'[]') from public.inventory_movements where hotel_id=p_hotel_id and (occurred_at at time zone v_tz)::date=p_date and kind in('loss','count_loss')));end if;
 if p_metric in('maintenance_occurrences','maintenance_impact_room_hours','maintenance_recurrences') then return jsonb_build_object('result','ok','items',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'number',o.occurrence_number,'status',o.status,'discovered_at',o.discovered_at)),'[]') from public.maintenance_occurrences o where o.hotel_id=p_hotel_id and ((o.discovered_at at time zone v_tz)::date=p_date or exists(select 1 from public.maintenance_occurrence_affected_rooms ar where ar.occurrence_id=o.id and ar.impact_started_at<(p_date+1)::timestamp at time zone v_tz and coalesce(ar.impact_ended_at,public.hotel_operational_now(p_hotel_id))>p_date::timestamp at time zone v_tz))));end if;
 return jsonb_build_object('result','ok','items','[]'::jsonb);
end$function$;

CREATE OR REPLACE FUNCTION public.reconcile_integrated_analytics(p_hotel_id uuid, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_now timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_from date;v_to date;d date;v_tz text;v_forecast jsonb;v_actual jsonb;v_closed boolean;v_fp text;
begin
 select timezone into v_tz from public.hotels where id=p_hotel_id;
 if v_tz is null then return jsonb_build_object('result','not_found');end if;
 v_from:=coalesce(p_from,(p_now at time zone v_tz)::date-30);v_to:=coalesce(p_to,(p_now at time zone v_tz)::date+90);
 if v_to<v_from or v_to-v_from>730 then return jsonb_build_object('result','invalid_range');end if;
 for d in select generate_series(v_from,v_to,interval '1 day')::date loop
  select jsonb_build_object(
   'sellable_rooms',(select count(*) from public.rooms room where room.hotel_id=p_hotel_id and room.status not in('maintenance','blocked') and not exists(select 1 from public.room_blocks block where block.room_id=room.id and block.released_at is null and block.start_date<=d and block.end_date>=d)),
   'confirmed_room_nights',(select count(*) from public.reservation_accommodations where hotel_id=p_hotel_id and checkin_date<=d and checkout_date>d and status in('confirmed','assigned','checked_in')),
   'held_room_nights',(select count(*) from public.reservation_accommodations where hotel_id=p_hotel_id and checkin_date<=d and checkout_date>d and status='held' and hold_expires_at>p_now),
   'unavailable_rooms',(select count(distinct room_id) from public.room_blocks where hotel_id=p_hotel_id and released_at is null and start_date<=d and end_date>=d),
   'arrivals',(select count(*) from public.reservation_accommodations where hotel_id=p_hotel_id and checkin_date=d and status in('confirmed','assigned')),
   'departures',(select count(*) from public.reservation_accommodations where hotel_id=p_hotel_id and checkout_date=d and status in('confirmed','assigned','checked_in')),
   'unassigned_arrivals',(select count(*) from public.reservation_accommodations where hotel_id=p_hotel_id and checkin_date=d and status='confirmed' and assigned_room_id is null),
   'lodging_revenue',(select coalesce(sum(final_amount),0) from public.reservation_nightly_prices n join public.reservation_accommodations a on a.id=n.accommodation_id where n.hotel_id=p_hotel_id and n.stay_date=d and a.status in('confirmed','assigned','checked_in','checked_out'))
  ) into v_forecast;
  v_forecast:=v_forecast||jsonb_build_object(
   'adr',case when (v_forecast->>'confirmed_room_nights')::numeric>0 then round((v_forecast->>'lodging_revenue')::numeric/(v_forecast->>'confirmed_room_nights')::numeric,2) else 0 end,
   'revpar',case when (v_forecast->>'sellable_rooms')::numeric>0 then round((v_forecast->>'lodging_revenue')::numeric/(v_forecast->>'sellable_rooms')::numeric,2) else 0 end
  );
  select jsonb_build_object(
   'occupied_room_nights',(select count(*) from public.stays s join public.reservations r on r.id=s.reservation_id where r.hotel_id=p_hotel_id and s.checkin_date_expected::date<=d and s.checkout_date_expected::date>d and s.stay_status in('checked_in','checked_out')),
   'lodging_revenue',(select coalesce(sum(case when direction='debit' then amount else -amount end),0) from public.stay_folio_entries where hotel_id=p_hotel_id and kind='lodging' and (posted_at at time zone v_tz)::date=d),
   'consumption_revenue',(select coalesce(sum(net_amount),0) from public.consumption_orders where hotel_id=p_hotel_id and (occurred_at at time zone v_tz)::date=d and disposition='charged'),
   'inventory_loss_quantity',(select coalesce(sum(abs(quantity_delta)),0) from public.inventory_movements where hotel_id=p_hotel_id and (occurred_at at time zone v_tz)::date=d and kind in('loss','count_loss')),
   'maintenance_occurrences',(select count(*) from public.maintenance_occurrences where hotel_id=p_hotel_id and (discovered_at at time zone v_tz)::date=d),
   'cancellations',(select count(*) from public.reservation_accommodations where hotel_id=p_hotel_id and status='canceled' and (updated_at at time zone v_tz)::date=d),
   'no_shows',(select count(*) from public.reservation_accommodations where hotel_id=p_hotel_id and status='no_show' and (updated_at at time zone v_tz)::date=d)
  ) into v_actual;
  v_actual:=v_actual||jsonb_build_object(
   'adr',case when (v_actual->>'occupied_room_nights')::numeric>0 then round((v_actual->>'lodging_revenue')::numeric/(v_actual->>'occupied_room_nights')::numeric,2) else 0 end,
   'revpar',case when (v_forecast->>'sellable_rooms')::numeric>0 then round((v_actual->>'lodging_revenue')::numeric/(v_forecast->>'sellable_rooms')::numeric,2) else 0 end,
   'inventory_loss_cost',(select coalesce(sum(total_cost),0) from public.inventory_movements where hotel_id=p_hotel_id and (occurred_at at time zone v_tz)::date=d and kind in('loss','count_loss')),
   'maintenance_impact_room_hours',(select coalesce(round(sum(extract(epoch from (least(coalesce(ar.impact_ended_at,p_now),(d+1)::timestamp at time zone v_tz)-greatest(ar.impact_started_at,d::timestamp at time zone v_tz)))/3600)::numeric,2),0) from public.maintenance_occurrence_affected_rooms ar where ar.hotel_id=p_hotel_id and ar.impact_started_at<(d+1)::timestamp at time zone v_tz and coalesce(ar.impact_ended_at,p_now)>d::timestamp at time zone v_tz),
   'maintenance_recurrences',(select count(*) from public.maintenance_recurrence_groups where hotel_id=p_hotel_id and (last_occurrence_at at time zone v_tz)::date=d and status='active'),
   'direct_holds',(select count(*) from public.reservations where hotel_id=p_hotel_id and reservation_source='website' and (created_at at time zone v_tz)::date=d),
   'direct_confirmations',(select count(*) from public.reservations r where r.hotel_id=p_hotel_id and r.reservation_source='website' and exists(select 1 from public.reservation_events e where e.reservation_id=r.id and e.action='guarantee_confirmed' and (e.created_at at time zone v_tz)::date=d)),
   'average_hold_confirmation_hours',(select coalesce(round(avg(extract(epoch from(e.created_at-r.created_at))/3600)::numeric,2),0) from public.reservations r join lateral(select min(created_at) created_at from public.reservation_events where reservation_id=r.id and action='guarantee_confirmed')e on e.created_at is not null where r.hotel_id=p_hotel_id and r.reservation_source='website' and (e.created_at at time zone v_tz)::date=d)
  );
  select exists(select 1 from public.daily_closes where hotel_id=p_hotel_id and business_date=d and status='closed') into v_closed;
  v_fp:=md5(v_forecast::text||v_actual::text);
  insert into public.integrated_operation_facts(hotel_id,business_date,forecast,actual,source_fingerprint,closed_snapshot,reconciled_at) values(p_hotel_id,d,v_forecast,v_actual,v_fp,v_closed,p_now)
  on conflict(hotel_id,business_date) do update set forecast=excluded.forecast,actual=case when public.integrated_operation_facts.closed_snapshot then public.integrated_operation_facts.actual else excluded.actual end,source_fingerprint=case when public.integrated_operation_facts.closed_snapshot then public.integrated_operation_facts.source_fingerprint else excluded.source_fingerprint end,closed_snapshot=public.integrated_operation_facts.closed_snapshot or excluded.closed_snapshot,reconciled_at=excluded.reconciled_at,stale_since=null;
 end loop;
 return jsonb_build_object('result','ok','from',v_from,'to',v_to);
exception when others then
 update public.integrated_operation_facts set stale_since=coalesce(stale_since,p_now) where hotel_id=p_hotel_id and business_date between v_from and v_to;
 return jsonb_build_object('result','sync_failed');
end$function$;
