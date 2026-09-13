create table public.integrated_operation_facts (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  business_date date not null,
  forecast jsonb not null default '{}'::jsonb,
  actual jsonb not null default '{}'::jsonb,
  source_fingerprint text not null,
  reconciled_at timestamptz not null default now(),
  stale_since timestamptz,
  closed_snapshot boolean not null default false,
  unique(hotel_id,business_date),
  unique(id,hotel_id)
);

create function public.reconcile_integrated_analytics(p_hotel_id uuid,p_from date default null,p_to date default null,p_now timestamptz default now()) returns jsonb language plpgsql set search_path=public as $$
declare v_from date;v_to date;d date;v_tz text;v_forecast jsonb;v_actual jsonb;v_closed boolean;v_fp text;
begin
 select timezone into v_tz from public.hotels where id=p_hotel_id;
 if v_tz is null then return jsonb_build_object('result','not_found');end if;
 v_from:=coalesce(p_from,(p_now at time zone v_tz)::date-30);v_to:=coalesce(p_to,(p_now at time zone v_tz)::date+90);
 if v_to<v_from or v_to-v_from>730 then return jsonb_build_object('result','invalid_range');end if;
 for d in select generate_series(v_from,v_to,interval '1 day')::date loop
  select jsonb_build_object(
   'sellable_rooms',greatest(0,(select count(*) from public.rooms where hotel_id=p_hotel_id and status not in('maintenance','blocked'))-(select count(distinct room_id) from public.room_blocks where hotel_id=p_hotel_id and released_at is null and start_date<=d and end_date>d)),
   'confirmed_room_nights',(select count(*) from public.reservation_accommodations where hotel_id=p_hotel_id and checkin_date<=d and checkout_date>d and status in('confirmed','assigned','checked_in')),
   'held_room_nights',(select count(*) from public.reservation_accommodations where hotel_id=p_hotel_id and checkin_date<=d and checkout_date>d and status='held' and hold_expires_at>p_now),
   'unavailable_rooms',(select count(distinct room_id) from public.room_blocks where hotel_id=p_hotel_id and released_at is null and start_date<=d and end_date>d),
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
end$$;

create function public.list_integrated_analytics(p_hotel_id uuid,p_from date,p_to date,p_permissions text[]) returns jsonb language sql stable set search_path=public as $$
 select jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object('date',business_date,'forecast',case when p_permissions&&array['read_financial_transactions','read_consumption_analytics'] then forecast else forecast-'lodging_revenue'-'adr'-'revpar' end,'actual',case when p_permissions&&array['read_financial_transactions','read_consumption_analytics'] then actual else actual-'lodging_revenue'-'consumption_revenue'-'adr'-'revpar'-'inventory_loss_cost' end,'reconciled_at',reconciled_at,'stale_since',stale_since,'closed_snapshot',closed_snapshot) order by business_date),'[]')) from public.integrated_operation_facts where hotel_id=p_hotel_id and business_date between coalesce(p_from,current_date-30) and coalesce(p_to,current_date+90)
$$;

