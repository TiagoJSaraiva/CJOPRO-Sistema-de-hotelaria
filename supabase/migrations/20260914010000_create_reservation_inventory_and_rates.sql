-- Stage 6.1: category inventory, immutable rate versions and reservation amendments.
alter table public.reservations alter column booking_customer_id drop not null;
alter table public.reservations add column if not exists lifecycle_status text not null default 'confirmed'
  check (lifecycle_status in ('hold','confirmed','in_house','completed','canceled','no_show'));
alter table public.reservations add column if not exists version integer not null default 1 check(version>0);
alter table public.reservations add column if not exists hold_expires_at timestamptz;
alter table public.reservations add column if not exists public_access_id uuid not null default gen_random_uuid();

create table public.rate_plans(
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id),
 code text not null, name text not null, kind text not null check(kind in ('flexible','non_refundable','package')),
 description text, status text not null default 'draft' check(status in ('draft','active','retired')),
 active_version_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(hotel_id,code), unique(id,hotel_id)
);
create table public.rate_plan_versions(
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id),
 rate_plan_id uuid not null, version_number integer not null check(version_number>0), currency text not null check(currency~'^[A-Z]{3}$'),
 adjustment_type text not null check(adjustment_type in ('fixed','percentage')), adjustment_value numeric(12,2) not null default 0,
 included_adults integer not null default 1 check(included_adults>0), included_children integer not null default 0 check(included_children>=0),
 extra_adult_amount numeric(12,2) not null default 0 check(extra_adult_amount>=0), extra_child_amount numeric(12,2) not null default 0 check(extra_child_amount>=0),
 guarantee_type text not null default 'none' check(guarantee_type in ('none','fixed','percentage','first_night')),
 guarantee_value numeric(12,2) not null default 0 check(guarantee_value>=0), hold_hours integer not null default 24 check(hold_hours between 1 and 720),
 cancellation_type text not null default 'none' check(cancellation_type in ('none','fixed','percentage','first_night','full_stay')),
 cancellation_value numeric(12,2) not null default 0 check(cancellation_value>=0), cancellation_cutoff_hours integer not null default 0 check(cancellation_cutoff_hours between 0 and 8760),
 benefit_plan_version_id uuid references public.consumption_benefit_plan_versions(id), channels text[] not null default array['internal']::text[],
 activated_at timestamptz, created_by uuid, created_at timestamptz not null default now(),
 unique(rate_plan_id,version_number), unique(id,hotel_id),
 foreign key(rate_plan_id,hotel_id) references public.rate_plans(id,hotel_id)
);
alter table public.rate_plans add constraint rate_plans_active_version_fk foreign key(active_version_id,hotel_id) references public.rate_plan_versions(id,hotel_id);
create table public.rate_plan_version_room_types(
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id),
 version_id uuid not null, room_type text not null, created_at timestamptz not null default now(),
 unique(version_id,room_type), foreign key(version_id,hotel_id) references public.rate_plan_versions(id,hotel_id)
);

