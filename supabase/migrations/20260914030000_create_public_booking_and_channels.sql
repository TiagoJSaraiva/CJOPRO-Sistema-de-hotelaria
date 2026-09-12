-- Stage 6.3: public booking storefront and provider-neutral channel inbox.
create table public.booking_configurations(
 hotel_id uuid primary key references public.hotels(id), published boolean not null default false,
 primary_color text not null default '#1D4ED8', introduction text not null default '', guarantee_instructions text not null default '',
 terms text not null default '', consent_version text not null default '1', version integer not null default 1,
 updated_by uuid, updated_at timestamptz not null default now()
);
insert into public.booking_configurations(hotel_id) select id from public.hotels on conflict do nothing;
create table public.booking_quotes(
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id), input jsonb not null,
 fingerprint text not null, status text not null default 'active' check(status in('active','consumed','expired')),
 expires_at timestamptz not null, created_at timestamptz not null default now(), unique(id,hotel_id)
);
create table public.booking_quote_items(
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id), quote_id uuid not null,
 room_index integer not null, room_type text not null, rate_plan_version_id uuid not null, adults integer not null, children integer not null,
 available_count integer not null, total numeric(12,2) not null, nightly jsonb not null,
 foreign key(quote_id,hotel_id) references public.booking_quotes(id,hotel_id), foreign key(rate_plan_version_id,hotel_id) references public.rate_plan_versions(id,hotel_id)
);
create table public.booking_hold_requests(
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id), idempotency_key uuid not null,
 request_fingerprint text not null, reservation_id uuid not null, created_at timestamptz not null default now(), unique(hotel_id,idempotency_key),
 foreign key(reservation_id,hotel_id) references public.reservations(id,hotel_id)
);
create table public.booking_channels(
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id), code text not null, name text not null,
 active boolean not null default true, credential_digest text not null, credential_rotated_at timestamptz not null default now(),
 version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(hotel_id,code), unique(id,hotel_id)
);
create table public.booking_channel_mappings(
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id), channel_id uuid not null,
 external_room_code text not null, room_type text not null, external_rate_code text not null, rate_plan_id uuid not null,
 unique(channel_id,external_room_code,external_rate_code), foreign key(channel_id,hotel_id) references public.booking_channels(id,hotel_id), foreign key(rate_plan_id,hotel_id) references public.rate_plans(id,hotel_id)
);
create table public.booking_channel_events(
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id), channel_id uuid not null,
 external_event_id text not null, external_reservation_id text not null, event_type text not null check(event_type in('create','amend','cancel')),
 status text not null default 'received' check(status in('received','applied','needs_review','rejected','duplicate')),
 normalized_payload jsonb not null, payload_fingerprint text not null, reservation_id uuid, reason text,
 occurred_at timestamptz not null, version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(channel_id,external_event_id), foreign key(channel_id,hotel_id) references public.booking_channels(id,hotel_id), foreign key(reservation_id,hotel_id) references public.reservations(id,hotel_id)
);
create table public.booking_channel_feed_acknowledgements(
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id), channel_id uuid not null,
 feed_version text not null, acknowledged_at timestamptz not null default now(), unique(channel_id,feed_version), foreign key(channel_id,hotel_id) references public.booking_channels(id,hotel_id)
);

