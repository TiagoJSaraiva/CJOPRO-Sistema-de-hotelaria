-- QA-083: o ciclo automático recebia a hora real. No hotel-escola, com o relógio em outro instante, a
-- preventiva e os alertas de SLA olhavam o dia errado: uma ocorrência carimbada na hora do hotel podia
-- nascer vencida ou nunca vencer. Sem hora informada, cada hotel usa o próprio relógio. Em produção os dois
-- coincidem. Quem informa a hora, como os testes, continua mandando.

CREATE OR REPLACE FUNCTION public.process_maintenance_management_cycle_stage2(p_now timestamp with time zone DEFAULT now(), p_hotel_id uuid DEFAULT NULL::uuid, p_force boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_hotel record; v_run_id uuid; v_key text; v_started timestamptz; v_preventive jsonb; v_sla integer; v_expiry integer; v_total jsonb := '[]'::jsonb; v_slot timestamptz := coalesce(p_now, now()); v_at timestamptz;
begin
  for v_hotel in select id, timezone, (coalesce(p_now, public.hotel_operational_now(id)) at time zone timezone)::date local_date from public.hotels where p_hotel_id is null or id = p_hotel_id
  loop
    v_key := 'management:' || v_hotel.id || ':' || to_char(
      date_trunc('hour', v_slot) + make_interval(mins => (extract(minute from v_slot)::integer / 15) * 15),
      'YYYYMMDDHH24MI'
    ) || case when p_force then ':' || gen_random_uuid()::text else '' end;
    insert into public.maintenance_automation_runs(hotel_id, run_key, status, trigger_kind, local_date)
    values (v_hotel.id, v_key, 'running', case when p_force then 'manual' else 'scheduled' end, v_hotel.local_date)
    on conflict (run_key) do nothing returning id, started_at into v_run_id, v_started;
    if v_run_id is null then continue; end if;
    v_at := coalesce(p_now, public.hotel_operational_now(v_hotel.id));
    begin
      v_preventive := public.process_maintenance_preventive_plans(v_hotel.id, v_at);
      v_sla := public.process_maintenance_sla_alerts(v_hotel.id, v_at);
      v_expiry := public.process_maintenance_expiry_alerts(v_hotel.id, v_hotel.local_date);
      perform public.reconcile_operational_pending(v_hotel.id,v_at);
      update public.maintenance_automation_runs set status = 'completed', finished_at = clock_timestamp(),
        duration_ms = (extract(epoch from (clock_timestamp() - v_started)) * 1000)::integer,
        counters = v_preventive || jsonb_build_object('sla_notifications', v_sla, 'expiry_notifications', v_expiry)
      where id = v_run_id;
      v_total := v_total || jsonb_build_array(jsonb_build_object('hotel_id', v_hotel.id, 'run_id', v_run_id, 'status', 'completed'));
    exception when others then
      insert into public.operational_pending_sync(hotel_id,last_attempt_at,error_message)
      values(v_hotel.id,p_now,'Não foi possível sincronizar as origens. Pendências anteriores preservadas.')
      on conflict(hotel_id) do update set last_attempt_at=p_now,error_message=excluded.error_message;
      update public.maintenance_automation_runs set status = 'failed', finished_at = clock_timestamp(),
        duration_ms = (extract(epoch from (clock_timestamp() - v_started)) * 1000)::integer, error_message = sqlerrm
      where id = v_run_id;
      v_total := v_total || jsonb_build_array(jsonb_build_object('hotel_id', v_hotel.id, 'run_id', v_run_id, 'status', 'failed'));
    end;
  end loop;
  return v_total;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.process_maintenance_management_cycle(p_now timestamp with time zone DEFAULT now(), p_hotel_id uuid DEFAULT NULL::uuid, p_force boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_result jsonb; v_hotel uuid;
begin
  v_result:=public.process_maintenance_management_cycle_stage2(p_now,p_hotel_id,p_force);
  for v_hotel in select id from public.hotels where p_hotel_id is null or id=p_hotel_id loop perform public.refresh_maintenance_impact_scores(v_hotel,coalesce(p_now,public.hotel_operational_now(v_hotel))); end loop;
  return v_result;
end $function$
;

do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'maintenance-management-cycle';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule(
    'maintenance-management-cycle', '*/15 * * * *',
    $cron$select public.process_maintenance_management_cycle(null, null, false);$cron$
  );
end;
$$;
