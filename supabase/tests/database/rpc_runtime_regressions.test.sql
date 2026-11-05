begin;
select no_plan();

-- QA-011: funções que falhavam ao executar. Cada uma percorre aqui o caminho que
-- estourava. Os registros-pai são sintéticos: em session_replication_role=replica o
-- Postgres não dispara gatilhos nem confere FKs, o que isola a função testada de
-- cadeias inteiras de cadastro. As funções rodam com as checagens ligadas, salvo
-- recebível e pós-checkout: o Postgres reconfere FKs de linhas criadas na mesma
-- transação, e seus pais (conta corporativa, estadia encerrada) exigem fluxos inteiros.
-- Nesses dois casos o defeito coberto é de tipo e estoura mesmo sem gatilhos.

create temporary table ids as
select
  '10000000-0000-4000-8000-000000000001'::uuid as hotel,
  '80000000-0000-4000-8000-000000000002'::uuid as actor,
  '40000000-0000-4000-8000-000000000005'::uuid as product,
  (select id from public.inventory_locations
   where hotel_id = '10000000-0000-4000-8000-000000000001' order by created_at limit 1) as location,
  'b5200000-0000-4000-8000-000000000001'::uuid as work_order;

set local session_replication_role = replica;

insert into public.maintenance_occurrences (id, hotel_id, category_id, room_id, kind, description, reported_by)
select 'b5100000-0000-4000-8000-000000000001', hotel, gen_random_uuid(), '20000000-0000-4000-8000-000000000103', 'defect', 'Ocorrência pgTAP', actor from ids;
insert into public.maintenance_work_orders (id, hotel_id, occurrence_id, title, instructions, created_by)
select work_order, hotel, 'b5100000-0000-4000-8000-000000000001', 'Ordem pgTAP', 'Instruções pgTAP', actor from ids;

insert into public.corporate_receivables (id, hotel_id, corporate_account_id, authorization_id, stay_id, amount, currency, due_on, version)
select 'b1000000-0000-4000-8000-000000000001', hotel, gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 100, 'BRL', current_date, 1 from ids;

insert into public.post_checkout_consumption_cases (id, hotel_id, stay_id, status, occurred_at, report, created_by, version)
select 'b2000000-0000-4000-8000-000000000001', hotel, gen_random_uuid(), 'collection_pending', now(), 'Relato pgTAP', actor, 1 from ids;
insert into public.post_checkout_supplemental_accounts (id, hotel_id, case_id, amount, currency)
select 'b2100000-0000-4000-8000-000000000001', hotel, 'b2000000-0000-4000-8000-000000000001', 100, 'BRL' from ids;

insert into public.commercial_partners (id, hotel_id, trade_name, legal_name)
select 'b3100000-0000-4000-8000-000000000001', hotel, 'Parceiro pgTAP', 'Parceiro pgTAP Ltda' from ids;
insert into public.partner_settlements (id, hotel_id, partner_id, period_start, period_end, currency, status, direction, net_settlement, due_on, created_by, prepared_by, prepared_at, submitted_by, submitted_at, approved_by, approved_at, statement_snapshot)
select 'b3000000-0000-4000-8000-000000000001', hotel, 'b3100000-0000-4000-8000-000000000001', date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month - 1 day')::date, 'BRL', 'approved', 'hotel_to_partner', 100, current_date, actor, actor, now(), actor, now(), '80000000-0000-4000-8000-000000000001', now(), '{}'::jsonb from ids;

