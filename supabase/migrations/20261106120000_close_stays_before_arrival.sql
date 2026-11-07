-- QA-080 e QA-081: cancelamento e no-show mudavam só a estadia, ou só a reserva, e deixavam o resto para
-- trás. Agora uma regra única encerra estadia, acomodação e reserva, tira a hospedagem da conta, cobra a
-- multa do plano e separa o que deve ser devolvido ou recebido.
--
-- Multa: no cancelamento, só depois do prazo limite do plano; no no-show, sempre. Reserva sem plano,
-- como a criada pelo calendário, não tem multa. O prazo limite conta até o início da janela de check-in
-- do hotel. A conta da estadia com pagamento ou consumo precisa ser acertada antes: devolver esse
-- dinheiro é decisão de quem opera a conta, não um efeito colateral do cancelamento.

alter table public.reservation_account_entries drop constraint reservation_account_entries_kind_check;
alter table public.reservation_account_entries add constraint reservation_account_entries_kind_check
  check (kind = any (array['guarantee','penalty','refund_credit','stay_transfer','adjustment','refund','penalty_payment']));

create or replace function public.reservation_closure_penalty(p_accommodation_id uuid,p_action text,p_at timestamptz)
returns numeric language sql stable set search_path to 'public' as $function$
 select coalesce((select round(case
   when p_action='cancel' and p_at<((a.checkin_date+coalesce(h.checkin_time_start,time '00:00')) at time zone h.timezone)-make_interval(hours=>v.cancellation_cutoff_hours) then 0
   when v.cancellation_type='fixed' then v.cancellation_value
   when v.cancellation_type='percentage' then a.total_price*v.cancellation_value/100
   when v.cancellation_type='first_night' then (select n.final_amount from public.reservation_nightly_prices n where n.accommodation_id=a.id order by n.stay_date limit 1)
   when v.cancellation_type='full_stay' then a.total_price
   else 0 end,2)
  from public.reservation_accommodations a join public.hotels h on h.id=a.hotel_id
  left join public.rate_plan_versions v on v.id=a.rate_plan_version_id
  where a.id=p_accommodation_id),0)
$function$;

-- Positivo: o hotel deve devolver. Negativo: o hóspede ainda deve a multa. O lançamento refund_credit só
-- marca a pendência de devolução e fica fora da conta.
create or replace function public.reservation_closure_balance(p_reservation_id uuid)
returns numeric language sql stable set search_path to 'public' as $function$
 select coalesce(sum(case when kind in('guarantee','penalty_payment') then amount when kind in('stay_transfer','penalty','refund') then -amount else 0 end),0)
 from public.reservation_account_entries where reservation_id=p_reservation_id
$function$;

create or replace function public.stay_closure_preview(p_hotel_id uuid,p_stay_id uuid)
returns jsonb language sql stable set search_path to 'public' as $function$
 select jsonb_build_object(
  'cancel_penalty',coalesce(sum(public.reservation_closure_penalty(a.id,'cancel',public.hotel_operational_now(p_hotel_id))),0),
  'no_show_penalty',coalesce(sum(public.reservation_closure_penalty(a.id,'no_show',public.hotel_operational_now(p_hotel_id))),0),
  'balance',public.reservation_closure_balance(s.reservation_id))
 from public.stays s join public.reservations r on r.id=s.reservation_id and r.hotel_id=p_hotel_id
 left join public.reservation_accommodations a on a.stay_id=s.id and a.status in('held','confirmed','assigned')
 where s.id=p_stay_id group by s.reservation_id
$function$;

-- Encerra uma estadia e sua acomodação e devolve a multa. Levanta open_account sem alterar nada.
create or replace function public.close_reservation_stay_part(p_hotel_id uuid,p_reservation_id uuid,p_stay_id uuid,p_action text,p_actor_id uuid,p_reason text,p_at timestamptz)
returns numeric language plpgsql set search_path to 'public' as $function$
declare v_lodging numeric;v_penalty numeric;v_currency text;
begin
 if (select coalesce(sum(case direction when 'debit' then amount else -amount end),0) from public.stay_folio_entries where stay_id=p_stay_id and kind in('payment','refund'))<>0
   or (select coalesce(sum(case direction when 'debit' then amount else -amount end),0) from public.stay_folio_entries where stay_id=p_stay_id and kind in('consumption_charge','maintenance_charge'))<>0
