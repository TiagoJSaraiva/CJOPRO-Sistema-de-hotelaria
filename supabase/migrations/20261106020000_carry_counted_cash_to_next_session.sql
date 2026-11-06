-- A sessão seguinte parte do valor contado na anterior: abrir com outro valor exige justificativa,
-- que fica no movimento de abertura. A troca direta só aceita quem opera caixa no hotel.
CREATE OR REPLACE FUNCTION public.open_cash_session(p_hotel_id uuid, p_register_id uuid, p_actor_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_id uuid;v_date date;v_fp text:=md5(p_input::text);v_float numeric;v_previous numeric;v_reason text:=nullif(btrim(p_input->>'opening_reason'),'');
begin
  if not exists(select 1 from public.cash_registers where id=p_register_id and hotel_id=p_hotel_id and active for update) then return jsonb_build_object('result','not_found'); end if;
  v_date:=public.hotel_operational_date(p_hotel_id);v_float:=(p_input->>'opening_float')::numeric;
  select counted_cash into v_previous from public.cash_sessions where cash_register_id=p_register_id and hotel_id=p_hotel_id and status='closed' order by closed_at desc limit 1;
  if v_previous is not null and v_float<>v_previous and v_reason is null then return jsonb_build_object('result','opening_reason_required');end if;
  insert into public.cash_sessions(hotel_id,cash_register_id,operator_id,business_date,opening_float,expected_cash,idempotency_key,request_fingerprint)
  values(p_hotel_id,p_register_id,p_actor_id,v_date,v_float,v_float,(p_input->>'idempotency_key')::uuid,v_fp) returning id into v_id;
  if v_float>0 then insert into public.cash_movements(hotel_id,cash_session_id,kind,amount,cash_delta,reason,idempotency_key,request_fingerprint,actor_id)
    values(p_hotel_id,v_id,'opening_float',v_float,v_float,coalesce('Fundo inicial diferente da última contagem: '||v_reason,'Fundo inicial'),gen_random_uuid(),v_fp,p_actor_id); end if;
  return jsonb_build_object('result','ok','id',v_id);
exception when unique_violation then return jsonb_build_object('result','active_session_exists');
end $function$;

CREATE OR REPLACE FUNCTION public.list_cash_registers_for_actor(p_hotel_id uuid, p_actor_id uuid, p_can_approve boolean)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'operational_date',public.hotel_operational_date(p_hotel_id),
    'currency',(select h.currency from public.hotels h where h.id=p_hotel_id),
    'registers',coalesce(jsonb_agg(
      to_jsonb(r)||jsonb_build_object(
        'consumption_point_name',cp.name,
        'last_counted_cash',(select s.counted_cash from public.cash_sessions s where s.cash_register_id=r.id and s.status='closed' order by s.closed_at desc limit 1),
        'active_session',(select public.redact_cash_session(to_jsonb(s)||jsonb_build_object(
          'operator_name',u.name,'register_name',r.name,'currency',r.currency,
          'movement_totals',coalesce((select jsonb_object_agg(x.kind,x.total) from(
            select kind::text,sum(cash_delta) total from public.cash_movements where cash_session_id=s.id group by kind
          )x),'{}'::jsonb)),p_actor_id,p_can_approve)
          from public.cash_sessions s left join public.users u on u.id=s.operator_id
          where s.cash_register_id=r.id and s.status in('open','counting','difference_pending') limit 1)
      ) order by r.name),'[]'::jsonb)
  )
  from public.cash_registers r left join public.consumption_points cp on cp.id=r.consumption_point_id
  where r.hotel_id=p_hotel_id
$function$;

