begin;
select plan(40);

-- Roteiros de SLA e preventiva de docs/qa/rules-flows.md. Toda alteração é revertida ao final.
create temporary table ctx on commit drop as
select
  '10000000-0000-4000-8000-000000000001'::uuid as hotel,
  '80000000-0000-4000-8000-000000000007'::uuid as supervisor,
  '80000000-0000-4000-8000-000000000006'::uuid as technician,
  '20000000-0000-4000-8000-000000000103'::uuid as room,
  (select id from public.maintenance_categories where hotel_id='10000000-0000-4000-8000-000000000001' and name='Elétrica') as category,
  (select id from public.maintenance_categories where hotel_id='10000000-0000-4000-8000-000000000001' and name='Hidráulica') as other_category,
  public.hotel_operational_now('10000000-0000-4000-8000-000000000001') as at,
  public.hotel_operational_date('10000000-0000-4000-8000-000000000001') as today;

create function pg_temp.occurrence(p_priority text,p_category uuid default null,p_at timestamptz default null) returns uuid language sql as $$
  select public.create_maintenance_occurrence(hotel,coalesce(p_category,category),room,null,null,'other',p_priority::public.maintenance_priority,'Ocorrência do roteiro de SLA',coalesce(p_at,at),supervisor,false) from ctx
$$;
create function pg_temp.policy_name(p_occurrence uuid) returns text language sql as $$
  select sla_snapshot->>'name' from public.maintenance_occurrences where id=p_occurrence
$$;

-- SLA: precedência de categoria e prioridade sobre o padrão da prioridade.
insert into public.maintenance_sla_policies(hotel_id,category_id,priority,name,response_hours,resolution_hours)
select hotel,category,'high','SLA elétrica alta',2,10 from ctx;
select is(pg_temp.policy_name(pg_temp.occurrence('high')),'SLA elétrica alta','categoria e prioridade vencem');
select is(pg_temp.policy_name(pg_temp.occurrence('high',(select other_category from ctx))),'SLA alto','sem política da categoria vale a da prioridade');
update public.maintenance_sla_policies set is_active=false where hotel_id=(select hotel from ctx) and name='SLA baixo';
select is(pg_temp.policy_name(pg_temp.occurrence('low')),null,'sem política ativa a ocorrência fica sem prazo');

-- SLA: a resolução não vem antes da resposta.
select throws_ok(
  $$insert into public.maintenance_sla_policies(hotel_id,category_id,priority,name,response_hours,resolution_hours)
    select hotel,other_category,'low','SLA invertido',10,2 from ctx$$,
  '23514',null,'resolução menor que a resposta é recusada na criação'
);
select throws_ok(
  $$update public.maintenance_sla_policies set resolution_hours=1 where hotel_id=(select hotel from ctx) and name='SLA elétrica alta'$$,
  '23514',null,'resolução menor que a resposta é recusada na alteração'
);
select lives_ok(
  $$insert into public.maintenance_sla_policies(hotel_id,category_id,priority,name,response_hours,resolution_hours)
    select hotel,other_category,'low','SLA de prazo igual',4,4 from ctx$$,
  'resolução igual à resposta é aceita'
);

-- SLA: a política é copiada e não muda retroativamente.
create temporary table sla_case on commit drop as select pg_temp.occurrence('normal') as id;
create function pg_temp.sla() returns public.maintenance_occurrences language sql as $$
  select o from public.maintenance_occurrences o where o.id=(select id from sla_case)
$$;
select is((pg_temp.sla()).sla_response_due_at,(select at+interval '12 hours' from ctx),'o prazo de resposta conta da descoberta');
select is((pg_temp.sla()).sla_resolution_due_at,(select at+interval '72 hours' from ctx),'o prazo de resolução conta da descoberta');
update public.maintenance_sla_policies set response_hours=60 where hotel_id=(select hotel from ctx) and name='SLA normal';
update public.maintenance_occurrences set description=description||'.' where id=(select id from sla_case);
select is((pg_temp.sla()).sla_snapshot->>'response_hours','12','mudar a política não altera a ocorrência existente');

-- SLA: alertas em 75%, no vencimento e a cada 24 horas de violação.
create function pg_temp.alert_at(p_hours numeric) returns integer language sql as $$
  select public.process_maintenance_sla_alerts(hotel,at+make_interval(mins=>(p_hours*60)::integer)) from ctx