then raise exception using errcode='P0001',message='open_account';end if;
 select coalesce(sum(case direction when 'debit' then amount else -amount end),0) into v_lodging from public.stay_folio_entries where stay_id=p_stay_id and kind in('lodging','adjustment');
 select currency into v_currency from public.hotels where id=p_hotel_id;
 if v_lodging>0 then
  insert into public.stay_folio_entries(hotel_id,stay_id,reservation_id,direction,kind,amount,currency,description,source_key,posted_by,posted_at)
  values(p_hotel_id,p_stay_id,p_reservation_id,'credit','adjustment',v_lodging,v_currency,case when p_action='no_show' then 'Hospedagem retirada: no-show' else 'Hospedagem retirada: cancelamento' end,'stay-closure:'||p_stay_id::text,p_actor_id,p_at);
 end if;
 select coalesce(sum(public.reservation_closure_penalty(a.id,p_action,p_at)),0) into v_penalty from public.reservation_accommodations a where a.stay_id=p_stay_id and a.status in('held','confirmed','assigned');
 update public.reservation_accommodations set status=case when p_action='no_show' then 'no_show' else 'canceled' end,hold_expires_at=null,version=version+1,updated_at=now() where stay_id=p_stay_id and status in('held','confirmed','assigned');
 update public.stays set stay_status=(case when p_action='no_show' then 'no_show' else 'canceled' end)::public.stay_status,updated_at=now() where id=p_stay_id;
 return v_penalty;
end $function$;

create or replace function public.finish_reservation_closure(p_hotel_id uuid,p_reservation_id uuid,p_action text,p_actor_id uuid,p_reason text,p_penalty numeric,p_units integer)
returns jsonb language plpgsql set search_path to 'public' as $function$
declare v_currency text;v_balance numeric;v_credit numeric:=0;v_active boolean;v_arrived boolean;
begin
 select currency into v_currency from public.hotels where id=p_hotel_id;
 if p_penalty>0 then insert into public.reservation_account_entries(hotel_id,reservation_id,direction,kind,amount,currency,reference,actor_id) values(p_hotel_id,p_reservation_id,'debit','penalty',p_penalty,v_currency,p_reason,p_actor_id);end if;
 v_active:=exists(select 1 from public.stays where reservation_id=p_reservation_id and stay_status in('confirmed','checked_in')) or exists(select 1 from public.reservation_accommodations where reservation_id=p_reservation_id and status in('held','confirmed','assigned','checked_in'));
 v_arrived:=exists(select 1 from public.stays where reservation_id=p_reservation_id and stay_status in('checked_in','checked_out'));
 v_balance:=public.reservation_closure_balance(p_reservation_id);
 if not v_active then
  -- O adiantamento continua valendo enquanto houver outra estadia na reserva.
  if v_balance>0 then
   v_credit:=v_balance;
   insert into public.reservation_account_entries(hotel_id,reservation_id,direction,kind,amount,currency,reference,actor_id) values(p_hotel_id,p_reservation_id,'debit','refund_credit',v_credit,v_currency,'Crédito reembolsável pendente: '||p_reason,p_actor_id);
  end if;
 end if;
 update public.reservations set lifecycle_status=case when v_active or v_arrived then lifecycle_status when p_action='no_show' then 'no_show' else 'canceled' end,hold_expires_at=null,version=version+1,updated_at=now() where id=p_reservation_id;
 insert into public.reservation_events(hotel_id,reservation_id,action,actor_id,details) values(p_hotel_id,p_reservation_id,p_action,p_actor_id,jsonb_build_object('reason',p_reason,'penalty',p_penalty,'refundable_credit',v_credit,'units',p_units,'business_date',public.hotel_operational_date(p_hotel_id)));
 return jsonb_build_object('result','ok','id',p_reservation_id,'penalty',p_penalty,'refundable_credit',v_credit,'balance',v_balance);
end $function$;

create or replace function public.close_stay_before_arrival(p_hotel_id uuid,p_stay_id uuid,p_actor_id uuid,p_action text,p_reason text)
returns jsonb language plpgsql set search_path to 'public' as $function$
declare v_reservation uuid;v_status text;v_reason text:=btrim(coalesce(p_reason,''));v_penalty numeric;
begin
 if p_action not in('cancel','no_show') or length(v_reason)<3 then return jsonb_build_object('result','invalid');end if;
 select s.reservation_id into v_reservation from public.stays s join public.reservations r on r.id=s.reservation_id and r.hotel_id=p_hotel_id where s.id=p_stay_id;
 if not found then return jsonb_build_object('result','not_found');end if;
 perform 1 from public.reservations where id=v_reservation for update;
 select stay_status::text into v_status from public.stays where id=p_stay_id for update;
 if v_status<>'confirmed' then return jsonb_build_object('result','invalid_status');end if;
 begin
  v_penalty:=public.close_reservation_stay_part(p_hotel_id,v_reservation,p_stay_id,p_action,p_actor_id,v_reason,public.hotel_operational_now(p_hotel_id));
 exception when raise_exception then
  if sqlerrm='open_account' then return jsonb_build_object('result','open_account');end if;
  raise;
 end;
 return public.finish_reservation_closure(p_hotel_id,v_reservation,p_action,p_actor_id,v_reason,v_penalty,1);
