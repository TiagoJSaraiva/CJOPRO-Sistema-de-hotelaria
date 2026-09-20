begin;
select plan(55);

select has_table('public','hotel_training_environments','training environment exists');
select has_table('public','hotel_training_clock_events','clock history exists');
select has_table('public','maintenance_warranty_decisions','warranty history exists');
select has_function('public','hotel_operational_now',array['uuid'],'operational clock exists');
select has_function('public','act_training_clock',array['uuid','uuid','jsonb'],'clock action exists');

select is(
  (public.prepare_training_scenario(
    '10000000-0000-4000-8000-000000000001','orientation',1,'Teste pgTAP',
    '80000000-0000-4000-8000-000000000002'
  )->>'clock_mode'),
  'frozen','scenario preparation freezes the clock'
);
select is(
  (select scenario_key from public.hotel_training_environments where hotel_id='10000000-0000-4000-8000-000000000001'),
  'orientation','scenario key is recorded'
);
select is(
  public.get_training_environment('10000000-0000-4000-8000-000000000001')->>'timezone',
  'America/Sao_Paulo','training environment exposes the hotel timezone'
);
select is(
  (select count(*)::integer from public.hotel_training_environments where hotel_id='10000000-0000-4000-8000-000000000002'),
  0,'Aurora clock does not create Horizonte state'
);

select is(
  (public.act_training_clock(
    '10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',
    jsonb_build_object('action','set','at','2030-01-10T12:00:00-03:00','expected_version',
      (select version from public.hotel_training_environments where hotel_id='10000000-0000-4000-8000-000000000001'),
      'reason','Data da lição')
  )->>'result'),
  'ok','clock accepts an explicit instant'
);
select is(
  public.hotel_operational_date('10000000-0000-4000-8000-000000000001'),
  date '2030-01-10','operational date follows frozen clock'
);
select ok(
  abs(extract(epoch from (clock_timestamp()-now())))<60,
  'database real clock remains independent from operational clock'
);
select is(
  (public.act_training_clock(
    '10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',
    jsonb_build_object('action','advance','amount',2,'unit','days','expected_version',
      (select version from public.hotel_training_environments where hotel_id='10000000-0000-4000-8000-000000000001'),
      'reason','Avanço didático')
  )->>'result'),
  'ok','frozen clock advances'
);
select is(
  public.hotel_operational_date('10000000-0000-4000-8000-000000000001'),
  date '2030-01-12','advance changes only operational date'
);
select is(
  (public.act_training_clock(
    '10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',
    jsonb_build_object('action','set','local_at','2031-02-03T10:30','expected_version',
      (select version from public.hotel_training_environments where hotel_id='10000000-0000-4000-8000-000000000001'),
      'reason','Data local da lição')
  )->>'result'),
  'ok','clock accepts a hotel-local date and time'
);
select is(
  to_char(public.hotel_operational_now('10000000-0000-4000-8000-000000000001') at time zone 'America/Sao_Paulo','YYYY-MM-DD"T"HH24:MI'),
  '2031-02-03T10:30','local training input is resolved in the hotel timezone'
);
select is(
  (public.act_training_clock(
    '10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',
    jsonb_build_object('action','resume','expected_version',
      (select version from public.hotel_training_environments where hotel_id='10000000-0000-4000-8000-000000000001'),
      'reason','Retomar tempo real')
  )->>'result'),
  'ok','clock resumes live mode'
);
select is(
  (select clock_mode::text from public.hotel_training_environments where hotel_id='10000000-0000-4000-8000-000000000001'),
  'live','resume clears frozen mode'
);
select throws_ok(
  $$ update public.hotel_training_clock_events set reason='alterado' where hotel_id='10000000-0000-4000-8000-000000000001' $$,
  '23514',null,'clock history is immutable'
);

select public.process_maintenance_expiry_alerts(
  '10000000-0000-4000-8000-000000000001',
  public.hotel_operational_date('10000000-0000-4000-8000-000000000001')
);
select ok(
  exists(
    select 1 from jsonb_array_elements(public.operational_pending_candidates(
      '10000000-0000-4000-8000-000000000001',now()
    )) item
    where item->>'kind'='warranty_expiry'
      and item->>'entity_id'='99500000-0000-4000-8000-000000000001'
  ),
  'warranty alert remains while the current term has no decision'
);

