select public.prepare_training_scenario(
  '10000000-0000-4000-8000-000000000001','inventory-procurement',2,
  'Estoque do Aurora com posição, lote, frigobar, fornecedor e política de compras.',
  '80000000-0000-4000-8000-000000000002'
);

insert into public.inventory_positions(
  id,hotel_id,product_id,location_id,quantity,version,minimum_quantity,
  ideal_quantity,average_unit_cost,is_active,created_by,updated_by
)
select
  'a2000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',location.id,
  18,1,8,24,3.0000,true,
  '80000000-0000-4000-8000-000000000009',
  '80000000-0000-4000-8000-000000000009'
from public.inventory_locations location
where location.hotel_id='10000000-0000-4000-8000-000000000001'
  and location.internal_code='CENTRAL';

insert into public.inventory_documents(
  id,hotel_id,kind,reason,reference_code,occurred_at,posted_by,
  idempotency_key,request_fingerprint,metadata
) values(
  'a2010000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001','adjustment',
  'Saldo inicial do cenário didático','TREINO-ESTOQUE-001',
  public.hotel_operational_now('10000000-0000-4000-8000-000000000001'),
  '80000000-0000-4000-8000-000000000009',
  'a2010000-0000-4000-8000-000000000002','training:inventory-opening',
  jsonb_build_object('scenario','inventory-procurement')
);

insert into public.inventory_movements(
  id,hotel_id,position_id,product_id,location_id,kind,quantity_delta,
  quantity_before,quantity_after,average_unit_cost,total_cost,reason,
  reference_code,occurred_at,actor_id,document_id
)
select
  'a2020000-0000-4000-8000-000000000001',position.hotel_id,position.id,
  position.product_id,position.location_id,'opening',18,0,18,3.0000,54.0000,
  'Saldo inicial do cenário didático','TREINO-ESTOQUE-001',
  public.hotel_operational_now(position.hotel_id),
  '80000000-0000-4000-8000-000000000009',
  'a2010000-0000-4000-8000-000000000001'
from public.inventory_positions position
where position.id='a2000000-0000-4000-8000-000000000001';

update public.products
set lot_tracking_mode='lot_expiry',expiry_alert_days=15
where id='40000000-0000-4000-8000-000000000001'
  and hotel_id='10000000-0000-4000-8000-000000000001';

insert into public.inventory_lots(
  id,hotel_id,product_id,lot_code,expires_on,status,received_at
) values(
  'a2030000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001','AUR-AGUA-001',
  public.hotel_operational_date('10000000-0000-4000-8000-000000000001')+60,
  'active',public.hotel_operational_now('10000000-0000-4000-8000-000000000001')
);
insert into public.inventory_lot_balances(
  id,hotel_id,lot_id,position_id,quantity,version
) values(
  'a2040000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'a2030000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',18,1
);

insert into public.minibar_compositions(
  id,hotel_id,room_type,name,created_by
) values(
  'a2050000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001','Standard',
  'Frigobar Standard Aurora','80000000-0000-4000-8000-000000000009'
);
insert into public.minibar_composition_versions(
  id,hotel_id,composition_id,version,activated_at,activated_by,created_by
) values(
  'a2060000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'a2050000-0000-4000-8000-000000000001',1,
  public.hotel_operational_now('10000000-0000-4000-8000-000000000001'),
  '80000000-0000-4000-8000-000000000009',
  '80000000-0000-4000-8000-000000000009'
);
insert into public.minibar_composition_items(
  id,hotel_id,version_id,product_id,source_location_id,ideal_quantity
)
select
  'a2070000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'a2060000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',location.id,2
from public.inventory_locations location
where location.hotel_id='10000000-0000-4000-8000-000000000001'
  and location.internal_code='CENTRAL';
update public.minibar_compositions
set active_version_id='a2060000-0000-4000-8000-000000000001'
where id='a2050000-0000-4000-8000-000000000001';

