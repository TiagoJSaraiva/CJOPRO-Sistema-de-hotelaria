create type public.consumption_benefit_allowance_scope as enum ('stay','night','calendar_day');
create type public.consumption_benefit_rule_kind as enum ('included_item','monetary_credit');
create type public.consumption_benefit_grant_status as enum ('active','expired','revoked');

create table public.consumption_benefit_plans (
  id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,
  name text not null,description text,version integer not null default 0,created_by uuid references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),archived_at timestamptz,
  constraint consumption_benefit_plan_id_hotel_unique unique(id,hotel_id),unique(hotel_id,name),
  constraint consumption_benefit_plan_name check(length(btrim(name)) between 2 and 160)
);
create table public.consumption_benefit_plan_versions (
  id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,
  plan_id uuid not null,version_number integer not null,allowance_scope public.consumption_benefit_allowance_scope not null,
  active boolean not null default false,activated_at timestamptz,created_by uuid references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint consumption_benefit_version_id_hotel_unique unique(id,hotel_id),
  constraint consumption_benefit_version_plan_hotel_fkey foreign key(plan_id,hotel_id) references public.consumption_benefit_plans(id,hotel_id) on delete restrict,
  unique(plan_id,version_number),constraint consumption_benefit_version_active check(active=(activated_at is not null))
);
create unique index consumption_benefit_one_active_version on public.consumption_benefit_plan_versions(plan_id) where active;
create table public.consumption_benefit_rules (
  id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,
  plan_version_id uuid not null,kind public.consumption_benefit_rule_kind not null,product_id uuid,category_id uuid,offer_id uuid,point_id uuid,
  quantity numeric(12,3),amount numeric(12,2),display_order integer not null,
  constraint consumption_benefit_rule_version_hotel_fkey foreign key(plan_version_id,hotel_id) references public.consumption_benefit_plan_versions(id,hotel_id) on delete restrict,
  constraint consumption_benefit_rule_product_hotel_fkey foreign key(product_id,hotel_id) references public.products(id,hotel_id) on delete restrict,
  constraint consumption_benefit_rule_category_hotel_fkey foreign key(category_id,hotel_id) references public.product_categories(id,hotel_id) on delete restrict,
  constraint consumption_benefit_rule_offer_hotel_fkey foreign key(offer_id,hotel_id) references public.consumption_offers(id,hotel_id) on delete restrict,
  constraint consumption_benefit_rule_point_hotel_fkey foreign key(point_id,hotel_id) references public.consumption_points(id,hotel_id) on delete restrict,
  constraint consumption_benefit_rule_value check((kind='included_item' and quantity>0 and amount is null) or(kind='monetary_credit' and amount>0 and quantity is null)),
  constraint consumption_benefit_rule_target check(num_nonnulls(product_id,category_id,offer_id,point_id)>=1)
);
create table public.stay_benefit_grants (
  id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,
  stay_id uuid not null references public.stays(id) on delete restrict,plan_version_id uuid not null,
  status public.consumption_benefit_grant_status not null default 'active',granted_at timestamptz not null default now(),expires_at timestamptz,
  reason text not null,granted_by uuid not null references public.users(id) on delete restrict,expired_at timestamptz,
  constraint stay_benefit_grant_id_hotel_unique unique(id,hotel_id),
  constraint stay_benefit_grant_version_hotel_fkey foreign key(plan_version_id,hotel_id) references public.consumption_benefit_plan_versions(id,hotel_id) on delete restrict,
  constraint stay_benefit_grant_reason check(length(btrim(reason)) between 3 and 1000),
  constraint stay_benefit_grant_expired check((status='expired')=(expired_at is not null)),unique(stay_id,plan_version_id)
);
create table public.consumption_benefit_reservations (
  id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,
  grant_id uuid not null,rule_id uuid not null,service_order_id uuid not null,service_order_item_id uuid not null,
  amount numeric(12,2) not null default 0,quantity numeric(12,3) not null default 0,status public.consumption_service_reservation_status not null default 'reserved',
  reserved_at timestamptz not null default now(),released_at timestamptz,
  constraint consumption_benefit_reservation_grant_hotel_fkey foreign key(grant_id,hotel_id) references public.stay_benefit_grants(id,hotel_id) on delete restrict,
  constraint consumption_benefit_reservation_rule_fkey foreign key(rule_id) references public.consumption_benefit_rules(id) on delete restrict,
  constraint consumption_benefit_reservation_order_hotel_fkey foreign key(service_order_id,hotel_id) references public.consumption_service_orders(id,hotel_id) on delete restrict,
  constraint consumption_benefit_reservation_item_hotel_fkey foreign key(service_order_item_id,hotel_id) references public.consumption_service_order_items(id,hotel_id) on delete restrict,
  constraint consumption_benefit_reservation_value check(amount>=0 and quantity>=0 and(amount>0 or quantity>0)),
  unique(service_order_item_id,grant_id,rule_id)
);
create table public.consumption_benefit_redemptions (
  id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,
  grant_id uuid not null,rule_id uuid not null,consumption_order_id uuid not null,consumption_order_item_id uuid not null,
  amount numeric(12,2) not null,quantity numeric(12,3) not null default 0,folio_credit_entry_id uuid,
  applied_at timestamptz not null default now(),explanation text not null,
  constraint consumption_benefit_redemption_grant_hotel_fkey foreign key(grant_id,hotel_id) references public.stay_benefit_grants(id,hotel_id) on delete restrict,
  constraint consumption_benefit_redemption_rule_fkey foreign key(rule_id) references public.consumption_benefit_rules(id) on delete restrict,
  constraint consumption_benefit_redemption_order_hotel_fkey foreign key(consumption_order_id,hotel_id) references public.consumption_orders(id,hotel_id) on delete restrict,
  constraint consumption_benefit_redemption_item_hotel_fkey foreign key(consumption_order_item_id,hotel_id) references public.consumption_order_items(id,hotel_id) on delete restrict,
  constraint consumption_benefit_redemption_credit_hotel_fkey foreign key(folio_credit_entry_id,hotel_id) references public.stay_folio_entries(id,hotel_id) on delete restrict,
  constraint consumption_benefit_redemption_value check(amount>0 and quantity>=0),unique(consumption_order_item_id,grant_id,rule_id)
);
create table public.stay_payer_credits (
  id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,
  stay_id uuid not null references public.stays(id) on delete restrict,payer_account_id uuid not null,folio_credit_entry_id uuid not null,
  amount numeric(12,2) not null,reason text not null,created_at timestamptz not null default now(),
  constraint stay_payer_credit_payer_hotel_fkey foreign key(payer_account_id,hotel_id) references public.stay_payer_accounts(id,hotel_id) on delete restrict,
  constraint stay_payer_credit_folio_hotel_fkey foreign key(folio_credit_entry_id,hotel_id) references public.stay_folio_entries(id,hotel_id) on delete restrict,
  constraint stay_payer_credit_amount check(amount>0),unique(folio_credit_entry_id,payer_account_id)
);
create table public.consumption_benefit_events (
  id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,
  entity_type text not null,entity_id uuid not null,action text not null,actor_id uuid references public.users(id) on delete restrict,
  details jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
);

