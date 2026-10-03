-- Jornada de chegada: contexto comercial, pré-chegada e crédito transacional.

create or replace function public.reservation_arrival_summary(p_hotel_id uuid,p_reservation_id uuid)
returns jsonb language sql stable set search_path=public as $$
 select jsonb_build_object(
 'version',r.version,'guest_count',r.guest_count,
 'accommodations',coalesce((select jsonb_agg(jsonb_build_object(
 'id',a.id,'room_type',a.room_type,'adults',a.adults,'children',a.children,
 'checkin_date',a.checkin_date,'checkout_date',a.checkout_date,
 'nights',coalesce((select jsonb_agg(jsonb_build_object('date',n.stay_date,'amount',n.final_amount) order by n.stay_date) from public.reservation_nightly_prices n where n.accommodation_id=a.id),'[]'),
 'guarantee_type',v.guarantee_type)
 order by a.checkin_date,a.id) from public.reservation_accommodations a
 left join public.rate_plan_versions v on v.id=a.rate_plan_version_id where a.reservation_id=r.id),'[]'),
 'guarantee_required',coalesce((select max(case v.guarantee_type when 'fixed' then v.guarantee_value when 'percentage' then a.total_price*v.guarantee_value/100 when 'first_night' then (select n.final_amount from public.reservation_nightly_prices n where n.accommodation_id=a.id order by n.stay_date limit 1) else 0 end) from public.reservation_accommodations a join public.rate_plan_versions v on v.id=a.rate_plan_version_id where a.reservation_id=r.id),0),
 'guarantee_received',coalesce((select sum(amount) from public.reservation_account_entries where reservation_id=r.id and kind='guarantee' and direction='credit'),0),
 'guests',coalesce((select jsonb_agg(jsonb_build_object('role',g.role,'full_name',g.full_name,'accommodation_id',g.accommodation_id) order by g.role,g.full_name) from public.reservation_guests g where g.reservation_id=r.id),'[]'),
 'submission',(select jsonb_build_object('version',s.version,'arrival_time',s.arrival_time,'submitted_at',s.submitted_at) from public.prearrival_submissions s where s.reservation_id=r.id order by s.version desc limit 1))
 from public.reservations r where r.id=p_reservation_id and r.hotel_id=p_hotel_id
$$;
revoke all on function public.reservation_arrival_summary(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reservation_arrival_summary(uuid,uuid) to service_role;

create or replace function public.get_reservation_operations(p_hotel_id uuid,p_reservation_id uuid) returns jsonb language sql stable set search_path=public as $$
 select jsonb_build_object('arrival',public.reservation_arrival_summary(p_hotel_id,r.id),'reservation',to_jsonb(r),'contact',(select to_jsonb(c) from public.reservation_contacts c where c.reservation_id=r.id),'accommodations',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('nights',(select jsonb_agg(to_jsonb(n) order by n.stay_date) from public.reservation_nightly_prices n where n.accommodation_id=a.id)) order by a.checkin_date) from public.reservation_accommodations a where a.reservation_id=r.id),'[]'::jsonb),'account_entries',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from public.reservation_account_entries e where e.reservation_id=r.id),'[]'::jsonb),'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from public.reservation_events e where e.reservation_id=r.id),'[]'::jsonb)) from public.reservations r where r.id=p_reservation_id and r.hotel_id=p_hotel_id $$;