create function public.drilldown_integrated_analytics(p_hotel_id uuid,p_date date,p_metric text,p_permissions text[]) returns jsonb language plpgsql stable set search_path=public as $$
declare v_tz text;
begin
 select timezone into v_tz from public.hotels where id=p_hotel_id;
 if p_metric in('lodging_revenue','consumption_revenue','adr','revpar','inventory_loss_cost') and not(p_permissions&&array['read_financial_transactions','read_consumption_analytics']) then return jsonb_build_object('result','forbidden');end if;
 if p_metric in('confirmed_room_nights','held_room_nights','arrivals','departures','unassigned_arrivals','cancellations','no_shows','direct_holds','direct_confirmations') then
  return jsonb_build_object('result','ok','items',(select coalesce(jsonb_agg(jsonb_build_object('reservation_id',a.reservation_id,'accommodation_id',a.id,'room_type',a.room_type,'checkin_date',a.checkin_date,'checkout_date',a.checkout_date,'status',a.status)),'[]') from public.reservation_accommodations a join public.reservations r on r.id=a.reservation_id where a.hotel_id=p_hotel_id and case p_metric when 'confirmed_room_nights' then a.checkin_date<=p_date and a.checkout_date>p_date and a.status in('confirmed','assigned','checked_in') when 'held_room_nights' then a.checkin_date<=p_date and a.checkout_date>p_date and a.status='held' when 'arrivals' then a.checkin_date=p_date when 'departures' then a.checkout_date=p_date when 'unassigned_arrivals' then a.checkin_date=p_date and a.status='confirmed' and a.assigned_room_id is null when 'cancellations' then a.status='canceled' and (a.updated_at at time zone v_tz)::date=p_date when 'no_shows' then a.status='no_show' and (a.updated_at at time zone v_tz)::date=p_date when 'direct_holds' then r.reservation_source='website' and (r.created_at at time zone v_tz)::date=p_date when 'direct_confirmations' then r.reservation_source='website' and exists(select 1 from public.reservation_events e where e.reservation_id=r.id and e.action='guarantee_confirmed' and (e.created_at at time zone v_tz)::date=p_date) else false end));
 end if;
 if p_metric in('unavailable_rooms','sellable_rooms') then return jsonb_build_object('result','ok','items',(select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'room_id',b.room_id,'start_date',b.start_date,'end_date',b.end_date)),'[]') from public.room_blocks b where b.hotel_id=p_hotel_id and b.released_at is null and b.start_date<=p_date and b.end_date>p_date));end if;
 if p_metric in('consumption_revenue') then return jsonb_build_object('result','ok','items',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'occurred_at',occurred_at,'amount',net_amount)),'[]') from public.consumption_orders where hotel_id=p_hotel_id and (occurred_at at time zone v_tz)::date=p_date and disposition='charged'));end if;
 if p_metric in('inventory_loss_quantity','inventory_loss_cost') then return jsonb_build_object('result','ok','items',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'product_id',product_id,'quantity',quantity_delta,'cost',total_cost,'occurred_at',occurred_at)),'[]') from public.inventory_movements where hotel_id=p_hotel_id and (occurred_at at time zone v_tz)::date=p_date and kind in('loss','count_loss')));end if;
 if p_metric in('maintenance_occurrences','maintenance_impact_room_hours','maintenance_recurrences') then return jsonb_build_object('result','ok','items',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'number',o.occurrence_number,'status',o.status,'discovered_at',o.discovered_at)),'[]') from public.maintenance_occurrences o where o.hotel_id=p_hotel_id and ((o.discovered_at at time zone v_tz)::date=p_date or exists(select 1 from public.maintenance_occurrence_affected_rooms ar where ar.occurrence_id=o.id and ar.impact_started_at<(p_date+1)::timestamp at time zone v_tz and coalesce(ar.impact_ended_at,now())>p_date::timestamp at time zone v_tz))));end if;
 return jsonb_build_object('result','ok','items','[]'::jsonb);
end$$;

alter function public.reconcile_operational_pending(uuid,timestamptz) rename to reconcile_operational_pending_stage6_base;
create function public.reconcile_operational_pending(p_hotel_id uuid,p_now timestamptz default now()) returns jsonb language plpgsql set search_path=public as $$
declare v_result jsonb;v_date date;
begin
 update public.reservations set lifecycle_status='canceled',version=version+1 where hotel_id=p_hotel_id and lifecycle_status='hold' and hold_expires_at<=p_now;
 update public.reservation_accommodations set status='canceled',version=version+1 where hotel_id=p_hotel_id and status='held' and hold_expires_at<=p_now;
 select (p_now at time zone timezone)::date into v_date from public.hotels where id=p_hotel_id;
 perform public.reconcile_integrated_analytics(p_hotel_id,v_date-30,v_date+90,p_now);
 v_result:=public.reconcile_operational_pending_stage6_base(p_hotel_id,p_now);
 return v_result;
end$$;

insert into public.permissions(name,type) values('read_integrated_analytics','HOTEL_PERMISSION') on conflict(name) do nothing;
alter table public.integrated_operation_facts enable row level security;
revoke all on public.integrated_operation_facts from public,anon,authenticated;
grant all on public.integrated_operation_facts to service_role;
grant execute on function public.reconcile_integrated_analytics(uuid,date,date,timestamptz),public.list_integrated_analytics(uuid,date,date,text[]),public.drilldown_integrated_analytics(uuid,date,text,text[]),public.reconcile_operational_pending(uuid,timestamptz) to service_role;
