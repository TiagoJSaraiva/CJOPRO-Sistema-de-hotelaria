begin;
select no_plan();
select ok((select relrowsecurity from pg_class where oid='public.operational_pending'::regclass),'pending has RLS');
select ok(not has_table_privilege('authenticated','public.operational_pending','SELECT'),'direct clients cannot read all hotels');
select ok(not has_function_privilege('authenticated','public.act_operational_pending(uuid,uuid,text[],uuid[],text,integer)','EXECUTE'),'direct clients cannot impersonate an actor');
select is(public.reconcile_operational_pending('10000000-0000-4000-8000-000000000001')->>'result','ok','reconciliation reads all source conditions');
create temporary table first_pending as select id,source_key,episode from public.operational_pending where hotel_id='10000000-0000-4000-8000-000000000001';
select is(public.reconcile_operational_pending('10000000-0000-4000-8000-000000000001')->>'result','ok','reconciliation repeats safely');
select is((select count(*)::integer from public.operational_pending where hotel_id='10000000-0000-4000-8000-000000000001'),(select count(*)::integer from first_pending),'no duplicate episodes on repeated reconciliation');
insert into public.operational_pending(id,hotel_id,source,source_key,kind,entity_type,entity_id,episode,title,href,severity)
values('a0900000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','consumption','test-position','critical_stock','critical_stock','a0900000-0000-4000-8000-000000000002',1,'Estoque de teste','/dashboard/inventory','warning');
select is(jsonb_array_length(public.list_operational_pending('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',array[]::text[])->'items'),0,'no source permission reveals no rows');
select is(public.act_operational_pending('10000000-0000-4000-8000-000000000002','80000000-0000-4000-8000-000000000002',array['read_inventory'],array['a0900000-0000-4000-8000-000000000001']::uuid[],'read')->>'result','not_found','cross hotel action is hidden');
select is(public.act_operational_pending('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',array['read_inventory'],array['a0900000-0000-4000-8000-000000000001']::uuid[],'read')->>'result','ok','reader can mark own reading');
select is((select count(*)::integer from public.operational_pending_reads where pending_id='a0900000-0000-4000-8000-000000000001' and user_id='80000000-0000-4000-8000-000000000001'),0,'another user remains unread');
select is((select status from public.operational_pending where id='a0900000-0000-4000-8000-000000000001'),'open','reading does not assume');
select is(public.act_operational_pending('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',array['read_inventory'],array['a0900000-0000-4000-8000-000000000001']::uuid[],'claim',1)->>'result','ok','first claim succeeds');
select is(public.act_operational_pending('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',array['read_inventory'],array['a0900000-0000-4000-8000-000000000001']::uuid[],'claim',1)->>'result','conflict','stale competing claim fails');
select is(public.act_operational_pending('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',array['read_inventory'],array['a0900000-0000-4000-8000-000000000001']::uuid[],'release',2)->>'result','conflict','another actor cannot release');
select is(public.act_operational_pending('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',array['read_inventory'],array['a0900000-0000-4000-8000-000000000001']::uuid[],'release',2)->>'result','ok','owner can release');
select is(public.act_operational_pending('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',array['read_inventory'],array['a0900000-0000-4000-8000-000000000001']::uuid[],'resolve',3)->>'result','invalid','manual resolution is unavailable');
select is(public.reconcile_operational_pending('10000000-0000-4000-8000-000000000001')->>'result','ok','successful synchronization resolves absent condition');
select is((select status from public.operational_pending where id='a0900000-0000-4000-8000-000000000001'),'resolved','origin resolution closes shared state');
select ok((select exists(select 1 from public.operational_pending_events where pending_id='a0900000-0000-4000-8000-000000000001' and action='resolved')),'resolution preserves an event');
-- Temporary source override simulates recurrence/failure without editing historical migrations.
create or replace function public.operational_pending_candidates(p_hotel_id uuid,p_now timestamptz default now()) returns jsonb language sql as $$
  select '[{"source":"consumption","source_key":"test-position","kind":"critical_stock","entity_type":"critical_stock","entity_id":"a0900000-0000-4000-8000-000000000002","title":"Estoque de teste","href":"/dashboard/inventory","severity":"warning"}]'::jsonb;
$$;
select is(public.reconcile_operational_pending('10000000-0000-4000-8000-000000000001')->>'result','ok','recurrence creates another episode');
select is((select max(episode) from public.operational_pending where source_key='test-position'),2,'recurrence is a new episode');
select ok((select assigned_to is null from public.operational_pending where source_key='test-position' and episode=2),'recurrence does not inherit responsible user');
select is((select count(*)::integer from public.operational_pending_reads r join public.operational_pending p on p.id=r.pending_id where p.source_key='test-position' and p.episode=2),0,'recurrence does not inherit reading');
create or replace function public.operational_pending_candidates(p_hotel_id uuid,p_now timestamptz default now()) returns jsonb language plpgsql as $$ begin raise exception 'source unavailable'; end; $$;
select is(public.reconcile_operational_pending('10000000-0000-4000-8000-000000000001')->>'result','failed','failure is reported');
select is((select status from public.operational_pending where source_key='test-position' and episode=2),'open','failure never resolves previous items');
select ok((select error_message is not null from public.operational_pending_sync where hotel_id='10000000-0000-4000-8000-000000000001'),'failure is visible on synchronization status');
select is((select item->>'href' from jsonb_array_elements(public.list_operational_pending('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',array['read_consumption_analytics'])->'items') item where item->>'title'='Estoque de teste' and item->>'status'='open'),'/dashboard/consumption/analytics','analyst link respects inventory access restriction');
select * from finish();
rollback;