create or replace function public.submit_prearrival(p_token text,p_input jsonb) returns jsonb language plpgsql security definer set search_path=public,extensions as $$declare t public.prearrival_access_tokens;r public.reservations;v_version integer;g jsonb;q jsonb;begin
 select * into t from public.prearrival_access_tokens where token_hash=encode(digest(p_token,'sha256'),'hex') and revoked_at is null and expires_at>now() for update;if not found then return jsonb_build_object('result','invalid_access');end if;select * into r from public.reservations where id=t.reservation_id for update;
 if r.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict','context',jsonb_build_object('reservation_version',r.version));end if;
 if exists(select 1 from jsonb_array_elements(coalesce(p_input->'companions','[]')) candidate(value) where not exists(select 1 from public.reservation_accommodations a where a.id=(candidate.value->>'accommodation_id')::uuid and a.reservation_id=r.id and a.hotel_id=r.hotel_id)) then return jsonb_build_object('result','invalid_accommodation');end if;
 if (case when p_input?'companions' then jsonb_array_length(p_input->'companions') else (select count(*) from public.reservation_guests where reservation_id=r.id and role='companion') end)+ (case when p_input?'primary_guest' or exists(select 1 from public.reservation_guests where reservation_id=r.id and role='primary') then 1 else 0 end)>r.guest_count then return jsonb_build_object('result','invalid_guest_count');end if;
 if p_input?'primary_guest' then delete from public.reservation_guests where reservation_id=r.id and role='primary';end if;
 if p_input?'companions' then delete from public.reservation_guests where reservation_id=r.id and role='companion';end if;
 select coalesce(max(version),0)+1 into v_version from public.prearrival_submissions where reservation_id=r.id;insert into public.prearrival_submissions(hotel_id,reservation_id,version,reservation_version,arrival_time,payload) values(r.hotel_id,r.id,v_version,r.version,nullif(p_input->>'arrival_time','')::time,p_input);
 if p_input?'primary_guest' then insert into public.reservation_guests(hotel_id,reservation_id,role,full_name,document_type,document_number,birth_date) values(r.hotel_id,r.id,'primary',p_input->'primary_guest'->>'full_name',p_input->'primary_guest'->>'document_type',p_input->'primary_guest'->>'document_number',(p_input->'primary_guest'->>'birth_date')::date) on conflict do nothing;end if;
 for g in select * from jsonb_array_elements(coalesce(p_input->'companions','[]')) loop insert into public.reservation_guests(hotel_id,reservation_id,accommodation_id,role,full_name,document_type,document_number,birth_date) values(r.hotel_id,r.id,(g->>'accommodation_id')::uuid,'companion',g->>'full_name',nullif(g->>'document_type',''),nullif(g->>'document_number',''),nullif(g->>'birth_date','')::date);end loop;
 for q in select * from jsonb_array_elements(coalesce(p_input->'requests','[]')) loop insert into public.prearrival_requests(hotel_id,reservation_id,accommodation_id,type,category,description,due_at) values(r.hotel_id,r.id,nullif(q->>'accommodation_id','')::uuid,'special',q->>'category',trim(q->>'description'),(select min(checkin_date)::timestamptz from public.reservation_accommodations where reservation_id=r.id));end loop;
 update public.prearrival_access_tokens set last_used_at=now() where id=t.id;return jsonb_build_object('result','ok','version',v_version);end$$;