select is(
  (public.record_maintenance_warranty_decision(
    '10000000-0000-4000-8000-000000000001','99500000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000007',
    jsonb_build_object('result','expiry_acknowledged','reason','Ciência do vencimento registrada',
      'expected_location_version',(select version from public.maintenance_locations where id='99500000-0000-4000-8000-000000000001'))
  )->>'result'),
  'ok','supervisor records an auditable warranty decision'
);
select ok(
  not exists(
    select 1 from jsonb_array_elements(public.operational_pending_candidates(
      '10000000-0000-4000-8000-000000000001',now()
    )) item
    where item->>'kind'='warranty_expiry'
      and item->>'entity_id'='99500000-0000-4000-8000-000000000001'
  ),
  'warranty alert ends after a valid decision for the current term'
);
select is(
  (select count(*)::integer from public.maintenance_warranty_decisions where location_id='99500000-0000-4000-8000-000000000001'),
  1,'warranty decision is stored'
);
select throws_ok(
  $$ update public.maintenance_warranty_decisions set reason='alterado' where location_id='99500000-0000-4000-8000-000000000001' $$,
  '23514',null,'warranty history is immutable'
);
select is(
  (public.record_maintenance_warranty_decision(
    '10000000-0000-4000-8000-000000000001','99500000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000007',
    jsonb_build_object('result','renewed','reason','Renovação contratual validada',
      'new_warranty_ends_on',(select warranty_ends_on+365 from public.maintenance_locations where id='99500000-0000-4000-8000-000000000001'),
      'supersedes_id',(select id from public.maintenance_warranty_decisions where location_id='99500000-0000-4000-8000-000000000001'),
      'expected_location_version',(select version from public.maintenance_locations where id='99500000-0000-4000-8000-000000000001'))
  )->>'result'),
  'ok','a corrective warranty decision supersedes the prior decision'
);
select is(
  (public.record_maintenance_warranty_decision(
    '10000000-0000-4000-8000-000000000002','99500000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000003',
    jsonb_build_object('result','expiry_acknowledged','reason','Tentativa cruzada','expected_location_version',1)
  )->>'result'),
  'not_found','warranty action cannot cross hotels'
);
select is(
  (public.record_maintenance_warranty_decision(
    '10000000-0000-4000-8000-000000000001','99500000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000007',
    jsonb_build_object('result','claim_submitted','reason','Acionar fabricante',
      'expected_location_version',(select version from public.maintenance_locations where id='99500000-0000-4000-8000-000000000001'))
  )->>'result'),
  'active_occurrence_required','warranty claim requires a linked active occurrence'
);
select is(
  (public.record_maintenance_warranty_decision(
    '10000000-0000-4000-8000-000000000001','99500000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000007',
    jsonb_build_object('result','renewed','reason','Data inválida',
      'new_warranty_ends_on',(select warranty_ends_on from public.maintenance_locations where id='99500000-0000-4000-8000-000000000001'),
      'expected_location_version',(select version from public.maintenance_locations where id='99500000-0000-4000-8000-000000000001'))
  )->>'result'),
  'later_warranty_required','renewal requires a later warranty date'
);
select is(
  (public.record_maintenance_warranty_decision(
    '10000000-0000-4000-8000-000000000001','99500000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000007',
    jsonb_build_object('result','replaced','reason','Substituição inválida',
      'replacement_location_id','96000000-0000-4000-8000-000000000002',
      'expected_location_version',(select version from public.maintenance_locations where id='99500000-0000-4000-8000-000000000001'))
  )->>'result'),
  'active_replacement_required','replacement requires active equipment in the same hotel'
);
select is(
  (public.record_maintenance_warranty_decision(
    '10000000-0000-4000-8000-000000000001','99500000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000007',
    jsonb_build_object('result','expiry_acknowledged','reason','Ciência da nova vigência',
      'expected_location_version',(select version from public.maintenance_locations where id='99500000-0000-4000-8000-000000000001'))
  )->>'result'),
  'ok','a renewed term accepts its own auditable decision'
);
select is(
  (public.record_maintenance_warranty_decision(
    '10000000-0000-4000-8000-000000000001','99500000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000007',
    jsonb_build_object('result','retired','reason','Tentativa sem revisão',
      'expected_location_version',(select version from public.maintenance_locations where id='99500000-0000-4000-8000-000000000001'))
  )->>'result'),
  'decision_exists','a second decision for the same term must supersede the current one'
);
select is(
  (public.record_maintenance_warranty_decision(
    '10000000-0000-4000-8000-000000000001','99500000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000007',
    jsonb_build_object('result','retired','reason','Equipamento retirado de operação',
      'supersedes_id',(select d.id from public.maintenance_warranty_decisions d
        join public.maintenance_locations l on l.id=d.location_id
        where d.location_id='99500000-0000-4000-8000-000000000001'
          and d.warranty_ends_on=l.warranty_ends_on
          and not exists(select 1 from public.maintenance_warranty_decisions newer where newer.supersedes_id=d.id)
        order by d.created_at desc limit 1),
      'expected_location_version',(select version from public.maintenance_locations where id='99500000-0000-4000-8000-000000000001'))
  )->>'result'),
  'ok','a correction explicitly supersedes the prior decision'
);
select is(
  (select lifecycle_status::text from public.maintenance_locations where id='99500000-0000-4000-8000-000000000001'),
  'retired','retirement changes the equipment lifecycle'
);
select is(
  (public.record_maintenance_warranty_decision(
    '10000000-0000-4000-8000-000000000001','99500000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000007',
    jsonb_build_object('result','expiry_acknowledged','reason','Correção da aposentadoria',
      'supersedes_id',(public.list_maintenance_warranty_decisions(
        '10000000-0000-4000-8000-000000000001','99500000-0000-4000-8000-000000000001'
      )->>'current_decision_id')::uuid,
      'expected_location_version',(select version from public.maintenance_locations where id='99500000-0000-4000-8000-000000000001'))
  )->>'result'),
  'ok','correction can replace a side-effecting warranty decision'
);
select ok(
  (select is_active and lifecycle_status='active' from public.maintenance_locations where id='99500000-0000-4000-8000-000000000001'),
  'correction restores the state that existed before the superseded decision'
);
update public.maintenance_locations set lifecycle_status='out_of_service',version=version+1
where id='99500000-0000-4000-8000-000000000001';
select is(
  (public.record_maintenance_warranty_decision(
    '10000000-0000-4000-8000-000000000001','99500000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000007',
    jsonb_build_object('result','retired','reason','Conflito esperado',
      'supersedes_id',(public.list_maintenance_warranty_decisions(
        '10000000-0000-4000-8000-000000000001','99500000-0000-4000-8000-000000000001'
      )->>'current_decision_id')::uuid,
      'expected_location_version',(select version from public.maintenance_locations where id='99500000-0000-4000-8000-000000000001'))
  )->>'result'),
  'correction_conflict','correction rejects unrelated equipment state changes'
);

