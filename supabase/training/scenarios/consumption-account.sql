select public.prepare_training_scenario(
  '10000000-0000-4000-8000-000000000001','consumption-account',1,
  'Hospedagem ativa com consumo ainda não classificado na conta.',
  '80000000-0000-4000-8000-000000000002'
);

do $$ begin
  if not exists(select 1 from public.consumption_orders where id='93000000-0000-4000-8000-000000000001') then
    raise exception 'consumption-account order is missing';
  end if;
end $$;

-- A lição lança água com baixa de estoque: Balcão Aurora sai do Estoque central.
-- No turno integrado, a posição já vem de inventory-procurement e é preservada.
insert into public.inventory_positions(
  id,hotel_id,product_id,location_id,quantity,version,minimum_quantity,
  ideal_quantity,average_unit_cost,is_active,created_by,updated_by
)
select
  'a6000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',location.id,
  18,1,8,24,3.0000,true,
  '80000000-0000-4000-8000-000000000009',
  '80000000-0000-4000-8000-000000000009'
from public.inventory_locations location
where location.hotel_id='10000000-0000-4000-8000-000000000001'
  and location.internal_code='CENTRAL'
  and not exists(
    select 1 from public.inventory_positions existing
    where existing.hotel_id=location.hotel_id
      and existing.product_id='40000000-0000-4000-8000-000000000001'
      and existing.location_id=location.id
  );

insert into public.inventory_documents(
  id,hotel_id,kind,reason,reference_code,occurred_at,posted_by,
  idempotency_key,request_fingerprint,metadata
)
select
  'a6010000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001','adjustment',
  'Saldo inicial do cenário didático','TREINO-CONSUMO-001',
  public.hotel_operational_now('10000000-0000-4000-8000-000000000001'),
  '80000000-0000-4000-8000-000000000009',
  'a6010000-0000-4000-8000-000000000002','training:consumption-opening',
  jsonb_build_object('scenario','consumption-account')
where exists(
  select 1 from public.inventory_positions
  where id='a6000000-0000-4000-8000-000000000001'
);

insert into public.inventory_movements(
  id,hotel_id,position_id,product_id,location_id,kind,quantity_delta,
  quantity_before,quantity_after,average_unit_cost,total_cost,reason,
  reference_code,occurred_at,actor_id,document_id
)
select
  'a6020000-0000-4000-8000-000000000001',position.hotel_id,position.id,
  position.product_id,position.location_id,'opening',18,0,18,3.0000,54.0000,
  'Saldo inicial do cenário didático','TREINO-CONSUMO-001',
  public.hotel_operational_now(position.hotel_id),
  '80000000-0000-4000-8000-000000000009',
  'a6010000-0000-4000-8000-000000000001'
from public.inventory_positions position
where position.id='a6000000-0000-4000-8000-000000000001';

update public.consumption_points point
set default_inventory_location_id=location.id
from public.inventory_locations location
where point.id='81000000-0000-4000-8000-000000000001'
  and location.hotel_id=point.hotel_id
  and location.internal_code='CENTRAL';

-- Erro proposital: o Café Aurora não tem origem de estoque para este produto físico.
insert into public.consumption_offers(
  id,hotel_id,point_id,product_id,display_order,is_active,policy_source,last_changed_by
) values(
  'a6100000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000005',20,true,'inherit',
  '80000000-0000-4000-8000-000000000002'
);