create or replace function public.list_prearrival_board(p_hotel_id uuid) returns jsonb language sql stable set search_path=public as $$select jsonb_build_object('requests',coalesce((select jsonb_agg(to_jsonb(q)||jsonb_build_object('reservation_code',r.reservation_code,'arrival',(select min(checkin_date) from public.reservation_accommodations where reservation_id=r.id)) order by q.due_at nulls last) from public.prearrival_requests q join public.reservations r on r.id=q.reservation_id where q.hotel_id=p_hotel_id and q.status not in('resolved','rejected','canceled')),'[]'),'unassigned_arrivals',coalesce((select jsonb_agg(jsonb_build_object('reservation_id',a.reservation_id,'accommodation_id',a.id,'room_type',a.room_type,'arrival',a.checkin_date,'adults',a.adults,'children',a.children) order by a.checkin_date) from public.reservation_accommodations a where a.hotel_id=p_hotel_id and a.status='confirmed' and a.assigned_room_id is null and a.checkin_date<=public.hotel_operational_date(p_hotel_id)+1),'[]'))$$;
create or replace function public.checkin_stay_with_readiness(p_hotel_id uuid,p_stay_id uuid,p_actor_id uuid,p_expected_version integer default null,p_override_reason text default null,p_allow_override boolean default false)
returns jsonb language plpgsql set search_path=public as $$
declare v_stay record; v_state jsonb; v_cycle uuid; v_now timestamptz; v_hotel public.hotels; v_entry record; v_credit uuid; v_payer uuid; v_amount numeric;
begin
  select s.* into v_stay from public.stays s join public.reservations r on r.id=s.reservation_id and r.hotel_id=p_hotel_id where s.id=p_stay_id for update of s;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if v_stay.stay_status<>'confirmed' then return jsonb_build_object('result','invalid_state'); end if;
  select * into v_hotel from public.hotels where id=p_hotel_id;
  v_now:=public.hotel_operational_now(p_hotel_id);
  if (v_now at time zone v_hotel.timezone)::date<>(v_stay.checkin_date_expected at time zone v_hotel.timezone)::date then return jsonb_build_object('result','outside_checkin_date');end if;
  if v_hotel.checkin_time_start is null or v_hotel.checkin_time_limit is null then return jsonb_build_object('result','checkin_window_missing');end if;
  if not(case when v_hotel.checkin_time_start<=v_hotel.checkin_time_limit then (date_trunc('minute',v_now) at time zone v_hotel.timezone)::time between v_hotel.checkin_time_start and v_hotel.checkin_time_limit else (date_trunc('minute',v_now) at time zone v_hotel.timezone)::time>=v_hotel.checkin_time_start or (date_trunc('minute',v_now) at time zone v_hotel.timezone)::time<=v_hotel.checkin_time_limit end) then return jsonb_build_object('result','outside_checkin_window');end if;
  perform 1 from public.reservations where id=v_stay.reservation_id for update;
  v_state:=public.governance_room_state(p_hotel_id,v_stay.room_id,v_now);
  if v_state->>'readiness'='blocked' then return jsonb_build_object('result','maintenance_blocked','state',v_state); end if;
  if v_state->>'readiness'='not_ready' then
    if p_expected_version is null or p_expected_version<>coalesce((v_state->>'cycle_version')::integer,0) then return jsonb_build_object('result','conflict','state',v_state); end if;
    if not p_allow_override or nullif(btrim(p_override_reason),'') is null then return jsonb_build_object('result','room_not_ready','state',v_state); end if;
    v_cycle:=(v_state->>'cycle_id')::uuid;
    update public.governance_tasks set status='canceled',assigned_to=null,completed_at=null,version=version+1,updated_at=now() where cycle_id=v_cycle and status not in ('completed','canceled');
    update public.governance_cycles set status='released',released_at=v_now,released_by=p_actor_id,release_reason=btrim(p_override_reason),version=version+1,updated_at=now() where id=v_cycle;
    insert into public.governance_events(hotel_id,cycle_id,actor_id,action,message,metadata) values(p_hotel_id,v_cycle,p_actor_id,'readiness_override',btrim(p_override_reason),jsonb_build_object('state',v_state));
  end if;
  update public.stays set stay_status='checked_in',checkin_date_actual=v_now,operational_version=operational_version+1 where id=p_stay_id;

  update public.reservation_accommodations set status='checked_in',version=version+1,updated_at=now() where stay_id=p_stay_id and hotel_id=p_hotel_id;
  update public.reservations set lifecycle_status='in_house',version=version+1,updated_at=now() where id=v_stay.reservation_id;
  select id into v_payer from public.stay_payer_accounts where stay_id=p_stay_id and kind='primary_guest';
  -- Consome o saldo uma única vez, distribuindo por estadias em ordem de chegada.
  for v_entry in select e.* from public.reservation_account_entries e where e.reservation_id=v_stay.reservation_id and e.direction='credit' and e.kind='guarantee' order by e.created_at,e.id loop
    select v_entry.amount-coalesce(sum(amount),0) into v_amount from public.reservation_account_entries where reversed_entry_id=v_entry.id and kind='stay_transfer';
    v_amount:=least(v_amount,greatest(v_stay.total_price_estimated-(select coalesce(sum(case when direction='credit' then amount else -amount end),0) from public.stay_folio_entries where stay_id=p_stay_id and kind in('payment','refund','adjustment')),0));
    if v_amount>0 then
      insert into public.reservation_account_entries(hotel_id,reservation_id,direction,kind,amount,currency,reference,reversed_entry_id,actor_id)
      values(p_hotel_id,v_stay.reservation_id,'debit','stay_transfer',v_amount,v_entry.currency,p_stay_id::text,v_entry.id,p_actor_id);
      insert into public.stay_folio_entries(hotel_id,stay_id,reservation_id,direction,kind,amount,currency,description,source_key,posted_by,posted_at)
      values(p_hotel_id,p_stay_id,v_stay.reservation_id,'credit','adjustment',v_amount,v_entry.currency,'Sinal da reserva transferido na chegada','reservation-guarantee:'||v_entry.id||':'||p_stay_id,p_actor_id,v_now) returning id into v_credit;
      perform public.allocate_stay_account_credit(p_hotel_id,p_stay_id,v_credit,p_actor_id);
      if v_payer is not null then
        insert into public.stay_payer_credits(hotel_id,stay_id,payer_account_id,folio_credit_entry_id,amount,reason) values(p_hotel_id,p_stay_id,v_payer,v_credit,v_amount,'Sinal da reserva');
      end if;
    end if;
  end loop;
  update public.stays set total_paid=(select coalesce(sum(case when direction='credit' then amount else -amount end),0) from public.stay_folio_entries where stay_id=p_stay_id and kind in('payment','refund','adjustment')) where id=p_stay_id;
  insert into public.reservation_events(hotel_id,reservation_id,action,actor_id,details) values(p_hotel_id,v_stay.reservation_id,'checked_in',p_actor_id,jsonb_build_object('stay_id',p_stay_id,'operational_at',v_now));
  return jsonb_build_object('result','ok');
