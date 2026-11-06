-- QA-019: saída, conta e pagamentos decidiam e carimbavam pelo tempo real. Em treinamento, a saída só
-- valia se a data real fosse a data prevista, o vencimento do faturado partia do dia errado e
-- pagamentos caíam em outro dia de negócio, fora do fechamento. Tudo passa a usar o relógio do hotel.
-- Em produção os dois relógios coincidem. Parâmetros de data sem padrão real: quem não informa recebe
-- a hora do hotel no corpo da função, que conhece o hotel; o padrão de um parâmetro não conhece.
CREATE OR REPLACE FUNCTION public.apply_consumption_benefits(p_hotel_id uuid, p_order_id uuid, p_actor_id uuid, p_skip boolean DEFAULT false, p_override_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_order public.consumption_orders%rowtype;v_item record;v_candidate record;v_remaining numeric;v_available numeric;v_apply numeric;v_total numeric:=0;v_credit uuid;v_debit uuid;v_payer record;
begin
  select * into v_order from public.consumption_orders where id=p_order_id and hotel_id=p_hotel_id for update;
  if not found then return jsonb_build_object('result','not_found');end if;
  if v_order.billing_mode='partner_direct' or v_order.disposition<>'charged' then return jsonb_build_object('result','ok','amount',0,'explanation','Benefício não aplicável ao recebimento direto do parceiro.');end if;
  if p_skip then if length(coalesce(btrim(p_override_reason),''))<3 then return jsonb_build_object('result','reason_required');end if;
    insert into public.consumption_benefit_events(hotel_id,entity_type,entity_id,action,actor_id,details) values(p_hotel_id,'order',p_order_id,'eligible_benefit_removed',p_actor_id,jsonb_build_object('reason',btrim(p_override_reason)));
    return jsonb_build_object('result','ok','amount',0,'explanation','Benefício elegível retirado com justificativa.');end if;
  if exists(select 1 from public.consumption_benefit_redemptions where consumption_order_id=p_order_id) then
    return jsonb_build_object('result','ok','amount',(select sum(amount) from public.consumption_benefit_redemptions where consumption_order_id=p_order_id),'created',false);end if;
  for v_item in select * from public.consumption_order_items where order_id=p_order_id order by id loop
    v_remaining:=v_item.net_amount;
    for v_candidate in
      select benefit_grant.id grant_id,benefit_grant.expires_at,benefit_grant.granted_at,rule.*,
        coalesce((select sum(redemption.amount) from public.consumption_benefit_redemptions redemption where redemption.grant_id=benefit_grant.id and redemption.rule_id=rule.id),0) used_amount,
        coalesce((select sum(redemption.quantity) from public.consumption_benefit_redemptions redemption where redemption.grant_id=benefit_grant.id and redemption.rule_id=rule.id),0) used_quantity
      from public.stay_benefit_grants benefit_grant join public.consumption_benefit_rules rule on rule.plan_version_id=benefit_grant.plan_version_id
      where benefit_grant.hotel_id=p_hotel_id and benefit_grant.stay_id=v_order.stay_id and benefit_grant.status='active' and coalesce(benefit_grant.expires_at,public.hotel_operational_now(p_hotel_id)+interval '100 years')>public.hotel_operational_now(p_hotel_id)
        and (rule.product_id is null or rule.product_id=v_item.product_id) and(rule.category_id is null or rule.category_id=v_item.category_id)
        and(rule.offer_id is null or rule.offer_id=v_item.offer_id) and(rule.point_id is null or rule.point_id=v_order.point_id)
      order by case when rule.kind='monetary_credit' then rule.amount-coalesce((select sum(r.amount) from public.consumption_benefit_redemptions r where r.grant_id=benefit_grant.id and r.rule_id=rule.id),0)
        else (rule.quantity-coalesce((select sum(r.quantity) from public.consumption_benefit_redemptions r where r.grant_id=benefit_grant.id and r.rule_id=rule.id),0))*v_item.charged_unit_price end desc,
        benefit_grant.expires_at nulls last,benefit_grant.granted_at,benefit_grant.id
    loop
      exit when v_remaining<=0;
      v_available:=case when v_candidate.kind='monetary_credit' then greatest(v_candidate.amount-v_candidate.used_amount,0)
        else greatest(v_candidate.quantity-v_candidate.used_quantity,0)*v_item.charged_unit_price end;
      v_apply:=least(v_remaining,v_available);
      if v_apply>0 then
        insert into public.consumption_benefit_redemptions(hotel_id,grant_id,rule_id,consumption_order_id,consumption_order_item_id,amount,quantity,explanation)
        values(p_hotel_id,v_candidate.grant_id,v_candidate.id,p_order_id,v_item.id,v_apply,case when v_candidate.kind='included_item' then v_apply/v_item.charged_unit_price else 0 end,
          'Aplicado automaticamente por maior vantagem; desempate por vencimento e concessão.');
        v_remaining:=v_remaining-v_apply;v_total:=v_total+v_apply;
      end if;
    end loop;
  end loop;
  if v_total>0 then
    select id into v_debit from public.stay_folio_entries where consumption_order_id=p_order_id and direction='debit' order by posted_at limit 1;
    insert into public.stay_folio_entries(hotel_id,stay_id,reservation_id,direction,kind,amount,currency,description,consumption_order_id,source_key,posted_by,posted_at)
      values(p_hotel_id,v_order.stay_id,v_order.reservation_id,'credit','adjustment',v_total,v_order.currency,'Benefícios aplicados ao consumo',p_order_id,'benefit:'||p_order_id,p_actor_id,public.hotel_operational_now(p_hotel_id)) returning id into v_credit;
    if v_debit is not null then insert into public.stay_folio_allocations(hotel_id,stay_id,credit_entry_id,debit_entry_id,amount,created_by) values(p_hotel_id,v_order.stay_id,v_credit,v_debit,v_total,p_actor_id);end if;
    update public.consumption_benefit_redemptions set folio_credit_entry_id=v_credit where consumption_order_id=p_order_id;
    for v_payer in select allocation.payer_account_id,round(v_total*allocation.amount/nullif(entry.amount,0),2) amount from public.stay_payer_allocations allocation join public.stay_folio_entries entry on entry.id=allocation.folio_entry_id where allocation.folio_entry_id=v_debit loop
      insert into public.stay_payer_credits(hotel_id,stay_id,payer_account_id,folio_credit_entry_id,amount,reason) values(p_hotel_id,v_order.stay_id,v_payer.payer_account_id,v_credit,v_payer.amount,'Benefício de consumo') on conflict do nothing;
    end loop;
  end if;
  return jsonb_build_object('result','ok','amount',v_total,'explanation','Combinação de maior vantagem; empate resolvido por vencimento e concessão.','created',true);
end $function$
;

CREATE OR REPLACE FUNCTION public.checkout_stay_account(p_hotel_id uuid, p_stay_id uuid, p_actor_id uuid, p_expected_version bigint, p_tenders jsonb, p_idempotency_key uuid, p_occurrence_ids uuid[] DEFAULT ARRAY[]::uuid[], p_maintenance_folio_entry_ids uuid[] DEFAULT ARRAY[]::uuid[], p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_stay record; v_existing record; v_due numeric(12,2); v_open_credit numeric(12,2); v_batch jsonb;
  v_fingerprint text; v_record_id uuid := gen_random_uuid(); v_snapshot jsonb; v_currency text;
  v_lodging numeric(12,2); v_consumption numeric(12,2); v_maintenance numeric(12,2); v_payments numeric(12,2);
  v_partner numeric(12,2); v_courtesy numeric(12,2); v_discount numeric(12,2); v_voided numeric(12,2);
begin
  v_fingerprint := md5(jsonb_build_object('stay', p_stay_id, 'version', p_expected_version, 'tenders', p_tenders,
    'occurrences', p_occurrence_ids, 'maintenance_entries', p_maintenance_folio_entry_ids,
    'note', nullif(btrim(p_note), ''))::text);
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
  if (public.hotel_operational_now(p_hotel_id) at time zone v_stay.timezone)::date <> v_stay.checkout_date_expected::date
    then return jsonb_build_object('result', 'checkout_date_invalid'); end if;
  if (v_stay.checkout_time_start <= v_stay.checkout_time_limit and
      (public.hotel_operational_now(p_hotel_id) at time zone v_stay.timezone)::time not between v_stay.checkout_time_start and v_stay.checkout_time_limit)
    or (v_stay.checkout_time_start > v_stay.checkout_time_limit and
      (public.hotel_operational_now(p_hotel_id) at time zone v_stay.timezone)::time < v_stay.checkout_time_start and
      (public.hotel_operational_now(p_hotel_id) at time zone v_stay.timezone)::time > v_stay.checkout_time_limit)
    then return jsonb_build_object('result', 'checkout_time_invalid'); end if;
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
  update public.stays set stay_status = 'checked_out', checkout_date_actual = public.hotel_operational_now(p_hotel_id) where id = p_stay_id;
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
$function$
;

CREATE OR REPLACE FUNCTION public.checkout_stay_account_stage4(p_hotel_id uuid, p_stay_id uuid, p_actor_id uuid, p_expected_version bigint, p_tenders jsonb, p_idempotency_key uuid, p_occurrence_ids uuid[] DEFAULT ARRAY[]::uuid[], p_maintenance_folio_entry_ids uuid[] DEFAULT ARRAY[]::uuid[], p_note text DEFAULT NULL::text)
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
    v_result:=public.checkout_stay_account(p_hotel_id,p_stay_id,p_actor_id,v_current,p_tenders,p_idempotency_key,p_occurrence_ids,p_maintenance_folio_entry_ids,p_note);
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
end $function$
;

CREATE OR REPLACE FUNCTION public.checkout_stay_with_maintenance_acknowledgements(p_hotel_id uuid, p_stay_id uuid, p_actor_id uuid, p_occurrence_ids uuid[] DEFAULT ARRAY[]::uuid[], p_note text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_updated boolean := false;
begin
  if not exists (
    select 1 from public.stays s
    join public.rooms r on r.id = s.room_id
    where s.id = p_stay_id and r.hotel_id = p_hotel_id
  ) then
    return false;
  end if;

  if exists (
    select 1
    from public.maintenance_occurrences occurrence
    where occurrence.hotel_id = p_hotel_id
      and occurrence.stay_id = p_stay_id
      and occurrence.status not in ('resolved', 'canceled')
      and occurrence.id <> all(coalesce(p_occurrence_ids, array[]::uuid[]))
      and not exists (
        select 1 from public.maintenance_checkout_acknowledgements acknowledgement
        where acknowledgement.occurrence_id = occurrence.id and acknowledgement.stay_id = p_stay_id
      )
  ) then
    raise exception using errcode = '23514', message = 'Há ocorrências de manutenção sem ciência para esta estadia.';
  end if;

  if exists (
    select 1 from unnest(coalesce(p_occurrence_ids, array[]::uuid[])) occurrence_id
    where not exists (
      select 1 from public.maintenance_occurrences occurrence
      where occurrence.id = occurrence_id
        and occurrence.hotel_id = p_hotel_id
        and occurrence.stay_id = p_stay_id
        and occurrence.status not in ('resolved', 'canceled')
    )
  ) then
    raise exception using errcode = '23514', message = 'A ciência contém uma ocorrência inválida para esta estadia.';
  end if;

  with acknowledged as (
    insert into public.maintenance_checkout_acknowledgements(hotel_id, occurrence_id, stay_id, acknowledged_by, note)
    select p_hotel_id, occurrence.id, p_stay_id, p_actor_id, nullif(btrim(p_note), '')
    from public.maintenance_occurrences occurrence
    where occurrence.id = any(coalesce(p_occurrence_ids, array[]::uuid[]))
      and occurrence.hotel_id = p_hotel_id
      and occurrence.stay_id = p_stay_id
    on conflict (occurrence_id, stay_id) do nothing
    returning occurrence_id
  )
  insert into public.maintenance_events(hotel_id, occurrence_id, actor_id, event_type, message)
  select p_hotel_id, occurrence_id, p_actor_id, 'checkout_acknowledged', nullif(btrim(p_note), '')
  from acknowledged;

  update public.stays
  set stay_status = 'checked_out', checkout_date_actual = public.hotel_operational_now(p_hotel_id), updated_at = now()
  where id = p_stay_id;
  v_updated := found;
  return v_updated;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_post_checkout_consumption_case(p_hotel_id uuid, p_actor_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_stay record;v_checkout uuid;v_case uuid:=gen_random_uuid();v_item jsonb;v_snapshot jsonb;
begin
  select stay.*,reservation.hotel_id into v_stay from public.stays stay join public.reservations reservation on reservation.id=stay.reservation_id where stay.id=(p_input->>'stay_id')::uuid and reservation.hotel_id=p_hotel_id;
  if not found or v_stay.stay_status<>'checked_out' then return jsonb_build_object('result','stay_not_checked_out');end if;
  if (p_input->>'occurred_at')::timestamptz<v_stay.checkin_date_actual or (p_input->>'occurred_at')::timestamptz>v_stay.checkout_date_actual then return jsonb_build_object('result','occurred_outside_stay');end if;
  select id into v_checkout from public.stay_checkout_records where stay_id=v_stay.id order by checked_out_at desc limit 1;
  insert into public.post_checkout_consumption_cases(id,hotel_id,stay_id,checkout_record_id,governance_inspection_id,occurred_at,report,created_by)
    values(v_case,p_hotel_id,v_stay.id,v_checkout,nullif(p_input->>'governance_inspection_id','')::uuid,(p_input->>'occurred_at')::timestamptz,btrim(p_input->>'report'),p_actor_id);
  for v_item in select value from jsonb_array_elements(p_input->'items') loop
    v_snapshot:=public.resolve_consumption_offer_snapshot(p_hotel_id,(v_item->>'offer_id')::uuid,public.hotel_operational_now(p_hotel_id));if not coalesce((v_snapshot->>'found')::boolean,false) then raise exception 'offer_not_found' using errcode='P0001';end if;
    insert into public.post_checkout_consumption_items(hotel_id,case_id,offer_id,product_id,category_id,point_id,quantity,unit_price,product_name_snapshot,category_name_snapshot,product_kind_snapshot,sales_unit_snapshot,provider_type_snapshot,partner_id,agreement_id,revision_id,billing_policy_snapshot,commercial_terms_snapshot,version_token,inventory_controlled,inventory_location_id)
    values(p_hotel_id,v_case,(v_item->>'offer_id')::uuid,(v_snapshot->>'product_id')::uuid,(v_snapshot->>'category_id')::uuid,(v_snapshot->>'point_id')::uuid,(v_item->>'quantity')::numeric,(v_snapshot->>'unit_price')::numeric,v_snapshot->>'product_name',v_snapshot->>'category_name',(v_snapshot->>'product_kind')::public.product_kind,(v_snapshot->>'sales_unit')::public.product_sales_unit,(v_snapshot->>'provider_type')::public.product_provider_type,nullif(v_snapshot->>'partner_id','')::uuid,nullif(v_snapshot->>'agreement_id','')::uuid,nullif(v_snapshot->'revision'->>'id','')::uuid,v_snapshot->'billing_policy',v_snapshot->'revision',v_snapshot->>'version_token',coalesce((v_snapshot->>'inventory_controlled')::boolean,false),nullif(v_snapshot->>'inventory_location_id','')::uuid);
  end loop;
  if (select count(distinct point_id) from public.post_checkout_consumption_items where case_id=v_case)>1 then raise exception 'different_points' using errcode='P0001';end if;
  insert into public.post_checkout_consumption_events(hotel_id,case_id,action,actor_id,details) values(p_hotel_id,v_case,'created',p_actor_id,jsonb_build_object('original_checkout_unchanged',true));
  return jsonb_build_object('result','ok','case_id',v_case);
exception when sqlstate 'P0001' then return jsonb_build_object('result',sqlerrm);end $function$
;

CREATE OR REPLACE FUNCTION public.create_stay_folio_payment(p_hotel_id uuid, p_stay_id uuid, p_actor_id uuid, p_amount numeric, p_method text, p_note text DEFAULT NULL::text, p_paid_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_allocations jsonb DEFAULT NULL::jsonb, p_maintenance_recovery_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_reservation_id uuid;
  v_currency text;
  v_transaction_id uuid;
  v_entry_id uuid;
begin
  select s.reservation_id, h.currency into v_reservation_id, v_currency
  from public.stays s join public.reservations r on r.id = s.reservation_id
  join public.hotels h on h.id = r.hotel_id
  where s.id = p_stay_id and r.hotel_id = p_hotel_id for update of s;
  if not found then return null; end if;
  if p_amount <= 0 or nullif(btrim(p_method), '') is null then raise exception 'invalid payment' using errcode = '23514'; end if;
  insert into public.financial_transactions(
    hotel_id, type, category, amount, currency, description, status, stay_id, reservation_id,
    payment_method, paid_at, created_by, maintenance_recovery_id
  ) values (
    p_hotel_id, 'INCOME', case when p_maintenance_recovery_id is null then 'STAY_PAYMENT' else 'DAMAGE_RECOVERY' end,
    p_amount, v_currency, nullif(btrim(p_note), ''), 'COMPLETED', p_stay_id, v_reservation_id,
    btrim(p_method), coalesce(p_paid_at, public.hotel_operational_now(p_hotel_id)), p_actor_id, p_maintenance_recovery_id
  ) returning id into v_transaction_id;
  insert into public.stay_folio_entries(
    hotel_id, stay_id, reservation_id, direction, kind, amount, currency, description,
    financial_transaction_id, source_key, posted_by, posted_at
  ) values (
    p_hotel_id, p_stay_id, v_reservation_id, 'credit', 'payment', p_amount, v_currency,
    coalesce(nullif(btrim(p_note), ''), 'Pagamento da estadia'), v_transaction_id,
    'payment:' || v_transaction_id::text, p_actor_id, coalesce(p_paid_at, public.hotel_operational_now(p_hotel_id))
  ) returning id into v_entry_id;
  perform public.allocate_stay_folio_credit(p_hotel_id, p_stay_id, v_entry_id, p_actor_id, p_allocations);
  update public.stays set total_paid = (
    select coalesce(sum(case when direction = 'credit' then amount else -amount end), 0)
    from public.stay_folio_entries where stay_id = p_stay_id and kind in ('payment', 'refund', 'adjustment')
  ) where id = p_stay_id;
  return v_transaction_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_stay_payment_batch(p_hotel_id uuid, p_stay_id uuid, p_actor_id uuid, p_tenders jsonb, p_idempotency_key uuid, p_expected_version bigint, p_kind stay_payment_batch_kind DEFAULT 'regular'::stay_payment_batch_kind, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_stay record; v_existing record; v_fingerprint text; v_total numeric(12,2) := 0; v_due numeric(12,2) := 0;
  v_open_credit numeric(12,2) := 0;
  v_tender jsonb; v_batch_id uuid := gen_random_uuid(); v_transaction_id uuid; v_credit_id uuid; v_index integer := 0;
  v_method public.consumption_payment_method; v_amount numeric(12,2); v_reference text;
begin
  if jsonb_typeof(p_tenders) <> 'array' or jsonb_array_length(p_tenders) < 1 or jsonb_array_length(p_tenders) > 10
    then return jsonb_build_object('result', 'invalid_tenders'); end if;
  v_fingerprint := md5(jsonb_build_object('stay', p_stay_id, 'tenders', p_tenders, 'kind', p_kind,
    'note', nullif(btrim(p_note), ''))::text);
  select id, request_fingerprint into v_existing from public.stay_payment_batches
    where hotel_id = p_hotel_id and idempotency_key = p_idempotency_key for update;
  if found then
    if v_existing.request_fingerprint = v_fingerprint then return jsonb_build_object('result', 'ok', 'batch_id', v_existing.id, 'created', false); end if;
    return jsonb_build_object('result', 'idempotency_conflict');
  end if;
  if not public.maintenance_user_has_hotel_scope(p_actor_id, p_hotel_id) then return jsonb_build_object('result', 'actor_outside_hotel'); end if;
  select stay.id, stay.reservation_id, stay.stay_status, stay.account_version, hotel.currency into v_stay
  from public.stays stay join public.reservations reservation on reservation.id = stay.reservation_id
  join public.hotels hotel on hotel.id = reservation.hotel_id
  where stay.id = p_stay_id and reservation.hotel_id = p_hotel_id for update of stay;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if v_stay.account_version <> p_expected_version then return jsonb_build_object('result', 'version_conflict'); end if;
  if v_stay.stay_status not in ('confirmed', 'checked_in') then return jsonb_build_object('result', 'stay_closed'); end if;
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
  for v_tender in select value from jsonb_array_elements(p_tenders) loop
    begin v_method := (v_tender->>'payment_method')::public.consumption_payment_method;
    exception when invalid_text_representation then return jsonb_build_object('result', 'invalid_payment_method'); end;
    v_amount := round((v_tender->>'amount')::numeric, 2); v_reference := nullif(btrim(v_tender->>'reference_code'), '');
    if v_amount <= 0 or (v_reference is not null and length(v_reference) > 200) then return jsonb_build_object('result', 'invalid_tender'); end if;
    v_total := v_total + v_amount;
  end loop;
  if v_total > v_due then return jsonb_build_object('result', 'payment_exceeds_balance', 'balance', v_due); end if;
  if p_kind = 'checkout' and v_total <> v_due then return jsonb_build_object('result', 'checkout_payment_mismatch', 'balance', v_due); end if;
  insert into public.stay_payment_batches(id, hotel_id, stay_id, reservation_id, kind, amount, currency, note,
    idempotency_key, request_fingerprint, created_by)
  values (v_batch_id, p_hotel_id, p_stay_id, v_stay.reservation_id, p_kind, v_total, v_stay.currency,
    nullif(btrim(p_note), ''), p_idempotency_key, v_fingerprint, p_actor_id);
  for v_tender in select value from jsonb_array_elements(p_tenders) loop
    v_method := (v_tender->>'payment_method')::public.consumption_payment_method;
    v_amount := round((v_tender->>'amount')::numeric, 2); v_reference := nullif(btrim(v_tender->>'reference_code'), '');
    insert into public.financial_transactions(hotel_id, type, category, amount, currency, description, status,
      stay_id, reservation_id, payment_method, paid_at, created_by, reference_code)
    values (p_hotel_id, 'INCOME', 'STAY_PAYMENT', v_amount, v_stay.currency,
      coalesce(nullif(btrim(p_note), ''), 'Pagamento da conta da estadia'), 'COMPLETED', p_stay_id,
      v_stay.reservation_id, v_method::text, public.hotel_operational_now(p_hotel_id), p_actor_id, v_reference) returning id into v_transaction_id;
    insert into public.stay_folio_entries(hotel_id, stay_id, reservation_id, direction, kind, amount, currency,
      description, financial_transaction_id, source_key, posted_by)
    values (p_hotel_id, p_stay_id, v_stay.reservation_id, 'credit', 'payment', v_amount, v_stay.currency,
      'Pagamento da conta da estadia', v_transaction_id, 'payment-batch:' || v_batch_id::text || ':' || v_index::text, p_actor_id)
    returning id into v_credit_id;
    insert into public.stay_payment_batch_tenders(hotel_id, batch_id, payment_method, amount, reference_code,
      financial_transaction_id, folio_credit_entry_id, display_order)
    values (p_hotel_id, v_batch_id, v_method, v_amount, v_reference, v_transaction_id, v_credit_id, v_index);
    perform public.allocate_stay_account_credit(p_hotel_id, p_stay_id, v_credit_id, p_actor_id);
    v_index := v_index + 1;
  end loop;
  update public.stays set total_paid = (
    select coalesce(sum(case when direction = 'credit' then amount else -amount end), 0)
    from public.stay_folio_entries where stay_id = p_stay_id and kind in ('payment', 'refund', 'adjustment')
  ) where id = p_stay_id;
  insert into public.stay_account_events(hotel_id, stay_id, entity_type, entity_id, action, actor_id, details)
  values (p_hotel_id, p_stay_id, 'payment_batch', v_batch_id, 'payment_batch_posted', p_actor_id,
    jsonb_build_object('amount', v_total, 'tender_count', jsonb_array_length(p_tenders), 'kind', p_kind));
  return jsonb_build_object('result', 'ok', 'batch_id', v_batch_id, 'created', true);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_stay_refund(p_hotel_id uuid, p_stay_id uuid, p_actor_id uuid, p_amount numeric, p_payment_method consumption_payment_method, p_reason text, p_idempotency_key uuid, p_expected_version bigint, p_correction_id uuid DEFAULT NULL::uuid, p_original_tender_id uuid DEFAULT NULL::uuid, p_reference text DEFAULT NULL::text, p_method_override_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_stay record; v_correction record; v_tender record; v_existing record; v_fingerprint text;
  v_refund_id uuid := gen_random_uuid(); v_transaction_id uuid; v_debit_id uuid; v_adjustment_credit_id uuid;
  v_correction_order_id uuid;
  v_available numeric(12,2); v_tender_remaining numeric(12,2);
  v_original_method public.consumption_payment_method;
begin
  v_fingerprint := md5(jsonb_build_object('stay', p_stay_id, 'amount', p_amount, 'method', p_payment_method,
    'reason', btrim(p_reason), 'correction', p_correction_id, 'tender', p_original_tender_id,
    'reference', nullif(btrim(p_reference), ''), 'override', nullif(btrim(p_method_override_reason), ''))::text);
  select id, request_fingerprint into v_existing from public.stay_refunds
    where hotel_id = p_hotel_id and idempotency_key = p_idempotency_key for update;
  if found then
    if v_existing.request_fingerprint = v_fingerprint then return jsonb_build_object('result', 'ok', 'refund_id', v_existing.id, 'created', false); end if;
    return jsonb_build_object('result', 'idempotency_conflict');
  end if;
  if not public.maintenance_user_has_hotel_scope(p_actor_id, p_hotel_id) then return jsonb_build_object('result', 'actor_outside_hotel'); end if;
  select stay.*, reservation.hotel_id, reservation.id reservation_id, hotel.currency into v_stay
  from public.stays stay join public.reservations reservation on reservation.id = stay.reservation_id
  join public.hotels hotel on hotel.id = reservation.hotel_id
  where stay.id = p_stay_id and reservation.hotel_id = p_hotel_id for update of stay;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if v_stay.account_version <> p_expected_version then return jsonb_build_object('result', 'version_conflict'); end if;
  if p_amount <= 0 or length(coalesce(btrim(p_reason), '')) < 3 then return jsonb_build_object('result', 'invalid_refund'); end if;
  if p_original_tender_id is not null then
    select tender.* into v_tender from public.stay_payment_batch_tenders tender
    join public.stay_payment_batches batch on batch.id = tender.batch_id
    where tender.id = p_original_tender_id and tender.hotel_id = p_hotel_id and batch.stay_id = p_stay_id;
    if not found then return jsonb_build_object('result', 'tender_not_found'); end if;
    v_original_method := v_tender.payment_method;
    select v_tender.amount - coalesce(sum(refund.amount), 0) into v_tender_remaining
    from public.stay_refunds refund where refund.original_tender_id = p_original_tender_id;
    if p_amount > v_tender_remaining then
      return jsonb_build_object('result', 'refund_exceeds_payment', 'available', v_tender_remaining);
    end if;
  end if;
  if v_original_method is not null and v_original_method <> p_payment_method and length(coalesce(btrim(p_method_override_reason), '')) < 3
    then return jsonb_build_object('result', 'method_override_reason_required'); end if;
  if p_correction_id is not null then
    select * into v_correction from public.consumption_corrections
      where id = p_correction_id and hotel_id = p_hotel_id and stay_id = p_stay_id for update;
    if not found or v_correction.status <> 'awaiting_refund'
      then return jsonb_build_object('result', 'invalid_correction_refund'); end if;
    v_correction_order_id := v_correction.order_id;
    select entry.id, entry.amount - coalesce(sum(allocation.amount), 0)
      into v_adjustment_credit_id, v_available
    from public.stay_folio_entries entry
    left join public.stay_folio_allocations allocation on allocation.credit_entry_id = entry.id
    where entry.hotel_id = p_hotel_id and entry.consumption_correction_id = p_correction_id
      and entry.direction = 'credit' and entry.kind = 'adjustment'
    group by entry.id, entry.amount limit 1;
    if found then
      if p_amount <> v_available or v_available <= 0
        then return jsonb_build_object('result', 'invalid_correction_refund', 'available', v_available); end if;
    elsif p_amount <> v_correction.net_reduction then
      return jsonb_build_object('result', 'invalid_correction_refund', 'available', v_correction.net_reduction);
    end if;
  elsif p_original_tender_id is null then
    if v_stay.stay_status = 'checked_out' then return jsonb_build_object('result', 'closed_account_refund_requires_correction'); end if;
    select coalesce(sum(entry.amount - coalesce(allocated.amount, 0)), 0) into v_available
    from public.stay_folio_entries entry
    left join lateral (select sum(amount) amount from public.stay_folio_allocations where credit_entry_id = entry.id) allocated on true
    where entry.hotel_id = p_hotel_id and entry.stay_id = p_stay_id and entry.direction = 'credit'
      and entry.amount > coalesce(allocated.amount, 0);
    if p_amount > v_available then return jsonb_build_object('result', 'refund_exceeds_credit', 'available', v_available); end if;
  elsif v_stay.stay_status = 'checked_out' then
    return jsonb_build_object('result', 'closed_account_refund_requires_correction');
  end if;
  insert into public.stay_refunds(id, hotel_id, stay_id, reservation_id, correction_id, original_tender_id,
    amount, currency, payment_method, original_payment_method, method_override_reason, reference_code, reason,
    financial_transaction_id, folio_debit_entry_id, idempotency_key, request_fingerprint, created_by)
  values (v_refund_id, p_hotel_id, p_stay_id, v_stay.reservation_id, p_correction_id, p_original_tender_id,
    p_amount, v_stay.currency, p_payment_method, v_original_method, nullif(btrim(p_method_override_reason), ''),
    nullif(btrim(p_reference), ''), btrim(p_reason), gen_random_uuid(), gen_random_uuid(), p_idempotency_key, v_fingerprint, p_actor_id);
  select financial_transaction_id, folio_debit_entry_id into v_transaction_id, v_debit_id
    from public.stay_refunds where id = v_refund_id;
  insert into public.financial_transactions(id, hotel_id, type, category, amount, currency, description, status,
    stay_id, reservation_id, payment_method, paid_at, created_by, reference_code, stay_refund_id, consumption_order_id)
  values (v_transaction_id, p_hotel_id, 'REFUND', 'STAY_REFUND', p_amount, v_stay.currency, btrim(p_reason),
    'COMPLETED', p_stay_id, v_stay.reservation_id, p_payment_method::text, public.hotel_operational_now(p_hotel_id), p_actor_id,
    nullif(btrim(p_reference), ''), v_refund_id,
    v_correction_order_id);
  insert into public.stay_folio_entries(id, hotel_id, stay_id, reservation_id, direction, kind, amount, currency,
    description, financial_transaction_id, consumption_order_id, consumption_correction_id, source_key, posted_by)
  values (v_debit_id, p_hotel_id, p_stay_id, v_stay.reservation_id, 'debit', 'refund', p_amount,
    v_stay.currency, btrim(p_reason), v_transaction_id,
    v_correction_order_id, p_correction_id,
    'stay-refund:' || v_refund_id::text, p_actor_id);
  if p_correction_id is not null then
    select id into v_adjustment_credit_id from public.stay_folio_entries
      where hotel_id = p_hotel_id and consumption_correction_id = p_correction_id
        and direction = 'credit' and kind = 'adjustment' limit 1;
    if v_adjustment_credit_id is null then
      insert into public.stay_folio_entries(hotel_id, stay_id, reservation_id, direction, kind, amount, currency,
        description, consumption_order_id, consumption_correction_id, source_key, posted_by)
      values (p_hotel_id, p_stay_id, v_stay.reservation_id, 'credit', 'adjustment', p_amount, v_stay.currency,
        'Ajuste de consumo aprovado', v_correction_order_id, p_correction_id,
        'consumption-correction:' || p_correction_id::text, p_actor_id)
      returning id into v_adjustment_credit_id;
    end if;
    insert into public.stay_folio_allocations(hotel_id, stay_id, credit_entry_id, debit_entry_id, amount, created_by)
    values (p_hotel_id, p_stay_id, v_adjustment_credit_id, v_debit_id, p_amount, p_actor_id);
    perform set_config('app.consumption_correction_write', 'on', true);
    update public.consumption_corrections set status = 'completed', completed_by = p_actor_id, completed_at = public.hotel_operational_now(p_hotel_id)
      where id = p_correction_id;
  end if;
  insert into public.stay_account_events(hotel_id, stay_id, entity_type, entity_id, action, actor_id, details)
  values (p_hotel_id, p_stay_id, 'refund', v_refund_id, 'refund_posted', p_actor_id,
    jsonb_build_object('amount', p_amount, 'method', p_payment_method, 'correction_id', p_correction_id));
  return jsonb_build_object('result', 'ok', 'refund_id', v_refund_id, 'created', true);
end;
$function$
;

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
 if p_metric in('unavailable_rooms','sellable_rooms') then return jsonb_build_object('result','ok','items',(select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'room_id',b.room_id,'start_date',b.start_date,'end_date',b.end_date)),'[]') from public.room_blocks b where b.hotel_id=p_hotel_id and b.released_at is null and b.start_date<=p_date and b.end_date>p_date));end if;
 if p_metric in('consumption_revenue') then return jsonb_build_object('result','ok','items',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'occurred_at',occurred_at,'amount',net_amount)),'[]') from public.consumption_orders where hotel_id=p_hotel_id and (occurred_at at time zone v_tz)::date=p_date and disposition='charged'));end if;
 if p_metric in('inventory_loss_quantity','inventory_loss_cost') then return jsonb_build_object('result','ok','items',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'product_id',product_id,'quantity',quantity_delta,'cost',total_cost,'occurred_at',occurred_at)),'[]') from public.inventory_movements where hotel_id=p_hotel_id and (occurred_at at time zone v_tz)::date=p_date and kind in('loss','count_loss')));end if;
 if p_metric in('maintenance_occurrences','maintenance_impact_room_hours','maintenance_recurrences') then return jsonb_build_object('result','ok','items',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'number',o.occurrence_number,'status',o.status,'discovered_at',o.discovered_at)),'[]') from public.maintenance_occurrences o where o.hotel_id=p_hotel_id and ((o.discovered_at at time zone v_tz)::date=p_date or exists(select 1 from public.maintenance_occurrence_affected_rooms ar where ar.occurrence_id=o.id and ar.impact_started_at<(p_date+1)::timestamp at time zone v_tz and coalesce(ar.impact_ended_at,public.hotel_operational_now(p_hotel_id))>p_date::timestamp at time zone v_tz))));end if;
 return jsonb_build_object('result','ok','items','[]'::jsonb);