create table public.consumption_transfers (
  id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,
  source_order_id uuid not null,source_stay_id uuid not null,destination_stay_id uuid not null,destination_guest_customer_id uuid not null,
  destination_payer_account_id uuid not null,reason text not null,amount numeric(12,2) not null,benefit_amount numeric(12,2) not null default 0,
  source_account_version bigint not null,destination_account_version bigint not null,created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint consumption_transfer_id_hotel_unique unique(id,hotel_id),
  constraint consumption_transfer_order_hotel_fkey foreign key(source_order_id,hotel_id) references public.consumption_orders(id,hotel_id) on delete restrict,
  constraint consumption_transfer_guest_hotel_fkey foreign key(destination_guest_customer_id,hotel_id) references public.customers(id,hotel_id) on delete restrict,
  constraint consumption_transfer_payer_hotel_fkey foreign key(destination_payer_account_id,hotel_id) references public.stay_payer_accounts(id,hotel_id) on delete restrict,
  constraint consumption_transfer_stays check(source_stay_id<>destination_stay_id and amount>0 and benefit_amount>=0),
  constraint consumption_transfer_reason check(length(btrim(reason)) between 3 and 1000)
);
create table public.consumption_transfer_items (
  id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,
  transfer_id uuid not null,order_item_id uuid not null,quantity numeric(12,3) not null,amount numeric(12,2) not null,benefit_amount numeric(12,2) not null default 0,
  constraint consumption_transfer_item_transfer_hotel_fkey foreign key(transfer_id,hotel_id) references public.consumption_transfers(id,hotel_id) on delete restrict,
  constraint consumption_transfer_item_order_hotel_fkey foreign key(order_item_id,hotel_id) references public.consumption_order_items(id,hotel_id) on delete restrict,
  constraint consumption_transfer_item_value check(quantity>0 and amount>0 and benefit_amount>=0),unique(transfer_id,order_item_id)
);
create table public.consumption_transfer_events (
  id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,
  transfer_id uuid not null,action text not null,actor_id uuid references public.users(id) on delete restrict,details jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),
  constraint consumption_transfer_event_transfer_hotel_fkey foreign key(transfer_id,hotel_id) references public.consumption_transfers(id,hotel_id) on delete restrict
);

