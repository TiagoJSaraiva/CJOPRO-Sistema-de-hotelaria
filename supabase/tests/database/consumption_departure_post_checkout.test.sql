begin;
select plan(25);

select ok(to_regclass('public.post_checkout_consumption_cases') is not null,'post checkout cases exist');
select ok(to_regclass('public.post_checkout_consumption_items') is not null,'post checkout item snapshots exist');
select ok(to_regclass('public.post_checkout_supplemental_accounts') is not null,'supplemental accounts exist');
select ok(to_regclass('public.post_checkout_consumption_payments') is not null,'supplemental payments exist');
select ok(to_regclass('public.stay_checkout_operational_snapshots') is not null,'checkout operational snapshot exists');
select ok((select relrowsecurity from pg_class where oid='public.post_checkout_consumption_cases'::regclass),'cases use RLS');
select ok((select relrowsecurity from pg_class where oid='public.post_checkout_consumption_payments'::regclass),'payments use RLS');
select ok(not has_table_privilege('authenticated','public.post_checkout_consumption_cases','SELECT'),'browser cannot read cases directly');
select ok(has_function_privilege('service_role','public.get_stay_departure_review(uuid,uuid)','EXECUTE'),'departure review is service-only');
select ok(has_function_privilege('service_role','public.checkout_stay_account_stage4(uuid,uuid,uuid,bigint,jsonb,uuid,uuid[],uuid[],text)','EXECUTE'),'stage four checkout is callable by backend');
select ok(exists(select 1 from public.permissions where name='review_post_checkout_consumption'),'review permission exists');
select ok(exists(select 1 from public.permissions where name='waive_post_checkout_consumption'),'waiver permission exists');

select is((public.get_stay_departure_review('10000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002')->>'stay_id')::uuid,'91000000-0000-4000-8000-000000000002'::uuid,'review is scoped to active stay');
select is(public.get_stay_departure_review('10000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002'),null,'review does not cross hotel boundary');
select is(public.create_post_checkout_consumption_case('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',jsonb_build_object('stay_id','91000000-0000-4000-8000-000000000002','occurred_at',now(),'report','Tentativa em hospedagem ativa','items',jsonb_build_array(jsonb_build_object('offer_id',(select id from public.consumption_offers where hotel_id='10000000-0000-4000-8000-000000000001' limit 1),'point_id',(select point_id from public.consumption_offers where hotel_id='10000000-0000-4000-8000-000000000001' limit 1),'quantity',1))))->>'result','stay_not_checked_out','active stay cannot become a post checkout case');
select is(public.create_post_checkout_consumption_case('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',jsonb_build_object('stay_id','91000000-0000-4000-8000-000000000003','occurred_at',now(),'report','Horário fora da hospedagem','items',jsonb_build_array(jsonb_build_object('offer_id',(select id from public.consumption_offers where hotel_id='10000000-0000-4000-8000-000000000001' limit 1),'point_id',(select point_id from public.consumption_offers where hotel_id='10000000-0000-4000-8000-000000000001' limit 1),'quantity',1))))->>'result','occurred_outside_stay','case enforces the original stay interval');

insert into public.consumption_points(id,hotel_id,name,default_allowed_billing_modes,default_billing_mode)
values('a4410000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Ponto pós-saída',array['stay_folio']::public.consumption_billing_mode[],'stay_folio');
insert into public.consumption_offers(id,hotel_id,point_id,product_id)
values('a4420000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','a4410000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001');

select is(public.create_post_checkout_consumption_case('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',jsonb_build_object('stay_id','91000000-0000-4000-8000-000000000003','occurred_at',(select checkin_date_actual+interval '1 hour' from public.stays where id='91000000-0000-4000-8000-000000000003'),'report','Item encontrado na vistoria final','items',jsonb_build_array(jsonb_build_object('offer_id',(select id from public.consumption_offers where hotel_id='10000000-0000-4000-8000-000000000001' and is_active limit 1),'point_id',(select point_id from public.consumption_offers where hotel_id='10000000-0000-4000-8000-000000000001' and is_active limit 1),'quantity',1))))->>'result','ok','case snapshots an eligible item');
select is((select status::text from public.post_checkout_consumption_cases where report='Item encontrado na vistoria final'),'draft','new case starts as draft');
select is(public.act_post_checkout_consumption_case('10000000-0000-4000-8000-000000000001',(select id from public.post_checkout_consumption_cases where report='Item encontrado na vistoria final'),'80000000-0000-4000-8000-000000000001','submit',0,'Enviar para conferência',null,null)->>'result','ok','author submits a case');
select is(public.act_post_checkout_consumption_case('10000000-0000-4000-8000-000000000001',(select id from public.post_checkout_consumption_cases where report='Item encontrado na vistoria final'),'80000000-0000-4000-8000-000000000001','approve',1,'Autoaprovação indevida',null,null)->>'result','segregation_required','author cannot approve own case');
select is(public.add_post_checkout_consumption_evidence('10000000-0000-4000-8000-000000000001',(select id from public.post_checkout_consumption_cases where report='Item encontrado na vistoria final'),'80000000-0000-4000-8000-000000000001','private/governance/evidence.jpg','Foto privada da vistoria')->>'result','ok','private evidence is linked');
select is(public.act_post_checkout_consumption_case('10000000-0000-4000-8000-000000000001',(select id from public.post_checkout_consumption_cases where report='Item encontrado na vistoria final'),'80000000-0000-4000-8000-000000000002','approve',1,'Evidência conferida',null,null)->>'result','ok','another operator approves and opens collection');
select is((select status::text from public.post_checkout_consumption_cases where report='Item encontrado na vistoria final'),'collection_pending','approved case waits for collection');
select ok(exists(select 1 from public.post_checkout_supplemental_accounts account join public.post_checkout_consumption_cases case_record on case_record.id=account.case_id where case_record.report='Item encontrado na vistoria final'),'approval creates a supplemental account');
select ok(exists(select 1 from public.consumption_orders order_record join public.post_checkout_consumption_cases case_record on case_record.consumption_order_id=order_record.id where case_record.report='Item encontrado na vistoria final' and order_record.operational_origin='post_checkout'),'approval creates an immutable post checkout sale');

select * from finish();
rollback;