end $$;

create or replace function public.record_reservation_guarantee(p_hotel_id uuid,p_reservation_id uuid,p_actor_id uuid,p_input jsonb,p_can_waive boolean default false) returns jsonb language plpgsql set search_path=public as $$declare r public.reservations;v_total numeric:=0;v_required numeric:=0;v_t jsonb;v_key uuid:=(p_input->>'idempotency_key')::uuid;begin
 select * into r from public.reservations where id=p_reservation_id and hotel_id=p_hotel_id for update;if not found then return jsonb_build_object('result','not_found');end if;if exists(select 1 from public.reservation_events where reservation_id=p_reservation_id and action='guarantee_confirmed' and details->>'idempotency_key'=v_key::text) then
 if not exists(select 1 from public.reservation_events where reservation_id=p_reservation_id and action='guarantee_confirmed' and details->>'idempotency_key'=v_key::text and details->>'fingerprint'=md5((p_input-'expected_version')::text)) then return jsonb_build_object('result','idempotency_conflict');end if;
 return jsonb_build_object('result','ok','id',p_reservation_id);end if;
 if r.lifecycle_status not in('hold','confirmed') then return jsonb_build_object('result','invalid_status');end if;
 if r.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict','context',to_jsonb(r));end if;
 if exists(select 1 from public.reservation_account_entries where hotel_id=p_hotel_id and idempotency_key=v_key) then return jsonb_build_object('result','idempotency_conflict');end if;
 select coalesce(max(case v.guarantee_type when 'fixed' then v.guarantee_value when 'percentage' then a.total_price*v.guarantee_value/100 when 'first_night' then (select final_amount from public.reservation_nightly_prices where accommodation_id=a.id order by stay_date limit 1) else 0 end),0) into v_required from public.reservation_accommodations a left join public.rate_plan_versions v on v.id=a.rate_plan_version_id where a.reservation_id=p_reservation_id;
 for v_t in select * from jsonb_array_elements(coalesce(p_input->'tenders','[]')) loop
 if (v_t->>'amount')::numeric<=0 or v_t->>'method' not in('pix','cash','credit_card','debit_card','bank_transfer') then return jsonb_build_object('result','invalid_tender');end if;
 if v_t->>'method'='cash' and not exists(select 1 from public.cash_sessions where id=nullif(v_t->>'cash_session_id','')::uuid and hotel_id=p_hotel_id and operator_id=p_actor_id and status='open') then return jsonb_build_object('result','invalid_cash_session');end if;
 end loop;
 for v_t in select * from jsonb_array_elements(coalesce(p_input->'tenders','[]')) loop
 if (v_t->>'amount')::numeric<=0 or v_t->>'method' not in('pix','cash','credit_card','debit_card','bank_transfer') then return jsonb_build_object('result','invalid_tender');end if;
 if v_t->>'method'='cash' and nullif(v_t->>'cash_session_id','') is null then return jsonb_build_object('result','invalid_cash_session');end if;
 v_total=v_total+(v_t->>'amount')::numeric;insert into public.reservation_account_entries(hotel_id,reservation_id,direction,kind,amount,currency,payment_method,reference,cash_session_id,idempotency_key,actor_id) values(p_hotel_id,p_reservation_id,'credit','guarantee',(v_t->>'amount')::numeric,coalesce((select currency from public.hotels where id=p_hotel_id),'BRL'),v_t->>'method',v_t->>'reference',nullif(v_t->>'cash_session_id','')::uuid,case when jsonb_array_length(p_input->'tenders')=1 then v_key else gen_random_uuid() end,p_actor_id);insert into public.financial_transactions(hotel_id,reservation_id,type,category,amount,currency,payment_method,status,description,paid_at,created_by,reference_code,cash_session_id)
 values(p_hotel_id,p_reservation_id,'INCOME','RESERVATION_GUARANTEE',(v_t->>'amount')::numeric,(select currency from public.hotels where id=p_hotel_id),v_t->>'method','COMPLETED','Sinal da reserva',public.hotel_operational_now(p_hotel_id),p_actor_id,v_t->>'reference',case when v_t->>'method'='cash' then nullif(v_t->>'cash_session_id','')::uuid else null end);
 end loop;
 if v_total+(select coalesce(sum(amount),0) from public.reservation_account_entries where reservation_id=p_reservation_id and direction='credit' and kind='guarantee')-v_total<v_required and not(coalesce((p_input->>'waive')::boolean,false) and p_can_waive and length(trim(p_input->>'reason'))>=3) then raise exception using errcode='P0001',message='insufficient_guarantee';end if;
 update public.reservations set lifecycle_status='confirmed',hold_expires_at=null,version=version+1,updated_at=now() where id=p_reservation_id;update public.reservation_accommodations set status=case when assigned_room_id is null then 'confirmed' else 'assigned' end,hold_expires_at=null,version=version+1 where reservation_id=p_reservation_id and status='held';insert into public.reservation_events(hotel_id,reservation_id,action,actor_id,details) values(p_hotel_id,p_reservation_id,'guarantee_confirmed',p_actor_id,jsonb_build_object('idempotency_key',v_key,'fingerprint',md5((p_input-'expected_version')::text),'paid',v_total,'required',v_required,'waived',coalesce((p_input->>'waive')::boolean,false),'reason',p_input->>'reason'));return jsonb_build_object('result','ok','id',p_reservation_id,'paid',v_total,'required',v_required);exception when raise_exception then return jsonb_build_object('result','insufficient_guarantee','context',jsonb_build_object('paid',v_total,'required',v_required));end$$;

-- Recebimentos originados no sinal exigem operações compensatórias.
create or replace function public.protect_generated_financial_transaction()
returns trigger language plpgsql as $$
begin
  if (old.reservation_id is not null and old.category='RESERVATION_GUARANTEE') or old.maintenance_cost_item_id is not null or old.maintenance_recovery_id is not null
    or old.partner_settlement_id is not null
    or exists (select 1 from public.stay_folio_entries where financial_transaction_id = old.id) then
    raise exception 'generated financial transactions require compensating operations' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
