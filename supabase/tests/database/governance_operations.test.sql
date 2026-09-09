begin;
select plan(47);

select ok(to_regclass('public.governance_cycles') is not null, 'governance cycles exist');
select ok(to_regclass('public.governance_tasks') is not null, 'governance tasks exist');
select ok(to_regclass('public.governance_events') is not null, 'governance audit exists');
select ok(to_regclass('public.stay_relocation_events') is not null, 'relocation audit exists');
select ok((select relrowsecurity from pg_class where oid='public.governance_cycles'::regclass), 'cycles use RLS');
select ok(not has_table_privilege('authenticated','public.governance_cycles','SELECT'), 'browser role cannot read cycles directly');
select is((select count(*)::integer from public.governance_checklist_templates where is_active),6,'every seeded hotel receives three active templates');
select is((select count(*)::integer from public.governance_cycles where source='maintenance' and status='maintenance_hold'),2,'active legacy blocks create hold cycles');
select is((select count(*)::integer from public.governance_cycles where stay_id='91000000-0000-4000-8000-000000000003'),0,'closed stays receive no retroactive cycle');
select is((select count(*)::integer from public.governance_cycles where stay_id='91000000-0000-4000-8000-000000000002'),0,'checked-in stay waits for pre-departure review or checkout');
select is(public.governance_room_state('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000102')->>'occupancy','occupied','occupancy is independent from governance');
select is(public.governance_room_state('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000203')->>'readiness','blocked','active maintenance block is absolute');
select is(public.create_governance_cycle('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000102','91000000-0000-4000-8000-000000000002','pre_departure','80000000-0000-4000-8000-000000000002','Vistoria solicitada')->>'result','ok','pre-departure opens a cycle');
select is((select status::text from public.governance_cycles where stay_id='91000000-0000-4000-8000-000000000002'),'departure_review','pre-departure starts in review');
select is((select count(*)::integer from public.governance_task_checklist_items i join public.governance_tasks t on t.id=i.task_id join public.governance_cycles c on c.id=t.cycle_id where c.stay_id='91000000-0000-4000-8000-000000000002' and t.kind='departure_review'),2,'cycle snapshots the active checklist');

alter table public.stays disable trigger trg_stays_block_invalid_checkout;
update public.stays set stay_status='checked_out',checkout_date_actual=now() where id='91000000-0000-4000-8000-000000000002';
alter table public.stays enable trigger trg_stays_block_invalid_checkout;
select is((select status::text from public.governance_cycles where stay_id='91000000-0000-4000-8000-000000000002'),'cleaning_pending','checkout advances the existing cycle');
select is((select t.status::text from public.governance_tasks t join public.governance_cycles c on c.id=t.cycle_id where c.stay_id='91000000-0000-4000-8000-000000000002' and t.kind='departure_review'),'canceled','checkout cancels unfinished departure review');
select is((select count(*)::integer from public.governance_tasks t join public.governance_cycles c on c.id=t.cycle_id where c.stay_id='91000000-0000-4000-8000-000000000002' and t.kind='cleaning'),1,'checkout creates one cleaning task');
select is(public.reconcile_operational_pending('10000000-0000-4000-8000-000000000001')->>'result','ok','governance sources reconcile into the shared queue');
select is((select p.status::text from public.operational_pending p join public.governance_tasks t on t.id=p.entity_id join public.governance_cycles c on c.id=t.cycle_id where c.stay_id='91000000-0000-4000-8000-000000000002' and t.kind='cleaning' and p.status<>'resolved'),'open','unassigned governance task starts in the shared queue');

