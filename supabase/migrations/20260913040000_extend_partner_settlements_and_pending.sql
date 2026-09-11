-- Etapa 5.4: disputas e liquidação parcial, pendências e consolidação auditada.

alter table public.partner_settlements
 add column approval_state text not null default 'draft' check(approval_state in('draft','in_review','approved','rejected')),
 add column payment_state text not null default 'open' check(payment_state in('open','partially_settled','settled')),
 add column dispute_state text not null default 'clear' check(dispute_state in('clear','disputed','resolved'));
update public.partner_settlements set approval_state=case status when 'draft' then 'draft' when 'in_review' then 'in_review' else 'approved' end,
 payment_state=case when status='settled' then 'settled' else 'open' end;
alter table public.partner_settlement_payments add column cash_session_id uuid;
alter table public.partner_settlement_payments add constraint partner_payment_cash_session_fkey foreign key(cash_session_id,hotel_id) references public.cash_sessions(id,hotel_id) on delete restrict;

create table public.partner_settlement_payment_batches (
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,settlement_id uuid not null,
 idempotency_key uuid not null,request_fingerprint text not null,total_amount numeric(14,2) not null,created_by uuid not null references public.users(id),created_at timestamptz not null default now(),
 unique(id,hotel_id),unique(hotel_id,idempotency_key),foreign key(settlement_id,hotel_id) references public.partner_settlements(id,hotel_id) on delete restrict,check(total_amount>0)
);
alter table public.partner_settlement_payments add column payment_batch_id uuid;
alter table public.partner_settlement_payments add constraint partner_payment_batch_fkey foreign key(payment_batch_id,hotel_id) references public.partner_settlement_payment_batches(id,hotel_id) on delete restrict;

create table public.partner_settlement_disputes (
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null,settlement_id uuid not null,component_id uuid not null,
 disputed_amount numeric(14,2) not null,status text not null default 'open',reason text not null,evidence_path text,
 version integer not null default 1,responsible_id uuid references public.users(id),opened_by uuid not null references public.users(id),
 decided_by uuid references public.users(id),decision_reason text,resolved_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,hotel_id),foreign key(settlement_id,hotel_id) references public.partner_settlements(id,hotel_id) on delete restrict,
 foreign key(component_id,hotel_id) references public.partner_settlement_components(id,hotel_id) on delete restrict,
 check(disputed_amount>0 and status in('open','accepted','rejected','canceled') and length(btrim(reason)) between 3 and 1000)
);
create table public.partner_dispute_contacts (
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null,dispute_id uuid not null,channel text not null,result text not null,
 next_action_at timestamptz,actor_id uuid not null references public.users(id),created_at timestamptz not null default now(),
 foreign key(dispute_id,hotel_id) references public.partner_settlement_disputes(id,hotel_id) on delete restrict
);

create or replace function public.create_partner_settlement_dispute(p_hotel_id uuid,p_settlement_id uuid,p_actor_id uuid,p_input jsonb)
returns jsonb language plpgsql set search_path=public as $$ declare v_set public.partner_settlements%rowtype;v_component public.partner_settlement_components%rowtype;v_total numeric;v_id uuid;
begin select * into v_set from public.partner_settlements where id=p_settlement_id and hotel_id=p_hotel_id for update;if not found then return jsonb_build_object('result','not_found');end if;if v_set.status not in('approved','settled') then return jsonb_build_object('result','invalid_status');end if;
 select * into v_component from public.partner_settlement_components where id=(p_input->>'component_id')::uuid and settlement_id=p_settlement_id and hotel_id=p_hotel_id;if not found then return jsonb_build_object('result','invalid_component');end if;
 select coalesce(sum(disputed_amount),0) into v_total from public.partner_settlement_disputes where component_id=v_component.id and status='open';if v_total+(p_input->>'disputed_amount')::numeric>abs(v_component.net_settlement_amount) then return jsonb_build_object('result','invalid_amount');end if;
 insert into public.partner_settlement_disputes(hotel_id,settlement_id,component_id,disputed_amount,reason,evidence_path,responsible_id,opened_by) values(p_hotel_id,p_settlement_id,v_component.id,(p_input->>'disputed_amount')::numeric,btrim(p_input->>'reason'),p_input->>'evidence_path',p_actor_id,p_actor_id) returning id into v_id;
 update public.partner_settlements set dispute_state='disputed',version=version+1,updated_at=now() where id=p_settlement_id;insert into public.partner_settlement_events(hotel_id,settlement_id,action,actor_id,details) values(p_hotel_id,p_settlement_id,'dispute_opened',p_actor_id,jsonb_build_object('dispute_id',v_id,'component_id',v_component.id,'amount',(p_input->>'disputed_amount')::numeric));return jsonb_build_object('result','ok','id',v_id);end $$;