create function public.get_booking_configuration(p_hotel_id uuid) returns jsonb language sql stable set search_path=public as $$select jsonb_build_object('hotel',jsonb_build_object('id',h.id,'name',h.name,'slug',h.slug,'currency',h.currency,'city',h.city,'state',h.state,'email',h.email,'phone',h.phone),'configuration',to_jsonb(c)) from public.hotels h join public.booking_configurations c on c.hotel_id=h.id where h.id=p_hotel_id$$;
create function public.save_booking_configuration(p_hotel_id uuid,p_actor_id uuid,p_input jsonb) returns jsonb language plpgsql set search_path=public as $$begin insert into public.booking_configurations(hotel_id,published,primary_color,introduction,guarantee_instructions,terms,consent_version,updated_by) values(p_hotel_id,(p_input->>'published')::boolean,p_input->>'primary_color',p_input->>'introduction',p_input->>'guarantee_instructions',p_input->>'terms',p_input->>'consent_version',p_actor_id) on conflict(hotel_id) do update set published=excluded.published,primary_color=excluded.primary_color,introduction=excluded.introduction,guarantee_instructions=excluded.guarantee_instructions,terms=excluded.terms,consent_version=excluded.consent_version,version=public.booking_configurations.version+1,updated_by=p_actor_id,updated_at=now();return jsonb_build_object('result','ok','id',p_hotel_id);exception when check_violation then return jsonb_build_object('result','invalid');end$$;
create function public.get_public_booking_configuration(p_slug text) returns jsonb language sql stable set search_path=public as $$select jsonb_build_object('result','ok','hotel',jsonb_build_object('name',h.name,'slug',h.slug,'city',h.city,'state',h.state,'currency',h.currency,'email',h.email,'phone',h.phone),'configuration',jsonb_build_object('primary_color',c.primary_color,'introduction',c.introduction,'guarantee_instructions',c.guarantee_instructions,'terms',c.terms,'consent_version',c.consent_version)) from public.hotels h join public.booking_configurations c on c.hotel_id=h.id where h.slug=p_slug and h.is_active and c.published$$;