select throws_ok(
  $$ select public.release_maintenance_room_block(
    '10000000-0000-4000-8000-000000000002','95000000-0000-4000-8000-000000000002',
    '80000000-0000-4000-8000-000000000003','Serviço concluído'
  ) $$,
  '23514','Há ordens de serviço pendentes.',
  'room block cannot be released with an unfinished work order'
);
update public.maintenance_work_orders set status='completed',completed_at=now()
where id='98000000-0000-4000-8000-000000000001';
select throws_ok(
  $$ select public.release_maintenance_room_block(
    '10000000-0000-4000-8000-000000000002','95000000-0000-4000-8000-000000000002',
    '80000000-0000-4000-8000-000000000003','Serviço concluído'
  ) $$,
  '23514','Há inspeções técnicas obrigatórias pendentes.',
  'room block cannot be released before required technical inspection'
);
insert into public.maintenance_inspections(hotel_id,work_order_id,inspector_id,result,notes)
values(
  '10000000-0000-4000-8000-000000000002','98000000-0000-4000-8000-000000000001',
  '80000000-0000-4000-8000-000000000001','approved','Inspeção técnica aprovada'
);
select is(
  public.release_maintenance_room_block(
    '10000000-0000-4000-8000-000000000002','95000000-0000-4000-8000-000000000002',
    '80000000-0000-4000-8000-000000000003','Serviço e inspeção concluídos'
  ),
  '97000000-0000-4000-8000-000000000001'::uuid,
  'approved block release returns its maintenance occurrence'
);
select ok(
  exists(
    select 1 from public.governance_cycles c
    join public.governance_tasks t on t.cycle_id=c.id and t.kind='inspection' and t.status='pending'
    where c.hotel_id='10000000-0000-4000-8000-000000000002'
      and c.room_id='20000000-0000-4000-8000-000000000203'
      and c.status='inspection_pending'
  ),
  'technical release atomically creates the governance inspection'
);

