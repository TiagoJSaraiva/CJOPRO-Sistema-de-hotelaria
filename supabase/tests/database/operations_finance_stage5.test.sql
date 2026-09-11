begin;
select plan(37);

select has_table('public','business_organizations','organizations exist');
select has_table('public','replenishment_requests','replenishment requests exist');
select has_table('public','purchase_orders','purchase orders exist');
select has_table('public','purchase_receipts','purchase receipts exist');
select has_table('public','procurement_invoices','procurement invoices exist');
select has_table('public','procurement_invoice_due_dates','supplier installments exist');
select has_table('public','inventory_lots','inventory lots exist');
select has_table('public','inventory_lot_balances','lot balances exist');
select has_table('public','minibar_compositions','minibar compositions exist');
select has_table('public','minibar_replenishment_routes','minibar routes exist');
select has_table('public','cash_registers','cash registers exist');
select has_table('public','cash_sessions','cash sessions exist');
select has_table('public','cash_movements','cash movements exist');
select has_table('public','daily_closes','daily closes exist');
select has_table('public','partner_settlement_disputes','partner disputes exist');
select has_table('public','business_organization_conflicts','organization conflicts exist');
select has_table('public','procurement_payment_batches','supplier payment batches exist');
select has_table('public','partner_settlement_payment_batches','partner payment batches exist');
select has_function('public','get_business_organization_overview',array['uuid','uuid','text[]'],'organization overview exists');

select is(public.normalize_business_tax_id('12.345.678/0001-90'),'12345678000190','tax identifier normalization is deterministic');
select is(public.normalize_business_tax_id('   '),null,'empty tax identifier does not merge');
select ok((select count(*)>0 from public.business_organizations),'existing business roles were migrated');
select ok(not exists(select 1 from public.commercial_partners where organization_id is null),'commercial partners are linked');
select ok(not exists(select 1 from public.maintenance_suppliers where organization_id is null),'maintenance suppliers are linked');
select ok(not exists(select 1 from public.corporate_accounts where organization_id is null),'corporate accounts are linked');

select is((select configuration_required from public.procurement_policies where hotel_id='10000000-0000-4000-8000-000000000001'),true,'existing hotel starts with procurement policy pending configuration');
select is((public.save_procurement_policy('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',jsonb_build_object('currency','BRL','price_tolerance_percent',5,'price_tolerance_amount',1,'quantity_tolerance_percent',2,'quantity_tolerance_amount',0,'tiers',jsonb_build_array(jsonb_build_object('minimum_amount',0,'maximum_amount',1000,'approvals_required',1,'quotes_required',1),jsonb_build_object('minimum_amount',1000.01,'maximum_amount',null,'approvals_required',2,'quotes_required',2))))->>'result'),'ok','policy can be configured');
select is((select count(*)::integer from public.procurement_approval_tiers where hotel_id='10000000-0000-4000-8000-000000000001'),2,'approval tiers are replaced atomically');

insert into public.cash_registers(id,hotel_id,name,code,kind,currency,difference_tolerance,created_by) values('a5000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Recepção teste','TESTE','reception','BRL',5,'80000000-0000-4000-8000-000000000002');
select is((public.open_cash_session('10000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',jsonb_build_object('opening_float',100,'idempotency_key','a5000000-0000-4000-8000-000000000002')))->>'result','ok','operator opens an exclusive cash session');
select is((public.open_cash_session('10000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000003',jsonb_build_object('opening_float',100,'idempotency_key','a5000000-0000-4000-8000-000000000003')))->>'result','active_session_exists','same register cannot have a second session');
select is((public.post_cash_movement('10000000-0000-4000-8000-000000000001',(select id from public.cash_sessions where cash_register_id='a5000000-0000-4000-8000-000000000001'),'80000000-0000-4000-8000-000000000003',false,jsonb_build_object('kind','cash_in','amount',10,'reason','Suprimento de teste','idempotency_key','a5000000-0000-4000-8000-000000000004')))->>'result','session_not_operable','another operator cannot post');
select is((public.post_cash_movement('10000000-0000-4000-8000-000000000001',(select id from public.cash_sessions where cash_register_id='a5000000-0000-4000-8000-000000000001'),'80000000-0000-4000-8000-000000000002',false,jsonb_build_object('kind','cash_in','amount',10,'reason','Suprimento de teste','idempotency_key','a5000000-0000-4000-8000-000000000004')))->>'result','ok','responsible operator can post');
select is((select expected_cash from public.cash_sessions where cash_register_id='a5000000-0000-4000-8000-000000000001'),110::numeric,'cash expectation follows immutable movements');

select ok((select relrowsecurity from pg_class where oid='public.purchase_orders'::regclass),'procurement tables use RLS');
select ok((select relrowsecurity from pg_class where oid='public.inventory_lots'::regclass),'lot tables use RLS');
select ok((select relrowsecurity from pg_class where oid='public.cash_sessions'::regclass),'cash tables use RLS');
select ok((select relrowsecurity from pg_class where oid='public.partner_settlement_disputes'::regclass),'partner disputes use RLS');

select * from finish();
rollback;
