begin;
select no_plan();
-- Estado independente do seed; toda alteração é revertida ao final.
delete from public.operational_pending where hotel_id='10000000-0000-4000-8000-000000000001';
insert into public.operational_pending(id,hotel_id,source,source_key,kind,entity_type,entity_id,episode,title,href,severity)
select ('a1030000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
 '10000000-0000-4000-8000-000000000001','consumption','summary-'||n,'guest_balance','guest_balance',
 '30000000-0000-4000-8000-000000000001',1,'Saldo '||n,'/dashboard/reservations','warning'
from generate_series(1,33) n;
update public.operational_pending set status='claimed',assigned_to='80000000-0000-4000-8000-000000000002' where source_key='summary-32';
update public.operational_pending set status='resolved',resolved_at=now() where source_key='summary-33';
insert into public.operational_pending(id,hotel_id,source,source_key,kind,entity_type,entity_id,episode,title,href,severity)
values ('a1030000-0000-4000-8000-000000000034','10000000-0000-4000-8000-000000000001','inventory','summary-34','critical_stock','critical_stock','40000000-0000-4000-8000-000000000001',1,'Estoque','/dashboard/inventory','critical');
create temporary table pending_summary_baseline as
select public.list_operational_pending('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',
 array['access_reservations_calendar','read_inventory'])->'summary' as summary;
select is((select summary from pending_summary_baseline),'{"open":32,"claimed":1,"resolved":1,"unread":33}'::jsonb,'resumo autorizado inclui todas as filas; resolvida não conta como não lida');
select is(public.list_operational_pending('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',
 array['access_reservations_calendar','read_inventory'],filters)->'summary',(select summary from pending_summary_baseline),
 'filtro não altera resumo global: '||filters::text)
from (values
 ('{"status":"open"}'::jsonb),('{"status":"claimed"}'),('{"status":"resolved"}'),('{"read":"read"}'),('{"read":"unread"}'),
 ('{"source":"inventory"}'),('{"kind":"critical_stock"}'),('{"severity":"critical"}'),('{"assignee":"me"}'),
 ('{"assignee":"unassigned"}'),('{"page":"2"}'),('{"page":"99"}'),
 ('{"source":"inventory","status":"claimed","read":"read","page":"2"}')
) f(filters);
select is((public.list_operational_pending('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',
 array['access_reservations_calendar','read_inventory'],filters)->>'total')::integer,expected,
 'total segue filtro: '||filters::text)
from (values
 ('{"status":"open"}'::jsonb,32),('{"status":"claimed"}',1),('{"status":"resolved"}',1),
 ('{"read":"read"}',0),('{"read":"unread"}',33),('{"source":"inventory"}',1),
 ('{"kind":"critical_stock"}',1),('{"severity":"critical"}',1),
 ('{"assignee":"me"}',1),('{"assignee":"unassigned"}',32),('{"page":"99"}',34),
 ('{"source":"inventory","status":"claimed","read":"read"}',0)
) f(filters,expected);
select is((public.list_operational_pending('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',
 array['access_reservations_calendar','read_inventory'],'{"status":"claimed"}')->>'total')::integer,1,'total segue situação');
select is(jsonb_array_length(public.list_operational_pending('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',
 array['access_reservations_calendar','read_inventory'],'{"page":"2"}')->'items'),4,'paginação limita apenas itens');
select is((public.list_operational_pending('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',
 array['access_reservations_calendar','read_inventory'],'{"page":"2"}')->>'total')::integer,34,'total não é paginado');
select is(public.act_operational_pending('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',
 array['access_reservations_calendar'],array['a1030000-0000-4000-8000-000000000001']::uuid[],'read')->>'result','ok','leitura pessoal aceita');
select is(public.act_operational_pending('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',
 array['access_reservations_calendar'],array['a1030000-0000-4000-8000-000000000001']::uuid[],'claim',1)->>'result','ok','assumir aceita versão atual');
select is(public.list_operational_pending('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',
 array['access_reservations_calendar','read_inventory'],'{"status":"open"}')->'summary','{"open":31,"claimed":2,"resolved":1,"unread":32}'::jsonb,'assumir atualiza resumo na fila aberta');
select is(public.act_operational_pending('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',
 array['access_reservations_calendar'],array['a1030000-0000-4000-8000-000000000001']::uuid[],'release',2)->>'result','ok','devolver aceita versão atual');
select is(public.list_operational_pending('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',
 array['access_reservations_calendar','read_inventory'],'{"status":"claimed"}')->'summary','{"open":32,"claimed":1,"resolved":1,"unread":32}'::jsonb,'devolver preserva leitura e atualiza resumo na fila assumida');
select is(public.list_operational_pending('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',
 array[]::text[])->'summary','{"open":0,"claimed":0,"resolved":0,"unread":0}'::jsonb,'sem permissão não revela totais');
select is(public.list_operational_pending('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000003',
 array['access_reservations_calendar','read_inventory'])->'summary','{"open":0,"claimed":0,"resolved":0,"unread":0}'::jsonb,'gerente Horizonte não vê resumo Aurora');
select is(public.list_operational_pending('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',
 array['access_reservations_calendar','read_inventory'])->'summary'->>'unread','33','outro usuário conserva sua leitura pessoal');
select * from finish();
rollback;