create function public.save_consumption_benefit_plan(p_hotel_id uuid,p_actor_id uuid,p_input jsonb)
returns jsonb language plpgsql set search_path=public as $$ declare v_id uuid;
begin insert into public.consumption_benefit_plans(hotel_id,name,description,created_by) values(p_hotel_id,btrim(p_input->>'name'),nullif(btrim(p_input->>'description'),''),p_actor_id) returning id into v_id;
return jsonb_build_object('result','ok','plan_id',v_id);exception when unique_violation then return jsonb_build_object('result','name_exists');end $$;

create function public.create_consumption_benefit_version(p_hotel_id uuid,p_plan_id uuid,p_actor_id uuid,p_input jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare v_id uuid;v_number integer;v_rule jsonb;v_order integer:=0;
begin
  if not exists(select 1 from public.consumption_benefit_plans where id=p_plan_id and hotel_id=p_hotel_id and archived_at is null) then return jsonb_build_object('result','not_found');end if;
  select coalesce(max(version_number),0)+1 into v_number from public.consumption_benefit_plan_versions where plan_id=p_plan_id;
  if coalesce((p_input->>'activate')::boolean,false) then update public.consumption_benefit_plan_versions set active=false,activated_at=null where plan_id=p_plan_id and active;end if;
  insert into public.consumption_benefit_plan_versions(hotel_id,plan_id,version_number,allowance_scope,active,activated_at,created_by)
  values(p_hotel_id,p_plan_id,v_number,(p_input->>'allowance_scope')::public.consumption_benefit_allowance_scope,coalesce((p_input->>'activate')::boolean,false),case when coalesce((p_input->>'activate')::boolean,false) then now() end,p_actor_id) returning id into v_id;
  for v_rule in select value from jsonb_array_elements(p_input->'rules') loop
    insert into public.consumption_benefit_rules(hotel_id,plan_version_id,kind,product_id,category_id,offer_id,point_id,quantity,amount,display_order)
    values(p_hotel_id,v_id,(v_rule->>'kind')::public.consumption_benefit_rule_kind,nullif(v_rule->>'product_id','')::uuid,nullif(v_rule->>'category_id','')::uuid,
      nullif(v_rule->>'offer_id','')::uuid,nullif(v_rule->>'point_id','')::uuid,nullif(v_rule->>'quantity','')::numeric,nullif(v_rule->>'amount','')::numeric,v_order);v_order:=v_order+1;
  end loop;
  return jsonb_build_object('result','ok','version_id',v_id,'version_number',v_number);
end $$;

create function public.grant_stay_consumption_benefit(p_hotel_id uuid,p_stay_id uuid,p_actor_id uuid,p_version_id uuid,p_expires_at timestamptz,p_reason text)
returns jsonb language plpgsql set search_path=public as $$ declare v_id uuid;
begin
  if not exists(select 1 from public.stays stay join public.reservations reservation on reservation.id=stay.reservation_id where stay.id=p_stay_id and reservation.hotel_id=p_hotel_id and stay.stay_status in ('confirmed','checked_in'))
    or not exists(select 1 from public.consumption_benefit_plan_versions where id=p_version_id and hotel_id=p_hotel_id and active) then return jsonb_build_object('result','not_found');end if;
  insert into public.stay_benefit_grants(hotel_id,stay_id,plan_version_id,expires_at,reason,granted_by) values(p_hotel_id,p_stay_id,p_version_id,p_expires_at,btrim(p_reason),p_actor_id) returning id into v_id;
  insert into public.consumption_benefit_events(hotel_id,entity_type,entity_id,action,actor_id,details) values(p_hotel_id,'grant',v_id,'granted',p_actor_id,jsonb_build_object('reason',btrim(p_reason)));
  return jsonb_build_object('result','ok','grant_id',v_id);
exception when unique_violation then return jsonb_build_object('result','already_granted');end $$;

create or replace function public.apply_consumption_benefits(p_hotel_id uuid,p_order_id uuid,p_actor_id uuid,p_skip boolean default false,p_override_reason text default null)
returns jsonb language plpgsql set search_path=public as $$
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
      where benefit_grant.hotel_id=p_hotel_id and benefit_grant.stay_id=v_order.stay_id and benefit_grant.status='active' and coalesce(benefit_grant.expires_at,now()+interval '100 years')>now()
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
      values(p_hotel_id,v_order.stay_id,v_order.reservation_id,'credit','adjustment',v_total,v_order.currency,'Benefícios aplicados ao consumo',p_order_id,'benefit:'||p_order_id,p_actor_id,now()) returning id into v_credit;
    if v_debit is not null then insert into public.stay_folio_allocations(hotel_id,stay_id,credit_entry_id,debit_entry_id,amount,created_by) values(p_hotel_id,v_order.stay_id,v_credit,v_debit,v_total,p_actor_id);end if;
    update public.consumption_benefit_redemptions set folio_credit_entry_id=v_credit where consumption_order_id=p_order_id;
    for v_payer in select allocation.payer_account_id,round(v_total*allocation.amount/nullif(entry.amount,0),2) amount from public.stay_payer_allocations allocation join public.stay_folio_entries entry on entry.id=allocation.folio_entry_id where allocation.folio_entry_id=v_debit loop
      insert into public.stay_payer_credits(hotel_id,stay_id,payer_account_id,folio_credit_entry_id,amount,reason) values(p_hotel_id,v_order.stay_id,v_payer.payer_account_id,v_credit,v_payer.amount,'Benefício de consumo') on conflict do nothing;
    end loop;
  end if;
  return jsonb_build_object('result','ok','amount',v_total,'explanation','Combinação de maior vantagem; empate resolvido por vencimento e concessão.','created',true);
end $$;

create function public.apply_consumption_benefits_from_event() returns trigger language plpgsql set search_path=public as $$
begin if new.action in ('posted','courtesy_posted') then perform public.apply_consumption_benefits(new.hotel_id,new.order_id,new.actor_id,false,null);end if;return new;end $$;
create trigger trg_consumption_order_apply_benefits after insert on public.consumption_order_events for each row execute function public.apply_consumption_benefits_from_event();

create or replace function public.list_stay_payer_accounts(p_hotel_id uuid,p_stay_id uuid)
returns jsonb language sql stable set search_path=public as $$
  select jsonb_build_object('stay_id',p_stay_id,'account_version',stay.account_version,
    'items',coalesce(jsonb_agg(jsonb_build_object('id',payer.id,'stay_id',payer.stay_id,'kind',payer.kind,'customer_id',payer.customer_id,
      'corporate_account_id',payer.corporate_account_id,'display_name',payer.display_name,'version',payer.version,
      'debit_total',coalesce(debit.total,0),'credit_total',coalesce(credit.total,0)+coalesce(benefit.total,0),
      'balance',greatest(coalesce(debit.total,0)-coalesce(credit.total,0)-coalesce(benefit.total,0),0)) order by payer.kind,payer.created_at),'[]'::jsonb))
  from public.stays stay join public.reservations reservation on reservation.id=stay.reservation_id and reservation.hotel_id=p_hotel_id
  left join public.stay_payer_accounts payer on payer.stay_id=stay.id
  left join lateral(select sum(amount) total from public.stay_payer_allocations where payer_account_id=payer.id) debit on true
  left join lateral(select sum(amount) total from public.stay_payer_payment_batches where payer_account_id=payer.id) credit on true
  left join lateral(select sum(amount) total from public.stay_payer_credits where payer_account_id=payer.id) benefit on true
  where stay.id=p_stay_id group by stay.id;
$$;

create function public.transfer_consumption_order(p_hotel_id uuid,p_order_id uuid,p_actor_id uuid,p_input jsonb,p_simulate boolean default false)
returns jsonb language plpgsql set search_path=public as $$
declare v_order public.consumption_orders%rowtype;v_source public.stays%rowtype;v_dest public.stays%rowtype;v_line jsonb;v_item public.consumption_order_items%rowtype;
  v_qty numeric;v_used numeric;v_amount numeric:=0;v_benefit numeric:=0;v_transfer uuid:=gen_random_uuid();v_source_credit uuid;v_dest_debit uuid;v_source_debit uuid;
begin
  select * into v_order from public.consumption_orders where id=p_order_id and hotel_id=p_hotel_id for update;
  if not found or v_order.billing_mode not in ('stay_folio','hotel_immediate') then return jsonb_build_object('result','not_found');end if;
  select * into v_source from public.stays where id=v_order.stay_id for update;
  select stay.* into v_dest from public.stays stay join public.reservations reservation on reservation.id=stay.reservation_id where stay.id=(p_input->>'destination_stay_id')::uuid and reservation.hotel_id=p_hotel_id for update of stay;
  if v_source.stay_status<>'checked_in' or v_dest.stay_status<>'checked_in' or v_source.id=v_dest.id then return jsonb_build_object('result','invalid_destination');end if;
  if v_source.account_version<>(p_input->>'expected_source_version')::bigint or v_dest.account_version<>(p_input->>'expected_destination_version')::bigint then return jsonb_build_object('result','version_conflict');end if;
  if exists(select 1 from public.consumption_corrections where order_id=p_order_id and status in('pending','approved','awaiting_refund','awaiting_partner_refund')) then return jsonb_build_object('result','open_correction');end if;
  if not exists(select 1 from public.stay_customers where stay_id=v_dest.id and customer_id=(p_input->>'guest_customer_id')::uuid)
    or not exists(select 1 from public.stay_payer_accounts where id=(p_input->>'payer_account_id')::uuid and stay_id=v_dest.id and hotel_id=p_hotel_id) then return jsonb_build_object('result','invalid_destination_party');end if;
  for v_line in select value from jsonb_array_elements(p_input->'items') loop
    select * into v_item from public.consumption_order_items where id=(v_line->>'order_item_id')::uuid and order_id=p_order_id for update;
    if not found then return jsonb_build_object('result','item_not_found');end if;
    v_qty:=(v_line->>'quantity')::numeric;
    select coalesce(sum(quantity),0) into v_used from public.consumption_transfer_items where order_item_id=v_item.id;
    if v_qty<=0 or v_qty+v_used>v_item.quantity then return jsonb_build_object('result','invalid_quantity');end if;
    v_amount:=v_amount+round(v_qty*v_item.charged_unit_price,2);
    v_benefit:=v_benefit+coalesce((select round(sum(amount)*v_qty/nullif(v_item.quantity,0),2) from public.consumption_benefit_redemptions where consumption_order_item_id=v_item.id),0);
  end loop;
  if p_simulate then return jsonb_build_object('result','ok','amount',v_amount,'benefit_amount',v_benefit,'source_balance_change',v_amount-v_benefit,'destination_balance_change',v_amount-v_benefit);end if;
  insert into public.consumption_transfers(id,hotel_id,source_order_id,source_stay_id,destination_stay_id,destination_guest_customer_id,destination_payer_account_id,reason,amount,benefit_amount,source_account_version,destination_account_version,created_by)
    values(v_transfer,p_hotel_id,p_order_id,v_source.id,v_dest.id,(p_input->>'guest_customer_id')::uuid,(p_input->>'payer_account_id')::uuid,btrim(p_input->>'reason'),v_amount,v_benefit,v_source.account_version,v_dest.account_version,p_actor_id);
  for v_line in select value from jsonb_array_elements(p_input->'items') loop
    select * into v_item from public.consumption_order_items where id=(v_line->>'order_item_id')::uuid;
    v_qty:=(v_line->>'quantity')::numeric;
    insert into public.consumption_transfer_items(hotel_id,transfer_id,order_item_id,quantity,amount,benefit_amount)
      values(p_hotel_id,v_transfer,v_item.id,v_qty,round(v_qty*v_item.charged_unit_price,2),coalesce((select round(sum(amount)*v_qty/nullif(v_item.quantity,0),2) from public.consumption_benefit_redemptions where consumption_order_item_id=v_item.id),0));
  end loop;
  select id into v_source_debit from public.stay_folio_entries where consumption_order_id=p_order_id and direction='debit' order by posted_at limit 1;
  insert into public.stay_folio_entries(hotel_id,stay_id,reservation_id,direction,kind,amount,currency,description,source_key,posted_by,posted_at)
    values(p_hotel_id,v_source.id,v_order.reservation_id,'credit','adjustment',v_amount-v_benefit,v_order.currency,'Correção de consumo para outra estadia','transfer-source:'||v_transfer,p_actor_id,now()) returning id into v_source_credit;
  if v_source_debit is not null then insert into public.stay_folio_allocations(hotel_id,stay_id,credit_entry_id,debit_entry_id,amount,created_by) values(p_hotel_id,v_source.id,v_source_credit,v_source_debit,v_amount-v_benefit,p_actor_id);end if;
  insert into public.stay_folio_entries(hotel_id,stay_id,reservation_id,direction,kind,amount,currency,description,source_key,posted_by,posted_at)
    values(p_hotel_id,v_dest.id,v_dest.reservation_id,'debit','consumption_charge',v_amount-v_benefit,v_order.currency,'Consumo transferido da estadia '||v_source.id,'transfer-destination:'||v_transfer,p_actor_id,now()) returning id into v_dest_debit;
  delete from public.stay_payer_allocations where folio_entry_id=v_dest_debit;
  insert into public.stay_payer_allocations(hotel_id,stay_id,folio_entry_id,payer_account_id,amount,allocated_by) values(p_hotel_id,v_dest.id,v_dest_debit,(p_input->>'payer_account_id')::uuid,v_amount-v_benefit,p_actor_id);
  insert into public.consumption_transfer_events(hotel_id,transfer_id,action,actor_id,details) values(p_hotel_id,v_transfer,'completed',p_actor_id,jsonb_build_object('reason',btrim(p_input->>'reason'),'benefit_recalculated',v_benefit));
  return jsonb_build_object('result','ok','transfer_id',v_transfer,'amount',v_amount,'benefit_amount',v_benefit);
end $$;

create function public.list_consumption_benefit_plans(p_hotel_id uuid) returns jsonb language sql stable set search_path=public as $$
select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(plan)||jsonb_build_object('versions',(select coalesce(jsonb_agg(to_jsonb(version) order by version.version_number desc),'[]'::jsonb) from public.consumption_benefit_plan_versions version where version.plan_id=plan.id)) order by plan.name),'[]'::jsonb)) from public.consumption_benefit_plans plan where plan.hotel_id=p_hotel_id and plan.archived_at is null;$$;

