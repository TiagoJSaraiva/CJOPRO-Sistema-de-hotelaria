begin;
select plan(8);

-- Estoque e compras seguem o relógio operacional do hotel (docs/training/time-contract.md). O limite
-- de "data futura" comparava com o tempo real: com o relógio à frente, nada entrava no estoque.
create temporary table ctx on commit drop as
select
  '10000000-0000-4000-8000-000000000001'::uuid as hotel,
  '80000000-0000-4000-8000-000000000009'::uuid as actor,
  (select id from public.inventory_positions where hotel_id='10000000-0000-4000-8000-000000000001' limit 1) as position_id,
  (select location_id from public.inventory_positions where hotel_id='10000000-0000-4000-8000-000000000001' limit 1) as location_id,
  (select product_id from public.inventory_positions where hotel_id='10000000-0000-4000-8000-000000000001' limit 1) as product_id;

insert into public.hotel_training_environments(hotel_id,clock_mode,frozen_at)
select hotel,'frozen',now()+interval '3 days' from ctx
on conflict(hotel_id) do update set clock_mode='frozen',frozen_at=excluded.frozen_at,
  version=public.hotel_training_environments.version+1;

create function pg_temp.post(p_at timestamptz) returns text language sql as $$
  select public.post_inventory_document(hotel,actor,'receipt',null,'Entrada no relógio do hotel',null,p_at,
    jsonb_build_array(jsonb_build_object('position_id',position_id,'quantity',1,'unit_cost',3)),gen_random_uuid())->>'result'
  from ctx
$$;

select is(
  pg_temp.post((select public.hotel_operational_now(hotel) from ctx)),
  'ok','com o relógio à frente do tempo real, a entrada é aceita'
);
select is(
  pg_temp.post((select public.hotel_operational_now(hotel)+interval '1 hour' from ctx)),
  'invalid_document','depois da hora do hotel, a entrada é recusada'
);
select is(
  pg_temp.post((select public.hotel_operational_now(hotel)-interval '1 hour' from ctx)),
  'ok','antes da hora do hotel, a entrada é aceita'
);

-- Transferência entre locais.
insert into public.inventory_locations(id,hotel_id,name,internal_code,kind,is_active,created_by)
select 'a9500000-0000-4000-8000-000000000001',hotel,'Depósito do relógio','TESTE-RELOGIO','warehouse',true,actor from ctx;
insert into public.inventory_positions(id,hotel_id,product_id,location_id,quantity,version,minimum_quantity,ideal_quantity,average_unit_cost,is_active,created_by,updated_by)
select 'a9500000-0000-4000-8000-000000000002',hotel,product_id,'a9500000-0000-4000-8000-000000000001',0,1,0,0,3,true,actor,actor from ctx;

select is(
  (select public.transfer_inventory(hotel,actor,location_id,'a9500000-0000-4000-8000-000000000001',product_id,1,
    'Transferência no relógio do hotel',null,public.hotel_operational_now(hotel),gen_random_uuid())->>'result' from ctx),
  'ok','a transferência também segue a hora do hotel'
);
select is(
  (select public.transfer_inventory(hotel,actor,location_id,'a9500000-0000-4000-8000-000000000001',product_id,1,
    'Transferência no futuro',null,public.hotel_operational_now(hotel)+interval '1 hour',gen_random_uuid())->>'result' from ctx),
  'invalid_transfer','depois da hora do hotel, a transferência é recusada'
);

-- Recebimento de compra.
insert into public.business_organizations(id,hotel_id,legal_name,currency,created_by)
select 'a9500000-0000-4000-8000-000000000005',hotel,'Fornecedor do relógio','BRL',actor from ctx;
insert into public.procurement_suppliers(id,hotel_id,organization_id,payment_term_days,lead_time_days,active,created_by)
select 'a9500000-0000-4000-8000-000000000006',hotel,'a9500000-0000-4000-8000-000000000005',15,2,true,actor from ctx;
insert into public.purchase_orders(id,hotel_id,supplier_id,destination_location_id,status,currency,total_amount,required_approvals,required_quotes,created_by)
select 'a9500000-0000-4000-8000-000000000003',hotel,'a9500000-0000-4000-8000-000000000006',location_id,'issued','BRL',6,1,0,actor from ctx;
insert into public.purchase_order_lines(id,hotel_id,purchase_order_id,product_id,quantity,received_quantity,unit_price,tax_amount)
select 'a9500000-0000-4000-8000-000000000004',hotel,'a9500000-0000-4000-8000-000000000003',product_id,2,0,3,0 from ctx;

create function pg_temp.receive(p_at timestamptz) returns text language sql as $$
  select public.receive_purchase_order(hotel,'a9500000-0000-4000-8000-000000000003',actor,jsonb_build_object(
    'expected_version',(select version from public.purchase_orders where id='a9500000-0000-4000-8000-000000000003'),
    'occurred_at',p_at,'idempotency_key',gen_random_uuid(),
    'lines',jsonb_build_array(jsonb_build_object('order_line_id','a9500000-0000-4000-8000-000000000004',
      'accepted_quantity',1,'rejected_quantity',0,'unit_cost',3))))->>'result'
  from ctx
$$;

select is(
  pg_temp.receive((select public.hotel_operational_now(hotel)+interval '1 hour' from ctx)),
  'invalid_occurred_at','recebimento depois da hora do hotel é recusado'
);
select is(
  pg_temp.receive((select public.hotel_operational_now(hotel) from ctx)),
  'ok','com o relógio à frente do tempo real, o recebimento é aceito'
);
select is(
  (select occurred_at from public.purchase_receipts where purchase_order_id='a9500000-0000-4000-8000-000000000003'),
  (select public.hotel_operational_now(hotel) from ctx),
  'o recebimento guarda a hora do hotel'
);

select * from finish();
rollback;