create table public.reservation_contacts(
 reservation_id uuid primary key, hotel_id uuid not null references public.hotels(id), full_name text not null,
 email text, phone text, consent_version text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(reservation_id,hotel_id) references public.reservations(id,hotel_id)
);
create table public.reservation_accommodations(
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id), reservation_id uuid not null,
 room_type text not null, checkin_date date not null, checkout_date date not null, adults integer not null default 1 check(adults>0),
 children integer not null default 0 check(children>=0), status text not null default 'confirmed' check(status in ('held','confirmed','assigned','checked_in','checked_out','canceled','no_show')),
 rate_plan_version_id uuid, stay_id uuid unique references public.stays(id), assigned_room_id uuid references public.rooms(id),
 total_price numeric(12,2) not null default 0 check(total_price>=0), hold_expires_at timestamptz, version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(checkout_date>checkin_date), unique(id,hotel_id), foreign key(reservation_id,hotel_id) references public.reservations(id,hotel_id),
 foreign key(rate_plan_version_id,hotel_id) references public.rate_plan_versions(id,hotel_id), foreign key(assigned_room_id,hotel_id) references public.rooms(id,hotel_id)
);
create index reservation_accommodations_inventory_idx on public.reservation_accommodations(hotel_id,room_type,checkin_date,checkout_date,status);
create table public.reservation_nightly_prices(
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id), accommodation_id uuid not null,
 stay_date date not null, rate_plan_version_id uuid, base_amount numeric(12,2) not null default 0, seasonal_amount numeric(12,2) not null default 0,
 plan_adjustment numeric(12,2) not null default 0, occupancy_supplement numeric(12,2) not null default 0,
 benefit_amount numeric(12,2) not null default 0, final_amount numeric(12,2) not null check(final_amount>=0), source text not null default 'rate_plan',
 created_at timestamptz not null default now(), unique(accommodation_id,stay_date),
 foreign key(accommodation_id,hotel_id) references public.reservation_accommodations(id,hotel_id),
 foreign key(rate_plan_version_id,hotel_id) references public.rate_plan_versions(id,hotel_id)
);
create table public.reservation_amendments(
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id), reservation_id uuid not null,
 accommodation_id uuid not null, status text not null default 'applied' check(status in ('simulated','applied','rejected')),
 before_snapshot jsonb not null, after_snapshot jsonb not null, price_delta numeric(12,2) not null, reason text not null,
 waived_price_delta boolean not null default false, idempotency_key uuid not null, request_fingerprint text not null,
 created_by uuid, created_at timestamptz not null default now(), unique(hotel_id,idempotency_key),
 foreign key(reservation_id,hotel_id) references public.reservations(id,hotel_id), foreign key(accommodation_id,hotel_id) references public.reservation_accommodations(id,hotel_id)
);
create table public.reservation_assignment_events(
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id), accommodation_id uuid not null,
 from_room_id uuid, to_room_id uuid, reason text not null, actor_id uuid, created_at timestamptz not null default now(),
 foreign key(accommodation_id,hotel_id) references public.reservation_accommodations(id,hotel_id)
);
create table public.reservation_events(
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id), reservation_id uuid not null,
 action text not null, actor_id uuid, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
 foreign key(reservation_id,hotel_id) references public.reservations(id,hotel_id)
);
create table public.reservation_account_entries(
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id), reservation_id uuid not null,
 direction text not null check(direction in ('debit','credit')), kind text not null check(kind in ('guarantee','penalty','refund_credit','stay_transfer','adjustment')),
 amount numeric(12,2) not null check(amount>0), currency text not null, payment_method text, reference text, cash_session_id uuid references public.cash_sessions(id),
 idempotency_key uuid, reversed_entry_id uuid references public.reservation_account_entries(id), actor_id uuid, created_at timestamptz not null default now(),
 foreign key(reservation_id,hotel_id) references public.reservations(id,hotel_id), unique(hotel_id,idempotency_key)
);

-- Preserve existing reservations without inventing commercial policies.
insert into public.reservation_accommodations(hotel_id,reservation_id,room_type,checkin_date,checkout_date,adults,children,status,stay_id,assigned_room_id,total_price,created_at)
select r.hotel_id,s.reservation_id,rm.room_type,s.checkin_date_expected::date,s.checkout_date_expected::date,greatest(1,r.guest_count),0,
 case s.stay_status::text when 'confirmed' then 'assigned' when 'checked_in' then 'checked_in' when 'checked_out' then 'checked_out' when 'canceled' then 'canceled' else 'no_show' end,
 s.id,s.room_id,s.total_price_estimated,s.created_at from public.stays s join public.reservations r on r.id=s.reservation_id join public.rooms rm on rm.id=s.room_id;
insert into public.reservation_nightly_prices(hotel_id,accommodation_id,stay_date,base_amount,final_amount,source)
select a.hotel_id,a.id,d::date,case when d::date=a.checkout_date-1 then round(a.total_price-(greatest(0,a.checkout_date-a.checkin_date-1)*round(a.total_price/greatest(1,a.checkout_date-a.checkin_date),2)),2) else round(a.total_price/greatest(1,a.checkout_date-a.checkin_date),2) end,
case when d::date=a.checkout_date-1 then round(a.total_price-(greatest(0,a.checkout_date-a.checkin_date-1)*round(a.total_price/greatest(1,a.checkout_date-a.checkin_date),2)),2) else round(a.total_price/greatest(1,a.checkout_date-a.checkin_date),2) end,'legacy'
from public.reservation_accommodations a cross join lateral generate_series(a.checkin_date,a.checkout_date-1,interval '1 day') d;
update public.reservations r set lifecycle_status=case when exists(select 1 from public.stays s where s.reservation_id=r.id and s.stay_status='checked_in') then 'in_house' when not exists(select 1 from public.stays s where s.reservation_id=r.id and s.stay_status not in ('checked_out','canceled','no_show')) and exists(select 1 from public.stays s where s.reservation_id=r.id and s.stay_status='checked_out') then 'completed' when not exists(select 1 from public.stays s where s.reservation_id=r.id and s.stay_status<>'canceled') then 'canceled' when not exists(select 1 from public.stays s where s.reservation_id=r.id and s.stay_status<>'no_show') then 'no_show' else 'confirmed' end;