insert into public.business_organizations (id, hotel_id, legal_name)
select 'b4000000-0000-4000-8000-000000000001', hotel, 'Fornecedor pgTAP' from ids;
insert into public.procurement_suppliers (id, hotel_id, organization_id)
select 'b4100000-0000-4000-8000-000000000001', hotel, 'b4000000-0000-4000-8000-000000000001' from ids;
insert into public.purchase_orders (id, hotel_id, supplier_id, destination_location_id, currency, created_by)
select 'b4200000-0000-4000-8000-000000000001', hotel, 'b4100000-0000-4000-8000-000000000001', location, 'BRL', actor from ids;
insert into public.procurement_invoices (id, hotel_id, purchase_order_id, invoice_number, issued_on, total_amount, idempotency_key, created_by)
select 'b4300000-0000-4000-8000-000000000001', hotel, 'b4200000-0000-4000-8000-000000000001', 'NF-PGTAP', current_date, 100, gen_random_uuid(), actor from ids;
insert into public.procurement_invoice_due_dates (id, hotel_id, invoice_id, due_on, amount)
select 'b4400000-0000-4000-8000-000000000001', hotel, 'b4300000-0000-4000-8000-000000000001', current_date, 100 from ids;

insert into public.procurement_policies (hotel_id, currency, configuration_required)
select hotel, 'BRL', false from ids
on conflict (hotel_id) do update set currency = excluded.currency, configuration_required = false;
delete from public.procurement_approval_tiers where hotel_id = (select hotel from ids);
insert into public.procurement_approval_tiers (hotel_id, minimum_amount, approvals_required, quotes_required)
select hotel, 0, 1, 1 from ids;

insert into public.maintenance_reschedule_requests (id, hotel_id, work_order_id, requested_by, reason)
select 'b5000000-0000-4000-8000-000000000001', hotel, work_order, actor, 'Pedido pgTAP' from ids;

insert into public.minibar_compositions (id, hotel_id, room_type, name, created_by)
select 'b6000000-0000-4000-8000-000000000001', hotel, 'Standard', 'Composição pgTAP', actor from ids;

insert into public.maintenance_schedules (hotel_id, work_order_id, technician_id, planned_start, planned_end, estimated_minutes, status, created_by)
select hotel, work_order, actor, now() - interval '3 hours', now() - interval '2 hours', 60, 'planned', actor from ids;

-- Recebível corporativo: status enum calculado por CASE.
select is(
  (select public.pay_corporate_receivable(hotel, 'b1000000-0000-4000-8000-000000000001', actor, 1,
    '[{"amount": 40, "payment_method": "pix"}]', 'b1000000-0000-4000-8000-0000000000a1')->>'result' from ids),
  'ok', 'a corporate receivable accepts a partial payment'
);
select is(
  (select status::text from public.corporate_receivables where id = 'b1000000-0000-4000-8000-000000000001'),
  'partially_paid', 'a partial payment leaves the receivable partially paid'
);
select is(
  (select public.pay_corporate_receivable(hotel, 'b1000000-0000-4000-8000-000000000001', actor, 2,
    '[{"amount": 60, "payment_method": "cash"}]', 'b1000000-0000-4000-8000-0000000000a2')->>'result' from ids),
  'ok', 'a corporate receivable accepts the final payment'
);
select is(
  (select status::text from public.corporate_receivables where id = 'b1000000-0000-4000-8000-000000000001'),
  'paid', 'the final payment settles the receivable'
);
select is(
  (select public.pay_corporate_receivable(hotel, 'b1000000-0000-4000-8000-000000000001', actor, 3,
    '[{"amount": 1, "payment_method": "pix"}]', 'b1000000-0000-4000-8000-0000000000a3')->>'result' from ids),
  'payment_exceeds_balance', 'a receivable refuses a payment above the balance'
);

-- Consumo pós-checkout.
select is(
  (select public.pay_post_checkout_consumption_case(hotel, 'b2000000-0000-4000-8000-000000000001', actor, 1,
    '[{"amount": 100, "payment_method": "pix"}]', 'b2000000-0000-4000-8000-0000000000a1')->>'result' from ids),
  'ok', 'a post-checkout case accepts payment'
);
select is(
  (select status::text from public.post_checkout_consumption_cases where id = 'b2000000-0000-4000-8000-000000000001'),
  'paid', 'full payment settles the post-checkout case'
);

set local session_replication_role = origin;