create function public.quote_public_booking(p_slug text,p_input jsonb) returns jsonb language plpgsql set search_path=public as $$declare v_hotel uuid;v_currency text;v_id uuid:=gen_random_uuid();v_fp text;v_checkin date:=(p_input->>'checkin_date')::date;v_checkout date:=(p_input->>'checkout_date')::date;v_room jsonb;v_index integer:=0;v_item uuid;v_type record;v_rate record;v_nightly jsonb;v_total numeric;v_available integer;begin
 select h.id,h.currency into v_hotel,v_currency from public.hotels h join public.booking_configurations c on c.hotel_id=h.id where h.slug=p_slug and h.is_active and c.published;if not found then return jsonb_build_object('result','not_found');end if;if v_checkout<=v_checkin or v_checkin<(now() at time zone (select timezone from public.hotels where id=v_hotel))::date then return jsonb_build_object('result','invalid_dates');end if;
 v_fp=encode(extensions.digest(convert_to(p_input::text||v_id::text,'UTF8'),'sha256'),'hex');insert into public.booking_quotes(id,hotel_id,input,fingerprint,expires_at) values(v_id,v_hotel,p_input,v_fp,now()+interval '15 minutes');
 for v_room in select * from jsonb_array_elements(p_input->'rooms') loop v_index=v_index+1;
  for v_type in select room_type,count(*)::integer capacity,max(max_occupancy) max_occupancy,avg(base_daily_rate)::numeric base from public.rooms where hotel_id=v_hotel and status not in('maintenance','blocked') group by room_type having max(max_occupancy)>=(v_room->>'adults')::integer+(v_room->>'children')::integer loop
   select min(v_type.capacity-(select count(*) from public.reservation_accommodations a where a.hotel_id=v_hotel and a.room_type=v_type.room_type and a.checkin_date<d::date+1 and a.checkout_date>d::date and (a.status in('confirmed','assigned','checked_in') or a.status='held' and a.hold_expires_at>now())))::integer into v_available from generate_series(v_checkin,v_checkout-1,interval '1 day') d;
   if coalesce(v_available,0)<=0 then continue;end if;
   for v_rate in select v.*,p.name plan_name,p.kind from public.rate_plan_versions v join public.rate_plans p on p.id=v.rate_plan_id join public.rate_plan_version_room_types t on t.version_id=v.id and t.room_type=v_type.room_type where p.hotel_id=v_hotel and p.status='active' and p.active_version_id=v.id and 'direct'=any(v.channels) order by p.name loop
   select coalesce(jsonb_agg(jsonb_build_object('date',d::date,'base',v_type.base,'seasonal',coalesce(s.extra,0),'plan_adjustment',case when v_rate.adjustment_type='percentage' then round((v_type.base+coalesce(s.extra,0))*v_rate.adjustment_value/100,2) else v_rate.adjustment_value end,'occupancy_supplement',greatest(0,(v_room->>'adults')::integer-v_rate.included_adults)*v_rate.extra_adult_amount+greatest(0,(v_room->>'children')::integer-v_rate.included_children)*v_rate.extra_child_amount,'final',round(case when v_rate.adjustment_type='percentage' then (v_type.base+coalesce(s.extra,0))*(1+v_rate.adjustment_value/100) else v_type.base+coalesce(s.extra,0)+v_rate.adjustment_value end+greatest(0,(v_room->>'adults')::integer-v_rate.included_adults)*v_rate.extra_adult_amount+greatest(0,(v_room->>'children')::integer-v_rate.included_children)*v_rate.extra_child_amount,2)) order by d),'[]'),coalesce(sum(round(case when v_rate.adjustment_type='percentage' then (v_type.base+coalesce(s.extra,0))*(1+v_rate.adjustment_value/100) else v_type.base+coalesce(s.extra,0)+v_rate.adjustment_value end+greatest(0,(v_room->>'adults')::integer-v_rate.included_adults)*v_rate.extra_adult_amount+greatest(0,(v_room->>'children')::integer-v_rate.included_children)*v_rate.extra_child_amount,2)),0) into v_nightly,v_total from generate_series(v_checkin,v_checkout-1,interval '1 day') d left join lateral(select coalesce(sr.daily_rate,0)::numeric extra from public.seasons se join public.season_room_rates sr on sr.season_id=se.id and sr.room_type=v_type.room_type where se.hotel_id=v_hotel and se.is_active and d::date between se.start_date and se.end_date order by se.start_date desc limit 1)s on true;
   v_item=gen_random_uuid();insert into public.booking_quote_items(id,hotel_id,quote_id,room_index,room_type,rate_plan_version_id,adults,children,available_count,total,nightly) values(v_item,v_hotel,v_id,v_index,v_type.room_type,v_rate.id,(v_room->>'adults')::integer,(v_room->>'children')::integer,v_available,v_total,v_nightly);
   end loop;
  end loop;
 end loop;
 return jsonb_build_object('result','ok','quote_id',v_id,'fingerprint',v_fp,'expires_at',now()+interval '15 minutes','currency',v_currency,'items',(select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('plan_name',p.name,'plan_kind',p.kind,'guarantee',jsonb_build_object('type',v.guarantee_type,'value',v.guarantee_value),'cancellation',jsonb_build_object('type',v.cancellation_type,'value',v.cancellation_value,'cutoff_hours',v.cancellation_cutoff_hours),'benefit_plan_version_id',v.benefit_plan_version_id) order by i.room_index,i.total),'[]') from public.booking_quote_items i join public.rate_plan_versions v on v.id=i.rate_plan_version_id join public.rate_plans p on p.id=v.rate_plan_id where i.quote_id=v_id));exception when invalid_text_representation then return jsonb_build_object('result','invalid');end$$;