$$;
create function pg_temp.thresholds(p_kind text) returns text[] language sql as $$
  select coalesce(array_agg(distinct threshold order by threshold),'{}') from public.maintenance_notifications
  where entity_id=(select id from sla_case) and kind=p_kind
$$;
select pg_temp.alert_at(8.9);
select is(pg_temp.thresholds('sla_response'),'{}'::text[],'antes de 75% do prazo não há alerta');
select pg_temp.alert_at(9);
select is(pg_temp.thresholds('sla_response'),array['response-75'],'alerta em 75% do prazo de resposta');
select is(pg_temp.alert_at(9),0,'repetir o processamento não duplica o alerta');
select pg_temp.alert_at(12);
select ok('response-breach:0'=any(pg_temp.thresholds('sla_response')),'alerta no vencimento');
select is(
  (select severity::text from public.maintenance_notifications where entity_id=(select id from sla_case) and threshold='response-breach:0' limit 1),
  'critical','o vencimento é crítico'
);
select pg_temp.alert_at(35.9);
select ok(not 'response-breach:1'=any(pg_temp.thresholds('sla_response')),'antes de 24 horas de violação não repete');
select pg_temp.alert_at(36);
select ok('response-breach:1'=any(pg_temp.thresholds('sla_response')),'repete a cada 24 horas de violação');
select is(
  (select count(distinct recipient_id)::integer from public.maintenance_notifications where entity_id=(select id from sla_case) and threshold='response-75')>=2,
  true,'o alerta chega a quem responde e aos gestores'
);
update public.maintenance_occurrences set triaged_at=(select at from ctx),triaged_by=(select supervisor from ctx),status='triaged' where id=(select id from sla_case);
select pg_temp.alert_at(60);
select ok(not 'response-breach:2'=any(pg_temp.thresholds('sla_response')),'a triagem encerra o prazo de resposta');
select ok(array_length(pg_temp.thresholds('sla_resolution'),1)>=1,'o prazo de resolução continua contando');
update public.maintenance_occurrences set status='canceled',canceled_reason='Roteiro',operational_resolved_at=null where id=(select id from sla_case);
delete from public.maintenance_notifications where entity_id=(select id from sla_case);
select pg_temp.alert_at(200);
select is((select count(*)::integer from public.maintenance_notifications where entity_id=(select id from sla_case)),0,'ocorrência cancelada não alerta');

-- Preventiva: gera ocorrência, ordem e checklist, uma vez por competência.
insert into public.maintenance_preventive_plans(id,hotel_id,name,category_id,room_id,assigned_to,instructions,recurrence_unit,recurrence_day,starts_on,next_due_date,created_by)
select 'd1000000-0000-4000-8000-000000000001',hotel,'Limpeza de filtros',category,room,technician,'Limpar os filtros do ar','monthly',31,today,today,supervisor from ctx;
insert into public.maintenance_preventive_plan_tasks(hotel_id,plan_id,position,description,is_required)
select hotel,'d1000000-0000-4000-8000-000000000001',1,'Retirar o filtro',true from ctx;
create function pg_temp.process(p_days integer default 0) returns jsonb language sql as $$
  select public.process_maintenance_preventive_plans(hotel,at+make_interval(days=>p_days)) from ctx
$$;
create function pg_temp.runs(p_status text) returns integer language sql as $$
  select count(*)::integer from public.maintenance_preventive_runs where plan_id='d1000000-0000-4000-8000-000000000001' and status::text=p_status
$$;
select cmp_ok((pg_temp.process()->>'generated')::integer,'>=',1,'a competência vencida é gerada');
select is(pg_temp.runs('generated'),1,'o plano ganha uma competência');
select is(
  (select o.kind::text||'|'||(o.triaged_at is not null)::text||'|'||w.assigned_to::text from public.maintenance_preventive_runs r join public.maintenance_occurrences o on o.id=r.occurrence_id join public.maintenance_work_orders w on w.id=r.work_order_id where r.plan_id='d1000000-0000-4000-8000-000000000001'),
  (select 'preventive|true|'||technician::text from ctx),'nasce ocorrência preventiva triada e ordem do responsável'
);
select is(
  (select count(*)::integer from public.maintenance_work_order_checklist_items c join public.maintenance_preventive_runs r on r.work_order_id=c.work_order_id where r.plan_id='d1000000-0000-4000-8000-000000000001'),
  1,'o checklist do plano vai para a ordem'
);
select ok(
  (select next_due_date>(select today from ctx) from public.maintenance_preventive_plans where id='d1000000-0000-4000-8000-000000000001'),
  'a próxima data avança'
);
select is((pg_temp.process()->>'generated')::integer,0,'repetir o processamento não gera de novo');