create function public.list_rate_plans(p_hotel_id uuid) returns jsonb language sql stable set search_path=public as $$
 select jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object('id',p.id,'code',p.code,'name',p.name,'kind',p.kind,'status',p.status,'active_version_id',p.active_version_id,'versions',(select coalesce(jsonb_agg(to_jsonb(v) order by v.version_number desc),'[]') from public.rate_plan_versions v where v.rate_plan_id=p.id)) order by p.name),'[]'::jsonb)) from public.rate_plans p where p.hotel_id=p_hotel_id $$;
create function public.save_rate_plan(p_hotel_id uuid,p_actor_id uuid,p_input jsonb) returns jsonb language plpgsql set search_path=public as $$declare v_id uuid;begin
 if length(trim(p_input->>'name'))<2 or length(trim(p_input->>'code'))<2 then return jsonb_build_object('result','invalid');end if;
 insert into public.rate_plans(hotel_id,code,name,kind,description) values(p_hotel_id,upper(trim(p_input->>'code')),trim(p_input->>'name'),p_input->>'kind',nullif(trim(p_input->>'description'),'')) returning id into v_id;
 return jsonb_build_object('result','ok','id',v_id);exception when unique_violation then return jsonb_build_object('result','conflict');end$$;
create function public.version_rate_plan(p_hotel_id uuid,p_plan_id uuid,p_actor_id uuid,p_input jsonb) returns jsonb language plpgsql set search_path=public as $$declare v_id uuid;v_number integer;v_activate boolean:=coalesce((p_input->>'activate')::boolean,false);begin
 perform 1 from public.rate_plans where id=p_plan_id and hotel_id=p_hotel_id for update;if not found then return jsonb_build_object('result','not_found');end if;
 select coalesce(max(version_number),0)+1 into v_number from public.rate_plan_versions where rate_plan_id=p_plan_id;
 insert into public.rate_plan_versions(hotel_id,rate_plan_id,version_number,currency,adjustment_type,adjustment_value,included_adults,included_children,extra_adult_amount,extra_child_amount,guarantee_type,guarantee_value,hold_hours,cancellation_type,cancellation_value,cancellation_cutoff_hours,benefit_plan_version_id,channels,activated_at,created_by)
 values(p_hotel_id,p_plan_id,v_number,p_input->>'currency',p_input->>'adjustment_type',(p_input->>'adjustment_value')::numeric,(p_input->>'included_adults')::integer,(p_input->>'included_children')::integer,(p_input->>'extra_adult_amount')::numeric,(p_input->>'extra_child_amount')::numeric,p_input->>'guarantee_type',(p_input->>'guarantee_value')::numeric,(p_input->>'hold_hours')::integer,p_input->>'cancellation_type',(p_input->>'cancellation_value')::numeric,(p_input->>'cancellation_cutoff_hours')::integer,nullif(p_input->>'benefit_plan_version_id','')::uuid,array(select jsonb_array_elements_text(p_input->'channels')),case when v_activate then now() end,p_actor_id) returning id into v_id;
 insert into public.rate_plan_version_room_types(hotel_id,version_id,room_type) select p_hotel_id,v_id,value from jsonb_array_elements_text(p_input->'room_types');
 if v_activate then update public.rate_plans set active_version_id=v_id,status='active',updated_at=now() where id=p_plan_id;end if;
 return jsonb_build_object('result','ok','id',v_id,'version_number',v_number);exception when check_violation or invalid_text_representation then return jsonb_build_object('result','invalid');end$$;
create function public.act_rate_plan_version(p_hotel_id uuid,p_version_id uuid,p_actor_id uuid,p_action text) returns jsonb language plpgsql set search_path=public as $$declare v_plan uuid;begin
 select rate_plan_id into v_plan from public.rate_plan_versions where id=p_version_id and hotel_id=p_hotel_id;if not found then return jsonb_build_object('result','not_found');end if;
 if p_action='activate' then update public.rate_plan_versions set activated_at=coalesce(activated_at,now()) where id=p_version_id;update public.rate_plans set active_version_id=p_version_id,status='active',updated_at=now() where id=v_plan;elsif p_action='retire' then update public.rate_plans set status='retired',updated_at=now() where id=v_plan;else return jsonb_build_object('result','invalid_action');end if;return jsonb_build_object('result','ok','id',v_plan);end$$;