create function public.create_public_booking_hold(p_slug text,p_input jsonb) returns jsonb language plpgsql security definer set search_path=public,extensions as $$declare q public.booking_quotes;v_hotel uuid;v_existing public.booking_hold_requests;v_fp text:=encode(digest(convert_to(p_input::text,'UTF8'),'sha256'),'hex');v_res uuid;v_code text;v_selection jsonb;i public.booking_quote_items;v_expiry timestamptz;v_access text;v_access_result jsonb;v_a uuid;n jsonb;begin
 select h.id into v_hotel from public.hotels h join public.booking_configurations c on c.hotel_id=h.id where h.slug=p_slug and h.is_active and c.published;if not found then return jsonb_build_object('result','not_found');end if;
 select * into v_existing from public.booking_hold_requests where hotel_id=v_hotel and idempotency_key=(p_input->>'idempotency_key')::uuid;if found then if v_existing.request_fingerprint=v_fp then return jsonb_build_object('result','ok','reservation_id',v_existing.reservation_id,'repeated',true);end if;return jsonb_build_object('result','idempotency_conflict');end if;
 select * into q from public.booking_quotes where id=(p_input->>'quote_id')::uuid and hotel_id=v_hotel for update;if not found or q.status<>'active' or q.expires_at<=now() or q.fingerprint<>p_input->>'quote_fingerprint' then return jsonb_build_object('result','quote_expired');end if;
 if jsonb_array_length(p_input->'selections')<>jsonb_array_length(q.input->'rooms') or (select count(distinct i.room_index) from jsonb_array_elements(p_input->'selections') s join public.booking_quote_items i on i.id=(s->>'quote_item_id')::uuid and i.quote_id=q.id)<>jsonb_array_length(q.input->'rooms') then return jsonb_build_object('result','invalid_selection');end if;
 v_code='WEB-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));insert into public.reservations(hotel_id,booking_customer_id,reservation_code,guest_count,reservation_source,estimated_total_price,final_total_price,notes,lifecycle_status,hold_expires_at) values(v_hotel,null,v_code,1,'website',0,0,'Pré-reserva direta','hold',now()+interval '24 hours') returning id,hold_expires_at into v_res,v_expiry;
 insert into public.reservation_contacts(reservation_id,hotel_id,full_name,email,phone,consent_version) values(v_res,v_hotel,trim(p_input->>'contact_name'),nullif(p_input->>'email',''),nullif(p_input->>'phone',''),p_input->>'consent_version');
 for v_selection in select * from jsonb_array_elements(p_input->'selections') loop select * into i from public.booking_quote_items where id=(v_selection->>'quote_item_id')::uuid and quote_id=q.id and room_type=v_selection->>'room_type' and rate_plan_version_id=(v_selection->>'rate_plan_version_id')::uuid;if not found then raise exception using errcode='P0001',message='invalid_selection';end if;perform pg_advisory_xact_lock(hashtext(v_hotel::text||i.room_type||q.input->>'checkin_date'||q.input->>'checkout_date'));
  if (select count(*) from public.rooms where hotel_id=v_hotel and room_type=i.room_type and status not in('maintenance','blocked')) <= (select count(*) from public.reservation_accommodations a where a.hotel_id=v_hotel and a.room_type=i.room_type and a.checkin_date<(q.input->>'checkout_date')::date and a.checkout_date>(q.input->>'checkin_date')::date and (a.status in('confirmed','assigned','checked_in') or a.status='held' and a.hold_expires_at>now())) then raise exception using errcode='P0001',message='availability_conflict';end if;
  select least(now()+make_interval(hours=>v.hold_hours),((q.input->>'checkin_date')::date+coalesce(h.checkin_time_limit,time '23:59')) at time zone h.timezone) into v_expiry from public.rate_plan_versions v join public.hotels h on h.id=v_hotel where v.id=i.rate_plan_version_id;
  insert into public.reservation_accommodations(hotel_id,reservation_id,room_type,checkin_date,checkout_date,adults,children,status,rate_plan_version_id,total_price,hold_expires_at) values(v_hotel,v_res,i.room_type,(q.input->>'checkin_date')::date,(q.input->>'checkout_date')::date,i.adults,i.children,'held',i.rate_plan_version_id,i.total,v_expiry) returning id into v_a;
  for n in select * from jsonb_array_elements(i.nightly) loop insert into public.reservation_nightly_prices(hotel_id,accommodation_id,stay_date,rate_plan_version_id,base_amount,seasonal_amount,plan_adjustment,occupancy_supplement,final_amount,source) values(v_hotel,v_a,(n->>'date')::date,i.rate_plan_version_id,(n->>'base')::numeric,(n->>'seasonal')::numeric,(n->>'plan_adjustment')::numeric,(n->>'occupancy_supplement')::numeric,(n->>'final')::numeric,'direct');end loop;
 end loop;
 update public.reservations set guest_count=(select sum(adults+children) from public.reservation_accommodations where reservation_id=v_res),estimated_total_price=(select sum(total_price) from public.reservation_accommodations where reservation_id=v_res),final_total_price=(select sum(total_price) from public.reservation_accommodations where reservation_id=v_res),hold_expires_at=(select min(hold_expires_at) from public.reservation_accommodations where reservation_id=v_res) where id=v_res;update public.booking_quotes set status='consumed' where id=q.id;insert into public.booking_hold_requests(hotel_id,idempotency_key,request_fingerprint,reservation_id) values(v_hotel,(p_input->>'idempotency_key')::uuid,v_fp,v_res);v_access_result=public.create_prearrival_link(v_hotel,v_res,null,2160);return jsonb_build_object('result','ok','reservation_id',v_res,'reservation_code',v_code,'expires_at',(select hold_expires_at from public.reservations where id=v_res),'access_token',v_access_result->>'token');exception when raise_exception then return jsonb_build_object('result',sqlerrm);end$$;