CREATE OR REPLACE FUNCTION public.act_cash_session(p_hotel_id uuid, p_id uuid, p_actor_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ declare v public.cash_sessions%rowtype;v_register public.cash_registers%rowtype;v_diff numeric;v_new uuid;
begin select * into v from public.cash_sessions where id=p_id and hotel_id=p_hotel_id for update;if not found then return jsonb_build_object('result','not_found');end if;if v.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict');end if;select * into v_register from public.cash_registers where id=v.cash_register_id;
 if p_input->>'action'='count' and v.status in('open','counting') and v.operator_id=p_actor_id then
  if (p_input->>'counted_amount') is null then return jsonb_build_object('result','count_required');end if;v_diff:=(p_input->>'counted_amount')::numeric-v.expected_cash;
  insert into public.cash_session_counts(hotel_id,cash_session_id,counted_amount,expected_amount,difference_amount,reason,actor_id) values(p_hotel_id,p_id,(p_input->>'counted_amount')::numeric,v.expected_cash,v_diff,p_input->>'reason',p_actor_id);
  update public.cash_sessions set counted_cash=(p_input->>'counted_amount')::numeric,difference_amount=v_diff,counted_at=now(),status=case when abs(v_diff)>v_register.difference_tolerance then 'difference_pending'::public.cash_session_status else 'closed' end,closed_at=case when abs(v_diff)<=v_register.difference_tolerance then now() end,closed_by=case when abs(v_diff)<=v_register.difference_tolerance then p_actor_id end,version=version+1,updated_at=now() where id=p_id;
 elsif p_input->>'action'='approve_difference' and v.status='difference_pending' and v.operator_id<>p_actor_id and nullif(btrim(p_input->>'reason'),'') is not null then update public.cash_sessions set status='closed',closed_at=now(),closed_by=p_actor_id,version=version+1,updated_at=now() where id=p_id;
 elsif p_input->>'action'='request_recount' and v.status='difference_pending' and v.operator_id<>p_actor_id and nullif(btrim(p_input->>'reason'),'') is not null then update public.cash_sessions set status='counting',counted_cash=null,difference_amount=null,version=version+1,updated_at=now() where id=p_id;
 elsif p_input->>'action'='handoff' and v.status='open' and v.operator_id=p_actor_id and (p_input->>'next_operator_id') is not null and (p_input->>'counted_amount')::numeric=v.expected_cash then
  if not exists(select 1 from public.user_roles ur join public.role_permissions rp on rp.role_id=ur.role_id join public.permissions perm on perm.id=rp.permission_id
    where ur.user_id=(p_input->>'next_operator_id')::uuid and ur.hotel_id=p_hotel_id and perm.name='operate_cash_register') then return jsonb_build_object('result','invalid_operator');end if;
  update public.cash_sessions set status='closed',counted_cash=v.expected_cash,difference_amount=0,counted_at=now(),closed_at=now(),closed_by=p_actor_id,version=version+1 where id=p_id;
  insert into public.cash_sessions(hotel_id,cash_register_id,operator_id,business_date,opening_float,expected_cash,idempotency_key,request_fingerprint) values(p_hotel_id,v.cash_register_id,(p_input->>'next_operator_id')::uuid,v.business_date,v.expected_cash,v.expected_cash,(p_input->>'idempotency_key')::uuid,md5(p_input::text)) returning id into v_new;
  insert into public.cash_movements(hotel_id,cash_session_id,kind,amount,cash_delta,reason,idempotency_key,request_fingerprint,actor_id) values(p_hotel_id,v_new,'opening_float',v.expected_cash,v.expected_cash,'Saldo recebido na troca de operador',gen_random_uuid(),md5(p_input::text),(p_input->>'next_operator_id')::uuid);
 elsif p_input->>'action'='cancel' and v.status='open' and not exists(select 1 from public.cash_movements where cash_session_id=p_id and kind<>'opening_float') and nullif(btrim(p_input->>'reason'),'') is not null then update public.cash_sessions set status='canceled',closed_at=now(),closed_by=p_actor_id,version=version+1 where id=p_id;
 else return jsonb_build_object('result','invalid_transition');end if;return jsonb_build_object('result','ok','id',coalesce(v_new,p_id),'expected_cash',v.expected_cash,'difference',v_diff);end $function$;
