begin;
select plan(12);
insert into public.maintenance_occurrences(id,hotel_id,category_id,room_id,kind,priority,description,reported_by)
select id,'10000000-0000-4000-8000-000000000001',(select id from public.maintenance_categories where hotel_id='10000000-0000-4000-8000-000000000001' limit 1),'20000000-0000-4000-8000-000000000102','defect','normal','Duplicidade sintética','80000000-0000-4000-8000-000000000002'
from unnest(array['97110000-0000-4000-8000-000000000001'::uuid,'97110000-0000-4000-8000-000000000002'::uuid,'97110000-0000-4000-8000-000000000003'::uuid]) id;
select throws_ok($$ update public.maintenance_occurrences set duplicate_of_id=id where id='97110000-0000-4000-8000-000000000001' $$,'23514',null,'self link rejected');
select throws_ok($$ update public.maintenance_occurrences set duplicate_of_id='ffffffff-ffff-4fff-8fff-ffffffffffff' where id='97110000-0000-4000-8000-000000000001' $$,'23514',null,'missing destination rejected');
select lives_ok($$ update public.maintenance_occurrences set duplicate_of_id='97110000-0000-4000-8000-000000000002' where id='97110000-0000-4000-8000-000000000001' $$,'canonical destination accepted');
select throws_ok($$ update public.maintenance_occurrences set duplicate_of_id='97110000-0000-4000-8000-000000000001' where id='97110000-0000-4000-8000-000000000002' $$,'23514',null,'cycle rejected');
select throws_ok($$ update public.maintenance_occurrences set duplicate_of_id='97110000-0000-4000-8000-000000000001' where id='97110000-0000-4000-8000-000000000003' $$,'23514',null,'destination already duplicate rejected');
select throws_ok($$ update public.maintenance_occurrences set duplicate_of_id='97110000-0000-4000-8000-000000000003' where id='97110000-0000-4000-8000-000000000002' $$,'23514',null,'canonical destination cannot become duplicate');
select throws_ok($$ select public.apply_maintenance_occurrence_change('10000000-0000-4000-8000-000000000001','97110000-0000-4000-8000-000000000003','80000000-0000-4000-8000-000000000002','{}','occurrence_canceled','   ') $$,'23514',null,'blank cancellation rejected transactionally');
select throws_ok($$ select public.apply_maintenance_occurrence_change('10000000-0000-4000-8000-000000000001','97110000-0000-4000-8000-000000000003','80000000-0000-4000-8000-000000000002','{}','occurrence_marked_duplicate','   ') $$,'23514',null,'blank duplicate reason rejected transactionally');
select throws_ok($$ select public.transition_maintenance_work_order('10000000-0000-4000-8000-000000000001','ffffffff-ffff-4fff-8fff-ffffffffffff','80000000-0000-4000-8000-000000000002','complete',null,null,'Serviço realizado','  ') $$,'23514',null,'blank diagnosis rejected transactionally');
select throws_ok($$ select public.inspect_maintenance_work_order('10000000-0000-4000-8000-000000000001','ffffffff-ffff-4fff-8fff-ffffffffffff','80000000-0000-4000-8000-000000000002','rejected','  ') $$,'23514',null,'blank inspection rejected transactionally');
select throws_ok($$ select public.transition_maintenance_work_order('10000000-0000-4000-8000-000000000001','ffffffff-ffff-4fff-8fff-ffffffffffff','80000000-0000-4000-8000-000000000002','complete',null,null,repeat('a',4001),'Diagnóstico') $$,'23514',null,'transaction honors text limit');
select throws_ok($$ select public.inspect_maintenance_work_order('10000000-0000-4000-8000-000000000001','ffffffff-ffff-4fff-8fff-ffffffffffff','80000000-0000-4000-8000-000000000002','rejected',' x ') $$,'23514',null,'minimum length checked after trimming');
select * from finish();
rollback;
