-- QA-019: estas colunas registram um fato do hotel, mas assumiam o tempo real pelo padrão da coluna, e
-- muitos inserts as omitem. O padrão de uma coluna não enxerga o hotel da linha, por isso um gatilho
-- preenche o que não veio. O nome começa com a0 porque gatilhos rodam em ordem alfabética, e os demais
-- já podem ler o valor. Uma data informada continua valendo. O gatilho fica ENABLE ALWAYS porque, sem o
-- padrão, um script com session_replication_role=replica gravaria a coluna vazia.
create function public.stamp_operational_time() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
begin
  if to_jsonb(new)->>tg_argv[0] is null then
    new:=jsonb_populate_record(new,jsonb_build_object(
      tg_argv[0],coalesce(public.hotel_operational_now(new.hotel_id),now())));
  end if;
  return new;
end
$function$;

revoke all on function public.stamp_operational_time() from public;

alter table public.cash_management_settings alter column activated_at drop default;
create trigger a0_stamp_operational_time before insert on public.cash_management_settings
  for each row execute function public.stamp_operational_time('activated_at');
alter table public.cash_management_settings enable always trigger a0_stamp_operational_time;

alter table public.cash_movements alter column occurred_at drop default;
create trigger a0_stamp_operational_time before insert on public.cash_movements
  for each row execute function public.stamp_operational_time('occurred_at');
alter table public.cash_movements enable always trigger a0_stamp_operational_time;

alter table public.cash_sessions alter column opened_at drop default;
create trigger a0_stamp_operational_time before insert on public.cash_sessions
  for each row execute function public.stamp_operational_time('opened_at');
alter table public.cash_sessions enable always trigger a0_stamp_operational_time;

alter table public.consumption_benefit_redemptions alter column applied_at drop default;
create trigger a0_stamp_operational_time before insert on public.consumption_benefit_redemptions
  for each row execute function public.stamp_operational_time('applied_at');
alter table public.consumption_benefit_redemptions enable always trigger a0_stamp_operational_time;

alter table public.consumption_benefit_reservations alter column reserved_at drop default;
create trigger a0_stamp_operational_time before insert on public.consumption_benefit_reservations
  for each row execute function public.stamp_operational_time('reserved_at');
alter table public.consumption_benefit_reservations enable always trigger a0_stamp_operational_time;

alter table public.consumption_corrections alter column requested_at drop default;
create trigger a0_stamp_operational_time before insert on public.consumption_corrections
  for each row execute function public.stamp_operational_time('requested_at');
alter table public.consumption_corrections enable always trigger a0_stamp_operational_time;

alter table public.consumption_orders alter column posted_at drop default;
create trigger a0_stamp_operational_time before insert on public.consumption_orders
  for each row execute function public.stamp_operational_time('posted_at');
alter table public.consumption_orders enable always trigger a0_stamp_operational_time;

alter table public.consumption_service_stock_reservations alter column reserved_at drop default;
create trigger a0_stamp_operational_time before insert on public.consumption_service_stock_reservations
  for each row execute function public.stamp_operational_time('reserved_at');
alter table public.consumption_service_stock_reservations enable always trigger a0_stamp_operational_time;

alter table public.customer_preferences alter column confirmed_at drop default;
create trigger a0_stamp_operational_time before insert on public.customer_preferences
  for each row execute function public.stamp_operational_time('confirmed_at');
alter table public.customer_preferences enable always trigger a0_stamp_operational_time;

alter table public.inventory_lots alter column received_at drop default;
create trigger a0_stamp_operational_time before insert on public.inventory_lots
  for each row execute function public.stamp_operational_time('received_at');
alter table public.inventory_lots enable always trigger a0_stamp_operational_time;

alter table public.maintenance_checkout_acknowledgements alter column acknowledged_at drop default;
create trigger a0_stamp_operational_time before insert on public.maintenance_checkout_acknowledgements
  for each row execute function public.stamp_operational_time('acknowledged_at');
alter table public.maintenance_checkout_acknowledgements enable always trigger a0_stamp_operational_time;

alter table public.maintenance_execution_sessions alter column started_at drop default;
create trigger a0_stamp_operational_time before insert on public.maintenance_execution_sessions
  for each row execute function public.stamp_operational_time('started_at');
alter table public.maintenance_execution_sessions enable always trigger a0_stamp_operational_time;

alter table public.maintenance_financial_checkout_acknowledgements alter column acknowledged_at drop default;
create trigger a0_stamp_operational_time before insert on public.maintenance_financial_checkout_acknowledgements
  for each row execute function public.stamp_operational_time('acknowledged_at');
alter table public.maintenance_financial_checkout_acknowledgements enable always trigger a0_stamp_operational_time;

alter table public.maintenance_occurrences alter column discovered_at drop default;
create trigger a0_stamp_operational_time before insert on public.maintenance_occurrences
  for each row execute function public.stamp_operational_time('discovered_at');
alter table public.maintenance_occurrences enable always trigger a0_stamp_operational_time;

alter table public.maintenance_service_communications alter column communicated_at drop default;
create trigger a0_stamp_operational_time before insert on public.maintenance_service_communications
  for each row execute function public.stamp_operational_time('communicated_at');
alter table public.maintenance_service_communications enable always trigger a0_stamp_operational_time;

alter table public.maintenance_service_confirmations alter column confirmed_at drop default;
create trigger a0_stamp_operational_time before insert on public.maintenance_service_confirmations
  for each row execute function public.stamp_operational_time('confirmed_at');
alter table public.maintenance_service_confirmations enable always trigger a0_stamp_operational_time;

alter table public.maintenance_waiting_episodes alter column started_at drop default;
create trigger a0_stamp_operational_time before insert on public.maintenance_waiting_episodes
  for each row execute function public.stamp_operational_time('started_at');
alter table public.maintenance_waiting_episodes enable always trigger a0_stamp_operational_time;

alter table public.stay_benefit_grants alter column granted_at drop default;
create trigger a0_stamp_operational_time before insert on public.stay_benefit_grants
  for each row execute function public.stamp_operational_time('granted_at');
alter table public.stay_benefit_grants enable always trigger a0_stamp_operational_time;

alter table public.stay_folio_entries alter column posted_at drop default;
create trigger a0_stamp_operational_time before insert on public.stay_folio_entries
  for each row execute function public.stamp_operational_time('posted_at');
alter table public.stay_folio_entries enable always trigger a0_stamp_operational_time;
