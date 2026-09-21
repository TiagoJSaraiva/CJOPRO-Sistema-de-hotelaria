select pg_temp.assert_training_scenario(
  (select scenario_key='warranty' from public.hotel_training_environments
   where hotel_id='10000000-0000-4000-8000-000000000001'),
  'assert_training_scenario warranty key'
);
select pg_temp.assert_training_scenario(
  exists(select 1 from public.maintenance_notifications
    where hotel_id='10000000-0000-4000-8000-000000000001'
      and entity_id='99500000-0000-4000-8000-000000000001'
      and kind='warranty_expiry' and status='unread'),
  'assert_training_scenario warranty notification is missing'
);