create function public.get_reservation_operations(p_hotel_id uuid,p_reservation_id uuid) returns jsonb language sql stable set search_path=public as $$
 select jsonb_build_object('reservation',to_jsonb(r),'contact',(select to_jsonb(c) from public.reservation_contacts c where c.reservation_id=r.id),'accommodations',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('nights',(select jsonb_agg(to_jsonb(n) order by n.stay_date) from public.reservation_nightly_prices n where n.accommodation_id=a.id)) order by a.checkin_date) from public.reservation_accommodations a where a.reservation_id=r.id),'[]'::jsonb),'account_entries',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from public.reservation_account_entries e where e.reservation_id=r.id),'[]'::jsonb),'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from public.reservation_events e where e.reservation_id=r.id),'[]'::jsonb)) from public.reservations r where r.id=p_reservation_id and r.hotel_id=p_hotel_id $$;

create function public.simulate_reservation_amendment(p_hotel_id uuid,p_reservation_id uuid,p_input jsonb) returns jsonb language plpgsql stable set search_path=public as $$declare a public.reservation_accommodations;v_old numeric;v_new numeric;v_nights integer;begin
 select * into a from public.reservation_accommodations where id=(p_input->>'accommodation_id')::uuid and reservation_id=p_reservation_id and hotel_id=p_hotel_id;if not found then return jsonb_build_object('result','not_found');end if;
 if a.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict','context',to_jsonb(a));end if;
 v_nights=(p_input->>'checkout_date')::date-(p_input->>'checkin_date')::date;if v_nights<1 then return jsonb_build_object('result','invalid_dates');end if;
 select coalesce(sum(final_amount),0) into v_old from public.reservation_nightly_prices where accommodation_id=a.id;
 -- Existing dates preserve their snapshot; newly introduced dates use the room public base.
 select coalesce(sum(coalesce(n.final_amount,rm.base_daily_rate)),0) into v_new from generate_series((p_input->>'checkin_date')::date,(p_input->>'checkout_date')::date-1,interval '1 day') d join lateral(select avg(base_daily_rate)::numeric base_daily_rate from public.rooms where hotel_id=p_hotel_id and room_type=p_input->>'room_type') rm on true left join public.reservation_nightly_prices n on n.accommodation_id=a.id and n.stay_date=d::date;
 return jsonb_build_object('result','ok','current_total',v_old,'proposed_total',v_new,'price_delta',round(v_new-v_old,2),'preserved_dates',(select coalesce(jsonb_agg(d::date),'[]') from generate_series((p_input->>'checkin_date')::date,(p_input->>'checkout_date')::date-1,interval '1 day') d join public.reservation_nightly_prices n on n.accommodation_id=a.id and n.stay_date=d::date),'new_dates',(select coalesce(jsonb_agg(d::date),'[]') from generate_series((p_input->>'checkin_date')::date,(p_input->>'checkout_date')::date-1,interval '1 day') d left join public.reservation_nightly_prices n on n.accommodation_id=a.id and n.stay_date=d::date where n.id is null));end$$;
