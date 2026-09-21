select pg_temp.assert_training_scenario(
  (select scenario_key='governance-maintenance' from public.hotel_training_environments
   where hotel_id='10000000-0000-4000-8000-000000000001'),
  'assert_training_scenario governance-maintenance key'
);
select pg_temp.assert_training_scenario(
  exists(select 1 from public.room_blocks b
    join public.maintenance_occurrences o on o.id=b.maintenance_occurrence_id
    join public.maintenance_work_orders w on w.occurrence_id=o.id
    where b.id='95000000-0000-4000-8000-000000000001'
      and b.released_at is null and w.status='assigned'),
  'assert_training_scenario room 103 maintenance chain is incomplete'
);
