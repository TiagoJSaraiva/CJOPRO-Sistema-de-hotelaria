select pg_temp.assert_training_scenario(
  (select scenario_key='consumption-account' from public.hotel_training_environments
   where hotel_id='10000000-0000-4000-8000-000000000001'),
  'assert_training_scenario consumption-account key'
);
select pg_temp.assert_training_scenario(
  exists(select 1 from public.consumption_orders
    where id='93000000-0000-4000-8000-000000000001'
      and disposition='legacy_unclassified' and is_legacy),
  'assert_training_scenario unclassified consumption is missing'
);