-- Liquidação parcial de parceiro: payment_method é enum nos pagamentos.
select is(
  (select public.pay_partner_settlement_partial(hotel, 'b3000000-0000-4000-8000-000000000001', actor, jsonb_build_object(
    'expected_version', 1, 'idempotency_key', 'b3000000-0000-4000-8000-0000000000a1',
    'tenders', '[{"amount": 40, "payment_method": "pix", "reference_code": "PGTAP"}]'::jsonb))->>'result' from ids),
  'ok', 'a partner settlement accepts a partial payment'
);
select is(
  (select payment_state from public.partner_settlements where id = 'b3000000-0000-4000-8000-000000000001'),
  'partially_settled', 'a partial payment leaves the settlement partially settled'
);
select is(
  (select count(*)::integer from public.partner_settlement_payments where settlement_id = 'b3000000-0000-4000-8000-000000000001'),
  1, 'the partial payment is recorded'
);

-- Parcela de compra: moeda herdada do pedido e aliases sem colisão.
select is(
  (select public.pay_procurement_installment(hotel, 'b4400000-0000-4000-8000-000000000001', actor, jsonb_build_object(
    'expected_version', 1, 'idempotency_key', 'b4400000-0000-4000-8000-0000000000a1',
    'tenders', '[{"amount": 100, "payment_method": "pix", "reference_code": "PGTAP"}]'::jsonb))->>'result' from ids),
  'ok', 'a procurement installment accepts payment'
);
select is(
  (select t.currency from public.procurement_payments p
   join public.financial_transactions t on t.id = p.financial_transaction_id
   where p.installment_id = 'b4400000-0000-4000-8000-000000000001'),
  'BRL', 'the expense inherits the purchase order currency'
);
select is(
  (select status::text from public.procurement_invoices where id = 'b4300000-0000-4000-8000-000000000001'),
  'paid', 'paying the only installment settles the invoice'
);
select is(
  (select public.pay_procurement_installment(hotel, 'b4400000-0000-4000-8000-000000000001', actor, jsonb_build_object(
    'expected_version', 1, 'idempotency_key', 'b4400000-0000-4000-8000-0000000000a2',
    'cash_session_id', '',
    'tenders', '[{"amount": 1, "payment_method": "cash"}]'::jsonb))->>'result' from ids),
  'conflict', 'an outdated invoice version is refused'
);

-- Pedido de compra.
create temporary table order_result as
select public.create_purchase_order(hotel, actor, jsonb_build_object(
  'supplier_id', 'b4100000-0000-4000-8000-000000000001', 'destination_location_id', location,
  'currency', 'BRL', 'expected_on', current_date + 3, 'notes', 'Pedido pgTAP',
  'lines', jsonb_build_array(jsonb_build_object('product_id', product, 'quantity', 2, 'unit_price', 10, 'tax_amount', 1)),
  'quotes', jsonb_build_array(jsonb_build_object('supplier_id', 'b4100000-0000-4000-8000-000000000001', 'amount', 21, 'reference', 'COT-1')),
  'replenishment_request_ids', '[]'::jsonb
)) as value from ids;
select is((select value->>'result' from order_result), 'ok', 'a purchase order is created');
select is(
  (select total_amount::numeric(12,2) from public.purchase_orders where id = (select (value->>'id')::uuid from order_result)),
  21.00::numeric(12,2), 'the order total adds quantity, price and tax'
);
select is(
  (select public.create_purchase_order(hotel, actor, jsonb_build_object(
    'supplier_id', 'b4100000-0000-4000-8000-000000000001', 'destination_location_id', location,
    'currency', 'USD', 'lines', '[]'::jsonb, 'quotes', '[]'::jsonb, 'replenishment_request_ids', '[]'::jsonb
  ))->>'result' from ids),
  'currency_mismatch', 'an order in another currency is refused'
);

-- Reagendamento de manutenção.
select is(
  (select public.decide_maintenance_reschedule(hotel, 'b5000000-0000-4000-8000-000000000001', actor, true, 'Aprovado no teste')->>'result' from ids),
  'ok', 'a reschedule request is decided'
);
select is(
  (select status::text from public.maintenance_reschedule_requests where id = 'b5000000-0000-4000-8000-000000000001'),
  'approved', 'the approval is recorded'
);