select is(
  (public.open_cash_session(
    '10000000-0000-4000-8000-000000000001','81200000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000008',
    jsonb_build_object('opening_float',100,'idempotency_key','a5000000-0000-4000-8000-000000000101')
  )->>'result'),
  'ok','cashier opens the training register'
);
select is(
  jsonb_typeof(public.get_cash_session_for_actor(
    '10000000-0000-4000-8000-000000000001',
    (select id from public.cash_sessions where cash_register_id='81200000-0000-4000-8000-000000000001'),
    '80000000-0000-4000-8000-000000000008',false
  )->'expected_cash'),
  'null','own open session redacts expected cash at the API source'
);
select is(
  (public.get_cash_session_for_actor(
    '10000000-0000-4000-8000-000000000001',
    (select id from public.cash_sessions where cash_register_id='81200000-0000-4000-8000-000000000001'),
    '80000000-0000-4000-8000-000000000010',true
  )->>'expected_cash')::numeric,
  100::numeric,'a distinct approver can see expected cash'
);
select is(
  (public.act_cash_session(
    '10000000-0000-4000-8000-000000000001',
    (select id from public.cash_sessions where cash_register_id='81200000-0000-4000-8000-000000000001'),
    '80000000-0000-4000-8000-000000000008',
    jsonb_build_object('action','count','counted_amount',100,'expected_version',1,
      'idempotency_key','a5000000-0000-4000-8000-000000000102')
  )->>'result'),
  'ok','cashier counts without receiving the expected amount'
);
select is(
  (public.get_cash_session_for_actor(
    '10000000-0000-4000-8000-000000000001',
    (select id from public.cash_sessions where cash_register_id='81200000-0000-4000-8000-000000000001'),
    '80000000-0000-4000-8000-000000000008',false
  )->>'expected_cash')::numeric,
  100::numeric,'expected cash becomes visible after counting'
);
select is(
  public.list_cash_registers_for_actor(
    '10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000008',false
  )->>'operational_date',
  public.hotel_operational_date('10000000-0000-4000-8000-000000000001')::text,
  'cash register list exposes the operational date'
);
select is(
  public.daily_close_projection(
    '10000000-0000-4000-8000-000000000001',
    public.hotel_operational_date('10000000-0000-4000-8000-000000000001')
  )->'cash_sessions'->0->>'currency',
  'BRL','daily close sessions identify their currency'
);
select ok(
  (select daily_close_started_on is not null from public.cash_management_settings where hotel_id='10000000-0000-4000-8000-000000000001'),
  'first active register starts daily close obligation'
);
select ok(
  (public.daily_close_projection(
    '10000000-0000-4000-8000-000000000001',
    public.hotel_operational_date('10000000-0000-4000-8000-000000000001')+20
  )->>'is_zero_activity')::boolean,
  'a day without movements has an explicit zero-activity projection'
);
delete from public.cash_management_settings where hotel_id='10000000-0000-4000-8000-000000000002';
delete from public.daily_closes where hotel_id='10000000-0000-4000-8000-000000000002';
insert into public.daily_closes(hotel_id,business_date)
values(
  '10000000-0000-4000-8000-000000000002',
  public.hotel_operational_date('10000000-0000-4000-8000-000000000002')-10
);
select is(
  coalesce((select count(*)::integer from jsonb_array_elements(public.operational_pending_candidates(
    '10000000-0000-4000-8000-000000000002',now()
  )) item where item->>'kind'='daily_close'),0),
  0,'daily close is not pending before cash operation starts'
);
insert into public.cash_management_settings(hotel_id,daily_close_started_on)
values(
  '10000000-0000-4000-8000-000000000002',
  public.hotel_operational_date('10000000-0000-4000-8000-000000000002')
);
select is(
  coalesce((select count(*)::integer from jsonb_array_elements(public.operational_pending_candidates(
    '10000000-0000-4000-8000-000000000002',now()
  )) item where item->>'kind'='daily_close'),0),
  0,'daily closes before activation remain filtered'
);
insert into public.daily_closes(hotel_id,business_date)
values(
  '10000000-0000-4000-8000-000000000002',
  public.hotel_operational_date('10000000-0000-4000-8000-000000000002')
);
select ok(
  (select item->>'href' from jsonb_array_elements(public.operational_pending_candidates(
    '10000000-0000-4000-8000-000000000002',
    public.hotel_operational_now('10000000-0000-4000-8000-000000000002')+interval '1 day'
  )) item where item->>'kind'='daily_close'
    and item->>'due_on'=public.hotel_operational_date('10000000-0000-4000-8000-000000000002')::text)
    like '/dashboard/cash?date=%#daily-close',
  'eligible daily close links to its own date'
);
update public.cash_management_settings
set daily_close_started_on=public.hotel_operational_date('10000000-0000-4000-8000-000000000002')-3
where hotel_id='10000000-0000-4000-8000-000000000002';
delete from public.daily_closes where hotel_id='10000000-0000-4000-8000-000000000002';
select public.reconcile_operational_pending('10000000-0000-4000-8000-000000000002',now());
select is(
  (select count(*)::integer from public.daily_closes
    where hotel_id='10000000-0000-4000-8000-000000000002'
      and business_date between
        public.hotel_operational_date('10000000-0000-4000-8000-000000000002')-3
        and public.hotel_operational_date('10000000-0000-4000-8000-000000000002')-1),
  3,'reconciliation creates every missing operational date'
);
select is(
  (select count(*)::integer from public.user_roles where hotel_id='10000000-0000-4000-8000-000000000001'),
  8,'Aurora seed contains eight operational accounts'
);
select ok(
  exists(select 1 from public.inventory_positions where hotel_id='10000000-0000-4000-8000-000000000001'),
  'Aurora seed contains an inventory position'
);

select * from finish();
rollback;