-- Preventiva: execução anterior aberta adia a competência.
update public.maintenance_preventive_plans set next_due_date=(select today from ctx)+1 where id='d1000000-0000-4000-8000-000000000001';
select is((pg_temp.process(1)->>'deferred')::integer,1,'execução anterior aberta adia a competência');
select is(pg_temp.runs('deferred'),1,'a competência adiada fica aguardando decisão');
select ok(
  exists(select 1 from public.maintenance_notifications where kind='preventive_deferred' and recipient_id=(select technician from ctx)),
  'o responsável é avisado do adiamento'
);
select throws_ok(
  $$select public.decide_maintenance_preventive_run(hotel,(select id from public.maintenance_preventive_runs where plan_id='d1000000-0000-4000-8000-000000000001' and status='deferred'),supervisor,'generate','  ') from ctx$$,
  '23514',null,'a decisão exige justificativa'
);
select isnt(
  (select public.decide_maintenance_preventive_run(hotel,(select id from public.maintenance_preventive_runs where plan_id='d1000000-0000-4000-8000-000000000001' and status='deferred'),supervisor,'generate','Equipe disponível') from ctx),
  null,'o gestor gera mesmo com a anterior aberta'
);
select is(pg_temp.runs('generated'),2,'a competência decidida é gerada');

-- Preventiva: pausar não gera novas nem cancela as emitidas.
update public.maintenance_preventive_plans set status='paused',next_due_date=(select today from ctx) where id='d1000000-0000-4000-8000-000000000001';
select is((pg_temp.process()->>'generated')::integer,0,'plano pausado não gera');
select is(
  (select count(*)::integer from public.maintenance_preventive_runs r join public.maintenance_occurrences o on o.id=r.occurrence_id where r.plan_id='d1000000-0000-4000-8000-000000000001' and o.status='canceled'),
  0,'pausar não cancela o que já foi emitido'
);

-- Datas que não existem vão para o último dia do mês.
select is(public.next_maintenance_preventive_date('2027-01-31','monthly',1,31),'2027-02-28'::date,'dia 31 em fevereiro vira o último dia');
select is(public.next_maintenance_preventive_date('2028-01-31','monthly',1,31),'2028-02-29'::date,'em ano bissexto também');
select is(public.next_maintenance_preventive_date('2028-02-29','yearly',1,29),'2029-02-28'::date,'a recorrência anual normaliza 29 de fevereiro');

-- O ciclo automático segue o relógio de cada hotel.
insert into public.hotel_training_environments(hotel_id,clock_mode,frozen_at)
select hotel,'frozen',at+interval '10 days' from ctx
on conflict (hotel_id) do update set clock_mode='frozen',frozen_at=excluded.frozen_at,version=public.hotel_training_environments.version+1;
insert into public.maintenance_preventive_plans(id,hotel_id,name,category_id,room_id,assigned_to,instructions,recurrence_unit,recurrence_day,starts_on,next_due_date,created_by)
select 'd1000000-0000-4000-8000-000000000002',hotel,'Revisão no dia do hotel',category,room,technician,'Revisar','monthly',1,today,today+10,supervisor from ctx;
select lives_ok($$select public.process_maintenance_management_cycle(null,(select hotel from ctx),true)$$,'o ciclo roda sem hora informada');
select is(
  (select count(*)::integer from public.maintenance_preventive_runs where plan_id='d1000000-0000-4000-8000-000000000002' and status='generated'),
  1,'a preventiva vence no dia do hotel, não no dia real'
);
select matches(
  (select command from cron.job where jobname='maintenance-management-cycle'),
  'process_maintenance_management_cycle\(null','o agendamento não fixa a hora real'
);

select * from finish();
rollback;
