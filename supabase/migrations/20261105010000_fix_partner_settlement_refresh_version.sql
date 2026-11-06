-- Só a criação da apuração, que não recebe versão esperada, mantém a versão.
-- A regra antiga comparava created_at com updated_at, ainda iguais no primeiro recálculo:
-- ele não incrementava a versão, e um formulário com a versão anterior continuava aceito.
create or replace function public.refresh_partner_settlement(
  p_hotel_id uuid, p_partner_id uuid, p_period_start date, p_actor_id uuid,
  p_expected_version bigint default null
) returns jsonb language plpgsql set search_path = public as $$
declare
  v_hotel record; v_settings public.consumption_management_settings%rowtype; v_settlement public.partner_settlements%rowtype;
  v_revision record; v_component_id uuid; v_origin record; v_period_end date;
  v_days numeric; v_month_days numeric; v_divisor numeric; v_monthly_rent numeric; v_monthly_minimum numeric;
  v_gross numeric(14,2); v_discount numeric(14,2); v_courtesy numeric(14,2); v_reversal numeric(14,2);
  v_net numeric(14,2); v_hotel_collected numeric(14,2); v_partner_direct numeric(14,2);
  v_rent numeric(14,2); v_commission numeric(14,2); v_minimum numeric(14,2); v_topup numeric(14,2); v_contribution numeric(14,2);
  v_delta_net numeric(14,2); v_delta_hotel numeric(14,2); v_delta_partner numeric(14,2);
  v_last_base numeric(14,2); v_last_contribution numeric(14,2); v_restated_contribution numeric(14,2); v_delta_contribution numeric(14,2);
  v_fingerprint text;
