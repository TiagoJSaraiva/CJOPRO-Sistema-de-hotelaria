-- QA-014: regras de negócio que ainda usavam o relógio real. Em produção os dois
-- relógios coincidem; no hotel-escola, com o relógio em outro dia, a transação caía
-- fora do fechamento daquele dia e a garantia era avaliada na data errada.
--
-- O pagamento sem data informada agora é carimbado aqui, no instante operacional do
-- hotel, em vez de na rota, que só conhece o relógio real. O default now() da coluna
-- também saía: ele dava data de pagamento até a transações pendentes.

alter table public.financial_transactions alter column paid_at drop default;

CREATE OR REPLACE FUNCTION public.assign_financial_business_context()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ declare v_session uuid;
begin
 -- Pagamento concluído sem data informada acontece no instante operacional do hotel.
 if new.paid_at is null and new.status in ('COMPLETED','REFUNDED') then new.paid_at:=public.hotel_operational_now(new.hotel_id);end if;
 if new.business_date is null then
  if new.paid_at is not null then
   select (new.paid_at at time zone h.timezone)::date into new.business_date from public.hotels h where h.id=new.hotel_id;
  else
   new.business_date:=public.hotel_operational_date(new.hotel_id);
  end if;
 end if;
 if new.cash_session_id is null and new.created_by is not null then select id into v_session from public.cash_sessions where hotel_id=new.hotel_id and operator_id=new.created_by and status='open' order by opened_at desc limit 1;new.cash_session_id:=v_session;end if;
 if new.original_business_date is not null and new.original_business_date<>new.business_date and new.origin_daily_close_id is null then raise exception 'origin_close_required';end if;
 return new;end $function$;

CREATE OR REPLACE FUNCTION public.create_maintenance_lifecycle_decision(p_hotel_id uuid, p_occurrence_id uuid, p_actor_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_id uuid; v_count int:=jsonb_array_length(p_input->'options'); v_location record; v_option jsonb;
begin
  if not exists(select 1 from public.maintenance_occurrences where id=p_occurrence_id and hotel_id=p_hotel_id) then return jsonb_build_object('result','not_found'); end if;
  if v_count<1 or (v_count=1 and nullif(btrim(p_input->>'single_option_reason'),'') is null) then return jsonb_build_object('result','invalid'); end if;
  select l.* into v_location from public.maintenance_occurrences o left join public.maintenance_locations l on l.id=o.location_id where o.id=p_occurrence_id;
  insert into public.maintenance_lifecycle_decisions(hotel_id,occurrence_id,recommendation,single_option_reason,proposed_by) values(p_hotel_id,p_occurrence_id,(p_input->>'recommendation')::public.maintenance_lifecycle_kind,nullif(btrim(p_input->>'single_option_reason'),''),p_actor_id) returning id into v_id;
  for v_option in select value from jsonb_array_elements(p_input->'options') loop
    insert into public.maintenance_lifecycle_options(hotel_id,decision_id,kind,estimated_cost,estimated_downtime_hours,supplier_id,contract_id,cost_item_id,warranty_eligible,warranty_snapshot,risks,benefits,justification) values(p_hotel_id,v_id,(v_option->>'kind')::public.maintenance_lifecycle_kind,(v_option->>'estimated_cost')::numeric,(v_option->>'estimated_downtime_hours')::int,nullif(v_option->>'supplier_id','')::uuid,nullif(v_option->>'contract_id','')::uuid,nullif(v_option->>'cost_item_id','')::uuid,(v_option->>'kind'='warranty' and v_location.warranty_ends_on>=public.hotel_operational_date(p_hotel_id)),jsonb_build_object('location_id',v_location.id,'warranty_ends_on',v_location.warranty_ends_on,'supplier_id',v_location.supplier_id,'contract_id',v_location.contract_id),btrim(v_option->>'risks'),btrim(v_option->>'benefits'),btrim(v_option->>'justification'));
  end loop;
  insert into public.maintenance_events(hotel_id,occurrence_id,actor_id,event_type,metadata) values(p_hotel_id,p_occurrence_id,p_actor_id,'lifecycle_draft_created',jsonb_build_object('decision_id',v_id));
  return jsonb_build_object('result','ok','decision_id',v_id);
exception when unique_violation or check_violation or foreign_key_violation then return jsonb_build_object('result','invalid');
end $function$;

CREATE OR REPLACE FUNCTION public.list_integrated_analytics(p_hotel_id uuid, p_from date, p_to date, p_permissions text[])
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
 select jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object('date',business_date,'forecast',case when p_permissions&&array['read_financial_transactions','read_consumption_analytics'] then forecast else forecast-'lodging_revenue'-'adr'-'revpar' end,'actual',case when p_permissions&&array['read_financial_transactions','read_consumption_analytics'] then actual else actual-'lodging_revenue'-'consumption_revenue'-'adr'-'revpar'-'inventory_loss_cost' end,'reconciled_at',reconciled_at,'stale_since',stale_since,'closed_snapshot',closed_snapshot) order by business_date),'[]')) from public.integrated_operation_facts where hotel_id=p_hotel_id and business_date between coalesce(p_from,public.hotel_operational_date(p_hotel_id)-30) and coalesce(p_to,public.hotel_operational_date(p_hotel_id)+90)
$function$;