-- Composição de frigobar.
select is(
  (select public.version_minibar_composition(hotel, 'b6000000-0000-4000-8000-000000000001', actor, jsonb_build_object(
    'activate', true,
    'items', jsonb_build_array(jsonb_build_object('product_id', product, 'source_location_id', location, 'ideal_quantity', 2))
  ))->>'result' from ids),
  'ok', 'a minibar composition version is activated'
);
select ok(
  (select active_version_id is not null from public.minibar_compositions where id = 'b6000000-0000-4000-8000-000000000001'),
  'the activated version becomes current'
);

select is(
  (select count(*)::integer from public.inventory_locations
   where kind = 'minibar_room' and hotel_id = '10000000-0000-4000-8000-000000000001'),
  2, 'activation prepares the minibars of the two Standard rooms of the hotel'
);
select is(
  (select count(*)::integer from public.inventory_locations
   where kind = 'minibar_room' and hotel_id = '10000000-0000-4000-8000-000000000002'),
  0, 'activation does not touch rooms of another hotel (QA-012)'
);

-- Rota de reposição de frigobar.
select is(
  (select public.create_minibar_replenishment_route(hotel, actor, jsonb_build_object(
    'expected_board_version', (public.get_minibar_replenishment_board(hotel)->>'version')::bigint,
    'idempotency_key', 'b6100000-0000-4000-8000-000000000001',
    'room_ids', jsonb_build_array('20000000-0000-4000-8000-000000000101')
  ))->>'result' from ids),
  'ok', 'a minibar replenishment route is created'
);

-- Controle por lote: a distribuição inicial precisa fechar com a posição.
select is(
  (select public.configure_product_lot_tracking(hotel, product, actor, jsonb_build_object(
    'mode', 'lot', 'expiry_alert_days', 30, 'initial_lots', '[]'::jsonb
  ))->>'result' from ids),
  'initial_distribution_mismatch', 'a lot distribution that does not match the stock is refused'
);
select is(
  (select public.configure_product_lot_tracking(hotel, product, actor, jsonb_build_object(
    'mode', 'lot', 'expiry_alert_days', 30,
    'initial_lots', (select jsonb_agg(jsonb_build_object('position_id', p.id, 'lot_code', 'LOTE-' || p.id, 'quantity', p.quantity))
      from public.inventory_positions p where p.product_id = product and p.hotel_id = hotel)
  ))->>'result' from ids),
  'ok', 'a matching lot distribution enables lot tracking'
);

-- Entrada sem lote informado vai para quarentena (gatilho do movimento).
insert into public.inventory_movements (hotel_id, position_id, product_id, location_id, kind, quantity_delta, quantity_before, quantity_after, occurred_at, actor_id)
select i.hotel, p.id, i.product, p.location_id, 'adjustment_in', 5, p.quantity, p.quantity + 5, now(), i.actor
from ids i join public.inventory_positions p on p.product_id = i.product and p.hotel_id = i.hotel
limit 1;
select is(
  (select count(*)::integer from public.inventory_lots l, ids i
   where l.product_id = i.product and l.status = 'quarantine'),
  1, 'an entry without a lot code creates a quarantine lot'
);

-- Atendimento vencido sem confirmação não pode derrubar a central de pendências.
select ok(
  (select public.operational_pending_candidates_stage3(hotel, now()) @> '[{"kind": "maintenance_service_confirmation"}]' from ids),
  'an overdue schedule without confirmation becomes a pending item'
);

-- QA-014: com o relógio do hotel em outro dia, o negócio segue esse relógio.
insert into public.hotel_training_environments (hotel_id, clock_mode, frozen_at)
values ('10000000-0000-4000-8000-000000000001', 'frozen', '2035-01-10T15:00:00Z')
on conflict (hotel_id) do update set clock_mode = 'frozen', frozen_at = excluded.frozen_at,
  version = public.hotel_training_environments.version + 1;

