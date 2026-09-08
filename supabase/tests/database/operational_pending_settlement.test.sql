begin;
select plan(7);
insert into public.commercial_partners(id,hotel_id,trade_name,legal_name)
values('a0910000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Parceiro de teste','Parceiro sintético local');
create temporary table settlement_fixture as
select id partner_id, false approved from public.commercial_partners
where id='a0910000-0000-4000-8000-000000000002';
insert into public.partner_settlements(id,hotel_id,partner_id,period_start,period_end,currency,due_on,created_by)
select 'a0910000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',partner_id,
  '2026-08-01','2026-08-31','BRL','2026-09-10','80000000-0000-4000-8000-000000000002' from settlement_fixture;
-- Model the two legacy source shapes without changing the public alerts contract.
create or replace function public.get_management_alerts(p_hotel_id uuid) returns jsonb language sql as $$
  select jsonb_build_object('result','ok','guest_balances','[]'::jsonb,'critical_stock','[]'::jsonb,'expiring_agreements','[]'::jsonb,
    'pending_settlements',jsonb_build_array(jsonb_build_object(
      'id',case when approved then 'settlement-a0910000-0000-4000-8000-000000000001' else 'settlement-'||partner_id||'-2026-08-01' end,
      'kind','pending_settlement','severity','warning','title',case when approved then 'Pagamento pendente' else 'Apuração pendente' end,
      'href','/dashboard/consumption/settlements','entity_id',case when approved then 'a0910000-0000-4000-8000-000000000001'::uuid else partner_id end
    ))) from settlement_fixture;
$$;
select lives_ok($$select public.operational_pending_candidates('10000000-0000-4000-8000-000000000001')$$,'legacy settlement candidates are valid');
select is(public.reconcile_operational_pending('10000000-0000-4000-8000-000000000001')->>'result','ok','missing settlement reconciles');
create temporary table episode_fixture as select id from public.operational_pending where kind='pending_settlement';
select is(public.act_operational_pending('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',array['read_partner_settlements'],array(select id from episode_fixture),'claim',1)->>'result','ok','operator claims the accounting period');
select public.act_operational_pending('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',array['read_partner_settlements'],array(select id from episode_fixture),'read');
update settlement_fixture set approved=true;
select is(public.reconcile_operational_pending('10000000-0000-4000-8000-000000000001')->>'result','ok','approved unpaid settlement reconciles');
select is((select count(*)::integer from public.operational_pending where kind='pending_settlement'),1,'approval preserves the same episode');
select is((select assigned_to from public.operational_pending where id=(select id from episode_fixture)),'80000000-0000-4000-8000-000000000002'::uuid,'approval preserves owner');
select is((select count(*)::integer from public.operational_pending_reads where pending_id=(select id from episode_fixture)),1,'approval preserves personal reading');
select * from finish();
rollback;