create or replace function public.pay_partner_settlement_partial(p_hotel_id uuid,p_settlement_id uuid,p_actor_id uuid,p_input jsonb)
returns jsonb language plpgsql set search_path=public as $$ declare v_set public.partner_settlements%rowtype;v_disputed numeric;v_paid numeric;v_available numeric;v_total numeric;x jsonb;v_tx uuid;v_pay uuid;v_batch uuid;v_fp text:=md5(p_input::text);
begin select * into v_set from public.partner_settlements where id=p_settlement_id and hotel_id=p_hotel_id for update;if not found then return jsonb_build_object('result','not_found');end if;if v_set.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict');end if;if v_set.status not in('approved','settled') then return jsonb_build_object('result','invalid_status');end if;
 select coalesce(sum(disputed_amount),0) into v_disputed from public.partner_settlement_disputes where settlement_id=p_settlement_id and status in('open','accepted');
 select coalesce(sum(case when reversal_of_id is null then amount else -amount end),0) into v_paid from public.partner_settlement_payments where settlement_id=p_settlement_id;
 select sum((x->>'amount')::numeric) into v_total from jsonb_array_elements(p_input->'tenders') x;v_available:=greatest(0,abs(v_set.net_settlement)-v_disputed-v_paid);if v_total<=0 or v_total>v_available then return jsonb_build_object('result','invalid_amount','context',jsonb_build_object('available',v_available));end if;
 if exists(select 1 from jsonb_array_elements(p_input->'tenders') x where x->>'payment_method'='cash') and nullif(p_input->>'cash_session_id','') is null then return jsonb_build_object('result','cash_session_required');end if;
 select id into v_batch from public.partner_settlement_payment_batches where hotel_id=p_hotel_id and idempotency_key=(p_input->>'idempotency_key')::uuid and request_fingerprint=v_fp;if found then return jsonb_build_object('result','ok','id',v_batch);end if;
 if exists(select 1 from public.partner_settlement_payment_batches where hotel_id=p_hotel_id and idempotency_key=(p_input->>'idempotency_key')::uuid) then return jsonb_build_object('result','idempotency_conflict');end if;
 insert into public.partner_settlement_payment_batches(hotel_id,settlement_id,idempotency_key,request_fingerprint,total_amount,created_by) values(p_hotel_id,p_settlement_id,(p_input->>'idempotency_key')::uuid,v_fp,v_total,p_actor_id) returning id into v_batch;
 for x in select value from jsonb_array_elements(p_input->'tenders') loop
  insert into public.financial_transactions(hotel_id,type,category,amount,currency,description,status,payment_method,paid_at,due_date,counterparty,reference_code,created_by,partner_settlement_id,cash_session_id)
  values(p_hotel_id,case when v_set.direction='hotel_to_partner' then 'EXPENSE'::public.transaction_type else 'INCOME'::public.transaction_type end,'PARTNER_SETTLEMENT',(x->>'amount')::numeric,v_set.currency,'Liquidação parcial de parceiro','COMPLETED',x->>'payment_method',coalesce((p_input->>'paid_at')::timestamptz,now()),v_set.due_on,(select trade_name from public.commercial_partners where id=v_set.partner_id),x->>'reference_code',p_actor_id,p_settlement_id,(p_input->>'cash_session_id')::uuid) returning id into v_tx;
  insert into public.partner_settlement_payments(hotel_id,settlement_id,payment_batch_id,financial_transaction_id,amount,direction,payment_method,paid_at,reference_code,notes,idempotency_key,request_fingerprint,created_by,cash_session_id)
  values(p_hotel_id,p_settlement_id,v_batch,v_tx,(x->>'amount')::numeric,v_set.direction,x->>'payment_method',coalesce((p_input->>'paid_at')::timestamptz,now()),x->>'reference_code',p_input->>'notes',gen_random_uuid(),v_fp,p_actor_id,(p_input->>'cash_session_id')::uuid) returning id into v_pay;
 end loop;
 update public.partner_settlements set payment_state=case when v_paid+v_total>=abs(net_settlement)-v_disputed then 'settled' else 'partially_settled' end,status=case when v_paid+v_total>=abs(net_settlement)-v_disputed then 'settled'::public.partner_settlement_status else 'approved' end,settled_by=case when v_paid+v_total>=abs(net_settlement)-v_disputed then p_actor_id end,settled_at=case when v_paid+v_total>=abs(net_settlement)-v_disputed then now() end,version=version+1,updated_at=now() where id=p_settlement_id;
 insert into public.partner_settlement_events(hotel_id,settlement_id,action,actor_id,details) values(p_hotel_id,p_settlement_id,'partial_payment',p_actor_id,jsonb_build_object('amount',v_total,'remaining',v_available-v_total));return jsonb_build_object('result','ok','id',v_batch);end $$;