insert into public.financial_transactions (id, hotel_id, type, category, amount, status)
select 'b7000000-0000-4000-8000-000000000001', hotel, 'INCOME', 'TESTE', 10, 'COMPLETED' from ids;
select is(
  (select paid_at from public.financial_transactions where id = 'b7000000-0000-4000-8000-000000000001'),
  '2035-01-10T15:00:00Z'::timestamptz, 'a completed payment without a date uses the operational instant'
);
select is(
  (select business_date from public.financial_transactions where id = 'b7000000-0000-4000-8000-000000000001'),
  '2035-01-10'::date, 'the transaction belongs to the operational business date'
);

insert into public.financial_transactions (id, hotel_id, type, category, amount, status, paid_at)
select 'b7000000-0000-4000-8000-000000000002', hotel, 'INCOME', 'TESTE', 10, 'COMPLETED', '2035-01-05T15:00:00Z' from ids;
select is(
  (select business_date from public.financial_transactions where id = 'b7000000-0000-4000-8000-000000000002'),
  '2035-01-05'::date, 'an informed payment date keeps its own business date'
);

insert into public.financial_transactions (id, hotel_id, type, category, amount, status)
select 'b7000000-0000-4000-8000-000000000003', hotel, 'EXPENSE', 'TESTE', 10, 'PENDING' from ids;
select ok(
  (select paid_at is null from public.financial_transactions where id = 'b7000000-0000-4000-8000-000000000003'),
  'a pending transaction stays without a payment date'
);

set local session_replication_role = replica;
insert into public.maintenance_locations (id, hotel_id, kind, name, warranty_ends_on)
select 'b7100000-0000-4000-8000-000000000001', hotel, 'equipment', 'Equipamento pgTAP', '2030-01-01' from ids;
insert into public.maintenance_occurrences (id, hotel_id, category_id, location_id, kind, description, reported_by)
select 'b7200000-0000-4000-8000-000000000001', hotel, gen_random_uuid(), 'b7100000-0000-4000-8000-000000000001', 'defect', 'Equipamento fora da garantia', actor from ids;
set local session_replication_role = origin;
select is(
  (select public.create_maintenance_lifecycle_decision(hotel, 'b7200000-0000-4000-8000-000000000001', actor, jsonb_build_object(
    'recommendation', 'repair', 'single_option_reason', 'Única alternativa no teste',
    'options', jsonb_build_array(jsonb_build_object('kind', 'warranty', 'estimated_cost', 0,
      'estimated_downtime_hours', 1, 'risks', 'Nenhum', 'benefits', 'Nenhum', 'justification', 'Teste'))
  ))->>'result' from ids),
  'ok', 'a lifecycle decision is created'
);
select is(
  (select warranty_eligible from public.maintenance_lifecycle_options o
   join public.maintenance_lifecycle_decisions d on d.id = o.decision_id
   where d.occurrence_id = 'b7200000-0000-4000-8000-000000000001'),
  false, 'a warranty that expired before the operational date is not eligible'
);

-- Trava estática: nenhuma função pode voltar a ter erro detectável sem executar.
create extension if not exists plpgsql_check;
select is(
  (select coalesce(string_agg(distinct p.proname || ': ' || c.message, ' | '), '')
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   join pg_language l on l.oid = p.prolang
   cross join lateral public.plpgsql_check_function_tb(
     p.oid,
     relid => coalesce((select t.tgrelid from pg_trigger t where t.tgfoid = p.oid and not t.tgisinternal limit 1), 0),
     fatal_errors => false, extra_warnings => false, other_warnings => false, performance_warnings => false
   ) c
   where n.nspname = 'public' and l.lanname = 'plpgsql' and p.prokind = 'f' and c.level = 'error'
     and not (
       p.prorettype = 'trigger'::regtype
       and (select count(distinct t.tgrelid) from pg_trigger t where t.tgfoid = p.oid and not t.tgisinternal) <> 1
     )),
  '', 'no PL/pgSQL function has a static error'
);

select * from finish();
rollback;
