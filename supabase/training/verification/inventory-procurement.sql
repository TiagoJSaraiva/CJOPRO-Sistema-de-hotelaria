select pg_temp.assert_training_scenario(
  (select scenario_key='inventory-procurement' from public.hotel_training_environments
   where hotel_id='10000000-0000-4000-8000-000000000001'),
  'assert_training_scenario inventory-procurement key'
);
select pg_temp.assert_training_scenario(
  exists(select 1 from public.inventory_positions where id='a2000000-0000-4000-8000-000000000001' and quantity=18)
  and exists(select 1 from public.inventory_lot_balances where lot_id='a2030000-0000-4000-8000-000000000001' and quantity=18)
  and exists(select 1 from public.minibar_replenishment_routes where id='a20a0000-0000-4000-8000-000000000001' and status='draft')
  and exists(select 1 from public.procurement_suppliers where id='a20d0000-0000-4000-8000-000000000001' and active),
  'assert_training_scenario inventory or procurement prerequisites are incomplete'
);
select pg_temp.assert_training_scenario(
  exists(select 1 from public.role_permissions rp join public.permissions p on p.id=rp.permission_id
    where rp.role_id='70000000-0000-4000-8000-000000000009' and p.name='manage_minibar_compositions'),
  'assert_training_scenario stock role cannot configure minibar'
);
select pg_temp.assert_training_scenario(
  not exists(select 1 from public.commercial_partners where id='a3010000-0000-4000-8000-000000000001')
  and not exists(select 1 from public.maintenance_work_orders where id='a1110000-0000-4000-8000-000000000001'),
  'assert_training_scenario inventory lesson contains residue'
);