create or replace function public.act_partner_settlement_dispute(p_hotel_id uuid,p_id uuid,p_actor_id uuid,p_input jsonb)
returns jsonb language plpgsql set search_path=public as $$ declare v public.partner_settlement_disputes%rowtype;v_open integer;
begin select * into v from public.partner_settlement_disputes where id=p_id and hotel_id=p_hotel_id for update;if not found then return jsonb_build_object('result','not_found');end if;if v.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict');end if;if v.opened_by=p_actor_id then return jsonb_build_object('result','segregation_required');end if;
 if p_input->>'action' in('accept','reject','cancel') and v.status='open' then update public.partner_settlement_disputes set status=case p_input->>'action' when 'accept' then 'accepted' when 'reject' then 'rejected' else 'canceled' end,decided_by=p_actor_id,decision_reason=btrim(p_input->>'reason'),resolved_at=now(),version=version+1,updated_at=now() where id=p_id;else return jsonb_build_object('result','invalid_transition');end if;
 select count(*) into v_open from public.partner_settlement_disputes where settlement_id=v.settlement_id and status='open';update public.partner_settlements set dispute_state=case when v_open=0 then 'resolved' else 'disputed' end,version=version+1,updated_at=now() where id=v.settlement_id;
 insert into public.partner_settlement_events(hotel_id,settlement_id,action,actor_id,details) values(p_hotel_id,v.settlement_id,'dispute_'||(p_input->>'action'),p_actor_id,jsonb_build_object('dispute_id',p_id,'reason',p_input->>'reason'));return jsonb_build_object('result','ok');end $$;

-- Replace the temporary split placeholder with an audited role extraction.
create or replace function public.act_business_organization(p_hotel_id uuid,p_id uuid,p_actor_id uuid,p_input jsonb)
returns jsonb language plpgsql set search_path=public as $$ declare v public.business_organizations%rowtype;v_target public.business_organizations%rowtype;v_new uuid;v_role text:=p_input->>'role_type';v_role_id uuid:=(p_input->>'role_id')::uuid;
begin select * into v from public.business_organizations where id=p_id and hotel_id=p_hotel_id for update;if not found then return jsonb_build_object('result','not_found');end if;if v.version<>(p_input->>'expected_version')::integer then return jsonb_build_object('result','conflict');end if;if nullif(btrim(p_input->>'reason'),'') is null then return jsonb_build_object('result','reason_required');end if;
 if p_input->>'action'='merge' then select * into v_target from public.business_organizations where id=(p_input->>'target_id')::uuid and hotel_id=p_hotel_id for update;if not found or v_target.id=v.id then return jsonb_build_object('result','invalid_target');end if;
  update public.commercial_partners set organization_id=v_target.id where organization_id=v.id;update public.maintenance_suppliers set organization_id=v_target.id where organization_id=v.id;update public.corporate_accounts set organization_id=v_target.id where organization_id=v.id;update public.procurement_suppliers set organization_id=v_target.id where organization_id=v.id;update public.business_organizations set active=false,version=version+1,updated_at=now() where id=v.id;
 elsif p_input->>'action'='split' then
  insert into public.business_organizations(hotel_id,legal_name,trade_name,currency,email,phone,created_by) values(p_hotel_id,v.legal_name,v.trade_name,v.currency,v.email,v.phone,p_actor_id) returning id into v_new;
  if v_role='commercial_partner' then update public.commercial_partners set organization_id=v_new where id=v_role_id and hotel_id=p_hotel_id and organization_id=v.id;
  elsif v_role='maintenance_supplier' then update public.maintenance_suppliers set organization_id=v_new where id=v_role_id and hotel_id=p_hotel_id and organization_id=v.id;
  elsif v_role='corporate_account' then update public.corporate_accounts set organization_id=v_new where id=v_role_id and hotel_id=p_hotel_id and organization_id=v.id;
  elsif v_role='stock_supplier' then update public.procurement_suppliers set organization_id=v_new where id=v_role_id and hotel_id=p_hotel_id and organization_id=v.id;else return jsonb_build_object('result','invalid_role');end if;if not found then return jsonb_build_object('result','role_not_found');end if;
 elsif p_input->>'action'='resolve_conflict' then
  update public.business_organization_conflicts set status='resolved',version=version+1,resolved_by=p_actor_id,resolution_reason=btrim(p_input->>'reason'),resolved_at=now()
  where id=(p_input->>'conflict_id')::uuid and organization_id=v.id and hotel_id=p_hotel_id and status='open';if not found then return jsonb_build_object('result','conflict_not_found');end if;
 else return jsonb_build_object('result','invalid_action');end if;
 update public.business_organizations set version=version+1,updated_at=now() where id=p_id;insert into public.business_organization_events(hotel_id,organization_id,action,actor_id,reason,details) values(p_hotel_id,p_id,p_input->>'action',p_actor_id,btrim(p_input->>'reason'),jsonb_build_object('target_id',coalesce((p_input->>'target_id')::uuid,v_new),'role_type',v_role,'role_id',v_role_id));return jsonb_build_object('result','ok','id',coalesce(v_new,(p_input->>'target_id')::uuid));exception when unique_violation then return jsonb_build_object('result','role_conflict');end $$;

