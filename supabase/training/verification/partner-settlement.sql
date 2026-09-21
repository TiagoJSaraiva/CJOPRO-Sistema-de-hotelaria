select pg_temp.assert_training_scenario(
  (select scenario_key='partner-settlement' from public.hotel_training_environments
   where hotel_id='10000000-0000-4000-8000-000000000001'),
  'assert_training_scenario partner-settlement key'
);
select pg_temp.assert_training_scenario(
  exists(select 1 from public.commercial_agreement_revisions where id='a3040000-0000-4000-8000-000000000001' and status='activated')
  and exists(select 1 from public.consumption_order_items where id='a3090000-0000-4000-8000-000000000001' and provider_type_snapshot='partner'),
  'assert_training_scenario agreement or eligible sale is missing'
);
select pg_temp.assert_training_scenario(
  exists(select 1 from public.role_permissions rp join public.permissions p on p.id=rp.permission_id
    where rp.role_id='70000000-0000-4000-8000-000000000010' and p.name='settle_partner_settlements')
  and exists(select 1 from public.role_permissions rp join public.permissions p on p.id=rp.permission_id
    where rp.role_id='70000000-0000-4000-8000-000000000010' and p.name='manage_partner_disputes'),
  'assert_training_scenario finance permissions are incomplete'
);
select pg_temp.assert_training_scenario(
  not exists(select 1 from public.role_permissions rp join public.permissions p on p.id=rp.permission_id
    where rp.role_id='70000000-0000-4000-8000-000000000010'
      and p.name='approve_partner_settlements')
  and not exists(select 1 from public.role_permissions rp join public.permissions p on p.id=rp.permission_id
    where rp.role_id='70000000-0000-4000-8000-000000000002'
      and p.name='settle_partner_settlements'),
  'assert_training_scenario settlement segregation is incomplete'
);
select pg_temp.assert_training_scenario(
  not exists(select 1 from public.inventory_positions where id='a2000000-0000-4000-8000-000000000001')
  and not exists(select 1 from public.maintenance_work_orders where id='a1110000-0000-4000-8000-000000000001'),
  'assert_training_scenario partner lesson contains residue'
);