end$function$
;

CREATE OR REPLACE FUNCTION public.follow_up_maintenance_waiting(p_hotel_id uuid, p_work_order_id uuid, p_actor_id uuid, p_notes text, p_next timestamp with time zone, p_expected_version integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v public.maintenance_waiting_episodes%rowtype;
begin select * into v from public.maintenance_waiting_episodes where work_order_id=p_work_order_id and hotel_id=p_hotel_id and resolved_at is null for update;
  if not found then return jsonb_build_object('result','not_found'); end if; if v.owner_id<>p_actor_id then return jsonb_build_object('result','conflict','context',jsonb_build_object('owner_id',v.owner_id)); end if; if v.version<>p_expected_version then return jsonb_build_object('result','conflict','version',v.version); end if;
  if p_next<=public.hotel_operational_now(p_hotel_id) or nullif(btrim(p_notes),'') is null then return jsonb_build_object('result','invalid'); end if;
  insert into public.maintenance_waiting_followups(hotel_id,episode_id,actor_id,notes,next_follow_up_at) values(p_hotel_id,v.id,p_actor_id,btrim(p_notes),p_next);
  update public.maintenance_waiting_episodes set next_follow_up_at=p_next,version=version+1 where id=v.id;
  insert into public.maintenance_events(hotel_id,occurrence_id,work_order_id,actor_id,event_type,message,metadata) select p_hotel_id,w.occurrence_id,w.id,p_actor_id,'waiting_follow_up',btrim(p_notes),jsonb_build_object('next_follow_up_at',p_next) from public.maintenance_work_orders w where w.id=p_work_order_id;
  return jsonb_build_object('result','ok'); end $function$
;

CREATE OR REPLACE FUNCTION public.get_stay_departure_review(p_hotel_id uuid, p_stay_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare v_stay public.stays%rowtype;v_blockers jsonb:='[]'::jsonb;v_payers jsonb;v record;
begin
  select stay.* into v_stay from public.stays stay join public.reservations reservation on reservation.id=stay.reservation_id where stay.id=p_stay_id and reservation.hotel_id=p_hotel_id;
  if not found then return null;end if;
  for v in select id,status,responsible_id,updated_at from public.consumption_service_orders where stay_id=p_stay_id and status in('received','preparing','ready') loop
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('type','open_order','label','Pedido '||v.status::text||' aguardando entrega ou cancelamento','responsible_id',v.responsible_id,'updated_at',v.updated_at,'action','Abrir pedidos'));
  end loop;
  if exists(select 1 from public.consumption_corrections where stay_id=p_stay_id and status in('pending','approved','awaiting_refund','awaiting_partner_refund')) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('type','open_correction','label','Correção ou reembolso ainda aberto','responsible_id',null,'updated_at',now(),'action','Revisar ajustes'));
  end if;
  for v in select entry.id,entry.description,entry.amount,coalesce(sum(allocation.amount),0) allocated,entry.posted_at from public.stay_folio_entries entry left join public.stay_payer_allocations allocation on allocation.folio_entry_id=entry.id where entry.stay_id=p_stay_id and entry.direction='debit' group by entry.id having coalesce(sum(allocation.amount),0)<>entry.amount loop
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('type','payer_allocation','label','Lançamento sem distribuição integral: '||v.description,'responsible_id',null,'updated_at',v.posted_at,'action','Distribuir pagadores'));
  end loop;
  select public.list_stay_payer_accounts(p_hotel_id,p_stay_id) into v_payers;
  for v in select * from jsonb_to_recordset(coalesce(v_payers->'items','[]'::jsonb)) x(id uuid,kind text,display_name text,balance numeric) where balance>0 loop
    if v.kind<>'company' then v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('type','payer_balance','label','Saldo pessoal em aberto: '||v.display_name,'responsible_id',null,'updated_at',now(),'action','Receber pagamento'));
    elsif not exists(select 1 from public.stay_payer_accounts payer join public.corporate_credit_authorizations auth on auth.stay_id=payer.stay_id and auth.corporate_account_id=payer.corporate_account_id where payer.id=v.id and auth.status='approved' and auth.expires_at>public.hotel_operational_now(p_hotel_id) and auth.amount_limit-auth.reserved_amount-auth.consumed_amount>=v.balance)
      then v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('type','corporate_credit','label','Crédito empresarial vencido, insuficiente ou não aprovado: '||v.display_name,'responsible_id',null,'updated_at',now(),'action','Revisar autorização'));end if;
  end loop;
  if exists(select 1 from public.governance_minibar_findings finding join public.governance_cycles cycle on cycle.id=finding.cycle_id where cycle.stay_id=p_stay_id and finding.discrepancy_only and finding.consumption_order_id is null) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('type','minibar_discrepancy','label','Divergência de frigobar sem tratamento financeiro','responsible_id',null,'updated_at',now(),'action','Abrir governança'));
  end if;
  return jsonb_build_object('stay_id',p_stay_id,'ready',jsonb_array_length(v_blockers)=0,'blockers',v_blockers,'payer_balances',coalesce(v_payers->'items','[]'::jsonb),'account_version',v_stay.account_version,'updated_at',now());