create function public.apply_reservation_amendment(p_hotel_id uuid,p_reservation_id uuid,p_actor_id uuid,p_input jsonb,p_can_override boolean default false) returns jsonb language plpgsql set search_path=public as $$declare a public.reservation_accommodations;v_sim jsonb;v_id uuid;v_fp text:=md5(p_input::text);v_delta numeric;begin
 select * into a from public.reservation_accommodations where id=(p_input->>'accommodation_id')::uuid and reservation_id=p_reservation_id and hotel_id=p_hotel_id for update;if not found then return jsonb_build_object('result','not_found');end if;
 select id into v_id from public.reservation_amendments where hotel_id=p_hotel_id and idempotency_key=(p_input->>'idempotency_key')::uuid;if found then if (select request_fingerprint from public.reservation_amendments where id=v_id)=v_fp then return jsonb_build_object('result','ok','id',v_id);end if;return jsonb_build_object('result','idempotency_conflict');end if;
 if a.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict','context',to_jsonb(a));end if;
 if a.status in ('checked_out','canceled','no_show') then return jsonb_build_object('result','invalid_status');end if;
 v_sim=public.simulate_reservation_amendment(p_hotel_id,p_reservation_id,p_input);if v_sim->>'result'<>'ok' then return v_sim;end if;v_delta=(v_sim->>'price_delta')::numeric;
 if coalesce((p_input->>'waive_price_delta')::boolean,false) and v_delta>0 and not p_can_override then return jsonb_build_object('result','forbidden_override');end if;
 insert into public.reservation_amendments(hotel_id,reservation_id,accommodation_id,before_snapshot,after_snapshot,price_delta,reason,waived_price_delta,idempotency_key,request_fingerprint,created_by) values(p_hotel_id,p_reservation_id,a.id,to_jsonb(a),p_input,v_delta,trim(p_input->>'reason'),coalesce((p_input->>'waive_price_delta')::boolean,false),(p_input->>'idempotency_key')::uuid,v_fp,p_actor_id) returning id into v_id;
 update public.reservation_accommodations set checkin_date=(p_input->>'checkin_date')::date,checkout_date=(p_input->>'checkout_date')::date,room_type=p_input->>'room_type',adults=(p_input->>'adults')::integer,children=(p_input->>'children')::integer,total_price=total_price+case when coalesce((p_input->>'waive_price_delta')::boolean,false) then least(v_delta,0) else v_delta end,version=version+1,updated_at=now() where id=a.id;
 delete from public.reservation_nightly_prices where accommodation_id=a.id and (stay_date<(p_input->>'checkin_date')::date or stay_date>=(p_input->>'checkout_date')::date);
 insert into public.reservation_nightly_prices(hotel_id,accommodation_id,stay_date,base_amount,final_amount,source) select p_hotel_id,a.id,d::date,rm.base_daily_rate,rm.base_daily_rate,'amendment' from generate_series((p_input->>'checkin_date')::date,(p_input->>'checkout_date')::date-1,interval '1 day') d join lateral(select avg(base_daily_rate)::numeric base_daily_rate from public.rooms where hotel_id=p_hotel_id and room_type=p_input->>'room_type') rm on true left join public.reservation_nightly_prices n on n.accommodation_id=a.id and n.stay_date=d::date where n.id is null;
 update public.stays set checkin_date_expected=(p_input->>'checkin_date')::date+time '12:00',checkout_date_expected=(p_input->>'checkout_date')::date+time '12:00',total_price_estimated=(select sum(final_amount) from public.reservation_nightly_prices where accommodation_id=a.id),updated_at=now() where id=a.stay_id;
 update public.reservations set version=version+1,estimated_total_price=(select sum(total_price) from public.reservation_accommodations where reservation_id=p_reservation_id and status not in ('canceled','no_show')),updated_at=now() where id=p_reservation_id;
 insert into public.reservation_events(hotel_id,reservation_id,action,actor_id,details) values(p_hotel_id,p_reservation_id,'amended',p_actor_id,jsonb_build_object('amendment_id',v_id,'price_delta',v_delta));return jsonb_build_object('result','ok','id',v_id,'price_delta',v_delta);end$$;

create function public.record_reservation_guarantee(p_hotel_id uuid,p_reservation_id uuid,p_actor_id uuid,p_input jsonb,p_can_waive boolean default false) returns jsonb language plpgsql set search_path=public as $$declare r public.reservations;v_total numeric:=0;v_required numeric:=0;v_t jsonb;v_key uuid:=(p_input->>'idempotency_key')::uuid;begin
 select * into r from public.reservations where id=p_reservation_id and hotel_id=p_hotel_id for update;if not found then return jsonb_build_object('result','not_found');end if;if r.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict','context',to_jsonb(r));end if;
 if exists(select 1 from public.reservation_account_entries where hotel_id=p_hotel_id and idempotency_key=v_key) then return jsonb_build_object('result','ok','id',p_reservation_id);end if;
 select coalesce(max(case v.guarantee_type when 'fixed' then v.guarantee_value when 'percentage' then a.total_price*v.guarantee_value/100 when 'first_night' then (select final_amount from public.reservation_nightly_prices where accommodation_id=a.id order by stay_date limit 1) else 0 end),0) into v_required from public.reservation_accommodations a left join public.rate_plan_versions v on v.id=a.rate_plan_version_id where a.reservation_id=p_reservation_id;
 for v_t in select * from jsonb_array_elements(coalesce(p_input->'tenders','[]')) loop v_total=v_total+(v_t->>'amount')::numeric;insert into public.reservation_account_entries(hotel_id,reservation_id,direction,kind,amount,currency,payment_method,reference,cash_session_id,idempotency_key,actor_id) values(p_hotel_id,p_reservation_id,'credit','guarantee',(v_t->>'amount')::numeric,coalesce((select currency from public.hotels where id=p_hotel_id),'BRL'),v_t->>'method',v_t->>'reference',nullif(v_t->>'cash_session_id','')::uuid,case when jsonb_array_length(p_input->'tenders')=1 then v_key else gen_random_uuid() end,p_actor_id);end loop;
 if v_total<v_required and not(coalesce((p_input->>'waive')::boolean,false) and p_can_waive and length(trim(p_input->>'reason'))>=3) then raise exception using errcode='P0001',message='insufficient_guarantee';end if;
 update public.reservations set lifecycle_status='confirmed',hold_expires_at=null,version=version+1,updated_at=now() where id=p_reservation_id;update public.reservation_accommodations set status=case when assigned_room_id is null then 'confirmed' else 'assigned' end,hold_expires_at=null,version=version+1 where reservation_id=p_reservation_id and status='held';insert into public.reservation_events(hotel_id,reservation_id,action,actor_id,details) values(p_hotel_id,p_reservation_id,'guarantee_confirmed',p_actor_id,jsonb_build_object('paid',v_total,'required',v_required,'waived',coalesce((p_input->>'waive')::boolean,false),'reason',p_input->>'reason'));return jsonb_build_object('result','ok','id',p_reservation_id,'paid',v_total,'required',v_required);exception when raise_exception then return jsonb_build_object('result','insufficient_guarantee','context',jsonb_build_object('paid',v_total,'required',v_required));end$$;

