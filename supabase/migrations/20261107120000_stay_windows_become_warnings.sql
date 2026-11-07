-- QA-087: a janela de entrada e saída vira aviso (decisão 0012). A saída vale a qualquer momento depois do
-- check-in e o check-in vale fora do horário no dia previsto, sempre com motivo registrado na estadia. O valor
-- das diárias não muda: a hospedagem já entra inteira na conta quando a estadia é criada.
alter table public.stays
  add column checkin_window_reason text check (char_length(checkin_window_reason) <= 1000),
  add column checkout_window_reason text check (char_length(checkout_window_reason) <= 1000);

comment on column public.stays.checkin_window_reason is 'Motivo do check-in fora do horário da janela do hotel.';
comment on column public.stays.checkout_window_reason is 'Motivo da saída fora da data ou do horário previstos.';

drop function public.checkout_stay_account_stage4(p_hotel_id uuid, p_stay_id uuid, p_actor_id uuid, p_expected_version bigint, p_tenders jsonb, p_idempotency_key uuid, p_occurrence_ids uuid[], p_maintenance_folio_entry_ids uuid[], p_note text);
drop function public.checkout_stay_account(p_hotel_id uuid, p_stay_id uuid, p_actor_id uuid, p_expected_version bigint, p_tenders jsonb, p_idempotency_key uuid, p_occurrence_ids uuid[], p_maintenance_folio_entry_ids uuid[], p_note text);
drop function public.checkin_stay_with_readiness(p_hotel_id uuid, p_stay_id uuid, p_actor_id uuid, p_expected_version integer, p_override_reason text, p_allow_override boolean);