create function public.protect_benefit_history() returns trigger language plpgsql as $$ begin raise exception 'benefit and transfer history is immutable' using errcode='23514';end $$;
create trigger trg_benefit_versions_immutable before update or delete on public.consumption_benefit_plan_versions for each row when(old.active=false) execute function public.protect_benefit_history();
create trigger trg_benefit_rules_immutable before update or delete on public.consumption_benefit_rules for each row execute function public.protect_benefit_history();
create trigger trg_benefit_redemptions_immutable before update or delete on public.consumption_benefit_redemptions for each row execute function public.protect_benefit_history();
create trigger trg_benefit_events_immutable before update or delete on public.consumption_benefit_events for each row execute function public.protect_benefit_history();
create trigger trg_transfer_immutable before update or delete on public.consumption_transfers for each row execute function public.protect_benefit_history();
create trigger trg_transfer_items_immutable before update or delete on public.consumption_transfer_items for each row execute function public.protect_benefit_history();
create trigger trg_transfer_events_immutable before update or delete on public.consumption_transfer_events for each row execute function public.protect_benefit_history();

insert into public.permissions(name,type) select name,'HOTEL_PERMISSION' from unnest(array['manage_consumption_benefits','override_consumption_benefits','transfer_consumption']) name on conflict(name) do nothing;
do $$ declare t text;begin foreach t in array array['consumption_benefit_plans','consumption_benefit_plan_versions','consumption_benefit_rules','stay_benefit_grants','consumption_benefit_reservations','consumption_benefit_redemptions','stay_payer_credits','consumption_benefit_events','consumption_transfers','consumption_transfer_items','consumption_transfer_events'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end $$;
grant usage on type public.consumption_benefit_allowance_scope,public.consumption_benefit_rule_kind,public.consumption_benefit_grant_status to service_role;
grant execute on function public.save_consumption_benefit_plan(uuid,uuid,jsonb),public.create_consumption_benefit_version(uuid,uuid,uuid,jsonb),
  public.grant_stay_consumption_benefit(uuid,uuid,uuid,uuid,timestamptz,text),public.apply_consumption_benefits(uuid,uuid,uuid,boolean,text),
  public.transfer_consumption_order(uuid,uuid,uuid,jsonb,boolean),public.list_consumption_benefit_plans(uuid) to service_role;