select is(public.act_governance_cycle(
  '10000000-0000-4000-8000-000000000001',
  (select id from public.governance_cycles where stay_id='91000000-0000-4000-8000-000000000002'),
  '80000000-0000-4000-8000-000000000002',
  jsonb_build_object('action','claim','task_id',(select t.id from public.governance_tasks t join public.governance_cycles c on c.id=t.cycle_id where c.stay_id='91000000-0000-4000-8000-000000000002' and t.kind='cleaning'),'expected_version',(select version from public.governance_cycles where stay_id='91000000-0000-4000-8000-000000000002'))
)->>'result','ok','executor claims cleaning');
select is((select p.status::text from public.operational_pending p join public.governance_tasks t on t.id=p.entity_id join public.governance_cycles c on c.id=t.cycle_id where c.stay_id='91000000-0000-4000-8000-000000000002' and t.kind='cleaning' and p.status<>'resolved'),'claimed','governance assignment updates the shared queue in the same transaction');
select is(public.act_governance_cycle(
  '10000000-0000-4000-8000-000000000001',
  (select id from public.governance_cycles where stay_id='91000000-0000-4000-8000-000000000002'),
  '80000000-0000-4000-8000-000000000002',
  jsonb_build_object('action','start','task_id',(select t.id from public.governance_tasks t join public.governance_cycles c on c.id=t.cycle_id where c.stay_id='91000000-0000-4000-8000-000000000002' and t.kind='cleaning'),'expected_version',(select version from public.governance_cycles where stay_id='91000000-0000-4000-8000-000000000002'))
)->>'result','ok','assigned executor starts cleaning');
select is(public.act_governance_cycle(
  '10000000-0000-4000-8000-000000000001',
  (select id from public.governance_cycles where stay_id='91000000-0000-4000-8000-000000000002'),
  '80000000-0000-4000-8000-000000000002',
  jsonb_build_object('action','complete','task_id',(select t.id from public.governance_tasks t join public.governance_cycles c on c.id=t.cycle_id where c.stay_id='91000000-0000-4000-8000-000000000002' and t.kind='cleaning'),'expected_version',(select version from public.governance_cycles where stay_id='91000000-0000-4000-8000-000000000002'),'answers',(select jsonb_agg(jsonb_build_object('item_id',i.id,'result','approved')) from public.governance_task_checklist_items i join public.governance_tasks t on t.id=i.task_id join public.governance_cycles c on c.id=t.cycle_id where c.stay_id='91000000-0000-4000-8000-000000000002' and t.kind='cleaning'))
)->>'result','ok','complete cleaning validates its checklist');
select is((select status::text from public.governance_cycles where stay_id='91000000-0000-4000-8000-000000000002'),'inspection_pending','cleaning queues inspection');
select is((select count(*)::integer from public.governance_tasks t join public.governance_cycles c on c.id=t.cycle_id where c.stay_id='91000000-0000-4000-8000-000000000002' and t.kind='inspection'),1,'inspection task is created');

select is(public.act_governance_cycle(
  '10000000-0000-4000-8000-000000000001',
  (select id from public.governance_cycles where stay_id='91000000-0000-4000-8000-000000000002'),
  '80000000-0000-4000-8000-000000000002',
  jsonb_build_object('action','claim','task_id',(select t.id from public.governance_tasks t join public.governance_cycles c on c.id=t.cycle_id where c.stay_id='91000000-0000-4000-8000-000000000002' and t.kind='inspection'),'expected_version',(select version from public.governance_cycles where stay_id='91000000-0000-4000-8000-000000000002'))
)->>'result','ok','inspector can claim pending inspection');
select is(public.act_governance_cycle(
  '10000000-0000-4000-8000-000000000001',
  (select id from public.governance_cycles where stay_id='91000000-0000-4000-8000-000000000002'),
  '80000000-0000-4000-8000-000000000002',
  jsonb_build_object('action','approve','note','Inspeção registrada','task_id',(select t.id from public.governance_tasks t join public.governance_cycles c on c.id=t.cycle_id where c.stay_id='91000000-0000-4000-8000-000000000002' and t.kind='inspection'),'expected_version',(select version from public.governance_cycles where stay_id='91000000-0000-4000-8000-000000000002'),'answers',(select jsonb_agg(jsonb_build_object('item_id',i.id,'result','approved')) from public.governance_task_checklist_items i join public.governance_tasks t on t.id=i.task_id join public.governance_cycles c on c.id=t.cycle_id where c.stay_id='91000000-0000-4000-8000-000000000002' and t.kind='inspection'))
)->>'result','inspector_must_differ','cleaner cannot approve final inspection');
select is((select count(*)::integer from public.governance_task_checklist_items i join public.governance_tasks t on t.id=i.task_id join public.governance_cycles c on c.id=t.cycle_id where c.stay_id='91000000-0000-4000-8000-000000000002' and t.kind='inspection' and i.result<>'pending'),0,'failed inspection does not persist answers');
select is(public.act_governance_cycle(
  '10000000-0000-4000-8000-000000000001',
  (select id from public.governance_cycles where stay_id='91000000-0000-4000-8000-000000000002'),
  '80000000-0000-4000-8000-000000000001',
  jsonb_build_object('action','assign','task_id',(select t.id from public.governance_tasks t join public.governance_cycles c on c.id=t.cycle_id where c.stay_id='91000000-0000-4000-8000-000000000002' and t.kind='inspection'),'assigned_to','80000000-0000-4000-8000-000000000001','expected_version',(select version from public.governance_cycles where stay_id='91000000-0000-4000-8000-000000000002'))
)->>'result','ok','manager assigns a different inspector');
select is(public.act_governance_cycle(
  '10000000-0000-4000-8000-000000000001',
  (select id from public.governance_cycles where stay_id='91000000-0000-4000-8000-000000000002'),
  '80000000-0000-4000-8000-000000000001',
  jsonb_build_object('action','approve','note','Inspeção aprovada','task_id',(select t.id from public.governance_tasks t join public.governance_cycles c on c.id=t.cycle_id where c.stay_id='91000000-0000-4000-8000-000000000002' and t.kind='inspection'),'expected_version',(select version from public.governance_cycles where stay_id='91000000-0000-4000-8000-000000000002'),'answers',(select jsonb_agg(jsonb_build_object('item_id',i.id,'result','approved')) from public.governance_task_checklist_items i join public.governance_tasks t on t.id=i.task_id join public.governance_cycles c on c.id=t.cycle_id where c.stay_id='91000000-0000-4000-8000-000000000002' and t.kind='inspection'))
)->>'result','ok','different inspector releases the room');
select is((select status::text from public.governance_cycles where stay_id='91000000-0000-4000-8000-000000000002'),'released','approved inspection ends the episode');