create function public.list_booking_channels(p_hotel_id uuid) returns jsonb language sql stable set search_path=public as $$select jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object('id',c.id,'code',c.code,'name',c.name,'active',c.active,'version',c.version,'mappings',(select coalesce(jsonb_agg(to_jsonb(m)),'[]') from public.booking_channel_mappings m where m.channel_id=c.id)) order by c.name),'[]')) from public.booking_channels c where c.hotel_id=p_hotel_id$$;
create function public.save_booking_channel(p_hotel_id uuid,p_actor_id uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path=public,extensions as $$declare v_id uuid;v_secret text:=encode(gen_random_bytes(32),'hex');begin insert into public.booking_channels(hotel_id,code,name,active,credential_digest) values(p_hotel_id,upper(trim(p_input->>'code')),trim(p_input->>'name'),coalesce((p_input->>'active')::boolean,true),encode(digest(v_secret,'sha256'),'hex')) returning id into v_id;return jsonb_build_object('result','ok','id',v_id,'secret',v_secret);exception when unique_violation then return jsonb_build_object('result','conflict');end$$;
create function public.save_booking_channel_mapping(p_hotel_id uuid,p_channel_id uuid,p_input jsonb) returns jsonb language plpgsql set search_path=public as $$declare v_id uuid;begin if not exists(select 1 from public.booking_channels where id=p_channel_id and hotel_id=p_hotel_id) then return jsonb_build_object('result','not_found');end if;insert into public.booking_channel_mappings(hotel_id,channel_id,external_room_code,room_type,external_rate_code,rate_plan_id) values(p_hotel_id,p_channel_id,p_input->>'external_room_code',p_input->>'room_type',p_input->>'external_rate_code',(p_input->>'rate_plan_id')::uuid) on conflict(channel_id,external_room_code,external_rate_code) do update set room_type=excluded.room_type,rate_plan_id=excluded.rate_plan_id returning id into v_id;return jsonb_build_object('result','ok','id',v_id);end$$;
create function public.resolve_booking_channel(p_id uuid) returns jsonb language sql stable security definer set search_path=public as $$select jsonb_build_object('id',id,'hotel_id',hotel_id,'active',active,'credential_digest',credential_digest) from public.booking_channels where id=p_id$$;
create function public.ingest_booking_channel_event(p_channel_id uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path=public as $$declare c public.booking_channels;m public.booking_channel_mappings;v_id uuid;v_fp text:=md5(p_input::text);begin select * into c from public.booking_channels where id=p_channel_id and active;if not found then return jsonb_build_object('result','not_found');end if;select * into m from public.booking_channel_mappings where channel_id=c.id and external_room_code=p_input->'reservation'->>'room_code' and external_rate_code=p_input->'reservation'->>'rate_code';insert into public.booking_channel_events(hotel_id,channel_id,external_event_id,external_reservation_id,event_type,status,normalized_payload,payload_fingerprint,occurred_at,reason) values(c.hotel_id,c.id,p_input->>'event_id',p_input->>'external_reservation_id',p_input->>'event_type',case when m.id is null then 'needs_review' else 'received' end,p_input,v_fp,(p_input->>'occurred_at')::timestamptz,case when m.id is null then 'mapping_missing' end) returning id into v_id;return jsonb_build_object('result','ok','id',v_id,'status',case when m.id is null then 'needs_review' else 'received' end);exception when unique_violation then if (select payload_fingerprint from public.booking_channel_events where channel_id=c.id and external_event_id=p_input->>'event_id')=v_fp then return jsonb_build_object('result','ok','duplicate',true);end if;return jsonb_build_object('result','idempotency_conflict');end$$;
create function public.list_booking_channel_inbox(p_hotel_id uuid) returns jsonb language sql stable set search_path=public as $$select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('channel_name',c.name) order by e.created_at desc),'[]')) from public.booking_channel_events e join public.booking_channels c on c.id=e.channel_id where e.hotel_id=p_hotel_id$$;
create function public.import_booking_channel_events(p_hotel_id uuid,p_channel_id uuid,p_rows jsonb) returns jsonb language plpgsql set search_path=public as $$
declare v_row jsonb;v_result jsonb;v_items jsonb:='[]';v_index integer:=0;
begin
 if not exists(select 1 from public.booking_channels where id=p_channel_id and hotel_id=p_hotel_id and active) then return jsonb_build_object('result','not_found');end if;
 for v_row in select * from jsonb_array_elements(coalesce(p_rows,'[]')) loop
  v_index:=v_index+1;
  begin
   v_result:=public.ingest_booking_channel_event(p_channel_id,v_row);
   v_items:=v_items||jsonb_build_array(jsonb_build_object('row',v_index,'result',v_result));
  exception when others then
   v_items:=v_items||jsonb_build_array(jsonb_build_object('row',v_index,'result',jsonb_build_object('result','invalid','reason',sqlstate)));
  end;
 end loop;
 return jsonb_build_object('result','ok','items',v_items);
