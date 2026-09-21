select pg_temp.assert_training_scenario(
  (select scenario_key='orientation' from public.hotel_training_environments
   where hotel_id='10000000-0000-4000-8000-000000000001'),
  'assert_training_scenario orientation key'
);
select pg_temp.assert_training_scenario(
  not exists(select 1 from public.inventory_positions where id='a2000000-0000-4000-8000-000000000001')
  and not exists(select 1 from public.commercial_partners where id='a3010000-0000-4000-8000-000000000001')
  and not exists(select 1 from public.maintenance_work_orders where id='a1110000-0000-4000-8000-000000000001'),
  'assert_training_scenario orientation contains residue from another lesson'
);