select is(public.create_governance_cycle('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000102','91000000-0000-4000-8000-000000000002','manual','80000000-0000-4000-8000-000000000002','Divergência após checkout')->>'result','ok','a new episode can start after release');
select is(public.governance_register_minibar(
  '10000000-0000-4000-8000-000000000001',
  (select id from public.governance_cycles where room_id='20000000-0000-4000-8000-000000000102' and status not in ('released','canceled')),
  '80000000-0000-4000-8000-000000000002',
  jsonb_build_object('discrepancy_only',true,'idempotency_key','b0000000-0000-4000-8000-000000000001','notes','Achado após o checkout','items',jsonb_build_array(jsonb_build_object('offer_id',(select id from public.consumption_offers where hotel_id='10000000-0000-4000-8000-000000000001' limit 1),'quantity',1,'replenishment_quantity',1)))
)->>'result','ok','post-checkout minibar finding does not reopen the folio');
select is((select count(*)::integer from public.governance_tasks t join public.governance_cycles c on c.id=t.cycle_id where c.room_id='20000000-0000-4000-8000-000000000102' and c.status not in ('released','canceled') and t.kind='replenishment' and t.status='pending'),1,'minibar finding creates a replenishment task');
select is(public.governance_create_defect(
  '10000000-0000-4000-8000-000000000001',
  (select id from public.governance_cycles where room_id='20000000-0000-4000-8000-000000000102' and status not in ('released','canceled')),
  '80000000-0000-4000-8000-000000000002',
  jsonb_build_object('category_id',(select id from public.maintenance_categories where hotel_id='10000000-0000-4000-8000-000000000001' and is_active limit 1),'kind','defect','priority','normal','description','Torneira com gotejamento','blocking',false)
)->>'result','ok','governance reports a non-blocking room defect atomically');
select is((select count(*)::integer from public.governance_maintenance_links l join public.governance_cycles c on c.id=l.cycle_id where c.room_id='20000000-0000-4000-8000-000000000102' and not l.blocking),1,'non-blocking defect is linked to its governance episode');

select is(public.simulate_stay_relocation('10000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001')->>'result','ok','confirmed future stay can be simulated');
select ok(jsonb_array_length(public.simulate_stay_relocation('10000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001')->'items')>0,'simulation returns compatible rooms');
select is(public.relocate_confirmed_stay('10000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001',(public.simulate_stay_relocation('10000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001')->'items'->0->>'room_id')::uuid,'80000000-0000-4000-8000-000000000002',1,'Interdição preventiva')->>'result','ok','relocation is committed after revalidation');
select is((select applied_daily_rate::numeric from public.stays where id='91000000-0000-4000-8000-000000000001'),250.00::numeric,'relocation preserves contracted rate');
select is((select count(*)::integer from public.stay_relocation_events where stay_id='91000000-0000-4000-8000-000000000001'),1,'relocation writes immutable history');
select is(public.create_governance_cycle('10000000-0000-4000-8000-000000000001',(select room_id from public.stays where id='91000000-0000-4000-8000-000000000001'),null,'manual','80000000-0000-4000-8000-000000000002','Limpeza antes da chegada')->>'result','ok','manual cleaning can make a future arrival not ready');
select is(public.checkin_stay_with_readiness('10000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',(select version from public.governance_cycles where room_id=(select room_id from public.stays where id='91000000-0000-4000-8000-000000000001') and status not in ('released','canceled')),null,false)->>'result','room_not_ready','check-in refuses a room that governance has not released');
select is(public.checkin_stay_with_readiness('10000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',(select version from public.governance_cycles where room_id=(select room_id from public.stays where id='91000000-0000-4000-8000-000000000001') and status not in ('released','canceled')),'Chegada antecipada autorizada',true)->>'result','ok','authorized readiness override completes check-in');
select is((select count(*)::integer from public.governance_events e join public.governance_cycles c on c.id=e.cycle_id where c.room_id=(select room_id from public.stays where id='91000000-0000-4000-8000-000000000001') and e.action='readiness_override'),1,'readiness override is audited');
select is((select stay_status::text from public.stays where id='91000000-0000-4000-8000-000000000001'),'checked_in','authorized override updates the stay atomically');

select * from finish();
rollback;