end$$;
create function public.act_booking_channel_event(p_hotel_id uuid,p_id uuid,p_actor_id uuid,p_input jsonb) returns jsonb language plpgsql set search_path=public as $$declare e public.booking_channel_events;v_status text;begin select * into e from public.booking_channel_events where id=p_id and hotel_id=p_hotel_id for update;if not found then return jsonb_build_object('result','not_found');end if;if e.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict','context',to_jsonb(e));end if;v_status=case p_input->>'action' when 'apply' then 'applied' when 'reject' then 'rejected' when 'resolve' then 'applied' end;if v_status is null or length(trim(p_input->>'reason'))<3 then return jsonb_build_object('result','invalid');end if;update public.booking_channel_events set status=v_status,reason=trim(p_input->>'reason'),version=version+1,updated_at=now() where id=p_id;return jsonb_build_object('result','ok','id',p_id);end$$;
create or replace function public.act_booking_channel_event(p_hotel_id uuid,p_id uuid,p_actor_id uuid,p_input jsonb) returns jsonb language plpgsql set search_path=public as $$
declare
 e public.booking_channel_events;
 m public.booking_channel_mappings;
 v_payload jsonb;
 v_reservation uuid;
 v_accommodation uuid;
 v_rate_version uuid;
 v_available integer;
 v_room_count integer;
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
 select count(*) into v_room_count from public.rooms where hotel_id=p_hotel_id and room_type=m.room_type and status not in('maintenance','blocked');
 select v_room_count-count(*) into v_available from public.reservation_accommodations a where a.hotel_id=p_hotel_id and a.room_type=m.room_type and a.checkin_date<v_checkout and a.checkout_date>v_checkin and a.status in('confirmed','assigned','checked_in') and (v_reservation is null or a.reservation_id<>v_reservation);
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
end$$;
create function public.get_booking_channel_inventory(p_channel_id uuid) returns jsonb language sql stable security definer set search_path=public as $$select jsonb_build_object('feed_version',extract(epoch from date_trunc('minute',now()))::bigint::text,'hotel_id',c.hotel_id,'rooms',(select coalesce(jsonb_agg(jsonb_build_object('room_type',r.room_type,'available',r.capacity)),'[]') from(select room_type,count(*) capacity from public.rooms where hotel_id=c.hotel_id and status not in('maintenance','blocked') group by room_type)r),'rates',(select coalesce(jsonb_agg(jsonb_build_object('external_room_code',m.external_room_code,'external_rate_code',m.external_rate_code,'room_type',m.room_type,'rate_plan_id',m.rate_plan_id)),'[]') from public.booking_channel_mappings m where m.channel_id=c.id)) from public.booking_channels c where c.id=p_channel_id and c.active$$;