end $function$;

create or replace function public.act_reservation(p_hotel_id uuid,p_reservation_id uuid,p_actor_id uuid,p_input jsonb)
returns jsonb language plpgsql set search_path to 'public' as $function$
declare r public.reservations;v_action text:=p_input->>'action';v_reason text:=btrim(coalesce(p_input->>'reason',''));v_at timestamptz;v_penalty numeric:=0;v_units integer:=0;v_stay uuid;v_part numeric;
begin
 select * into r from public.reservations where id=p_reservation_id and hotel_id=p_hotel_id for update;if not found then return jsonb_build_object('result','not_found');end if;
 if r.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict','context',to_jsonb(r));end if;
 if v_action not in('cancel','no_show') or length(v_reason)<3 then return jsonb_build_object('result','invalid');end if;
 if v_action='cancel' and r.lifecycle_status not in('hold','confirmed') then return jsonb_build_object('result','invalid_status');end if;
 if v_action='no_show' and r.lifecycle_status<>'confirmed' then return jsonb_build_object('result','invalid_status');end if;
 v_at:=public.hotel_operational_now(p_hotel_id);
 begin
  for v_stay in select id from public.stays where reservation_id=p_reservation_id and stay_status='confirmed' for update loop
   v_part:=public.close_reservation_stay_part(p_hotel_id,p_reservation_id,v_stay,v_action,p_actor_id,v_reason,v_at);
   v_penalty:=v_penalty+v_part;v_units:=v_units+1;
  end loop;
 exception when raise_exception then
  if sqlerrm='open_account' then return jsonb_build_object('result','open_account');end if;
  raise;
 end;
 -- Acomodação ainda sem quarto não tem estadia.
 select v_penalty+coalesce(sum(public.reservation_closure_penalty(a.id,v_action,v_at)),0),v_units+count(*) into v_penalty,v_units from public.reservation_accommodations a where a.reservation_id=p_reservation_id and a.status in('held','confirmed','assigned');
 update public.reservation_accommodations set status=case when v_action='no_show' then 'no_show' else 'canceled' end,hold_expires_at=null,version=version+1,updated_at=now() where reservation_id=p_reservation_id and status in('held','confirmed','assigned');
 return public.finish_reservation_closure(p_hotel_id,p_reservation_id,v_action,p_actor_id,v_reason,v_penalty,greatest(v_units,1));
end $function$;