begin
  if not public.maintenance_user_has_hotel_scope(p_actor_id, p_hotel_id) then return jsonb_build_object('result','actor_outside_hotel'); end if;
  if p_period_start <> date_trunc('month', p_period_start)::date then return jsonb_build_object('result','invalid_period'); end if;
  select id, timezone, currency into v_hotel from public.hotels where id = p_hotel_id and is_active;
  if not found then return jsonb_build_object('result','hotel_not_found'); end if;
  if not exists (select 1 from public.commercial_partners where id=p_partner_id and hotel_id=p_hotel_id) then return jsonb_build_object('result','partner_not_found'); end if;
  select * into v_settings from public.consumption_management_settings where hotel_id=p_hotel_id;
  if p_period_start < v_settings.settlement_tracking_starts_on then return jsonb_build_object('result','period_before_tracking'); end if;
  v_period_end := (p_period_start + interval '1 month - 1 day')::date;

  select * into v_settlement from public.partner_settlements
  where hotel_id=p_hotel_id and partner_id=p_partner_id and period_start=p_period_start for update;
  if found then
    if p_expected_version is null then return jsonb_build_object('result','settlement_already_exists'); end if;
    if v_settlement.status in ('approved','settled') then return jsonb_build_object('result','settlement_invalid_state'); end if;
    if p_expected_version is not null and p_expected_version <> v_settlement.version then return jsonb_build_object('result','settlement_version_conflict'); end if;
    delete from public.partner_settlement_sources where settlement_id=v_settlement.id;
    delete from public.partner_settlement_components where settlement_id=v_settlement.id;
  else
    insert into public.partner_settlements(
      hotel_id, partner_id, period_start, period_end, currency, due_on, created_by, prepared_by, prepared_at
    ) values (
      p_hotel_id, p_partner_id, p_period_start, v_period_end, v_hotel.currency,
      v_period_end + v_settings.payment_due_days, p_actor_id, p_actor_id, now()
    ) returning * into v_settlement;
  end if;

  v_month_days := extract(day from v_period_end);
  for v_revision in
    select revision.*, agreement.internal_number
    from public.commercial_agreement_revisions revision
    join public.commercial_agreements agreement on agreement.id=revision.agreement_id and agreement.hotel_id=revision.hotel_id
    where revision.hotel_id=p_hotel_id and agreement.partner_id=p_partner_id
      and revision.status in ('activated','terminated')
      and revision.starts_on <= v_period_end and coalesce(revision.ends_on, 'infinity'::date) >= p_period_start
    order by revision.starts_on, revision.version
  loop
    select
      coalesce(sum(case when orders.disposition <> 'legacy_unclassified' then item.item_total_amount else 0 end),0),
      coalesce(sum(case when orders.disposition='charged' then effective.effective_discount else 0 end),0),
      coalesce(sum(case when orders.disposition='courtesy' then item.item_total_amount else 0 end),0),
      coalesce(sum(case when orders.disposition='charged' then greatest(item.net_amount-effective.effective_net_amount,0) else 0 end),0),
      coalesce(sum(case when orders.disposition='charged' then effective.effective_net_amount else 0 end),0),
      coalesce(sum(case when orders.disposition='charged' and orders.billing_mode in ('stay_folio','hotel_immediate') then effective.effective_net_amount else 0 end),0),
      coalesce(sum(case when orders.disposition='charged' and orders.billing_mode='partner_direct' then effective.effective_net_amount else 0 end),0)
    into v_gross,v_discount,v_courtesy,v_reversal,v_net,v_hotel_collected,v_partner_direct
    from public.consumption_order_item_effective effective
    join public.consumption_order_items item on item.id=effective.id
    join public.consumption_orders orders on orders.id=item.order_id and orders.hotel_id=p_hotel_id
    where item.commercial_partner_id=p_partner_id and item.commercial_revision_id=v_revision.id and not orders.is_legacy
      and (orders.occurred_at at time zone v_hotel.timezone)::date between p_period_start and v_period_end;

    v_days := greatest(0, least(v_period_end, coalesce(v_revision.ends_on,v_period_end))-greatest(p_period_start,v_revision.starts_on)+1);
    v_divisor := case v_revision.rent_frequency when 'quarterly' then 3 when 'yearly' then 12 else 1 end;
    v_monthly_rent := coalesce(v_revision.fixed_rent,0)/v_divisor;
    v_monthly_minimum := coalesce(v_revision.minimum_guarantee,0)/v_divisor;
    v_rent := round(v_monthly_rent*v_days/v_month_days,2);
    v_minimum := round(v_monthly_minimum*v_days/v_month_days,2);
    v_commission := round(v_net*coalesce(v_revision.commission_percentage,0)/100,2);
    v_contribution := case v_revision.commercial_model
      when 'fixed_rent' then v_rent
      when 'revenue_share' then v_commission
      else greatest(v_rent+v_commission,v_minimum) end;
    v_topup := case when v_revision.commercial_model='hybrid' then greatest(v_minimum-(v_rent+v_commission),0) else 0 end;

    insert into public.partner_settlement_components(
      hotel_id,settlement_id,source_kind,agreement_id,revision_id,agreement_number,revision_version,
      segment_start,segment_end,commercial_model,fixed_rent,rent_frequency,commission_percentage,minimum_guarantee,payment_recipient,
      gross_sales,discount_total,courtesy_total,reversal_total,operational_net,hotel_collected,partner_direct,
      prorated_rent,commission_amount,prorated_minimum_guarantee,minimum_guarantee_topup,contribution_amount,net_settlement_amount,calculation_memory
    ) values (
      p_hotel_id,v_settlement.id,'regular',v_revision.agreement_id,v_revision.id,v_revision.internal_number,v_revision.version,
      greatest(p_period_start,v_revision.starts_on),least(v_period_end,coalesce(v_revision.ends_on,v_period_end)),v_revision.commercial_model,
      v_revision.fixed_rent,v_revision.rent_frequency,v_revision.commission_percentage,v_revision.minimum_guarantee,v_revision.payment_recipient,
      v_gross,v_discount,v_courtesy,v_reversal,v_net,v_hotel_collected,v_partner_direct,
      v_rent,v_commission,v_minimum,v_topup,v_contribution,v_hotel_collected-v_contribution,
      jsonb_build_object('active_days',v_days,'month_days',v_month_days,'rent_divisor',v_divisor,'commission_base',v_net)
    ) returning id into v_component_id;

    insert into public.partner_settlement_sources(
      hotel_id,settlement_id,component_id,source_kind,order_id,order_item_id,occurred_at,point_id,point_name,
      product_id,product_name,category_id,category_name,stay_id,reservation_code,room_number,billing_mode,payment_method,
      disposition,provider_type,gross_amount,discount_amount,reversal_amount,operational_net,hotel_collected,partner_direct,source_snapshot
    )
    select p_hotel_id,v_settlement.id,v_component_id,'regular',orders.id,item.id,orders.occurred_at,orders.point_id,orders.point_name_snapshot,
      item.product_id,item.product_name_snapshot,item.category_id,item.category_name_snapshot,orders.stay_id,orders.reservation_code_snapshot,
      orders.room_number_snapshot,orders.billing_mode,orders.payment_method,orders.disposition,item.provider_type_snapshot,
      case when orders.disposition='legacy_unclassified' then 0 else item.item_total_amount end,
      case when orders.disposition='charged' then effective.effective_discount else 0 end,
      case when orders.disposition='charged' then greatest(item.net_amount-effective.effective_net_amount,0) else 0 end,
      case when orders.disposition='charged' then effective.effective_net_amount else 0 end,
      case when orders.disposition='charged' and orders.billing_mode in ('stay_folio','hotel_immediate') then effective.effective_net_amount else 0 end,
      case when orders.disposition='charged' and orders.billing_mode='partner_direct' then effective.effective_net_amount else 0 end,
      jsonb_build_object('order_id',orders.id,'item_id',item.id,'quantity',item.quantity,'effective_quantity',effective.effective_quantity,
        'unit_price',item.charged_unit_price,'terms',item.commercial_terms_snapshot,'policy',item.billing_policy_snapshot)
    from public.consumption_order_item_effective effective
    join public.consumption_order_items item on item.id=effective.id
    join public.consumption_orders orders on orders.id=item.order_id and orders.hotel_id=p_hotel_id
    where item.commercial_partner_id=p_partner_id and item.commercial_revision_id=v_revision.id and not orders.is_legacy
      and (orders.occurred_at at time zone v_hotel.timezone)::date between p_period_start and v_period_end;
  end loop;

  for v_origin in
    select distinct origin.*
    from public.partner_settlement_components origin
    join public.partner_settlements original_settlement on original_settlement.id=origin.settlement_id
    join public.partner_settlement_sources original_source on original_source.component_id=origin.id and original_source.source_kind='regular'
    join public.consumption_correction_items correction_item on correction_item.order_item_id=original_source.order_item_id
    join public.consumption_corrections correction on correction.id=correction_item.correction_id and correction.status='completed'
    where original_settlement.hotel_id=p_hotel_id and original_settlement.partner_id=p_partner_id
      and original_settlement.status in ('approved','settled') and original_settlement.period_end < p_period_start
      and correction.completed_at <= ((v_period_end+1)::timestamp at time zone v_hotel.timezone)
      and not exists (select 1 from public.partner_settlement_sources recognized where recognized.correction_item_id=correction_item.id)
  loop
    select
      -coalesce(sum(correction_item.previous_net-correction_item.resulting_net),0),
      -coalesce(sum(case when orders.billing_mode in ('stay_folio','hotel_immediate') then correction_item.previous_net-correction_item.resulting_net else 0 end),0),
      -coalesce(sum(case when orders.billing_mode='partner_direct' then correction_item.previous_net-correction_item.resulting_net else 0 end),0)
    into v_delta_net,v_delta_hotel,v_delta_partner
    from public.partner_settlement_sources original_source
    join public.consumption_correction_items correction_item on correction_item.order_item_id=original_source.order_item_id
    join public.consumption_corrections correction on correction.id=correction_item.correction_id and correction.status='completed'
    join public.consumption_orders orders on orders.id=original_source.order_id
    where original_source.component_id=v_origin.id
      and correction.completed_at <= ((v_period_end+1)::timestamp at time zone v_hotel.timezone)
      and not exists (select 1 from public.partner_settlement_sources recognized where recognized.correction_item_id=correction_item.id);
    if v_delta_net = 0 then continue; end if;
    select v_origin.operational_net+coalesce(sum(adjustment.operational_net),0),
      v_origin.contribution_amount+coalesce(sum(adjustment.contribution_amount),0)
    into v_last_base,v_last_contribution
    from public.partner_settlement_components adjustment
    where adjustment.origin_component_id=v_origin.id;
    v_commission := round((v_last_base+v_delta_net)*coalesce(v_origin.commission_percentage,0)/100,2);
    v_restated_contribution := case v_origin.commercial_model
      when 'fixed_rent' then v_origin.prorated_rent
      when 'revenue_share' then v_commission
      else greatest(v_origin.prorated_rent+v_commission,v_origin.prorated_minimum_guarantee) end;
    v_delta_contribution := v_restated_contribution-v_last_contribution;
    insert into public.partner_settlement_components(
      hotel_id,settlement_id,source_kind,agreement_id,revision_id,origin_component_id,agreement_number,revision_version,
      segment_start,segment_end,commercial_model,fixed_rent,rent_frequency,commission_percentage,minimum_guarantee,payment_recipient,
      operational_net,hotel_collected,partner_direct,commission_amount,contribution_amount,net_settlement_amount,calculation_memory
    ) values (
      p_hotel_id,v_settlement.id,'late_correction',v_origin.agreement_id,v_origin.revision_id,v_origin.id,v_origin.agreement_number,v_origin.revision_version,
      v_origin.segment_start,v_origin.segment_end,v_origin.commercial_model,v_origin.fixed_rent,v_origin.rent_frequency,
      v_origin.commission_percentage,v_origin.minimum_guarantee,v_origin.payment_recipient,
      v_delta_net,v_delta_hotel,v_delta_partner,v_delta_contribution,v_delta_contribution,v_delta_hotel-v_delta_contribution,
      jsonb_build_object('previous_base',v_last_base,'restated_base',v_last_base+v_delta_net,
        'previous_contribution',v_last_contribution,'restated_contribution',v_restated_contribution)
    ) returning id into v_component_id;
    update public.partner_settlement_components set reversal_total = -v_delta_net where id = v_component_id;
    insert into public.partner_settlement_sources(
      hotel_id,settlement_id,component_id,source_kind,order_id,order_item_id,correction_id,correction_item_id,original_settlement_id,
      occurred_at,completed_at,point_id,point_name,product_id,product_name,category_id,category_name,stay_id,reservation_code,room_number,
      billing_mode,payment_method,disposition,provider_type,reversal_amount,operational_net,hotel_collected,partner_direct,source_snapshot
    )
    select p_hotel_id,v_settlement.id,v_component_id,'late_correction',orders.id,item.id,correction.id,correction_item.id,original_source.settlement_id,
      orders.occurred_at,correction.completed_at,orders.point_id,orders.point_name_snapshot,item.product_id,item.product_name_snapshot,
      item.category_id,item.category_name_snapshot,orders.stay_id,orders.reservation_code_snapshot,orders.room_number_snapshot,
      orders.billing_mode,orders.payment_method,orders.disposition,item.provider_type_snapshot,
      correction_item.previous_net-correction_item.resulting_net,
      -(correction_item.previous_net-correction_item.resulting_net),
      case when orders.billing_mode in ('stay_folio','hotel_immediate') then -(correction_item.previous_net-correction_item.resulting_net) else 0 end,
      case when orders.billing_mode='partner_direct' then -(correction_item.previous_net-correction_item.resulting_net) else 0 end,
      jsonb_build_object('correction_id',correction.id,'correction_item_id',correction_item.id,'reason',correction.reason,
        'previous_net',correction_item.previous_net,'resulting_net',correction_item.resulting_net)
    from public.partner_settlement_sources original_source
    join public.consumption_order_items item on item.id=original_source.order_item_id
    join public.consumption_orders orders on orders.id=original_source.order_id
    join public.consumption_correction_items correction_item on correction_item.order_item_id=original_source.order_item_id
    join public.consumption_corrections correction on correction.id=correction_item.correction_id and correction.status='completed'
    where original_source.component_id=v_origin.id
      and correction.completed_at <= ((v_period_end+1)::timestamp at time zone v_hotel.timezone)
      and not exists (select 1 from public.partner_settlement_sources recognized where recognized.correction_item_id=correction_item.id);
  end loop;

  select coalesce(sum(gross_sales),0),coalesce(sum(discount_total),0),coalesce(sum(courtesy_total),0),coalesce(sum(reversal_total),0),
    greatest(coalesce(sum(operational_net),0),0),greatest(coalesce(sum(hotel_collected),0),0),greatest(coalesce(sum(partner_direct),0),0),
    coalesce(sum(prorated_rent),0),coalesce(sum(commission_amount),0),coalesce(sum(minimum_guarantee_topup),0),
    coalesce(sum(contribution_amount),0),coalesce(sum(net_settlement_amount),0)
  into v_gross,v_discount,v_courtesy,v_reversal,v_net,v_hotel_collected,v_partner_direct,v_rent,v_commission,v_topup,v_contribution,v_delta_net
  from public.partner_settlement_components where settlement_id=v_settlement.id;
  v_fingerprint := public.partner_settlement_live_fingerprint(p_hotel_id,p_partner_id,p_period_start);
  update public.partner_settlements set
    status='draft',version=version+case when p_expected_version is null then 0 else 1 end,
    gross_sales=v_gross,discount_total=v_discount,courtesy_total=v_courtesy,reversal_total=v_reversal,
    operational_net=v_net,hotel_collected=v_hotel_collected,partner_direct=v_partner_direct,
    rent_total=v_rent,commission_total=v_commission,minimum_guarantee_topup=v_topup,
    contribution_total=v_contribution,net_settlement=v_delta_net,
    direction=case when v_delta_net>0 then 'hotel_to_partner'::public.partner_settlement_direction when v_delta_net<0 then 'partner_to_hotel'::public.partner_settlement_direction else 'balanced'::public.partner_settlement_direction end,
    due_on=v_period_end+v_settings.payment_due_days,source_fingerprint=v_fingerprint,statement_snapshot=null,
    prepared_by=p_actor_id,prepared_at=now(),submitted_by=null,submitted_at=null,updated_at=now()
  where id=v_settlement.id returning * into v_settlement;
  insert into public.partner_settlement_events(hotel_id,settlement_id,action,actor_id,details)
  values (p_hotel_id,v_settlement.id,'calculated',p_actor_id,jsonb_build_object('version',v_settlement.version,'fingerprint',v_fingerprint));
  return jsonb_build_object('result','ok','id',v_settlement.id,'created',v_settlement.created_at=v_settlement.updated_at,'version',v_settlement.version);
end;
$$;
