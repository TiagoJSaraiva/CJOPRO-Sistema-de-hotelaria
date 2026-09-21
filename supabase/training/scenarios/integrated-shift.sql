select public.prepare_training_scenario(
  '10000000-0000-4000-8000-000000000001','integrated-shift',2,
  'Turno integrado final com reservas, manutenção, estoque, caixa e gestão.',
  '80000000-0000-4000-8000-000000000002'
);

insert into public.replenishment_requests(
  id,hotel_id,product_id,location_id,episode,source,status,priority,
  current_quantity,minimum_quantity,ideal_quantity,requested_quantity,
  need_by,preferred_supplier_id,responsible_id,reason,created_by
)
select
  'a4000000-0000-4000-8000-000000000001',position.hotel_id,
  position.product_id,position.location_id,1,'manual','submitted','high',
  position.quantity,position.minimum_quantity,position.ideal_quantity,6,
  public.hotel_operational_date(position.hotel_id)+2,
  'a20d0000-0000-4000-8000-000000000001',
  '80000000-0000-4000-8000-000000000009',
  'Reposição do turno integrado aguardando aprovação.',
  '80000000-0000-4000-8000-000000000009'
from public.inventory_positions position
where position.id='a2000000-0000-4000-8000-000000000001';

insert into public.purchase_orders(
  id,hotel_id,supplier_id,destination_location_id,status,currency,
  expected_on,notes,total_amount,required_approvals,required_quotes,created_by
)
select
  'a4010000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'a20d0000-0000-4000-8000-000000000001',location.id,
  'pending_approval','BRL',
  public.hotel_operational_date('10000000-0000-4000-8000-000000000001')+2,
  'Pedido sintético do turno integrado.',18,1,0,
  '80000000-0000-4000-8000-000000000009'
from public.inventory_locations location
where location.hotel_id='10000000-0000-4000-8000-000000000001'
  and location.internal_code='CENTRAL';
insert into public.purchase_order_lines(
  id,hotel_id,purchase_order_id,product_id,quantity,received_quantity,
  unit_price,tax_amount
) values(
  'a4020000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'a4010000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',6,0,3,0
);
insert into public.purchase_order_replenishments(
  hotel_id,purchase_order_id,replenishment_request_id
) values(
  '10000000-0000-4000-8000-000000000001',
  'a4010000-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000001'
);

select public.reconcile_operational_pending(
  '10000000-0000-4000-8000-000000000001',
  public.hotel_operational_now('10000000-0000-4000-8000-000000000001')
);

do $$ begin
  if (select count(*) from public.user_roles where hotel_id='10000000-0000-4000-8000-000000000001')<8
     or not exists(select 1 from public.maintenance_locations where hotel_id='10000000-0000-4000-8000-000000000001' and kind='equipment')
     or not exists(select 1 from public.cash_registers where hotel_id='10000000-0000-4000-8000-000000000001')
     or not exists(select 1 from public.stays where id='91000000-0000-4000-8000-000000000001' and checkin_date_expected::date=public.hotel_operational_date('10000000-0000-4000-8000-000000000001'))
     or not exists(select 1 from public.maintenance_work_orders where id='a1110000-0000-4000-8000-000000000001' and status='assigned')
     or not exists(select 1 from public.maintenance_notifications where entity_id='99500000-0000-4000-8000-000000000001' and kind='warranty_expiry' and status='unread')
     or not exists(select 1 from public.minibar_replenishment_routes where id='a20a0000-0000-4000-8000-000000000001' and status='draft')
     or not exists(select 1 from public.purchase_orders where id='a4010000-0000-4000-8000-000000000001' and status='pending_approval')
     or not exists(select 1 from public.consumption_order_items where id='a3090000-0000-4000-8000-000000000001' and provider_type_snapshot='partner') then
    raise exception 'integrated-shift prerequisites are incomplete';
  end if;
end $$;