alter table public.operational_pending drop constraint operational_pending_source_check;
alter table public.operational_pending add constraint operational_pending_source_check check(source in('maintenance','consumption','governance','inventory','procurement','cash','partner'));
alter function public.operational_pending_candidates(uuid,timestamptz) rename to operational_pending_candidates_stage5_base;
create function public.operational_pending_candidates(p_hotel_id uuid,p_now timestamptz default now()) returns jsonb language plpgsql set search_path=public as $$ declare v_result jsonb;v_date date;
begin v_result:=public.operational_pending_candidates_stage5_base(p_hotel_id,p_now);select (p_now at time zone timezone)::date into v_date from public.hotels where id=p_hotel_id;
 v_result:=v_result||coalesce((select jsonb_agg(jsonb_build_object('source','inventory','source_key','lot:'||l.id||':'||case when l.expires_on<v_date then 'expired' else 'expiring' end,'kind',case when l.expires_on<v_date then 'expired_lot' else 'expiring_lot' end,'entity_type','inventory_lot','entity_id',l.id,'title',case when l.expires_on<v_date then 'Lote vencido: ' else 'Lote próximo do vencimento: ' end||p.name,'href','/dashboard/inventory/lots','severity',case when l.expires_on<v_date then 'critical' else 'warning' end,'due_on',l.expires_on)) from public.inventory_lots l join public.products p on p.id=l.product_id where l.hotel_id=p_hotel_id and l.status='active' and l.expires_on<=v_date+p.expiry_alert_days and exists(select 1 from public.inventory_lot_balances b where b.lot_id=l.id and b.quantity>0)),'[]');
 v_result:=v_result||coalesce((select jsonb_agg(jsonb_build_object('source','procurement','source_key','replenishment:'||r.id,'kind','replenishment','entity_type','replenishment_request','entity_id',r.id,'title','Reposição pendente: '||p.name,'href','/dashboard/procurement','severity',case when r.priority='critical' then 'critical' else 'warning' end,'due_on',r.need_by)) from public.replenishment_requests r join public.products p on p.id=r.product_id where r.hotel_id=p_hotel_id and r.status in('draft','submitted','approved','converted')),'[]');
 v_result:=v_result||coalesce((select jsonb_agg(jsonb_build_object('source','procurement','source_key','invoice:'||i.id,'kind','procurement_invoice','entity_type','procurement_invoice','entity_id',i.id,'title',case when i.status='exception' then 'Divergência em nota de compra' else 'Conta de fornecedor pendente' end,'href','/dashboard/procurement','severity',case when i.status='exception' then 'critical' else 'warning' end,'due_on',(select min(due_on) from public.procurement_invoice_due_dates where invoice_id=i.id and paid_amount<amount))) from public.procurement_invoices i where i.hotel_id=p_hotel_id and i.status in('exception','approved','partially_paid')),'[]');
 v_result:=v_result||coalesce((select jsonb_agg(jsonb_build_object('source','cash','source_key','cash:'||s.id,'kind','cash_session','entity_type','cash_session','entity_id',s.id,'title',case when s.status='difference_pending' then 'Diferença de caixa aguardando decisão' else 'Caixa aberto além da data operacional' end,'href','/dashboard/cash','severity','critical','due_on',s.business_date)) from public.cash_sessions s where s.hotel_id=p_hotel_id and (s.status='difference_pending' or s.status in('open','counting') and s.business_date<v_date)),'[]');
 v_result:=v_result||coalesce((select jsonb_agg(jsonb_build_object('source','cash','source_key','daily-close:'||c.id,'kind','daily_close','entity_type','daily_close','entity_id',c.id,'title','Fechamento diário pendente','href','/dashboard/cash','severity',case when c.business_date<v_date-1 then 'critical' else 'warning' end,'due_on',c.business_date)) from public.daily_closes c where c.hotel_id=p_hotel_id and c.status<>'closed' and c.business_date<v_date),'[]');
 v_result:=v_result||coalesce((select jsonb_agg(jsonb_build_object('source','partner','source_key','partner-dispute:'||d.id,'kind','partner_dispute','entity_type','partner_dispute','entity_id',d.id,'title','Contestação de parceiro aguardando decisão','href','/dashboard/consumption/settlements?id='||d.settlement_id,'severity','warning')) from public.partner_settlement_disputes d where d.hotel_id=p_hotel_id and d.status='open'),'[]');
 v_result:=v_result||coalesce((select jsonb_agg(jsonb_build_object('source','procurement','source_key','organization-conflict:'||c.id,'kind','organization_conflict','entity_type','business_organization_conflict','entity_id',c.id,'title','Divergência cadastral em organização','href','/dashboard/organizations?id='||c.organization_id,'severity','warning')) from public.business_organization_conflicts c where c.hotel_id=p_hotel_id and c.status='open'),'[]');return v_result;end $$;