create function public.act_reservation(p_hotel_id uuid,p_reservation_id uuid,p_actor_id uuid,p_input jsonb) returns jsonb language plpgsql set search_path=public as $$
declare r public.reservations;v_action text:=p_input->>'action';v_reason text:=btrim(coalesce(p_input->>'reason',''));v_penalty numeric:=0;v_paid numeric:=0;v_currency text;
begin
 select * into r from public.reservations where id=p_reservation_id and hotel_id=p_hotel_id for update;if not found then return jsonb_build_object('result','not_found');end if;
 if r.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict','context',to_jsonb(r));end if;
 if v_action not in('cancel','no_show') or length(v_reason)<3 then return jsonb_build_object('result','invalid');end if;
 if v_action='cancel' and r.lifecycle_status not in('hold','confirmed') then return jsonb_build_object('result','invalid_status');end if;
 if v_action='no_show' and r.lifecycle_status<>'confirmed' then return jsonb_build_object('result','invalid_status');end if;
 select currency into v_currency from public.hotels where id=p_hotel_id;
 select coalesce(sum(case when v.cancellation_type='fixed' then v.cancellation_value when v.cancellation_type='percentage' then a.total_price*v.cancellation_value/100 when v.cancellation_type='first_night' then (select final_amount from public.reservation_nightly_prices n where n.accommodation_id=a.id order by stay_date limit 1) when v.cancellation_type='full_stay' then a.total_price else 0 end),0) into v_penalty from public.reservation_accommodations a left join public.rate_plan_versions v on v.id=a.rate_plan_version_id where a.reservation_id=p_reservation_id and a.status in('held','confirmed','assigned');
 select coalesce(sum(case when direction='credit' then amount else -amount end),0) into v_paid from public.reservation_account_entries where reservation_id=p_reservation_id;
 if v_penalty>0 then insert into public.reservation_account_entries(hotel_id,reservation_id,direction,kind,amount,currency,reference,actor_id) values(p_hotel_id,p_reservation_id,'debit','penalty',round(v_penalty,2),v_currency,v_reason,p_actor_id);end if;
 if v_paid>v_penalty then insert into public.reservation_account_entries(hotel_id,reservation_id,direction,kind,amount,currency,reference,actor_id) values(p_hotel_id,p_reservation_id,'debit','refund_credit',round(v_paid-v_penalty,2),v_currency,'Crédito reembolsável pendente: '||v_reason,p_actor_id);end if;
 update public.reservation_accommodations set status=case when v_action='no_show' then 'no_show' else 'canceled' end,hold_expires_at=null,version=version+1,updated_at=now() where reservation_id=p_reservation_id and status in('held','confirmed','assigned');
 update public.reservations set lifecycle_status=case when v_action='no_show' then 'no_show' else 'canceled' end,hold_expires_at=null,version=version+1,updated_at=now() where id=p_reservation_id;
 insert into public.reservation_events(hotel_id,reservation_id,action,actor_id,details) values(p_hotel_id,p_reservation_id,v_action,p_actor_id,jsonb_build_object('reason',v_reason,'penalty',v_penalty,'refundable_credit',greatest(0,v_paid-v_penalty)));
 return jsonb_build_object('result','ok','id',p_reservation_id,'penalty',round(v_penalty,2),'refundable_credit',round(greatest(0,v_paid-v_penalty),2));
end$$;

