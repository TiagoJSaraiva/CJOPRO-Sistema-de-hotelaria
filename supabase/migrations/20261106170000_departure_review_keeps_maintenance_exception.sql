-- QA-090: a tela e a saída tratam a cobrança de manutenção em aberto como exceção mediante ciência, mas a
-- conferência da saída a contava como saldo pessoal e bloqueava com ou sem ciência. O saldo mostrado ao
-- hóspede continua igual; só o bloqueio deixa de contar o que a ciência da saída já cobre.
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
  for v in select * from jsonb_to_recordset(coalesce(v_payers->'items','[]'::jsonb)) x(id uuid,kind text,display_name text,balance numeric)
    where balance-coalesce((select sum(allocation.amount) from public.stay_payer_allocations allocation
      join public.stay_folio_entries entry on entry.id=allocation.folio_entry_id
      where allocation.payer_account_id=x.id and entry.kind='maintenance_charge'),0)>0 loop
    if v.kind<>'company' then v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('type','payer_balance','label','Saldo pessoal em aberto: '||v.display_name,'responsible_id',null,'updated_at',now(),'action','Receber pagamento'));
    elsif not exists(select 1 from public.stay_payer_accounts payer join public.corporate_credit_authorizations auth on auth.stay_id=payer.stay_id and auth.corporate_account_id=payer.corporate_account_id where payer.id=v.id and auth.status='approved' and auth.expires_at>public.hotel_operational_now(p_hotel_id) and auth.amount_limit-auth.reserved_amount-auth.consumed_amount>=v.balance)
      then v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('type','corporate_credit','label','Crédito empresarial vencido, insuficiente ou não aprovado: '||v.display_name,'responsible_id',null,'updated_at',now(),'action','Revisar autorização'));end if;
  end loop;
  if exists(select 1 from public.governance_minibar_findings finding join public.governance_cycles cycle on cycle.id=finding.cycle_id where cycle.stay_id=p_stay_id and finding.discrepancy_only and finding.consumption_order_id is null) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('type','minibar_discrepancy','label','Divergência de frigobar sem tratamento financeiro','responsible_id',null,'updated_at',now(),'action','Abrir governança'));
  end if;
  return jsonb_build_object('stay_id',p_stay_id,'ready',jsonb_array_length(v_blockers)=0,'blockers',v_blockers,'payer_balances',coalesce(v_payers->'items','[]'::jsonb),'account_version',v_stay.account_version,'updated_at',now());
end $function$;