CREATE OR REPLACE FUNCTION public.checkout_stay_account(p_hotel_id uuid, p_stay_id uuid, p_actor_id uuid, p_expected_version bigint, p_tenders jsonb, p_idempotency_key uuid, p_occurrence_ids uuid[] DEFAULT ARRAY[]::uuid[], p_maintenance_folio_entry_ids uuid[] DEFAULT ARRAY[]::uuid[], p_note text DEFAULT NULL::text, p_window_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_window_reason text := nullif(btrim(p_window_reason), '');
  v_stay record; v_existing record; v_due numeric(12,2); v_open_credit numeric(12,2); v_batch jsonb;
  v_fingerprint text; v_record_id uuid := gen_random_uuid(); v_snapshot jsonb; v_currency text;
  v_lodging numeric(12,2); v_consumption numeric(12,2); v_maintenance numeric(12,2); v_payments numeric(12,2);
  v_partner numeric(12,2); v_courtesy numeric(12,2); v_discount numeric(12,2); v_voided numeric(12,2);
begin
  v_fingerprint := md5(jsonb_build_object('stay', p_stay_id, 'version', p_expected_version, 'tenders', p_tenders,
    'occurrences', p_occurrence_ids, 'maintenance_entries', p_maintenance_folio_entry_ids,
    'note', nullif(btrim(p_note), ''), 'window_reason', v_window_reason)::text);
  select id, request_fingerprint into v_existing from public.stay_checkout_records
    where hotel_id = p_hotel_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_fingerprint = v_fingerprint then return jsonb_build_object('result', 'ok', 'checkout_record_id', v_existing.id, 'created', false); end if;
    return jsonb_build_object('result', 'idempotency_conflict');
  end if;
  if not public.maintenance_user_has_hotel_scope(p_actor_id, p_hotel_id) then return jsonb_build_object('result', 'actor_outside_hotel'); end if;
  select stay.*, reservation.hotel_id, reservation.reservation_code, hotel.currency,
    hotel.timezone, hotel.checkout_time_start, hotel.checkout_time_limit into v_stay
  from public.stays stay join public.reservations reservation on reservation.id = stay.reservation_id
  join public.hotels hotel on hotel.id = reservation.hotel_id
  where stay.id = p_stay_id and reservation.hotel_id = p_hotel_id for update of stay;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if v_stay.stay_status <> 'checked_in' then return jsonb_build_object('result', 'stay_not_checked_in'); end if;
  if v_stay.account_version <> p_expected_version then return jsonb_build_object('result', 'version_conflict'); end if;
  if v_stay.checkout_time_start is null or v_stay.checkout_time_limit is null
    then return jsonb_build_object('result', 'checkout_window_not_configured'); end if;
  -- QA-087: fora da data ou do horário previstos, a saída vale com motivo e mantém as diárias contratadas.
  if (public.hotel_operational_now(p_hotel_id) at time zone v_stay.timezone)::date <> v_stay.checkout_date_expected::date
    or (v_stay.checkout_time_start <= v_stay.checkout_time_limit and
      (public.hotel_operational_now(p_hotel_id) at time zone v_stay.timezone)::time not between v_stay.checkout_time_start and v_stay.checkout_time_limit)
    or (v_stay.checkout_time_start > v_stay.checkout_time_limit and
      (public.hotel_operational_now(p_hotel_id) at time zone v_stay.timezone)::time < v_stay.checkout_time_start and
      (public.hotel_operational_now(p_hotel_id) at time zone v_stay.timezone)::time > v_stay.checkout_time_limit)
  then
    if v_window_reason is null then return jsonb_build_object('result', 'checkout_reason_required'); end if;
  else
    v_window_reason := null;
  end if;
  if exists (select 1 from public.consumption_corrections where stay_id = p_stay_id and status in ('pending','approved','awaiting_refund','awaiting_partner_refund'))
    then return jsonb_build_object('result', 'pending_correction'); end if;
  select coalesce(sum(entry.amount - coalesce(allocated.amount, 0)), 0) into v_due
  from public.stay_folio_entries entry
  left join lateral (select sum(amount) amount from public.stay_folio_allocations where debit_entry_id = entry.id) allocated on true
  where entry.hotel_id = p_hotel_id and entry.stay_id = p_stay_id and entry.direction = 'debit'
    and entry.kind <> 'maintenance_charge' and entry.amount > coalesce(allocated.amount, 0);
  select coalesce(sum(entry.amount - coalesce(allocated.amount, 0)), 0) into v_open_credit
  from public.stay_folio_entries entry
  left join lateral (select sum(amount) amount from public.stay_folio_allocations where credit_entry_id = entry.id) allocated on true
  where entry.hotel_id = p_hotel_id and entry.stay_id = p_stay_id and entry.direction = 'credit'
    and entry.amount > coalesce(allocated.amount, 0);
  if v_open_credit > 0 then return jsonb_build_object('result', 'refundable_credit', 'amount', v_open_credit); end if;
  if v_due > 0 then
    if jsonb_typeof(p_tenders) <> 'array' or jsonb_array_length(p_tenders) = 0 then
      return jsonb_build_object('result', 'payment_required', 'amount', v_due); end if;
    v_batch := public.create_stay_payment_batch(p_hotel_id, p_stay_id, p_actor_id, p_tenders, p_idempotency_key,
      p_expected_version, 'checkout', p_note);
    if v_batch->>'result' <> 'ok' then return v_batch; end if;
  elsif jsonb_typeof(p_tenders) = 'array' and jsonb_array_length(p_tenders) > 0 then
    return jsonb_build_object('result', 'payment_exceeds_balance');
  end if;
  if exists (
    select 1 from public.stay_folio_entries entry
    left join lateral (select sum(amount) amount from public.stay_folio_allocations where debit_entry_id = entry.id) allocated on true
    where entry.hotel_id = p_hotel_id and entry.stay_id = p_stay_id and entry.direction = 'debit'
      and entry.kind = 'maintenance_charge' and entry.amount > coalesce(allocated.amount, 0)
      and not (entry.id = any(coalesce(p_maintenance_folio_entry_ids, array[]::uuid[])))
  ) then return jsonb_build_object('result', 'maintenance_acknowledgement_required'); end if;
  if exists (select 1 from unnest(coalesce(p_maintenance_folio_entry_ids, array[]::uuid[])) entry_id where not exists (
    select 1 from public.stay_folio_entries entry where entry.id = entry_id and entry.hotel_id = p_hotel_id
      and entry.stay_id = p_stay_id and entry.direction = 'debit' and entry.kind = 'maintenance_charge'
  )) then return jsonb_build_object('result', 'invalid_maintenance_acknowledgement'); end if;
  insert into public.maintenance_financial_checkout_acknowledgements(hotel_id, stay_id, folio_entry_id, acknowledged_by, note)
  select p_hotel_id, p_stay_id, entry.id, p_actor_id, nullif(btrim(p_note), '') from public.stay_folio_entries entry
  where entry.id = any(coalesce(p_maintenance_folio_entry_ids, array[]::uuid[])) on conflict (stay_id, folio_entry_id) do nothing;
  insert into public.maintenance_checkout_acknowledgements(hotel_id, occurrence_id, stay_id, acknowledged_by, note)
  select p_hotel_id, occurrence.id, p_stay_id, p_actor_id, nullif(btrim(p_note), '')
  from public.maintenance_occurrences occurrence where occurrence.id = any(coalesce(p_occurrence_ids, array[]::uuid[]))
    and occurrence.hotel_id = p_hotel_id on conflict (occurrence_id, stay_id) do nothing;
  select coalesce(sum(case when kind='lodging' and direction='debit' then amount else 0 end),0),
    coalesce(sum(case when kind='consumption_charge' and direction='debit' then amount else 0 end),0),
    coalesce(sum(case when kind='maintenance_charge' and direction='debit' then amount else 0 end),0),
    coalesce(sum(case when kind='payment' and direction='credit' then amount else 0 end),0)
  into v_lodging, v_consumption, v_maintenance, v_payments from public.stay_folio_entries
  where hotel_id = p_hotel_id and stay_id = p_stay_id;
  select coalesce(sum(case when billing_mode='partner_direct' then effective_net_amount else 0 end),0),
    coalesce(sum(case when disposition='courtesy' then original_gross_amount else 0 end),0),
    coalesce(sum(original_net_amount-effective_net_amount),0),
    coalesce(sum(case when effective_status='voided' then original_net_amount else 0 end),0)
  into v_partner, v_courtesy, v_discount, v_voided from public.consumption_order_effective
  where stay_id = p_stay_id;
  select jsonb_build_object('stay_id', p_stay_id, 'reservation_code', v_stay.reservation_code,
    'currency', v_stay.currency, 'folio_entries', coalesce(jsonb_agg(to_jsonb(entry) order by entry.posted_at), '[]'::jsonb))
  into v_snapshot from public.stay_folio_entries entry where entry.hotel_id = p_hotel_id and entry.stay_id = p_stay_id;
  update public.stays set stay_status = 'checked_out', checkout_date_actual = public.hotel_operational_now(p_hotel_id),
    checkout_window_reason = v_window_reason where id = p_stay_id;
  select account_version into p_expected_version from public.stays where id = p_stay_id;
  insert into public.stay_checkout_records(id, hotel_id, stay_id, reservation_id, kind, account_version, currency,
    lodging_total, consumption_total, maintenance_total, payment_total, partner_direct_total, courtesy_total,
    discount_total, voided_total, exception_folio_entry_ids, statement_snapshot, idempotency_key,
    request_fingerprint, checked_out_by, checked_out_at)
  values (v_record_id, p_hotel_id, p_stay_id, v_stay.reservation_id, 'operational', p_expected_version, v_stay.currency,
    v_lodging, v_consumption, v_maintenance, v_payments, v_partner, v_courtesy, v_discount, v_voided,
    coalesce(p_maintenance_folio_entry_ids, array[]::uuid[]), v_snapshot, p_idempotency_key, v_fingerprint,
    p_actor_id, public.hotel_operational_now(p_hotel_id));
  insert into public.stay_account_events(hotel_id, stay_id, entity_type, entity_id, action, actor_id, details)
  values (p_hotel_id, p_stay_id, 'checkout', v_record_id, 'account_closed', p_actor_id,
    jsonb_build_object('account_version', p_expected_version, 'maintenance_exceptions', p_maintenance_folio_entry_ids));
  return jsonb_build_object('result', 'ok', 'checkout_record_id', v_record_id, 'created', true);
end;
$function$;

revoke all on function public.checkout_stay_account(p_hotel_id uuid, p_stay_id uuid, p_actor_id uuid, p_expected_version bigint, p_tenders jsonb, p_idempotency_key uuid, p_occurrence_ids uuid[], p_maintenance_folio_entry_ids uuid[], p_note text, p_window_reason text) from public;
grant execute on function public.checkout_stay_account(p_hotel_id uuid, p_stay_id uuid, p_actor_id uuid, p_expected_version bigint, p_tenders jsonb, p_idempotency_key uuid, p_occurrence_ids uuid[], p_maintenance_folio_entry_ids uuid[], p_note text, p_window_reason text) to public;
grant execute on function public.checkout_stay_account(p_hotel_id uuid, p_stay_id uuid, p_actor_id uuid, p_expected_version bigint, p_tenders jsonb, p_idempotency_key uuid, p_occurrence_ids uuid[], p_maintenance_folio_entry_ids uuid[], p_note text, p_window_reason text) to anon;
grant execute on function public.checkout_stay_account(p_hotel_id uuid, p_stay_id uuid, p_actor_id uuid, p_expected_version bigint, p_tenders jsonb, p_idempotency_key uuid, p_occurrence_ids uuid[], p_maintenance_folio_entry_ids uuid[], p_note text, p_window_reason text) to authenticated;
grant execute on function public.checkout_stay_account(p_hotel_id uuid, p_stay_id uuid, p_actor_id uuid, p_expected_version bigint, p_tenders jsonb, p_idempotency_key uuid, p_occurrence_ids uuid[], p_maintenance_folio_entry_ids uuid[], p_note text, p_window_reason text) to service_role;

CREATE OR REPLACE FUNCTION public.checkout_stay_account_stage4(p_hotel_id uuid, p_stay_id uuid, p_actor_id uuid, p_expected_version bigint, p_tenders jsonb, p_idempotency_key uuid, p_occurrence_ids uuid[] DEFAULT ARRAY[]::uuid[], p_maintenance_folio_entry_ids uuid[] DEFAULT ARRAY[]::uuid[], p_note text DEFAULT NULL::text, p_window_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_review jsonb;v_payer record;v_auth public.corporate_credit_authorizations%rowtype;v_receivable uuid;v_credit uuid;v_entry record;v_remaining numeric;v_apply numeric;v_result jsonb;v_current bigint;v_checkout uuid;
begin
  if exists(select 1 from public.stay_checkout_records where hotel_id=p_hotel_id and idempotency_key=p_idempotency_key) then
    return jsonb_build_object('result','ok','checkout_record_id',(select id from public.stay_checkout_records where hotel_id=p_hotel_id and idempotency_key=p_idempotency_key),'created',false);end if;
  v_review:=public.get_stay_departure_review(p_hotel_id,p_stay_id);
  if v_review is null then return jsonb_build_object('result','not_found');end if;
  if (v_review->>'account_version')::bigint<>p_expected_version then return jsonb_build_object('result','version_conflict','context',v_review);end if;
  if exists(select 1 from jsonb_array_elements(v_review->'blockers') blocker where blocker->>'type' not in('corporate_credit')) then return jsonb_build_object('result','departure_blocked','context',v_review);end if;
  begin
    for v_payer in select payer.*,balances.balance from public.stay_payer_accounts payer join lateral(
      select greatest(coalesce(sum(allocation.amount),0)-coalesce((select sum(amount) from public.stay_payer_payment_batches where payer_account_id=payer.id),0)-coalesce((select sum(amount) from public.stay_payer_credits where payer_account_id=payer.id),0),0) balance
      from public.stay_payer_allocations allocation where allocation.payer_account_id=payer.id) balances on true
      where payer.stay_id=p_stay_id and payer.kind='company' and balances.balance>0
    loop
      select * into v_auth from public.corporate_credit_authorizations where stay_id=p_stay_id and corporate_account_id=v_payer.corporate_account_id and status='approved' and expires_at>public.hotel_operational_now(p_hotel_id) and amount_limit-reserved_amount-consumed_amount>=v_payer.balance for update;
      if not found then raise exception 'corporate_credit_invalid' using errcode='P0001';end if;
      insert into public.corporate_receivables(hotel_id,corporate_account_id,authorization_id,stay_id,amount,currency,due_on)
        select p_hotel_id,v_payer.corporate_account_id,v_auth.id,p_stay_id,v_payer.balance,hotel.currency,(public.hotel_operational_now(p_hotel_id) at time zone hotel.timezone)::date+account.payment_term_days
        from public.hotels hotel join public.corporate_accounts account on account.id=v_payer.corporate_account_id where hotel.id=p_hotel_id returning id into v_receivable;
      insert into public.stay_folio_entries(hotel_id,stay_id,reservation_id,direction,kind,amount,currency,description,source_key,posted_by,posted_at)
        select p_hotel_id,p_stay_id,stay.reservation_id,'credit','payment',v_payer.balance,hotel.currency,'Crédito de faturamento empresarial','corporate-receivable:'||v_receivable,p_actor_id,public.hotel_operational_now(p_hotel_id)
        from public.stays stay join public.reservations reservation on reservation.id=stay.reservation_id join public.hotels hotel on hotel.id=reservation.hotel_id where stay.id=p_stay_id returning id into v_credit;
      v_remaining:=v_payer.balance;
      for v_entry in select allocation.folio_entry_id,allocation.amount-coalesce((select sum(folio.amount) from public.stay_folio_allocations folio where folio.debit_entry_id=allocation.folio_entry_id),0) open_amount from public.stay_payer_allocations allocation where allocation.payer_account_id=v_payer.id order by allocation.created_at loop
        v_apply:=least(v_remaining,greatest(v_entry.open_amount,0));if v_apply>0 then insert into public.stay_folio_allocations(hotel_id,stay_id,credit_entry_id,debit_entry_id,amount,created_by) values(p_hotel_id,p_stay_id,v_credit,v_entry.folio_entry_id,v_apply,p_actor_id);v_remaining:=v_remaining-v_apply;end if;exit when v_remaining<=0;
      end loop;
      insert into public.stay_payer_credits(hotel_id,stay_id,payer_account_id,folio_credit_entry_id,amount,reason) values(p_hotel_id,p_stay_id,v_payer.id,v_credit,v_payer.balance,'Faturamento empresarial');
      update public.corporate_credit_authorizations set consumed_amount=consumed_amount+v_payer.balance,version=version+1,updated_at=now() where id=v_auth.id;
    end loop;
    select account_version into v_current from public.stays where id=p_stay_id;
    v_result:=public.checkout_stay_account(p_hotel_id,p_stay_id,p_actor_id,v_current,p_tenders,p_idempotency_key,p_occurrence_ids,p_maintenance_folio_entry_ids,p_note,p_window_reason);
    if v_result->>'result'<>'ok' then raise exception '%',v_result::text using errcode='P0001';end if;
    v_checkout:=(v_result->>'checkout_record_id')::uuid;
    update public.corporate_receivables set checkout_record_id=v_checkout where stay_id=p_stay_id and checkout_record_id is null;
    update public.stay_benefit_grants set status='expired',expired_at=public.hotel_operational_now(p_hotel_id) where stay_id=p_stay_id and status='active';
    insert into public.consumption_benefit_events(hotel_id,entity_type,entity_id,action,actor_id,details)
      select p_hotel_id,'grant',id,'expired_at_checkout',p_actor_id,jsonb_build_object('unused_benefit_refunded',false) from public.stay_benefit_grants where stay_id=p_stay_id and expired_at is not null;
    insert into public.stay_checkout_operational_snapshots(checkout_record_id,hotel_id,stay_id,payer_accounts,benefit_grants,corporate_receivables)
      values(v_checkout,p_hotel_id,p_stay_id,v_review->'payer_balances',(select coalesce(jsonb_agg(to_jsonb(benefit_grant)),'[]'::jsonb) from public.stay_benefit_grants benefit_grant where stay_id=p_stay_id),(select coalesce(jsonb_agg(to_jsonb(receivable)),'[]'::jsonb) from public.corporate_receivables receivable where stay_id=p_stay_id));
    return v_result;
  exception when sqlstate 'P0001' then
    begin return sqlerrm::jsonb;exception when others then return jsonb_build_object('result',sqlerrm);end;
  end;
end $function$;

revoke all on function public.checkout_stay_account_stage4(p_hotel_id uuid, p_stay_id uuid, p_actor_id uuid, p_expected_version bigint, p_tenders jsonb, p_idempotency_key uuid, p_occurrence_ids uuid[], p_maintenance_folio_entry_ids uuid[], p_note text, p_window_reason text) from public;
grant execute on function public.checkout_stay_account_stage4(p_hotel_id uuid, p_stay_id uuid, p_actor_id uuid, p_expected_version bigint, p_tenders jsonb, p_idempotency_key uuid, p_occurrence_ids uuid[], p_maintenance_folio_entry_ids uuid[], p_note text, p_window_reason text) to public;
grant execute on function public.checkout_stay_account_stage4(p_hotel_id uuid, p_stay_id uuid, p_actor_id uuid, p_expected_version bigint, p_tenders jsonb, p_idempotency_key uuid, p_occurrence_ids uuid[], p_maintenance_folio_entry_ids uuid[], p_note text, p_window_reason text) to anon;
grant execute on function public.checkout_stay_account_stage4(p_hotel_id uuid, p_stay_id uuid, p_actor_id uuid, p_expected_version bigint, p_tenders jsonb, p_idempotency_key uuid, p_occurrence_ids uuid[], p_maintenance_folio_entry_ids uuid[], p_note text, p_window_reason text) to authenticated;
grant execute on function public.checkout_stay_account_stage4(p_hotel_id uuid, p_stay_id uuid, p_actor_id uuid, p_expected_version bigint, p_tenders jsonb, p_idempotency_key uuid, p_occurrence_ids uuid[], p_maintenance_folio_entry_ids uuid[], p_note text, p_window_reason text) to service_role;

CREATE OR REPLACE FUNCTION public.checkin_stay_with_readiness(p_hotel_id uuid, p_stay_id uuid, p_actor_id uuid, p_expected_version integer DEFAULT NULL::integer, p_override_reason text DEFAULT NULL::text, p_allow_override boolean DEFAULT false, p_window_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_window_reason text:=nullif(btrim(p_window_reason),''); v_stay record; v_state jsonb; v_cycle uuid; v_now timestamptz; v_hotel public.hotels; v_entry record; v_credit uuid; v_payer uuid; v_amount numeric;
begin
  select s.* into v_stay from public.stays s join public.reservations r on r.id=s.reservation_id and r.hotel_id=p_hotel_id where s.id=p_stay_id for update of s;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if v_stay.stay_status<>'confirmed' then return jsonb_build_object('result','invalid_state'); end if;
  select * into v_hotel from public.hotels where id=p_hotel_id;
  v_now:=public.hotel_operational_now(p_hotel_id);
  if (v_now at time zone v_hotel.timezone)::date<>(v_stay.checkin_date_expected at time zone v_hotel.timezone)::date then return jsonb_build_object('result','outside_checkin_date');end if;
  if v_hotel.checkin_time_start is null or v_hotel.checkin_time_limit is null then return jsonb_build_object('result','checkin_window_missing');end if;
  if not(case when v_hotel.checkin_time_start<=v_hotel.checkin_time_limit then (date_trunc('minute',v_now) at time zone v_hotel.timezone)::time between v_hotel.checkin_time_start and v_hotel.checkin_time_limit else (date_trunc('minute',v_now) at time zone v_hotel.timezone)::time>=v_hotel.checkin_time_start or (date_trunc('minute',v_now) at time zone v_hotel.timezone)::time<=v_hotel.checkin_time_limit end) then
    -- QA-087: no dia previsto, o check-in fora do horário vale com motivo.
    if v_window_reason is null then return jsonb_build_object('result','checkin_reason_required');end if;
  else
    v_window_reason:=null;
  end if;
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
  update public.stays set stay_status='checked_in',checkin_date_actual=v_now,checkin_window_reason=v_window_reason,operational_version=operational_version+1 where id=p_stay_id;

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
end $function$;

revoke all on function public.checkin_stay_with_readiness(p_hotel_id uuid, p_stay_id uuid, p_actor_id uuid, p_expected_version integer, p_override_reason text, p_allow_override boolean, p_window_reason text) from public;
grant execute on function public.checkin_stay_with_readiness(p_hotel_id uuid, p_stay_id uuid, p_actor_id uuid, p_expected_version integer, p_override_reason text, p_allow_override boolean, p_window_reason text) to service_role;