create function public.simulate_room_assignment(p_hotel_id uuid,p_reservation_id uuid,p_input jsonb) returns jsonb language sql stable set search_path=public as $$
 select jsonb_build_object('result',case when count(*)>0 then 'ok' else 'conflict' end,'candidates',coalesce(jsonb_agg(jsonb_build_object('room_id',r.id,'room_number',r.room_number,'room_type',r.room_type,'readiness',coalesce(s.state->>'readiness','ready')) order by case coalesce(s.state->>'readiness','ready') when 'ready' then 0 else 1 end,r.room_number) filter(where r.id is not null),'[]')) from public.reservation_accommodations a join public.rooms r on r.hotel_id=a.hotel_id and r.room_type=a.room_type left join lateral(select public.governance_room_state(p_hotel_id,r.id) state)s on true where a.id=(p_input->>'accommodation_id')::uuid and a.reservation_id=p_reservation_id and a.hotel_id=p_hotel_id and not exists(select 1 from public.stays x where x.room_id=r.id and x.stay_status in ('confirmed','checked_in') and x.checkin_date_expected::date<a.checkout_date and x.checkout_date_expected::date>a.checkin_date and x.id is distinct from a.stay_id) and not exists(select 1 from public.room_blocks b where b.room_id=r.id and b.released_at is null and b.start_date<a.checkout_date and b.end_date>a.checkin_date) $$;
create function public.assign_reservation_room(p_hotel_id uuid,p_reservation_id uuid,p_actor_id uuid,p_input jsonb) returns jsonb language plpgsql set search_path=public as $$declare a public.reservation_accommodations;r public.rooms;v_stay uuid;begin
 select * into a from public.reservation_accommodations where id=(p_input->>'accommodation_id')::uuid and reservation_id=p_reservation_id and hotel_id=p_hotel_id for update;if not found then return jsonb_build_object('result','not_found');end if;if a.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict','context',to_jsonb(a));end if;select * into r from public.rooms where id=(p_input->>'room_id')::uuid and hotel_id=p_hotel_id;if not found or r.room_type<>a.room_type then return jsonb_build_object('result','invalid_room');end if;
 if exists(select 1 from public.stays x where x.room_id=r.id and x.stay_status in ('confirmed','checked_in') and x.checkin_date_expected::date<a.checkout_date and x.checkout_date_expected::date>a.checkin_date and x.id is distinct from a.stay_id) or exists(select 1 from public.room_blocks b where b.room_id=r.id and b.released_at is null and b.start_date<a.checkout_date and b.end_date>a.checkin_date) then return jsonb_build_object('result','conflict');end if;
 if a.stay_id is null then insert into public.stays(reservation_id,room_id,applied_daily_rate,total_price_estimated,checkin_date_expected,checkout_date_expected,stay_status) values(p_reservation_id,r.id,round(a.total_price/greatest(1,a.checkout_date-a.checkin_date),2),a.total_price,a.checkin_date+time '12:00',a.checkout_date+time '12:00','confirmed') returning id into v_stay;else v_stay=a.stay_id;update public.stays set room_id=r.id where id=v_stay;end if;
 insert into public.reservation_assignment_events(hotel_id,accommodation_id,from_room_id,to_room_id,reason,actor_id) values(p_hotel_id,a.id,a.assigned_room_id,r.id,trim(p_input->>'reason'),p_actor_id);update public.reservation_accommodations set stay_id=v_stay,assigned_room_id=r.id,status=case when status='checked_in' then status else 'assigned' end,version=version+1,updated_at=now() where id=a.id;update public.reservations set version=version+1,updated_at=now() where id=p_reservation_id;return jsonb_build_object('result','ok','id',v_stay);end$$;

insert into public.rate_plans(hotel_id,code,name,kind,status)
select id,'FLEX','Flexível padrão','flexible','active' from public.hotels on conflict(hotel_id,code) do nothing;
with created as(insert into public.rate_plan_versions(hotel_id,rate_plan_id,version_number,currency,adjustment_type,adjustment_value,included_adults,included_children,extra_adult_amount,extra_child_amount,guarantee_type,guarantee_value,hold_hours,cancellation_type,cancellation_value,cancellation_cutoff_hours,channels,activated_at)
select p.hotel_id,p.id,1,h.currency,'fixed',0,1,0,0,0,'none',0,24,'none',0,0,array['internal','direct'],now() from public.rate_plans p join public.hotels h on h.id=p.hotel_id where p.code='FLEX' and not exists(select 1 from public.rate_plan_versions v where v.rate_plan_id=p.id) returning id,rate_plan_id,hotel_id)
update public.rate_plans p set active_version_id=c.id from created c where p.id=c.rate_plan_id;
insert into public.rate_plan_version_room_types(hotel_id,version_id,room_type) select distinct v.hotel_id,v.id,r.room_type from public.rate_plan_versions v join public.rate_plans p on p.id=v.rate_plan_id and p.code='FLEX' join public.rooms r on r.hotel_id=v.hotel_id on conflict do nothing;

