-- QA-091: a conferência do dia lista os lançamentos tardios, com a data e o fechamento originais (decisão
-- 0014). Fica fora da projeção, que gera o snapshot aprovado: só a leitura da tela muda.
CREATE OR REPLACE FUNCTION public.get_daily_close_for_actor(p_hotel_id uuid, p_business_date date, p_actor_id uuid, p_can_approve boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare v_close jsonb;v_projection jsonb;v_sessions jsonb;v_late jsonb;
begin
  select to_jsonb(c)||jsonb_build_object('prepared_by_name',pu.name,'approved_by_name',au.name)
  into v_close from public.daily_closes c left join public.users pu on pu.id=c.prepared_by left join public.users au on au.id=c.approved_by
  where c.hotel_id=p_hotel_id and c.business_date=p_business_date;
  v_projection:=public.daily_close_projection(p_hotel_id,p_business_date);
  select coalesce(jsonb_agg(public.redact_cash_session(value,p_actor_id,p_can_approve)),'[]'::jsonb) into v_sessions
  from jsonb_array_elements(v_projection->'cash_sessions');
  -- QA-091: o que entrou nesta data vindo de um dia já fechado, para quem aprova ver a origem.
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',t.id,'type',t.type,'category',t.category,'description',t.description,'amount',t.amount,
      'payment_method',t.payment_method,'original_business_date',t.original_business_date,
      'origin_close_business_date',origin.business_date
    ) order by t.original_business_date,t.created_at,t.id),'[]'::jsonb)
  into v_late
  from public.financial_transactions t
  join public.daily_closes origin on origin.id=t.origin_daily_close_id
  where t.hotel_id=p_hotel_id and t.business_date=p_business_date
    and t.original_business_date is not null and t.original_business_date<>t.business_date;
  return jsonb_build_object('close',v_close,'projection',jsonb_set(v_projection,'{cash_sessions}',v_sessions),'late_postings',v_late);
end $function$;