alter function public.can_read_operational_pending(public.operational_pending,uuid,text[]) rename to can_read_operational_pending_stage5_base;
create function public.can_read_operational_pending(p public.operational_pending,p_user_id uuid,p_permissions text[]) returns boolean language sql stable set search_path=public as $$ select case p.source
 when 'inventory' then 'read_inventory'=any(p_permissions)
 when 'procurement' then p_permissions&&array['read_procurement','request_procurement','approve_procurement','receive_procurement','review_procurement_invoices','settle_supplier_payables']
 when 'cash' then p_permissions&&array['read_cash_management','operate_cash_register','approve_cash_differences','prepare_daily_close','approve_daily_close']
 when 'partner' then p_permissions&&array['read_partner_settlements','manage_partner_disputes','settle_partner_settlements']
 else public.can_read_operational_pending_stage5_base(p,p_user_id,p_permissions) end $$;

alter function public.reconcile_operational_pending(uuid,timestamptz) rename to reconcile_operational_pending_stage5_base;
create function public.reconcile_operational_pending(p_hotel_id uuid,p_now timestamptz default now()) returns jsonb language plpgsql set search_path=public as $$ declare v_date date;begin select (p_now at time zone timezone)::date into v_date from public.hotels where id=p_hotel_id;perform public.reconcile_replenishment_requests(p_hotel_id,null);insert into public.daily_closes(hotel_id,business_date) values(p_hotel_id,v_date-1) on conflict do nothing;return public.reconcile_operational_pending_stage5_base(p_hotel_id,p_now);end $$;

create trigger partner_dispute_contacts_immutable before update or delete on public.partner_dispute_contacts for each row execute function public.prevent_maintenance_event_mutation();
create trigger partner_settlement_payment_batches_immutable before update or delete on public.partner_settlement_payment_batches for each row execute function public.prevent_maintenance_event_mutation();
insert into public.permissions(name,type) select name,'HOTEL_PERMISSION' from unnest(array['manage_partner_disputes']) name on conflict(name) do nothing;
do $$ declare t text;begin foreach t in array array['partner_settlement_payment_batches','partner_settlement_disputes','partner_dispute_contacts'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end $$;
grant execute on function public.create_partner_settlement_dispute(uuid,uuid,uuid,jsonb),public.pay_partner_settlement_partial(uuid,uuid,uuid,jsonb),public.act_partner_settlement_dispute(uuid,uuid,uuid,jsonb),public.operational_pending_candidates(uuid,timestamptz),public.can_read_operational_pending(public.operational_pending,uuid,text[]),public.reconcile_operational_pending(uuid,timestamptz) to service_role;