create function public.initialize_default_rate_plan_for_hotel() returns trigger language plpgsql set search_path=public as $$
declare v_plan uuid;v_version uuid;
begin
 insert into public.rate_plans(hotel_id,code,name,kind,status) values(new.id,'FLEX','Flexível padrão','flexible','active') on conflict(hotel_id,code) do update set name=excluded.name returning id into v_plan;
 insert into public.rate_plan_versions(hotel_id,rate_plan_id,version_number,currency,adjustment_type,adjustment_value,included_adults,included_children,extra_adult_amount,extra_child_amount,guarantee_type,guarantee_value,hold_hours,cancellation_type,cancellation_value,cancellation_cutoff_hours,channels,activated_at)
 values(new.id,v_plan,1,new.currency,'fixed',0,1,0,0,0,'none',0,24,'none',0,0,array['internal','direct'],now()) on conflict(rate_plan_id,version_number) do update set currency=excluded.currency returning id into v_version;
 update public.rate_plans set active_version_id=v_version where id=v_plan;
 return new;
end$$;
create trigger hotels_initialize_default_rate_plan after insert on public.hotels for each row execute function public.initialize_default_rate_plan_for_hotel();

create function public.attach_room_type_to_default_rate_plan() returns trigger language plpgsql set search_path=public as $$
begin
 insert into public.rate_plan_version_room_types(hotel_id,version_id,room_type)
 select new.hotel_id,p.active_version_id,new.room_type from public.rate_plans p where p.hotel_id=new.hotel_id and p.code='FLEX' and p.active_version_id is not null on conflict do nothing;
 return new;
end$$;
create trigger rooms_attach_default_rate_plan after insert or update of room_type on public.rooms for each row execute function public.attach_room_type_to_default_rate_plan();

insert into public.permissions(name,type) select name,'HOTEL_PERMISSION' from unnest(array['manage_rate_plans','manage_reservation_amendments','override_reservation_pricing','manage_reservation_guarantees','waive_reservation_guarantee','manage_room_assignments']) name on conflict(name) do nothing;
alter table public.rate_plans enable row level security;alter table public.rate_plan_versions enable row level security;alter table public.rate_plan_version_room_types enable row level security;alter table public.reservation_contacts enable row level security;alter table public.reservation_accommodations enable row level security;alter table public.reservation_nightly_prices enable row level security;alter table public.reservation_amendments enable row level security;alter table public.reservation_assignment_events enable row level security;alter table public.reservation_events enable row level security;alter table public.reservation_account_entries enable row level security;
do $$declare t text;begin foreach t in array array['rate_plans','rate_plan_versions','rate_plan_version_room_types','reservation_contacts','reservation_accommodations','reservation_nightly_prices','reservation_amendments','reservation_assignment_events','reservation_events','reservation_account_entries'] loop execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end$$;
revoke all on function public.list_rate_plans(uuid),public.save_rate_plan(uuid,uuid,jsonb),public.version_rate_plan(uuid,uuid,uuid,jsonb),public.act_rate_plan_version(uuid,uuid,uuid,text),public.get_reservation_operations(uuid,uuid),public.simulate_reservation_amendment(uuid,uuid,jsonb),public.apply_reservation_amendment(uuid,uuid,uuid,jsonb,boolean),public.record_reservation_guarantee(uuid,uuid,uuid,jsonb,boolean),public.act_reservation(uuid,uuid,uuid,jsonb),public.simulate_room_assignment(uuid,uuid,jsonb),public.assign_reservation_room(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.list_rate_plans(uuid),public.save_rate_plan(uuid,uuid,jsonb),public.version_rate_plan(uuid,uuid,uuid,jsonb),public.act_rate_plan_version(uuid,uuid,uuid,text),public.get_reservation_operations(uuid,uuid),public.simulate_reservation_amendment(uuid,uuid,jsonb),public.apply_reservation_amendment(uuid,uuid,uuid,jsonb,boolean),public.record_reservation_guarantee(uuid,uuid,uuid,jsonb,boolean),public.act_reservation(uuid,uuid,uuid,jsonb),public.simulate_room_assignment(uuid,uuid,jsonb),public.assign_reservation_room(uuid,uuid,uuid,jsonb),public.initialize_default_rate_plan_for_hotel(),public.attach_room_type_to_default_rate_plan() to service_role;