-- Devolve o crédito ou recebe a multa de uma reserva encerrada. O sentido vem do saldo, não do pedido.
create or replace function public.settle_closed_reservation(p_hotel_id uuid,p_reservation_id uuid,p_actor_id uuid,p_input jsonb)
returns jsonb language plpgsql set search_path to 'public' as $function$
declare r public.reservations;v_key uuid:=(p_input->>'idempotency_key')::uuid;v_amount numeric:=(p_input->>'amount')::numeric;v_method text:=p_input->>'method';v_session uuid:=nullif(p_input->>'cash_session_id','')::uuid;v_reference text:=nullif(btrim(coalesce(p_input->>'reference','')),'');v_balance numeric;v_kind text;v_existing record;v_entry uuid;v_currency text;
begin
 select * into r from public.reservations where id=p_reservation_id and hotel_id=p_hotel_id for update;if not found then return jsonb_build_object('result','not_found');end if;
 select kind,amount,reservation_id into v_existing from public.reservation_account_entries where hotel_id=p_hotel_id and idempotency_key=v_key;
 if found then
  if v_existing.reservation_id=p_reservation_id and v_existing.amount=v_amount and v_existing.kind in('refund','penalty_payment') then return jsonb_build_object('result','ok','id',p_reservation_id,'kind',v_existing.kind,'balance',public.reservation_closure_balance(p_reservation_id));end if;
  return jsonb_build_object('result','idempotency_conflict');
 end if;
 if exists(select 1 from public.stays where reservation_id=p_reservation_id and stay_status in('confirmed','checked_in')) or exists(select 1 from public.reservation_accommodations where reservation_id=p_reservation_id and status in('held','confirmed','assigned','checked_in')) then return jsonb_build_object('result','invalid_status');end if;
 v_balance:=public.reservation_closure_balance(p_reservation_id);
 if v_balance=0 then return jsonb_build_object('result','nothing_to_settle');end if;
 if v_amount is null or v_amount<=0 then return jsonb_build_object('result','invalid');end if;
 if v_amount>abs(v_balance) then return jsonb_build_object('result','amount_exceeds_balance','balance',v_balance);end if;
 if coalesce(v_method,'') not in('pix','cash','credit_card','debit_card','bank_transfer') then return jsonb_build_object('result','invalid_tender');end if;
 if v_method='cash' and not exists(select 1 from public.cash_sessions where id=v_session and hotel_id=p_hotel_id and operator_id=p_actor_id and status='open') then return jsonb_build_object('result','invalid_cash_session');end if;
 v_kind:=case when v_balance>0 then 'refund' else 'penalty_payment' end;
 select currency into v_currency from public.hotels where id=p_hotel_id;
 insert into public.reservation_account_entries(hotel_id,reservation_id,direction,kind,amount,currency,payment_method,reference,cash_session_id,idempotency_key,actor_id)
 values(p_hotel_id,p_reservation_id,case when v_kind='refund' then 'debit' else 'credit' end,v_kind,v_amount,v_currency,v_method,v_reference,case when v_method='cash' then v_session end,v_key,p_actor_id) returning id into v_entry;
 insert into public.financial_transactions(hotel_id,reservation_id,type,category,amount,currency,payment_method,status,description,paid_at,created_by,reference_code,cash_session_id)
 values(p_hotel_id,p_reservation_id,(case when v_kind='refund' then 'REFUND' else 'INCOME' end)::public.transaction_type,case when v_kind='refund' then 'RESERVATION_REFUND' else 'RESERVATION_PENALTY' end,v_amount,v_currency,v_method,'COMPLETED',case when v_kind='refund' then 'Devolução do crédito da reserva' else 'Multa da reserva' end,public.hotel_operational_now(p_hotel_id),p_actor_id,v_reference,case when v_method='cash' then v_session end);
 v_balance:=public.reservation_closure_balance(p_reservation_id);
 if v_balance<=0 then update public.reservation_account_entries set reversed_entry_id=v_entry where reservation_id=p_reservation_id and kind='refund_credit' and reversed_entry_id is null;end if;
 insert into public.reservation_events(hotel_id,reservation_id,action,actor_id,details) values(p_hotel_id,p_reservation_id,v_kind,p_actor_id,jsonb_build_object('amount',v_amount,'method',v_method,'business_date',public.hotel_operational_date(p_hotel_id)));
 return jsonb_build_object('result','ok','id',p_reservation_id,'kind',v_kind,'balance',v_balance);
end $function$;

-- Os indicadores contam a ação no dia do hotel, inclusive reserva sem acomodação. Pré-reserva vencida não é
-- cancelamento de hóspede.
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
   'cancellations',(select coalesce(sum((e.details->>'units')::integer),0) from public.reservation_events e where e.hotel_id=p_hotel_id and e.action='cancel' and e.details->>'business_date'=d::text),
   'no_shows',(select coalesce(sum((e.details->>'units')::integer),0) from public.reservation_events e where e.hotel_id=p_hotel_id and e.action='no_show' and e.details->>'business_date'=d::text)
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
end$function$
;

-- A devolução é registrada no painel da estadia; a pré-chegada não tem essa ação.
CREATE OR REPLACE FUNCTION public.operational_pending_candidates_before_training(p_hotel_id uuid, p_now timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
  'href',coalesce('/dashboard/reservations/view?stay_id='||(select s.id::text from public.stays s where s.reservation_id=e.reservation_id order by s.checkin_date_expected desc limit 1),'/dashboard/reservations/prearrival'),'severity','warning'))
  from public.reservation_account_entries e where e.hotel_id=p_hotel_id and e.kind='refund_credit' and e.reversed_entry_id is null),'[]');
 v:=v||coalesce((select jsonb_agg(jsonb_build_object(
  'source','booking_channels','source_key','booking-channel:event:'||e.id,
  'kind',case when e.reason='mapping_missing' then 'channel_mapping_missing' else 'channel_inventory_conflict' end,
  'entity_type','booking_channel_event','entity_id',e.id,
  'title',case when e.reason='mapping_missing' then 'Evento de canal sem mapeamento' else 'Reserva externa em conflito' end,
  'href','/dashboard/reservations/channels','severity','critical'))
  from public.booking_channel_events e where e.hotel_id=p_hotel_id and e.status='needs_review'),'[]');
 return v;
end$function$
;