create function public.initialize_booking_configuration_for_hotel() returns trigger language plpgsql set search_path=public as $$begin insert into public.booking_configurations(hotel_id) values(new.id) on conflict do nothing;return new;end$$;
create trigger hotels_initialize_booking_configuration after insert on public.hotels for each row execute function public.initialize_booking_configuration_for_hotel();

insert into public.permissions(name,type) select name,'HOTEL_PERMISSION' from unnest(array['manage_booking_configuration','manage_booking_channels']) name on conflict(name) do nothing;
do $$declare t text;begin foreach t in array array['booking_configurations','booking_quotes','booking_quote_items','booking_hold_requests','booking_channels','booking_channel_mappings','booking_channel_events','booking_channel_feed_acknowledgements'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end$$;
grant execute on function public.get_booking_configuration(uuid),public.save_booking_configuration(uuid,uuid,jsonb),public.get_public_booking_configuration(text),public.quote_public_booking(text,jsonb),public.create_public_booking_hold(text,jsonb),public.list_booking_channels(uuid),public.save_booking_channel(uuid,uuid,jsonb),public.save_booking_channel_mapping(uuid,uuid,jsonb),public.resolve_booking_channel(uuid),public.ingest_booking_channel_event(uuid,jsonb),public.import_booking_channel_events(uuid,uuid,jsonb),public.list_booking_channel_inbox(uuid),public.act_booking_channel_event(uuid,uuid,uuid,jsonb),public.get_booking_channel_inventory(uuid),public.initialize_booking_configuration_for_hotel() to service_role;

create table public.public_request_rate_limits(
 identifier_hash text not null, scope text not null, window_started_at timestamptz not null,
 request_count integer not null default 0 check(request_count>=0), primary key(identifier_hash,scope)
);
create function public.consume_public_rate_limit(p_identifier text,p_scope text,p_now timestamptz)
returns jsonb language plpgsql security definer set search_path=public as $$declare v_count integer;begin
 insert into public.public_request_rate_limits(identifier_hash,scope,window_started_at,request_count) values(p_identifier,p_scope,date_trunc('minute',p_now),1)
 on conflict(identifier_hash,scope) do update set window_started_at=case when public.public_request_rate_limits.window_started_at<=p_now-interval '1 minute' then date_trunc('minute',p_now) else public.public_request_rate_limits.window_started_at end,
 request_count=case when public.public_request_rate_limits.window_started_at<=p_now-interval '1 minute' then 1 else public.public_request_rate_limits.request_count+1 end returning request_count into v_count;
 return jsonb_build_object('result',case when v_count<=30 then 'ok' else 'limited' end,'remaining',greatest(0,30-v_count));
end$$;
create function public.acknowledge_booking_channel_feed(p_channel_id uuid,p_feed_version text)
returns jsonb language plpgsql security definer set search_path=public as $$declare c public.booking_channels;begin
 select * into c from public.booking_channels where id=p_channel_id and active;if not found or nullif(trim(p_feed_version),'') is null then return jsonb_build_object('result','invalid');end if;
 insert into public.booking_channel_feed_acknowledgements(hotel_id,channel_id,feed_version) values(c.hotel_id,c.id,p_feed_version) on conflict(channel_id,feed_version) do nothing;
 return jsonb_build_object('result','ok','feed_version',p_feed_version);
end$$;

alter function public.operational_pending_candidates(uuid,timestamptz) rename to operational_pending_candidates_stage6_channels_base;
create function public.operational_pending_candidates(p_hotel_id uuid,p_now timestamptz default now())
returns jsonb language plpgsql set search_path=public as $$
declare v jsonb;
begin
 v:=public.operational_pending_candidates_stage6_channels_base(p_hotel_id,p_now);
 v:=v||coalesce((select jsonb_agg(jsonb_build_object(
  'source','reservations','source_key','reservation:hold:'||r.id,'kind','reservation_hold_expiring',
  'entity_type','reservation','entity_id',r.id,'title','Pré-reserva com sinal em análise próxima do vencimento',
  'href','/dashboard/reservations/prearrival','severity','warning','due_on',(r.hold_expires_at at time zone h.timezone)::date))
  from public.reservations r join public.hotels h on h.id=r.hotel_id
  where r.hotel_id=p_hotel_id and r.lifecycle_status='hold' and r.hold_expires_at between p_now and p_now+interval '2 hours'
  and exists(select 1 from public.reservation_account_entries e where e.reservation_id=r.id and e.kind='guarantee')),'[]');
 v:=v||coalesce((select jsonb_agg(jsonb_build_object(
  'source','reservations','source_key','reservation:prearrival-incomplete:'||r.id,'kind','prearrival_incomplete',
  'entity_type','reservation','entity_id',r.id,'title','Pré-chegada incompleta',
  'href','/dashboard/reservations/prearrival','severity','warning','due_on',(select min(a.checkin_date) from public.reservation_accommodations a where a.reservation_id=r.id)))
  from public.reservations r
  where r.hotel_id=p_hotel_id and r.lifecycle_status='confirmed' and exists(select 1 from public.reservation_accommodations a where a.reservation_id=r.id and a.checkin_date<=((p_now at time zone (select timezone from public.hotels where id=p_hotel_id))::date+1))
  and not exists(select 1 from public.prearrival_submissions s where s.reservation_id=r.id)
  ),'[]');
 v:=v||coalesce((select jsonb_agg(jsonb_build_object(
  'source','reservations','source_key','reservation:refund:'||e.id,'kind','reservation_refund_credit',
  'entity_type','reservation_account_entry','entity_id',e.id,'title','Crédito de cancelamento aguarda devolução',
  'href','/dashboard/reservations/prearrival','severity','warning'))
  from public.reservation_account_entries e where e.hotel_id=p_hotel_id and e.kind='refund_credit' and e.reversed_entry_id is null),'[]');
 v:=v||coalesce((select jsonb_agg(jsonb_build_object(
  'source','booking_channels','source_key','booking-channel:event:'||e.id,
  'kind',case when e.reason='mapping_missing' then 'channel_mapping_missing' else 'channel_inventory_conflict' end,
  'entity_type','booking_channel_event','entity_id',e.id,
  'title',case when e.reason='mapping_missing' then 'Evento de canal sem mapeamento' else 'Reserva externa em conflito' end,
  'href','/dashboard/reservations/channels','severity','critical'))
  from public.booking_channel_events e where e.hotel_id=p_hotel_id and e.status='needs_review'),'[]');
 return v;
end$$;
alter table public.public_request_rate_limits enable row level security;
revoke all on public.public_request_rate_limits from public,anon,authenticated;
grant all on public.public_request_rate_limits to service_role;
revoke all on function public.operational_pending_candidates(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.operational_pending_candidates(uuid,timestamptz) to service_role;
grant execute on function public.consume_public_rate_limit(text,text,timestamptz),public.acknowledge_booking_channel_feed(uuid,text) to service_role;