end $function$
;

CREATE OR REPLACE FUNCTION public.governance_create_defect(p_hotel_id uuid, p_cycle_id uuid, p_actor_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_cycle public.governance_cycles%rowtype; v_occurrence uuid; v_block uuid; v_blocking boolean:=coalesce((p_input->>'blocking')::boolean,false);
begin
  select * into v_cycle from public.governance_cycles where id=p_cycle_id and hotel_id=p_hotel_id for update;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if v_cycle.status in ('released','canceled') then return jsonb_build_object('result','invalid_state'); end if;
  if nullif(btrim(p_input->>'description'),'') is null or not exists(select 1 from public.maintenance_categories where id=(p_input->>'category_id')::uuid and hotel_id=p_hotel_id and is_active) then return jsonb_build_object('result','invalid'); end if;
  if v_blocking and nullif(p_input->>'block_end_date','') is null then return jsonb_build_object('result','invalid'); end if;
  v_occurrence:=public.create_maintenance_occurrence(p_hotel_id,(p_input->>'category_id')::uuid,v_cycle.room_id,null,v_cycle.stay_id,
    (p_input->>'kind')::public.maintenance_occurrence_kind,(p_input->>'priority')::public.maintenance_priority,btrim(p_input->>'description'),public.hotel_operational_now(p_hotel_id),p_actor_id,v_blocking);
  if v_blocking then
    v_block:=public.create_maintenance_room_block(p_hotel_id,v_occurrence,p_actor_id,(public.hotel_operational_now(p_hotel_id) at time zone (select timezone from public.hotels where id=p_hotel_id))::date,
      (p_input->>'block_end_date')::date,'maintenance','Governança: '||left(btrim(p_input->>'description'),80),nullif(btrim(p_input->>'conflict_acknowledgement'),''));
  end if;
  insert into public.governance_maintenance_links(hotel_id,cycle_id,occurrence_id,room_block_id,blocking) values(p_hotel_id,p_cycle_id,v_occurrence,v_block,v_blocking);
  insert into public.governance_events(hotel_id,cycle_id,actor_id,action,metadata) values(p_hotel_id,p_cycle_id,p_actor_id,'defect_reported',jsonb_build_object('occurrence_id',v_occurrence,'room_block_id',v_block,'blocking',v_blocking));
  return jsonb_build_object('result','ok','cycle_id',p_cycle_id,'occurrence_id',v_occurrence,'room_block_id',v_block);
exception when invalid_text_representation or not_null_violation or check_violation or exclusion_violation or foreign_key_violation then
  return jsonb_build_object('result','conflict');
end $function$
;

CREATE OR REPLACE FUNCTION public.list_consumption_service_orders(p_hotel_id uuid, p_status text DEFAULT NULL::text, p_point_id uuid DEFAULT NULL::uuid, p_search text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'items',coalesce(jsonb_agg(row_value order by row_value->>'expected_at' nulls last,row_value->>'created_at'),'[]'::jsonb),
    'summary',jsonb_build_object(
      'received',count(*) filter(where row_value->>'status'='received'),
      'preparing',count(*) filter(where row_value->>'status'='preparing'),
      'ready',count(*) filter(where row_value->>'status'='ready'),
      'late',count(*) filter(where row_value->>'status' in ('received','preparing','ready') and (row_value->>'expected_at')::timestamptz<public.hotel_operational_now(p_hotel_id))
    ),'updated_at',now()
  ) from (
    select to_jsonb(service_order)||jsonb_build_object(
      'room_number',room.room_number,'point_name',point.name,'guest_name',customer.full_name,
      'item_count',(select count(*) from public.consumption_service_order_items item where item.service_order_id=service_order.id)
    ) row_value
    from public.consumption_service_orders service_order
    join public.stays stay on stay.id=service_order.stay_id
    join public.rooms room on room.id=stay.room_id
    join public.consumption_points point on point.id=service_order.point_id
    left join public.customers customer on customer.id=service_order.guest_customer_id
    where service_order.hotel_id=p_hotel_id
      and (p_status is null or service_order.status::text=p_status)
      and (p_point_id is null or service_order.point_id=p_point_id)
      and (p_search is null or room.room_number ilike '%'||p_search||'%' or coalesce(customer.full_name,'') ilike '%'||p_search||'%')
  ) rows;
$function$
;

CREATE OR REPLACE FUNCTION public.pay_procurement_installment(p_hotel_id uuid, p_id uuid, p_actor_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ declare v_due record; x jsonb; v_total numeric; v_payment uuid; v_batch uuid; v_tx uuid; v_fp text:=md5(p_input::text);
begin select d.*,i.status invoice_status,i.version invoice_version,o.supplier_id,b.legal_name from public.procurement_invoice_due_dates d join public.procurement_invoices i on i.id=d.invoice_id join public.purchase_orders o on o.id=i.purchase_order_id join public.procurement_suppliers s on s.id=o.supplier_id join public.business_organizations b on b.id=s.organization_id where d.id=p_id and d.hotel_id=p_hotel_id for update into v_due;
 if not found then return jsonb_build_object('result','not_found'); end if; if v_due.invoice_version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict'); end if;
 select sum((tender->>'amount')::numeric) into v_total from jsonb_array_elements(p_input->'tenders') tender; if v_total<=0 or v_due.paid_amount+v_total>v_due.amount then return jsonb_build_object('result','invalid_amount'); end if;
 if exists(select 1 from jsonb_array_elements(p_input->'tenders') tender where tender->>'payment_method'='cash') and nullif(p_input->>'cash_session_id','') is null then return jsonb_build_object('result','cash_session_required'); end if;
 select id into v_batch from public.procurement_payment_batches where hotel_id=p_hotel_id and idempotency_key=(p_input->>'idempotency_key')::uuid and request_fingerprint=v_fp; if found then return jsonb_build_object('result','ok','id',v_batch); end if;
 if exists(select 1 from public.procurement_payment_batches where hotel_id=p_hotel_id and idempotency_key=(p_input->>'idempotency_key')::uuid) then return jsonb_build_object('result','idempotency_conflict'); end if;
 insert into public.procurement_payment_batches(hotel_id,installment_id,idempotency_key,request_fingerprint,total_amount,created_by) values(p_hotel_id,p_id,(p_input->>'idempotency_key')::uuid,v_fp,v_total,p_actor_id) returning id into v_batch;
 for x in select value from jsonb_array_elements(p_input->'tenders') loop
   insert into public.financial_transactions(hotel_id,type,category,amount,currency,description,status,payment_method,paid_at,counterparty,reference_code,created_by)
   values(p_hotel_id,'EXPENSE','PROCUREMENT',(x->>'amount')::numeric,(select o.currency from public.procurement_invoices inv join public.purchase_orders o on o.id=inv.purchase_order_id where inv.id=v_due.invoice_id),'Pagamento de fornecedor','COMPLETED',x->>'payment_method',public.hotel_operational_now(p_hotel_id),v_due.legal_name,x->>'reference_code',p_actor_id) returning id into v_tx;
   insert into public.procurement_payments(hotel_id,installment_id,payment_batch_id,financial_transaction_id,amount,payment_method,reference_code,cash_session_id,idempotency_key,request_fingerprint,paid_at,created_by)
   values(p_hotel_id,p_id,v_batch,v_tx,(x->>'amount')::numeric,x->>'payment_method',x->>'reference_code',(p_input->>'cash_session_id')::uuid,gen_random_uuid(),v_fp,public.hotel_operational_now(p_hotel_id),p_actor_id) returning id into v_payment;
 end loop;
 update public.procurement_invoice_due_dates set paid_amount=paid_amount+v_total,version=version+1 where id=p_id;
 update public.procurement_invoices set status=case when exists(select 1 from public.procurement_invoice_due_dates where invoice_id=v_due.invoice_id and id<>p_id and paid_amount<amount) or v_due.paid_amount+v_total<v_due.amount then 'partially_paid'::public.procurement_invoice_status else 'paid' end,version=version+1,updated_at=now() where id=v_due.invoice_id;
 return jsonb_build_object('result','ok','id',v_batch); end $function$
;

CREATE OR REPLACE FUNCTION public.reverse_maintenance_financial_settlement(p_hotel_id uuid, p_settlement_id uuid, p_actor_id uuid, p_reason text, p_reversed_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_settlement public.maintenance_financial_settlements%rowtype;
  v_original public.financial_transactions%rowtype;
  v_occurrence_id uuid;
  v_work_order_id uuid;
  v_transaction_id uuid;
  v_stay_id uuid;
  v_reservation_id uuid;
  v_original_entry_id uuid;
  v_net numeric(12,2);
  v_target_amount numeric(12,2);
begin
  if nullif(btrim(p_reason), '') is null then
    raise exception 'settlement reversal requires reason' using errcode = '23514';
  end if;
  select * into v_settlement from public.maintenance_financial_settlements
  where id = p_settlement_id and hotel_id = p_hotel_id for update;
  if not found then return null; end if;
  if v_settlement.reversal_of_id is not null or exists (
    select 1 from public.maintenance_financial_settlements where reversal_of_id = p_settlement_id
  ) then raise exception 'settlement already reversed' using errcode = '23514'; end if;
  select * into v_original from public.financial_transactions
  where id = v_settlement.financial_transaction_id for update;

  if v_settlement.cost_item_id is not null then
    select occurrence_id, work_order_id, actual_amount into v_occurrence_id, v_work_order_id, v_target_amount
    from public.maintenance_cost_items where id = v_settlement.cost_item_id;
  else
    select occurrence_id, stay_id, charge_amount into v_occurrence_id, v_stay_id, v_target_amount
    from public.maintenance_recoveries where id = v_settlement.recovery_id;
  end if;

  insert into public.financial_transactions(
    hotel_id, type, category, amount, currency, description, status, stay_id,
    reservation_id, payment_method, paid_at, counterparty, reference_code,
    created_by, maintenance_cost_item_id, maintenance_recovery_id
  ) values (
    p_hotel_id, 'REFUND', 'MAINTENANCE_REVERSAL', v_settlement.amount,
    v_original.currency, btrim(p_reason), 'COMPLETED', v_original.stay_id,
    v_original.reservation_id, v_original.payment_method, coalesce(p_reversed_at, public.hotel_operational_now(p_hotel_id)),
    v_original.counterparty, 'REV-' || v_original.id::text, p_actor_id,
    v_settlement.cost_item_id, v_settlement.recovery_id
  ) returning id into v_transaction_id;

  insert into public.maintenance_financial_settlements(
    hotel_id, cost_item_id, recovery_id, financial_transaction_id, amount,
    created_by, reversal_of_id
  ) values (
    p_hotel_id, v_settlement.cost_item_id, v_settlement.recovery_id,
    v_transaction_id, v_settlement.amount, p_actor_id, p_settlement_id
  );

  if v_stay_id is not null then
    select reservation_id into v_reservation_id from public.stays where id = v_stay_id;
    select id into v_original_entry_id from public.stay_folio_entries
    where financial_transaction_id = v_original.id;
    insert into public.stay_folio_entries(
      hotel_id, stay_id, reservation_id, direction, kind, amount, currency,
      description, maintenance_occurrence_id, financial_transaction_id,
      reversed_entry_id, source_key, posted_by
    ) values (
      p_hotel_id, v_stay_id, v_reservation_id, 'debit', 'refund',
      v_settlement.amount, v_original.currency, btrim(p_reason), v_occurrence_id,
      v_transaction_id, v_original_entry_id,
      'maintenance-settlement-reversal:' || p_settlement_id::text, p_actor_id
    );
    update public.stays set total_paid = greatest(total_paid - v_settlement.amount, 0)
    where id = v_stay_id;
  end if;

  select coalesce(sum(case when reversal_of_id is null then amount else -amount end), 0)
    into v_net from public.maintenance_financial_settlements
    where (v_settlement.cost_item_id is not null and cost_item_id = v_settlement.cost_item_id)
       or (v_settlement.recovery_id is not null and recovery_id = v_settlement.recovery_id);
  if v_settlement.cost_item_id is not null then
    update public.maintenance_cost_items set settlement_status = case
      when v_net <= 0 then 'open'::public.maintenance_finance_settlement_status
      when v_net < v_target_amount then 'partially_settled'::public.maintenance_finance_settlement_status
      else 'settled'::public.maintenance_finance_settlement_status end
    where id = v_settlement.cost_item_id;
  else
    update public.maintenance_recoveries set settlement_status = case
      when v_net <= 0 then 'open'::public.maintenance_finance_settlement_status
      when v_net < v_target_amount then 'partially_settled'::public.maintenance_finance_settlement_status
      else 'settled'::public.maintenance_finance_settlement_status end
    where id = v_settlement.recovery_id;
  end if;
  insert into public.maintenance_events(
    hotel_id, occurrence_id, work_order_id, actor_id, event_type, message, metadata
  ) values (
    p_hotel_id, v_occurrence_id, v_work_order_id, p_actor_id,
    'finance_settlement_reversed', btrim(p_reason),
    jsonb_build_object('settlement_id', p_settlement_id, 'transaction_id', v_transaction_id, 'amount', v_settlement.amount)
  );
  return v_occurrence_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.save_maintenance_recurrence_policy(p_hotel_id uuid, p_actor_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v public.maintenance_recurrence_policies%rowtype; v_category uuid:=nullif(p_input->>'category_id','')::uuid;
begin
  select * into v from public.maintenance_recurrence_policies where hotel_id=p_hotel_id and category_id is not distinct from v_category and is_active for update;
  if found then
    if v.version<>coalesce((p_input->>'expected_version')::int,v.version) then return jsonb_build_object('result','conflict','context',jsonb_build_object('version',v.version)); end if;
    update public.maintenance_recurrence_policies set window_days=(p_input->>'window_days')::int,occurrence_threshold=(p_input->>'occurrence_threshold')::int,created_by=coalesce(created_by,p_actor_id),version=version+1 where id=v.id;
  else
    insert into public.maintenance_recurrence_policies(hotel_id,category_id,window_days,occurrence_threshold,created_by) values(p_hotel_id,v_category,(p_input->>'window_days')::int,(p_input->>'occurrence_threshold')::int,p_actor_id) returning * into v;
  end if;
  perform public.refresh_maintenance_recurrence(p_hotel_id,public.hotel_operational_now(p_hotel_id));
  return jsonb_build_object('result','ok');
exception when invalid_text_representation or check_violation or unique_violation or foreign_key_violation then return jsonb_build_object('result','invalid'); end $function$
;

CREATE OR REPLACE FUNCTION public.settle_maintenance_cost_item(p_hotel_id uuid, p_cost_item_id uuid, p_actor_id uuid, p_amount numeric, p_method text, p_paid_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_reference_code text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_item public.maintenance_cost_items%rowtype;
  v_paid numeric(12,2);
  v_transaction_id uuid;
begin
  select * into v_item from public.maintenance_cost_items where id = p_cost_item_id and hotel_id = p_hotel_id for update;
  if not found then return null; end if;
  select coalesce(sum(case when reversal_of_id is null then amount else -amount end), 0)
    into v_paid from public.maintenance_financial_settlements where cost_item_id = p_cost_item_id;
  if v_item.approval_status <> 'approved' or p_amount <= 0 or v_paid + p_amount > v_item.actual_amount
    or nullif(btrim(p_method), '') is null then raise exception 'invalid maintenance cost settlement' using errcode = '23514'; end if;
  insert into public.financial_transactions(
    hotel_id, type, category, amount, currency, description, status, payment_method, paid_at,
    due_date, counterparty, reference_code, created_by, maintenance_cost_item_id
  ) values (
    p_hotel_id, 'EXPENSE', 'MAINTENANCE', p_amount, v_item.currency, coalesce(nullif(btrim(p_note), ''), v_item.description),
    'COMPLETED', btrim(p_method), coalesce(p_paid_at, public.hotel_operational_now(p_hotel_id)), v_item.due_date, v_item.counterparty,
    coalesce(nullif(btrim(p_reference_code), ''), v_item.reference_code), p_actor_id, p_cost_item_id
  ) returning id into v_transaction_id;
  insert into public.maintenance_financial_settlements(hotel_id, cost_item_id, financial_transaction_id, amount, created_by)
  values (p_hotel_id, p_cost_item_id, v_transaction_id, p_amount, p_actor_id);
  update public.maintenance_cost_items set settlement_status = case
    when v_paid + p_amount = actual_amount then 'settled'::public.maintenance_finance_settlement_status
    else 'partially_settled'::public.maintenance_finance_settlement_status end
  where id = p_cost_item_id;
  insert into public.maintenance_events(hotel_id, occurrence_id, work_order_id, actor_id, event_type, message, metadata)
  values (p_hotel_id, v_item.occurrence_id, v_item.work_order_id, p_actor_id, 'finance_cost_settled', nullif(btrim(p_note), ''),
    jsonb_build_object('cost_item_id', p_cost_item_id, 'transaction_id', v_transaction_id, 'amount', p_amount));
  return v_item.occurrence_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.settle_maintenance_recovery(p_hotel_id uuid, p_recovery_id uuid, p_actor_id uuid, p_amount numeric, p_method text, p_paid_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_reference_code text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_allocations jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_item public.maintenance_recoveries%rowtype;
  v_received numeric(12,2);
  v_transaction_id uuid;
begin
  select * into v_item from public.maintenance_recoveries where id = p_recovery_id and hotel_id = p_hotel_id for update;
  if not found then return null; end if;
  select coalesce(sum(case when reversal_of_id is null then amount else -amount end), 0)
    into v_received from public.maintenance_financial_settlements where recovery_id = p_recovery_id;
  if v_item.approval_status <> 'approved' or p_amount <= 0 or v_received + p_amount > v_item.charge_amount
    or nullif(btrim(p_method), '') is null then raise exception 'invalid maintenance recovery settlement' using errcode = '23514'; end if;
  if v_item.responsible_party = 'guest' then
    v_transaction_id := public.create_stay_folio_payment(p_hotel_id, v_item.stay_id, p_actor_id, p_amount, p_method,
      p_note, p_paid_at, coalesce(p_allocations, jsonb_build_array(jsonb_build_object('debit_entry_id', v_item.folio_entry_id, 'amount', p_amount))), p_recovery_id);
  else
    insert into public.financial_transactions(
      hotel_id, type, category, amount, currency, description, status, payment_method, paid_at,
      counterparty, reference_code, created_by, maintenance_recovery_id
    ) values (
      p_hotel_id, 'INCOME', 'DAMAGE_RECOVERY', p_amount, v_item.currency, coalesce(nullif(btrim(p_note), ''), v_item.justification),
      'COMPLETED', btrim(p_method), coalesce(p_paid_at, public.hotel_operational_now(p_hotel_id)), v_item.debtor_name,
      nullif(btrim(p_reference_code), ''), p_actor_id, p_recovery_id
    ) returning id into v_transaction_id;
  end if;
  insert into public.maintenance_financial_settlements(hotel_id, recovery_id, financial_transaction_id, amount, created_by)
  values (p_hotel_id, p_recovery_id, v_transaction_id, p_amount, p_actor_id);
  update public.maintenance_recoveries set settlement_status = case
    when v_received + p_amount = charge_amount then 'settled'::public.maintenance_finance_settlement_status
    else 'partially_settled'::public.maintenance_finance_settlement_status end
  where id = p_recovery_id;
  insert into public.maintenance_events(hotel_id, occurrence_id, actor_id, event_type, message, metadata)
  values (p_hotel_id, v_item.occurrence_id, p_actor_id, 'finance_recovery_settled', nullif(btrim(p_note), ''),
    jsonb_build_object('recovery_id', p_recovery_id, 'transaction_id', v_transaction_id, 'amount', p_amount));
  return v_item.occurrence_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.transition_maintenance_work_order(p_hotel_id uuid, p_work_order_id uuid, p_actor_id uuid, p_action text, p_assigned_to uuid DEFAULT NULL::uuid, p_waiting_reason maintenance_waiting_reason DEFAULT NULL::maintenance_waiting_reason, p_notes text DEFAULT NULL::text, p_diagnosis text DEFAULT NULL::text, p_waiting_owner_id uuid DEFAULT NULL::uuid, p_next_follow_up_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_supplier_id uuid DEFAULT NULL::uuid, p_contract_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_order public.maintenance_work_orders%rowtype; v_next public.maintenance_work_order_status;
begin
  p_notes:=nullif(btrim(p_notes),''); p_diagnosis:=nullif(btrim(p_diagnosis),'');
  if length(p_notes)>4000 or length(p_diagnosis)>4000 then raise exception 'Texto excede 4000 caracteres.' using errcode='23514'; end if;
  if p_action in ('pause','wait','complete','cancel','reopen') and p_notes is null then raise exception 'Informe o motivo ou serviço realizado.' using errcode='23514'; end if;
  if p_action='complete' and p_diagnosis is null then raise exception 'Informe o diagnóstico.' using errcode='23514'; end if;
  if p_action='wait' and (p_waiting_owner_id is null or p_next_follow_up_at is null or p_next_follow_up_at<=public.hotel_operational_now(p_hotel_id)) then raise exception 'Informe responsável e próxima cobrança futura.' using errcode='23514'; end if;
  select * into v_order from public.maintenance_work_orders where id=p_work_order_id and hotel_id=p_hotel_id for update;
  if not found then return null; end if;
  if p_action='assign' and v_order.status in ('pending','assigned','paused','waiting','in_progress') then v_next:=case when p_assigned_to is null then 'pending' else 'assigned' end;
  elsif p_action='start' and v_order.status='assigned' then v_next:='in_progress';
  elsif p_action='pause' and v_order.status='in_progress' then v_next:='paused';
  elsif p_action='wait' and v_order.status='in_progress' and p_waiting_reason is not null then v_next:='waiting';
  elsif p_action='resume' and v_order.status in ('paused','waiting') then v_next:='in_progress';
  elsif p_action='complete' and v_order.status='in_progress' then
    if exists(select 1 from public.maintenance_work_order_checklist_items where work_order_id=p_work_order_id and is_required and completed_at is null) then raise exception 'Há itens obrigatórios do checklist pendentes.' using errcode='23514'; end if;
    v_next:=case when v_order.requires_inspection then 'awaiting_inspection' else 'completed' end;
  elsif p_action='cancel' and v_order.status in ('pending','assigned','in_progress','paused','waiting') then v_next:='canceled';
  elsif p_action='reopen' and v_order.status='completed' then v_next:=case when v_order.assigned_to is null then 'pending' else 'in_progress' end;
  else raise exception 'Transição de ordem de trabalho inválida.' using errcode='23514'; end if;
  update public.maintenance_work_orders set status=v_next,assigned_to=case when p_action='assign' then p_assigned_to else assigned_to end,
    waiting_reason=case when p_action='wait' then p_waiting_reason when p_action='resume' then null else waiting_reason end,
    waiting_notes=case when p_action='wait' then p_notes when p_action='resume' then null else waiting_notes end,
    diagnosis=case when p_action='complete' then p_diagnosis else diagnosis end,
    resolution_notes=case when p_action in ('complete','cancel') then p_notes else resolution_notes end,
    started_at=case when p_action='start' then coalesce(started_at,public.hotel_operational_now(p_hotel_id)) else started_at end,
    completed_at=case when v_next='completed' then public.hotel_operational_now(p_hotel_id) when p_action in ('complete','reopen') then null else completed_at end,version=version+1 where id=p_work_order_id;
  if p_action in ('start','resume','reopen') and not exists(select 1 from public.maintenance_execution_sessions where work_order_id=p_work_order_id and ended_at is null) then insert into public.maintenance_execution_sessions(hotel_id,work_order_id,technician_id) values(p_hotel_id,p_work_order_id,coalesce(v_order.assigned_to,p_actor_id)); end if;
  if p_action in ('pause','wait','complete','cancel') then update public.maintenance_execution_sessions set ended_at=public.hotel_operational_now(p_hotel_id),end_reason=p_action where work_order_id=p_work_order_id and ended_at is null; end if;
  if p_action='wait' then insert into public.maintenance_waiting_episodes(hotel_id,work_order_id,reason,description,owner_id,supplier_id,contract_id,next_follow_up_at) values(p_hotel_id,p_work_order_id,p_waiting_reason,p_notes,p_waiting_owner_id,p_supplier_id,p_contract_id,p_next_follow_up_at); end if;
  if p_action='resume' then update public.maintenance_waiting_episodes set resolved_at=public.hotel_operational_now(p_hotel_id),resolved_by=p_actor_id,version=version+1 where work_order_id=p_work_order_id and resolved_at is null; end if;
  update public.maintenance_schedules set status=case when p_action in ('start','resume') then 'in_progress'::public.maintenance_schedule_status when p_action='complete' then 'completed'::public.maintenance_schedule_status when p_action='cancel' then 'canceled'::public.maintenance_schedule_status else status end,version=version+1,canceled_by=case when p_action='cancel' then p_actor_id else canceled_by end,canceled_at=case when p_action='cancel' then public.hotel_operational_now(p_hotel_id) else canceled_at end where work_order_id=p_work_order_id and status<>'canceled';
  insert into public.maintenance_events(hotel_id,occurrence_id,work_order_id,actor_id,event_type,message,metadata) values(p_hotel_id,v_order.occurrence_id,p_work_order_id,p_actor_id,'work_order_'||p_action,p_notes,jsonb_build_object('previous_status',v_order.status,'status',v_next,'assigned_to',p_assigned_to,'waiting_owner_id',p_waiting_owner_id,'next_follow_up_at',p_next_follow_up_at));
  perform public.recompute_maintenance_occurrence_status(v_order.occurrence_id); return v_order.occurrence_id;
end $function$
;