insert into public.inventory_locations(
  id,hotel_id,name,internal_code,kind,room_id,is_active,created_by
) values
  ('a2080000-0000-4000-8000-000000000101','10000000-0000-4000-8000-000000000001',
   'Frigobar 101','MINIBAR-101','minibar_room','20000000-0000-4000-8000-000000000101',true,
   '80000000-0000-4000-8000-000000000009'),
  ('a2080000-0000-4000-8000-000000000103','10000000-0000-4000-8000-000000000001',
   'Frigobar 103','MINIBAR-103','minibar_room','20000000-0000-4000-8000-000000000103',true,
   '80000000-0000-4000-8000-000000000009');
insert into public.inventory_positions(
  id,hotel_id,product_id,location_id,quantity,version,minimum_quantity,
  ideal_quantity,average_unit_cost,is_active,created_by,updated_by
) values
  ('a2090000-0000-4000-8000-000000000101','10000000-0000-4000-8000-000000000001',
   '40000000-0000-4000-8000-000000000001','a2080000-0000-4000-8000-000000000101',
   0,0,0,2,3.0000,true,'80000000-0000-4000-8000-000000000009','80000000-0000-4000-8000-000000000009'),
  ('a2090000-0000-4000-8000-000000000103','10000000-0000-4000-8000-000000000001',
   '40000000-0000-4000-8000-000000000001','a2080000-0000-4000-8000-000000000103',
   0,0,0,2,3.0000,true,'80000000-0000-4000-8000-000000000009','80000000-0000-4000-8000-000000000009');

insert into public.minibar_replenishment_routes(
  id,hotel_id,status,version,responsible_id,idempotency_key,
  request_fingerprint,created_by
) values(
  'a20a0000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001','draft',1,null,
  'a20a0000-0000-4000-8000-000000000002','training:minibar-route',
  '80000000-0000-4000-8000-000000000009'
);
insert into public.minibar_replenishment_route_items(
  id,hotel_id,route_id,room_id,product_id,source_position_id,
  destination_position_id,quantity,status
) values(
  'a20b0000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'a20a0000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000101',
  '40000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'a2090000-0000-4000-8000-000000000101',2,'pending'
);

insert into public.business_organizations(
  id,hotel_id,legal_name,trade_name,tax_id,currency,email,phone,created_by
) values(
  'a20c0000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Suprimentos Escola Ltda.','Suprimentos Escola','99.999.999/0001-99','BRL',
  'compras@suprimentos.example','(11) 3000-0100',
  '80000000-0000-4000-8000-000000000009'
);
insert into public.procurement_suppliers(
  id,hotel_id,organization_id,payment_term_days,lead_time_days,active,created_by
) values(
  'a20d0000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'a20c0000-0000-4000-8000-000000000001',15,2,true,
  '80000000-0000-4000-8000-000000000009'
);
update public.procurement_policies
set configuration_required=false,price_tolerance_percent=5,
    quantity_tolerance_percent=5,updated_by='80000000-0000-4000-8000-000000000002'
where hotel_id='10000000-0000-4000-8000-000000000001';
insert into public.procurement_approval_tiers(
  id,hotel_id,minimum_amount,maximum_amount,approvals_required,quotes_required
) values(
  'a20e0000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',0,null,1,0
);

do $$ begin
  if not exists(
    select 1 from public.inventory_positions
    where id='a2000000-0000-4000-8000-000000000001' and quantity=18
  ) or not exists(
    select 1 from public.inventory_lot_balances
    where lot_id='a2030000-0000-4000-8000-000000000001' and quantity=18
  ) or not exists(
    select 1 from public.minibar_replenishment_routes
    where id='a20a0000-0000-4000-8000-000000000001' and status='draft'
  ) or not exists(
    select 1 from public.procurement_suppliers
    where id='a20d0000-0000-4000-8000-000000000001' and active
  ) then
    raise exception 'inventory-procurement fixture is incomplete';
  end if;
end $$;
